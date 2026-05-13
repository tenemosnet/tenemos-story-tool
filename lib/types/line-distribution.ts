export type SplittingStyle = 'subtle' | 'explicit' | 'none'

export type LineDistributionPart = {
  order: number
  title: string
  body: string
}

export type LineDistribution = {
  id: string
  story_id: string | null
  stock_idea_id: string | null
  parts: LineDistributionPart[]
  total_parts: number
  splitting_style: SplittingStyle
  user_request: string | null
  is_done: boolean[]
  scheduled_dates: string[]
  created_at: string
  updated_at: string
}

export type LineDistributionHistory = {
  id: string
  line_distribution_id: string
  story_id: string | null
  total_parts: number
  splitting_style: SplittingStyle
  user_request: string | null
  full_prompt: string
  user_message: string
  generated_parts: LineDistributionPart[]
  input_tokens: number
  output_tokens: number
  cost_usd: number
  cost_jpy: number
  is_regeneration: boolean
  parent_history_id: string | null
  model_used: string
  created_at: string
}

export type SplitLineRequest = {
  story_id: string
  total_parts: 2 | 3 | 4
  splitting_style: SplittingStyle
  user_request?: string
  parent_history_id?: string
}

export type SplitLineResponse = {
  line_distribution_id: string
  history_id: string
  parts: LineDistributionPart[]
  total_parts: number
  input_tokens: number
  output_tokens: number
  cost_usd: number
  cost_jpy: number
}
