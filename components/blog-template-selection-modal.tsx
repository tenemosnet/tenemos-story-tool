'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type Template = {
  id: string
  slug: string
  name: string
  description: string | null
}

type Props = {
  storyId: string
  storyBodyLength: number
  templates: Template[]
  onClose: () => void
  onGenerated: (blogStockId: string) => void
}

const SLUG_LABEL: Record<string, { emoji: string; desc: string }> = {
  wp_standard_howto: {
    emoji: '📋',
    desc: '実用的な使い方や活用法を3〜5つ紹介',
  },
  wp_standard_philosophical: {
    emoji: '🤔',
    desc: 'テネモス理論を深く掘り下げて解説',
  },
  wp_standard_staff_recommend: {
    emoji: '👤',
    desc: '個人視点でカジュアルに体験を語る',
  },
}

export default function BlogTemplateSelectionModal({
  storyId,
  storyBodyLength,
  templates,
  onClose,
  onGenerated,
}: Props) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [userRequest, setUserRequest] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestedSlug, setSuggestedSlug] = useState<string | null>(null)
  const [suggestReason, setSuggestReason] = useState<string>('')

  // モーダル表示時にテンプレート推奨を取得
  useEffect(() => {
    const fetchSuggestion = async () => {
      try {
        const res = await fetch(`/api/blog-stocks/suggest-template?story_id=${storyId}`)
        if (!res.ok) return
        const data = await res.json()
        setSuggestedSlug(data.suggested_template_slug)
        setSuggestReason(data.reason)

        // 推奨テンプレートをデフォルト選択
        const matched = templates.find(t => t.slug === data.suggested_template_slug)
        if (matched) setSelectedTemplateId(matched.id)
      } catch {
        // 取得失敗時は最初のテンプレートをデフォルト選択
        if (templates.length > 0) setSelectedTemplateId(templates[0].id)
      }
    }
    fetchSuggestion()
  }, [storyId, templates])

  const handleGenerate = async () => {
    if (!selectedTemplateId) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story_id: storyId,
          template_id: selectedTemplateId,
          user_request: userRequest.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || '生成に失敗しました')
      }
      const data = await res.json()
      onGenerated(data.blog_stock_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 space-y-5">
          <h2 className="text-lg font-bold text-stone-800">
            ブログ記事のテンプレートを選択
          </h2>

          {/* おすすめ表示 */}
          {suggestedSlug && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800">
              💡 おすすめ：{SLUG_LABEL[suggestedSlug]?.emoji}{' '}
              {templates.find(t => t.slug === suggestedSlug)?.name ?? suggestedSlug}
              <br />
              <span className="text-xs text-amber-600">{suggestReason}</span>
            </div>
          )}

          {/* テンプレート選択 */}
          <div className="space-y-2">
            {templates.map(t => {
              const meta = SLUG_LABEL[t.slug]
              const isRecommended = t.slug === suggestedSlug
              return (
                <label
                  key={t.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedTemplateId === t.id
                      ? 'border-green-400 bg-green-50'
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="template"
                    value={t.id}
                    checked={selectedTemplateId === t.id}
                    onChange={() => setSelectedTemplateId(t.id)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-stone-800">
                      {meta?.emoji} {t.name}
                      {isRecommended && (
                        <span className="ml-2 text-xs text-amber-600 font-normal">
                          💡おすすめ
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      {meta?.desc ?? t.description}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>

          {/* 追加指示 */}
          <div>
            <label className="text-sm font-medium text-stone-700 block mb-1">
              追加の指示・要望（任意）
            </label>
            <Textarea
              placeholder="例：商品名への言及を増やして"
              value={userRequest}
              onChange={e => setUserRequest(e.target.value)}
              rows={2}
            />
          </div>

          {/* 文字数警告 */}
          {storyBodyLength < 500 && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠️ 短いストーリーから長い記事（1500〜2800字）を生成します。
              ナレッジソースを参照して内容を補強します。
            </div>
          )}

          {/* 生成中メッセージ */}
          {generating && (
            <p className="text-xs text-stone-500 text-center animate-pulse">
              生成中です。30秒〜1分ほどかかります...
            </p>
          )}

          {/* エラー */}
          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* ボタン */}
          <div className="flex gap-2 justify-end pt-1">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={generating}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || !selectedTemplateId}
              className="bg-green-700 hover:bg-green-800 text-white"
            >
              {generating ? '生成中...' : '生成開始'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
