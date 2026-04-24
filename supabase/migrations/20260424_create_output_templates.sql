-- output_templates テーブル新規作成
-- メール通信・WordPress記事変換用の汎用テンプレート管理基盤

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
