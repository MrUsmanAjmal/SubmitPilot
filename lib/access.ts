import { aiConfigured } from './ai';
import { takeAIBudget } from './rateLimit';
/** AI is public but rate-limited per visitor; returns whether this request may use it. */
export function canUseAI(request:Request,cost=1):boolean {
  return aiConfigured() && takeAIBudget(request,cost);
}
