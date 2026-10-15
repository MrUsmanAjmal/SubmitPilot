/**
 * Provider-neutral text generation. Gemini (free tier available) is preferred when
 * GEMINI_API_KEY is set; Anthropic Claude is used when only ANTHROPIC_API_KEY is set.
 */
export type AIProvider = 'gemini' | 'claude';
export function aiProvider(): AIProvider | null {
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.ANTHROPIC_API_KEY) return 'claude';
  return null;
}
export function aiConfigured(): boolean { return aiProvider() !== null; }
export function aiProviderLabel(): string { return aiProvider() === 'claude' ? 'Claude' : 'Gemini'; }

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), ms);
  try { return await run(controller.signal); }
  catch (e) { if (e instanceof Error && e.name === 'AbortError') throw new Error('The AI request timed out. Please retry.'); throw e; }
  finally { clearTimeout(timer); }
}

async function askGemini(system: string, user: string, maxTokens: number, json: boolean, signal: AbortSignal): Promise<string> {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY || '' },
    // Thinking models spend output tokens on reasoning, so the budget is kept generous.
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0, maxOutputTokens: Math.max(maxTokens * 4, 8192), ...(json ? { responseMimeType: 'application/json' } : {}) },
    }),
  });
  if (!response.ok) {
    const hint = response.status === 429 ? 'The free Gemini quota is exhausted for now; retry later.' : 'Check GEMINI_API_KEY and GEMINI_MODEL.';
    throw new Error(`Gemini API request failed (${response.status}). ${hint}`);
  }
  const data = await response.json() as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
  const text = (data.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('\n').trim();
  if (!text) throw new Error('Gemini returned an empty response.');
  return text;
}

async function askAnthropic(system: string, user: string, maxTokens: number, signal: AbortSignal): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929', max_tokens: maxTokens, temperature: 0, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!response.ok) throw new Error(`Claude API request failed (${response.status}). Check your key, model and account credits.`);
  const data = await response.json();
  return (data.content || []).filter((x: { type: string }) => x.type === 'text').map((x: { text: string }) => x.text).join('\n');
}

/** Sends one system + user prompt to the configured provider. Set json=true when the reply must be a JSON object. */
export async function askAI(system: string, user: string, maxTokens = 1200, json = false, timeoutMs = 38000): Promise<string> {
  const provider = aiProvider();
  if (!provider) throw new Error('No AI provider configured. Set GEMINI_API_KEY (free tier) or ANTHROPIC_API_KEY.');
  return withTimeout(timeoutMs, signal => provider === 'gemini' ? askGemini(system, user, maxTokens, json, signal) : askAnthropic(system, user, maxTokens, signal));
}

export type WebSource = { title: string; url: string };
/** Gemini with Google Search grounding. Returns the reply text and the web pages it relied on. */
export async function askAIWithWebSearch(system: string, user: string, maxTokens = 3000, timeoutMs = 45000): Promise<{ text: string; sources: WebSource[] }> {
  if (aiProvider() !== 'gemini') throw new Error('Web search requires GEMINI_API_KEY.');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  return withTimeout(timeoutMs, async signal => {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY || '' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0, maxOutputTokens: Math.max(maxTokens * 4, 8192) },
      }),
    });
    if (!response.ok) throw new Error(`Gemini web search failed (${response.status}).${response.status === 429 ? ' The free quota is exhausted for now.' : ''}`);
    const data = await response.json() as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] } }[] };
    const candidate = data.candidates?.[0];
    const text = (candidate?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('\n').trim();
    const sources = (candidate?.groundingMetadata?.groundingChunks || []).map(c => ({ title: c.web?.title || 'Web source', url: c.web?.uri || '' })).filter(s => s.url);
    return { text, sources };
  });
}
