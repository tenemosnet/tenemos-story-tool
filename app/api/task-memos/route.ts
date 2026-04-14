import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// タスクメモ一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeDone = searchParams.get('include_done') === 'true'

    const supabase = createServiceClient()
    let query = supabase
      .from('task_memos')
      .select('*')
      .order('display_date', { ascending: true })

    if (!includeDone) {
      query = query.eq('is_done', false)
    }

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('タスクメモ取得エラー:', error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

// タスクメモ追加
export async function POST(request: NextRequest) {
  try {
    const { content, display_date } = await request.json()

    if (!content?.trim() || !display_date) {
      return NextResponse.json({ error: '内容と日付が必要です' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('task_memos')
      .insert({ content: content.trim(), display_date })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('タスクメモ追加エラー:', error)
    return NextResponse.json({ error: '追加に失敗しました' }, { status: 500 })
  }
}

// タスクメモ更新（完了トグル・内容編集）
export async function PATCH(request: NextRequest) {
  try {
    const { id, content, display_date, is_done } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const updates: Record<string, unknown> = {}
    if (content !== undefined) updates.content = content
    if (display_date !== undefined) updates.display_date = display_date
    if (is_done !== undefined) updates.is_done = is_done

    const { data, error } = await supabase
      .from('task_memos')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('タスクメモ更新エラー:', error)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}

// タスクメモ削除
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('task_memos')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('タスクメモ削除エラー:', error)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
