import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { suggestTemplate } from '@/lib/converters/blog'

const TEMPLATE_SLUG_MAP = {
  howto: 'wp_standard_howto',
  philosophical: 'wp_standard_philosophical',
  staff_recommend: 'wp_standard_staff_recommend',
} as const

const TEMPLATE_NAME_MAP = {
  howto: 'How-to型',
  philosophical: '思想・解説型',
  staff_recommend: 'スタッフおすすめ型',
} as const

const REASON_MAP = {
  howto: '実用的な使い方紹介に向いているHow-to型がおすすめです',
  philosophical: 'テネモス理論を深く掘り下げる思想・解説型がおすすめです',
  staff_recommend: 'お客様・スタッフ視点で語るスタッフおすすめ型がおすすめです',
} as const

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storyId = searchParams.get('story_id')

    if (!storyId) {
      return NextResponse.json({ error: 'story_id が必要です' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data: story, error } = await supabase
      .from('stories')
      .select('id, theme, tone, title, body')
      .eq('id', storyId)
      .single()

    if (error || !story) {
      return NextResponse.json({ error: 'ストーリーが見つかりません' }, { status: 404 })
    }

    const type = suggestTemplate(story)

    return NextResponse.json({
      suggested_template_slug: TEMPLATE_SLUG_MAP[type],
      suggested_template_name: TEMPLATE_NAME_MAP[type],
      reason: REASON_MAP[type],
    })
  } catch (error) {
    console.error('テンプレート推奨エラー:', error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}
