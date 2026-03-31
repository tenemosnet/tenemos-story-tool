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
  source_type TEXT NOT NULL CHECK (source_type IN ('hp', 'blog', 'mail')),
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
  model TEXT DEFAULT 'claude-sonnet-4-20250514',
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
