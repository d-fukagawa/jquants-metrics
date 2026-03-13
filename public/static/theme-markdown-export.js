(function () {
  const exportBtn = document.getElementById('theme-export-markdown-btn');
  const payloadEl = document.getElementById('theme-markdown-export-data');
  if (!exportBtn || !payloadEl) return;

  function parsePayload() {
    try {
      return JSON.parse(decodeURIComponent(payloadEl.dataset.payload || '{}'));
    } catch (_error) {
      return null;
    }
  }

  function safeName(value) {
    return String(value || 'theme')
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, '-')
      .slice(0, 80);
  }

  function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const binary = atob(parts[1] || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  }

  function fillTemplate(template, values) {
    return String(template || '').replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_m, key) => {
      const value = values[key];
      return value == null ? '' : String(value);
    });
  }

  function createMarkdown(data) {
    const template = String(data.template || '');
    if (!template) return '';

    const notes = Array.isArray(data.notes) ? data.notes : [];
    const noteMatch = template.match(/\{\{#each notes\}\}([\s\S]*?)\{\{\/each\}\}/);
    let noteSection = '';
    if (noteMatch) {
      const noteTemplate = noteMatch[1];
      if (notes.length > 0) {
        noteSection = notes.map((note) => fillTemplate(noteTemplate, {
          index: note.index,
          label: note.label,
          title: note.title,
          body: note.body,
        })).join('');
      }
    }

    const tickerListText = Array.isArray(data.tickerList) ? data.tickerList.join('、') : '';
    const withoutLoop = template.replace(/\{\{#each notes\}\}[\s\S]*?\{\{\/each\}\}/, noteSection);
    return fillTemplate(withoutLoop, {
      theme_name: data.themeName,
      date_from: data.dateFrom,
      date_to: data.dateTo,
      timeframe: data.timeframe,
      ticker_list: tickerListText,
      price_chart_path: data.priceChartPath,
      volume_chart_path: data.volumeChartPath,
      analysis_prompt: data.analysisPrompt || '',
    });
  }

  async function exportZip() {
    const data = parsePayload();
    if (!data) {
      window.alert('出力データの読み込みに失敗しました');
      return;
    }
    const charts = window.__themeAnalysisCharts || {};
    if (!charts.priceChart || !charts.volumeChart) {
      window.alert('チャート描画が完了してから実行してください');
      return;
    }
    if (!window.JSZip) {
      window.alert('ZIPライブラリの読み込みに失敗しました');
      return;
    }

    exportBtn.disabled = true;
    const prevLabel = exportBtn.textContent;
    exportBtn.textContent = '生成中...';

    try {
      const priceUrl = charts.priceChart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
      const volumeUrl = charts.volumeChart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
      const markdown = createMarkdown(data);

      const zip = new window.JSZip();
      zip.file('analysis.md', markdown);
      zip.folder('images').file('price_chart.png', dataUrlToBlob(priceUrl));
      zip.folder('images').file('volume_chart.png', dataUrlToBlob(volumeUrl));

      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      const fileName = `${safeName(data.themeName)}_${data.dateFrom}_${data.dateTo}.zip`;
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (_error) {
      window.alert('Markdown出力に失敗しました');
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = prevLabel;
    }
  }

  exportBtn.addEventListener('click', exportZip);
})();
