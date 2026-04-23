# テネモス ストーリーツール v1.2

テネモスネットのLINE配信向けストーリー生成ツール。Claude APIでコンテンツを自動生成し、HP・ブログから収集したナレッジとユーザーフィードバックで品質を継続的に向上させる。

## 機能

- **ストーリー生成** — テーマ×トーン（やさしい/専門的/カジュアル）でLINE配信コンテンツを自動生成。季節連動対応
- **生成履歴** — テーマ・トーン別のリスト表示、全文閲覧、コピー、再生成
- **テンプレート管理** — 生成結果をテンプレートとして保存・再利用
- **ナレッジ管理** — HP・ブログ・フィードバックのナレッジと商品データの閲覧・編集・削除
- **フィードバック学習** — 生成結果への評価・修正がナレッジとして蓄積され、生成品質が向上
- **ナレッジ収集（CLI）** — HPスクレイピング、ブログ記事収集+トーン分析

## 技術スタック

- Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- Claude API — モデルは `lib/config.ts` で一元管理（デフォルト: `claude-sonnet-4-6` / premium: `claude-opus-4-7`）
- Supabase (PostgreSQL)
- Vercel

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

# 開発サーバー
npm run dev
```

## コマンド

```bash
npm run dev           # 開発サーバー（http://localhost:3000）
npm run build         # ビルド
npm run ingest:hp     # HPスクレイピング
npm run ingest:blog   # ブログ収集+トーン分析
npx vercel --prod     # 本番デプロイ
```
