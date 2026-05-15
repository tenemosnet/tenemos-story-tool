'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Settings = {
  wp_api_base_url?: string
  wp_api_username?: string
  wp_application_password?: string
}

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<Settings>({
    wp_api_base_url: '',
    wp_api_username: '',
    wp_application_password: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json() as Settings
          setSettings({
            wp_api_base_url: data.wp_api_base_url ?? '',
            wp_api_username: data.wp_api_username ?? '',
            wp_application_password: data.wp_application_password ?? '',
          })
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg(null)
    setTestMsg(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error('保存に失敗しました')
      setSaveMsg({ ok: true, text: '✅ 接続設定を保存しました' })
    } catch (err) {
      setSaveMsg({ ok: false, text: err instanceof Error ? err.message : '保存に失敗しました' })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestMsg(null)
    try {
      const res = await fetch('/api/settings/test-wp', { method: 'POST' })
      const data = await res.json() as { success: boolean; error?: string }
      if (data.success) {
        setTestMsg({ ok: true, text: '✅ WordPress に接続できました' })
      } else {
        setTestMsg({ ok: false, text: `❌ 接続失敗：${data.error ?? '不明なエラー'}` })
      }
    } catch {
      setTestMsg({ ok: false, text: '❌ 接続テストに失敗しました' })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <p className="text-stone-400">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => router.push('/')}
            className="text-stone-400 hover:text-stone-600 text-sm"
          >
            ← ダッシュボードへ
          </button>
          <h1 className="text-xl font-bold text-stone-800">⚙️ アプリ設定</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        {/* 管理ツール */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">管理ツール</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="/templates"
              className="flex items-center justify-between p-3 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">📑</span>
                <div>
                  <p className="text-sm font-medium text-stone-800">テンプレート管理</p>
                  <p className="text-xs text-stone-400">保存したストーリーテンプレートの閲覧・再利用・削除</p>
                </div>
              </div>
              <span className="text-stone-400 text-sm">→</span>
            </a>
            <a
              href="/knowledge"
              className="flex items-center justify-between p-3 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">📚</span>
                <div>
                  <p className="text-sm font-medium text-stone-800">ナレッジ管理</p>
                  <p className="text-xs text-stone-400">ナレッジと商品データの閲覧・管理</p>
                </div>
              </div>
              <span className="text-stone-400 text-sm">→</span>
            </a>
            <a
              href="/output-templates"
              className="flex items-center justify-between p-3 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">🗂️</span>
                <div>
                  <p className="text-sm font-medium text-stone-800">出力テンプレート管理</p>
                  <p className="text-xs text-stone-400">メール通信・WordPress記事変換テンプレートの管理</p>
                </div>
              </div>
              <span className="text-stone-400 text-sm">→</span>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">WordPress 接続設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-stone-600 block mb-1">
                サイトURL（wp-json/wp/v2 まで）
              </label>
              <input
                type="text"
                placeholder="https://example.com/wp-json/wp/v2"
                value={settings.wp_api_base_url ?? ''}
                onChange={e => setSettings(s => ({ ...s, wp_api_base_url: e.target.value }))}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>

            <div>
              <label className="text-sm text-stone-600 block mb-1">ユーザー名</label>
              <input
                type="text"
                placeholder="WordPressのログインユーザー名"
                value={settings.wp_api_username ?? ''}
                onChange={e => setSettings(s => ({ ...s, wp_api_username: e.target.value }))}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>

            <div>
              <label className="text-sm text-stone-600 block mb-1">Application Password</label>
              <div className="flex gap-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                  value={settings.wp_application_password ?? ''}
                  onChange={e => setSettings(s => ({ ...s, wp_application_password: e.target.value }))}
                  className="flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="text-xs text-stone-500 hover:text-stone-700 border border-stone-300 rounded-md px-3 py-2 bg-white"
                >
                  {showPassword ? '隠す' : '表示'}
                </button>
              </div>
              <p className="text-xs text-stone-400 mt-1">
                WordPress管理画面 → ユーザー → プロフィール → アプリケーションパスワード から発行
              </p>
            </div>

            {saveMsg && (
              <p className={`text-sm rounded-lg px-3 py-2 ${saveMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {saveMsg.text}
              </p>
            )}

            {testMsg && (
              <p className={`text-sm rounded-lg px-3 py-2 ${testMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {testMsg.text}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={testing || saving}
              >
                {testing ? 'テスト中...' : '🔌 接続テスト'}
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || testing}
                className="bg-stone-800 hover:bg-stone-900 text-white"
              >
                {saving ? '保存中...' : '💾 保存'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
