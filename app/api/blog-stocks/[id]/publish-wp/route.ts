import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// WordPress下書き投稿（新規 or 更新）
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { slug } = await request.json().catch(() => ({})) as { slug?: string }

    // WordPress接続設定をDBから取得
    const supabase = createServiceClient()
    const { data: settingsData, error: settingsError } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['wp_api_base_url', 'wp_api_username', 'wp_application_password'])

    if (settingsError) throw settingsError

    const settings: Record<string, string> = {}
    for (const row of settingsData ?? []) {
      settings[row.key] = row.value
    }

    const { wp_api_base_url, wp_api_username, wp_application_password } = settings

    if (!wp_api_base_url || !wp_api_username || !wp_application_password) {
      return NextResponse.json(
        { error: 'WordPress接続設定が登録されていません。設定画面から登録してください' },
        { status: 503 }
      )
    }

    // blog_stocks から記事取得
    const { data: stock, error: stockError } = await supabase
      .from('blog_stocks')
      .select('id, title, body, wp_post_id')
      .eq('id', params.id)
      .single()

    if (stockError || !stock) {
      return NextResponse.json({ error: '記事が見つかりません' }, { status: 404 })
    }

    // Basic認証ヘッダー構築
    // Application Password のスペースはそのままエンコードで OK（WP仕様）
    const credentials = btoa(`${wp_api_username}:${wp_application_password}`)

    const isUpdate = stock.wp_post_id !== null
    const wpBaseUrl = wp_api_base_url.replace(/\/+$/, '')
    const wpUrl = isUpdate
      ? `${wpBaseUrl}/posts/${stock.wp_post_id}`
      : `${wpBaseUrl}/posts`

    const wpBody: Record<string, unknown> = {
      title: stock.title,
      content: stock.body,
      status: 'draft',
      comment_status: 'closed',
    }
    if (slug?.trim()) {
      wpBody.slug = slug.trim()
    }

    const wpRes = await fetch(wpUrl, {
      method: isUpdate ? 'PATCH' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify(wpBody),
    })

    if (!wpRes.ok) {
      const errorBody = await wpRes.text()
      console.error('WP API error:', wpRes.status, errorBody)
      if (wpRes.status === 401) {
        return NextResponse.json(
          { error: '認証に失敗しました。Application Passwordを確認してください' },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { error: 'WordPress投稿に失敗しました' },
        { status: 502 }
      )
    }

    const wpData = await wpRes.json() as { id: number }
    const wpPostId = wpData.id

    // 管理画面の編集URLを構築
    // "https://example.com/apps/note/wp-json/wp/v2" → "https://example.com/apps/note"
    const wpBaseOrigin = wpBaseUrl.replace(/\/wp-json\/wp\/v2\/?$/, '')
    const wpPostUrl = `${wpBaseOrigin}/wp-admin/post.php?post=${wpPostId}&action=edit`

    // blog_stocks を更新
    const { error: updateError } = await supabase
      .from('blog_stocks')
      .update({
        wp_post_id: wpPostId,
        wp_post_url: wpPostUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    if (updateError) throw updateError

    return NextResponse.json({
      wp_post_id: wpPostId,
      wp_post_url: wpPostUrl,
    })
  } catch (error) {
    console.error('WP投稿エラー:', error)
    return NextResponse.json({ error: '投稿に失敗しました' }, { status: 500 })
  }
}
