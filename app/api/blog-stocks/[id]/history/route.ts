import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('blog_generation_history')
      .select('*')
      .eq('blog_stock_id', params.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ histories: data ?? [] })
  } catch (error) {
    console.error('生成履歴取得エラー:', error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}
