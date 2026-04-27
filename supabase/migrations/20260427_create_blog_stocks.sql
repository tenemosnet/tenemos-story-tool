-- S1.5: ブログ記事ストックテーブル新設
-- blog_stocks: WordPress記事への変換結果を保管する

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
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blog_stocks_scheduled ON blog_stocks(scheduled_date) WHERE is_done = FALSE;
CREATE INDEX idx_blog_stocks_story ON blog_stocks(story_id);
CREATE INDEX idx_blog_stocks_template ON blog_stocks(template_id);
