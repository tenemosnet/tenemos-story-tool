-- generation_logs.model カラムのDEFAULT撤去 + NOT NULL制約追加
-- 実行前に SELECT COUNT(*) FROM generation_logs WHERE model IS NULL; で0件確認済み

-- DEFAULTを撤去
ALTER TABLE generation_logs
  ALTER COLUMN model DROP DEFAULT;

-- NOT NULL制約を追加
ALTER TABLE generation_logs
  ALTER COLUMN model SET NOT NULL;
