# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

テネモスネットのLINE配信・メール通信向けコンテンツ生成ツール（v4.2）。Claude APIでストーリーを自動生成し、HP・ブログから収集したナレッジとユーザーフィードバックで品質を継続的に向上させる。生成したストーリーからメール通信原稿・WordPress記事原稿への変換、配信スケジュール管理、ネタストック機能も備える。

## 開発コマンド

```bash
# Node.js 20が必要（nvmで管理）
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && nvm use v20.20.2

# 開発サーバー
npm run dev              # http://localhost:3000

# ビルド・リント
npm run build
npm run lint

# データ収集（ローカルCLI実行のみ）
npm run ingest:hp        # shop.tenemos.jp 全商品スクレイピング
npm run ingest:blog      # Seesaaブログ記事収集 + トーン分析
npm run ingest:blog -- --limit 10  # 件数制限付き

# Cloudflareデプロイ（CLOUDFLARE_API_TOKENは~/.bashrcに設定済み）
npm run deploy:cf        # ビルド + デプロイ
npm run build:cf         # ビルドのみ
npm run preview:cf       # ローカルプレビュー
```

## 技術スタック

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS 3 + shadcn/ui (Radix, v3互換)
- **Claude API** — モデルは `lib/config.ts` の `MODELS` 定数で一元管理。デフォルトは `claude-sonnet-4-6`（生成・ingest用）、`claude-opus-4-7`（premium用途）。環境変数 `CLAUDE_MODEL_GENERATE` / `CLAUDE_MODEL_INGEST` / `CLAUDE_MODEL_PREMIUM` で上書き可能。Webアプリ内ではfetch()直接呼び出し（Workers互換）、ingestスクリプトでは@anthropic-ai/sdk使用
- **Supabase** (PostgreSQL) — 東京リージョン
- **デプロイ先**: Cloudflare Pages（`@opennextjs/cloudflare@1.15.1`経由）
  - 本番URL: `tenemos-story-tool.office1tenemos.workers.dev`
  - Git author email: office1tenemos@gmail.com
  - `CLOUDFLARE_API_TOKEN`は`~/.bashrc`に永続設定済み（トークン名: "tenemos-story-tool build token"）

## アーキテクチャ

### 生成フロー

```
ユーザー → /generate UI → POST /api/generate
  → buildSystemPrompt()  # Supabaseからproducts + knowledge_sources(brand/tone/sample/feedback)を取得しプロンプト組み立て
  → buildUserPrompt()    # テーマ・文字数・商品・トーンからユーザープロンプト生成
  → Claude API呼び出し（fetch直接）
  → JSONパース → stories + generation_logs に保存 → レスポンス返却
```

### フィードバック学習フロー

```
生成結果 → ユーザーが評価(good/ok/redo) + コメント + 本文編集
  → POST /api/feedback → knowledge_sources (category: 'feedback') に保存
  → 次回生成時、buildSystemPrompt()がfeedbackを「過去のフィードバック」セクションとしてプロンプトに注入
```

### ナレッジ収集フロー

```
npm run ingest:hp   → EUC-JP→UTF-8変換 → Colormeオブジェクトから商品データ抽出
                    → Claude APIバッチ分析(5件ずつ) → productsテーブルにupsert

npm run ingest:blog → Seesaa記事取得 → knowledge_sourcesに保存
                    → Claude APIバッチ分析(10件ずつ) → brand情報・tone規定を自動生成
```

### 週次自動生成 + 手動生成

```
Cloudflare Cron Trigger（毎週日曜22:00 UTC = 月曜7:00 JST）
  → cron-worker/worker.js（Service Binding経由）
  → GET /api/cron/weekly-generate（Bearer CRON_SECRET認証）
  → stock_ideas から未使用ネタ1件取得（古い順）
  → Claude API で約400字ストーリー生成
  → stories + generation_logs 保存、stock_ideas を used に更新
  → GAS Webhook でメール通知（完了 + 残数≤2件で警告）

手動トリガー（ダッシュボード「🤖 今すぐ生成」ボタン）
  → POST /api/cron/weekly-generate（Cookie auth-token認証）
  → 同じ executeGeneration() を実行
```

