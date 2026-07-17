/**
 * チャットブースト配信履歴CSVパーサー
 * - Shift-JIS / UTF-8 自動判定
 * - RFC 4180準拠（改行・カンマ・ダブルクォート含むフィールド対応）
 * - Cloudflare Workers互換（Node.js Buffer不使用）
 */

export type ChatboostCsvRow = {
  id: string
  deliveredAt: string
  deliveryFormat: string
  content: string
  sentCount: number | null
  openedCount: number | null
  openRate: number | null
  clickCount: number | null
  clickRate: number | null
}

export type ParseResult = {
  rows: ChatboostCsvRow[]
  errors: { lineNumber: number; reason: string }[]
}

/**
 * 配信日時文字列から日付部分を抽出
 * "2026/07/10 13:39" → "2026-07-10"
 */
export function extractDate(deliveredAt: string): string | null {
  const cleaned = deliveredAt.replace(/^["']|["']$/g, '').trim()
  const match = cleaned.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/)
  if (!match) return null
  const [, year, month, day] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

/**
 * 数値パース（パーセント記号除去、"-"はnull）
 * "65.7%" → 65.7, "-" → null, "" → null
 */
function parseNumber(value: string): number | null {
  const cleaned = value.trim().replace(/%$/, '').replace(/,/g, '')
  if (!cleaned || cleaned === '-') return null
  const num = Number(cleaned)
  return isNaN(num) ? null : num
}

/**
 * ArrayBufferからテキストをデコード（Shift-JIS / UTF-8 自動判定）
 */
function decodeBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)

  // UTF-8 BOM チェック
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(bytes)
  }

  // デフォルトはShift-JIS（チャットブーストの標準エンコーディング）
  return new TextDecoder('shift_jis').decode(bytes)
}

/**
 * RFC 4180準拠のCSVフィールド分割（改行・カンマ・ダブルクォート対応）
 * scripts/ingest/mail.ts のアルゴリズムを参考に9列対応版として実装
 */
function parseFields(lines: string[], startIndex: number): { fields: string[]; nextIndex: number } | null {
  if (startIndex >= lines.length) return null

  let fullLine = lines[startIndex]
  if (!fullLine.trim()) return null

  let nextLine = startIndex + 1

  // クォート内の改行を結合：ダブルクォートの数が奇数なら次の行と結合
  let quoteCount = (fullLine.match(/"/g) || []).length
  while (quoteCount % 2 !== 0 && nextLine < lines.length) {
    fullLine += '\n' + lines[nextLine]
    quoteCount = (fullLine.match(/"/g) || []).length
    nextLine++
  }

  // フィールド分割
  const fields: string[] = []
  let inQuotes = false
  let current = ''
  let pos = 0

  while (pos <= fullLine.length) {
    const char = fullLine[pos]

    if (char === '"') {
      if (inQuotes && fullLine[pos + 1] === '"') {
        // エスケープされたダブルクォート
        current += '"'
        pos += 2
        continue
      }
      inQuotes = !inQuotes
      pos++
      continue
    }

    if (char === ',' && !inQuotes) {
      fields.push(current)
      current = ''
      pos++
      continue
    }

    if (pos === fullLine.length) {
      fields.push(current)
      break
    }

    current += char
    pos++
  }

  return { fields, nextIndex: nextLine }
}

/**
 * チャットブースト配信履歴CSVをパース
 *
 * CSV列構成:
 *   A: ID, B: 配信日時, C: 配信形式, D: 配信内容,
 *   E: 送信数, F: 開封数, G: 開封率, H: URLクリック数, I: クリック率
 */
export function parseChatboostCsv(arrayBuffer: ArrayBuffer): ParseResult {
  const text = decodeBuffer(arrayBuffer)
  const lines = text.split('\n')
  const rows: ChatboostCsvRow[] = []
  const errors: ParseResult['errors'] = []

  // ヘッダー行をスキップ（行番号1）
  let i = 1
  let lineNumber = 2 // CSVの行番号（ヘッダー=1なのでデータは2から）

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      lineNumber++
      continue
    }

    const result = parseFields(lines, i)
    if (!result) {
      i++
      lineNumber++
      continue
    }

    const { fields, nextIndex } = result

    // 必須列チェック（ID, 配信日時, 配信内容の最低4列必要）
    if (fields.length < 4) {
      errors.push({ lineNumber, reason: '列数が不足しています（最低4列必要）' })
      i = nextIndex
      lineNumber++
      continue
    }

    const id = fields[0].trim()
    const deliveredAt = fields[1].trim()
    const content = fields[3].trim()

    if (!id) {
      errors.push({ lineNumber, reason: 'IDが空です' })
      i = nextIndex
      lineNumber++
      continue
    }

    if (!deliveredAt) {
      errors.push({ lineNumber, reason: '配信日時が空です' })
      i = nextIndex
      lineNumber++
      continue
    }

    rows.push({
      id,
      deliveredAt,
      deliveryFormat: fields[2]?.trim() || '',
      content,
      sentCount: fields.length > 4 ? parseNumber(fields[4]) : null,
      openedCount: fields.length > 5 ? parseNumber(fields[5]) : null,
      openRate: fields.length > 6 ? parseNumber(fields[6]) : null,
      clickCount: fields.length > 7 ? parseNumber(fields[7]) : null,
      clickRate: fields.length > 8 ? parseNumber(fields[8]) : null,
    })

    i = nextIndex
    lineNumber++
  }

  return { rows, errors }
}
