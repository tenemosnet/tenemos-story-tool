'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { SplittingStyle } from '@/lib/types/line-distribution'

type Props = {
  storyId: string
  onClose: () => void
  onComplete: (lineDistributionId: string) => void
}

const PARTS_OPTIONS = [
  { value: 2, label: '2分割（約500字×2）' },
  { value: 3, label: '3分割（約300字×3）' },
  { value: 4, label: '4分割（約250字×4）' },
] as const

const STYLE_OPTIONS: { value: SplittingStyle; label: string; desc: string }[] = [
  { value: 'subtle', label: '控えめ', desc: '「続きは明日」程度のさりげないつなぎ' },
  { value: 'explicit', label: 'しっかり', desc: '前回のおさらい＋次回予告を毎回入れる' },
  { value: 'none', label: 'なし', desc: '各配信が完全に独立した記事として読める' },
]

export default function LineSplitModal({ storyId, onClose, onComplete }: Props) {
  const [totalParts, setTotalParts] = useState<2 | 3 | 4>(3)
  const [splittingStyle, setSplittingStyle] = useState<SplittingStyle>('subtle')
  const [userRequest, setUserRequest] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/split-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story_id: storyId,
          total_parts: totalParts,
          splitting_style: splittingStyle,
          user_request: userRequest.trim() || undefined,
        }),
      })
      const data = await res.json() as { line_distribution_id?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? '分割に失敗しました')
      onComplete(data.line_distribution_id!)
    } catch (err) {
      setError(err instanceof Error ? err.message : '分割に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md space-y-4 p-6">
        <h2 className="text-base font-bold text-stone-800">📱 LINE配信用に分割</h2>

        {/* 分割数 */}
        <div>
          <p className="text-sm text-stone-600 mb-2 font-medium">分割数</p>
          <div className="space-y-1.5">
            {PARTS_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="total-parts"
                  value={opt.value}
                  checked={totalParts === opt.value}
                  onChange={() => setTotalParts(opt.value)}
                />
                <span className="text-stone-700">{opt.label}{opt.value === 3 && <span className="ml-1 text-xs text-stone-400">（推奨）</span>}</span>
              </label>
            ))}
          </div>
        </div>

        {/* つなぎ語スタイル */}
        <div>
          <p className="text-sm text-stone-600 mb-2 font-medium">つなぎ語のスタイル</p>
          <div className="space-y-1.5">
            {STYLE_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="splitting-style"
                  value={opt.value}
                  checked={splittingStyle === opt.value}
                  onChange={() => setSplittingStyle(opt.value)}
                  className="mt-0.5"
                />
                <span className="text-stone-700">
                  {opt.label}
                  <span className="block text-xs text-stone-400">{opt.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* 追加指示 */}
        <div>
          <label className="text-sm text-stone-600 block mb-1 font-medium">
            追加の指示（任意）
          </label>
          <Textarea
            placeholder="例：各配信の最後を質問で締めてください"
            value={userRequest}
            onChange={e => setUserRequest(e.target.value)}
            rows={2}
          />
        </div>

        {generating && (
          <p className="text-xs text-stone-500 animate-pulse bg-stone-50 rounded-lg px-3 py-2">
            分割中です。30秒程度かかります...
          </p>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={generating}>
            キャンセル
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={generating}
            className="bg-green-700 hover:bg-green-800 text-white"
          >
            {generating ? '分割中...' : '分割実行'}
          </Button>
        </div>
      </div>
    </div>
  )
}