- `/api/cron/` パスは `middleware.ts` でCookie認証スキップ。Cronは Bearer認証、手動はPOSTハンドラ内でCookieチェック
- `cron-worker/` は別Cloudflare Worker（`tenemos-story-cron`）。`wrangler.jsonc` で設定

### ブログ記事生成の仕組み

1. ユーザーが `/stories` でブログ記事生成ボタンをクリック
2. テンプレート選択モーダルで3種から選択（`/api/blog-stocks/suggest-template` で自動推奨）
3. `/api/generate-blog` で変換実行
   - `lib/converters/blog.ts` の `generateBlogArticle()` を呼び出し
   - テンプレートの `system_prompt` + ナレッジソースで完全プロンプト構築
   - Claude API へリクエスト（`callClaude()` fetch直接、Workers互換）
4. 結果を `blog_stocks` にINSERT、生成履歴を `blog_generation_history` に保存
5. `/blog-stocks/[id]` へ遷移してプレビュー表示

### 再生成の仕組み

- プレビュー画面で再生成フォーム入力
- `parent_history_id` を指定して `/api/generate-blog` をPOST
- 既存ストックを上書き（PATCH）、新規履歴をINSERT
- 履歴は系譜（`parent_history_id`）で辿れる

### テンプレート管理

2種類のテンプレート機能がある：

- **テンプレート**（`/templates`）: 生成済みストーリーをテンプレートとして保存・再利用する機能。`templates`テーブル使用
- **出力テンプレート**（`/output-templates`）: メール通信・WordPress記事変換用の汎用テンプレート管理基盤。`output_templates`テーブル使用。`structure_spec`（JSONB）でセクション構成・記事タイプ・メール固有設定等を柔軟に定義

### テンプレート管理の運用フロー

1. `docs/templates/*.md` がマスタデータ
2. `npm run register-templates` で `output_templates` テーブルへ同期
3. 管理UI（`/output-templates`）は閲覧・微調整用途
4. **恒久的な変更は必ずMDファイル側で行う**
5. 管理UIで編集した内容は、次回スクリプト実行時に上書きされる

詳細は `docs/templates/README.md` 参照。

### 認証

Cookie方式の共有パスワード認証。`middleware.ts`が全ルートをガードし、`/login`、`/api/auth`、`/api/cron/`をスキップ。
`/api/cron/`は独自のBearer認証（`CRON_SECRET`）で保護。curlテスト時は `-b "auth-token=authenticated"` を付与。

### 主要ファイル

