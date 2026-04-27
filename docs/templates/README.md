# テンプレート管理

本ディレクトリは、`output_templates` テーブルに登録されるテンプレートのマスタデータを管理する。

## 運用方針

- **MDファイル = マスタ、DB = 同期先**
- テンプレートの追加・編集は、まずMDファイルを編集してから、スクリプトで同期する
- MDファイルをGit管理することで変更履歴を追える
- 管理UI（/output-templates）で手動編集した内容は、次回スクリプト実行時に上書きされる
- 恒久的な変更は必ずMDファイル側で行うこと

## ファイル一覧

| ファイル | slug | フォーマット | 用途 |
|---|---|---|---|
| mail_standard.md | mail_standard | メール | メール通信スタンダード版 |
| wp_standard_howto.md | wp_standard_howto | WordPress | How-to型ブログ記事 |
| wp_standard_philosophical.md | wp_standard_philosophical | WordPress | 思想・解説型ブログ記事 |
| wp_standard_staff_recommend.md | wp_standard_staff_recommend | WordPress | スタッフおすすめ型ブログ記事 |

## 同期コマンド

全テンプレートを同期：
```bash
npm run register-templates
```

特定のテンプレートのみ同期：
```bash
npm run register-templates -- mail_standard wp_standard_howto
```

変更内容の確認のみ（DB書き込みなし）：
```bash
npm run register-templates -- --dry-run
```

## MDファイルの構造

各MDファイルは以下のセクションを必ず含むこと：

- `## 【1】基本情報` — slug, name, format, output_format, is_active, sort_order をテーブル形式で
- `## 【2】description` — コードブロック内にdescriptionテキスト
- `## 【3】system_prompt` — コードブロック内にシステムプロンプト全文
- `## 【4】structure_spec` — JSONコードブロック内に構造定義

既存のMDファイルを参考に、同じ構造で新規作成してください。

## 注意点

- `slug` は英数アンダースコアのみ。一意でなければならない
- `structure_spec` のJSONは厳密なパース対象。構文エラーはスクリプトで検出される
- `system_prompt` は Claude API のシステムプロンプトとして直接使われるため、表現に注意
- 既存テンプレートを物理削除する場合は、管理UIから行うこと（本スクリプトは削除機能を持たない）
