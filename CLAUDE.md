# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

テネモスネットのLINE配信向けストーリー生成ツール。Claude APIでコンテンツを自動生成し、HP・ブログから収集したナレッジで品質を向上させる。

## 開発コマンド

```bash
# Node.js 20が必要（nvmで管理）
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && nvm use v20.20.2

# 開発サーバー
npm run dev              # http://localhost:3000

# ビルド・リント
npm run build
npm run lint

# データ収集（ローカルCLI実行）
npm run ingest:hp        # shop.tenemos.jp 全商品スクレイピング
npm run ingest:blog      # Seesaaブログ記事収集 + トーン分析
npm run ingest:blog -- --limit 10  # 件数制限付き
```

## 技術スタック

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS 3 + shadcn/ui (Radix, v3互換)
- **Claude API** (claude-sonnet-4-20250514) via @anthropic-ai/sdk
- **Supabase** (PostgreSQL) — 東京リージョン
- **デプロイ先**: Vercel

## アーキテクチャ

### 生成フロー

```
ユーザー → /generate UI → POST /api/generate
  → buildSystemPrompt()  # Supabaseからproducts + knowledge_sourcesを取得しプロンプト組み立て
  → buildUserPrompt()    # テーマ・文字数・商品・トーンからユーザープロンプト生成
  → Claude API呼び出し
  → JSONパース → stories + generation_logs に保存 → レスポンス返却
```

### ナレッジ収集フロー

```
npm run ingest:hp   → EUC-JP→UTF-8変換 → Colormeオブジェクトから商品データ抽出
                    → Claude APIバッチ分析(5件ずつ) → productsテーブルにupsert

npm run ingest:blog → Seesaa記事取得 → knowledge_sourcesに保存
                    → Claude APIバッチ分析(10件ずつ) → brand情報・tone規定を自動生成
```

### 認証

Cookie方式の共有パスワード認証。`middleware.ts`が全ルートをガードし、`/login`と`/api/auth`のみスキップ。

### 主要ファイル

| ファイル | 役割 |
|---------|------|
| `lib/prompts/system.ts` | システムプロンプト動的組み立て、TONES定義、THEME_PRESETS |
| `lib/claude.ts` | Anthropic SDKクライアント |
| `lib/supabase.ts` | Supabaseクライアント（anon + service_role） |
| `app/api/generate/route.ts` | ストーリー生成APIエンドポイント |
| `middleware.ts` | Cookie認証ガード |
| `scripts/ingest/hp.ts` | HPスクレイピング（EUC-JP対応、Colormeオブジェクト解析） |
| `scripts/ingest/blog.ts` | ブログ収集 + Claude APIトーン分析 |

## データベース（Supabase）

6テーブル: `stories`, `templates`, `products`, `knowledge_sources`, `generation_logs`, `ingest_logs`

- `knowledge_sources`のcategoryフィールド（brand/tone/sample）がシステムプロンプトの各セクションに対応
- `products`テーブルはスクレイピングで自動更新、生成時に商品カタログとしてプロンプトに組み込まれる
- スキーマ定義: `supabase/schema.sql`

## 環境変数（.env.local）

```
ANTHROPIC_API_KEY        # Claude APIキー
NEXT_PUBLIC_SUPABASE_URL # Supabaseプロジェクトurl
NEXT_PUBLIC_SUPABASE_ANON_KEY  # 公開キー
SUPABASE_SERVICE_ROLE_KEY      # サーバー専用キー（クライアントに露出させない）
APP_PASSWORD             # 共有ログインパスワード
```

## 注意事項

- HPスクレイピング対象(shop.tenemos.jp)はEUC-JPエンコーディング。`iconv-lite`で変換必須
- shadcn/uiコンポーネントはTailwind CSS v3互換版を使用（v4形式ではない）
- Vercelデプロイ時、ファイルシステムへの書き込みは不可。ナレッジはSupabaseに一元化
- スクレイピングはVercelの10秒制限を超えるため、ローカルCLI実行のみ
- Claude API呼び出し時のレート制限: スクレイピング間1秒、APIバッチ間2秒
