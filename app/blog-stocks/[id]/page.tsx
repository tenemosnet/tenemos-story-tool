'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import type { BlogStock } from '@/lib/types/blog-stock'
import type { BlogGenerationHistory } from '@/lib/types/blog-generation'

const TEMPLATE_OPTIONS = [
  { slug: 'wp_standard_howto', label: '📋 How-to型' },
  { slug: 'wp_standard_philosophical', label: '🤔 思想・解説型' },
  { slug: 'wp_standard_staff_recommend', label: '👤 スタッフおすすめ型' },
] as const

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
  history: BlogGenerationHistory
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
              再生成
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
            <p>テンプレート：{history.template_slug}</p>
            <p>
              トークン：{history.input_tokens.toLocaleString()} / {history.output_tokens.toLocaleString()}
            </p>
            <p>
              料金：${history.cost_usd.toFixed(4)}（¥{history.cost_jpy}）
            </p>
            <p>モデル：{history.model_used}</p>
          </div>

          {/* プロンプト全文 */}
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

          {/* 生成結果 */}
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
                  {history.generated_body}
                </pre>
                <button
                  className="absolute top-2 right-2 text-xs bg-white border border-stone-200 rounded px-2 py-1 hover:bg-stone-50"
                  onClick={() => navigator.clipboard.writeText(history.generated_body)}
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

export default function BlogStockDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const [stock, setStock] = useState<BlogStock | null>(null)
  const [histories, setHistories] = useState<BlogGenerationHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 再生成フォーム
  const [regenRequest, setRegenRequest] = useState('')
  const [regenTemplateSlug, setRegenTemplateSlug] = useState('')
  const [regenTemplateId, setRegenTemplateId] = useState('')
  const [templates, setTemplates] = useState<{ id: string; slug: string }[]>([])
  const [regenerating, setRegenerating] = useState(false)
  const [regenError, setRegenError] = useState<string | null>(null)

  // コピー完了フラグ
  const [copied, setCopied] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [stockRes, historyRes] = await Promise.all([
        fetch(`/api/blog-stocks/${params.id}`),
        fetch(`/api/blog-stocks/${params.id}/history`),
      ])
      if (!stockRes.ok) throw new Error('記事が見つかりません')
      const stockData = await stockRes.json()
      const historyData = historyRes.ok ? await historyRes.json() : { histories: [] }
      setStock(stockData)
      setHistories(historyData.histories ?? [])

      // 現在使用中テンプレートをデフォルト選択
      if (stockData.article_type) {
        setRegenTemplateSlug(stockData.article_type)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  // テンプレート一覧取得（再生成ラジオ用）
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await fetch('/api/output-templates')
        if (!res.ok) return
        const data = await res.json()
        const wpTemplates = (data as { id: string; slug: string; format: string }[]).filter(
          t => t.format === 'wordpress'
        )
        setTemplates(wpTemplates)
      } catch {
        // ignore
      }
    }
    fetchTemplates()
  }, [])

  // regenTemplateSlug が変わったら対応する id を設定
  useEffect(() => {
    const matched = templates.find(t => t.slug === regenTemplateSlug)
    if (matched) setRegenTemplateId(matched.id)
  }, [regenTemplateSlug, templates])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCopy = async () => {
    if (!stock) return
    await navigator.clipboard.writeText(stock.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = async () => {
    if (!confirm('この記事ストックを削除しますか？')) return
    try {
      const res = await fetch(`/api/blog-stocks/${params.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      router.push('/stories')
    } catch (err) {
      alert(err instanceof Error ? err.message : '削除に失敗しました')
    }
  }

  const handleRegenerate = async () => {
    if (!regenTemplateId) {
      setRegenError('テンプレートを選択してください')
      return
    }
    const latestHistory = histories[0]
    if (!latestHistory) {
      setRegenError('生成履歴が見つかりません')
      return
    }

    setRegenerating(true)
    setRegenError(null)
    try {
      const res = await fetch('/api/generate-blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story_id: stock?.story_id,
          template_id: regenTemplateId,
          user_request: regenRequest.trim() || undefined,
          parent_history_id: latestHistory.id,
        }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || '再生成に失敗しました')
      }
      // 成功：画面を再読み込み
      setRegenRequest('')
      await fetchData()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : '再生成に失敗しました')
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

  if (error || !stock) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <p className="text-red-500">{error ?? '記事が見つかりません'}</p>
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
          <h1 className="text-xl font-bold text-stone-800 truncate">{stock.title}</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        {/* メタ情報 */}
        <div className="text-xs text-stone-400 space-y-0.5">
          {latestHistory && (
            <>
              <p>使用テンプレート：{latestHistory.template_slug}</p>
              <p>生成日：{formatDate(latestHistory.created_at)}</p>
            </>
          )}
        </div>

        {/* 記事本文（HTMLレンダリング） */}
        {/* XSS注意：自社AI生成HTMLのみを表示する前提で dangerouslySetInnerHTML を使用 */}
        <Card>
          <CardContent className="py-5">
            <div
              className="prose prose-stone prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: stock.body }}
            />
          </CardContent>
        </Card>

        {/* アクションボタン */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleCopy}>
            {copied ? '✓ コピーしました' : '📋 HTMLをコピー'}
          </Button>
          <Button
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
            onClick={handleDelete}
          >
            🗑 削除
          </Button>
        </div>

        {/* 再生成フォーム */}
        <div className="border-t pt-6 space-y-4">
          <h2 className="text-base font-semibold text-stone-700">🔄 再生成</h2>
          <div>
            <label className="text-sm text-stone-600 block mb-1">
              どこを変更したいですか？（任意）
            </label>
            <Textarea
              placeholder="例：各章をもう少し短く、商品への言及を増やして"
              value={regenRequest}
              onChange={e => setRegenRequest(e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <p className="text-sm text-stone-600 mb-2">テンプレート</p>
            <div className="space-y-1.5">
              {TEMPLATE_OPTIONS.map(opt => {
                const isCurrentTemplate = stock.article_type === opt.slug
                return (
                  <label
                    key={opt.slug}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="regen-template"
                      value={opt.slug}
                      checked={regenTemplateSlug === opt.slug}
                      onChange={() => setRegenTemplateSlug(opt.slug)}
                    />
                    <span className="text-stone-700">
                      {opt.label}
                      {isCurrentTemplate && (
                        <span className="ml-1 text-xs text-stone-400">（現在）</span>
                      )}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {regenError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {regenError}
            </p>
          )}

          {regenerating && (
            <p className="text-xs text-stone-500 animate-pulse">
              再生成中です。30秒〜1分ほどかかります...
            </p>
          )}

          <Button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="bg-green-700 hover:bg-green-800 text-white"
          >
            {regenerating ? '再生成中...' : '🔄 再生成実行'}
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
