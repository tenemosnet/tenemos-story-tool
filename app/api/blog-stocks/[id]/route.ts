import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// ブログ記事ストック単体取得
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('blog_stocks')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('ブログ記事ストック取得エラー:', error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

// ブログ記事ストック更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const supabase = createServiceClient()

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.title !== undefined) updates.title = body.title
    if (body.body !== undefined) updates.body = body.body
    if (body.scheduled_date !== undefined) updates.scheduled_date = body.scheduled_date
    if (body.is_done !== undefined) updates.is_done = body.is_done
    if (body.article_type !== undefined) updates.article_type = body.article_type
    if (body.output_format !== undefined) updates.output_format = body.output_format

    const { data, error } = await supabase
      .from('blog_stocks')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('ブログ記事ストック更新エラー:', error)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}

// ブログ記事ストック削除
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient()
    const { error } = await supabase
      .from('blog_stocks')
      .delete()
      .eq('id', params.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('ブログ記事ストック削除エラー:', error)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