| ファイル | 役割 |
|---------|------|
| `lib/prompts/system.ts` | システムプロンプト動的組み立て（products + knowledge全category）、TONES定義、THEME_PRESETS |
| `lib/claude.ts` | Claude API呼び出し（fetch直接、Workers互換） |
| `lib/supabase.ts` | Supabaseクライアント（service_role、遅延初期化） |
| `app/page.tsx` | ダッシュボード（統計・お知らせ欄・ネタストック、`force-dynamic`サーバーコンポーネント） |
| `app/calendar/page.tsx` | 月間カレンダー（リマインダー・配信予定管理） |
| `app/generate/page.tsx` | 生成UI（テーマ選択・結果表示・フィードバック・テンプレート保存） |
| `app/api/generate/route.ts` | ストーリー生成APIエンドポイント |
| `app/api/notices/route.ts` | お知らせ欄API（直近7日の予定+期限超過を集約） |
| `app/api/task-memos/route.ts` | リマインダーCRUD API |
| `app/api/stock-ideas/route.ts` | ネタストックCRUD API（改行区切り一括登録対応） |
| `app/api/generate-mail/route.ts` | メール通信原稿生成API（LINE配信ストーリーをベースに生成） |
| `app/api/finished-contents/route.ts` | 配信予定コンテンツCRUD API（月別フィルター対応） |
| `app/stories/page.tsx` | 生成履歴（一覧・詳細・コピー・再生成・メール変換・一括削除） |
| `app/calendar/page.tsx` | 月間カレンダー（リマインダー・配信予定・ストック管理） |
| `app/output-templates/page.tsx` | 出力テンプレート一覧・管理UI |
| `app/api/output-templates/route.ts` | 出力テンプレートCRUD API |
| `lib/types/output-template.ts` | 出力テンプレート関連型定義 |
| `scripts/register-templates/index.ts` | テンプレートMD同期スクリプト |
| `scripts/register-templates/parse-template-md.ts` | MDパーサー |
| `docs/templates/` | テンプレートマスタデータディレクトリ |
| `app/api/cron/weekly-generate/route.ts` | 週次自動生成API（GET=Cron用Bearer認証、POST=手動用Cookie認証） |
| `cron-worker/worker.js` | Cron Worker（Scheduled + 手動/trigger エンドポイント） |
| `cron-worker/wrangler.jsonc` | Cron Worker設定（スケジュール、Service Binding） |
| `components/stock-ideas.tsx` | ネタストックUI（一覧・追加・削除・手動生成ボタン） |
| `components/notice-board.tsx` | お知らせ欄（リマインダー・配信予定・ネタ残数警告） |
| `middleware.ts` | Cookie認証ガード（`/api/cron/`はスキップ） |
| `app/api/blog-stocks/route.ts` | ブログ記事ストック一覧API（月別/未予定フィルター） |
| `app/api/blog-stocks/[id]/route.ts` | ブログ記事ストック単体取得・更新・削除API |
| `app/api/blog-stocks/[id]/history/route.ts` | ブログ記事生成履歴取得API |
| `app/api/blog-stocks/suggest-template/route.ts` | テンプレート自動推奨API（ストーリーのトーン判定） |
| `app/api/generate-blog/route.ts` | ブログ記事生成API（初回・再生成共通） |
| `app/blog-stocks/[id]/page.tsx` | ブログ記事プレビュー画面（HTML表示・再生成・履歴） |
| `lib/converters/blog.ts` | ブログ記事変換ロジック（generateBlogArticle, suggestTemplate） |
| `lib/types/blog-generation.ts` | ブログ生成関連型定義（BlogGenerationHistory等） |
| `components/blog-template-selection-modal.tsx` | テンプレート選択モーダル（3種選択・おすすめ表示） |
| `lib/types/blog-stock.ts` | ブログ記事ストック関連型定義 |
| `scripts/ingest/hp.ts` | HPスクレイピング（EUC-JP対応、Colormeオブジェクト解析） |
| `scripts/ingest/blog.ts` | ブログ収集 + Claude APIトーン分析 |

## データベース（Supabase）

11テーブル: `stories`, `templates`, `products`, `knowledge_sources`, `generation_logs`, `ingest_logs`, `stock_ideas`, `finished_contents`, `task_memos`, `output_templates`, `blog_stocks`

- `knowledge_sources`のcategoryフィールド（brand/tone/sample/feedback）がシステムプロンプトの各セクションに対応
- `knowledge_sources`のsource_type制約: `hp`, `blog`, `mail`, `feedback`
- `products`テーブルはスクレイピングで自動更新、生成時に商品カタログとしてプロンプトに組み込まれる
- `templates`テーブルは論理削除（`is_active`フラグ）
- `stock_ideas`はネタストック（unused/used状態管理、storiesと紐づけ可能）
- `finished_contents`は配信予定コンテンツ（LINE/メール種別、日付・完了管理）
- `blog_stocks`はブログ記事ストック（WordPress記事変換結果、日付・完了管理、stories/stock_ideas/output_templatesへの参照）
- `task_memos`はリマインダー（日付・完了フラグ）
- スキーマ定義: `supabase/schema.sql`

### 外部キー依存関係（storiesテーブル）

