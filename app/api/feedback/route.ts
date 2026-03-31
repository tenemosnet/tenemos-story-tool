import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { storyId, rating, comment, originalBody, editedBody } = await request.json()

    if (!storyId || !rating) {
      return NextResponse.json(
        { error: '評価は必須です' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // ストーリー情報を取得
    const { data: story } = await supabase
      .from('stories')
      .select('theme, tone, title')
      .eq('id', storyId)
      .single()

    if (!story) {
      return NextResponse.json(
        { error: 'ストーリーが見つかりません' },
        { status: 404 }
      )
    }

    // フィードバック内容を組み立て
    const hasEdit = editedBody && editedBody !== originalBody
    let feedbackContent = `【テーマ】${story.theme}\n【トーン】${story.tone}\n【タイトル】${story.title}\n【評価】${rating}\n`

    if (comment) {
      feedbackContent += `【コメント】${comment}\n`
    }

    if (hasEdit) {
      feedbackContent += `【修正前】${originalBody.slice(0, 300)}\n【修正後】${editedBody.slice(0, 300)}\n`
    }

    // knowledge_sourcesにfeedbackとして保存
    const { error } = await supabase
      .from('knowledge_sources')
      .insert({
        source_type: 'feedback',
        title: `フィードバック: ${story.title}`,
        content: feedbackContent,
        category: 'feedback',
        metadata: {
          story_id: storyId,
          rating,
          has_edit: hasEdit,
          created_at: new Date().toISOString(),
        },
      })

    if (error) {
      console.error('フィードバック保存エラー:', error)
      return NextResponse.json(
        { error: 'フィードバックの保存に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('フィードバックエラー:', error)
    return NextResponse.json(
      { error: 'フィードバックの保存に失敗しました' },
      { status: 500 }
    )
  }
}
