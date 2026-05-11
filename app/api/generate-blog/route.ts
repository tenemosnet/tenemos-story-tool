import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateBlogArticle } from '@/lib/converters/blog'
import { calculateCostUsd, convertUsdToJpy } from '@/lib/config'
import { ClaudeCreditError } from '@/lib/claude'

export async function POST(request: NextRequest) {
  try {
    const { story_id, template_id, user_request, parent_history_id } =
      await request.json()

    if (!story_id?.trim()) {
      return NextResponse.json({ error: 'story_id が必要です' }, { status: 400 })
    }
    if (!template_id?.trim()) {
      return NextResponse.json({ error: 'template_id が必要です' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // 再生成時：親履歴を取得
    let parentHistory = undefined
    let existingStockId: string | undefined = undefined

    if (parent_history_id) {
      const { data: parentData, error: parentError } = await supabase
        .from('blog_generation_history')
        .select('*')
        .eq('id', parent_history_id)
        .single()
      if (parentError || !parentData) {
        return NextResponse.json({ error: '親履歴が見つかりません' }, { status: 404 })
      }
      parentHistory = parentData
      existingStockId = parentData.blog_stock_id
    }

    // テンプレートのslugを取得
    const { data: template, error: templateError } = await supabase
      .from('output_templates')
      .select('id, slug')
      .eq('id', template_id)
      .single()
    if (templateError || !template) {
      return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 })
    }

    // ブログ記事生成
    const result = await generateBlogArticle({
      storyId: story_id,
      templateId: template_id,
      userRequest: user_request,
      parentHistory,
    })

    // 料金計算
    const costUsd = calculateCostUsd(result.inputTokens, result.outputTokens)
    const costJpy = convertUsdToJpy(costUsd)

    let blogStockId: string

    if (existingStockId) {
      // 再生成：既存ストックを上書き
      const { data: updated, error: updateError } = await supabase
        .from('blog_stocks')
        .update({
          title: result.title,
          body: result.body,
          template_id: template_id,
          article_type: template.slug,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingStockId)
        .select('id')
        .single()
      if (updateError || !updated) throw new Error('ブログストックの更新に失敗しました')
      blogStockId = updated.id
    } else {
      // 初回：ストック新規作成
      const { data: inserted, error: insertError } = await supabase
        .from('blog_stocks')
        .insert({
          title: result.title,
          body: result.body,
          story_id: story_id,
          template_id: template_id,
          article_type: template.slug,
          output_format: 'html',
        })
        .select('id')
        .single()
      if (insertError || !inserted) throw new Error('ブログストックの保存に失敗しました')
      blogStockId = inserted.id
    }

    // 生成履歴を保存
    const { data: history, error: historyError } = await supabase
      .from('blog_generation_history')
      .insert({
        blog_stock_id: blogStockId,
        story_id: story_id,
        template_id: template_id,
        template_slug: template.slug,
        user_request: user_request ?? null,
        full_prompt: result.fullPrompt,
        user_message: result.userMessage,
        generated_body: result.body,
        generated_title: result.title,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        cost_usd: costUsd,
        cost_jpy: costJpy,
        is_regeneration: !!parent_history_id,
        parent_history_id: parent_history_id ?? null,
        model_used: result.modelUsed,
      })
      .select('id')
      .single()
    if (historyError || !history) throw new Error('生成履歴の保存に失敗しました')

    return NextResponse.json({
      blog_stock_id: blogStockId,
      history_id: history.id,
      title: result.title,
      body: result.body,
      template_slug: template.slug,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: costUsd,
      cost_jpy: costJpy,
    })
  } catch (error) {
    console.error('ブログ記事生成エラー:', error)
    if (error instanceof ClaudeCreditError) {
      return NextResponse.json(
        { error: '⚠️ Claude APIのクレジットが不足しています。console.anthropic.com の「Plans & Billing」でチャージしてください。' },
        { status: 402 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成に失敗しました' },
      { status: 500 }
    )
  }
}
