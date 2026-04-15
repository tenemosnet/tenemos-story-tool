'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
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
  return (
    <Suspense>
      <GeneratePageContent />
    </Suspense>
  )
}

function GeneratePageContent() {
  const searchParams = useSearchParams()

  // 入力状態
  const [selectedTheme, setSelectedTheme] = useState('')
  const [customTheme, setCustomTheme] = useState('')
  const [length, setLength] = useState(400)
  const [product, setProduct] = useState('')

  // 参考原稿（テンプレート/履歴から引き継ぎ）
  const [referenceBody, setReferenceBody] = useState<string | null>(null)

  // URLクエリパラメータからテーマ・参考原稿を引き継ぎ
  useEffect(() => {
    const themeParam = searchParams.get('theme')
    if (themeParam) {
      const preset = THEME_PRESETS.find(t => t.label === themeParam)
      if (preset) {
        setSelectedTheme(preset.id)
      } else {
        setSelectedTheme('custom')
        setCustomTheme(themeParam)
      }
    }
    // sessionStorageから参考原稿を取得
    const ref = searchParams.get('ref')
    if (ref) {
      const stored = sessionStorage.getItem('referenceBody')
      if (stored) {
        setReferenceBody(stored)
        sessionStorage.removeItem('referenceBody')
      }
    }
  }, [searchParams])

  // 生成結果
  const [results, setResults] = useState<Partial<Record<ToneKey, StoryResult>>>({})
  const [generating, setGenerating] = useState<ToneKey | null>(null)
  const [error, setError] = useState('')

  // 編集中の本文
  const [editingBody, setEditingBody] = useState<Partial<Record<ToneKey, string>>>({})

  // アクティブタブ
  const [activeTab, setActiveTab] = useState<ToneKey | ''>('')

  // フィードバック状態
  const [feedbackOpen, setFeedbackOpen] = useState<Partial<Record<ToneKey, boolean>>>({})
  const [feedbackRating, setFeedbackRating] = useState<Partial<Record<ToneKey, string>>>({})
  const [feedbackComment, setFeedbackComment] = useState<Partial<Record<ToneKey, string>>>({})
  const [feedbackSent, setFeedbackSent] = useState<Partial<Record<ToneKey, boolean>>>({})
  const [feedbackSending, setFeedbackSending] = useState(false)

  // テンプレート保存状態
  const [templateSaved, setTemplateSaved] = useState<Partial<Record<ToneKey, boolean>>>({})
  const [templateSaving, setTemplateSaving] = useState(false)

  // メール通信原稿状態
  const [mailResult, setMailResult] = useState<Partial<Record<ToneKey, { subject: string; body: string; summary: string; duration_ms: number; tokens_used: number }>>>({})
  const [mailGenerating, setMailGenerating] = useState<ToneKey | null>(null)
  const [mailAdditionalNotes, setMailAdditionalNotes] = useState<Partial<Record<ToneKey, string>>>({})
  const [mailEditingBody, setMailEditingBody] = useState<Partial<Record<ToneKey, string>>>({})
  const [mailEditingSubject, setMailEditingSubject] = useState<Partial<Record<ToneKey, string>>>({})

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
        body: JSON.stringify({ theme, length, product, tone, referenceBody: referenceBody || undefined }),
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

  const handleFeedback = async (tone: ToneKey) => {
    const result = results[tone]
    if (!result?.id) return

    setFeedbackSending(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: result.id,
          rating: feedbackRating[tone] || 'good',
          comment: feedbackComment[tone] || '',
          originalBody: result.body,
          editedBody: editingBody[tone] || result.body,
        }),
      })

      if (!res.ok) throw new Error('送信失敗')
      setFeedbackSent(prev => ({ ...prev, [tone]: true }))
    } catch {
      setError('フィードバックの送信に失敗しました')
    } finally {
      setFeedbackSending(false)
    }
  }

  const handleSaveTemplate = async (tone: ToneKey) => {
    const result = results[tone]
    if (!result) return

    setTemplateSaving(true)
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: result.title,
          theme,
          tone: result.tone || TONES[tone].label,
          body: editingBody[tone] || result.body,
          hashtags: result.hashtags,
        }),
      })

      if (!res.ok) throw new Error('保存失敗')
      setTemplateSaved(prev => ({ ...prev, [tone]: true }))
    } catch {
      setError('テンプレートの保存に失敗しました')
    } finally {
      setTemplateSaving(false)
    }
  }

  const handleGenerateMail = async (tone: ToneKey) => {
    const result = results[tone]
    if (!result) return

    setMailGenerating(tone)
    try {
      const res = await fetch('/api/generate-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme,
          product,
          tone: TONES[tone].label,
          storyTitle: result.title,
          storyBody: editingBody[tone] || result.body,
          additionalNotes: mailAdditionalNotes[tone] || '',
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'メール通信生成に失敗しました')
      }

      const data = await res.json()
      setMailResult(prev => ({ ...prev, [tone]: data }))
      setMailEditingBody(prev => ({ ...prev, [tone]: data.body }))
      setMailEditingSubject(prev => ({ ...prev, [tone]: data.subject }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'メール通信生成に失敗しました')
    } finally {
      setMailGenerating(null)
    }
  }

  const handleSaveMailToSchedule = async (tone: ToneKey) => {
    const mail = mailResult[tone]
    if (!mail) return

    try {
      const subject = mailEditingSubject[tone] || mail.subject
      const body = mailEditingBody[tone] || mail.body
      const res = await fetch('/api/finished-contents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: subject,
          body: body,
          type: 'mail',
        }),
      })

      if (!res.ok) throw new Error('保存失敗')
      alert('配信予定に保存しました！カレンダーから日付を設定できます。')
    } catch {
      setError('配信予定への保存に失敗しました')
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

          {/* 参考原稿の表示 */}
          {referenceBody && (
            <Card className="border-green-200 bg-green-50/30">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-green-700">📝 参考原稿を使用中</span>
                  <button
                    onClick={() => setReferenceBody(null)}
                    className="text-xs text-stone-400 hover:text-stone-600"
                  >
                    ✕ 解除
                  </button>
                </div>
                <p className="text-xs text-stone-500 leading-relaxed">
                  {referenceBody.length > 100
                    ? referenceBody.slice(0, 100) + '...'
                    : referenceBody}
                </p>
                <p className="text-xs text-green-600 mt-1.5">
                  この文体・構成を参考にして新しい内容を生成します
                </p>
              </CardContent>
            </Card>
          )}

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
                        <div className="flex flex-wrap gap-2">
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
                          {templateSaved[tone] ? (
                            <span className="text-xs text-green-600 font-medium flex items-center ml-1">✓ テンプレート保存済み</span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSaveTemplate(tone)}
                              disabled={templateSaving}
                            >
                              {templateSaving ? '保存中...' : '📑 テンプレート保存'}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* フィードバック */}
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium text-stone-600">フィードバック</CardTitle>
                          {feedbackSent[tone] ? (
                            <span className="text-xs text-green-600 font-medium">送信済み</span>
                          ) : (
                            <button
                              onClick={() => setFeedbackOpen(prev => ({ ...prev, [tone]: !prev[tone] }))}
                              className="text-xs text-stone-400 hover:text-stone-600"
                            >
                              {feedbackOpen[tone] ? '閉じる' : '開く'}
                            </button>
                          )}
                        </div>
                      </CardHeader>
                      {feedbackOpen[tone] && !feedbackSent[tone] && (
                        <CardContent className="space-y-3">
                          {/* 評価 */}
                          <div>
                            <div className="text-xs text-stone-500 mb-1.5">評価</div>
                            <div className="flex gap-2">
                              {[
                                { value: 'good', label: '良い', color: 'border-green-600 bg-green-50 text-green-800' },
                                { value: 'ok', label: 'まあまあ', color: 'border-amber-500 bg-amber-50 text-amber-800' },
                                { value: 'redo', label: 'やり直し', color: 'border-red-400 bg-red-50 text-red-700' },
                              ].map(r => (
                                <button
                                  key={r.value}
                                  onClick={() => setFeedbackRating(prev => ({ ...prev, [tone]: r.value }))}
                                  className={`flex-1 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                                    feedbackRating[tone] === r.value ? r.color : 'border-stone-200 text-stone-500 hover:border-stone-300'
                                  }`}
                                >
                                  {r.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* コメント */}
                          <div>
                            <div className="text-xs text-stone-500 mb-1.5">改善メモ（任意）</div>
                            <Textarea
                              placeholder="例：もう少しやわらかい表現で、商品名は正式名称を使って"
                              value={feedbackComment[tone] || ''}
                              onChange={e => setFeedbackComment(prev => ({ ...prev, [tone]: e.target.value }))}
                              rows={2}
                            />
                          </div>
                          {/* 編集検出 */}
                          {editingBody[tone] && editingBody[tone] !== result.body && (
                            <div className="text-xs text-amber-600 bg-amber-50 rounded p-2">
                              本文が編集されています。修正内容もフィードバックに含まれます。
                            </div>
                          )}
                          {/* 送信ボタン */}
                          <Button
                            onClick={() => handleFeedback(tone)}
                            disabled={feedbackSending || !feedbackRating[tone]}
                            size="sm"
                            className="w-full bg-stone-800 hover:bg-stone-700"
                          >
                            {feedbackSending ? '送信中...' : 'フィードバックを送信'}
                          </Button>
                        </CardContent>
                      )}
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

                    {/* メール通信原稿生成 */}
                    <Card className="border-purple-200">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium text-purple-700">
                            📧 メール通信原稿を作成
                          </CardTitle>
                          {mailResult[tone] && (
                            <Badge variant="outline" className="text-purple-600 border-purple-300">
                              {((mailResult[tone]?.duration_ms || 0) / 1000).toFixed(1)}秒
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-stone-400 mt-1">
                          上のストーリーをベースに、テネモス通信（メルマガ）の原稿たたき台を生成します
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* 追加指示入力 */}
                        {!mailResult[tone] && (
                          <div>
                            <div className="text-xs text-stone-500 mb-1">追加の指示・要望（任意）</div>
                            <Textarea
                              placeholder="例：お知らせ欄にGW休業の案内を入れてほしい、もう少しカジュアルに"
                              value={mailAdditionalNotes[tone] || ''}
                              onChange={e => setMailAdditionalNotes(prev => ({ ...prev, [tone]: e.target.value }))}
                              rows={2}
                            />
                          </div>
                        )}

                        {/* 生成ボタン */}
                        {!mailResult[tone] && (
                          <Button
                            onClick={() => handleGenerateMail(tone)}
                            disabled={mailGenerating !== null}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                          >
                            {mailGenerating === tone ? (
                              <span className="animate-pulse">メール通信原稿を生成中...</span>
                            ) : (
                              '📧 メール通信原稿を生成'
                            )}
                          </Button>
                        )}

                        {/* メール通信結果 */}
                        {mailResult[tone] && (
                          <div className="space-y-3">
                            {/* 件名 */}
                            <div>
                              <div className="text-xs text-stone-500 mb-1">件名</div>
                              <input
                                type="text"
                                value={mailEditingSubject[tone] || mailResult[tone]?.subject || ''}
                                onChange={e => setMailEditingSubject(prev => ({ ...prev, [tone]: e.target.value }))}
                                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-300"
                              />
                            </div>

                            {/* 本文 */}
                            <div>
                              <div className="text-xs text-stone-500 mb-1">本文</div>
                              <Textarea
                                value={mailEditingBody[tone] || mailResult[tone]?.body || ''}
                                onChange={e => setMailEditingBody(prev => ({ ...prev, [tone]: e.target.value }))}
                                rows={14}
                                className="resize-y text-sm leading-relaxed"
                              />
                              <div className="flex justify-between mt-1.5 text-xs text-stone-400">
                                <span>{(mailEditingBody[tone] || mailResult[tone]?.body || '').length}文字</span>
                                {mailEditingBody[tone] && mailEditingBody[tone] !== mailResult[tone]?.body && (
                                  <span className="text-amber-500">編集済み</span>
                                )}
                              </div>
                            </div>

                            {/* アクションボタン */}
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  const subject = mailEditingSubject[tone] || mailResult[tone]?.subject || ''
                                  const body = mailEditingBody[tone] || mailResult[tone]?.body || ''
                                  await navigator.clipboard.writeText(`${subject}\n\n${body}`)
                                }}
                              >
                                📋 全体コピー
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-purple-200 text-purple-700 hover:bg-purple-50"
                                onClick={() => handleSaveMailToSchedule(tone)}
                              >
                                📅 配信予定に保存
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setMailResult(prev => {
                                    const next = { ...prev }
                                    delete next[tone]
                                    return next
                                  })
                                }}
                              >
                                🔄 再生成
                              </Button>
                            </div>
                          </div>
                        )}
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
