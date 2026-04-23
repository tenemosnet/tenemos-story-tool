/**
 * ブログ収集ツール
 * tenemosnet.seesaa.net からブログ記事を収集し、
 * Claude APIでトーン分析・語彙抽出をバッチ処理してSupabaseに保存
 *
 * 使い方:
 *   npm run ingest:blog              # 全件収集
 *   npm run ingest:blog -- --limit 10 # 10件のみ
 */

import * as cheerio from 'cheerio'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import * as dotenv from 'dotenv'
import { MODELS } from '@/lib/config'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

const BLOG_URL = 'http://tenemosnet.seesaa.net'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchHTML(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.text()  // Seesaaブログは UTF-8
}

// トップページ + アーカイブから記事URLを取得
async function getArticleUrls(limit?: number): Promise<string[]> {
  const urls: string[] = []

  // トップページから記事URLを収集
  console.log('トップページから記事URL一覧を取得中...')
  const html = await fetchHTML(`${BLOG_URL}/`)
  const articleIds: string[] = []

  const matches = html.matchAll(/article\/(\d+)\.html/g)
  for (const match of matches) {
    if (!articleIds.includes(match[1])) {
      articleIds.push(match[1])
    }
  }

  // アーカイブページも巡回（ページネーション）
  // Seesaaの構造化データ（JSON-LD）からも記事URLを取得
  const ldMatches = html.matchAll(/"url":"([^"]*article\/\d+\.html)"/g)
  for (const match of ldMatches) {
    const id = match[1].match(/article\/(\d+)\.html/)?.[1]
    if (id && !articleIds.includes(id)) {
      articleIds.push(id)
    }
  }

  // アーカイブページを巡回して追加取得
  const archivePages = html.matchAll(/href="([^"]*\/archives\/\d+[^"]*)"/g)
  const archiveUrls: string[] = []
  for (const match of archivePages) {
    let archiveUrl = match[1]
    if (!archiveUrl.startsWith('http')) {
      archiveUrl = `${BLOG_URL}${archiveUrl}`
    }
    if (!archiveUrls.includes(archiveUrl)) {
      archiveUrls.push(archiveUrl)
    }
  }

  // アーカイブページから追加の記事IDを取得
  for (const archiveUrl of archiveUrls.slice(0, 10)) { // 最大10アーカイブページ
    try {
      console.log(`  アーカイブページ: ${archiveUrl}`)
      const archiveHtml = await fetchHTML(archiveUrl)
      const archiveMatches = archiveHtml.matchAll(/article\/(\d+)\.html/g)
      for (const match of archiveMatches) {
        if (!articleIds.includes(match[1])) {
          articleIds.push(match[1])
        }
      }
      await delay(1000)
    } catch {
      // アーカイブページの取得失敗は無視
    }
  }

  for (const id of articleIds) {
    urls.push(`${BLOG_URL}/article/${id}.html`)
  }

  if (limit && urls.length > limit) {
    return urls.slice(0, limit)
  }

  return urls
}

// 記事ページから情報を取得
async function getArticleDetail(url: string) {
  const html = await fetchHTML(url)
  const $ = cheerio.load(html)

  // タイトル
  const title = $('h2.title span').text().trim() ||
    $('.Article__heading').text().trim() ||
    $('h1').first().text().trim() ||
    $('title').text().replace(/:\s*テネモスのお店ブログ.*/, '').trim()

  // 日付
  const dateText = $('p.date time').attr('datetime') ||
    $('p.date time span').text().trim() ||
    $('.Posted time').attr('datetime') || ''

  // 本文
  const bodyEl = $('.Article__content')
  if (bodyEl.length === 0) {
    // フォールバック
    const mainContent = $('article, .entry-content, .post-body').first()
    return {
      title,
      date: dateText,
      body: mainContent.text().replace(/\s+/g, ' ').trim().slice(0, 5000),
      url,
    }
  }

  // 本文からスクリプトや広告を除去
  bodyEl.find('script, style, .ad, ins').remove()
  const body = bodyEl.text().replace(/\s+/g, ' ').trim()

  // カテゴリ
  const category = $('.Posted__item.-category a').text().trim() || ''

  return {
    title: title || '無題',
    date: dateText,
    body: body.slice(0, 5000),
    category,
    url,
  }
}

