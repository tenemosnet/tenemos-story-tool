import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// テンプレート一覧取得
export async function GET() {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('テンプレート取得エラー:', error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

// テンプレート保存
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, theme, tone, body: templateBody, hashtags, category } = body

    if (!name || !theme || !tone || !templateBody) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('templates')
      .insert({
        name,
        theme,
        tone,
        body: templateBody,
        hashtags: hashtags || [],
        category: category || null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('テンプレート保存エラー:', error)
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
  }
}

// テンプレート削除（論理削除）
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('templates')
      .update({ is_active: false })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('テンプレート削除エラー:', error)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
