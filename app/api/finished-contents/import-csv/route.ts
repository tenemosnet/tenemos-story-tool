import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parseChatboostCsv, extractDate } from '@/lib/importers/chatboost-line-csv'

// 遡及対象の開始日（これより前の配信はスキップ）
const CUTOFF_DATE = '2026-06-01'

type ImportCsvResponse = {
  totalRows: number
  matched: number
  created: number
  skipped: number
  errors: { rowNumber: number; reason: string }[]
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'CSVファイルが必要です' }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ error: 'CSVファイルのみ対応しています' }, { status: 400 })
    }

    // CSVパース
    const arrayBuffer = await file.arrayBuffer()
    const { rows, errors: parseErrors } = parseChatboostCsv(arrayBuffer)

    if (rows.length === 0 && parseErrors.length > 0) {
      return NextResponse.json({
        error: 'CSVの解析に失敗しました',
        details: parseErrors,
      }, { status: 400 })
    }

    const supabase = createServiceClient()

    // 既存のchatboost_delivery_idを一括取得（重複チェック用）
    const { data: existingIds } = await supabase
      .from('finished_contents')
      .select('chatboost_delivery_id')
      .not('chatboost_delivery_id', 'is', null)

    const existingIdSet = new Set(
      (existingIds || []).map(r => r.chatboost_delivery_id)
    )

    const result: ImportCsvResponse = {
      totalRows: rows.length,
      matched: 0,
      created: 0,
      skipped: 0,
      errors: parseErrors.map(e => ({ rowNumber: e.lineNumber, reason: e.reason })),
    }

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx]
      const rowNumber = idx + 2 // ヘッダー行=1、データ行は2から

      // 日付抽出
      const scheduledDate = extractDate(row.deliveredAt)
      if (!scheduledDate) {
        result.errors.push({
          rowNumber,
          reason: `日付フォーマットが不正です: "${row.deliveredAt}"`,
        })
        continue
      }

      // 遡及対象外チェック
      if (scheduledDate < CUTOFF_DATE) {
        continue // カウントしない（対象外期間）
      }

      // 重複チェック
      if (existingIdSet.has(row.id)) {
        result.skipped++
        continue
      }

      // 既存のLINE配信予定を検索（同日・chatboost_delivery_id未設定のもの）
      const { data: candidates, error: searchError } = await supabase
        .from('finished_contents')
        .select('id')
        .eq('type', 'line')
        .eq('scheduled_date', scheduledDate)
        .is('chatboost_delivery_id', null)

      if (searchError) {
        result.errors.push({
          rowNumber,
          reason: `DB検索エラー: ${searchError.message}`,
        })
        continue
      }

      if (candidates && candidates.length > 1) {
        // 同日に複数のLINE配信予定 → 安全側で自動更新せずエラー報告
        result.errors.push({
          rowNumber,
          reason: `${scheduledDate}に複数のLINE配信予定があるため手動確認が必要です`,
        })
        continue
      }

      if (candidates && candidates.length === 1) {
        // 既存レコードを更新（title, is_done, chatboost_delivery_id のみ。line_delivery_typeは保持）
        const { error: updateError } = await supabase
          .from('finished_contents')
          .update({
            title: row.content,
            is_done: true,
            chatboost_delivery_id: row.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', candidates[0].id)

        if (updateError) {
          result.errors.push({
            rowNumber,
            reason: `更新エラー: ${updateError.message}`,
          })
          continue
        }
        result.matched++
      } else {
        // 新規レコード作成
        const { error: insertError } = await supabase
          .from('finished_contents')
          .insert({
            title: row.content,
            body: '',
            type: 'line',
            line_delivery_type: 'broadcast',
            scheduled_date: scheduledDate,
            is_done: true,
            chatboost_delivery_id: row.id,
          })

        if (insertError) {
          result.errors.push({
            rowNumber,
            reason: `作成エラー: ${insertError.message}`,
          })
          continue
        }
        result.created++
      }

      // 統計データをUPSERT（chatboost_delivery_statsテーブル）
      const deliveredAtDate = row.deliveredAt.replace(/^["']|["']$/g, '').trim()
      const isoDeliveredAt = deliveredAtDate.replace(/\//g, '-').replace(' ', 'T') + ':00+09:00'

      await supabase
        .from('chatboost_delivery_stats')
        .upsert({
          chatboost_delivery_id: row.id,
          delivery_format: row.deliveryFormat || null,
          sent_count: row.sentCount,
          opened_count: row.openedCount,
          open_rate: row.openRate,
          click_count: row.clickCount,
          click_rate: row.clickRate,
          delivered_at: isoDeliveredAt,
        }, { onConflict: 'chatboost_delivery_id' })

      // 重複チェック用Setに追加（同一CSV内の重複防止）
      existingIdSet.add(row.id)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('CSV取込エラー:', error)
    return NextResponse.json(
      { error: 'CSV取込処理に失敗しました' },
      { status: 500 }
    )
  }
}
