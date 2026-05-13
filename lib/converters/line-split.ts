// LINE配信分割ロジック（メール通信・ブログ記事の変換ロジックとは完全分離）
import { createServiceClient } from '@/lib/supabase'
import { callClaude } from '@/lib/claude'
import { MODELS } from '@/lib/config'
import type { SplittingStyle, LineDistributionPart, LineDistributionHistory } from '@/lib/types/line-distribution'

type Story = {
  id: string
  theme: string
  tone: string
  title: string
  body: string
}

const STYLE_INSTRUCTIONS: Record<SplittingStyle, string> = {
  subtle: `## subtle（控えめ）
- 各配信の冒頭・末尾に、自然なつなぎ語を1〜2行程度で入れる
- 例：「続きは、また明日 ✨」「昨日のお話、覚えていますか?」`,
  explicit: `## explicit（しっかり）
- 各配信の冒頭で前回のおさらいを2〜3行
- 各配信の末尾で次回予告を2〜3行
- 例：「前回は、しおれたレタスが水でシャキッと戻るお話でした」`,
  none: `## none（独立）
- つなぎ語は入れない
- 各配信が完全に独立した記事として読める
- ハッシュタグは各回に分散して配置`,
}

function buildSplitSystemPrompt(
  totalParts: number,
  splittingStyle: SplittingStyle,
  parentResult?: LineDistributionPart[]
): string {
  let prompt = `あなたはテネモスネットのLINE配信担当者です。
入力された1本の長文ストーリーを、LINE配信用に${totalParts}回の連載形式に分割してください。

# 分割の基本ルール

1. 元のストーリーの内容・思想・トーンを忠実に保つ
2. 各配信は独立して読めるよう、最低限の文脈を保持する
3. 各配信の本文は300字前後を目安（合計でストーリーの内容をカバー）
4. 各配信に魅力的なタイトルを付ける（元タイトル【n/${totalParts}】の形式が基本）
5. テネモスらしい語りかけ口調・改行リズムを保持する

# つなぎ語のスタイル

${STYLE_INSTRUCTIONS[splittingStyle]}

# 出力フォーマット

以下のJSON配列形式で出力してください。それ以外の説明文は含めないこと。

[
  {
    "order": 1,
    "title": "タイトル【1/${totalParts}】",
    "body": "本文（300字程度）"
  },
  ...
  {
    "order": ${totalParts},
    "title": "タイトル【${totalParts}/${totalParts}】",
    "body": "本文（300字程度）"
  }
]

# 守るべき注意点

- 元のストーリーにない情報を勝手に追加しない
- ハッシュタグは最終回に配置（noneスタイルの場合は各回に分散）
- 絵文字は元のストーリーに合わせる
- 各配信の文字数は厳密に300字でなくてよい。読みやすさを優先（250〜350字程度の幅）
- 結論や核心は最終回に持っていく（読者の興味を最後まで引きつける）`

  if (parentResult) {
    prompt += `\n\n# 再分割リクエストです

【前回の分割結果】
${JSON.stringify(parentResult, null, 2)}

前回の結果を参考にしつつ、ユーザーの修正リクエストを反映した新しい分割を生成してください。`
  }

  return prompt
}

function buildUserMessage(story: Story, userRequest?: string): string {
  let message = `以下のLINE配信用ストーリーを分割してください。

【元のストーリー】
タイトル: ${story.title}
テーマ: ${story.theme}
トーン: ${story.tone}
本文:
${story.body}
`

  if (userRequest?.trim()) {
    message += `\n【追加の指示・変更リクエスト】\n${userRequest.trim()}\n`
  }

  message += '\nJSON配列のみ出力してください。'
  return message
}

function parseParts(raw: string, totalParts: number): LineDistributionPart[] | null {
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0]) as unknown[]
    if (!Array.isArray(parsed) || parsed.length !== totalParts) return null
    for (const item of parsed) {
      if (
        typeof item !== 'object' ||
        item === null ||
        typeof (item as Record<string, unknown>).order !== 'number' ||
        typeof (item as Record<string, unknown>).title !== 'string' ||
        typeof (item as Record<string, unknown>).body !== 'string'
      ) return null
    }
    return parsed as LineDistributionPart[]
  } catch {
    return null
  }
}

export async function splitStoryForLine(params: {
  storyId: string
  totalParts: 2 | 3 | 4
  splittingStyle: SplittingStyle
  userRequest?: string
  parentHistory?: LineDistributionHistory
}): Promise<{
  parts: LineDistributionPart[]
  fullPrompt: string
  userMessage: string
  inputTokens: number
  outputTokens: number
  modelUsed: string
}> {
  const supabase = createServiceClient()

  const { data: story, error: storyError } = await supabase
    .from('stories')
    .select('id, theme, tone, title, body')
    .eq('id', params.storyId)
    .single()
  if (storyError || !story) throw new Error('ストーリーが見つかりません')

  const fullPrompt = buildSplitSystemPrompt(
    params.totalParts,
    params.splittingStyle,
    params.parentHistory?.generated_parts
  )
  const userMessage = buildUserMessage(story as Story, params.userRequest)

  const doCall = () => callClaude({
    model: MODELS.generate,
    max_tokens: 2048,
    system: fullPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  let response = await doCall()
  let rawText = response.content.find(c => c.type === 'text')?.text ?? ''
  let parts = parseParts(rawText, params.totalParts)

  // JSON生成失敗時リトライ1回
  if (!parts) {
    response = await doCall()
    rawText = response.content.find(c => c.type === 'text')?.text ?? ''
    parts = parseParts(rawText, params.totalParts)
  }

  if (!parts) {
    throw new Error(`分割結果のJSON解析に失敗しました。生成結果: ${rawText.slice(0, 200)}`)
  }

  return {
    parts,
    fullPrompt,
    userMessage,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    modelUsed: MODELS.generate,
  }
}
