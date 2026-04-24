export type OutputTemplateFormat = 'mail' | 'wordpress'
export type OutputFormat = 'html' | 'markdown' | 'text'

export type StructureSpec = {
  // 共通フィールド
  sections?: SectionSpec[]
  tone_ref?: string
  length?: { min?: number; max?: number }

  // WordPress用オプション
  article_types?: ArticleTypeSpec[]
  categories?: string[]
  featured_image_prompt?: boolean
  body_image_suggestions?: boolean
  external_links_allowed?: boolean
  bold_emphasis_encouraged?: boolean
  include_toc?: boolean

  // メール用オプション
  fixed_header?: string
  fixed_footer?: string
  separators?: {
    column?: string
    product?: string
    footer?: string
    motto?: string
  }
  seasonal_greeting?: boolean
  unsubscribe_url?: string

  // 拡張用
  [key: string]: unknown
}

export type SectionSpec = {
  name: string
  required: boolean
  guide?: string
  min?: number
  max?: number
  max_chars?: number
  variants?: Record<string, unknown>
}

export type ArticleTypeSpec = {
  slug: string
  name: string
  length_min: number
  length_max: number
  lead_length_guide: string
  summary_style: string
}

export type OutputTemplate = {
  id: string
  slug: string
  name: string
  format: OutputTemplateFormat
  description: string | null
  system_prompt: string
  structure_spec: StructureSpec
  output_format: OutputFormat
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}