`stories`レコードを削除する際は、以下の参照テーブルを先に削除すること：
- `generation_logs.story_id` → `stories.id`
- `stock_ideas.story_id` → `stories.id`
- `finished_contents.story_id` → `stories.id`
- `blog_stocks.story_id` → `stories.id`

## 環境変数

### .env.local（Next.js用）
```
ANTHROPIC_API_KEY        # Claude APIキー
NEXT_PUBLIC_SUPABASE_URL # Supabaseプロジェクトurl
NEXT_PUBLIC_SUPABASE_ANON_KEY  # 公開キー
SUPABASE_SERVICE_ROLE_KEY      # サーバー専用キー（クライアントに露出させない）
APP_PASSWORD             # 共有ログインパスワード
CRON_SECRET              # 週次自動生成のBearer認証キー
GAS_WEBHOOK_URL          # Google Apps Script通知用URL（任意）
GAS_WEBHOOK_SECRET       # GAS通知用シークレット（任意）
```

### 料金計算関連（オプション、デフォルト値あり）
```
CLAUDE_PRICE_INPUT       # USD per 1M tokens（既定: 3.0）
CLAUDE_PRICE_OUTPUT      # USD per 1M tokens（既定: 15.0）
JPY_PER_USD              # 円/ドルレート（既定: 150）
```
公式の最新料金は https://docs.claude.com で確認すること。

### .dev.vars（Cloudflare Workers用、ランタイム環境変数）
同じ変数群。ビルド時は`.env.local`、ランタイム時は`.dev.vars`（ローカル）またはCloudflareダッシュボードのSettings > Variables and Secrets（本番）が参照される。

## 環境変数・認証情報の取り扱い

本プロジェクトでは以下を絶対に守ること：

- APIキー・パスワード・トークン等の機密情報は `.env.local` / `.dev.vars` / Cloudflareダッシュボード環境変数のみに保存する
- リポジトリ内のあらゆるファイル（コード・コメント・ドキュメント）に機密情報を記載しない
- サンプル値にはプレースホルダ（`xxx`等）を使い、実値は絶対に書かない
- `NEXT_PUBLIC_*` 以外の環境変数はサーバーサイドのみで参照する
- エラーメッセージ・ログ出力に機密情報を含めない
- `.gitignore` から `.env.local` / `.dev.vars` を外さない

これらは審査対象。PR時にチェックすること。

### Supabase運用上の注意

- 本プロジェクトはSupabase **無料プラン**で運用中
- 無料プランでは **7日間アクセスがない場合、プロジェクトが停止**するリスクあり
- **週次Cron（毎週日曜22時実行）が自動的にkeep-aliveとして機能**している
  - ネタストックが0件の場合でも、Supabaseクエリが発生するため有効
- Cronが停止する場合は、別途keep-alive手段を検討する必要がある
- 復旧方法：Supabaseダッシュボードから手動で「Restore project」を実行

## 注意事項

- **Cloudflare Workers互換**: `@anthropic-ai/sdk`はWorkers環境で動かないため、Webアプリ内ではfetch()直接呼び出しに変更済み。SDKはingestスクリプト（ローカル実行）専用
- **Supabase遅延初期化**: `lib/supabase.ts`でモジュールスコープのクライアント生成を廃止（ビルド時に環境変数が参照できずエラーになるため）
- HPスクレイピング対象(shop.tenemos.jp)はEUC-JPエンコーディング。`iconv-lite`で変換必須
- shadcn/uiコンポーネントはTailwind CSS v3互換版を使用（v4形式ではない）
- shadcn/uiの`Input`コンポーネントは未導入。フォーム入力にはネイティブ`<input>`+Tailwindクラスを使用
- スクレイピングはCloudflareのCPU時間制限を超えるため、ローカルCLI実行のみ
- Claude API呼び出し時のレート制限: スクレイピング間1秒、APIバッチ間2秒
- `useSearchParams()`を使う場合はSuspense境界が必要（Next.js 14のApp Router要件）
- `.next`キャッシュが壊れた場合は`rm -rf .next`で解消
