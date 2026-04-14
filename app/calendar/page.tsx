'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

type TaskMemo = {
  id: string
  content: string
  display_date: string
  is_done: boolean
}

type FinishedContent = {
  id: string
  title: string
  body: string
  type: 'line' | 'email'
  scheduled_date: string | null
  is_done: boolean
}

type DayData = {
  memos: TaskMemo[]
  contents: FinishedContent[]
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const startWeekday = firstDay.getDay() // 0=日曜

  const days: (number | null)[] = []

  // 前月の空白
  for (let i = 0; i < startWeekday; i++) {
    days.push(null)
  }

  // 当月の日付
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(d)
  }

  return days
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function CalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [memos, setMemos] = useState<TaskMemo[]>([])
  const [contents, setContents] = useState<FinishedContent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newMemoContent, setNewMemoContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  const todayStr = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate())

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [memosRes, contentsRes] = await Promise.all([
        fetch(`/api/task-memos?include_done=false`),
        fetch(`/api/finished-contents?month=${monthStr}&include_done=false`),
      ])

      if (memosRes.ok) {
        const allMemos: TaskMemo[] = await memosRes.json()
        // 当月のメモだけフィルター
        setMemos(allMemos.filter(m => m.display_date.startsWith(monthStr)))
      }
      if (contentsRes.ok) {
        setContents(await contentsRes.json())
      }
    } catch (error) {
      console.error('カレンダーデータ取得エラー:', error)
    } finally {
      setIsLoading(false)
    }
  }, [monthStr])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else { setMonth(m => m - 1) }
    setSelectedDate(null)
  }

  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else { setMonth(m => m + 1) }
    setSelectedDate(null)
  }

  const goToday = () => {
    setYear(today.getFullYear())
    setMonth(today.getMonth() + 1)
    setSelectedDate(todayStr)
  }

  // 日付ごとのデータをまとめる
  const getDayData = (day: number): DayData => {
    const dateStr = toDateStr(year, month, day)
    return {
      memos: memos.filter(m => m.display_date === dateStr),
      contents: contents.filter(c => c.scheduled_date === dateStr),
    }
  }

  const handleAddMemo = async () => {
    if (!newMemoContent.trim() || !selectedDate) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/task-memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMemoContent, display_date: selectedDate }),
      })
      if (res.ok) {
        setNewMemoContent('')
        setShowAddForm(false)
        fetchData()
      }
    } catch (error) {
      console.error('メモ追加エラー:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDoneMemo = async (id: string) => {
    try {
      await fetch('/api/task-memos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_done: true }),
      })
      fetchData()
    } catch (error) {
      console.error('完了エラー:', error)
    }
  }

  const handleDeleteMemo = async (id: string) => {
    if (!confirm('このリマインダーを削除しますか？')) return
    try {
      await fetch('/api/task-memos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      fetchData()
    } catch (error) {
      console.error('削除エラー:', error)
    }
  }

  const days = getMonthDays(year, month)
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']

  // 選択日のデータ
  const selectedDayData = selectedDate
    ? {
        memos: memos.filter(m => m.display_date === selectedDate),
        contents: contents.filter(c => c.scheduled_date === selectedDate),
      }
    : null

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div>
            <h1 className="text-xl font-bold text-stone-800">📅 カレンダー</h1>
            <p className="text-sm text-stone-500 mt-0.5">配信スケジュール・リマインダー管理</p>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm">← ダッシュボード</Button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-4">
        {/* 月選択ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={prevMonth}>←</Button>
            <h2 className="text-lg font-bold text-stone-800">
              {year}年{month}月
            </h2>
            <Button variant="outline" size="sm" onClick={nextMonth}>→</Button>
          </div>
          <Button variant="outline" size="sm" onClick={goToday}>今日</Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-stone-400 py-8 text-center">読み込み中...</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* カレンダーグリッド */}
            <div className="lg:col-span-2">
              <Card>
                <CardContent className="pt-4 pb-2 px-2">
                  {/* 曜日ヘッダー */}
                  <div className="grid grid-cols-7 mb-1">
                    {weekdays.map((wd, i) => (
                      <div
                        key={wd}
                        className={`text-center text-xs font-medium py-1 ${
                          i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-stone-400'
                        }`}
                      >
                        {wd}
                      </div>
                    ))}
                  </div>

                  {/* 日付セル */}
                  <div className="grid grid-cols-7">
                    {days.map((day, idx) => {
                      if (day === null) {
                        return <div key={`empty-${idx}`} className="h-20 border border-stone-50" />
                      }

                      const dateStr = toDateStr(year, month, day)
                      const dayData = getDayData(day)
                      const isToday = dateStr === todayStr
                      const isSelected = dateStr === selectedDate
                      const hasMemos = dayData.memos.length > 0
                      const hasContents = dayData.contents.length > 0
                      const weekday = (idx % 7)

                      return (
                        <button
                          key={day}
                          onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                          className={`h-20 border text-left p-1 transition-colors relative
                            ${isSelected ? 'border-blue-400 bg-blue-50' : 'border-stone-100 hover:bg-stone-50'}
                            ${isToday ? 'bg-amber-50/50' : ''}
                          `}
                        >
                          <span className={`text-xs font-medium inline-block w-5 h-5 text-center leading-5 rounded-full
                            ${isToday ? 'bg-blue-500 text-white' : ''}
                            ${weekday === 0 ? 'text-red-500' : weekday === 6 ? 'text-blue-500' : 'text-stone-600'}
                          `}>
                            {day}
                          </span>

                          {/* バッジ */}
                          <div className="mt-0.5 space-y-0.5 overflow-hidden">
                            {dayData.contents.map(c => (
                              <div
                                key={c.id}
                                className={`text-[10px] leading-tight px-1 rounded truncate ${
                                  c.type === 'line'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-purple-100 text-purple-700'
                                }`}
                              >
                                {c.type === 'line' ? 'LINE' : 'メール'} {c.title}
                              </div>
                            ))}
                            {dayData.memos.map(m => (
                              <div
                                key={m.id}
                                className="text-[10px] leading-tight px-1 rounded bg-amber-100 text-amber-700 truncate"
                              >
                                📋 {m.content}
                              </div>
                            ))}
                          </div>

                          {/* ドット表示（バッジが入りきらない時用） */}
                          {(hasMemos || hasContents) && (dayData.memos.length + dayData.contents.length > 2) && (
                            <div className="absolute bottom-0.5 right-1 text-[10px] text-stone-400">
                              +{dayData.memos.length + dayData.contents.length - 2}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* 凡例 */}
              <div className="flex gap-4 mt-2 px-2">
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-green-100 border border-green-200" />
                  <span className="text-xs text-stone-500">LINE配信</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-purple-100 border border-purple-200" />
                  <span className="text-xs text-stone-500">メール通信</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-amber-100 border border-amber-200" />
                  <span className="text-xs text-stone-500">リマインダー</span>
                </div>
              </div>
            </div>

            {/* サイドパネル：選択日の詳細 */}
            <div>
              {selectedDate ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold text-stone-800">
                      {(() => {
                        const [, m, d] = selectedDate.split('-')
                        const date = new Date(selectedDate + 'T00:00:00')
                        const wd = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
                        return `${Number(m)}/${Number(d)}（${wd}）`
                      })()}
                      {selectedDate === todayStr && (
                        <span className="ml-2 text-xs font-normal text-blue-500">今日</span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* 配信予定 */}
                    {selectedDayData?.contents && selectedDayData.contents.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-stone-500">配信予定</h4>
                        {selectedDayData.contents.map(c => (
                          <div key={c.id} className="p-2 rounded border border-stone-100 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                c.type === 'line' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                              }`}>
                                {c.type === 'line' ? 'LINE' : 'メール'}
                              </span>
                              <span className="text-sm font-medium text-stone-700">{c.title}</span>
                            </div>
                            <p className="text-xs text-stone-500 line-clamp-3">{c.body}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* リマインダー */}
                    {selectedDayData?.memos && selectedDayData.memos.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-stone-500">リマインダー</h4>
                        {selectedDayData.memos.map(m => (
                          <div key={m.id} className="flex items-start gap-2 p-2 rounded border border-stone-100 group">
                            <span className="text-sm text-stone-700 flex-1">{m.content}</span>
                            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleDoneMemo(m.id)}
                                className="text-xs text-green-500 hover:text-green-700"
                                title="完了"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => handleDeleteMemo(m.id)}
                                className="text-xs text-red-400 hover:text-red-600"
                                title="削除"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 何もない場合 */}
                    {(!selectedDayData || (selectedDayData.memos.length === 0 && selectedDayData.contents.length === 0)) && (
                      <p className="text-sm text-stone-400">この日の予定はありません</p>
                    )}

                    {/* リマインダー追加 */}
                    {showAddForm ? (
                      <div className="space-y-2 pt-2 border-t border-stone-100">
                        <textarea
                          value={newMemoContent}
                          onChange={(e) => setNewMemoContent(e.target.value)}
                          placeholder="リマインダーの内容を入力"
                          rows={2}
                          className="w-full text-sm rounded-md border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={handleAddMemo}
                            disabled={isSubmitting || !newMemoContent.trim()}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                          >
                            {isSubmitting ? '...' : '追加'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setShowAddForm(false); setNewMemoContent('') }}
                            className="text-xs"
                          >
                            キャンセル
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddForm(true)}
                        className="w-full text-xs"
                      >
                        + リマインダー追加
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-stone-50">
                  <CardContent className="pt-6 text-center">
                    <p className="text-sm text-stone-400">
                      カレンダーの日付をクリックすると<br />詳細が表示されます
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