// Claude APIでブログ記事群をバッチ分析（トーン・語彙抽出）
async function analyzeArticles(articles: Array<{
  title: string; body: string
}>) {
  if (articles.length === 0) return null

  const summaries = articles.map((a, i) =>
    `【記事${i + 1}】${a.title}\n${a.body.slice(0, 600)}`
  ).join('\n\n---\n\n')

  console.log(`  Claude APIで${articles.length}件の記事を分析中...`)

  const message = await anthropic.messages.create({
    model: MODELS.ingest,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `以下はテネモスネットのブログ記事です。これらの記事群を分析し、以下の情報をJSON形式で返してください。

${summaries}

以下のJSON形式のみ出力してください：
{
  "brand_keywords": ["ブランドに関連するキーワード（10個程度）"],
  "common_expressions": ["よく使われる表現・フレーズ（10個程度）"],
  "tone_patterns": ["文体パターンの特徴（5個程度）"],
  "ng_expressions": ["使われていない・避けられている表現（5個程度）"],
  "themes": ["記事のテーマ分類（カテゴリ名: 件数の形式で5個程度）"],
  "philosophy_quotes": ["テネモスの哲学を表す印象的なフレーズ（5個程度）"]
}

JSONのみ出力してください。`
    }],
  })

  const responseText = message.content
    .filter(block => block.type === 'text')
    .map(block => block.type === 'text' ? block.text : '')
    .join('')

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    return JSON.parse(jsonMatch[0])
  } catch {
    console.error('  ⚠ 分析結果のパースに失敗')
    return null
  }
}

