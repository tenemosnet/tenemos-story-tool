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
      .from('line_distribution_history')
      .select('*')
      .eq('line_distribution_id', params.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ histories: data ?? [] })
  } catch (error) {
    console.error('LINE分割履歴取得エラー:', error)
    return NextResponse.json({ histories: [] })
  }
}
