'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import type { LineDistribution, LineDistributionHistory, SplittingStyle } from '@/lib/types/line-distribution'

const PARTS_OPTIONS = [
  { value: 2, label: '2分割' },
  { value: 3, label: '3分割' },
  { value: 4, label: '4分割' },
] as const

const STYLE_OPTIONS: { value: SplittingStyle; label: string }[] = [
  { value: 'subtle', label: '控えめ' },
  { value: 'explicit', label: 'しっかり' },
  { value: 'none', label: 'なし' },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function HistoryItem({
  history,
  index,
  total,
}: {
  history: LineDistributionHistory
  index: number
  total: number
}) {
  const [open, setOpen] = useState(index === 0)
  const [promptOpen, setPromptOpen] = useState(false)
  const [resultOpen, setResultOpen] = useState(false)

  const label = index === 0 ? '最新' : index === total - 1 ? '初回' : null

  return (
    <div className="border border-stone-200 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left bg-stone-50 hover:bg-stone-100 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
          <span>
            履歴 #{total - index}
            {label && (
              <span className="ml-2 text-xs text-stone-400">({label})</span>
            )}
          </span>
          <span className="text-xs text-stone-400">{formatDate(history.created_at)}</span>
          {history.is_regeneration && (
            <span className="text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">
              再分割
            </span>
          )}
        </div>
        <span className="text-stone-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 py-3 space-y-3 text-sm">
          {history.user_request && (
            <div>
              <p className="text-xs text-stone-500 mb-0.5">ユーザーリクエスト</p>
              <p className="text-stone-700 whitespace-pre-wrap">{history.user_request}</p>
            </div>
          )}
          <div className="text-xs text-stone-500 space-y-0.5">
            <p>分割数：{history.total_parts}分割　スタイル：{history.splitting_style}</p>
            <p>
              トークン：{history.input_tokens.toLocaleString()} / {history.output_tokens.toLocaleString()}
            </p>
            <p>
              料金：${history.cost_usd.toFixed(4)}（¥{history.cost_jpy}）
            </p>
            <p>モデル：{history.model_used}</p>
          </div>

          <div>
            <button
              className="text-xs text-stone-500 hover:text-stone-700 underline"
              onClick={() => setPromptOpen(o => !o)}
            >
              {promptOpen ? '▲ プロンプト全文を閉じる' : '▼ プロンプト全文を表示'}
            </button>
            {promptOpen && (
              <div className="mt-2 relative">
                <pre className="text-xs bg-stone-100 rounded p-3 overflow-auto max-h-60 whitespace-pre-wrap font-mono">
                  {history.full_prompt}
                </pre>
                <button
                  className="absolute top-2 right-2 text-xs bg-white border border-stone-200 rounded px-2 py-1 hover:bg-stone-50"
                  onClick={() => navigator.clipboard.writeText(history.full_prompt)}
                >
                  コピー
                </button>
              </div>
            )}
          </div>

          <div>
            <button
              className="text-xs text-stone-500 hover:text-stone-700 underline"
              onClick={() => setResultOpen(o => !o)}
            >
              {resultOpen ? '▲ 生成結果を閉じる' : '▼ 生成結果を表示'}
            </button>
            {resultOpen && (
              <div className="mt-2 relative">
                <pre className="text-xs bg-stone-100 rounded p-3 overflow-auto max-h-60 whitespace-pre-wrap font-mono">
                  {JSON.stringify(history.generated_parts, null, 2)}
                </pre>
                <button
                  className="absolute top-2 right-2 text-xs bg-white border border-stone-200 rounded px-2 py-1 hover:bg-stone-50"
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(history.generated_parts, null, 2))}
                >
                  コピー
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function LineDistributionDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const [dist, setDist] = useState<LineDistribution | null>(null)
  const [histories, setHistories] = useState<LineDistributionHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // コピー状態（各パートごと）
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  // 配信予定日・完了フラグ（ローカル編集中）
  const [isDone, setIsDone] = useState<boolean[]>([])
  const [scheduledDates, setScheduledDates] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // 再分割フォーム
  const [regenRequest, setRegenRequest] = useState('')
  const [regenParts, setRegenParts] = useState<2 | 3 | 4>(3)
  const [regenStyle, setRegenStyle] = useState<SplittingStyle>('subtle')
  const [regenerating, setRegenerating] = useState(false)
  const [regenError, setRegenError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [distRes, histRes] = await Promise.all([
        fetch(`/api/line-distributions/${params.id}`),
        fetch(`/api/line-distributions/${params.id}/history`),
      ])
      if (!distRes.ok) throw new Error('LINE配信データが見つかりません')
      const distData = await distRes.json() as LineDistribution
      const histData = histRes.ok ? await histRes.json() : { histories: [] }
      setDist(distData)
      setIsDone(distData.is_done ?? Array(distData.total_parts).fill(false))
      setScheduledDates(distData.scheduled_dates ?? Array(distData.total_parts).fill(''))
      setHistories(histData.histories ?? [])

      // 再分割フォームを現在の設定で初期化
      setRegenParts(distData.total_parts as 2 | 3 | 4)
      setRegenStyle(distData.splitting_style)
    } catch (err) {
      setError(err instanceof Error ? err.message : '取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCopyPart = async (index: number) => {
    if (!dist) return
    const part = dist.parts[index]
    await navigator.clipboard.writeText(`${part.title}\n\n${part.body}`)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const handleCopyAll = async () => {
    if (!dist) return
    const text = dist.parts
      .map(p => `${p.title}\n\n${p.body}`)
      .join('\n\n---\n\n')
    await navigator.clipboard.writeText(text)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  const handleSaveDates = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/line-distributions/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_done: isDone,
          scheduled_dates: scheduledDates.map(d => d || null),
        }),
      })
      if (!res.ok) throw new Error('保存に失敗しました')
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('このLINE配信シリーズを削除しますか？（生成履歴も削除されます）')) return
    try {
      const res = await fetch(`/api/line-distributions/${params.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      router.push('/stories')
    } catch (err) {
      alert(err instanceof Error ? err.message : '削除に失敗しました')
    }
  }

  const handleResplit = async () => {
    const latestHistory = histories[0]
    if (!latestHistory) {
      setRegenError('生成履歴が見つかりません')
      return
    }
    setRegenerating(true)
    setRegenError(null)
    try {
      const res = await fetch('/api/split-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story_id: dist?.story_id,
          total_parts: regenParts,
          splitting_style: regenStyle,
          user_request: regenRequest.trim() || undefined,
          parent_history_id: latestHistory.id,
        }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? '再分割に失敗しました')
      setRegenRequest('')
      await fetchData()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : '再分割に失敗しました')
    } finally {
      setRegenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <p className="text-stone-400">読み込み中...</p>
      </div>
    )
  }

  if (error || !dist) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <p className="text-red-500">{error ?? 'データが見つかりません'}</p>
      </div>
    )
  }

  const latestHistory = histories[0]

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-stone-400 hover:text-stone-600 text-sm"
          >
            ← 戻る
          </button>
          <h1 className="text-xl font-bold text-stone-800">
            📱 LINE配信シリーズ（{dist.total_parts}分割）
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        {/* メタ情報 */}
        <div className="text-xs text-stone-400 space-y-0.5">
          {latestHistory && (
            <p>生成日：{formatDate(latestHistory.created_at)}</p>
          )}
          <p>スタイル：{dist.splitting_style}　分割数：{dist.total_parts}</p>
        </div>

        {/* 全まとめコピー */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleCopyAll}>
            {copiedAll ? '✓ コピーしました' : '📋 全配信まとめコピー'}
          </Button>
          <Button
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
            onClick={handleDelete}
          >
            🗑 削除
          </Button>
        </div>

        {/* 各配信カード */}
        <div className="space-y-4">
          {dist.parts.map((part, i) => (
            <Card key={i} className={isDone[i] ? 'opacity-60' : ''}>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-500 bg-stone-100 rounded px-2 py-0.5">
                      第{part.order}回
                    </span>
                    <h2 className="text-sm font-semibold text-stone-800">{part.title}</h2>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyPart(i)}
                    className="shrink-0 text-xs"
                  >
                    {copiedIndex === i ? '✓ コピー' : '📋 コピー'}
                  </Button>
                </div>

                <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">
                  {part.body}
                </p>

                <div className="flex items-center gap-4 pt-1 border-t border-stone-100">
                  <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDone[i] ?? false}
                      onChange={e => {
                        const next = [...isDone]
                        next[i] = e.target.checked
                        setIsDone(next)
                      }}
                    />
                    配信済み
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-stone-500">配信予定日：</span>
                    <input
                      type="date"
                      value={scheduledDates[i] ?? ''}
                      onChange={e => {
                        const next = [...scheduledDates]
                        next[i] = e.target.value
                        setScheduledDates(next)
                      }}
                      className="text-xs border border-stone-200 rounded px-2 py-1 text-stone-700"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 日程・完了保存ボタン */}
        <Button
          variant="outline"
          onClick={handleSaveDates}
          disabled={saving}
        >
          {saving ? '保存中...' : '💾 日程・完了状態を保存'}
        </Button>

        {/* 再分割フォーム */}
        <div className="border-t pt-6 space-y-4">
          <h2 className="text-base font-semibold text-stone-700">🔄 再分割</h2>

          <div>
            <label className="text-sm text-stone-600 block mb-1">
              変更したい点（任意）
            </label>
            <Textarea
              placeholder="例：各配信の最後を質問で締めてください"
              value={regenRequest}
              onChange={e => setRegenRequest(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-6">
            <div>
              <p className="text-sm text-stone-600 mb-1.5">分割数</p>
              <div className="flex gap-3">
                {PARTS_OPTIONS.map(opt => (
                  <label key={opt.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="regen-parts"
                      value={opt.value}
                      checked={regenParts === opt.value}
                      onChange={() => setRegenParts(opt.value)}
                    />
                    <span className="text-stone-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm text-stone-600 mb-1.5">スタイル</p>
              <div className="flex gap-3">
                {STYLE_OPTIONS.map(opt => (
                  <label key={opt.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="regen-style"
                      value={opt.value}
                      checked={regenStyle === opt.value}
                      onChange={() => setRegenStyle(opt.value)}
                    />
                    <span className="text-stone-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {regenError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{regenError}</p>
          )}

          {regenerating && (
            <p className="text-xs text-stone-500 animate-pulse bg-stone-50 rounded-lg px-3 py-2">
              再分割中です。30秒程度かかります...
            </p>
          )}

          <Button
            onClick={handleResplit}
            disabled={regenerating}
            className="bg-green-700 hover:bg-green-800 text-white"
          >
            {regenerating ? '再分割中...' : '🔄 再分割実行'}
          </Button>
        </div>

        {/* 生成履歴 */}
        {histories.length > 0 && (
          <div className="border-t pt-6 space-y-3">
            <h2 className="text-base font-semibold text-stone-700">
              生成履歴（{histories.length}件）
            </h2>
            {histories.map((h, i) => (
              <HistoryItem
                key={h.id}
                history={h}
                index={i}
                total={histories.length}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
