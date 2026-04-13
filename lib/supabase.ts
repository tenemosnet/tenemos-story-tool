import { createClient } from '@supabase/supabase-js'

// サーバーサイド用（service_role権限）
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
