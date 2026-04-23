/**
 * HPスクレイピングツール（v2: 文字化け修正・カテゴリ対応）
 * shop.tenemos.jp から全商品情報を自動収集し、Supabaseに保存
 *
 * 使い方: npm run ingest:hp
 */

import * as cheerio from 'cheerio'
import * as iconv from 'iconv-lite'
import { createClient } from '@supabase/supabase-js'
import { MODELS } from '@/lib/config'
import Anthropic from '@anthropic-ai/sdk'
import * as dotenv from 'dotenv'
import * as path from 'path'

// .env.local を読み込み
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

const BASE_URL = 'https://shop.tenemos.jp'

// カテゴリIDと名前のマッピング
const CATEGORY_MAP: Record<number, string> = {
  1856686: 'ピッコロ水素水生成器',
  1666877: 'マナウォーター',
  1690750: 'バルブ・エナジャイザー',
  1666876: '多機能浄水機Ag・uA',
  2021015: 'Alivida',
  2231142: '保湿石鹸',
  2588246: 'クリーナー・デオドランス',
  2588224: '書籍・DVD他',
  2588236: '健康DVD等',
  1936161: 'レザー関連',
  1983536: 'ペット用品',
}

// Supabaseクライアント
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Anthropicクライアント
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// EUC-JPのHTMLをUTF-8で取得
async function fetchHTML(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  return iconv.decode(buffer, 'EUC-JP')
}

// トップページから全商品IDを取得
async function getAllProductIds(): Promise<string[]> {
  const url = `${BASE_URL}/`
  console.log('トップページから商品ID一覧を取得中...')
  const html = await fetchHTML(url)
  const $ = cheerio.load(html)

  const productIds: string[] = []
  $('a[href*="pid="]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const match = href.match(/pid=(\d+)/)
    if (match && !productIds.includes(match[1])) {
      productIds.push(match[1])
    }
  })

  return productIds
}

// 商品詳細ページから情報を取得（Colormeオブジェクトから構造化データを抽出）
async function getProductDetail(productId: string) {
  const url = `${BASE_URL}/?pid=${productId}`
  const html = await fetchHTML(url)
  const $ = cheerio.load(html)

  // Colorme JavaScriptオブジェクトからデータを抽出
  let colorme: {
    product?: {
      name?: string
      sales_price_including_tax?: number
      category?: { id_big?: number }
    }
  } = {}
  $('script').each((_, el) => {
    const text = $(el).html() || ''
    const match = text.match(/var\s+Colorme\s*=\s*(\{[\s\S]*?\});/)
    if (match) {
      try {
        colorme = JSON.parse(match[1])
      } catch {
        // パース失敗時は空のまま
      }
    }
  })

  // 商品名（Colormeオブジェクト優先、なければHTMLから）
  const name = colorme.product?.name ||
    $('h2').first().text().trim() ||
    $('title').text().replace(/\s*[-|｜].*/, '').trim()

  // 価格（税込）
  const price = colorme.product?.sales_price_including_tax || null

  // カテゴリ（Colormeオブジェクトのcategory.id_bigからマッピング）
  const categoryId = colorme.product?.category?.id_big
  const category = categoryId ? (CATEGORY_MAP[categoryId] || '未分類') : '未分類'

  // 商品説明文
  const descriptionEl = $('.product_detail_description, .product_description, [class*="detail_description"]')
  let description = descriptionEl.text().trim()
  if (!description) {
    // フォールバック: メインコンテンツエリアからテキスト取得
    description = $('.main, #main, [role="main"]').first().text().trim()
  }
  // クリーンアップ
  description = description.replace(/\s+/g, ' ').trim()

  return {
    id: `product-${productId}`,
    name: name || `商品 ${productId}`,
    price,
    category,
    description: description.slice(0, 2000),
    url,
    fullText: description.slice(0, 3000),
  }
}

