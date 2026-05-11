import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// WordPress接続テスト
export async function POST() {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['wp_api_base_url', 'wp_api_username', 'wp_application_password'])

    if (error) throw error

    const settings: Record<string, string> = {}
    for (const row of data ?? []) {
      settings[row.key] = row.value
    }

    const { wp_api_base_url, wp_api_username, wp_application_password } = settings

    if (!wp_api_base_url || !wp_api_username || !wp_application_password) {
      return NextResponse.json(
        { success: false, error: '接続設定が登録されていません' },
        { status: 400 }
      )
    }

    const credentials = btoa(`${wp_api_username}:${wp_application_password}`)

    const wpRes = await fetch(`${wp_api_base_url}/posts?per_page=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
      },
    })

    if (!wpRes.ok) {
      const body = await wpRes.text()
      console.error('WP接続テスト失敗:', wpRes.status, body)
      const msg = wpRes.status === 401
        ? '認証に失敗しました。ユーザー名・Application Passwordを確認してください'
        : `接続に失敗しました（HTTP ${wpRes.status}）`
      return NextResponse.json({ success: false, error: msg })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('WP接続テストエラー:', error)
    return NextResponse.json(
      { success: false, error: '接続テストに失敗しました' },
      { status: 500 }
    )
  }
}
