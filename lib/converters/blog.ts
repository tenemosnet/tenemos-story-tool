// ブログ記事変換ロジック（メール通信変換とは完全に分離）
import { createServiceClient } from '@/lib/supabase'
import { callClaude } from '@/lib/claude'
import { MODELS } from '@/lib/config'
import type { OutputTemplate } from '@/lib/types/output-template'
import type { BlogGenerationHistory, WPArticleType } from '@/lib/types/blog-generation'

type Story = {
  id: string
  theme: string
  tone: string
  title: string
  body: string
}

type KnowledgeSource = {
  title: string | null
  content: string
  category: string | null
}

/**
 * ナレッジソースを全件取得（既存のメール通信生成と同方式）
 */
async function getKnowledgeSources(): Promise<KnowledgeSource[]> {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('knowledge_sources')
      .select('title, content, category')
      .order('collected_at', { ascending: false })
      .limit(50)
    return data ?? []
  } catch (error) {
    console.error('ナレッジソース取得エラー:', error)
    return []
  }
}

/**
 * テンプレートのsystem_prompt + ナレッジソースで完全システムプロンプトを構築
 */
function buildFullSystemPrompt(template: OutputTemplate, knowledgeSources: KnowledgeSource[]): string {
  const brandKnowledge = knowledgeSources.filter(k => k.category === 'brand')
  const toneKnowledge = knowledgeSources.filter(k => k.category === 'tone')
  const sampleKnowledge = knowledgeSources.filter(k => k.category === 'sample' || k.category === null)

  let prompt = template.system_prompt

  if (brandKnowledge.length > 0) {
    prompt += '\n\n# ブランド・企業情報\n'
    prompt += brandKnowledge.map(k => k.content.slice(0, 500)).join('\n---\n')
  }

  if (toneKnowledge.length > 0) {
    prompt += '\n\n# 文体・トーン規定\n'
    prompt += toneKnowledge.map(k => k.content.slice(0, 300)).join('\n---\n')
  }

  if (sampleKnowledge.length > 0) {
    prompt += '\n\n# 参考記事・サンプル\n'
    prompt += sampleKnowledge
      .slice(0, 5)
      .map(k => `タイトル: ${k.title ?? ''}\n${k.content.slice(0, 400)}`)
      .join('\n---\n')
  }

  return prompt
}

/**
 * Claude APIへ送るユーザーメッセージを構築
 */
function buildUserMessage(
  story: Story,
  userRequest?: string,
  parentResult?: string
): string {
  let message = `以下のLINE配信用ストーリーをベースに、ブログ記事を執筆してください。

【元のLINE配信ストーリー】
タイトル: ${story.title}
テーマ: ${story.theme}
トーン: ${story.tone}
本文:
${story.body}
`

  if (parentResult) {
    message += `\n【前回の生成結果】\n${parentResult}\n`
  }

  if (userRequest?.trim()) {
    message += `\n【ユーザーからの追加指示・変更リクエスト】\n${userRequest.trim()}\n`
  }

  message += '\nHTMLのみ出力してください。タイトルは <title> タグで、本文は <article> タグで囲んでください。'

  return message
}

/**
 * ストーリーのトーンからテンプレートを自動推奨
 */
export function suggestTemplate(story: Story): WPArticleType {
  const tone = story.tone?.toLowerCase() ?? ''
  const theme = story.theme?.toLowerCase() ?? ''

  if (tone.includes('staff') || theme.includes('お客様') || tone.includes('スタッフ')) {
    return 'staff_recommend'
  }
  if (
    tone.includes('professional') ||
    tone.includes('専門') ||
    tone.includes('哲学') ||
    theme.includes('テネモス哲学') ||
    theme.includes('自然の仕組み')
  ) {
    return 'philosophical'
  }
  // casual / やさしい / その他 → howto（デフォルト）
  return 'howto'
}

/**
 * ストーリーからブログ記事HTMLを生成する（初回・再生成共通）
 */
export async function generateBlogArticle(params: {
  storyId: string
  templateId: string
  userRequest?: string
  parentHistory?: BlogGenerationHistory
}): Promise<{
  title: string
  body: string
  fullPrompt: string
  userMessage: string
  inputTokens: number
  outputTokens: number
  modelUsed: string
}> {
  const supabase = createServiceClient()

  // ストーリー取得
  const { data: story, error: storyError } = await supabase
    .from('stories')
    .select('id, theme, tone, title, body')
    .eq('id', params.storyId)
    .single()
  if (storyError || !story) throw new Error('ストーリーが見つかりません')

  // テンプレート取得
  const { data: template, error: templateError } = await supabase
    .from('output_templates')
    .select('*')
    .eq('id', params.templateId)
    .single()
  if (templateError || !template) throw new Error('テンプレートが見つかりません')

  // ナレッジソース取得
  const knowledgeSources = await getKnowledgeSources()

  // プロンプト構築
  const fullPrompt = buildFullSystemPrompt(template as OutputTemplate, knowledgeSources)
  const userMessage = buildUserMessage(
    story as Story,
    params.userRequest,
    params.parentHistory?.generated_body
  )

  // Claude API 呼び出し（リトライ1回）
  let response
  try {
    response = await callClaude({
      model: MODELS.generate,
      max_tokens: 4096,
      system: fullPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })
  } catch {
    // 1回リトライ
    response = await callClaude({
      model: MODELS.generate,
      max_tokens: 4096,
      system: fullPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })
  }

  const rawText = response.content.find(c => c.type === 'text')?.text ?? ''

  // <title> と <article> を抽出
  const titleMatch = rawText.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const articleMatch = rawText.match(/<article[^>]*>([\s\S]*?)<\/article>/i)

  const title = titleMatch ? titleMatch[1].trim() : story.title
  const body = articleMatch ? articleMatch[1].trim() : rawText.trim()

  return {
    title,
    body,
    fullPrompt,
    userMessage,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    modelUsed: MODELS.generate,
  }
}
