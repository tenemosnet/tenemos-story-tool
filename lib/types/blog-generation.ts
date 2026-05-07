export type BlogGenerationHistory = {
  id: string
  blog_stock_id: string
  story_id: string | null
  template_id: string | null
  template_slug: string
  user_request: string | null
  full_prompt: string
  user_message: string
  generated_body: string
  generated_title: string | null
  input_tokens: number
  output_tokens: number
  cost_usd: number
  cost_jpy: number
  is_regeneration: boolean
  parent_history_id: string | null
  model_used: string
  created_at: string
}

export type GenerateBlogRequest = {
  story_id: string
  template_id: string
  user_request?: string
  parent_history_id?: string
}

export type GenerateBlogResponse = {
  blog_stock_id: string
  history_id: string
  title: string
  body: string
  template_slug: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  cost_jpy: number
}

export type WPArticleType = 'howto' | 'philosophical' | 'staff_recommend'
