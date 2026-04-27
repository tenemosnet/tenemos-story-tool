import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// お知らせ欄用：今日〜7日以内の予定・リマインダーを取得
export async function GET() {
  try {
    const supabase = createServiceClient()
    const today = new Date().toISOString().split('T')[0]
    const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // 並行取得：タスクメモ（未完了 + 今日〜7日後）、配信予定（未完了 + 今日〜7日後）
    const [memos, scheduled] = await Promise.all([
      supabase
        .from('task_memos')
        .select('*')
        .eq('is_done', false)
        .gte('display_date', today)
        .lte('display_date', weekLater)
        .order('display_date', { ascending: true }),
      supabase
        .from('finished_contents')
        .select('*')
        .eq('is_done', false)
        .not('scheduled_date', 'is', null)
        .gte('scheduled_date', today)
        .lte('scheduled_date', weekLater)
        .order('scheduled_date', { ascending: true }),
    ])

    if (memos.error) throw memos.error
    if (scheduled.error) throw scheduled.error

    // 過期分（今日より前で未完了）＋ネタ残数も取得して警告表示用に
    const [overdueMemos, overdueContents, unusedStock] = await Promise.all([
      supabase
        .from('task_memos')
        .select('*')
        .eq('is_done', false)
        .lt('display_date', today)
        .order('display_date', { ascending: true }),
      supabase
        .from('finished_contents')
        .select('*')
        .eq('is_done', false)
        .not('scheduled_date', 'is', null)
        .lt('scheduled_date', today)
        .order('scheduled_date', { ascending: true }),
      supabase
        .from('stock_ideas')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'unused'),
    ])

    return NextResponse.json({
      memos: memos.data ?? [],
      scheduled: scheduled.data ?? [],
      overdueMemos: overdueMemos.data ?? [],
      overdueContents: overdueContents.data ?? [],
      unusedStockCount: unusedStock.count ?? 0,
    })
  } catch (error) {
    console.error('お知らせ取得エラー:', error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}
