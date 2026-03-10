// JQuants API v2 レスポンス型定義

// GET /v2/equities/master
export interface EquityMaster {
  Code:      string  // 5桁 (例: "72030")
  CoName:    string
  CoNameEn:  string
  Mkt:       string
  MktNm:     string
  S17:       string
  S17Nm:     string
  S33:       string
  S33Nm:     string
  ScaleCat:  string
  Mrgn:      string
  MrgnNm:    string
  Date:      string  // 基準日 (YYYY-MM-DD)
}

export interface EquitiesMasterResponse {
  data: EquityMaster[]
}

// GET /v2/equities/bars/daily
export interface DailyBar {
  Code:      string
  Date:      string  // YYYY-MM-DD
  O:         number | null  // 始値
  H:         number | null  // 高値
  L:         number | null  // 安値
  C:         number | null  // 終値
  Vo:        number | null  // 出来高
  Va:        number | null  // 売買代金
  AdjFactor: number | null  // 調整係数
  AdjO:      number | null  // 調整後始値
  AdjH:      number | null  // 調整後高値
  AdjL:      number | null  // 調整後安値
  AdjC:      number | null  // 調整後終値
  AdjVo:     number | null  // 調整後出来高
  UL:        string | null  // 値幅上限フラグ
  LL:        string | null  // 値幅下限フラグ
}

export interface DailyBarsResponse {
  data: DailyBar[]
}

// GET /v2/fins/summary
export interface FinancialSummary {
  DiscNo:      string  // 開示番号 (PK)
  DiscDate:    string  // 開示日 (YYYY-MM-DD)
  Code:        string  // 5桁
  DocType:     string  // 開示種別
  CurPerType:  string  // 1Q / 2Q / 3Q / 4Q / FY
  Sales:       string
  OP:          string  // 営業利益
  NP:          string  // 当期純利益
  EPS:         string
  BPS:         string  // 空の場合あり (IFRS中間)
  Eq:          string  // 自己資本
  EqAR:        string  // 自己資本比率 (小数, 例: "0.384")
  TA:          string  // 総資産
  CFO:         string  // 営業CF
  CashEq:      string
  ShOutFY:     string  // 発行済株式数
  TrShFY:      string  // 自己株式数
  AvgSh:       string  // 期中平均株式数
  DivAnn:      string  // 年間配当金 (確定)
  FDivAnn:     string  // 年間配当金 (予想)
  FSales:      string  // 予想売上高
  FOP:         string  // 予想営業利益
  FNP:         string  // 予想当期純利益
  FEPS:        string  // 予想EPS
}

export interface FinsSummaryResponse {
  data: FinancialSummary[]
}
