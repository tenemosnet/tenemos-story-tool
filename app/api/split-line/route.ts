import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { splitStoryForLine } from '@/lib/converters/line-split'
import { calculateCostUsd, convertUsdToJpy } from '@/lib/config'
import { ClaudeCreditError } from '@/lib/claude'
import type { SplittingStyle } from '@/lib/types/line-distribution'

export async function POST(request: NextRequest) {
  try {
    const { story_id, total_parts, splitting_style, user_request, parent_history_id } =
      await request.json() as {
        story_id: string
        total_parts: 2 | 3 | 4
        splitting_style: SplittingStyle
        user_request?: string
        parent_history_id?: string
      }

    if (!story_id?.trim()) {
      return NextResponse.json({ error: 'story_id が必要です' }, { status: 400 })
    }
    if (![2, 3, 4].includes(total_parts)) {
      return NextResponse.json({ error: 'total_parts は 2/3/4 のいずれかです' }, { status: 400 })
    }
    if (!['subtle', 'explicit', 'none'].includes(splitting_style)) {
      return NextResponse.json({ error: 'splitting_style が不正です' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // 再分割時：親履歴から既存レコードIDを引き継ぐ
    let existingDistributionId: string | null = null
    let parentHistory = undefined
    if (parent_history_id) {
      const { data: hist, error } = await supabase
        .from('line_distribution_history')
        .select('*')
        .eq('id', parent_history_id)
        .single()
      if (error || !hist) {
        return NextResponse.json({ error: '親履歴が見つかりません' }, { status: 404 })
      }
      existingDistributionId = hist.line_distribution_id
      parentHistory = hist
    }

    // 分割実行
    const { parts, fullPrompt, userMessage, inputTokens, outputTokens, modelUsed } =
      await splitStoryForLine({
        storyId: story_id,
        totalParts: total_parts,
        splittingStyle: splitting_style,
        userRequest: user_request,
        parentHistory: parentHistory ?? undefined,
      })

    const costUsd = calculateCostUsd(inputTokens, outputTokens)
    const costJpy = convertUsdToJpy(costUsd)

    // is_done / scheduled_dates を total_parts 分の初期値で生成
    const initialIsDone = Array(total_parts).fill(false) as boolean[]
    const initialDates = Array(total_parts).fill(null) as null[]

    // line_distributions: 初回INSERT / 再分割はUPDATE
    let distributionId: string
    if (existingDistributionId) {
      const { error: updateError } = await supabase
        .from('line_distributions')
        .update({
          parts,
          total_parts,
          splitting_style,
          user_request: user_request ?? null,
          is_done: initialIsDone,
          scheduled_dates: initialDates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingDistributionId)
      if (updateError) throw updateError
      distributionId = existingDistributionId
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('line_distributions')
        .insert({
          story_id,
          parts,
          total_parts,
          splitting_style,
          user_request: user_request ?? null,
          is_done: initialIsDone,
          scheduled_dates: initialDates,
        })
        .select('id')
        .single()
      if (insertError || !inserted) throw insertError ?? new Error('INSERT失敗')
      distributionId = inserted.id
    }

    // 履歴INSERT
    const { data: history, error: historyError } = await supabase
      .from('line_distribution_history')
      .insert({
        line_distribution_id: distributionId,
        story_id,
        total_parts,
        splitting_style,
        user_request: user_request ?? null,
        full_prompt: fullPrompt,
        user_message: userMessage,
        generated_parts: parts,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd,
        cost_jpy: costJpy,
        is_regeneration: !!parent_history_id,
        parent_history_id: parent_history_id ?? null,
        model_used: modelUsed,
      })
      .select('id')
      .single()
    if (historyError || !history) throw historyError ?? new Error('履歴INSERT失敗')

    return NextResponse.json({
      line_distribution_id: distributionId,
      history_id: history.id,
      parts,
      total_parts,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      cost_jpy: costJpy,
    })
  } catch (error) {
    console.error('LINE分割エラー:', error)
    if (error instanceof ClaudeCreditError) {
      return NextResponse.json(
        { error: '⚠️ Claude APIのクレジットが不足しています。console.anthropic.com の「Plans & Billing」でチャージしてください。' },
        { status: 402 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '分割に失敗しました' },
      { status: 500 }
    )
  }
}
