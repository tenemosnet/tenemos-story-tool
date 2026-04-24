import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// 出力テンプレート一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format')
    const includeInactive = searchParams.get('include_inactive') === 'true'

    const supabase = createServiceClient()
    let query = supabase
      .from('output_templates')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }
    if (format && (format === 'mail' || format === 'wordpress')) {
      query = query.eq('format', format)
    }

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('出力テンプレート取得エラー:', error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

// 出力テンプレート新規作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { slug, name, format, description, system_prompt, structure_spec, output_format, sort_order } = body

    if (!slug || !name || !format || !system_prompt || !output_format) {
      return NextResponse.json({ error: '必須項目が不足しています（slug, name, format, system_prompt, output_format）' }, { status: 400 })
    }

    if (!/^[a-z0-9_]+$/.test(slug)) {
      return NextResponse.json({ error: 'slugは英小文字・数字・アンダースコアのみ使用できます' }, { status: 400 })
    }

    if (!['mail', 'wordpress'].includes(format)) {
      return NextResponse.json({ error: 'formatはmail またはwordpress のみ指定できます' }, { status: 400 })
    }

    if (!['html', 'markdown', 'text'].includes(output_format)) {
      return NextResponse.json({ error: 'output_formatはhtml / markdown / text のみ指定できます' }, { status: 400 })
    }

    // structure_spec のJSON妥当性チェック
    let parsedSpec = {}
    if (structure_spec) {
      if (typeof structure_spec === 'string') {
        try {
          parsedSpec = JSON.parse(structure_spec)
        } catch {
          return NextResponse.json({ error: 'structure_specが正しいJSON形式ではありません' }, { status: 400 })
        }
      } else {
        parsedSpec = structure_spec
      }
    }

    const supabase = createServiceClient()

    // slug一意性チェック
    const { data: existing } = await supabase
      .from('output_templates')
      .select('id')
      .eq('slug', slug)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: `slug "${slug}" は既に使用されています` }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('output_templates')
      .insert({
        slug,
        name,
        format,
        description: description || null,
        system_prompt,
        structure_spec: parsedSpec,
        output_format,
        sort_order: sort_order ?? 0,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('出力テンプレート作成エラー:', error)
    return NextResponse.json({ error: '作成に失敗しました' }, { status: 500 })
  }
}

// 出力テンプレート更新
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, format, description, system_prompt, structure_spec, output_format, is_active, sort_order } = body

    if (!id) {
      return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
    }

    // structure_spec のJSON妥当性チェック
    let parsedSpec: Record<string, unknown> | undefined
    if (structure_spec !== undefined) {
      if (typeof structure_spec === 'string') {
        try {
          parsedSpec = JSON.parse(structure_spec)
        } catch {
          return NextResponse.json({ error: 'structure_specが正しいJSON形式ではありません' }, { status: 400 })
        }
      } else {
        parsedSpec = structure_spec
      }
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (name !== undefined) updates.name = name
    if (format !== undefined) updates.format = format
    if (description !== undefined) updates.description = description
    if (system_prompt !== undefined) updates.system_prompt = system_prompt
    if (parsedSpec !== undefined) updates.structure_spec = parsedSpec
    if (output_format !== undefined) updates.output_format = output_format
    if (is_active !== undefined) updates.is_active = is_active
    if (sort_order !== undefined) updates.sort_order = sort_order

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('output_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('出力テンプレート更新エラー:', error)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}

// 出力テンプレート論理削除
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('output_templates')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('出力テンプレート削除エラー:', error)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}

// 特殊操作（複製・有効/無効切替）
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, action } = body

    if (!id || !action) {
      return NextResponse.json({ error: 'IDとactionが必要です' }, { status: 400 })
    }

    const supabase = createServiceClient()

    if (action === 'toggle') {
      // 有効/無効切替
      const { data: current, error: fetchError } = await supabase
        .from('output_templates')
        .select('is_active')
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError
      if (!current) {
        return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 })
      }

      const { data, error } = await supabase
        .from('output_templates')
        .update({ is_active: !current.is_active, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json(data)
    }

    if (action === 'duplicate') {
      // 複製
      const { data: original, error: fetchError } = await supabase
        .from('output_templates')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError
      if (!original) {
        return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 })
      }

      // 新しいslugを生成（_copy, _copy2, _copy3...）
      let newSlug = `${original.slug}_copy`
      let suffix = 1
      while (true) {
        const { data: exists } = await supabase
          .from('output_templates')
          .select('id')
          .eq('slug', newSlug)
          .limit(1)

        if (!exists || exists.length === 0) break
        suffix++
        newSlug = `${original.slug}_copy${suffix}`
      }

      const { data, error } = await supabase
        .from('output_templates')
        .insert({
          slug: newSlug,
          name: `${original.name}（コピー）`,
          format: original.format,
          description: original.description,
          system_prompt: original.system_prompt,
          structure_spec: original.structure_spec,
          output_format: original.output_format,
          is_active: false,
          sort_order: original.sort_order,
        })
        .select()
        .single()

      if (error) throw error
      return NextResponse.json(data)
    }

    return NextResponse.json({ error: '不明なactionです' }, { status: 400 })
  } catch (error) {
    console.error('出力テンプレート操作エラー:', error)
    return NextResponse.json({ error: '操作に失敗しました' }, { status: 500 })
  }
}
