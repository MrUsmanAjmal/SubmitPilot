import { timingSafeEqual } from 'node:crypto';
/** A deployment-level guard for optional paid Claude calls. Not user accounts. */
export function codeMatches(input:string):boolean {
  const expected=process.env.CLAUDE_ACCESS_CODE;
  if(!expected || expected.length<12) return false; // fail closed by default
  const received=Buffer.from(input,'utf8');const secret=Buffer.from(expected,'utf8');
  return received.length===secret.length && timingSafeEqual(received,secret);
}
export function canUseClaude(request:Request):boolean {
  return !!process.env.ANTHROPIC_API_KEY && codeMatches(request.headers.get('x-submitpilot-access-code')||'');
}