async function main() {
  // 引数からlimitを取得
  const limitArg = process.argv.find(a => a.startsWith('--limit'))
  const limitValue = process.argv[process.argv.indexOf('--limit') + 1]
  const limit = limitArg ? parseInt(limitValue) || undefined : undefined

  console.log('========================================')
  console.log('テネモスブログ 収集開始')
  console.log(limit ? `  取得件数制限: ${limit}件` : '  全件取得')
  console.log('========================================\n')

  const { data: log } = await supabase
    .from('ingest_logs')
    .insert({ source_type: 'blog', status: 'running' })
    .select()
    .single()

  try {
    // 記事URL一覧を取得
    const articleUrls = await getArticleUrls(limit)
    console.log(`\n${articleUrls.length}件の記事URLを発見\n`)

    // 各記事の詳細を取得
    const articles: Array<{
      title: string; date: string; body: string;
      category?: string; url: string
    }> = []

    for (let i = 0; i < articleUrls.length; i++) {
      try {
        console.log(`[${i + 1}/${articleUrls.length}] ${articleUrls[i]}`)
        const article = await getArticleDetail(articleUrls[i])
        if (article.body.length > 50) { // 内容のある記事のみ
          console.log(`  → ${article.title} (${article.date})`)
          articles.push(article)
        } else {
          console.log(`  → スキップ（本文が短すぎます）`)
        }
        await delay(1000)
      } catch (err) {
        console.error(`  ⚠ 取得失敗:`, err)
      }
    }

    console.log(`\n${articles.length}件の有効な記事を取得しました`)

    // Supabaseに記事データを保存
    console.log('\n💾 記事データをSupabaseに保存中...')

    // 既存のブログデータをクリア
    await supabase.from('knowledge_sources').delete().eq('source_type', 'blog')

    for (const article of articles) {
      const { error } = await supabase
        .from('knowledge_sources')
        .insert({
          source_type: 'blog',
          url: article.url,
          title: article.title,
          content: article.body,
          category: article.category || null,
          metadata: { date: article.date },
        })

      if (error) {
        console.error(`  ⚠ ${article.title} の保存に失敗:`, error.message)
      } else {
        console.log(`  ✓ ${article.title}`)
      }
    }

    // Claude APIでトーン分析（バッチ処理: 10件ずつ）
    console.log('\n🤖 Claude APIでトーン・語彙分析中...')
    const BATCH_SIZE = 10
    const allAnalyses: Array<Record<string, string[]>> = []

    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE)
      console.log(`  バッチ ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(articles.length / BATCH_SIZE)} (${batch.length}件)`)
      const analysis = await analyzeArticles(batch)
      if (analysis) {
        allAnalyses.push(analysis)
      }
      if (i + BATCH_SIZE < articles.length) {
        await delay(2000)
      }
    }

    // 分析結果を統合してナレッジとして保存
    if (allAnalyses.length > 0) {
      console.log('\n📝 分析結果をナレッジとして保存中...')

      // 全バッチの分析結果を統合
      const merged = {
        brand_keywords: [...new Set(allAnalyses.flatMap(a => a.brand_keywords || []))],
        common_expressions: [...new Set(allAnalyses.flatMap(a => a.common_expressions || []))],
        tone_patterns: [...new Set(allAnalyses.flatMap(a => a.tone_patterns || []))],
        ng_expressions: [...new Set(allAnalyses.flatMap(a => a.ng_expressions || []))],
        themes: [...new Set(allAnalyses.flatMap(a => a.themes || []))],
        philosophy_quotes: [...new Set(allAnalyses.flatMap(a => a.philosophy_quotes || []))],
      }

      // ブランド情報として保存
      const brandContent = `# テネモスネット ブランド情報（ブログ分析より自動生成）

## ブランドキーワード
${merged.brand_keywords.map(k => `- ${k}`).join('\n')}

## テネモスの哲学
${merged.philosophy_quotes.map(q => `- 「${q}」`).join('\n')}

## 記事テーマ傾向
${merged.themes.map(t => `- ${t}`).join('\n')}
`

      await supabase.from('knowledge_sources').upsert({
        id: '00000000-0000-0000-0000-000000000001',
        source_type: 'blog',
        title: 'ブランド情報（自動生成）',
        content: brandContent,
        category: 'brand',
        metadata: { generated_at: new Date().toISOString(), source: 'blog_analysis' },
      })
      console.log('  ✓ ブランド情報を保存')

      // トーン規定として保存
      const toneContent = `# テネモスネット トーン規定（ブログ分析より自動生成）

## よく使われる表現
${merged.common_expressions.map(e => `- ${e}`).join('\n')}

## 文体パターン
${merged.tone_patterns.map(p => `- ${p}`).join('\n')}

## 使わない・避ける表現
${merged.ng_expressions.map(e => `- ${e}`).join('\n')}
`

      await supabase.from('knowledge_sources').upsert({
        id: '00000000-0000-0000-0000-000000000002',
        source_type: 'blog',
        title: 'トーン規定（自動生成）',
        content: toneContent,
        category: 'tone',
        metadata: { generated_at: new Date().toISOString(), source: 'blog_analysis' },
      })
      console.log('  ✓ トーン規定を保存')
    }

    // 収集ログを更新
    if (log) {
      await supabase
        .from('ingest_logs')
        .update({ status: 'success', items_count: articles.length })
        .eq('id', log.id)
    }

    console.log('\n========================================')
    console.log(`✅ 完了！ ${articles.length}件の記事を保存しました`)
    console.log('  → ブランド情報・トーン規定も自動生成済み')
    console.log('========================================')

  } catch (err) {
    console.error('\n❌ エラーが発生しました:', err)
    if (log) {
      await supabase
        .from('ingest_logs')
        .update({ status: 'error', error_message: String(err) })
        .eq('id', log.id)
    }
    process.exit(1)
  }
}

main()
