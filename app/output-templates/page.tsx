'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { OutputTemplate, OutputTemplateFormat, OutputFormat } from '@/lib/types/output-template'

type FormData = {
  slug: string
  name: string
  format: OutputTemplateFormat
  description: string
  system_prompt: string
  structure_spec: string
  output_format: OutputFormat
  is_active: boolean
  sort_order: number
}

const emptyForm: FormData = {
  slug: '',
  name: '',
  format: 'mail',
  description: '',
  system_prompt: '',
  structure_spec: '{}',
  output_format: 'text',
  is_active: true,
  sort_order: 0,
}

export default function OutputTemplatesPage() {
  const [templates, setTemplates] = useState<OutputTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [formatFilter, setFormatFilter] = useState<string>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/output-templates?include_inactive=true')
      if (res.ok) {
        setTemplates(await res.json())
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTemplates() }, [])

  const filtered = formatFilter === 'all'
    ? templates
    : templates.filter(t => t.format === formatFilter)

  const openNewForm = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
    setShowForm(true)
  }

  const openEditForm = (t: OutputTemplate) => {
    setEditingId(t.id)
    setForm({
      slug: t.slug,
      name: t.name,
      format: t.format,
      description: t.description || '',
      system_prompt: t.system_prompt,
      structure_spec: JSON.stringify(t.structure_spec, null, 2),
      output_format: t.output_format,
      is_active: t.is_active,
      sort_order: t.sort_order,
    })
    setFormError(null)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormError(null)
  }

  const validateForm = (): string | null => {
    if (!form.slug) return 'slugは必須です'
    if (!/^[a-z0-9_]+$/.test(form.slug)) return 'slugは英小文字・数字・アンダースコアのみ使用できます'
    if (!form.name) return '名前は必須です'
    if (!form.system_prompt) return 'システムプロンプトは必須です'
    try {
      JSON.parse(form.structure_spec)
    } catch {
      return 'structure_specが正しいJSON形式ではありません'
    }
    return null
  }

  const handleSave = async () => {
    const error = validateForm()
    if (error) {
      setFormError(error)
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const payload = {
        ...form,
        structure_spec: form.structure_spec,
        description: form.description || null,
      }

      let res: Response
      if (editingId) {
        res = await fetch('/api/output-templates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload }),
        })
      } else {
        res = await fetch('/api/output-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const err = await res.json()
        setFormError(err.error || '保存に失敗しました')
        return
      }

      await fetchTemplates()
      closeForm()
      alert(editingId ? '更新しました' : '作成しました')
    } catch {
      setFormError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (id: string) => {
    try {
      const res = await fetch('/api/output-templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'toggle' }),
      })
      if (res.ok) {
        await fetchTemplates()
      }
    } catch {
      alert('切替に失敗しました')
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      const res = await fetch('/api/output-templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'duplicate' }),
      })
      if (res.ok) {
        await fetchTemplates()
        alert('複製しました')
      }
    } catch {
      alert('複製に失敗しました')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」を無効化しますか？`)) return
    try {
      const res = await fetch('/api/output-templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        await fetchTemplates()
      }
    } catch {
      alert('削除に失敗しました')
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <a href="/" className="text-stone-400 hover:text-stone-600 text-sm">&larr; ダッシュボード</a>
          <h1 className="text-xl font-bold text-stone-800">出力テンプレート管理</h1>
          <span className="text-sm text-stone-400">{templates.length}件</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* 運用ルール注意書き */}
        <div className="flex gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50/50 text-sm text-stone-600">
          <span className="text-blue-500 shrink-0">ℹ️</span>
          <div>
            <p>このテンプレートは <code className="text-xs bg-stone-100 px-1 py-0.5 rounded">docs/templates/&#123;slug&#125;.md</code> から同期されています。</p>
            <p className="mt-1">恒久的な変更は MDファイル側で行い、<code className="text-xs bg-stone-100 px-1 py-0.5 rounded">npm run register-templates</code> を実行してください。この画面での編集は、次回同期時に上書きされる可能性があります。</p>
          </div>
        </div>

        {/* フィルター＋新規作成 */}
        <div className="flex items-center justify-between">
          <Tabs value={formatFilter} onValueChange={setFormatFilter}>
            <TabsList>
              <TabsTrigger value="all">全て</TabsTrigger>
              <TabsTrigger value="mail">メール</TabsTrigger>
              <TabsTrigger value="wordpress">WordPress</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={openNewForm} className="bg-green-700 hover:bg-green-800">
            + 新規作成
          </Button>
        </div>

        {/* 編集/新規作成フォーム */}
        {showForm && (
          <Card className="border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {editingId ? 'テンプレート編集' : '新規テンプレート作成'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* slug */}
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">slug</label>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                    disabled={!!editingId}
                    placeholder="例: wp_standard"
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-300 disabled:bg-stone-100 disabled:text-stone-400"
                  />
                  <p className="text-xs text-stone-400 mt-1">英小文字・数字・アンダースコアのみ{editingId ? '（変更不可）' : ''}</p>
                </div>

                {/* name */}
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">名前</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="例: WordPress スタンダード版"
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                  />
                </div>

                {/* format */}
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">フォーマット</label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="format"
                        value="mail"
                        checked={form.format === 'mail'}
                        onChange={() => setForm(f => ({ ...f, format: 'mail' }))}
                        className="accent-green-700"
                      />
                      メール
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="format"
                        value="wordpress"
                        checked={form.format === 'wordpress'}
                        onChange={() => setForm(f => ({ ...f, format: 'wordpress' }))}
                        className="accent-green-700"
                      />
                      WordPress
                    </label>
                  </div>
                </div>

                {/* output_format */}
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">出力形式</label>
                  <select
                    value={form.output_format}
                    onChange={e => setForm(f => ({ ...f, output_format: e.target.value as OutputFormat }))}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
                  >
                    <option value="text">テキスト (text)</option>
                    <option value="html">HTML (html)</option>
                    <option value="markdown">Markdown (markdown)</option>
                  </select>
                </div>

                {/* sort_order */}
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">表示順</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                  />
                </div>

                {/* is_active */}
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    className="accent-green-700"
                  />
                  <label htmlFor="is_active" className="text-sm text-stone-700 cursor-pointer">有効</label>
                </div>
              </div>

              {/* description */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">説明</label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="テンプレートの用途説明"
                  rows={2}
                />
              </div>

              {/* system_prompt */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">システムプロンプト</label>
                <Textarea
                  value={form.system_prompt}
                  onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
                  placeholder="Claude API呼び出し時に使用するシステムプロンプト"
                  rows={8}
                  className="font-mono text-xs"
                />
              </div>

              {/* structure_spec */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">構造仕様 (JSON)</label>
                <Textarea
                  value={form.structure_spec}
                  onChange={e => setForm(f => ({ ...f, structure_spec: e.target.value }))}
                  placeholder='{"sections": [], "tone_ref": "blog"}'
                  rows={6}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-stone-400 mt-1">JSON形式で入力してください</p>
              </div>

              {/* ボタン */}
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={closeForm} disabled={saving}>
                  キャンセル
                </Button>
                <Button onClick={handleSave} disabled={saving} className="bg-green-700 hover:bg-green-800">
                  {saving ? '保存中...' : (editingId ? '更新' : '作成')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 一覧 */}
        {loading ? (
          <div className="text-center py-12 text-stone-400">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📄</div>
            <p className="text-stone-500">出力テンプレートがありません</p>
            {!showForm && (
              <button
                onClick={openNewForm}
                className="mt-4 text-green-700 hover:text-green-800 text-sm font-medium"
              >
                &rarr; 新規作成
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(t => (
              <Card key={t.id} className={!t.is_active ? 'opacity-50' : ''}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-stone-800">{t.name}</h3>
                        <Badge variant="outline" className="text-xs font-mono">{t.slug}</Badge>
                        <Badge variant={t.format === 'wordpress' ? 'default' : 'secondary'} className="text-xs">
                          {t.format === 'wordpress' ? 'WordPress' : 'メール'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{t.output_format}</Badge>
                        {!t.is_active && (
                          <Badge variant="destructive" className="text-xs">無効</Badge>
                        )}
                      </div>
                      {t.description && (
                        <p className="text-sm text-stone-500 mt-1">{t.description}</p>
                      )}
                      <p className="text-xs text-stone-400 mt-2">
                        更新: {new Date(t.updated_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button variant="outline" size="sm" onClick={() => openEditForm(t)}>
                        編集
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDuplicate(t.id)}>
                        複製
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggle(t.id)}
                      >
                        {t.is_active ? '無効化' : '有効化'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(t.id, t.name)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        削除
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
