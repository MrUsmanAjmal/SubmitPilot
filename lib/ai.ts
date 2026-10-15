/**
 * Provider-neutral text generation with automatic fallback. Configured providers are tried in
 * order (Gemini, Groq, OpenRouter free models, Anthropic). When one hits its rate or quota limit,
 * rejects its key or fails, it is paused for a while and the next one answers.
 */
export type AIProvider = 'gemini' | 'groq' | 'openrouter' | 'claude';
const ORDER: { id: AIProvider; label: string; envKey: string }[] = [
  { id: 'gemini', label: 'Gemini', envKey: 'GEMINI_API_KEY' },
  { id: 'groq', label: 'Groq', envKey: 'GROQ_API_KEY' },
  { id: 'openrouter', label: 'OpenRouter', envKey: 'OPENROUTER_API_KEY' },
  { id: 'claude', label: 'Claude', envKey: 'ANTHROPIC_API_KEY' },
];
const configuredProviders = () => ORDER.filter(p => process.env[p.envKey]);
/** The first configured provider (the one tried first). */
export function aiProvider(): AIProvider | null { return configuredProviders()[0]?.id ?? null; }
export function aiConfigured(): boolean { return aiProvider() !== null; }
export function aiProviderLabel(): string { return configuredProviders()[0]?.label ?? 'AI'; }

class ProviderError extends Error { constructor(message: string, public pauseMs = 0) { super(message); } }
const pausedUntil = new Map<AIProvider, { until: number; reason: string }>();
/** Which AI providers are configured and which are paused, for /api/health. */
export function aiStatus(): { provider: string; state: 'ready' | 'paused'; until?: string; reason?: string }[] {
  const now = Date.now();
  return configuredProviders().map(p => { const pause = pausedUntil.get(p.id); return pause && pause.until > now ? { provider: p.label, state: 'paused', until: new Date(pause.until).toISOString(), reason: pause.reason } : { provider: p.label, state: 'ready' }; });
}
function failure(provider: string, status: number): ProviderError {
  if (status === 429) return new ProviderError(`${provider}: rate or quota limit reached`, 10 * 60e3);
  if (status === 401 || status === 403) return new ProviderError(`${provider}: key rejected (${status})`, 24 * 3600e3);
  if (status === 402) return new ProviderError(`${provider}: credits used up`, 24 * 3600e3);
  if (status === 404) return new ProviderError(`${provider}: model not available (${status}); set its *_MODEL variable`, 3600e3);
  return new ProviderError(`${provider}: request failed (${status})`, status >= 500 ? 2 * 60e3 : 0);
}

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), ms);
  try { return await run(controller.signal); }
  catch (e) { if (e instanceof Error && e.name === 'AbortError') throw new Error('The AI request timed out. Please retry.'); throw e; }
  finally { clearTimeout(timer); }
}

