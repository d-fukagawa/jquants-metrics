(function () {
  const payloadEl = document.getElementById('theme-analysis-data');
  const priceEl = document.getElementById('theme-candlestick-chart');
  const volumeEl = document.getElementById('theme-volume-chart');
  const dualAxisToggleEl = document.getElementById('theme-price-dual-axis');
  const axisModeEl = document.getElementById('theme-price-axis-mode');
  const volumeAxisModeEl = document.getElementById('theme-volume-axis-mode');

  if (!payloadEl || !priceEl || !volumeEl) return;

  function renderEmpty(message) {
    priceEl.innerHTML = `<p class="empty-state" style="padding:40px 0">${message}</p>`;
    volumeEl.innerHTML = '<p class="empty-state" style="padding:40px 0">出来高データがありません</p>';
  }

  if (!window.echarts) {
    renderEmpty('チャートライブラリの読み込みに失敗しました');
    return;
  }

  let payload;
  try {
    payload = JSON.parse(decodeURIComponent(payloadEl.dataset.payload || '{}'));
  } catch (_error) {
    renderEmpty('チャートデータの解析に失敗しました');
    return;
  }

  const series = Array.isArray(payload.series) ? payload.series : [];
  const dateSet = new Set();
  series.forEach((s) => {
    (s.bars || []).forEach((bar) => dateSet.add(bar.date));
  });

  const categories = Array.from(dateSet).sort();
  if (categories.length === 0 || series.length === 0) {
    renderEmpty('指定期間に価格データがありません');
    return;
  }

  const colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#9a60b4'];
  const textColor = '#a1a1aa';
  const axisColor = '#3f3f46';
  const splitColor = '#27272a';

  const stockModels = [];

  series.forEach((stock, index) => {
    const map = new Map((stock.bars || []).map((bar) => [bar.date, bar]));
    const candleData = categories.map((date) => {
      const bar = map.get(date);
      if (!bar) return '-';
      return [bar.open, bar.close, bar.low, bar.high];
    });
    const volData = categories.map((date) => {
      const bar = map.get(date);
      return bar ? bar.volume : null;
    });
    const closeData = categories
      .map((date) => {
        const bar = map.get(date);
        return bar ? bar.close : null;
      })
      .filter((value) => Number.isFinite(value) && value > 0);
    const validVolumeData = volData.filter((value) => Number.isFinite(value) && value > 0);
    const representativeClose = closeData.length > 0 ? closeData[closeData.length - 1] : Number.NaN;
    const representativeVolume = validVolumeData.length > 0 ? validVolumeData[validVolumeData.length - 1] : Number.NaN;
    const color = colors[index % colors.length];

    stockModels.push({
      code: stock.code,
      name: stock.name,
      color,
      candleData,
      volData,
      representativeClose,
      representativeVolume,
    });
  });

  const priceChart = window.echarts.init(priceEl);
  const volumeChart = window.echarts.init(volumeEl);

  function axisLabelFormatter(value) {
    return Number.isFinite(value) ? value.toLocaleString('ja-JP') : '';
  }

  function yAxisBase(position, showSplitLine) {
    return {
      type: 'value',
      position,
      scale: true,
      axisLine: { lineStyle: { color: axisColor } },
      splitLine: showSplitLine ? { lineStyle: { color: splitColor } } : { show: false },
      axisLabel: {
        color: textColor,
        formatter: axisLabelFormatter,
      },
    };
  }

  function calcAxisAssignment(preferDual, valueSelector) {
    const singleAxis = {
      useDual: false,
      axisByCode: new Map(stockModels.map((model) => [model.code, 0])),
    };
    if (!preferDual || stockModels.length < 2) return singleAxis;

    const valid = stockModels.filter((model) =>
      Number.isFinite(valueSelector(model)) && valueSelector(model) > 0
    );
    if (valid.length < 2) return singleAxis;

    const prices = valid.map((model) => valueSelector(model));
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    // 価格差が小さい場合は単軸のままにする
    if (!(max > min * 2.5)) return singleAxis;

    const boundary = Math.sqrt(min * max);
    const axisByCode = new Map();
    let leftCount = 0;
    let rightCount = 0;

    stockModels.forEach((model) => {
      const price = Number.isFinite(valueSelector(model)) && valueSelector(model) > 0
        ? valueSelector(model)
        : boundary;
      const axisIndex = price >= boundary ? 0 : 1;
      axisByCode.set(model.code, axisIndex);
      if (axisIndex === 0) leftCount += 1;
      if (axisIndex === 1) rightCount += 1;
    });

    if (leftCount === 0 || rightCount === 0) {
      leftCount = 0;
      rightCount = 0;
      const sorted = [...stockModels].sort((a, b) => {
        const av = Number.isFinite(valueSelector(a)) ? valueSelector(a) : Number.POSITIVE_INFINITY;
        const bv = Number.isFinite(valueSelector(b)) ? valueSelector(b) : Number.POSITIVE_INFINITY;
        return av - bv;
      });
      const split = Math.max(1, Math.floor(sorted.length / 2));
      sorted.forEach((model, idx) => {
        const axisIndex = idx < split ? 1 : 0;
        axisByCode.set(model.code, axisIndex);
        if (axisIndex === 0) leftCount += 1;
        if (axisIndex === 1) rightCount += 1;
      });
    }

    if (leftCount === 0 || rightCount === 0) return singleAxis;
    return { useDual: true, axisByCode };
  }

  function renderPriceChart(preferDual) {
    const assignment = calcAxisAssignment(preferDual, (model) => model.representativeClose);
    const candleSeries = stockModels.map((model) => ({
      name: model.name,
      type: 'candlestick',
      yAxisIndex: assignment.useDual ? (assignment.axisByCode.get(model.code) || 0) : 0,
      data: model.candleData,
      itemStyle: {
        color: model.color,
        color0: '#f5f5f5',
        borderColor: model.color,
        borderColor0: model.color,
      },
    }));

    priceChart.setOption({
      color: colors,
      animation: false,
      legend: {
        top: 8,
        textStyle: { color: textColor },
      },
      grid: {
        left: 60,
        right: assignment.useDual ? 64 : 20,
        top: 50,
        bottom: 40,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      xAxis: {
        type: 'category',
        data: categories,
        boundaryGap: true,
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: textColor },
      },
      yAxis: assignment.useDual
        ? [yAxisBase('left', true), yAxisBase('right', false)]
        : yAxisBase('left', true),
      dataZoom: [
        { type: 'inside', xAxisIndex: [0] },
        { show: true, xAxisIndex: [0], type: 'slider', bottom: 10, height: 16 },
      ],
      series: candleSeries,
    }, { notMerge: true });

    if (axisModeEl) {
      axisModeEl.textContent = assignment.useDual ? '二軸（自動）' : '単軸';
    }
  }

  function renderVolumeChart(preferDual) {
    const assignment = calcAxisAssignment(preferDual, (model) => model.representativeVolume);
    const volumeSeries = stockModels.map((model) => ({
      name: model.name,
      type: 'line',
      yAxisIndex: assignment.useDual ? (assignment.axisByCode.get(model.code) || 0) : 0,
      data: model.volData,
      symbol: 'none',
      showSymbol: false,
      connectNulls: false,
      lineStyle: {
        width: 2,
        color: model.color,
      },
      itemStyle: { color: model.color },
    }));

    volumeChart.setOption({
      color: colors,
      animation: false,
      legend: {
        top: 8,
        textStyle: { color: textColor },
      },
      grid: {
        left: 60,
        right: assignment.useDual ? 64 : 20,
        top: 50,
        bottom: 30,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: textColor },
      },
      yAxis: assignment.useDual
        ? [yAxisBase('left', true), yAxisBase('right', false)]
        : yAxisBase('left', true),
      series: volumeSeries,
    }, { notMerge: true });

    if (volumeAxisModeEl) {
      volumeAxisModeEl.textContent = assignment.useDual ? '二軸（自動）' : '単軸';
    }
  }

  renderPriceChart(dualAxisToggleEl ? dualAxisToggleEl.checked : true);
  renderVolumeChart(dualAxisToggleEl ? dualAxisToggleEl.checked : true);

  if (dualAxisToggleEl) {
    dualAxisToggleEl.addEventListener('change', () => {
      renderPriceChart(dualAxisToggleEl.checked);
      renderVolumeChart(dualAxisToggleEl.checked);
    });
  }

  window.__themeAnalysisCharts = {
    priceChart,
    volumeChart,
    payload,
  };

  function resize() {
    priceChart.resize();
    volumeChart.resize();
  }
  window.addEventListener('resize', resize);
})();
