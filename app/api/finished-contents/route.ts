import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// 配信予定コンテンツ一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // YYYY-MM形式
    const includeDone = searchParams.get('include_done') === 'true'

    const supabase = createServiceClient()
    let query = supabase
      .from('finished_contents')
      .select('*')
      .order('scheduled_date', { ascending: true })

    if (!includeDone) {
      query = query.eq('is_done', false)
    }

    // 月指定がある場合は期間フィルター
    if (month) {
      const start = `${month}-01`
      const [y, m] = month.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      const end = `${month}-${String(lastDay).padStart(2, '0')}`
      query = query.gte('scheduled_date', start).lte('scheduled_date', end)
    }

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('配信予定取得エラー:', error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

// 配信予定コンテンツ追加
export async function POST(request: NextRequest) {
  try {
    const { title, body, type, scheduled_date, stock_idea_id, story_id } = await request.json()

    if (!title?.trim() || !type) {
      return NextResponse.json({ error: 'タイトルとタイプが必要です' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('finished_contents')
      .insert({
        title: title.trim(),
        body: body?.trim() || '',
        type,
        scheduled_date: scheduled_date || null,
        stock_idea_id: stock_idea_id || null,
        story_id: story_id || null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('配信予定追加エラー:', error)
    return NextResponse.json({ error: '追加に失敗しました' }, { status: 500 })
  }
}

// 配信予定コンテンツ更新
export async function PATCH(request: NextRequest) {
  try {
    const { id, title, body, type, scheduled_date, is_done } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (title !== undefined) updates.title = title
    if (body !== undefined) updates.body = body
    if (type !== undefined) updates.type = type
    if (scheduled_date !== undefined) updates.scheduled_date = scheduled_date
    if (is_done !== undefined) updates.is_done = is_done

    const { data, error } = await supabase
      .from('finished_contents')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('配信予定更新エラー:', error)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}

// 配信予定コンテンツ削除
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('finished_contents')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('配信予定削除エラー:', error)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
