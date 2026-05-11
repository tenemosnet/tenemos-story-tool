// Claude API fetch wrapper（Cloudflare Workers互換）

export class ClaudeCreditError extends Error {
  constructor() {
    super('CLAUDE_CREDIT_EMPTY')
    this.name = 'ClaudeCreditError'
  }
}

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ClaudeResponse {
  content: Array<{ type: string; text?: string }>
  usage: { input_tokens: number; output_tokens: number }
}

export async function callClaude({
  model,
  max_tokens,
  system,
  messages,
}: {
  model: string
  max_tokens: number
  system: string
  messages: ClaudeMessage[]
}): Promise<ClaudeResponse> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens,
      system,
      messages,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    if (errorBody.includes('credit balance is too low') || errorBody.includes('Your credit balance')) {
      throw new ClaudeCreditError()
    }
    throw new Error(`Claude API error (${response.status}): ${errorBody}`)
  }

  return response.json()
}
