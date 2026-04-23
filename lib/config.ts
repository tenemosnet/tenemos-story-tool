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