async function askGemini(system: string, user: string, maxTokens: number, json: boolean, signal: AbortSignal): Promise<string> {
  const model = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
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
  if (!response.ok) throw failure('Gemini', response.status);
  const data = await response.json() as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
  const text = (data.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('\n').trim();
  if (!text) throw new ProviderError('Gemini returned an empty response.');
  return text;
}

/** Groq and OpenRouter both speak the OpenAI chat-completions format. */
async function askOpenAICompatible(label: string, url: string, key: string, model: string, system: string, user: string, maxTokens: number, json: boolean, signal: AbortSignal, extraHeaders: Record<string, string> = {}): Promise<string> {
  const response = await fetch(url, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}`, ...extraHeaders },
    body: JSON.stringify({ model, temperature: 0, max_tokens: Math.max(maxTokens * 3, 4096), messages: [{ role: 'system', content: system }, { role: 'user', content: user }], ...(json ? { response_format: { type: 'json_object' } } : {}) }),
  });
  if (!response.ok) throw failure(label, response.status);
  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  const text = (data.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  if (!text) throw new ProviderError(`${label} returned an empty response.`);
  return text;
}

async function askAnthropic(system: string, user: string, maxTokens: number, signal: AbortSignal): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929', max_tokens: maxTokens, temperature: 0, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!response.ok) throw failure('Claude', response.status);
  const data = await response.json();
  return (data.content || []).filter((x: { type: string }) => x.type === 'text').map((x: { text: string }) => x.text).join('\n');
}

function askOne(id: AIProvider, system: string, user: string, maxTokens: number, json: boolean, signal: AbortSignal): Promise<string> {
  if (id === 'gemini') return askGemini(system, user, maxTokens, json, signal);
  if (id === 'groq') return askOpenAICompatible('Groq', 'https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY || '', process.env.GROQ_MODEL || 'openai/gpt-oss-120b', system, user, maxTokens, json, signal);
  // Free OpenRouter models do not all support JSON mode; replies are parsed leniently instead.
  if (id === 'openrouter') return askOpenAICompatible('OpenRouter', 'https://openrouter.ai/api/v1/chat/completions', process.env.OPENROUTER_API_KEY || '', process.env.OPENROUTER_MODEL || 'google/gemma-4-31b-it:free', system, user, maxTokens, false, signal, { 'X-Title': 'SubmitPilot' });
  return askAnthropic(system, user, maxTokens, signal);
}

/** Sends one system + user prompt, falling back through the configured providers. Set json=true when the reply must be a JSON object. */
export async function askAI(system: string, user: string, maxTokens = 1200, json = false, timeoutMs = 38000): Promise<string> {
  const providers = configuredProviders();
  if (!providers.length) throw new Error('No AI provider configured. Set GEMINI_API_KEY, GROQ_API_KEY or OPENROUTER_API_KEY.');
  const started = Date.now(); const errors: string[] = [];
  for (const p of providers) {
    const pause = pausedUntil.get(p.id); if (pause && pause.until > Date.now()) continue;
    const remaining = timeoutMs - (Date.now() - started); if (remaining < 3000) break;
    try { return await withTimeout(remaining, signal => askOne(p.id, system, user, maxTokens, json, signal)); }
    catch (e) {
      if (e instanceof ProviderError && e.pauseMs) pausedUntil.set(p.id, { until: Date.now() + e.pauseMs, reason: e.message });
      errors.push(e instanceof Error ? e.message : `${p.label} failed`);
    }
  }
  throw new Error(errors.length ? `All AI providers failed: ${errors.join('; ')}` : 'All AI providers are paused after hitting their limits; try again shortly.');
}

export type WebSource = { title: string; url: string };
let webSearchBlockedUntil = 0;
export const WEB_SEARCH_UNAVAILABLE = 'Google Search grounding is not available on this Gemini key (the free tier often excludes it). Enable billing for the key in Google AI Studio to use it.';
/** Gemini with Google Search grounding. Returns the reply text and the web pages it relied on. */
export async function askAIWithWebSearch(system: string, user: string, maxTokens = 3000, timeoutMs = 45000): Promise<{ text: string; sources: WebSource[] }> {
  if (!process.env.GEMINI_API_KEY) throw new Error('Web search requires GEMINI_API_KEY.');
  if (Date.now() < webSearchBlockedUntil) throw new Error(WEB_SEARCH_UNAVAILABLE);
  const model = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
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
    if (response.status === 429) { webSearchBlockedUntil = Date.now() + 30 * 60e3; throw new Error(WEB_SEARCH_UNAVAILABLE); }
    if (!response.ok) throw new Error(`Gemini web search failed (${response.status}).`);
    const data = await response.json() as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] } }[] };
    const candidate = data.candidates?.[0];
    const text = (candidate?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('\n').trim();
    const sources = (candidate?.groundingMetadata?.groundingChunks || []).map(c => ({ title: c.web?.title || 'Web source', url: c.web?.uri || '' })).filter(s => s.url);
    return { text, sources };
  });
}
