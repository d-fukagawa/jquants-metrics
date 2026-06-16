(function () {
  const form = document.getElementById('buy-timing-form')
  if (!form) return

  const thresholdInput = document.getElementById('buy-threshold')
  const thresholdRange = document.getElementById('buy-threshold-range')
  const thresholdLabel = document.getElementById('buy-threshold-label')
  const submitButton = document.getElementById('buy-timing-submit')
  const errorBox = document.getElementById('buy-timing-error')

  function setText(id, value) {
    const el = document.getElementById(id)
    if (el) el.textContent = value
  }

  function formatNumber(value, digits) {
    return Number(value).toFixed(digits)
  }

  function formatPrice(value) {
    return Number(value).toLocaleString('ja-JP', { maximumFractionDigits: 2 })
  }

  function formatPct(value) {
    return `${(Number(value) * 100).toFixed(1)}%`
  }

  function formatSigned(value) {
    const n = Number(value)
    return `${n > 0 ? '+' : ''}${n.toFixed(1)}`
  }

  function updateThresholdLabel() {
    const value = Number(thresholdInput.value)
    if (Number.isFinite(value)) {
      thresholdLabel.textContent = `-${(value * 100).toFixed(1)}%`
    }
  }

  function syncThresholdFromInput() {
    thresholdRange.value = thresholdInput.value
    updateThresholdLabel()
  }

  function syncThresholdFromRange() {
    thresholdInput.value = thresholdRange.value
    updateThresholdLabel()
  }

  thresholdInput?.addEventListener('input', syncThresholdFromInput)
  thresholdRange?.addEventListener('input', syncThresholdFromRange)
  updateThresholdLabel()

  function renderError(message) {
    if (!errorBox) return
    errorBox.textContent = message
    errorBox.classList.remove('buy-timing-hidden')
  }

  function clearError() {
    if (!errorBox) return
    errorBox.textContent = ''
    errorBox.classList.add('buy-timing-hidden')
  }

  function renderHistory(triggers) {
    const tbody = document.getElementById('buy-timing-history')
    if (!tbody) return
    tbody.textContent = ''

    if (!triggers || triggers.length === 0) {
      const row = document.createElement('tr')
      const cell = document.createElement('td')
      cell.colSpan = 4
      cell.className = 'empty-state'
      cell.textContent = '発動履歴はありません'
      row.appendChild(cell)
      tbody.appendChild(row)
      return
    }

    triggers.slice().reverse().forEach((trigger) => {
      const row = document.createElement('tr')
      const date = document.createElement('td')
      const price = document.createElement('td')
      const ref = document.createElement('td')
      const drawdown = document.createElement('td')

      date.textContent = trigger.date
      price.className = 'r'
      price.textContent = formatPrice(trigger.price)
      ref.className = 'r'
      ref.textContent = formatPrice(trigger.ref)
      drawdown.className = 'r down'
      drawdown.textContent = formatPct(trigger.drawdown)

      row.append(date, price, ref, drawdown)
      tbody.appendChild(row)
    })
  }

  function renderResult(data) {
    const showPerYear = Number(data.barsCount) >= 20 && data.perYear !== null
    const perYear = showPerYear ? Number(data.perYear) : null
    const targetDiff = perYear === null ? null : perYear - 6
    const from = data.params?.from ?? ''
    const to = data.params?.to ?? ''

    setText('buy-count', Number(data.count).toLocaleString('ja-JP'))
    setText('buy-count-sub', `${from} 〜 ${to}`)
    setText('buy-per-year', perYear === null ? '—' : formatNumber(perYear, 1))
    setText('buy-per-year-sub', showPerYear ? '245営業日で年換算' : 'データ不足')
    setText('buy-years', showPerYear ? formatNumber(data.years, 1) : '—')
    setText('buy-years-sub', `${Number(data.barsCount).toLocaleString('ja-JP')}本`)
    setText('buy-target-diff', targetDiff === null ? '—' : formatSigned(targetDiff))

    const diffEl = document.getElementById('buy-target-diff')
    if (diffEl) {
      diffEl.classList.remove('up', 'down')
      if (targetDiff !== null && Math.abs(targetDiff) > 1) {
        diffEl.classList.add(targetDiff > 0 ? 'down' : 'up')
      }
    }

    if (Number(data.barsCount) === 0) {
      setText('buy-timing-note', '指定期間の日次終値がありません。code/from/to を確認してください。')
    } else if (Number(data.barsCount) < 20) {
      setText('buy-timing-note', `データ本数が少なすぎます（${Number(data.barsCount).toLocaleString('ja-JP')}本）。年換算は表示しません。`)
    } else {
      setText('buy-timing-note', `検証データ ${Number(data.barsCount).toLocaleString('ja-JP')}本。調整後終値を優先して計算します。`)
    }

    renderHistory(data.triggers)
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    clearError()

    const params = new URLSearchParams(new FormData(form))
    const apiUrl = `/api/buy-timing/backtest?${params.toString()}`
    const pageUrl = `/buy-timing?${params.toString()}`

    if (submitButton) {
      submitButton.disabled = true
      submitButton.textContent = '検証中...'
    }

    try {
      const res = await fetch(apiUrl, { headers: { accept: 'application/json' } })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'backtest failed')
      }
      window.history.replaceState(null, '', pageUrl)
      renderResult(data)
    } catch (error) {
      renderError(error instanceof Error ? error.message : String(error))
    } finally {
      if (submitButton) {
        submitButton.disabled = false
        submitButton.textContent = '検証する'
      }
    }
  })
})()
