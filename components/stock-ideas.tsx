'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type StockIdea = {
  id: string
  content: string
  status: 'unused' | 'used'
  story_id: string | null
  created_at: string
}

export default function StockIdeas() {
  const [ideas, setIdeas] = useState<StockIdea[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showInput, setShowInput] = useState(false)

  const fetchIdeas = useCallback(async () => {
    try {
      const res = await fetch('/api/stock-ideas?status=unused')
      if (res.ok) {
        const data = await res.json()
        setIdeas(data)
      }
    } catch (error) {
      console.error('ネタストック取得エラー:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchIdeas()
  }, [fetchIdeas])

  const handleSubmit = async () => {
    if (!inputText.trim()) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/stock-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      })
      if (res.ok) {
        const result = await res.json()
        setInputText('')
        setShowInput(false)
        fetchIdeas()
        alert(`${result.inserted}件のネタを登録しました`)
      }
    } catch (error) {
      console.error('ネタストック登録エラー:', error)
      alert('登録に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このネタを削除しますか？')) return
    try {
      const res = await fetch('/api/stock-ideas', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setIdeas(ideas.filter(i => i.id !== id))
      }
    } catch (error) {
      console.error('削除エラー:', error)
    }
  }

  // 入力行数をプレビュー表示
  const previewLines = inputText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold text-stone-800 flex items-center gap-2">
            <span className="text-xl">💡</span>
            ネタストック
            <span className="text-sm font-normal text-stone-400">
              {isLoading ? '...' : `${ideas.length}件`}
            </span>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInput(!showInput)}
            className="text-xs"
          >
            {showInput ? '閉じる' : '+ ネタ追加'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 一括投入エリア */}
        {showInput && (
          <div className="space-y-2 p-3 bg-white rounded-lg border border-amber-200">
            <p className="text-xs text-stone-500">
              1行に1つずつネタを入力してください（改行区切りで一括登録）
            </p>
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`例：\n春の体調管理と酵素の関係\nお客様の声紹介（田中様）\n新商品マナウォーターの使い方`}
              rows={5}
              className="text-sm"
            />
            {previewLines.length > 0 && (
              <p className="text-xs text-amber-600">
                {previewLines.length}件のネタが登録されます
              </p>
            )}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || previewLines.length === 0}
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isSubmitting ? '登録中...' : `${previewLines.length}件を登録`}
            </Button>
          </div>
        )}

        {/* ネタ一覧 */}
        {isLoading ? (
          <p className="text-sm text-stone-400">読み込み中...</p>
        ) : ideas.length === 0 ? (
          <p className="text-sm text-stone-400">
            ネタストックがありません。「+ ネタ追加」から追加してください。
          </p>
        ) : (
          <ul className="space-y-1.5">
            {ideas.map((idea) => (
              <li
                key={idea.id}
                className="flex items-start justify-between gap-2 p-2 bg-white rounded border border-stone-100 hover:border-amber-200 transition-colors group"
              >
                <span className="text-sm text-stone-700 flex-1 pt-0.5">
                  {idea.content}
                </span>
                <button
                  onClick={() => handleDelete(idea.id)}
                  className="text-stone-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-1"
                  title="削除"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
