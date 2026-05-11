-- S2.5: blog_stocks に WordPress投稿連携カラムを追加
ALTER TABLE blog_stocks
  ADD COLUMN wp_post_id  INTEGER DEFAULT NULL,
  ADD COLUMN wp_post_url TEXT    DEFAULT NULL;
