import { createServiceClient } from '@/lib/supabase'

/**
 * Supabaseからナレッジデータを取得してシステムプロンプトを動的に組み立てる
 * Phase 2でナレッジ収集機能を実装後、ここに自動的に反映される
 */
export async function buildSystemPrompt(): Promise<string> {
  let productsSection = ''
  let knowledgeSection = ''

  try {
    const supabase = createServiceClient()

    // 商品データを取得
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .order('name')

    if (products && products.length > 0) {
      productsSection = products.map(p =>
        `- ${p.name}（${p.category || '未分類'}）: ${p.price ? `¥${p.price.toLocaleString()}` : '価格未設定'}\n  ${p.description || ''}\n  特徴: ${(p.features || []).join('、')}\n  使い方: ${p.usage_text || ''}`
      ).join('\n\n')
    }

    // ナレッジデータを取得（ブランド情報・トーン規定など）
    const { data: knowledge } = await supabase
      .from('knowledge_sources')
      .select('*')
      .order('collected_at', { ascending: false })

    if (knowledge && knowledge.length > 0) {
      const brandKnowledge = knowledge.filter(k => k.category === 'brand')
      const toneKnowledge = knowledge.filter(k => k.category === 'tone')
      const sampleKnowledge = knowledge.filter(k => k.category === 'sample')

      if (brandKnowledge.length > 0) {
        knowledgeSection += `\n\n【ブランド情報】\n${brandKnowledge.map(k => k.content).join('\n')}`
      }
      if (toneKnowledge.length > 0) {
        knowledgeSection += `\n\n【トーン規定】\n${toneKnowledge.map(k => k.content).join('\n')}`
      }
      if (sampleKnowledge.length > 0) {
        knowledgeSection += `\n\n【参考原稿】\n以下は過去の良い配信原稿の例です。トーンや構成を参考にしてください。\n${sampleKnowledge.map(k => k.content).join('\n---\n')}`
      }

      // フィードバックデータを取得（直近20件）
      const feedbackKnowledge = knowledge.filter(k => k.category === 'feedback')
      if (feedbackKnowledge.length > 0) {
        const recentFeedback = feedbackKnowledge.slice(0, 20)
        knowledgeSection += `\n\n【過去のフィードバック】\n以下はスタッフからの修正指示・改善要望です。同じ傾向の指摘は重点的に反映してください。\n${recentFeedback.map(k => k.content).join('\n---\n')}`
      }
    }
  } catch (error) {
    console.error('ナレッジ取得エラー:', error)
  }

  return `
あなたはテネモスネット（株式会社テネモスネット）のLINE公式アカウント用ストーリー配信コンテンツを作成するライターです。

【ブランドについて】
テネモスネットは「水・空気を活かす」をコンセプトに、自然の仕組みをお手本にした製品を開発・販売しています。
創業者・飯島秀行の「自然の仕組みに学ぶ」という哲学が根底にあります。
キーワード：自然の仕組み、振動圧、活水、発酵、空気活性、分かち合い
${knowledgeSection}

${productsSection ? `【商品カタログ】\n${productsSection}` : `【商品について】
主な商品カテゴリ：
- 活水器（マナウォーターシリーズ）：水道水を活性化
- 空気活性器（クッキングセラピー、バンブーなど）：室内の空気を活性化
- 健康関連（酵素水、Ag・uA water）：体のケア
- 生活用品（ピッコロ、洗剤など）：日常で使える自然派製品`}

【ターゲット】
50代中心のミドル・シニア層、男女比4:6（女性やや多め）。
健康・エコ・自然の仕組み・ナチュラル志向に関心が高い。

【配信目的】
教育・ファン化が中心。販促よりも価値提供を優先。
「分かち合い」の姿勢で、あたたかく誠実に。押しつけない。

【重要なルール】
- テネモスの世界観を尊重すること
- 「買ってください」的な直接的な販促表現は避ける
- 専門用語を使う場合は必ずかみ砕いた説明を添える
- 読み手が「なるほど」「やってみたい」と思える内容にする

【出力形式】
以下のJSON形式のみ出力してください。他の文字は不要です：
{"tone":"トーン名","title":"タイトル20字以内","body":"本文","hashtags":["タグ1","タグ2","タグ3"]}
  `.trim()
}