// Claude APIでバッチ分析
async function analyzeProducts(products: Array<{
  id: string; name: string; price: number | null;
  category: string; description: string; url: string; fullText: string
}>) {
  if (products.length === 0) return []

  const productSummaries = products.map((p, i) =>
    `【商品${i + 1}】\n名前: ${p.name}\nカテゴリ: ${p.category}\n価格: ${p.price ? `¥${p.price.toLocaleString()}` : '不明'}\n説明: ${p.description.slice(0, 500)}`
  ).join('\n\n---\n\n')

  console.log(`  Claude APIで${products.length}件の商品を分析中...`)

  const message = await anthropic.messages.create({
    model: MODELS.ingest,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `以下のテネモスネットの商品情報を分析し、各商品について構造化データを返してください。

${productSummaries}

以下のJSON配列のみ出力してください：
[
  {
    "index": 0,
    "features": ["特徴1", "特徴2", "特徴3"],
    "keywords": ["キーワード1", "キーワード2"],
    "usage": "使い方の要約（1〜2文）"
  }
]

indexは商品の順番（0始まり）です。ページ内容から読み取れない場合は空配列や空文字で構いません。JSONのみ出力してください。`
    }],
  })

  const responseText = message.content
    .filter(block => block.type === 'text')
    .map(block => block.type === 'text' ? block.text : '')
    .join('')

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return products.map(() => ({ features: [], keywords: [], usage: '' }))
    const analyses = JSON.parse(jsonMatch[0])

    return products.map((_, i) => {
      const analysis = analyses.find((a: { index: number }) => a.index === i) || {}
      return {
        features: analysis.features || [],
        keywords: analysis.keywords || [],
        usage: analysis.usage || '',
      }
    })
  } catch {
    console.error('  ⚠ Claude API分析結果のパースに失敗。デフォルト値を使用します。')
    return products.map(() => ({ features: [], keywords: [], usage: '' }))
  }
}

// メイン処理
async function main() {
  console.log('========================================')
  console.log('テネモスHP スクレイピング開始 (v2)')
  console.log('========================================\n')

  // 収集ログを記録
  const { data: log } = await supabase
    .from('ingest_logs')
    .insert({ source_type: 'hp', status: 'running' })
    .select()
    .single()

  try {
    // 既存データをクリア
    console.log('既存の商品データをクリア中...')
    await supabase.from('products').delete().neq('id', '')

    // 全商品IDを取得
    const productIds = await getAllProductIds()
    console.log(`${productIds.length}件の商品IDを発見\n`)

    // 各商品の詳細を取得
    const allProducts: Array<{
      id: string; name: string; price: number | null;
      category: string; description: string; url: string; fullText: string
    }> = []

    for (let i = 0; i < productIds.length; i++) {
      const pid = productIds[i]
      try {
        console.log(`[${i + 1}/${productIds.length}] 商品ページ取得中: pid=${pid}`)
        const product = await getProductDetail(pid)
        console.log(`  → ${product.name} (${product.category}) ¥${product.price?.toLocaleString() || '?'}`)
        allProducts.push(product)
        await delay(1000) // サーバー負荷軽減
      } catch (err) {
        console.error(`  ⚠ 商品 ${pid} の取得に失敗:`, err)
      }
    }

    console.log(`\n合計 ${allProducts.length} 件の商品を取得しました`)

    // カテゴリ別集計
    const categoryCount: Record<string, number> = {}
    allProducts.forEach(p => {
      categoryCount[p.category] = (categoryCount[p.category] || 0) + 1
    })
    console.log('\nカテゴリ別内訳:')
    Object.entries(categoryCount).forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count}件`)
    })

    // バッチ分析（5件ずつ）
    console.log('\n🤖 Claude APIで商品分析中...')
    const BATCH_SIZE = 5
    const analyses: Array<{ features: string[]; keywords: string[]; usage: string }> = []

    for (let i = 0; i < allProducts.length; i += BATCH_SIZE) {
      const batch = allProducts.slice(i, i + BATCH_SIZE)
      console.log(`  バッチ ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allProducts.length / BATCH_SIZE)} (${batch.length}件)`)
      const batchAnalyses = await analyzeProducts(batch)
      analyses.push(...batchAnalyses)
      if (i + BATCH_SIZE < allProducts.length) {
        await delay(2000) // API呼び出し間に待機
      }
    }

    // Supabaseに保存
    console.log('\n💾 Supabaseに保存中...')

    for (let i = 0; i < allProducts.length; i++) {
      const product = allProducts[i]
      const analysis = analyses[i] || { features: [], keywords: [], usage: '' }

      const { error } = await supabase
        .from('products')
        .upsert({
          id: product.id,
          name: product.name,
          price: product.price,
          category: product.category,
          description: product.description,
          features: analysis.features,
          keywords: analysis.keywords,
          usage_text: analysis.usage,
          url: product.url,
          updated_at: new Date().toISOString(),
        })

      if (error) {
        console.error(`  ⚠ ${product.name} の保存に失敗:`, error.message)
      } else {
        console.log(`  ✓ ${product.name}`)
      }
    }

    // 収集ログを更新
    if (log) {
      await supabase
        .from('ingest_logs')
        .update({ status: 'success', items_count: allProducts.length })
        .eq('id', log.id)
    }

    console.log('\n========================================')
    console.log(`✅ 完了！ ${allProducts.length} 件の商品を保存しました`)
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
