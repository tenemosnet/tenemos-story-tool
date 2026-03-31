'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const THEME_PRESETS = [
  { id: 'nature', label: '自然の仕組み', description: '水の循環、発酵の不思議、空気の力' },
  { id: 'lifestyle', label: '暮らしのヒント', description: 'マナウォーター活用術、酵素水の使い方' },
  { id: 'seasonal', label: '季節ネタ', description: '季節の養生、冬の乾燥対策' },
  { id: 'voice', label: 'お客様の声', description: '体験談・使い方アイデアの紹介' },
  { id: 'philosophy', label: 'テネモス哲学', description: '飯島先生の言葉' },
  { id: 'campaign', label: '新商品・キャンペーン', description: '新製品の紹介' },
]

const TONES = {
  gentle: { label: 'やさしい', emoji: '🌿' },
  expert: { label: '専門的', emoji: '📖' },
  casual: { label: 'カジュアル', emoji: '✨' },
} as const

type ToneKey = keyof typeof TONES

type StoryResult = {
  tone: string
  title: string
  body: string
  hashtags: string[]
  id?: string
  duration_ms?: number
  tokens_used?: number
}

export default function GeneratePage() {
  // 入力状態
  const [selectedTheme, setSelectedTheme] = useState('')
  const [customTheme, setCustomTheme] = useState('')
  const [length, setLength] = useState(400)
  const [product, setProduct] = useState('')

  // 生成結果
  const [results, setResults] = useState<Partial<Record<ToneKey, StoryResult>>>({})
  const [generating, setGenerating] = useState<ToneKey | null>(null)
  const [error, setError] = useState('')

  // 編集中の本文
  const [editingBody, setEditingBody] = useState<Partial<Record<ToneKey, string>>>({})

  // アクティブタブ
  const [activeTab, setActiveTab] = useState<ToneKey | ''>('')

  const theme = selectedTheme === 'custom' ? customTheme :
    THEME_PRESETS.find(t => t.id === selectedTheme)?.label || ''

  const handleGenerate = async (tone: ToneKey) => {
    if (!theme) {
      setError('配信テーマを選択してください')
      return
    }

    setError('')
    setGenerating(tone)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, length, product, tone }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || '生成に失敗しました')
      }

      const data = await res.json()
      setResults(prev => ({ ...prev, [tone]: data }))
      setEditingBody(prev => ({ ...prev, [tone]: data.body }))
      setActiveTab(tone)
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成に失敗しました')
    } finally {
      setGenerating(null)
    }
  }

  const handleCopy = async (tone: ToneKey) => {
    const body = editingBody[tone] || results[tone]?.body
    if (body) {
      await navigator.clipboard.writeText(body)
    }
  }

  const generatedTones = Object.keys(results) as ToneKey[]

  return (
    <div className="min-h-screen bg-stone-50">
      {/* ヘッダー */}
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <a href="/" className="text-stone-400 hover:text-stone-600 text-sm">← ダッシュボード</a>
          <h1 className="text-xl font-bold text-stone-800">ストーリー生成</h1>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 p-6 max-w-7xl mx-auto">
        {/* 左パネル：入力フォーム */}
        <div className="w-full lg:w-[360px] shrink-0 space-y-5">
          {/* テーマ選択 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-stone-600">配信テーマ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {THEME_PRESETS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedTheme(t.id); setCustomTheme('') }}
                    className={`text-left p-2.5 rounded-lg border text-sm transition-colors ${
                      selectedTheme === t.id
                        ? 'border-green-600 bg-green-50 text-green-800'
                        : 'border-stone-200 hover:border-stone-300 text-stone-600'
                    }`}
                  >
                    <div className="font-medium">{t.label}</div>
                    <div className="text-xs text-stone-400 mt-0.5">{t.description}</div>
                  </button>
                ))}
              </div>
              <div>
                <button
                  onClick={() => setSelectedTheme('custom')}
                  className={`w-full text-left p-2.5 rounded-lg border text-sm transition-colors ${
                    selectedTheme === 'custom'
                      ? 'border-green-600 bg-green-50'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  カスタムテーマ
                </button>
                {selectedTheme === 'custom' && (
                  <Textarea
                    placeholder="自由にテーマを入力..."
                    value={customTheme}
                    onChange={e => setCustomTheme(e.target.value)}
                    className="mt-2"
                    rows={2}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* 文字数目安 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-stone-600">文字数目安</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {[200, 400, 600].map(len => (
                  <button
                    key={len}
                    onClick={() => setLength(len)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      length === len
                        ? 'border-green-600 bg-green-50 text-green-800'
                        : 'border-stone-200 hover:border-stone-300 text-stone-600'
                    }`}
                  >
                    {len}字
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 商品選択 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-stone-600">強調商品（任意）</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="例：マナウォーター（活水器）"
                value={product}
                onChange={e => setProduct(e.target.value)}
                rows={1}
              />
            </CardContent>
          </Card>

          {/* トーン別生成ボタン */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-stone-600">トーンを選んで生成</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(Object.entries(TONES) as [ToneKey, typeof TONES[ToneKey]][]).map(([key, tone]) => (
                <Button
                  key={key}
                  onClick={() => handleGenerate(key)}
                  disabled={generating !== null}
                  variant={results[key] ? 'outline' : 'default'}
                  className={`w-full justify-start text-left h-auto py-3 ${
                    results[key]
                      ? 'border-green-200 text-green-700 hover:bg-green-50'
                      : 'bg-stone-800 hover:bg-stone-700'
                  }`}
                >
                  <span className="text-lg mr-2">{tone.emoji}</span>
                  <span className="font-medium">{tone.label}</span>
                  {generating === key && (
                    <span className="ml-auto text-xs animate-pulse">生成中...</span>
                  )}
                  {results[key] && !generating && (
                    <span className="ml-auto text-xs">✓ 生成済み</span>
                  )}
                </Button>
              ))}
            </CardContent>
          </Card>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* 右パネル：結果表示 */}
        <div className="flex-1 min-w-0">
          {generatedTones.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-stone-400">
              <div className="text-center">
                <div className="text-4xl mb-3">🌿</div>
                <p>左のフォームからテーマを選んで</p>
                <p>トーンボタンを押すと、ここに結果が表示されます</p>
              </div>
            </div>
          ) : (
            <Tabs value={activeTab || generatedTones[generatedTones.length - 1]} onValueChange={(v) => setActiveTab(v as ToneKey)}>
              <TabsList className="mb-4">
                {generatedTones.map(tone => (
                  <TabsTrigger key={tone} value={tone}>
                    {TONES[tone].emoji} {TONES[tone].label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {generatedTones.map(tone => {
                const result = results[tone]!
                const currentBody = editingBody[tone] || result.body

                return (
                  <TabsContent key={tone} value={tone} className="space-y-4">
                    {/* 結果カード */}
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{result.title}</CardTitle>
                          <div className="flex gap-2">
                            <Badge variant="secondary">
                              {TONES[tone].emoji} {result.tone}
                            </Badge>
                            {result.duration_ms && (
                              <Badge variant="outline">
                                {(result.duration_ms / 1000).toFixed(1)}秒
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* 編集可能な本文 */}
                        <div>
                          <Textarea
                            value={currentBody}
                            onChange={e => setEditingBody(prev => ({ ...prev, [tone]: e.target.value }))}
                            rows={8}
                            className="resize-y"
                          />
                          <div className="flex justify-between mt-1.5 text-xs text-stone-400">
                            <span>{currentBody.length}文字</span>
                            {currentBody !== result.body && (
                              <span className="text-amber-500">編集済み</span>
                            )}
                          </div>
                        </div>

                        {/* ハッシュタグ */}
                        <div className="flex flex-wrap gap-1.5">
                          {result.hashtags.map((tag, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              #{tag}
                            </Badge>
                          ))}
                        </div>

                        {/* アクションボタン */}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopy(tone)}
                          >
                            📋 本文コピー
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const text = `${result.title}\n\n${currentBody}\n\n${result.hashtags.map(t => `#${t}`).join(' ')}`
                              await navigator.clipboard.writeText(text)
                            }}
                          >
                            📄 全体コピー
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* LINEプレビュー */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-stone-600">LINEプレビュー</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-[#7B9B8A] rounded-2xl p-4 max-w-sm">
                          <div className="flex gap-2.5">
                            {/* アイコン */}
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xs font-bold text-green-700 shrink-0">
                              TN
                            </div>
                            {/* 吹き出し */}
                            <div>
                              <div className="text-xs text-white/80 mb-1">テネモスのお店</div>
                              <div className="bg-white rounded-2xl rounded-tl-sm p-3 text-sm leading-relaxed text-stone-700 whitespace-pre-wrap">
                                <div className="font-bold mb-2">{result.title}</div>
                                {currentBody}
                                <div className="mt-2 text-xs text-stone-400">
                                  {result.hashtags.map(t => `#${t}`).join(' ')}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                )
              })}
            </Tabs>
          )}
        </div>
      </div>
    </div>
  )
}
