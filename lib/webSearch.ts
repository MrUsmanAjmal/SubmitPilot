/*
 * One web-search interface over several providers' free tiers. Each request tries the providers
 * in order and moves to the next one when a provider is out of quota, rejects the key or fails.
 * A provider that reports its quota is used up is paused until the quota is likely to reset.
 * Use one account per provider: multiple accounts to multiply a free tier break their terms.
 */

export type SearchResult = { title: string; url: string; text: string; provider: string };
export type SearchOptions = { /** Provider ids to try first, e.g. ['tavily'] when full page text matters. */ prefer?: string[]; /** Ask for full page text where the provider supports it (Tavily). */ fullText?: boolean };
type Provider = { id: string; label: string; envKey: string; search: (key: string, query: string, max: number, signal: AbortSignal, opts: SearchOptions) => Promise<SearchResult[]> };

class QuotaError extends Error { constructor(message: string, public pauseMs: number) { super(message); } }
const HOUR = 3600e3, DAY = 24 * HOUR;

async function call(url: string, init: RequestInit & { signal: AbortSignal }, provider: string): Promise<unknown> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  if (response.status === 429) throw new QuotaError(`${provider}: rate or quota limit reached`, HOUR);
  if (response.status === 401 || response.status === 403) throw new QuotaError(`${provider}: key rejected or plan exhausted (${response.status})`, DAY);
  if (response.status === 402 || response.status === 432 || response.status === 433) throw new QuotaError(`${provider}: free credits used up`, 7 * DAY);
  if (!response.ok) throw new Error(`${provider} returned HTTP ${response.status}`);
  return response.json();
}
const clip = (s: unknown, n = 1500) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

export const PROVIDERS: Provider[] = [
  { id: 'serper', label: 'Serper', envKey: 'SERPER_API_KEY', search: async (key, query, max, signal) => {
    const body = await call('https://google.serper.dev/search', { method: 'POST', signal, headers: { 'content-type': 'application/json', 'X-API-KEY': key }, body: JSON.stringify({ q: query, num: max }) }, 'Serper') as { organic?: { title?: string; link?: string; snippet?: string }[] };
    return (body.organic || []).map(r => ({ title: clip(r.title, 200), url: r.link || '', text: clip(r.snippet), provider: 'Serper' }));
  } },
  { id: 'tavily', label: 'Tavily', envKey: 'TAVILY_API_KEY', search: async (key, query, max, signal, opts) => {
    const body = await call('https://api.tavily.com/search', { method: 'POST', signal, headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ query, max_results: max, search_depth: 'basic', ...(opts.fullText ? { include_raw_content: 'text' } : {}) }) }, 'Tavily') as { results?: { title?: string; url?: string; content?: string; raw_content?: string | null }[] };
    return (body.results || []).map(r => ({ title: clip(r.title, 200), url: r.url || '', text: opts.fullText && r.raw_content ? clip(r.raw_content, 6000) : clip(r.content), provider: 'Tavily' }));
  } },
  { id: 'brave', label: 'Brave Search', envKey: 'BRAVE_API_KEY', search: async (key, query, max, signal) => {
    const body = await call(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${max}&extra_snippets=true`, { signal, headers: { Accept: 'application/json', 'X-Subscription-Token': key } }, 'Brave') as { web?: { results?: { title?: string; url?: string; description?: string; extra_snippets?: string[] }[] } };
    return (body.web?.results || []).map(r => ({ title: clip(r.title, 200), url: r.url || '', text: clip([r.description, ...(r.extra_snippets || [])].join(' ')), provider: 'Brave' }));
  } },
  { id: 'exa', label: 'Exa', envKey: 'EXA_API_KEY', search: async (key, query, max, signal) => {
    const body = await call('https://api.exa.ai/search', { method: 'POST', signal, headers: { 'content-type': 'application/json', 'x-api-key': key }, body: JSON.stringify({ query, numResults: max, contents: { text: { maxCharacters: 1500 } } }) }, 'Exa') as { results?: { title?: string; url?: string; text?: string }[] };
    return (body.results || []).map(r => ({ title: clip(r.title, 200), url: r.url || '', text: clip(r.text), provider: 'Exa' }));
  } },
  { id: 'serpapi', label: 'SerpApi', envKey: 'SERPAPI_API_KEY', search: async (key, query, max, signal) => {
    const body = await call(`https://serpapi.com/search.json?engine=google&num=${max}&q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(key)}`, { signal }, 'SerpApi') as { organic_results?: { title?: string; link?: string; snippet?: string }[]; error?: string };
    if (body.error) throw new QuotaError(`SerpApi: ${body.error}`, /run out|limit/i.test(body.error) ? 7 * DAY : HOUR);
    return (body.organic_results || []).map(r => ({ title: clip(r.title, 200), url: r.link || '', text: clip(r.snippet), provider: 'SerpApi' }));
  } },
];

const pausedUntil = new Map<string, { until: number; reason: string }>();
const configured = () => PROVIDERS.filter(p => process.env[p.envKey]);
export function webSearchConfigured(): boolean { return configured().length > 0; }
/** Which providers are configured and which are paused, for /api/health. */
export function webSearchStatus(): { provider: string; state: 'ready' | 'paused'; until?: string; reason?: string }[] {
  const now = Date.now();
  return configured().map(p => { const pause = pausedUntil.get(p.id); return pause && pause.until > now ? { provider: p.label, state: 'paused', until: new Date(pause.until).toISOString(), reason: pause.reason } : { provider: p.label, state: 'ready' }; });
}

const cache = new Map<string, { at: number; value: SearchResult[] }>();
/** Searches with the first available provider; falls through to the next on quota or errors. */
export async function webSearch(query: string, max = 5, opts: SearchOptions = {}): Promise<SearchResult[]> {
  const key = `${max}:${opts.fullText ? 'full:' : ''}${query.toLowerCase()}`;
  const hit = cache.get(key); if (hit && Date.now() - hit.at < 6 * HOUR) return hit.value;
  const errors: string[] = [];
  const prefer = opts.prefer || [];
  const order = [...configured()].sort((a, b) => (prefer.includes(a.id) ? prefer.indexOf(a.id) : 99) - (prefer.includes(b.id) ? prefer.indexOf(b.id) : 99));
  for (const p of order) {
    const pause = pausedUntil.get(p.id); if (pause && pause.until > Date.now()) continue;
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const results = (await p.search(process.env[p.envKey] || '', query, max, controller.signal, opts)).filter(r => /^https?:\/\//.test(r.url));
      cache.set(key, { at: Date.now(), value: results });
      return results;
    } catch (e) {
      if (e instanceof QuotaError) pausedUntil.set(p.id, { until: Date.now() + e.pauseMs, reason: e.message });
      errors.push(e instanceof Error ? (e.name === 'AbortError' ? `${p.label}: timed out` : e.message) : `${p.label}: failed`);
    } finally { clearTimeout(timer); }
  }
  throw new Error(errors.length ? `All web search providers failed: ${errors.join('; ')}` : 'No web search provider is configured or all are paused.');
}
