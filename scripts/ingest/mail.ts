import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { config } from 'dotenv'
config({ path: '.env.local' })

// CSVパース（本文に改行・カンマ・ダブルクォートを含むため手動パース）
function parseCSV(content: string): { subject: string; body: string; date: string }[] {
  const results: { subject: string; body: string; date: string }[] = []
  const lines = content.split('\n')

  let i = 1 // ヘッダースキップ
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }

    // ダブルクォートで囲まれたフィールドを処理
    const fields: string[] = []
    let fieldStart = 0
    let inQuotes = false
    let current = ''

    // 行をまたぐフィールドに対応するため、行を結合して処理
    let fullLine = line
    let nextLine = i + 1

    // クォート内の改行を結合
    let quoteCount = (fullLine.match(/"/g) || []).length
    while (quoteCount % 2 !== 0 && nextLine < lines.length) {
      fullLine += '\n' + lines[nextLine]
      quoteCount = (fullLine.match(/"/g) || []).length
      nextLine++
    }

    // フィールド分割
    let pos = 0
    while (pos <= fullLine.length) {
      const char = fullLine[pos]

      if (char === '"') {
        if (inQuotes && fullLine[pos + 1] === '"') {
          current += '"'
          pos += 2
          continue
        }
        inQuotes = !inQuotes
        pos++
        continue
      }

      if (char === ',' && !inQuotes) {
        fields.push(current)
        current = ''
        pos++
        continue
      }

      if (pos === fullLine.length) {
        fields.push(current)
        break
      }

      current += char
      pos++
    }

    if (fields.length >= 3) {
      results.push({
        subject: fields[0].trim(),
        body: fields[1].trim(),
        date: fields[2].trim(),
      })
    }

    i = nextLine
  }

  return results
}

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error('使い方: npm run ingest:mail -- <CSVファイルパス>')
    process.exit(1)
  }

  const fullPath = path.resolve(csvPath)
  if (!fs.existsSync(fullPath)) {
    console.error(`ファイルが見つかりません: ${fullPath}`)
    process.exit(1)
  }

  console.log(`📧 メール通信CSVを読み込み中: ${fullPath}`)
  const content = fs.readFileSync(fullPath, 'utf-8')
  const emails = parseCSV(content)
  console.log(`  → ${emails.length}件のメールを検出`)

  if (emails.length === 0) {
    console.log('取り込むメールがありません')
    return
  }

  // Supabase接続
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 重複チェック用に既存データ取得
  const { data: existing } = await supabase
    .from('knowledge_sources')
    .select('title')
    .eq('source_type', 'mail')

  const existingTitles = new Set((existing || []).map(e => e.title))

  let inserted = 0
  let skipped = 0

  for (const email of emails) {
    // 重複スキップ
    if (existingTitles.has(email.subject)) {
      console.log(`  ⏭ スキップ（既存）: ${email.subject}`)
      skipped++
      continue
    }

    const { error } = await supabase
      .from('knowledge_sources')
      .insert({
        source_type: 'mail',
        category: 'sample',
        title: email.subject,
        content: email.body,
        url: null,
        metadata: { date: email.date },
      })

    if (error) {
      console.error(`  ✕ エラー: ${email.subject}`, error.message)
    } else {
      console.log(`  ✓ 登録: ${email.subject}`)
      existingTitles.add(email.subject)
      inserted++
    }
  }

  console.log(`\n📊 結果: ${inserted}件登録 / ${skipped}件スキップ（重複）`)
}

main().catch(console.error)
