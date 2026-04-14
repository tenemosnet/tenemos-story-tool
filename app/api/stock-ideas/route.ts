import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// ネタストック一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const supabase = createServiceClient()
    let query = supabase
      .from('stock_ideas')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('ネタストック取得エラー:', error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

// ネタストック一括登録（改行区切り）
export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'テキストが空です' }, { status: 400 })
    }

    // 改行区切りで分割し、空行を除外
    const ideas = text
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)

    if (ideas.length === 0) {
      return NextResponse.json({ error: '有効なネタがありません' }, { status: 400 })
    }

    const rows = ideas.map((content: string) => ({
      content,
      status: 'unused',
    }))

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('stock_ideas')
      .insert(rows)
      .select()

    if (error) throw error
    return NextResponse.json({ inserted: data.length, data })
  } catch (error) {
    console.error('ネタストック登録エラー:', error)
    return NextResponse.json({ error: '登録に失敗しました' }, { status: 500 })
  }
}

// ネタストック削除
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('stock_ideas')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('ネタストック削除エラー:', error)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}

// ネタストック更新（内容編集・ステータス変更）
export async function PATCH(request: NextRequest) {
  try {
    const { id, content, status, story_id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const updates: Record<string, unknown> = {}
    if (content !== undefined) updates.content = content
    if (status !== undefined) updates.status = status
    if (story_id !== undefined) updates.story_id = story_id

    const { data, error } = await supabase
      .from('stock_ideas')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('ネタストック更新エラー:', error)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}
