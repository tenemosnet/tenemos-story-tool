-- テネモス ストーリー生成ツール：データベーススキーマ
-- Supabase SQL Editor で実行してください

-- 生成済みストーリー
CREATE TABLE stories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  theme TEXT NOT NULL,
  tone TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  hashtags TEXT[] DEFAULT '{}',
  length_setting INT,
  product_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 保存済みテンプレート
CREATE TABLE templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  theme TEXT NOT NULL,
  tone TEXT NOT NULL,
  body TEXT NOT NULL,
  hashtags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 商品マスタ
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price INT,
  category TEXT,
  description TEXT,
  features TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  usage_text TEXT,
  url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 収集済みナレッジ
CREATE TABLE knowledge_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('hp', 'blog', 'mail', 'feedback')),
  url TEXT,
  title TEXT,
  content TEXT NOT NULL,
  category TEXT,
  metadata JSONB DEFAULT '{}',
  collected_at TIMESTAMPTZ DEFAULT NOW()
);

-- 生成ログ
CREATE TABLE generation_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID REFERENCES stories(id),
  prompt_used TEXT,
  model TEXT NOT NULL,
  tokens_used INT,
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 収集実行ログ
CREATE TABLE ingest_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'error')),
  items_count INT DEFAULT 0,
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ネタストック（配信アイデアメモ）
CREATE TABLE stock_ideas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'used')),
  story_id UUID REFERENCES stories(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 仕上がり置き場（加工済み完成コンテンツ）
CREATE TABLE finished_contents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('line', 'email')),
  stock_idea_id UUID REFERENCES stock_ideas(id),
  story_id UUID REFERENCES stories(id),
  scheduled_date DATE,
  is_done BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- タスクメモ（リマインダー）
CREATE TABLE task_memos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  display_date DATE NOT NULL,
  is_done BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 出力テンプレート（メール通信・WordPress記事変換用）
CREATE TABLE output_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('mail', 'wordpress')),
  description TEXT,
  system_prompt TEXT NOT NULL,
  structure_spec JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_format TEXT NOT NULL CHECK (output_format IN ('html', 'markdown', 'text')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_output_templates_format ON output_templates(format) WHERE is_active = true;
CREATE INDEX idx_output_templates_slug ON output_templates(slug);

-- ブログ記事ストック（WordPress記事への変換結果）
CREATE TABLE blog_stocks (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  story_id        UUID REFERENCES stories(id) ON DELETE SET NULL,
  stock_idea_id   UUID REFERENCES stock_ideas(id) ON DELETE SET NULL,
  template_id     UUID REFERENCES output_templates(id) ON DELETE SET NULL,
  article_type    TEXT,
  output_format   TEXT NOT NULL DEFAULT 'html',
  scheduled_date  DATE,
  is_done         BOOLEAN NOT NULL DEFAULT FALSE,
  wp_post_id      INTEGER DEFAULT NULL,
  wp_post_url     TEXT DEFAULT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blog_stocks_scheduled ON blog_stocks(scheduled_date) WHERE is_done = FALSE;
CREATE INDEX idx_blog_stocks_story ON blog_stocks(story_id);
CREATE INDEX idx_blog_stocks_template ON blog_stocks(template_id);

-- アプリ設定（WordPress接続設定など）
CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
