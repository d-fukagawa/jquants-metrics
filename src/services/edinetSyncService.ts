import { sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import {
  edinetBridgeFacts,
  edinetCompanyMap,
  edinetFilings,
  edinetForecasts,
  edinetQualityScores,
  edinetSyncRuns,
  edinetTextScores,
} from '../db/schema'
import {
  fetchCompanyBridgeFacts,
  fetchCompanyFilings,
  fetchCompanyForecasts,
  fetchQualityScore,
  fetchTextAnomalyScore,
  searchCompanyByCode,
} from '../edinet/client'
import { toNullableString } from '../utils/number'

function nowIso() {
  return new Date().toISOString()
}

async function startRun(db: Db, target: string): Promise<string> {
  const runId = `${target}:${Date.now()}`
  await db.insert(edinetSyncRuns).values({
    runId,
    target,
    startedAt: new Date(),
    success: false,
    http429Count: 0,
    http5xxCount: 0,
    rowsSynced: 0,
  })
  return runId
}

async function finishRun(db: Db, runId: string, success: boolean, rowsSynced: number, errorMessage?: string) {
  await db.insert(edinetSyncRuns).values({
    runId,
    target: runId.split(':')[0] ?? 'unknown',
    startedAt: new Date(nowIso()),
    endedAt: new Date(),
    success,
    rowsSynced,
    errorMessage: errorMessage ?? null,
  }).onConflictDoUpdate({
    target: edinetSyncRuns.runId,
    set: {
      endedAt: sql`excluded.ended_at`,
      success: sql`excluded.success`,
      rowsSynced: sql`excluded.rows_synced`,
      errorMessage: sql`excluded.error_message`,
    },
  })
}

export async function syncEdinetCompanyMap(db: Db, apiKey: string, code5: string): Promise<string | null> {
  const code4 = code5.slice(0, 4)
  const rows = await searchCompanyByCode(apiKey, code4)
  const match = rows.find(r => (r.code ?? '').slice(0, 4) === code4) ?? rows[0] ?? null
  if (!match) return null

  await db.insert(edinetCompanyMap).values({
    code: code5,
    edinetCode: match.edinetCode,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: edinetCompanyMap.code,
    set: {
      edinetCode: sql`excluded.edinet_code`,
      updatedAt: sql`excluded.updated_at`,
    },
  })
  return match.edinetCode
}

async function resolveEdinetCode(db: Db, apiKey: string, code5: string): Promise<string | null> {
  const mapped = await db.select().from(edinetCompanyMap).where(sql`${edinetCompanyMap.code} = ${code5}`).limit(1)
  const code = mapped[0]?.edinetCode
  if (code) return code
  return syncEdinetCompanyMap(db, apiKey, code5)
}

export async function syncEdinetTimeline(
  db: Db,
  apiKey: string,
  code5: string,
  from?: string,
  to?: string,
): Promise<number> {
  const runId = await startRun(db, 'edinet_timeline')
  try {
    const edinetCode = await resolveEdinetCode(db, apiKey, code5)
    if (!edinetCode) {
      await finishRun(db, runId, true, 0)
      return 0
    }
    const filings = await fetchCompanyFilings(apiKey, edinetCode, from, to)
    if (filings.length === 0) {
      await finishRun(db, runId, true, 0)
      return 0
    }
    const rows = filings.map(f => ({
      edinetCode,
      docId: f.docId,
      code: f.code ?? code5,
      filingDate: f.filingDate,
      eventType: f.eventType,
      title: f.title,
      isAmendment: f.isAmendment ?? false,
      submittedAt: f.submittedAt ? new Date(f.submittedAt) : null,
      sourceUpdatedAt: new Date(),
    }))
    await db.insert(edinetFilings).values(rows).onConflictDoUpdate({
      target: [edinetFilings.edinetCode, edinetFilings.docId],
      set: {
        code: sql`excluded.code`,
        filingDate: sql`excluded.filing_date`,
        eventType: sql`excluded.event_type`,
        title: sql`excluded.title`,
        isAmendment: sql`excluded.is_amendment`,
        submittedAt: sql`excluded.submitted_at`,
        sourceUpdatedAt: sql`excluded.source_updated_at`,
      },
    })
    await finishRun(db, runId, true, rows.length)
    return rows.length
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await finishRun(db, runId, false, 0, message)
    throw e
  }
}

export async function syncEdinetForecasts(db: Db, apiKey: string, code5: string): Promise<number> {
  const runId = await startRun(db, 'edinet_forecasts')
  try {
    const edinetCode = await resolveEdinetCode(db, apiKey, code5)
    if (!edinetCode) {
      await finishRun(db, runId, true, 0)
      return 0
    }
    const forecasts = await fetchCompanyForecasts(apiKey, edinetCode)
    if (forecasts.length === 0) {
      await finishRun(db, runId, true, 0)
      return 0
    }
    const rows = forecasts.map(f => ({
      code: f.code ?? code5,
      edinetCode,
      fiscalYear: f.fiscalYear,
      horizon: f.horizon,
      salesForecast: toNullableString(f.salesForecast),
      opForecast: toNullableString(f.opForecast),
      npForecast: toNullableString(f.npForecast),
      epsForecast: toNullableString(f.epsForecast),
      disclosedAt: f.disclosedAt ?? null,
      sourceDocId: f.sourceDocId ?? null,
      updatedAt: new Date(),
    }))
    await db.insert(edinetForecasts).values(rows).onConflictDoUpdate({
      target: [edinetForecasts.code, edinetForecasts.horizon, edinetForecasts.fiscalYear],
      set: {
        edinetCode: sql`excluded.edinet_code`,
        salesForecast: sql`excluded.sales_forecast`,
        opForecast: sql`excluded.op_forecast`,
        npForecast: sql`excluded.np_forecast`,
        epsForecast: sql`excluded.eps_forecast`,
        disclosedAt: sql`excluded.disclosed_at`,
        sourceDocId: sql`excluded.source_doc_id`,
        updatedAt: sql`excluded.updated_at`,
      },
    })
    await finishRun(db, runId, true, rows.length)
    return rows.length
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await finishRun(db, runId, false, 0, message)
    throw e
  }
}

export async function syncEdinetBridge(db: Db, apiKey: string, code5: string): Promise<number> {
  const runId = await startRun(db, 'edinet_bridge')
  try {
    const edinetCode = await resolveEdinetCode(db, apiKey, code5)
    if (!edinetCode) {
      await finishRun(db, runId, true, 0)
      return 0
    }
    const facts = await fetchCompanyBridgeFacts(apiKey, edinetCode)
    if (facts.length === 0) {
      await finishRun(db, runId, true, 0)
      return 0
    }
    const rows = facts.map(f => ({
      code: f.code ?? code5,
      edinetCode,
      fiscalYear: f.fiscalYear,
      periodType: f.periodType,
      operatingProfit: toNullableString(f.operatingProfit),
      pretaxProfit: toNullableString(f.pretaxProfit),
      netProfit: toNullableString(f.netProfit),
      cfo: toNullableString(f.cfo),
      depreciation: toNullableString(f.depreciation),
      adjustmentItemsJson: f.adjustmentItems ?? {},
      disclosedAt: f.disclosedAt ?? null,
      sourceDocId: f.sourceDocId ?? null,
      updatedAt: new Date(),
    }))
    await db.insert(edinetBridgeFacts).values(rows).onConflictDoUpdate({
      target: [edinetBridgeFacts.code, edinetBridgeFacts.fiscalYear, edinetBridgeFacts.periodType],
      set: {
        edinetCode: sql`excluded.edinet_code`,
        operatingProfit: sql`excluded.operating_profit`,
        pretaxProfit: sql`excluded.pretax_profit`,
        netProfit: sql`excluded.net_profit`,
        cfo: sql`excluded.cfo`,
        depreciation: sql`excluded.depreciation`,
        adjustmentItemsJson: sql`excluded.adjustment_items_json`,
        disclosedAt: sql`excluded.disclosed_at`,
        sourceDocId: sql`excluded.source_doc_id`,
        updatedAt: sql`excluded.updated_at`,
      },
    })
    await finishRun(db, runId, true, rows.length)
    return rows.length
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await finishRun(db, runId, false, 0, message)
    throw e
  }
}

export async function syncEdinetQualityScores(db: Db, apiKey: string, code5: string): Promise<number> {
  const runId = await startRun(db, 'edinet_quality_scores')
  try {
    const score = await fetchQualityScore(apiKey, code5)
    if (!score) {
      await finishRun(db, runId, true, 0)
      return 0
    }
    await db.insert(edinetQualityScores).values({
      code: code5,
      asOfDate: score.asOfDate,
      qualityScore: score.score,
      componentsJson: score.components,
      formulaText: score.formulaText,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [edinetQualityScores.code, edinetQualityScores.asOfDate],
      set: {
        qualityScore: sql`excluded.quality_score`,
        componentsJson: sql`excluded.components_json`,
        formulaText: sql`excluded.formula_text`,
        updatedAt: sql`excluded.updated_at`,
      },
    })
    await finishRun(db, runId, true, 1)
    return 1
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await finishRun(db, runId, false, 0, message)
    throw e
  }
}

export async function syncEdinetTextScores(db: Db, apiKey: string, code5: string): Promise<number> {
  const runId = await startRun(db, 'edinet_text_scores')
  try {
    const score = await fetchTextAnomalyScore(apiKey, code5)
    if (!score) {
      await finishRun(db, runId, true, 0)
      return 0
    }
    await db.insert(edinetTextScores).values({
      code: code5,
      asOfDate: score.asOfDate,
      anomalyScore: score.score,
      componentsJson: score.components,
      formulaText: score.formulaText,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [edinetTextScores.code, edinetTextScores.asOfDate],
      set: {
        anomalyScore: sql`excluded.anomaly_score`,
        componentsJson: sql`excluded.components_json`,
        formulaText: sql`excluded.formula_text`,
        updatedAt: sql`excluded.updated_at`,
      },
    })
    await finishRun(db, runId, true, 1)
    return 1
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await finishRun(db, runId, false, 0, message)
    throw e
  }
}
