'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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
                    }`}
                    onClick={() => setSelectedId(story.id)}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
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
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
