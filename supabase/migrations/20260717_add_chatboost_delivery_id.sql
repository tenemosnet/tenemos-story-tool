-- LINE配信CSV取込機能用：重複防止カラム + 配信統計テーブル

-- finished_contentsにチャットブーストCSVのID列を保持する重複防止用カラムを追加
ALTER TABLE finished_contents
  ADD COLUMN chatboost_delivery_id TEXT;

-- 重複チェック高速化のための部分インデックス
CREATE INDEX idx_finished_contents_chatboost_delivery_id
  ON finished_contents (chatboost_delivery_id)
  WHERE chatboost_delivery_id IS NOT NULL;

-- 配信統計ログ（将来の分析用）
CREATE TABLE chatboost_delivery_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chatboost_delivery_id TEXT NOT NULL UNIQUE,
  delivery_format TEXT,
  sent_count INTEGER,
  opened_count INTEGER,
  open_rate DECIMAL(5,1),
  click_count INTEGER,
  click_rate DECIMAL(5,1),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
