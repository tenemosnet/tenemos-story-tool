import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { callClaude } from '@/lib/claude'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Cron秘密鍵の検証
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  return authHeader === `Bearer ${cronSecret}`
}

// 季節情報
function getSeasonInfo() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000) // JST
  const month = now.getMonth() + 1
  const day = now.getDate()
  const date = `${now.getFullYear()}年${month}月${day}日`

  if (month >= 3 && month <= 5) {
    return { date, season: '春', description: '花粉の季節、新生活、春の陽気、桜、新緑の芽吹き' }
  } else if (month >= 6 && month <= 8) {
    return { date, season: '夏', description: '梅雨、暑さ対策、紫外線、水分補給、夏バテ防止' }
  } else if (month >= 9 && month <= 11) {
    return { date, season: '秋', description: '実りの秋、乾燥の始まり、食欲の秋、冷え対策' }
  }
  return { date, season: '冬', description: '乾燥対策、冷え込み、年末年始、温活、免疫ケア' }
}

// Google Apps Scriptにメール送信
async function sendNotification(payload: Record<string, unknown>) {
  const webhookUrl = process.env.GAS_WEBHOOK_URL
  const webhookSecret = process.env.GAS_WEBHOOK_SECRET
  if (!webhookUrl) {
    console.log('GAS_WEBHOOK_URL未設定、メール送信スキップ')
    return
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, secret: webhookSecret }),
      redirect: 'follow',
    })
  } catch (err) {
    console.error('メール送信エラー:', err)
  }
}

export async function GET(request: NextRequest) {
  // 認証チェック
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 })
  }

  try {
    const supabase = createServiceClient()

    // ① 未使用ネタを1件取得（古い順）
    const { data: unusedIdeas, error: ideasError } = await supabase
      .from('stock_ideas')
      .select('*')
      .eq('status', 'unused')
      .order('created_at', { ascending: true })
      .limit(1)

    if (ideasError) throw ideasError

    // 未使用ネタの総数を取得
    const { count: stockRemaining } = await supabase
      .from('stock_ideas')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'unused')

    // ② ネタがない場合
    if (!unusedIdeas || unusedIdeas.length === 0) {
      console.log('未使用ネタなし、スキップ')
      await sendNotification({ type: 'no_stock', stockRemaining: 0 })
      return NextResponse.json({ status: 'skipped', reason: 'ネタストックなし' })
    }

    const idea = unusedIdeas[0]
    const season = getSeasonInfo()

    // ③ Claude APIで記事生成
    const systemPrompt = `あなたはテネモスネット（株式会社テネモスネット）のLINE公式アカウント用ストーリー配信コンテンツを作成するライターです。

【ブランドについて】
テネモスネットは「水・空気を活かす」をコンセプトに、自然の仕組みをお手本にした製品を開発・販売しています。
創業者・飯島秀行の「自然の仕組みに学ぶ」という哲学が根底にあります。
キーワード：自然の仕組み、振動圧、活水、発酵、空気活性、分かち合い

【ターゲット】
50代中心のミドル・シニア層、男女比4:6（女性やや多め）。
健康・エコ・自然の仕組み・ナチュラル志向に関心が高い。

【配信目的】
教育・ファン化が中心。販促よりも価値提供を優先。
「分かち合い」の姿勢で、あたたかく誠実に。押しつけない。

【重要なルール】
- テネモスの世界観を尊重すること
- 「買ってください」的な直接的な販促表現は避ける
- 専門用語を使う場合は必ずかみ砕いた説明を添える
- 読み手が「なるほど」「やってみたい」と思える内容にする

【出力形式】
以下のJSON形式のみ出力してください。他の文字は不要です：
{"tone":"トーン名","title":"タイトル20字以内","body":"本文","hashtags":["タグ1","タグ2","タグ3"]}`

    const userPrompt = `以下のネタを元に、LINE配信用のストーリーコンテンツを1つ作成してください。

【本日の日付】${season.date}（${season.season}）
【季節の参考キーワード】${season.description}
【ネタ・テーマ】${idea.content}
【文字数目安】約400字
【トーン】ネタの内容に最も合うトーンを自動で選んでください（やさしい / 専門的 / カジュアル のいずれか）

※季節感のあるテーマの場合は、必ず今の時期に合った内容にしてください。
JSONのみ出力してください。`

    const message = await callClaude({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => block.text || '')
      .join('')

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Claude応答からJSONを抽出できませんでした')
    }

    const storyData = JSON.parse(jsonMatch[0])

    // ④ storiesテーブルに保存
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .insert({
        theme: idea.content.substring(0, 50),
        tone: storyData.tone,
        title: storyData.title,
        body: storyData.body,
        hashtags: storyData.hashtags || [],
        length_setting: 400,
      })
      .select()
      .single()

    if (storyError) throw storyError

    // ⑤ generation_logを保存
    await supabase.from('generation_logs').insert({
      story_id: story.id,
      model: 'claude-sonnet-4-20250514',
      tokens_used: message.usage.input_tokens + message.usage.output_tokens,
    })

    // ⑥ stock_ideaをusedに更新
    await supabase
      .from('stock_ideas')
      .update({ status: 'used', story_id: story.id })
      .eq('id', idea.id)

    const remainingAfter = (stockRemaining ?? 1) - 1

    // ⑦ 完了メール送信
    await sendNotification({
      type: 'article_done',
      title: storyData.title,
      theme: idea.content,
      tone: storyData.tone,
      preview: storyData.body.substring(0, 200) + '...',
      stockRemaining: remainingAfter,
    })

    // ⑧ ネタ残り2件以下なら警告メール
    if (remainingAfter <= 2 && remainingAfter > 0) {
      await sendNotification({
        type: 'stock_low',
        stockRemaining: remainingAfter,
      })
    }

    return NextResponse.json({
      status: 'success',
      title: storyData.title,
      storyId: story.id,
      stockRemaining: remainingAfter,
    })

  } catch (error) {
    console.error('週次自動生成エラー:', error)
    return NextResponse.json(
      { error: '自動生成に失敗しました', detail: String(error) },
      { status: 500 }
    )
  }
}
