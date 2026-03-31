import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-stone-50">
      {/* ヘッダー */}
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div>
            <h1 className="text-xl font-bold text-stone-800">🌿 テネモス ストーリーツール</h1>
            <p className="text-sm text-stone-500 mt-0.5">LINE配信コンテンツ生成</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {/* クイックアクション */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/generate">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-green-200 bg-green-50/50">
              <CardContent className="pt-6 pb-6">
                <div className="text-3xl mb-3">✍️</div>
                <h2 className="text-lg font-bold text-stone-800 mb-1">新しいストーリーを生成</h2>
                <p className="text-sm text-stone-500">テーマとトーンを選んで、LINE配信用のコンテンツを作成します</p>
              </CardContent>
            </Card>
          </Link>

          <Card className="opacity-60">
            <CardContent className="pt-6 pb-6">
              <div className="text-3xl mb-3">📚</div>
              <h2 className="text-lg font-bold text-stone-800 mb-1">ナレッジ更新</h2>
              <p className="text-sm text-stone-500">HP・ブログからデータを収集して生成品質を向上（Phase 2で実装）</p>
            </CardContent>
          </Card>
        </div>

        {/* ステータス */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-stone-500">生成済みストーリー</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-stone-800">-</div>
              <p className="text-xs text-stone-400 mt-1">生成開始後に表示されます</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-stone-500">テンプレート</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-stone-800">-</div>
              <p className="text-xs text-stone-400 mt-1">Phase 3で実装</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-stone-500">ナレッジ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-stone-800">未収集</div>
              <p className="text-xs text-stone-400 mt-1">Phase 2で実装</p>
            </CardContent>
          </Card>
        </div>

        {/* 案内 */}
        <Card className="bg-stone-100/50 border-stone-200">
          <CardContent className="pt-6">
            <h3 className="font-medium text-stone-700 mb-2">🚀 Phase 1 - 基本生成機能</h3>
            <p className="text-sm text-stone-500 leading-relaxed">
              現在はPhase 1（基本生成機能）です。テーマとトーンを選んでストーリーを生成できます。
              Phase 2でナレッジ収集機能を追加すると、テネモスの商品情報やブランド哲学を反映した、より高品質なコンテンツが生成されるようになります。
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