/**
 * トーン定義
 */
export const TONES = {
  gentle: {
    label: 'やさしい',
    emoji: '🌿',
    instruction: '親しみやすく友人に語りかけるような対話調。敬語は使うが堅すぎない。「〜ですね」「〜かもしれません」のような柔らかい表現を使う。',
  },
  expert: {
    label: '専門的',
    emoji: '📖',
    instruction: '原理や仕組みを丁寧に解説する教育調。知的好奇心をくすぐる。「実は〜」「〜という仕組みがあります」のような知識を共有する表現を使う。',
  },
  casual: {
    label: 'カジュアル',
    emoji: '✨',
    instruction: '軽やかで読みやすいマガジン風。テンポよく要点を伝える。短文を多用し、読みやすいリズムを作る。',
  },
} as const

export type ToneKey = keyof typeof TONES

/**
 * 配信テーマプリセット
 */
export const THEME_PRESETS = [
  { id: 'nature', label: '自然の仕組み', description: '水の循環、発酵の不思議、空気の力' },
  { id: 'lifestyle', label: '暮らしのヒント', description: 'マナウォーター活用術、酵素水の使い方' },
  { id: 'seasonal', label: '季節ネタ', description: '今の季節に合った養生・暮らしの知恵' },
  { id: 'voice', label: 'お客様の声', description: '体験談・使い方アイデアの紹介' },
  { id: 'philosophy', label: 'テネモス哲学', description: '飯島先生の言葉、「わたしたちは持っている」' },
  { id: 'campaign', label: '新商品・キャンペーン', description: '新製品の紹介、期間限定キャンペーン' },
] as const

/**
 * 現在の季節情報を取得
 */
function getSeasonInfo(): { date: string; season: string; description: string } {
  const now = new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const date = `${now.getFullYear()}年${month}月${day}日`

  if (month >= 3 && month <= 5) {
    return { date, season: '春', description: '花粉の季節、新生活、春の陽気、桜、新緑の芽吹き' }
  } else if (month >= 6 && month <= 8) {
    return { date, season: '夏', description: '梅雨、暑さ対策、紫外線、水分補給、夏バテ防止' }
  } else if (month >= 9 && month <= 11) {
    return { date, season: '秋', description: '実りの秋、乾燥の始まり、食欲の秋、冷え対策' }
  } else {
    return { date, season: '冬', description: '乾燥対策、冷え込み、年末年始、温活、免疫ケア' }
  }
}

/**
 * ユーザープロンプトを組み立てる
 */
export function buildUserPrompt(params: {
  theme: string
  length: number
  product: string
  tone: { label: string; instruction: string }
  referenceBody?: string
}): string {
  const season = getSeasonInfo()

  let referenceSection = ''
  if (params.referenceBody) {
    referenceSection = `
【参考にする原稿】
以下は過去に好評だった配信原稿です。この原稿の文体・構成・雰囲気を参考にしつつ、新しいオリジナルの内容を作成してください。丸写しはせず、良いところを活かして新しい切り口で書いてください。
---
${params.referenceBody}
---
`
  }

  return `
以下の条件でLINEストーリー配信コンテンツを1つ作成してください。

【本日の日付】${season.date}（${season.season}）
【季節の参考キーワード】${season.description}
【配信テーマ】${params.theme}
【文字数目安】約${params.length}字
【強調商品】${params.product || '指定なし'}
【トーン】${params.tone.label}（${params.tone.instruction}）
${referenceSection}
※季節感のあるテーマの場合は、必ず今の時期に合った内容にしてください。
JSONのみ出力してください。
  `.trim()
}
