import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// ブログ記事ストック一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const includeDone = searchParams.get('include_done') === 'true'
    const unscheduled = searchParams.get('unscheduled') === 'true'

    const supabase = createServiceClient()

    // 未予定ストック取得
    if (unscheduled) {
      const { data, error } = await supabase
        .from('blog_stocks')
        .select('*')
        .is('scheduled_date', null)
        .eq('is_done', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      return NextResponse.json(data)
    }

    let query = supabase
      .from('blog_stocks')
      .select('*')
      .order('scheduled_date', { ascending: true })

    if (!includeDone) {
      query = query.eq('is_done', false)
    }

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
    console.error('ブログ記事ストック取得エラー:', error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}
