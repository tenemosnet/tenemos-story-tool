-- S2.7: LINE配信用文書分割テーブル

CREATE TABLE line_distributions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id         UUID REFERENCES stories(id) ON DELETE SET NULL,
  stock_idea_id    UUID REFERENCES stock_ideas(id) ON DELETE SET NULL,
  parts            JSONB NOT NULL,
  total_parts      INTEGER NOT NULL,
  splitting_style  TEXT NOT NULL,
  user_request     TEXT,
  is_done          BOOLEAN[] NOT NULL DEFAULT '{}',
  scheduled_dates  DATE[] DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE line_distribution_history (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_distribution_id UUID REFERENCES line_distributions(id) ON DELETE CASCADE,
  story_id             UUID REFERENCES stories(id) ON DELETE SET NULL,
  total_parts          INTEGER NOT NULL,
  splitting_style      TEXT NOT NULL,
  user_request         TEXT,
  full_prompt          TEXT NOT NULL,
  user_message         TEXT NOT NULL,
  generated_parts      JSONB NOT NULL,
  input_tokens         INTEGER NOT NULL,
  output_tokens        INTEGER NOT NULL,
  cost_usd             DECIMAL(10,6) NOT NULL,
  cost_jpy             INTEGER NOT NULL,
  is_regeneration      BOOLEAN NOT NULL DEFAULT FALSE,
  parent_history_id    UUID REFERENCES line_distribution_history(id) ON DELETE SET NULL,
  model_used           TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_line_distributions_story ON line_distributions(story_id);
CREATE INDEX idx_line_distributions_created ON line_distributions(created_at DESC);
CREATE INDEX idx_line_dist_history_dist ON line_distribution_history(line_distribution_id);
CREATE INDEX idx_line_dist_history_created ON line_distribution_history(created_at DESC);
