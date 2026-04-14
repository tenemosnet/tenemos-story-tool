import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'
import StockIdeas from '@/components/stock-ideas'
import NoticeBoard from '@/components/notice-board'

export const dynamic = 'force-dynamic'

async function getStats() {
  const supabase = createServiceClient()

  const [stories, templates, knowledge] = await Promise.all([
    supabase.from('stories').select('id', { count: 'exact', head: true }),
    supabase.from('templates').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('knowledge_sources').select('id', { count: 'exact', head: true }),
  ])

  return {
    stories: stories.count ?? 0,
    templates: templates.count ?? 0,
    knowledge: knowledge.count ?? 0,
  }
}

export default async function Home() {
  const stats = await getStats()

  return (
    <div className="min-h-screen bg-stone-50">
      {/* ヘッダー */}
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div>
            <h1 className="text-xl font-bold text-stone-800">🌿 テネモス ストーリーツール <span className="text-xs font-normal text-stone-400">v3.2</span></h1>
            <p className="text-sm text-stone-500 mt-0.5">LINE配信コンテンツ生成</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {/* お知らせ欄 */}
        <NoticeBoard />

        {/* クイックアクション */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/generate">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-green-200 bg-green-50/50 h-full">
              <CardContent className="pt-6 pb-6">
                <div className="text-3xl mb-3">✍️</div>
                <h2 className="text-lg font-bold text-stone-800 mb-1">ストーリー生成</h2>
                <p className="text-sm text-stone-500">テーマとトーンを選んでコンテンツを作成</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/calendar">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-blue-200 bg-blue-50/50 h-full">
              <CardContent className="pt-6 pb-6">
                <div className="text-3xl mb-3">📅</div>
                <h2 className="text-lg font-bold text-stone-800 mb-1">カレンダー</h2>
                <p className="text-sm text-stone-500">配信スケジュール・リマインダーの管理</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/templates">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-stone-200 h-full">
              <CardContent className="pt-6 pb-6">
                <div className="text-3xl mb-3">📑</div>
                <h2 className="text-lg font-bold text-stone-800 mb-1">テンプレート管理</h2>
                <p className="text-sm text-stone-500">保存したテンプレートの閲覧・再利用・削除</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/knowledge">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-stone-200 h-full">
              <CardContent className="pt-6 pb-6">
                <div className="text-3xl mb-3">📚</div>
                <h2 className="text-lg font-bold text-stone-800 mb-1">ナレッジ管理</h2>
                <p className="text-sm text-stone-500">ナレッジと商品データの管理</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* ステータス */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/stories">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-stone-500">生成済みストーリー</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-stone-800">{stats.stories}件</div>
                <p className="text-xs text-stone-400 mt-1">クリックで履歴を表示 →</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/templates">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-stone-500">テンプレート</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-stone-800">{stats.templates}件</div>
                <p className="text-xs text-stone-400 mt-1">クリックで管理画面へ →</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/knowledge">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-stone-500">ナレッジ</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-stone-800">{stats.knowledge}件</div>
                <p className="text-xs text-stone-400 mt-1">クリックで管理画面へ →</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* ネタストック */}
        <StockIdeas />
      </main>
    </div>
  )
}
