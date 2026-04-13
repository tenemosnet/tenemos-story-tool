import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude'
import { createServiceClient } from '@/lib/supabase'
import { buildSystemPrompt, buildUserPrompt, TONES, ToneKey } from '@/lib/prompts/system'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { theme, length, product, tone, referenceBody } = body as {
      theme: string
      length: number
      product: string
      tone: ToneKey
      referenceBody?: string
    }

    // バリデーション
    if (!theme || !tone || !TONES[tone]) {
      return NextResponse.json(
        { error: 'テーマとトーンは必須です' },
        { status: 400 }
      )
    }

    const toneConfig = TONES[tone]
    const startTime = Date.now()

    // システムプロンプトを動的に組み立て
    const systemPrompt = await buildSystemPrompt()

    // ユーザープロンプトを組み立て
    const userPrompt = buildUserPrompt({
      theme,
      length: length || 400,
      product: product || '',
      tone: { label: toneConfig.label, instruction: toneConfig.instruction },
      referenceBody: referenceBody || undefined,
    })

    // Claude API呼び出し（fetch版）
    const message = await callClaude({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    })

    const duration = Date.now() - startTime

    // レスポンスからテキストを取得
    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => block.type === 'text' ? block.text : '')
      .join('')

    // JSONをパース
    let storyData
    try {
      // レスポンスからJSON部分を抽出（前後に余計なテキストがある場合に対応）
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('JSONが見つかりません')
      }
      storyData = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json(
        { error: '生成結果のパースに失敗しました', raw: responseText },
        { status: 500 }
      )
    }

    // Supabaseに保存
    const supabase = createServiceClient()

    const { data: story, error: storyError } = await supabase
      .from('stories')
      .insert({
        theme,
        tone: storyData.tone || toneConfig.label,
        title: storyData.title,
        body: storyData.body,
        hashtags: storyData.hashtags || [],
        length_setting: length || 400,
        product_id: product || null,
      })
      .select()
      .single()

    if (storyError) {
      console.error('ストーリー保存エラー:', storyError)
    }

    // 生成ログを保存
    if (story) {
      await supabase.from('generation_logs').insert({
        story_id: story.id,
        model: 'claude-sonnet-4-20250514',
        tokens_used: message.usage.input_tokens + message.usage.output_tokens,
        duration_ms: duration,
      })
    }

    return NextResponse.json({
      ...storyData,
      id: story?.id,
      duration_ms: duration,
      tokens_used: message.usage.input_tokens + message.usage.output_tokens,
    })
  } catch (error) {
    console.error('生成エラー:', error)
    return NextResponse.json(
      { error: 'ストーリーの生成に失敗しました' },
      { status: 500 }
    )
  }
}
