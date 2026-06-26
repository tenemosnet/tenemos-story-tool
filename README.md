# テネモス ストーリーツール v6.0.0

テネモスネットのLINE配信・メール通信向けコンテンツ生成ツール。Claude APIでストーリーを自動生成し、HP・ブログから収集したナレッジとユーザーフィードバックで品質を継続的に向上させる。

## 機能

- **ストーリー生成** — テーマ×トーン（やさしい/専門的/カジュアル）でLINE配信コンテンツを自動生成。季節連動対応
- **生成履歴** — テーマ・トーン別のリスト表示、全文閲覧、コピー、再生成
- **テンプレート管理** — 生成済みストーリーをテンプレートとして保存・再利用
- **ナレッジ管理** — HP・ブログ・フィードバックのナレッジと商品データの閲覧・編集・削除
- **フィードバック学習** — 生成結果への評価・修正がナレッジとして蓄積され、次回生成に反映
- **ブログ記事生成** — ストーリーをもとに出力テンプレートを選択してWordPress記事原稿を生成
- **LINE配信分割** — ストーリーを2〜4回分割・各回に配信日を設定・完了管理
- **メール通信原稿生成** — ストーリーからメール原稿を生成
- **カレンダー** — 月間ビューでリマインダー・配信予定・ネタストックを一元管理
- **週次Cron自動生成** — 毎週月曜7時（JST）にネタストックから自動生成→GASメール通知
- **ナレッジ収集（CLI）** — HPスクレイピング、ブログ・メール記事収集＋トーン分析

## 技術スタック

- Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- Claude API — モデルは `lib/config.ts` で一元管理（デフォルト: `claude-sonnet-4-6`）
- Supabase (PostgreSQL) — 東京リージョン
- Cloudflare Pages（`@opennextjs/cloudflare` 経由）

## セキュリティ上の注意

APIキーやパスワードなどの機密情報を**一切コミットしません**。
環境変数は `.env.local` / `.dev.vars` / Cloudflareダッシュボードにのみ設定してください。
詳細は [CLAUDE.md の「環境変数・認証情報の取り扱い」](./CLAUDE.md) を参照。

## セットアップ

```bash
# Node.js 20が必要
nvm use v20.20.2

# 依存パッケージ
npm install

# 環境変数（.env.local）
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_PASSWORD=
CRON_SECRET=
GAS_WEBHOOK_URL=        # 任意：週次生成完了メール通知
GAS_WEBHOOK_SECRET=     # 任意：GAS通知用シークレット

# 開発サーバー
npm run dev
```

## コマンド

```bash
npm run dev                 # 開発サーバー（http://localhost:3000）
npm run build               # ビルド
npm run lint                # リント

npm run ingest:hp           # HPスクレイピング（shop.tenemos.jp）
npm run ingest:blog         # ブログ収集 + トーン分析
npm run ingest:mail         # メール記事収集
npm run register-templates  # 出力テンプレートMD → Supabase同期

npm run deploy:cf           # 本番デプロイ（Cloudflare Pages）
npm run build:cf            # ビルドのみ
npm run preview:cf          # ローカルプレビュー
```
