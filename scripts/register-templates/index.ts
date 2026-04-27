/**
 * テンプレートMD自動登録スクリプト
 *
 * docs/templates/*.md をパースして output_templates テーブルへ同期する。
 * MDファイル = マスタ、DB = 同期先。
 *
 * 使い方:
 *   npm run register-templates                    # 全ファイル同期
 *   npm run register-templates -- mail_standard   # 個別指定
 *   npm run register-templates -- --dry-run       # DB書き込みなし
 *   npm run register-templates -- --skip-existing # 既存はスキップ
 *   npm run register-templates -- --verbose       # 詳細ログ
 */

import * as fs from 'fs'
import * as path from 'path'
import { parseTemplateMd, type ParsedTemplate } from './parse-template-md'
import { createServiceClient } from './supabase-client'

const TEMPLATES_DIR = path.resolve(__dirname, '../../docs/templates')

// フラグ解析
const args = process.argv.slice(2)
const flags = {
  dryRun: args.includes('--dry-run'),
  skipExisting: args.includes('--skip-existing'),
  force: args.includes('--force'),
  verbose: args.includes('--verbose'),
}
const slugArgs = args.filter(a => !a.startsWith('--'))

// 結果カウンター
const results = {
  processed: 0,
  created: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
}

function log(msg: string) {
  console.log(msg)
}

function verbose(msg: string) {
  if (flags.verbose) console.log(`  [verbose] ${msg}`)
}

async function main() {
  const startTime = Date.now()

  if (flags.dryRun) log('🔍 ドライランモード（DBへの書き込みは行いません）\n')

  // MDファイル一覧を取得
  let mdFiles = fs.readdirSync(TEMPLATES_DIR)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .sort()

  // slug指定がある場合はフィルター
  if (slugArgs.length > 0) {
    mdFiles = mdFiles.filter(f => {
      const slug = f.replace('.md', '')
      return slugArgs.includes(slug)
    })

    if (mdFiles.length === 0) {
      log(`指定されたslugに一致するMDファイルが見つかりません: ${slugArgs.join(', ')}`)
      log(`利用可能なファイル:`)
      fs.readdirSync(TEMPLATES_DIR)
        .filter(f => f.endsWith('.md') && f !== 'README.md')
        .forEach(f => log(`  - ${f.replace('.md', '')}`))
      process.exit(1)
    }
  }

  verbose(`対象ファイル: ${mdFiles.join(', ')}`)

  // Supabaseクライアント（ドライラン以外で必要）
  const supabase = flags.dryRun ? null : createServiceClient()

  for (const file of mdFiles) {
    const filePath = path.join(TEMPLATES_DIR, file)
    results.processed++

    let parsed: ParsedTemplate
    try {
      parsed = parseTemplateMd(filePath)
      verbose(`パース成功: ${parsed.slug} (${parsed.name})`)
    } catch (e) {
      const msg = (e as Error).message
      if (flags.force) {
        log(`[WARNING] ${file} — ${msg}`)
        continue
      }
      log(`[ERROR]   ${file} — ${msg}`)
      results.errors++
      continue
    }

    // ドライランモード
    if (flags.dryRun) {
      log(`[DRY-RUN] ${parsed.slug} — ${parsed.name} (${parsed.format}/${parsed.output_format})`)
      verbose(`  description: ${parsed.description.substring(0, 80)}...`)
      verbose(`  system_prompt: ${parsed.system_prompt.substring(0, 80)}...`)
      verbose(`  structure_spec keys: ${Object.keys(parsed.structure_spec).join(', ')}`)
      continue
    }

    // DB操作
    try {
      // 既存チェック
      const { data: existing } = await supabase!
        .from('output_templates')
        .select('id')
        .eq('slug', parsed.slug)
        .limit(1)

      if (existing && existing.length > 0) {
        // 既存あり
        if (flags.skipExisting) {
          log(`[SKIPPED] ${parsed.slug} — (already exists, --skip-existing)`)
          results.skipped++
          continue
        }

        // UPDATE
        const { error } = await supabase!
          .from('output_templates')
          .update({
            name: parsed.name,
            format: parsed.format,
            description: parsed.description,
            system_prompt: parsed.system_prompt,
            structure_spec: parsed.structure_spec,
            output_format: parsed.output_format,
            is_active: parsed.is_active,
            sort_order: parsed.sort_order,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing[0].id)

        if (error) throw error
        log(`[UPDATED] ${parsed.slug} — ${parsed.name} (${parsed.format}/${parsed.output_format})`)
        results.updated++
      } else {
        // INSERT
        const { error } = await supabase!
          .from('output_templates')
          .insert({
            slug: parsed.slug,
            name: parsed.name,
            format: parsed.format,
            description: parsed.description,
            system_prompt: parsed.system_prompt,
            structure_spec: parsed.structure_spec,
            output_format: parsed.output_format,
            is_active: parsed.is_active,
            sort_order: parsed.sort_order,
          })

        if (error) throw error
        log(`[CREATED] ${parsed.slug} — ${parsed.name} (${parsed.format}/${parsed.output_format})`)
        results.created++
      }
    } catch (e) {
      log(`[ERROR]   ${parsed.slug} — DB操作失敗: ${(e as Error).message}`)
      results.errors++
    }
  }

  // サマリー
  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  log('')
  log('Summary:')
  log(`  ${results.processed} files processed`)
  log(`  ${results.created} created, ${results.updated} updated, ${results.skipped} skipped, ${results.errors} error${results.errors !== 1 ? 's' : ''}`)
  log(`  Duration: ${duration}s`)

  if (results.errors > 0) process.exit(1)
}

main().catch(e => {
  console.error('予期しないエラー:', e)
  process.exit(1)
})
