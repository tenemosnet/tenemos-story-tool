'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'

type Story = {
  id: string
  theme: string
  tone: string
  title: string
  body: string
  hashtags: string[]
  length_setting: number | null
  product_id: string | null
  created_at: string
}

const TONE_EMOJI: Record<string, string> = {
  'やさしい': '🌿',
  'gentle': '🌿',
  '専門的': '📖',
  'expert': '📖',
  'カジュアル': '✨',
  'casual': '✨',
}

const PRESET_THEMES = ['自然の仕組み', '暮らしのヒント', '季節ネタ', 'お客様の声', 'テネモス哲学', '新商品・キャンペーン']

function isCustomTheme(theme: string): boolean {
  return !PRESET_THEMES.includes(theme)
}

export default function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toneFilter, setToneFilter] = useState<string>('all')
  const [deleteMode, setDeleteMode] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const res = await fetch('/api/stories')
        if (res.ok) {
          setStories(await res.json())
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetchStories()
  }, [])

  const selectedStory = stories.find(s => s.id === selectedId)

  // トーン別の件数
  const toneCounts = stories.reduce((acc, s) => {
    acc[s.tone] = (acc[s.tone] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const filteredStories = toneFilter === 'all'
    ? stories
    : stories.filter(s => s.tone === toneFilter)

  // メール通信原稿状態
  const [mailResult, setMailResult] = useState<{ subject: string; body: string; summary: string } | null>(null)
  const [mailGenerating, setMailGenerating] = useState(false)
  const [mailNotes, setMailNotes] = useState('')
  const [mailEditingSubject, setMailEditingSubject] = useState('')
  const [mailEditingBody, setMailEditingBody] = useState('')
  const [mailTargetId, setMailTargetId] = useState<string | null>(null)

  // ストーリー選択時にメール通信状態をリセット
  useEffect(() => {
    setMailResult(null)
    setMailNotes('')
    setMailTargetId(null)
    setMailStockSaved(false)
  }, [selectedId])

  const handleGenerateMail = async (story: Story) => {
    setMailGenerating(true)
    setMailTargetId(story.id)
    try {
      const res = await fetch('/api/generate-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: story.theme,
          tone: story.tone,
          storyTitle: story.title,
          storyBody: story.body,
          additionalNotes: mailNotes,
        }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'メール通信生成に失敗しました')
      }
      const data = await res.json()
      setMailResult(data)
      setMailEditingSubject(data.subject)
      setMailEditingBody(data.body)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'メール通信生成に失敗しました')
    } finally {
      setMailGenerating(false)
    }
  }

  const [mailStockSaved, setMailStockSaved] = useState(false)

  const handleSaveMailToStock = async () => {
    if (!mailResult) return
    try {
      const res = await fetch('/api/finished-contents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: mailEditingSubject,
          body: mailEditingBody,
          type: 'email',
        }),
      })
      if (!res.ok) throw new Error('保存失敗')
      setMailStockSaved(true)
    } catch {
      alert('ストックへの保存に失敗しました')
    }
  }

  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDelete = async () => {
    if (checkedIds.size === 0) return
    if (!confirm(`${checkedIds.size}件のストーリーを削除しますか？`)) return
    setDeleting(true)
    try {
      const res = await fetch('/api/stories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(checkedIds) }),
      })
      if (!res.ok) throw new Error()
      setStories(prev => prev.filter(s => !checkedIds.has(s.id)))
      if (selectedId && checkedIds.has(selectedId)) setSelectedId(null)
      setCheckedIds(new Set())
      setDeleteMode(false)
    } catch {
      alert('削除に失敗しました')
    } finally {
      setDeleting(false)
    }
  }

  const handleCopy = async (story: Story) => {
    const text = `${story.title}\n\n${story.body}\n\n${story.hashtags.map(t => `#${t}`).join(' ')}`
    await navigator.clipboard.writeText(text)
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <a href="/" className="text-stone-400 hover:text-stone-600 text-sm">← ダッシュボード</a>
          <h1 className="text-xl font-bold text-stone-800">生成履歴</h1>
          <span className="text-sm text-stone-400">{stories.length}件</span>
          <div className="ml-auto flex items-center gap-2">
            {deleteMode ? (
              <>
                <span className="text-sm text-red-600">{checkedIds.size}件選択中</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                  disabled={checkedIds.size === 0 || deleting}
                  onClick={handleDelete}
                >
                  {deleting ? '削除中...' : '🗑 削除'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setDeleteMode(false); setCheckedIds(new Set()) }}
                >
                  キャンセル
                </Button>
              </>
            ) : (
              stories.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-stone-500"
                  onClick={() => setDeleteMode(true)}
                >
                  選択して削除
                </Button>
              )
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {loading ? (
          <div className="text-center py-12 text-stone-400">読み込み中...</div>
        ) : stories.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">✍️</div>
            <p className="text-stone-500">生成済みストーリーはありません</p>
            <a href="/generate" className="inline-block mt-4 text-green-700 hover:text-green-800 text-sm font-medium">
              → ストーリーを生成する
            </a>
          </div>
        ) : (
          <div className="flex gap-6">
            {/* 左側：リスト */}
            <div className="w-full md:w-2/5 space-y-3">
              {/* トーンフィルター */}
              <div className="flex flex-wrap gap-2 mb-2">
                <Button
                  variant={toneFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setToneFilter('all')}
                >
                  すべて ({stories.length})
                </Button>
                {Object.entries(toneCounts).map(([tone, count]) => (
                  <Button
                    key={tone}
                    variant={toneFilter === tone ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setToneFilter(tone)}
                  >
                    {TONE_EMOJI[tone] || ''} {tone} ({count})
                  </Button>
                ))}
              </div>

              {/* ストーリーリスト */}
              <div className="space-y-2">
                {filteredStories.map(story => (
                  <Card
                    key={story.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedId === story.id
                        ? 'ring-2 ring-green-500 border-green-300'
                        : ''
                    } ${checkedIds.has(story.id) ? 'bg-red-50 border-red-200' : ''}`}
                    onClick={() => {
                      if (deleteMode) {
                        toggleCheck(story.id)
                      } else {
                        setSelectedId(story.id)
                      }
                    }}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {deleteMode && (
                          <input
                            type="checkbox"
                            checked={checkedIds.has(story.id)}
                            onChange={() => toggleCheck(story.id)}
                            onClick={e => e.stopPropagation()}
                            className="w-4 h-4 rounded border-stone-300 text-red-600 focus:ring-red-500 shrink-0"
                          />
                        )}
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {TONE_EMOJI[story.tone] || ''} {story.tone}
                        </Badge>
                        {isCustomTheme(story.theme) ? (
                          <Badge className="text-xs shrink-0 bg-violet-100 text-violet-800">
                            🎨 カスタム
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {story.theme}
                          </Badge>
                        )}
                      </div>
                      {isCustomTheme(story.theme) && (
                        <p className="text-xs text-violet-600 mb-1 truncate" title={story.theme}>
                          テーマ: {story.theme}
                        </p>
                      )}
                      <p className="text-sm font-medium text-stone-800 truncate">
                        {story.title}
                      </p>
                      <p className="text-xs text-stone-400 mt-1">
                        {new Date(story.created_at).toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* 右側：詳細表示 */}
            <div className="hidden md:block md:w-3/5">
              {selectedStory ? (
                <Card className="sticky top-6">
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">
                          {TONE_EMOJI[selectedStory.tone] || ''} {selectedStory.tone}
                        </Badge>
                        {isCustomTheme(selectedStory.theme) ? (
                          <Badge className="bg-violet-100 text-violet-800">
                            🎨 カスタム
                          </Badge>
                        ) : (
                          <Badge variant="outline">{selectedStory.theme}</Badge>
                        )}
                      </div>
                      <span className="text-xs text-stone-400">
                        {new Date(selectedStory.created_at).toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {isCustomTheme(selectedStory.theme) && (
                      <p className="text-sm text-violet-600 mt-1">テーマ: {selectedStory.theme}</p>
                    )}
                    <CardTitle className="text-lg mt-2">{selectedStory.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">
                      {selectedStory.body}
                    </p>

                    {selectedStory.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedStory.hashtags.map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">#{tag}</Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={() => handleCopy(selectedStory)}>
                        コピー
                      </Button>
                      <a href={`/generate?theme=${encodeURIComponent(selectedStory.theme)}&tone=${encodeURIComponent(selectedStory.tone)}`}>
                        <Button variant="outline" size="sm">
                          この設定で再生成
                        </Button>
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-green-300 text-green-700 hover:bg-green-50"
                        onClick={() => {
                          sessionStorage.setItem('referenceBody', selectedStory.body)
                          window.location.href = `/generate?theme=${encodeURIComponent(selectedStory.theme)}&tone=${encodeURIComponent(selectedStory.tone)}&ref=story`
                        }}
                      >
                        この文体で再生成
                      </Button>
                    </div>

                    {/* メール通信原稿生成 */}
                    <div className="border-t pt-4 mt-4">
                      <h3 className="text-sm font-medium text-purple-700 mb-2">📧 メール通信原稿を作成</h3>
                      <p className="text-xs text-stone-400 mb-3">このストーリーをベースに、テネモス通信（メルマガ）の原稿たたき台を生成します</p>

                      {!mailResult || mailTargetId !== selectedStory.id ? (
                        <div className="space-y-2">
                          <Textarea
                            placeholder="追加の指示・要望（任意）例：GW休業案内を入れて"
                            value={mailNotes}
                            onChange={e => setMailNotes(e.target.value)}
                            rows={2}
                          />
                          <Button
                            onClick={() => handleGenerateMail(selectedStory)}
                            disabled={mailGenerating}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                          >
                            {mailGenerating && mailTargetId === selectedStory.id ? (
                              <span className="animate-pulse">メール通信原稿を生成中...</span>
                            ) : (
                              '📧 メール通信原稿を生成'
                            )}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <div className="text-xs text-stone-500 mb-1">件名</div>
                            <input
                              type="text"
                              value={mailEditingSubject}
                              onChange={e => setMailEditingSubject(e.target.value)}
                              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-300"
                            />
                          </div>
                          <div>
                            <div className="text-xs text-stone-500 mb-1">本文</div>
                            <Textarea
                              value={mailEditingBody}
                              onChange={e => setMailEditingBody(e.target.value)}
                              rows={12}
                              className="resize-y text-sm leading-relaxed"
                            />
                            <div className="flex justify-between mt-1 text-xs text-stone-400">
                              <span>{mailEditingBody.length}文字</span>
                              {mailEditingBody !== mailResult.body && (
                                <span className="text-amber-500">編集済み</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                await navigator.clipboard.writeText(`${mailEditingSubject}\n\n${mailEditingBody}`)
                              }}
                            >
                              📋 全体コピー
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-purple-200 text-purple-700 hover:bg-purple-50"
                              onClick={handleSaveMailToStock}
                            >
                              📝 ストックに保存
                            </Button>
                            {mailStockSaved && (
                              <a href="/calendar#stock" className="inline-flex items-center text-xs font-medium text-purple-600 hover:text-purple-800">
                                ✓ 保存済み → 一覧を見る
                              </a>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setMailResult(null); setMailTargetId(null); setMailStockSaved(false) }}
                            >
                              🔄 再生成
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex items-center justify-center h-64 text-stone-400 text-sm">
                  左のリストからストーリーを選んでください
                </div>
              )}
            </div>
          </div>
        )}

        {/* モバイル：選択時のモーダル風表示 */}
        {selectedStory && (
          <div className="md:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setSelectedId(null)}>
            <div
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-xl max-h-[80vh] overflow-y-auto p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">
                    {TONE_EMOJI[selectedStory.tone] || ''} {selectedStory.tone}
                  </Badge>
                  {isCustomTheme(selectedStory.theme) ? (
                    <Badge className="bg-violet-100 text-violet-800">
                      🎨 カスタム
                    </Badge>
                  ) : (
                    <Badge variant="outline">{selectedStory.theme}</Badge>
                  )}
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-stone-400 hover:text-stone-600 text-lg"
                >
                  ✕
                </button>
              </div>
              {isCustomTheme(selectedStory.theme) && (
                <p className="text-sm text-violet-600 mb-2">テーマ: {selectedStory.theme}</p>
              )}
              <h2 className="text-lg font-bold text-stone-800 mb-3">{selectedStory.title}</h2>
              <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed mb-4">
                {selectedStory.body}
              </p>
              {selectedStory.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {selectedStory.hashtags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">#{tag}</Badge>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => handleCopy(selectedStory)}>
                  コピー
                </Button>
                <a href={`/generate?theme=${encodeURIComponent(selectedStory.theme)}&tone=${encodeURIComponent(selectedStory.tone)}`}>
                  <Button variant="outline" size="sm">この設定で再生成</Button>
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-green-300 text-green-700 hover:bg-green-50"
                  onClick={() => {
                    sessionStorage.setItem('referenceBody', selectedStory.body)
                    window.location.href = `/generate?theme=${encodeURIComponent(selectedStory.theme)}&tone=${encodeURIComponent(selectedStory.tone)}&ref=story`
                  }}
                >
                  この文体で再生成
                </Button>
              </div>

              {/* メール通信原稿生成（モバイル） */}
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-medium text-purple-700 mb-2">📧 メール通信原稿を作成</h3>
                {!mailResult || mailTargetId !== selectedStory.id ? (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="追加の指示・要望（任意）"
                      value={mailNotes}
                      onChange={e => setMailNotes(e.target.value)}
                      rows={2}
                    />
                    <Button
                      onClick={() => handleGenerateMail(selectedStory)}
                      disabled={mailGenerating}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {mailGenerating && mailTargetId === selectedStory.id ? (
                        <span className="animate-pulse">生成中...</span>
                      ) : (
                        '📧 メール通信原稿を生成'
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-stone-500 mb-1">件名</div>
                      <input
                        type="text"
                        value={mailEditingSubject}
                        onChange={e => setMailEditingSubject(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-300"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-stone-500 mb-1">本文</div>
                      <Textarea
                        value={mailEditingBody}
                        onChange={e => setMailEditingBody(e.target.value)}
                        rows={10}
                        className="resize-y text-sm leading-relaxed"
                      />
                      <div className="text-xs text-stone-400 mt-1">{mailEditingBody.length}文字</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={async () => {
                        await navigator.clipboard.writeText(`${mailEditingSubject}\n\n${mailEditingBody}`)
                      }}>
                        📋 コピー
                      </Button>
                      <Button variant="outline" size="sm" className="border-purple-200 text-purple-700" onClick={handleSaveMailToStock}>
                        📝 ストックに保存
                      </Button>
                      {mailStockSaved && (
                        <a href="/calendar#stock" className="inline-flex items-center text-xs font-medium text-purple-600 hover:text-purple-800">
                          ✓ 保存済み → 一覧を見る
                        </a>
                      )}
                      <Button variant="outline" size="sm" onClick={() => { setMailResult(null); setMailTargetId(null); setMailStockSaved(false) }}>
                        🔄 再生成
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
