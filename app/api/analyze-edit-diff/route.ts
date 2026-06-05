import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { callClaude } from '@/lib/claude'
import { MODELS } from '@/lib/config'

const SYSTEM_PROMPT = `
あなたはテネモスネットのメール通信原稿の品質改善アドバイザーです。
AI生成された原稿と、スタッフが手動で編集した原稿を比較し、「何をどう改善したか」を分析してください。

【分析の目的】
この分析結果は、次回以降のAI生成プロンプトに「過去のフィードバック」として注入されます。
AIが同じような改善を自動的に行えるよう、具体的かつ再現可能な指摘にしてください。

【分析のルール】
1. 改善ポイントを3〜5個、JSON配列で出力してください
2. 各ポイントは「何を」「どう変えたか」「なぜその方が良いか」を含めてください
3. 表現の微調整（句読点のみ等）は無視し、意味のある改善のみ抽出してください
4. テネモスの世界観（自然の仕組み、分かち合い、温かみ）の観点でも評価してください
5. 抽象的な指摘（「文章を改善した」等）は避け、具体的に書いてください

【出力形式】
以下のJSON配列のみ出力してください。他の文字は不要です：
["改善ポイント1", "改善ポイント2", "改善ポイント3"]
`.trim()

export async function POST(request: NextRequest) {
  try {
    const { originalBody, editedBody, subject, storyId } = await request.json()

    if (!originalBody || !editedBody || originalBody === editedBody) {
      return NextResponse.json({ success: false, error: '差分がありません' }, { status: 400 })
    }

    const userPrompt = `
以下のAI生成原稿と、スタッフ編集後の原稿を比較分析してください。

【AI生成原稿（編集前）】
${originalBody}

【スタッフ編集後の原稿】
${editedBody}

改善ポイントをJSON配列で出力してください。
    `.trim()

    const response = await callClaude({
      model: MODELS.generate,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = response.content.find(c => c.type === 'text')?.text || ''

    // JSON配列を抽出（コードブロック内も対応）
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('差分分析: JSONパース失敗:', text)
      return NextResponse.json({ success: false, error: 'パース失敗' }, { status: 500 })
    }

    const improvements: string[] = JSON.parse(jsonMatch[0])

    // knowledge_sources にフィードバックとして保存
    const content = `【分析タイプ】メール通信の編集差分から抽出\n【改善ポイント】\n${improvements.map((p, i) => `${i + 1}. ${p}`).join('\n')}`

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('knowledge_sources')
      .insert({
        source_type: 'feedback',
        category: 'feedback',
        title: `メール通信編集分析: ${(subject || '').slice(0, 30)}`,
        content,
        metadata: {
          type: 'edit_diff_analysis',
          story_id: storyId || null,
          improvement_count: improvements.length,
          created_at: new Date().toISOString(),
        },
      })

    if (error) {
      console.error('差分フィードバック保存エラー:', error)
      return NextResponse.json({ success: false, error: '保存失敗' }, { status: 500 })
    }

    return NextResponse.json({ success: true, improvements })
  } catch (error) {
    console.error('差分分析エラー:', error)
    return NextResponse.json({ success: false, error: '分析に失敗しました' }, { status: 500 })
  }
}
