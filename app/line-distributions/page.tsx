'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type LineDistributionSummary = {
  id: string
  total_parts: number
  splitting_style: string
  is_done: boolean[]
  scheduled_dates: (string | null)[]
  created_at: string
  stories: { title: string } | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function DistributionCard({
  dist,
  onDeleted,
}: {
  dist: LineDistributionSummary
  onDeleted: (id: string) => void
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const doneCount = dist.is_done.filter(Boolean).length
  const allDone = doneCount === dist.total_parts

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('このLINE配信シリーズを削除しますか？（生成履歴も削除されます）')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/line-distributions/${dist.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      onDeleted(dist.id)
    } catch {
      alert('削除に失敗しました')
      setDeleting(false)
    }
  }

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-all ${allDone ? 'opacity-60' : 'border-teal-200'}`}
      onClick={() => router.push(`/line-distributions/${dist.id}`)}
    >
      <CardContent className="py-4 px-5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {dist.stories?.title ? (
              <p className="text-sm font-semibold text-stone-800 truncate">{dist.stories.title}</p>
            ) : (
              <p className="text-sm text-stone-400 italic">（ストーリー未紐付け）</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded">
                {dist.total_parts}分割
              </span>
              <span className="text-xs text-stone-400">{dist.splitting_style}</span>
              <span className="text-xs text-stone-400">
                {doneCount}/{dist.total_parts} 配信済み
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`/line-distributions/${dist.id}`}
              onClick={e => e.stopPropagation()}
              className="text-xs text-teal-600 hover:text-teal-800 font-medium"
            >
              詳細 →
            </a>
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-red-200 text-red-500 hover:bg-red-50"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? '削除中...' : '🗑'}
            </Button>
          </div>
        </div>

        {/* 各回の配信予定日 */}
        <div className="flex flex-wrap gap-1">
          {dist.scheduled_dates.map((date, i) => (
            <span
              key={i}
              className={`text-[11px] px-2 py-0.5 rounded ${
                dist.is_done[i]
                  ? 'bg-stone-100 text-stone-400'
                  : 'bg-teal-50 text-teal-700 border border-teal-100'
              }`}
            >
              {dist.is_done[i] ? '✅' : `第${i + 1}回`}
              {date ? ` ${date.slice(5).replace('-', '/')}` : ' 日程未定'}
            </span>
          ))}
        </div>

        <p className="text-xs text-stone-400">作成: {formatDate(dist.created_at)}</p>
      </CardContent>
    </Card>
  )
}

export default function LineDistributionsPage() {
  const [items, setItems] = useState<LineDistributionSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/line-distributions')
        if (res.ok) {
          const data = await res.json()
          setItems(data.line_distributions ?? [])
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleDeleted = (id: string) => {
    setItems(prev => prev.filter(d => d.id !== id))
  }

  const active = items.filter(d => !d.is_done.every(Boolean))
  const done = items.filter(d => d.is_done.length > 0 && d.is_done.every(Boolean))

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <a href="/" className="text-stone-400 hover:text-stone-600 text-sm">← ダッシュボード</a>
          <h1 className="text-xl font-bold text-stone-800">📱 LINE配信シリーズ一覧</h1>
          <span className="text-sm text-stone-400">{items.length}件</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-8">
        {loading ? (
          <div className="text-center py-12 text-stone-400">読み込み中...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📱</div>
            <p className="text-stone-500">LINE配信シリーズはまだありません</p>
            <a href="/stories" className="inline-block mt-4 text-teal-700 hover:text-teal-800 text-sm font-medium">
              → ストーリー一覧へ
            </a>
          </div>
        ) : (
          <>
            {/* 配信検討中 */}
            <section>
              <h2 className="text-sm font-semibold text-stone-600 mb-3">
                配信検討中
                <span className="ml-2 text-xs font-normal text-stone-400">({active.length}件)</span>
              </h2>
              {active.length === 0 ? (
                <p className="text-sm text-stone-400">配信検討中のシリーズはありません</p>
              ) : (
                <div className="space-y-3">
                  {active.map(d => (
                    <DistributionCard key={d.id} dist={d} onDeleted={handleDeleted} />
                  ))}
                </div>
              )}
            </section>

            {/* 配信済み */}
            {done.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-stone-400 mb-3">
                  配信済み
                  <span className="ml-2 text-xs font-normal">({done.length}件)</span>
                </h2>
                <div className="space-y-3">
                  {done.map(d => (
                    <DistributionCard key={d.id} dist={d} onDeleted={handleDeleted} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
