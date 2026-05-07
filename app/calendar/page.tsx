'use client'

import { useState, useEffect, useCallback, DragEvent } from 'react'
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

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const startWeekday = firstDay.getDay()

  const days: (number | null)[] = []
  for (let i = 0; i < startWeekday; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d)
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
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')

  // メール通信ストック
  const [mailStocks, setMailStocks] = useState<FinishedContent[]>([])
  const [editingStock, setEditingStock] = useState<string | null>(null)
  const [stockEditTitle, setStockEditTitle] = useState('')
  const [stockEditBody, setStockEditBody] = useState('')
  const [stockScheduleDate, setStockScheduleDate] = useState('')

  // ブログ記事ストック
  type BlogStockItem = { id: string; title: string; body: string; article_type: string | null; output_format: string; scheduled_date: string | null; is_done: boolean }
  const [blogStocks, setBlogStocks] = useState<BlogStockItem[]>([])
  const [editingBlogStock, setEditingBlogStock] = useState<string | null>(null)
  const [blogStockEditTitle, setBlogStockEditTitle] = useState('')
  const [blogStockEditBody, setBlogStockEditBody] = useState('')
  const [blogStockScheduleDate, setBlogStockScheduleDate] = useState('')

  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  const todayStr = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate())

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [memosRes, contentsRes, stockRes, blogStockRes] = await Promise.all([
        fetch(`/api/task-memos?include_done=false`),
        fetch(`/api/finished-contents?month=${monthStr}&include_done=false`),
        fetch(`/api/finished-contents?unscheduled=true`),
        fetch(`/api/blog-stocks?unscheduled=true`),
      ])
      if (memosRes.ok) {
        const allMemos: TaskMemo[] = await memosRes.json()
        setMemos(allMemos.filter(m => m.display_date.startsWith(monthStr)))
      }
      if (contentsRes.ok) {
        setContents(await contentsRes.json())
      }
      if (stockRes.ok) {
        setMailStocks(await stockRes.json())
      }
      if (blogStockRes.ok) {
        setBlogStocks(await blogStockRes.json())
      }
    } catch (error) {
      console.error('カレンダーデータ取得エラー:', error)
    } finally {
      setIsLoading(false)
    }
  }, [monthStr])

  useEffect(() => { fetchData() }, [fetchData])

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) } else { setMonth(m => m - 1) }
    setSelectedDate(null)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) } else { setMonth(m => m + 1) }
    setSelectedDate(null)
  }
  const goToday = () => {
    setYear(today.getFullYear())
    setMonth(today.getMonth() + 1)
    setSelectedDate(todayStr)
  }

  const getDayData = (day: number) => {
    const dateStr = toDateStr(year, month, day)
    return {
      memos: memos.filter(m => m.display_date === dateStr),
      contents: contents.filter(c => c.scheduled_date === dateStr),
    }
  }

  // ========== ドラッグ＆ドロップ ==========

  const handleDragStart = (e: DragEvent, type: 'line' | 'email') => {
    e.dataTransfer.setData('delivery-type', type)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDragOver = (e: DragEvent, dateStr: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOverDate(dateStr)
  }

  const handleDragLeave = () => {
    setDragOverDate(null)
  }

  const handleDrop = async (e: DragEvent, dateStr: string) => {
    e.preventDefault()
    setDragOverDate(null)
    const type = e.dataTransfer.getData('delivery-type') as 'line' | 'email'
    if (!type) return

    const label = type === 'line' ? 'LINE配信' : 'メルマガ配信'
    try {
      const res = await fetch('/api/finished-contents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${label}予定`,
          body: '',
          type,
          scheduled_date: dateStr,
        }),
      })
      if (res.ok) {
        fetchData()
        setSelectedDate(dateStr)
      }
    } catch (error) {
      console.error('配信予定登録エラー:', error)
    }
  }

  // ========== リマインダー操作 ==========

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

  // ========== 配信予定操作 ==========

  const handleDeleteContent = async (id: string) => {
    if (!confirm('この配信予定を削除しますか？')) return
    try {
      await fetch('/api/finished-contents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setEditingContent(null)
      fetchData()
    } catch (error) {
      console.error('削除エラー:', error)
    }
  }

  const handleDoneContent = async (id: string) => {
    try {
      await fetch('/api/finished-contents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_done: true }),
      })
      fetchData()
    } catch (error) {
      console.error('完了エラー:', error)
    }
  }

  const startEditContent = (c: FinishedContent) => {
    setEditingContent(c.id)
    setEditTitle(c.title)
    setEditBody(c.body)
  }

  const handleSaveContent = async (id: string) => {
    try {
      await fetch('/api/finished-contents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title: editTitle, body: editBody }),
      })
      setEditingContent(null)
      fetchData()
    } catch (error) {
      console.error('更新エラー:', error)
    }
  }

  // ========== ストック操作 ==========

  const startEditStock = (s: FinishedContent) => {
    setEditingStock(s.id)
    setStockEditTitle(s.title)
    setStockEditBody(s.body)
    setStockScheduleDate('')
  }

  const handleSaveStock = async (id: string) => {
    try {
      const updates: Record<string, unknown> = { id, title: stockEditTitle, body: stockEditBody }
      if (stockScheduleDate) {
        updates.scheduled_date = stockScheduleDate
      }
      await fetch('/api/finished-contents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      setEditingStock(null)
      fetchData()
    } catch (error) {
      console.error('ストック更新エラー:', error)
    }
  }

  const handleDeleteStock = async (id: string) => {
    if (!confirm('このストックを削除しますか？')) return
    try {
      await fetch('/api/finished-contents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setEditingStock(null)
      fetchData()
    } catch (error) {
      console.error('ストック削除エラー:', error)
    }
  }

  // ========== ブログ記事ストック操作 ==========

  const startEditBlogStock = (s: BlogStockItem) => {
    setEditingBlogStock(s.id)
    setBlogStockEditTitle(s.title)
    setBlogStockEditBody(s.body)
    setBlogStockScheduleDate('')
  }

  const handleSaveBlogStock = async (id: string) => {
    try {
      const updates: Record<string, unknown> = { title: blogStockEditTitle, body: blogStockEditBody }
      if (blogStockScheduleDate) {
        updates.scheduled_date = blogStockScheduleDate
      }
      await fetch(`/api/blog-stocks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      setEditingBlogStock(null)
      fetchData()
    } catch (error) {
      console.error('ブログストック更新エラー:', error)
    }
  }

  const handleDeleteBlogStock = async (id: string) => {
    if (!confirm('このブログ記事ストックを削除しますか？')) return
    try {
      await fetch(`/api/blog-stocks/${id}`, {
        method: 'DELETE',
      })
      setEditingBlogStock(null)
      fetchData()
    } catch (error) {
      console.error('ブログストック削除エラー:', error)
    }
  }

  // ========== レンダリング ==========

  const days = getMonthDays(year, month)
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']

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
            <h2 className="text-lg font-bold text-stone-800">{year}年{month}月</h2>
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
                      const isDragOver = dateStr === dragOverDate
                      const weekday = (idx % 7)
                      const totalItems = dayData.memos.length + dayData.contents.length

                      return (
                        <div
                          key={day}
                          onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                          onDragOver={(e) => handleDragOver(e, dateStr)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, dateStr)}
                          className={`h-20 border text-left p-1 transition-all relative cursor-pointer select-none
                            ${isSelected ? 'border-blue-400 bg-blue-50' : 'border-stone-100 hover:bg-stone-50'}
                            ${isToday && !isSelected ? 'bg-amber-50/50' : ''}
                            ${isDragOver ? 'border-2 border-dashed border-green-400 bg-green-50/50 scale-[1.02]' : ''}
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
                            {dayData.contents.slice(0, 2).map(c => (
                              <div
                                key={c.id}
                                className={`text-[10px] leading-tight px-1 rounded truncate ${
                                  c.type === 'line'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-purple-100 text-purple-700'
                                }`}
                              >
                                {c.type === 'line' ? '🟢 LINE' : '🟣 メール'} {c.title !== `${c.type === 'line' ? 'LINE配信' : 'メルマガ配信'}予定` ? c.title : ''}
                              </div>
                            ))}
                            {dayData.memos.slice(0, Math.max(0, 2 - dayData.contents.length)).map(m => (
                              <div
                                key={m.id}
                                className="text-[10px] leading-tight px-1 rounded bg-amber-100 text-amber-700 truncate"
                              >
                                📋 {m.content}
                              </div>
                            ))}
                          </div>

                          {totalItems > 2 && (
                            <div className="absolute bottom-0.5 right-1 text-[10px] text-stone-400">
                              +{totalItems - 2}
                            </div>
                          )}

                          {/* ドロップヒント */}
                          {isDragOver && (
                            <div className="absolute inset-0 flex items-center justify-center bg-green-50/80 rounded pointer-events-none">
                              <span className="text-xs font-medium text-green-600">ここに配置</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* ドラッグアイコン + 凡例 */}
              <div className="mt-3 p-3 bg-white rounded-lg border border-stone-200">
                <p className="text-xs text-stone-400 mb-2">↕ 下のアイコンをカレンダーの日付にドラッグして配信予定を配置</p>
                <div className="flex gap-3">
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'line')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-green-300 bg-green-50 cursor-grab active:cursor-grabbing hover:border-green-400 hover:bg-green-100 transition-colors select-none"
                  >
                    <span className="text-lg">🟢</span>
                    <span className="text-sm font-medium text-green-700">LINE配信</span>
                  </div>
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'email')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50 cursor-grab active:cursor-grabbing hover:border-purple-400 hover:bg-purple-100 transition-colors select-none"
                  >
                    <span className="text-lg">🟣</span>
                    <span className="text-sm font-medium text-purple-700">メルマガ配信</span>
                  </div>
                </div>
              </div>

              {/* メール通信ストック */}
              <div id="stock">
              {mailStocks.length > 0 ? (
                <Card className="mt-3 border-purple-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-purple-700">
                      📝 メール通信ストック <span className="text-xs font-normal text-stone-400">({mailStocks.length}件)</span>
                    </CardTitle>
                    <p className="text-xs text-stone-400">日付未設定の原稿。編集して配信予定に移動できます</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {mailStocks.map(s => (
                      <div key={s.id} className="p-3 rounded-lg border border-purple-100 bg-purple-50/30 space-y-2 group">
                        {editingStock === s.id ? (
                          // 編集モード
                          <div className="space-y-2">
                            <input
                              value={stockEditTitle}
                              onChange={(e) => setStockEditTitle(e.target.value)}
                              placeholder="件名"
                              className="w-full text-sm rounded border border-stone-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-300"
                            />
                            <textarea
                              value={stockEditBody}
                              onChange={(e) => setStockEditBody(e.target.value)}
                              placeholder="本文"
                              rows={6}
                              className="w-full text-sm rounded border border-stone-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-y"
                            />
                            <div className="text-xs text-stone-400 text-right">{stockEditBody.length}文字</div>
                            <div>
                              <div className="text-xs text-stone-500 mb-1">配信予定日を設定（任意：設定するとカレンダーに表示）</div>
                              <input
                                type="date"
                                value={stockScheduleDate}
                                onChange={(e) => setStockScheduleDate(e.target.value)}
                                className="text-sm rounded border border-stone-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-300"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveStock(s.id)}
                                className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
                              >
                                {stockScheduleDate ? '保存して配信予定に移動' : '保存'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingStock(null)}
                                className="text-xs"
                              >
                                キャンセル
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // 表示モード
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-medium text-stone-700 line-clamp-1">{s.title}</span>
                              <span className="text-xs text-purple-400 shrink-0">🟣 メール</span>
                            </div>
                            {s.body && (
                              <p className="text-xs text-stone-500 line-clamp-2">{s.body}</p>
                            )}
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => startEditStock(s)}
                                className="text-xs text-purple-500 hover:text-purple-700"
                              >
                                ✏️ 編集・日付設定
                              </button>
                              <button
                                onClick={async () => {
                                  await navigator.clipboard.writeText(`${s.title}\n\n${s.body}`)
                                }}
                                className="text-xs text-stone-400 hover:text-stone-600"
                              >
                                📋 コピー
                              </button>
                              <button
                                onClick={() => handleDeleteStock(s.id)}
                                className="text-xs text-red-400 hover:text-red-600"
                              >
                                ✕ 削除
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <Card className="mt-3 border-dashed border-purple-200 bg-purple-50/20">
                  <CardContent className="pt-4 pb-4 text-center">
                    <p className="text-sm text-purple-400">📝 メール通信ストックはまだありません</p>
                    <p className="text-xs text-stone-400 mt-1">ストーリー生成 → メール通信原稿作成 → ストックに保存</p>
                  </CardContent>
                </Card>
              )}
              </div>

              {/* ブログ記事ストック */}
              <div id="blog-stock">
              {blogStocks.length > 0 ? (
                <Card className="mt-3 border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-blue-700">
                      📰 ブログ記事ストック <span className="text-xs font-normal text-stone-400">({blogStocks.length}件)</span>
                    </CardTitle>
                    <p className="text-xs text-stone-400">日付未設定のブログ記事原稿。編集して配信予定に移動できます</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {blogStocks.map(s => (
                      <div key={s.id} className="p-3 rounded-lg border border-blue-100 bg-blue-50/30 space-y-2 group">
                        {editingBlogStock === s.id ? (
                          <div className="space-y-2">
                            <input
                              value={blogStockEditTitle}
                              onChange={(e) => setBlogStockEditTitle(e.target.value)}
                              placeholder="タイトル"
                              className="w-full text-sm rounded border border-stone-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                            <textarea
                              value={blogStockEditBody}
                              onChange={(e) => setBlogStockEditBody(e.target.value)}
                              placeholder="本文"
                              rows={6}
                              className="w-full text-sm rounded border border-stone-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y"
                            />
                            <div className="text-xs text-stone-400 text-right">{blogStockEditBody.length}文字</div>
                            <div>
                              <div className="text-xs text-stone-500 mb-1">投稿予定日を設定（任意：設定するとカレンダーに表示）</div>
                              <input
                                type="date"
                                value={blogStockScheduleDate}
                                onChange={(e) => setBlogStockScheduleDate(e.target.value)}
                                className="text-sm rounded border border-stone-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveBlogStock(s.id)}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                              >
                                {blogStockScheduleDate ? '保存して投稿予定に移動' : '保存'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingBlogStock(null)}
                                className="text-xs"
                              >
                                キャンセル
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-medium text-stone-700 line-clamp-1">{s.title}</span>
                              <span className="text-xs text-blue-400 shrink-0">📰 ブログ</span>
                            </div>
                            {s.body && (
                              <p className="text-xs text-stone-500 line-clamp-2">{s.body}</p>
                            )}
                            <div className="flex gap-2 pt-1">
                              <a
                                href={`/blog-stocks/${s.id}`}
                                className="text-xs text-green-600 hover:text-green-800"
                              >
                                詳細を表示 →
                              </a>
                              <button
                                onClick={() => startEditBlogStock(s)}
                                className="text-xs text-blue-500 hover:text-blue-700"
                              >
                                ✏️ 編集・日付設定
                              </button>
                              <button
                                onClick={async () => {
                                  await navigator.clipboard.writeText(`${s.title}\n\n${s.body}`)
                                }}
                                className="text-xs text-stone-400 hover:text-stone-600"
                              >
                                📋 コピー
                              </button>
                              <button
                                onClick={() => handleDeleteBlogStock(s.id)}
                                className="text-xs text-red-400 hover:text-red-600"
                              >
                                ✕ 削除
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <Card className="mt-3 border-dashed border-blue-200 bg-blue-50/20">
                  <CardContent className="pt-4 pb-4 text-center">
                    <p className="text-sm text-blue-400">📰 ブログ記事ストックはまだありません</p>
                    <p className="text-xs text-stone-400 mt-1">ストーリー生成 → ブログ記事原稿作成 → ストックに保存</p>
                  </CardContent>
                </Card>
              )}
              </div>
            </div>

            {/* サイドパネル */}
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
                          <div key={c.id} className="p-2 rounded border border-stone-100 space-y-2 group">
                            {editingContent === c.id ? (
                              // 編集モード
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                                    c.type === 'line' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                                  }`}>
                                    {c.type === 'line' ? 'LINE' : 'メール'}
                                  </span>
                                </div>
                                <input
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  placeholder="タイトル"
                                  className="w-full text-sm rounded border border-stone-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                />
                                <textarea
                                  value={editBody}
                                  onChange={(e) => setEditBody(e.target.value)}
                                  placeholder="配信内容（あとで入力してもOK）"
                                  rows={4}
                                  className="w-full text-sm rounded border border-stone-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveContent(c.id)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                                  >
                                    保存
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setEditingContent(null)}
                                    className="text-xs"
                                  >
                                    キャンセル
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              // 表示モード
                              <>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                                    c.type === 'line' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                                  }`}>
                                    {c.type === 'line' ? 'LINE' : 'メール'}
                                  </span>
                                  <span className="text-sm font-medium text-stone-700 flex-1">{c.title}</span>
                                </div>
                                {c.body && (
                                  <p className="text-xs text-stone-500 whitespace-pre-wrap">{c.body}</p>
                                )}
                                {!c.body && (
                                  <p className="text-xs text-stone-300 italic">内容未設定（クリックで編集）</p>
                                )}
                                <div className="flex gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => startEditContent(c)}
                                    className="text-xs text-blue-500 hover:text-blue-700"
                                  >
                                    ✏️ 編集
                                  </button>
                                  <button
                                    onClick={() => handleDoneContent(c.id)}
                                    className="text-xs text-green-500 hover:text-green-700"
                                  >
                                    ✓ 完了
                                  </button>
                                  <button
                                    onClick={() => handleDeleteContent(c.id)}
                                    className="text-xs text-red-400 hover:text-red-600"
                                  >
                                    ✕ 削除
                                  </button>
                                </div>
                              </>
                            )}
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
                    <p className="text-xs text-stone-300 mt-3">
                      下のアイコンを日付にドラッグ＆ドロップで<br />配信予定を配置できます
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
