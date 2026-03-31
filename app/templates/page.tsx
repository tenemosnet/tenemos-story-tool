'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Template = {
  id: string
  name: string
  theme: string
  tone: string
  body: string
  hashtags: string[]
  category: string | null
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

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTemplates() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('このテンプレートを削除しますか？')) return
    setDeleting(id)
    try {
      const res = await fetch('/api/templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setTemplates(prev => prev.filter(t => t.id !== id))
      }
    } catch {
      // ignore
    } finally {
      setDeleting(null)
    }
  }

  const handleCopy = async (template: Template) => {
    const text = `${template.name}\n\n${template.body}\n\n${template.hashtags.map(t => `#${t}`).join(' ')}`
    await navigator.clipboard.writeText(text)
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <a href="/" className="text-stone-400 hover:text-stone-600 text-sm">← ダッシュボード</a>
          <h1 className="text-xl font-bold text-stone-800">テンプレート管理</h1>
          <span className="text-sm text-stone-400">{templates.length}件</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {loading ? (
          <div className="text-center py-12 text-stone-400">読み込み中...</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📑</div>
            <p className="text-stone-500">保存済みテンプレートはありません</p>
            <p className="text-sm text-stone-400 mt-1">ストーリー生成後に「テンプレートとして保存」で追加できます</p>
            <a href="/generate" className="inline-block mt-4 text-green-700 hover:text-green-800 text-sm font-medium">
              → ストーリーを生成する
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {templates.map(template => (
              <Card key={template.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {TONE_EMOJI[template.tone] || ''} {template.tone}
                      </Badge>
                      <Badge variant="outline">{template.theme}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-stone-600 whitespace-pre-wrap leading-relaxed">
                    {template.body.length > 200
                      ? template.body.slice(0, 200) + '...'
                      : template.body}
                  </p>

                  {template.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {template.hashtags.map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">#{tag}</Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-stone-400">
                      {new Date(template.created_at).toLocaleDateString('ja-JP')}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleCopy(template)}>
                        コピー
                      </Button>
                      <a href={`/generate?theme=${encodeURIComponent(template.theme)}&tone=${encodeURIComponent(template.tone)}`}>
                        <Button variant="outline" size="sm">
                          この設定で再生成
                        </Button>
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(template.id)}
                        disabled={deleting === template.id}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        {deleting === template.id ? '削除中...' : '削除'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
