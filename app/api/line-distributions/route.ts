import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('line_distributions')
      .select('id, total_parts, splitting_style, is_done, scheduled_dates, created_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ line_distributions: data ?? [] })
  } catch (error) {
    console.error('LINE配信一覧取得エラー:', error)
    return NextResponse.json({ line_distributions: [] })
  }
}
