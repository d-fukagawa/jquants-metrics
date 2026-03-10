import { ilike, or } from 'drizzle-orm'
import type { Db } from '../db/client'
import { stockMaster } from '../db/schema'

// 銘柄コード or 会社名（日本語/英語）で前方・部分一致検索
export async function searchStocks(db: Db, q: string) {
  const pattern = `%${q}%`
  return db
    .select()
    .from(stockMaster)
    .where(
      or(
        ilike(stockMaster.code,     pattern),
        ilike(stockMaster.coName,   pattern),
        ilike(stockMaster.coNameEn, pattern),
      ),
    )
    .limit(20)
}

// 5桁コードで1件取得（例: "72030"）
export async function getStockByCode(db: Db, code5: string) {
  const rows = await db
    .select()
    .from(stockMaster)
    .where(ilike(stockMaster.code, code5))
    .limit(1)
  return rows[0] ?? null
}
