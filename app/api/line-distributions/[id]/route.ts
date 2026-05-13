import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('line_distributions')
      .select('*')
      .eq('id', params.id)
      .single()
    if (error || !data) {
      return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('LINE分割取得エラー:', error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json() as Record<string, unknown>
    const supabase = createServiceClient()

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.parts !== undefined) updates.parts = body.parts
    if (body.is_done !== undefined) updates.is_done = body.is_done
    if (body.scheduled_dates !== undefined) updates.scheduled_dates = body.scheduled_dates
    if (body.user_request !== undefined) updates.user_request = body.user_request

    const { data, error } = await supabase
      .from('line_distributions')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('LINE分割更新エラー:', error)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient()
    const { error } = await supabase
      .from('line_distributions')
      .delete()
      .eq('id', params.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('LINE分割削除エラー:', error)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
