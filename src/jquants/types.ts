// JQuants API v2 レスポンス型定義

export type JQuantsNumeric = string | number | null
export type JQuantsBoolean = string | boolean | null

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
  ProdCat:   string
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
  pagination_key?: string
}

// GET /v2/equities/valuation
export interface EquityValuation {
  Date: string
  Code: string
  EPS: number | null
  FwdEPS: number | null
  BPS: number | null
  ROE: number | null
  FwdROE: number | null
  PER: number | null
  FwdPER: number | null
  PBR: number | null
  MktCap: number | null
}

export interface EquityValuationsResponse {
  data: EquityValuation[]
  pagination_key?: string
}

// GET /v2/fins/summary
export interface FinancialSummary {
  DiscNo:      string  // 開示番号 (PK)
  DiscDate:    string  // 開示日 (YYYY-MM-DD)
  DiscTime?:   string  // 開示時刻 (HH:mm:ss)
  Code:        string  // 5桁
  DocType:     string  // 開示種別
  CurPerType:  string  // 1Q / 2Q / 3Q / 4Q / FY
  CurPerSt?:   string  // 対象会計期間の開始日
  CurPerEn?:   string  // 対象会計期間の終了日
  CurFYSt?:    string  // 当会計年度の開始日
  CurFYEn?:    string  // 当会計年度の終了日
  Sales:       JQuantsNumeric
  OP:          JQuantsNumeric  // 営業利益
  NP:          JQuantsNumeric  // 当期純利益
  EPS:         JQuantsNumeric
  BPS:         JQuantsNumeric  // 空の場合あり (IFRS中間)
  Eq:          JQuantsNumeric  // 純資産
  ShEq?:       JQuantsNumeric  // 自己資本
  EqAR:        JQuantsNumeric  // 自己資本比率 (小数, 例: "0.384")
  TA:          JQuantsNumeric  // 総資産
  CFO:         JQuantsNumeric  // 営業CF
  CFI?:        JQuantsNumeric  // 投資CF
  CFF?:        JQuantsNumeric  // 財務CF
  CashEq:      JQuantsNumeric
  ShOutFY:     JQuantsNumeric  // 発行済株式数
  TrShFY:      JQuantsNumeric  // 自己株式数
  AvgSh:       JQuantsNumeric  // 期中平均株式数
  DivAnn:      JQuantsNumeric  // 年間配当金 (確定)
  FDivAnn:     JQuantsNumeric  // 年間配当金 (予想)
  FSales:      JQuantsNumeric  // 予想売上高
  FOP:         JQuantsNumeric  // 予想営業利益
  FNP:         JQuantsNumeric  // 予想当期純利益
  FEPS:        JQuantsNumeric  // 予想EPS
  NCSales?:    JQuantsNumeric
  NCOP?:       JQuantsNumeric
  NCNP?:       JQuantsNumeric
  NCEPS?:      JQuantsNumeric
  NCTA?:       JQuantsNumeric
  NCEq?:       JQuantsNumeric
  NCEqAR?:     JQuantsNumeric
  NCBPS?:      JQuantsNumeric
  NCShEq?:     JQuantsNumeric
  FNCSales?:   JQuantsNumeric
  FNCOP?:      JQuantsNumeric
  FNCNP?:      JQuantsNumeric
  FNCEPS?:     JQuantsNumeric
  MatChgSub?:  JQuantsBoolean  // 旧様式: 重要な子会社の異動
  SigChgInC?:  JQuantsBoolean  // 連結範囲の重要な変更
  RetroRst?:   JQuantsBoolean  // 遡及修正
  ChgByASRev?: JQuantsBoolean  // 会計基準改正に伴う変更
  ChgNoASRev?: JQuantsBoolean  // 会計基準改正以外の変更
  ChgAcEst?:   JQuantsBoolean  // 会計上の見積り変更
}

export interface FinsSummaryResponse {
  data: FinancialSummary[]
  pagination_key?: string
  cursor?: string
}

// GET /v2/fins/details
export interface FinsDetail {
  DiscDate: string
  DiscTime?: string
  Code: string
  DiscNo: string
  DocType: string
  FS: Record<string, string>  // 冗長ラベル（英語） → 財務諸表値
}

export interface FinsDetailsResponse {
  data: FinsDetail[]
  pagination_key?: string
  cursor?: string
}
