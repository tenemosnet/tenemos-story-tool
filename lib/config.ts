// Claude APIモデル定数の一元管理
// 環境変数で上書き可能（デフォルトは最新推奨モデル）

export const MODELS = {
  /** ストーリー生成・メール通信生成・週次自動生成 */
  generate: process.env.CLAUDE_MODEL_GENERATE ?? 'claude-sonnet-4-6',
  /** HP・ブログのスクレイピング分析 */
  ingest: process.env.CLAUDE_MODEL_INGEST ?? 'claude-sonnet-4-6',
  /** プレミアム用途（将来の高品質生成向け） */
  premium: process.env.CLAUDE_MODEL_PREMIUM ?? 'claude-opus-4-7',
} as const

// Claude API 料金定数（USD per 1M tokens）
// 公式の最新料金は https://docs.claude.com で必ず確認すること
export const PRICING = {
  generate: {
    input_per_1m: parseFloat(process.env.CLAUDE_PRICE_INPUT ?? '3.0'),
    output_per_1m: parseFloat(process.env.CLAUDE_PRICE_OUTPUT ?? '15.0'),
  },
  jpy_per_usd: parseInt(process.env.JPY_PER_USD ?? '150'),
} as const

/**
 * トークン数からドル料金を計算
 */
export function calculateCostUsd(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * PRICING.generate.input_per_1m
  const outputCost = (outputTokens / 1_000_000) * PRICING.generate.output_per_1m
  return inputCost + outputCost
}

/**
 * ドル料金から円換算（小数点以下切り上げ）
 */
export function convertUsdToJpy(usd: number): number {
  return Math.ceil(usd * PRICING.jpy_per_usd)
}
