import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const MASKED = '●●●●●●●●'
const PASSWORD_KEY = 'wp_application_password'

// 設定取得（パスワードはマスク）
export async function GET() {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')

    if (error) throw error

    const settings: Record<string, string> = {}
    for (const row of data ?? []) {
      settings[row.key] = row.key === PASSWORD_KEY
        ? (row.value ? MASKED : '')
        : row.value
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('設定取得エラー:', error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

// 設定保存（パスワードが MASKED のままなら既存値を保持）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, string>
    const supabase = createServiceClient()

    // パスワードがマスク値なら既存値を保持するためスキップ
    const entries = Object.entries(body).filter(([key, value]) => {
      if (key === PASSWORD_KEY && value === MASKED) return false
      return true
    })

    if (entries.length === 0) {
      return NextResponse.json({ success: true })
    }

    const upsertData = entries.map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('app_settings')
      .upsert(upsertData, { onConflict: 'key' })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('設定保存エラー:', error)
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
  }
}
