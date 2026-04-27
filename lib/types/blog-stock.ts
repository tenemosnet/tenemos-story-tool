export type BlogStock = {
  id: string
  title: string
  body: string
  story_id: string | null
  stock_idea_id: string | null
  template_id: string | null
  article_type: string | null
  output_format: 'html' | 'markdown'
  scheduled_date: string | null
  is_done: boolean
  created_at: string
  updated_at: string
}
