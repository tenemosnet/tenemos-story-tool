import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { callClaude } from '@/lib/claude'
import { MODELS } from '@/lib/config'

// メール通信原稿のシステムプロンプトを構築
async function buildMailSystemPrompt(): Promise<string> {
  let mailSamples = ''

  try {
    const supabase = createServiceClient()

    // 過去のメール通信ナレッジを取得（最新30件）
    const { data: mailKnowledge } = await supabase
      .from('knowledge_sources')
      .select('title, content, metadata')
      .eq('source_type', 'mail')
      .order('collected_at', { ascending: false })
      .limit(30)

    if (mailKnowledge && mailKnowledge.length > 0) {
      mailSamples = mailKnowledge.map(k =>
        `件名: ${k.title}\n${k.content?.slice(0, 500) || ''}${(k.content?.length || 0) > 500 ? '...' : ''}`
      ).join('\n---\n')
    }
  } catch (error) {
    console.error('メールナレッジ取得エラー:', error)
  }

  return `
あなたはテネモスネット（株式会社テネモスネット）のメール通信「テネモス通信」の原稿を作成するライターです。

【テネモス通信とは】
テネモスネットが定期的にお客様へ配信しているメールマガジンです。
LINE配信よりも長文で、以下のような構成が一般的です：
1. 挨拶・季節の話題
2. 本題（商品紹介、活用法、哲学的な話題など）
3. お知らせ（営業日、キャンペーン、新商品など）
4. 締めの言葉

【トーン・スタイル】
- 親しみやすく、手紙のような温かみのある文体
- 「分かち合い」の精神で、押しつけない
- テネモスの世界観（自然の仕組み、振動圧、活水、発酵）を大切にする
- 読者に「なるほど」「やってみたい」と思ってもらえる内容
- 適度に改行を入れ、読みやすくする

${mailSamples ? `【過去のテネモス通信の例】\n以下は実際に配信された過去のテネモス通信です。文体・構成・雰囲気を参考にしてください。\n${mailSamples}` : ''}

【出力形式】
以下のJSON形式のみ出力してください。他の文字は不要です：
{"subject":"件名","body":"本文（改行は\\nで表現）","summary":"内容の要約（50字以内）"}
  `.trim()
}

export async function POST(request: NextRequest) {
  try {
    const { theme, product, tone, storyTitle, storyBody, additionalNotes } = await request.json()

    if (!storyBody?.trim()) {
      return NextResponse.json({ error: '元のストーリー本文が必要です' }, { status: 400 })
    }

    const systemPrompt = await buildMailSystemPrompt()
    const startTime = Date.now()

    const userPrompt = `
以下のLINE配信用ストーリーをベースに、「テネモス通信」（メールマガジン）用の原稿たたき台を作成してください。

【元のLINE配信ストーリー】
タイトル: ${storyTitle || ''}
テーマ: ${theme || ''}
トーン: ${tone || ''}
本文:
${storyBody}

${product ? `【関連商品】${product}` : ''}
${additionalNotes ? `【追加の指示・要望】${additionalNotes}` : ''}

【作成のポイント】
- LINE配信の内容を膨らませて、メール通信らしい長文に仕上げてください
- 挨拶→本題→お知らせ→締めの構成を意識してください
- 件名は【テネモス通信】で始めてください
- 800〜1500字程度を目安にしてください
- 過去のテネモス通信の雰囲気を参考にしてください

JSONのみ出力してください。
    `.trim()

    const response = await callClaude({
      model: MODELS.generate,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const duration_ms = Date.now() - startTime
    const text = response.content.find(c => c.type === 'text')?.text || ''

    // JSONを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: '生成結果のパースに失敗しました' }, { status: 500 })
    }

    const result = JSON.parse(jsonMatch[0])

    return NextResponse.json({
      subject: result.subject || '',
      body: result.body || '',
      summary: result.summary || '',
      duration_ms,
      tokens_used: response.usage.input_tokens + response.usage.output_tokens,
    })
  } catch (error) {
    console.error('メール通信生成エラー:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成に失敗しました' },
      { status: 500 }
    )
  }
}
