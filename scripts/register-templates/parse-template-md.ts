import * as fs from 'fs'

export type ParsedTemplate = {
  slug: string
  name: string
  format: 'mail' | 'wordpress'
  output_format: 'html' | 'markdown' | 'text'
  is_active: boolean
  sort_order: number
  description: string
  system_prompt: string
  structure_spec: object
}

/**
 * MDファイルをパースして ParsedTemplate を返す
 */
export function parseTemplateMd(filePath: string): ParsedTemplate {
  const content = fs.readFileSync(filePath, 'utf-8')
  const fileName = filePath.split('/').pop() || filePath

  // 【1】基本情報の抽出
  const basicInfo = extractBasicInfo(content, fileName)

  // 【2】description
  const description = extractCodeBlock(content, '【2】', fileName)
  if (!description) {
    throw new Error(`[${fileName}] 【2】description のコードブロックが見つかりません`)
  }

  // 【3】system_prompt
  const systemPrompt = extractCodeBlock(content, '【3】', fileName)
  if (!systemPrompt) {
    throw new Error(`[${fileName}] 【3】system_prompt のコードブロックが見つかりません`)
  }

  // 【4】structure_spec (JSON)
  const structureSpecRaw = extractCodeBlock(content, '【4】', fileName)
  if (!structureSpecRaw) {
    throw new Error(`[${fileName}] 【4】structure_spec のコードブロックが見つかりません`)
  }

  let structureSpec: object
  try {
    structureSpec = JSON.parse(structureSpecRaw)
  } catch (e) {
    throw new Error(`[${fileName}] structure_spec のJSONパースに失敗: ${(e as Error).message}`)
  }

  return {
    ...basicInfo,
    description: description.trim(),
    system_prompt: systemPrompt.trim(),
    structure_spec: structureSpec,
  }
}

/**
 * 【1】基本情報テーブルからキー・値ペアを抽出
 */
function extractBasicInfo(content: string, fileName: string) {
  // 【1】セクションを見つける
  const sectionMatch = content.match(/##\s*【1】[^\n]*\n([\s\S]*?)(?=\n##\s*【|$)/)
  if (!sectionMatch) {
    throw new Error(`[${fileName}] 【1】基本情報セクションが見つかりません`)
  }

  const section = sectionMatch[1]
  const rows = section.match(/\|\s*\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|/g)
  if (!rows || rows.length === 0) {
    throw new Error(`[${fileName}] 【1】基本情報テーブルの行が見つかりません`)
  }

  const kvMap: Record<string, string> = {}
  for (const row of rows) {
    const match = row.match(/\|\s*\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|/)
    if (match) {
      const key = match[1].trim()
      // バッククォートを除去
      const value = match[2].trim().replace(/`/g, '')
      kvMap[key] = value
    }
  }

  // 必須項目チェック
  const requiredKeys = ['slug', 'name', 'format', 'output_format']
  for (const key of requiredKeys) {
    if (!kvMap[key]) {
      throw new Error(`[${fileName}] 基本情報に必須項目 "${key}" がありません`)
    }
  }

  // slug検証
  if (!/^[a-z0-9_]+$/.test(kvMap['slug'])) {
    throw new Error(`[${fileName}] slug "${kvMap['slug']}" は英小文字・数字・アンダースコアのみ使用できます`)
  }

  // format検証
  if (!['mail', 'wordpress'].includes(kvMap['format'])) {
    throw new Error(`[${fileName}] format "${kvMap['format']}" は不正です（許容値: mail, wordpress）`)
  }

  // output_format検証
  if (!['html', 'markdown', 'text'].includes(kvMap['output_format'])) {
    throw new Error(`[${fileName}] output_format "${kvMap['output_format']}" は不正です（許容値: html, markdown, text）`)
  }

  return {
    slug: kvMap['slug'],
    name: kvMap['name'],
    format: kvMap['format'] as 'mail' | 'wordpress',
    output_format: kvMap['output_format'] as 'html' | 'markdown' | 'text',
    is_active: kvMap['is_active'] ? kvMap['is_active'].toLowerCase() === 'true' : true,
    sort_order: kvMap['sort_order'] ? parseInt(kvMap['sort_order'], 10) || 0 : 0,
  }
}

/**
 * 指定セクションの最初のコードブロック内容を抽出
 */
function extractCodeBlock(content: string, sectionMarker: string, fileName: string): string | null {
  // セクション見出しを見つける
  const escapedMarker = sectionMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const sectionRegex = new RegExp(`##\\s*${escapedMarker}[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s*【|$)`)
  const sectionMatch = content.match(sectionRegex)
  if (!sectionMatch) return null

  const section = sectionMatch[1]

  // コードブロックを抽出（```json or ``` のどちらも対応）
  const codeBlockMatch = section.match(/```(?:json)?\s*\n([\s\S]*?)```/)
  if (!codeBlockMatch) return null

  return codeBlockMatch[1]
}
