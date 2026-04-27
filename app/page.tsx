import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'
import StockIdeas from '@/components/stock-ideas'
import NoticeBoard from '@/components/notice-board'

export const dynamic = 'force-dynamic'

async function getStats() {
  const supabase = createServiceClient()

  const [stories, templates, knowledge, mailStocks, blogStocks, latestAutoStory, unusedStock] = await Promise.all([
    supabase.from('stories').select('id', { count: 'exact', head: true }),
    supabase.from('templates').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('knowledge_sources').select('id', { count: 'exact', head: true }),
    supabase.from('finished_contents').select('id', { count: 'exact', head: true }).is('scheduled_date', null).eq('is_done', false),
    supabase.from('blog_stocks').select('id', { count: 'exact', head: true }).is('scheduled_date', null).eq('is_done', false),
    supabase.from('stories').select('id, title, tone, theme, created_at').eq('length_setting', 400).order('created_at', { ascending: false }).limit(1),
    supabase.from('stock_ideas').select('id', { count: 'exact', head: true }).eq('status', 'unused'),
  ])

  return {
    stories: stories.count ?? 0,
    templates: templates.count ?? 0,
    knowledge: knowledge.count ?? 0,
    mailStocks: mailStocks.count ?? 0,
    blogStocks: blogStocks.count ?? 0,
    latestAutoStory: latestAutoStory.data?.[0] ?? null,
    unusedStock: unusedStock.count ?? 0,
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
            <h1 className="text-xl font-bold text-stone-800">🌿 テネモス ストーリーツール <span className="text-xs font-normal text-stone-400">v4.0</span></h1>
            <p className="text-sm text-stone-500 mt-0.5">LINE配信コンテンツ生成</p>
          </div>
          <a href="/output-templates" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
            出力テンプレート管理 &rarr;
          </a>
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
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-3xl">📑</span>
                  <span className="text-sm font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">{stats.templates}件</span>
                </div>
                <h2 className="text-lg font-bold text-stone-800 mb-1">テンプレート管理</h2>
                <p className="text-sm text-stone-500">保存したテンプレートの閲覧・再利用・削除</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/knowledge">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-stone-200 h-full">
              <CardContent className="pt-6 pb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-3xl">📚</span>
                  <span className="text-sm font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">{stats.knowledge}件</span>
                </div>
                <h2 className="text-lg font-bold text-stone-800 mb-1">ナレッジ管理</h2>
                <p className="text-sm text-stone-500">ナレッジと商品データの管理</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* ステータス */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

          <Link href="/calendar#stock">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-purple-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-purple-600">📝 メール通信ストック</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-stone-800">{stats.mailStocks}件</div>
                <p className="text-xs text-stone-400 mt-1">クリックで一覧を表示 →</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/calendar#blog-stock">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-blue-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-600">📰 ブログ記事ストック</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-stone-800">{stats.blogStocks}件</div>
                <p className="text-xs text-stone-400 mt-1">クリックで一覧を表示 →</p>
              </CardContent>
            </Card>
          </Link>

          {/* 自動生成ストーリー */}
          <Link href="/stories">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-amber-200 bg-amber-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-700">🤖 週次自動生成</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.latestAutoStory ? (
                  <>
                    <p className="text-sm font-bold text-stone-800 truncate">{stats.latestAutoStory.title}</p>
                    <p className="text-xs text-stone-400 mt-1">
                      {new Date(stats.latestAutoStory.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-stone-400">まだ自動生成はありません</p>
                )}
                <p className="text-xs text-amber-600 mt-2">ネタストック残: {stats.unusedStock}件</p>
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
