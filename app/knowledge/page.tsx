'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

// === 型定義 ===

type KnowledgeSource = {
  id: string
  source_type: 'hp' | 'blog' | 'mail' | 'feedback'
  url: string | null
  title: string | null
  content: string
  category: string | null
  metadata: Record<string, unknown>
  collected_at: string
}

type Product = {
  id: string
  name: string
  price: number | null
  category: string | null
  description: string | null
  features: string[]
  keywords: string[]
  usage_text: string | null
  url: string | null
  updated_at: string
}

// === 定数 ===

const SOURCE_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  hp: { label: 'HP', emoji: '🏠' },
  blog: { label: 'ブログ', emoji: '📝' },
  mail: { label: 'メール', emoji: '✉️' },
  feedback: { label: 'フィードバック', emoji: '💬' },
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  brand: { label: 'ブランド情報', color: 'bg-blue-100 text-blue-800' },
  tone: { label: 'トーン規定', color: 'bg-purple-100 text-purple-800' },
  sample: { label: '参考原稿', color: 'bg-green-100 text-green-800' },
  feedback: { label: 'フィードバック', color: 'bg-amber-100 text-amber-800' },
}

// === ナレッジタブ ===

function KnowledgeTab() {
  const [items, setItems] = useState<KnowledgeSource[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchItems = async () => {
    setLoading(true)
    try {
      const params = filter !== 'all' ? `?source_type=${filter}` : ''
      const res = await fetch(`/api/knowledge${params}`)
      if (res.ok) {
        setItems(await res.json())
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchItems() }, [filter])

  const handleEdit = (item: KnowledgeSource) => {
    setEditingId(item.id)
    setEditContent(item.content)
  }

  const handleSave = async (id: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/knowledge', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, content: editContent }),
      })
      if (res.ok) {
        setItems(prev => prev.map(item =>
          item.id === id ? { ...item, content: editContent } : item
        ))
        setEditingId(null)
      }
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このナレッジを削除しますか？生成品質に影響する可能性があります。')) return
    setDeleting(id)
    try {
      const res = await fetch('/api/knowledge', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setItems(prev => prev.filter(item => item.id !== id))
      }
    } catch {
      // ignore
    } finally {
      setDeleting(null)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  // ソースタイプ別の件数
  const counts = items.reduce((acc, item) => {
    acc[item.source_type] = (acc[item.source_type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-4">
      {/* フィルター */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          すべて ({items.length})
        </Button>
        {Object.entries(SOURCE_TYPE_LABELS).map(([key, { label, emoji }]) => (
          <Button
            key={key}
            variant={filter === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(key)}
          >
            {emoji} {label} {filter === 'all' && counts[key] ? `(${counts[key]})` : ''}
          </Button>
        ))}
      </div>

      {/* 一覧 */}
      {loading ? (
        <div className="text-center py-12 text-stone-400">読み込み中...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📚</div>
          <p className="text-stone-500">ナレッジデータがありません</p>
          <p className="text-sm text-stone-400 mt-1">
            HPスクレイピングやブログ収集を実行すると、ここにデータが表示されます
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="secondary" className="shrink-0">
                      {SOURCE_TYPE_LABELS[item.source_type]?.emoji} {SOURCE_TYPE_LABELS[item.source_type]?.label}
                    </Badge>
                    {item.category && CATEGORY_LABELS[item.category] && (
                      <Badge className={`shrink-0 ${CATEGORY_LABELS[item.category].color}`}>
                        {CATEGORY_LABELS[item.category].label}
                      </Badge>
                    )}
                    <CardTitle className="text-sm truncate">
                      {item.title || '(タイトルなし)'}
                    </CardTitle>
                  </div>
                  <span className="text-xs text-stone-400 shrink-0 ml-2">
                    {new Date(item.collected_at).toLocaleDateString('ja-JP')}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {editingId === item.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      rows={8}
                      className="text-sm"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                        キャンセル
                      </Button>
                      <Button size="sm" onClick={() => handleSave(item.id)} disabled={saving}>
                        {saving ? '保存中...' : '保存'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p
                      className="text-sm text-stone-600 whitespace-pre-wrap leading-relaxed cursor-pointer"
                      onClick={() => toggleExpand(item.id)}
                    >
                      {expandedId === item.id
                        ? item.content
                        : item.content.length > 150
                          ? item.content.slice(0, 150) + '...'
                          : item.content}
                    </p>
                    {item.content.length > 150 && (
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="text-xs text-stone-400 hover:text-stone-600"
                      >
                        {expandedId === item.id ? '▲ 折りたたむ' : '▼ 全文を表示'}
                      </button>
                    )}
                  </>
                )}

                {item.url && (
                  <div className="text-xs text-stone-400">
                    出典: <a href={item.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-stone-600">{item.url}</a>
                  </div>
                )}

                {editingId !== item.id && (
                  <div className="flex gap-2 justify-end pt-1">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(item)}>
                      編集
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(item.id)}
                      disabled={deleting === item.id}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      {deleting === item.id ? '削除中...' : '削除'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// === 商品タブ ===

function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ description: '', usage_text: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products')
      if (res.ok) {
        setProducts(await res.json())
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProducts() }, [])

  const handleEdit = (product: Product) => {
    setEditingId(product.id)
    setEditData({
      description: product.description || '',
      usage_text: product.usage_text || '',
    })
  }

  const handleSave = async (id: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...editData }),
      })
      if (res.ok) {
        setProducts(prev => prev.map(p =>
          p.id === id ? { ...p, ...editData } : p
        ))
        setEditingId(null)
      }
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この商品データを削除しますか？次回のHP収集で再登録されます。')) return
    setDeleting(id)
    try {
      const res = await fetch('/api/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setProducts(prev => prev.filter(p => p.id !== id))
      }
    } catch {
      // ignore
    } finally {
      setDeleting(null)
    }
  }

  // カテゴリ別にグルーピング
  const grouped = products.reduce((acc, p) => {
    const cat = p.category || '未分類'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {} as Record<string, Product[]>)

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="text-center py-12 text-stone-400">読み込み中...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🛍️</div>
          <p className="text-stone-500">商品データがありません</p>
          <p className="text-sm text-stone-400 mt-1">
            <code className="bg-stone-100 px-1.5 py-0.5 rounded">npm run ingest:hp</code> で商品データを収集できます
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="text-sm text-stone-500">
            全{products.length}商品 · {Object.keys(grouped).length}カテゴリ
          </div>

          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
                📦 {category}
                <Badge variant="secondary" className="text-xs">{items.length}件</Badge>
              </h3>
              <div className="space-y-3">
                {items.map(product => (
                  <Card key={product.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{product.name}</CardTitle>
                        <div className="flex items-center gap-2">
                          {product.price && (
                            <Badge variant="outline">¥{product.price.toLocaleString()}</Badge>
                          )}
                          <span className="text-xs text-stone-400">
                            更新: {new Date(product.updated_at).toLocaleDateString('ja-JP')}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {editingId === product.id ? (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-medium text-stone-500">説明</label>
                            <Textarea
                              value={editData.description}
                              onChange={e => setEditData(prev => ({ ...prev, description: e.target.value }))}
                              rows={4}
                              className="text-sm mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-stone-500">使い方</label>
                            <Textarea
                              value={editData.usage_text}
                              onChange={e => setEditData(prev => ({ ...prev, usage_text: e.target.value }))}
                              rows={3}
                              className="text-sm mt-1"
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                              キャンセル
                            </Button>
                            <Button size="sm" onClick={() => handleSave(product.id)} disabled={saving}>
                              {saving ? '保存中...' : '保存'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {product.description && (
                            <p
                              className="text-sm text-stone-600 whitespace-pre-wrap leading-relaxed cursor-pointer"
                              onClick={() => setExpandedId(expandedId === product.id ? null : product.id)}
                            >
                              {expandedId === product.id
                                ? product.description
                                : product.description.length > 100
                                  ? product.description.slice(0, 100) + '...'
                                  : product.description}
                            </p>
                          )}

                          {product.features.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {product.features.map((f, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">{f}</Badge>
                              ))}
                            </div>
                          )}

                          {product.usage_text && expandedId === product.id && (
                            <div className="text-sm text-stone-500">
                              <span className="font-medium">使い方:</span> {product.usage_text}
                            </div>
                          )}

                          <div className="flex gap-2 justify-end pt-1">
                            {product.url && (
                              <a href={product.url} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="sm">HP確認</Button>
                              </a>
                            )}
                            <Button variant="outline" size="sm" onClick={() => handleEdit(product)}>
                              編集
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(product.id)}
                              disabled={deleting === product.id}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              {deleting === product.id ? '削除中...' : '削除'}
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// === メインページ ===

export default function KnowledgePage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <a href="/" className="text-stone-400 hover:text-stone-600 text-sm">← ダッシュボード</a>
          <h1 className="text-xl font-bold text-stone-800">ナレッジ管理</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <Tabs defaultValue="knowledge">
          <TabsList className="mb-4">
            <TabsTrigger value="knowledge">📚 ナレッジ</TabsTrigger>
            <TabsTrigger value="products">🛍️ 商品データ</TabsTrigger>
          </TabsList>

          <TabsContent value="knowledge">
            <KnowledgeTab />
          </TabsContent>

          <TabsContent value="products">
            <ProductsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
