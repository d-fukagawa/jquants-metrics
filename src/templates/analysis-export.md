# テーマ: {{theme_name}}

## サマリー
- 期間: {{date_from}} 〜 {{date_to}}
- 粒度: {{timeframe}}
- 比較銘柄: {{ticker_list}}

## 分析ノート

{{#each notes}}
### ラベル: {{label}}
- タイトル: {{title}}
- 内容:
{{body}}

{{/each}}

## 複数銘柄株価チャート
![複数銘柄株価チャート]({{price_chart_path}})

## 複数銘柄出来高グラフ
![複数銘柄出来高グラフ]({{volume_chart_path}})

---

## 分析用プロンプト
{{analysis_prompt}}
