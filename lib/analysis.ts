import type { Analysis, Check } from './types';

export const STOP = new Set('the and with from this that study using among between effects effect into their they were have been will would could should those these there about which whether when under over based analysis research findings results paper manuscript article participants patients population methods conclusion introduction abstract background keywords discussion objective objectives purpose investigate evaluates evaluation approach compared comparison for its our are can also has not but than such via towards toward new novel proposed propose proposes method methods using use used show shows shown work present presents efficient improved improving based-on'.split(' '));
export function meaningfulWords(input: string, max = 9): string[] {
  const counts = new Map<string,number>();
  for (const w of (input.toLowerCase().match(/[a-z][a-z-]{3,}/g) || [])) {
    if (!STOP.has(w) && w.length < 26) counts.set(w, (counts.get(w) || 0)+1);
  }
  return [...counts].sort((a,b)=>b[1]-a[1]).slice(0,max).map(([w])=>w);
}
export function inferStudyType(input: string): string {
  const t = input.toLowerCase();
  if (/systematic review|meta.analysis|prisma/.test(t)) return 'Systematic review / meta-analysis';
  if (/randomi[sz]ed controlled|clinical trial|randomi[sz]ation/.test(t)) return 'Randomized / clinical study';
  if (/qualitative|thematic analysis|semi.structured interviews/.test(t)) return 'Qualitative research';
  if (/cohort|case.control|cross.sectional|retrospective|prospective study/.test(t)) return 'Observational research';
  if (/machine learning|deep learning|computer vision|neural network/.test(t)) return 'Computational / ML study';
  if (/letter to the editor|correspondence/.test(t)) return 'Letter / correspondence';
  if (/case report|case presentation/.test(t)) return 'Case report';
  return 'Not confidently determined';
}
export function findSection(text: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const reg = new RegExp(`(?:^|\\n)\\s*(?:\\d+(?:\\.\\d+)*\\s*)?${escaped}\\s*[:\\n]`, 'im');
  const match = reg.exec(text);
  if (!match) return '';
  const start = match.index+match[0].length;
  return text.slice(start,start+2000).split(/\n\s*(?:\d+\.?\s*)?(?:introduction|methods?|materials|results?|discussion|conclusions?|references|limitations|keywords)\s*\n/i)[0].trim();
}
export function cleanText(t:string):string {
  return t.replace(/\r\n?/g,'\n').replace(/\u0000/g,'').replace(/[ \t]+/g,' ').replace(/\n{4,}/g,'\n\n').trim();
}
export function getManuscriptTitle(text: string, fileName=''): string {
  const firstLines = text.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,7);
  const candidate = firstLines.find(x=>x.length>16 && x.length<210 && !/^(abstract|introduction|author|original research|keywords|doi|article)/i.test(x));
  return candidate || fileName.replace(/\.(docx|pdf|txt)$/i,'').replace(/[_-]/g,' ') || 'Untitled manuscript';
}
export function analyzeRules(input:string,fileName=''):Analysis {
  const text=cleanText(input); const lower=text.toLowerCase();
  const words=text.match(/\b[\w'-]+\b/g)||[];
  const title=getManuscriptTitle(text,fileName);
  const abstract=findSection(text,'abstract');
  const type=inferStudyType(text.slice(0,20000));
  const methods=/\b(methods?|methodology|study design|materials and methods)\b/i.test(text);
  const results=/\bresults?\b/i.test(text);
  const limitation=/\blimitations?\b/i.test(text);
  const ethics=/\b(ethics? approval|institutional review board|ethical approval|ethics committee|irb)\b/i.test(text);
  const funding=/\b(funding|financial support|grant number)\b/i.test(text);
  const conflict=/\b(conflict[s]? of interest|competing interests?|declaration of interest)\b/i.test(text);
  const availability=/\b(data availability|availability of data|data sharing statement)\b/i.test(text);
  const checks:Check[]=[
    {id:'abstract',label:'Abstract identifiable',status:abstract?'positive':'attention',detail:abstract?'An abstract-like section was detected.':'No clearly labeled abstract was found. Confirm if required for your article type.'},
    {id:'methods',label:'Methods described',status:methods?'positive':'attention',detail:methods?'Methods-related wording was detected; methodological adequacy has not been verified.':'A methods section was not identified; confirm whether it is appropriate for this article type.'},
    {id:'results',label:'Results identifiable',status:results?'positive':'attention',detail:results?'Results-related wording was detected; numerical claims were not verified.':'No results section was confidently detected.'},
    {id:'limitations',label:'Limitations addressed',status:limitation?'positive':'info',detail:limitation?'Limitations terminology found.':'Consider clearly discussing limitations, if applicable.'},
    {id:'ethics',label:'Ethics statement',status:ethics?'positive':'info',detail:ethics?'Ethics-related wording found; approval was not independently checked.':'No explicit ethics approval statement detected; whether one is required depends on the study.'},
    {id:'funding',label:'Funding statement',status:funding?'positive':'info',detail:funding?'Funding-related wording found.':'A funding declaration may be required even where funding was not received.'},
    {id:'conflicts',label:'Competing interests',status:conflict?'positive':'attention',detail:conflict?'Competing interests terminology found.':'Add an explicit competing-interests declaration if requested by the target journal.'},
    {id:'data',label:'Data availability',status:availability?'positive':'info',detail:availability?'Data sharing terminology found.':'Check the target journal’s data availability policy.'},
  ];
  const keywords=meaningfulWords([title,abstract||text.slice(0,3000)].join(' '),8);
  const strengths=[`${words.length.toLocaleString('en-US')} words available for screening`,type!=='Not confidently determined'?`Study design signals suggest: ${type}`:'Manuscript available for structural screening'];
  const considerations=checks.filter(c=>c.status==='attention').map(c=>c.detail);
  if (!limitationsCheck(type,lower)) considerations.push('A credible assessment of scientific validity requires specialist review; the automated checks are structural, not peer review.');
  return {title,summary:(abstract||text.slice(0,950)).replace(/\s+/g,' ').slice(0,580),studyType:type,discipline:'To be confirmed by the author',keywords,strengths,considerations,checks,wordCount:words.length,estimatedReadMinutes:Math.max(1,Math.ceil(words.length/210)),mode:'rules',notice:'Rule-based screening only. Presence of a section does not establish study quality, novelty, validity, or journal eligibility.'};
}
function limitationsCheck(type:string,_text:string):boolean {return type==='Letter / correspondence';}
export function safeJsonExtract(raw:string):unknown {
  const cleaned=raw.replace(/^\s*```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'');
  try { return JSON.parse(cleaned); } catch { const start=cleaned.indexOf('{');const end=cleaned.lastIndexOf('}');if(start>=0&&end>start) return JSON.parse(cleaned.slice(start,end+1)); throw new Error('Invalid JSON from model');}
}
