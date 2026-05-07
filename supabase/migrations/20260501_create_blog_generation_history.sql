-- ブログ記事生成履歴（再生成も含むすべての生成記録）
CREATE TABLE blog_generation_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_stock_id       UUID REFERENCES blog_stocks(id) ON DELETE CASCADE,
  story_id            UUID REFERENCES stories(id) ON DELETE SET NULL,
  template_id         UUID REFERENCES output_templates(id) ON DELETE SET NULL,
  template_slug       TEXT NOT NULL,
  user_request        TEXT,
  full_prompt         TEXT NOT NULL,
  user_message        TEXT NOT NULL,
  generated_body      TEXT NOT NULL,
  generated_title     TEXT,
  input_tokens        INTEGER NOT NULL,
  output_tokens       INTEGER NOT NULL,
  cost_usd            DECIMAL(10,6) NOT NULL,
  cost_jpy            INTEGER NOT NULL,
  is_regeneration     BOOLEAN NOT NULL DEFAULT FALSE,
  parent_history_id   UUID REFERENCES blog_generation_history(id) ON DELETE SET NULL,
  model_used          TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blog_generation_history_stock
  ON blog_generation_history(blog_stock_id);

CREATE INDEX idx_blog_generation_history_story
  ON blog_generation_history(story_id);

CREATE INDEX idx_blog_generation_history_created
  ON blog_generation_history(created_at DESC);
