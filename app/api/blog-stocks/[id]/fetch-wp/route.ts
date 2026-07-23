import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { callClaude } from '@/lib/claude'
import { MODELS } from '@/lib/config'

const BLOG_SYSTEM_PROMPT = `
あなたはテネモスネットのブログ記事の品質改善アドバイザーです。
AI生成されたブログ記事と、スタッフが手動で編集した記事を比較し、「何をどう改善したか」を分析してください。

【分析の目的】
この分析結果は、次回以降のブログ記事AI生成プロンプトに「過去のフィードバック」として注入されます。
AIが同じような改善を自動的に行えるよう、具体的かつ再現可能な指摘にしてください。

【分析のルール】
1. 改善ポイントを3〜5個、JSON配列で出力してください
2. 各ポイントは「何を」「どう変えたか」「なぜその方が良いか」を含めてください
3. 表現の微調整（句読点のみ等）は無視し、意味のある改善のみ抽出してください
4. HTML構造の改善（見出しレベル、段落分け、リスト化、改行追加）も重要な改善として抽出してください
5. WordPress記事としての読みやすさ（囲みブロック、強調表示、余白の取り方）の観点でも評価してください
6. テネモスの世界観（自然の仕組み、分かち合い、温かみ）の観点でも評価してください
7. 抽象的な指摘（「文章を改善した」等）は避け、具体的に書いてください

【出力形式】
以下のJSON配列のみ出力してください。他の文字は不要です：
["改善ポイント1", "改善ポイント2", "改善ポイント3"]
`.trim()

/**
 * Gutenbergブロックコメントを除去する
 * <!-- wp:paragraph --> や <!-- /wp:heading {"level":2} --> 等を除去
 */
function stripGutenbergComments(html: string): string {
  return html
    .replace(/<!--\s*\/?wp:\S[^>]*-->\n?/g, '')
    .replace(/\n{3,}/g, '\n\n') // 余分な空行を整理
    .trim()
}

// WordPressから最新HTMLを取得し、差分学習を実行
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient()

    // WordPress接続設定をDBから取得
    const { data: settingsData, error: settingsError } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['wp_api_base_url', 'wp_api_username', 'wp_application_password'])

    if (settingsError) throw settingsError

    const settings: Record<string, string> = {}
    for (const row of settingsData ?? []) {
      settings[row.key] = row.value
    }

    const { wp_api_base_url, wp_api_username, wp_application_password } = settings

    if (!wp_api_base_url || !wp_api_username || !wp_application_password) {
      return NextResponse.json(
        { error: 'WordPress接続設定が登録されていません。設定画面から登録してください' },
        { status: 503 }
      )
    }

    // blog_stocks から記事取得
    const { data: stock, error: stockError } = await supabase
      .from('blog_stocks')
      .select('id, title, body, wp_post_id, story_id, article_type')
      .eq('id', params.id)
      .single()

    if (stockError || !stock) {
      return NextResponse.json({ error: '記事が見つかりません' }, { status: 404 })
    }

    if (!stock.wp_post_id) {
      return NextResponse.json({ error: 'WordPress未投稿です' }, { status: 400 })
    }

    // WP REST APIで下書き記事を取得
    const credentials = btoa(`${wp_api_username}:${wp_application_password}`)
    const wpBaseUrl = wp_api_base_url.replace(/\/+$/, '')
    const wpUrl = `${wpBaseUrl}/posts/${stock.wp_post_id}?context=edit`

    const wpRes = await fetch(wpUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
      },
    })

    if (!wpRes.ok) {
      const errorBody = await wpRes.text()
      console.error('WP API error:', wpRes.status, errorBody)
      if (wpRes.status === 401) {
        return NextResponse.json(
          { error: '認証に失敗しました。Application Passwordを確認してください' },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { error: 'WordPress APIからの取得に失敗しました' },
        { status: 502 }
      )
    }

    const wpData = await wpRes.json() as { content: { raw?: string; rendered?: string } }
    const rawContent = wpData.content?.raw ?? wpData.content?.rendered ?? ''

    // Gutenbergブロックコメントを除去
    const cleanedContent = stripGutenbergComments(rawContent)

    // 現在のblog_stocks.bodyと比較
    if (cleanedContent === stock.body) {
      return NextResponse.json({
        success: true,
        updated: false,
        message: 'WordPressの内容は最新版と同じです',
      })
    }

    // blog_stocks.body を更新
    const { error: updateError } = await supabase
      .from('blog_stocks')
      .update({
        body: cleanedContent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    if (updateError) throw updateError

    // AI生成版（最新の生成履歴）を取得して差分分析
    const { data: latestHistory } = await supabase
      .from('blog_generation_history')
      .select('generated_body')
      .eq('blog_stock_id', params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const originalBody = latestHistory?.generated_body
    if (!originalBody || originalBody === cleanedContent) {
      return NextResponse.json({
        success: true,
        updated: true,
        message: 'WordPressの内容を取り込みました（差分学習対象の変更なし）',
      })
    }

    // Claude APIで差分分析
    const userPrompt = `
以下のAI生成ブログ記事と、スタッフ編集後のブログ記事を比較分析してください。

【AI生成ブログ記事（編集前）】
${originalBody}

【スタッフ編集後のブログ記事】
${cleanedContent}

改善ポイントをJSON配列で出力してください。
    `.trim()

    const response = await callClaude({
      model: MODELS.generate,
      max_tokens: 1024,
      system: BLOG_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = response.content.find(c => c.type === 'text')?.text || ''

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('WP取込差分分析: JSONパース失敗:', text)
      return NextResponse.json({
        success: true,
        updated: true,
        message: 'WordPressの内容を取り込みましたが、差分分析に失敗しました',
      })
    }

    const improvements: string[] = JSON.parse(jsonMatch[0])

    // knowledge_sources にブログ用フィードバックとして保存
    const content = `【分析タイプ】ブログ記事の編集差分から抽出\n【改善ポイント】\n${improvements.map((p, i) => `${i + 1}. ${p}`).join('\n')}`

    const { error: fbError } = await supabase
      .from('knowledge_sources')
      .insert({
        source_type: 'feedback',
        category: 'blog_feedback',
        title: `ブログ記事編集分析: ${(stock.title || '').slice(0, 30)}`,
        content,
        metadata: {
          type: 'blog_edit_diff_analysis',
          story_id: stock.story_id || null,
          blog_stock_id: stock.id,
          article_type: stock.article_type || null,
          improvement_count: improvements.length,
          source: 'wordpress_fetch',
          created_at: new Date().toISOString(),
        },
      })

    if (fbError) {
      console.error('WP取込フィードバック保存エラー:', fbError)
    }

    return NextResponse.json({
      success: true,
      updated: true,
      improvements,
      message: '改善ポイントを学習しました',
    })
  } catch (error) {
    console.error('WP取込エラー:', error)
    return NextResponse.json({ error: 'WordPressからの取得に失敗しました' }, { status: 500 })
  }
}
