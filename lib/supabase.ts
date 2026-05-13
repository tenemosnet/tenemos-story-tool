import { createClient } from '@supabase/supabase-js'

// サーバーサイド用（service_role権限）
// Next.js 14はfetch()をパッチしてキャッシュするため、
// Supabaseクライアントのfetchにcache:'no-store'を指定してキャッシュを無効化する
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
      },
    }
  )
}
