import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// ナレッジ一覧取得（フィルター対応）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sourceType = searchParams.get('source_type')
    const category = searchParams.get('category')

    const supabase = createServiceClient()
    let query = supabase
      .from('knowledge_sources')
      .select('*')
      .order('collected_at', { ascending: false })

    if (sourceType) {
      query = query.eq('source_type', sourceType)
    }
    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('ナレッジ取得エラー:', error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

// ナレッジ更新
export async function PATCH(request: NextRequest) {
  try {
    const { id, content, title, category } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const updates: Record<string, string> = {}
    if (content !== undefined) updates.content = content
    if (title !== undefined) updates.title = title
    if (category !== undefined) updates.category = category

    const { data, error } = await supabase
      .from('knowledge_sources')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('ナレッジ更新エラー:', error)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}

// ナレッジ削除（物理削除）
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('knowledge_sources')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('ナレッジ削除エラー:', error)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
