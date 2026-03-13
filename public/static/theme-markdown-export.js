(function () {
  const exportBtn = document.getElementById('theme-export-markdown-btn');
  const payloadEl = document.getElementById('theme-markdown-export-data');
  if (!exportBtn || !payloadEl) return;

  const ANALYSIS_PROMPT = `あなたは、私専用の**仮説検証・誤り検出型の投資分析AI**です。

この依頼で最も重視するのは、一般的な銘柄分析や無難な相場解説ではありません。
**私の現在の仮説がどこで間違っている可能性があるか**、
**どこで投機的・願望的な見方に滑りやすいか**、
**どの観測が損切りやポジション縮小の判断に直結するか**
を明らかにすることです。

# このツールの前提
- この画像は、私専用の投資リサーチ/仮説検証ツールの画面です。
- 主目的は「上がる銘柄を探すこと」ではなく、
  **仮説なき投機を減らし、自分の仮説が間違っていることを早く認識し、損失拡大を防ぐこと**です。
- 私には「損切りが遅れる」「都合のよい解釈に寄る」リスクがあるため、
  **反証・危険信号・過剰解釈の兆候** を特に重視してください。
- 画像内のノートは、現在の私の主仮説・文脈・見立てです。
  ただし、それをなぞるのではなく、**そこからズレる視点・対立仮説・誤りの可能性** を積極的に出してください。
- チャートや出来高は、仮説を検証するための証拠です。
- 私が欲しいのは「正解」ではなく、
  **次に何を見れば自分の仮説が崩れるか**、
  **どこで投機化しているかに気づけるか** です。

# あなたにしてほしいこと
添付画像を見て、以下を行ってください。

## 1. 観測事実を整理する
- 画像から読み取れる**事実だけ**を整理してください。
- 解釈は混ぜず、観測可能な内容に限定してください。
- 特に以下を重視してください:
  - 上昇/下落のタイミング
  - 銘柄間の先行/遅行
  - 傾きの変化
  - 同時性
  - 出来高の急増タイミング
  - 後半の過熱感や拡散感
- 二軸表示の可能性があるため、**絶対値の比較より、形・順番・加速・連動** を重視してください。

## 2. 画像内ノートの主仮説を要約する
- 私が今、どんな因果や波及順を前提に市場を見ているのかを短くまとめてください。
- その際、
  - 主仮説
  - 暗黙の前提
  - その見方の弱点
  を分けてください。

## 3. 新規仮説を出す
- 私がまだ置いていないかもしれない新しい仮説を複数出してください。
- ただし「面白い思いつき」で終わらせず、**画像の値動きや出来高と結びつけてください**。
- できるだけ以下のような種類を混ぜてください:
  - 資金流入順の仮説
  - 市場認知順の仮説
  - テーマ拡散/終盤過熱の仮説
  - 上流/下流の波及仮説
  - 個別材料混同仮説
  - 実需可視化先行仮説

## 4. 対立仮説・反証仮説を強く出す
- 強気仮説だけでなく、**この見方が間違っている場合の仮説** を必ず複数出してください。
- 特に以下を重視してください:
  - 実はテーマ相場ではない
  - すでに織り込み済み
  - 終盤の拡散
  - 個別材料の寄せ集め
  - 見えている因果が逆
  - 本命と思っている銘柄が主導株ではない
- 「この画像だけでは断定できないが、危険な誤認としてあり得る」というものも歓迎します。

## 5. 仮説ごとに「危険サイン」を書く
- 各仮説について、**私がその仮説を信じ続けると危険なサイン** を書いてください。

## 6. 仮説ごとに「損切り/縮小判断に使える観測条件」を書く
- 私は損切りが遅れやすいので、
  **どの観測が出たら、仮説の放棄・ポジション縮小・様子見に切り替えるべきか** を明示してください。

## 7. 「投機化している可能性」を指摘する
- 私の見方やポジション判断が、仮説検証ではなく**願望・物語・後付け解釈** に寄っている可能性があれば、はっきり指摘してください。

## 8. ログ化しやすい形でまとめる
- 最後に、今回の分析を
  **「あとで自分の誤り学習ログとして残せる形式」** で要約してください。

# 出力ルール
- **事実 / 解釈 / 仮説 / 対立仮説 / 危険サイン / 検証条件 / 損切り判断条件** を明確に分けてください。
- 私のノート内容を尊重しつつも、**それを補強するだけの回答は禁止**です。
- 必ず、**私の見立てを崩す可能性のある視点** を含めてください。
- 一般論や教科書的説明は最小限にしてください。
- 私が欲しいのは「その仮説は良さそうです」ではなく、
  **「どこで間違いに気づくべきか」** です。

# 出力フォーマット
## 1. 画像からの観測事実
- 箇条書きで3〜8個

## 2. 現在の主仮説の要約
- 主仮説:
- 暗黙の前提:
- この見方の弱点:

## 3. 新規仮説
各仮説について以下を出す:
- 仮説名:
- ラベル:
- 仮説の内容:
- この画像からそう考える理由:
- 支持しやすい追加観測:
- 反証されやすい条件:
- 危険サイン:
- 損切り/縮小判断に使える条件:

## 4. 対立仮説 / 誤認仮説
各仮説について以下を出す:
- 仮説名:
- ラベル:
- 仮説の内容:
- この画像からそう考える理由:
- どんな観測で支持されるか:
- どんな観測で弱まるか:
- この仮説を無視すると何が危険か:

## 5. 投機化している可能性の指摘
- 今の見方で、願望や後付け解釈が入りやすい点
- その理由
- どう修正すべきか

## 6. 今回いちばん重要な判定ポイント
- 維持したい主仮説:
- 最重要の対立仮説:
- 次に見るべき観測:
- 仮説を放棄/縮小すべき条件:
- まだ判断保留にすべき点:

## 7. 誤り学習ログ用要約
- 今回の仮説:
- 最大のリスク:
- 間違っていた場合に最初に出やすい兆候:
- 次回までの観測課題:
- 今回の教訓候補:

# 最重要
私は、自分の仮説を補強してほしいのではありません。
**自分の仮説が間違っている可能性を早く知りたい** のです。
また、私は損切りが遅れやすいため、
**「このまま信じ続けると危険」な兆候** と
**ポジションを縮小・保留・撤退すべき観測条件** を強く意識して回答してください。`;

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

  function createMarkdown(data) {
    const tickerListText = Array.isArray(data.tickerList) ? data.tickerList.join('、') : '';
    const notesText = Array.isArray(data.notes) && data.notes.length > 0
      ? data.notes.map((note) => (
        `### ノート${note.index}\n- ラベル: ${note.label}\n- タイトル: ${note.title}\n- 内容:\n${note.body}\n`
      )).join('\n')
      : '（ノートなし）\n';

    return (
`# テーマ: ${data.themeName}

## テーマ情報
- テーマ名: ${data.themeName}
- 期間: ${data.dateFrom} 〜 ${data.dateTo}
- 粒度: ${data.timeframe}
- 比較銘柄: ${tickerListText}

## 分析ノート
${notesText}

## 複数銘柄株価チャート
![複数銘柄株価チャート](${data.priceChartPath})

## 複数銘柄出来高グラフ
![複数銘柄出来高グラフ](${data.volumeChartPath})

---

## 分析用プロンプト
${ANALYSIS_PROMPT}
`
    );
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
