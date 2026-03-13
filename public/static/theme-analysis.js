(function () {
  const payloadEl = document.getElementById('theme-analysis-data');
  const priceEl = document.getElementById('theme-candlestick-chart');
  const volumeEl = document.getElementById('theme-volume-chart');

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

  const candleSeries = [];
  const volumeSeries = [];

  series.forEach((stock, index) => {
    const map = new Map((stock.bars || []).map((bar) => [bar.date, bar]));
    const candleData = categories.map((date) => {
      const bar = map.get(date);
      if (!bar) return '-';
      return [bar.open, bar.close, bar.low, bar.high];
    });
    const volData = categories.map((date) => {
      const bar = map.get(date);
      return bar ? bar.volume : 0;
    });
    const color = colors[index % colors.length];

    candleSeries.push({
      name: stock.name,
      type: 'candlestick',
      data: candleData,
      itemStyle: {
        color,
        color0: '#f5f5f5',
        borderColor: color,
        borderColor0: color,
      },
    });

    volumeSeries.push({
      name: stock.name,
      type: 'bar',
      data: volData,
      itemStyle: { color },
    });
  });

  const priceChart = window.echarts.init(priceEl);
  const volumeChart = window.echarts.init(volumeEl);

  priceChart.setOption({
    color: colors,
    animation: false,
    legend: {
      top: 8,
      textStyle: { color: textColor },
    },
    grid: {
      left: 60,
      right: 20,
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
    yAxis: {
      scale: true,
      axisLine: { lineStyle: { color: axisColor } },
      splitLine: { lineStyle: { color: splitColor } },
      axisLabel: { color: textColor },
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: [0] },
      { show: true, xAxisIndex: [0], type: 'slider', bottom: 10, height: 16 },
    ],
    series: candleSeries,
  });

  volumeChart.setOption({
    color: colors,
    animation: false,
    legend: {
      top: 8,
      textStyle: { color: textColor },
    },
    grid: {
      left: 60,
      right: 20,
      top: 50,
      bottom: 30,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: { lineStyle: { color: axisColor } },
      axisLabel: { color: textColor },
    },
    yAxis: {
      axisLine: { lineStyle: { color: axisColor } },
      splitLine: { lineStyle: { color: splitColor } },
      axisLabel: { color: textColor },
    },
    series: volumeSeries,
  });

  function resize() {
    priceChart.resize();
    volumeChart.resize();
  }
  window.addEventListener('resize', resize);
})();
