'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type TaskMemo = {
  id: string
  content: string
  display_date: string
  is_done: boolean
  created_at: string
}

type ScheduledContent = {
  id: string
  title: string
  body: string
  type: 'line' | 'email'
  scheduled_date: string
  is_done: boolean
}

type NoticeData = {
  memos: TaskMemo[]
  scheduled: ScheduledContent[]
  overdueMemos: TaskMemo[]
  overdueContents: ScheduledContent[]
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  const weekday = weekdays[date.getDay()]

  if (diff === 0) return `今日（${month}/${day} ${weekday}）`
  if (diff === 1) return `明日（${month}/${day} ${weekday}）`
  if (diff < 0) return `${month}/${day}（${weekday}）⚠ 期限超過`
  return `${month}/${day}（${weekday}）`
}

function getDefaultDate() {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

export default function NoticeBoard() {
  const [data, setData] = useState<NoticeData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [newDate, setNewDate] = useState(getDefaultDate)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchNotices = useCallback(async () => {
    try {
      const res = await fetch('/api/notices')
      if (res.ok) {
        setData(await res.json())
      }
    } catch (error) {
      console.error('お知らせ取得エラー:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotices()
  }, [fetchNotices])

  const handleAddMemo = async () => {
    if (!newContent.trim() || !newDate) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/task-memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent, display_date: newDate }),
      })
      if (res.ok) {
        setNewContent('')
        setNewDate(getDefaultDate())
        setShowAddForm(false)
        fetchNotices()
      }
    } catch (error) {
      console.error('メモ追加エラー:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDone = async (id: string) => {
    try {
      await fetch('/api/task-memos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_done: true }),
      })
      fetchNotices()
    } catch (error) {
      console.error('完了エラー:', error)
    }
  }

  if (isLoading) {
    return (
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="py-4">
          <p className="text-sm text-stone-400">お知らせを読み込み中...</p>
        </CardContent>
      </Card>
    )
  }

  const hasOverdue = (data?.overdueMemos?.length ?? 0) + (data?.overdueContents?.length ?? 0) > 0
  const hasUpcoming = (data?.memos?.length ?? 0) + (data?.scheduled?.length ?? 0) > 0
  const isEmpty = !hasOverdue && !hasUpcoming

  return (
    <Card className={`${hasOverdue ? 'border-red-300 bg-red-50/30' : 'border-blue-200 bg-blue-50/30'}`}>
      <CardContent className="pt-5 pb-4 space-y-3">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-stone-800 flex items-center gap-2">
            <span className="text-lg">{hasOverdue ? '🔔' : '📋'}</span>
            お知らせ
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-xs"
          >
            {showAddForm ? '閉じる' : '+ リマインダー'}
          </Button>
        </div>

        {/* リマインダー追加フォーム */}
        {showAddForm && (
          <div className="flex gap-2 items-end p-3 bg-white rounded-lg border border-blue-200">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-stone-500">内容</label>
              <input
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="例：LINE配信日：春の酵素特集"
                className="text-sm w-full rounded-md border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddMemo() }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-stone-500">日付</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="text-sm w-40 rounded-md border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <Button
              onClick={handleAddMemo}
              disabled={isSubmitting || !newContent.trim()}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? '...' : '追加'}
            </Button>
          </div>
        )}

        {/* 期限超過（警告） */}
        {hasOverdue && (
          <div className="space-y-1.5">
            {data!.overdueMemos.map((memo) => (
              <div key={memo.id} className="flex items-center gap-2 p-2 bg-red-100 rounded border border-red-200">
                <span className="text-xs text-red-500 font-medium shrink-0">{formatDate(memo.display_date)}</span>
                <span className="text-sm text-red-700 flex-1">{memo.content}</span>
                <button
                  onClick={() => handleDone(memo.id)}
                  className="text-xs text-red-400 hover:text-red-600 shrink-0"
                  title="完了にする"
                >
                  ✓完了
                </button>
              </div>
            ))}
            {data!.overdueContents.map((item) => (
              <div key={item.id} className="flex items-center gap-2 p-2 bg-red-100 rounded border border-red-200">
                <span className="text-xs text-red-500 font-medium shrink-0">{formatDate(item.scheduled_date)}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-red-200 text-red-700 shrink-0">
                  {item.type === 'line' ? 'LINE' : 'メール'}
                </span>
                <span className="text-sm text-red-700 flex-1">{item.title}</span>
              </div>
            ))}
          </div>
        )}

        {/* 今日〜7日以内の予定 */}
        {hasUpcoming && (
          <div className="space-y-1.5">
            {data!.memos.map((memo) => (
              <div key={memo.id} className="flex items-center gap-2 p-2 bg-white rounded border border-stone-100 hover:border-blue-200 transition-colors group">
                <span className="text-xs text-blue-500 font-medium shrink-0">{formatDate(memo.display_date)}</span>
                <span className="text-sm text-stone-700 flex-1">{memo.content}</span>
                <button
                  onClick={() => handleDone(memo.id)}
                  className="text-xs text-stone-300 hover:text-green-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  title="完了にする"
                >
                  ✓完了
                </button>
              </div>
            ))}
            {data!.scheduled.map((item) => (
              <div key={item.id} className="flex items-center gap-2 p-2 bg-white rounded border border-stone-100 hover:border-blue-200 transition-colors">
                <span className="text-xs text-blue-500 font-medium shrink-0">{formatDate(item.scheduled_date)}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                  item.type === 'line' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                }`}>
                  {item.type === 'line' ? 'LINE' : 'メール'}
                </span>
                <span className="text-sm text-stone-700 flex-1">{item.title}</span>
              </div>
            ))}
          </div>
        )}

        {/* 何もない場合 */}
        {isEmpty && (
          <p className="text-sm text-stone-400">
            直近7日間の予定はありません。「+ リマインダー」からメモを追加できます。
          </p>
        )}
      </CardContent>
    </Card>
  )
}
