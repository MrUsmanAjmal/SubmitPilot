/**
 * Per-visitor budget for AI calls, so one visitor cannot spend the free Gemini quota for everyone.
 * In-memory: it resets on restart and is per server instance, which is adequate for a single
 * Node deployment. Use a shared store (e.g. Redis) behind a load balancer or on serverless.
 */
const WINDOW_MS = 60 * 60 * 1000;
const usage = new Map<string, number[]>();
const limit = () => Math.max(1, Number(process.env.AI_REQUESTS_PER_HOUR) || 30);
export function visitorKey(request: Request): string {
  return (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'local';
}
/** Records `cost` units for this visitor and returns false when the hourly budget is used up. */
export function takeAIBudget(request: Request, cost = 1): boolean {
  const key = visitorKey(request); const now = Date.now();
  const recent = (usage.get(key) || []).filter(t => now - t < WINDOW_MS);
  if (recent.length + cost > limit()) { usage.set(key, recent); return false; }
  for (let i = 0; i < cost; i++) recent.push(now);
  usage.set(key, recent);
  if (usage.size > 5000) for (const [k, v] of usage) if (!v.some(t => now - t < WINDOW_MS)) usage.delete(k);
  return true;
}
