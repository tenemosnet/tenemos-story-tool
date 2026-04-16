import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// 生成済みストーリー一覧取得
export async function GET() {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('ストーリー取得エラー:', error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

// ストーリー削除（関連レコードも含めて削除）
export async function DELETE(req: NextRequest) {
  try {
    const { ids } = await req.json() as { ids: string[] }
    if (!ids || ids.length === 0) {
      return NextResponse.json({ error: '削除対象が指定されていません' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // 外部キー参照している関連テーブルを先に削除
    await supabase.from('generation_logs').delete().in('story_id', ids)
    await supabase.from('finished_contents').delete().in('story_id', ids)
    await supabase.from('stock_ideas').delete().in('story_id', ids)

    const { error } = await supabase
      .from('stories')
      .delete()
      .in('id', ids)

    if (error) throw error
    return NextResponse.json({ deleted: ids.length })
  } catch (error) {
    console.error('ストーリー削除エラー:', error)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
