/**
 * Mistral AI client via OpenRouter
 * Drop-in replacement for all Ollama calls in the codebase.
 *
 * 'large' → mistralai/mistral-large-latest        (articles, bridge copy, lead magnets)
 * 'small' → mistralai/mistral-small-3.2-24b-instruct (captions, FAQs, CTAs, extraction)
 */

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

const MODEL_MAP = {
  large: 'mistralai/mistral-large-latest',
  small: 'mistralai/mistral-small-3.2-24b-instruct',
} as const

export type MistralModel = keyof typeof MODEL_MAP

export async function callMistral(
  prompt: string,
  size: MistralModel = 'small',
  temperature = 0.2,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('[mistral] OPENROUTER_API_KEY not set')

  const resp = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.APP_BASE_URL ?? 'https://app.digitalfinds.net',
      'X-Title': 'Affiliate Castle',
    },
    body: JSON.stringify({
      model: MODEL_MAP[size],
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: size === 'large' ? 4000 : 1200,
    }),
    signal: AbortSignal.timeout(60_000),
  })

  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`[mistral] OpenRouter HTTP ${resp.status}: ${body.slice(0, 200)}`)
  }

  const data = await resp.json() as {
    choices: [{ message: { content: string } }]
  }
  return data.choices[0]?.message?.content?.trim() ?? ''
}
