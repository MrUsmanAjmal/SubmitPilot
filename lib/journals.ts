import type { Journal, JournalResponse, SampleWork } from './types';
import { meaningfulWords } from './analysis';

type OAWork = {display_name?:string;doi?:string|null;id?:string;publication_year?:number;type?:string;primary_location?:{source?:{id?:string;display_name?:string;type?:string;issn_l?:string|null;host_organization_name?:string;is_oa?:boolean}}};
type OAResponse={results?:OAWork[];error?:string;message?:string};
export function buildSearchQuery(input:string):string {
  const cleaned=input.replace(/\s+/g,' ').trim().slice(0,500);
  const terms=meaningfulWords(cleaned,7);
  return terms.length>=3?terms.slice(0,5).join(' '):cleaned.slice(0,125);
}
function designPattern(studyType:string):RegExp|null {
  if(/systematic review|meta.analysis/i.test(studyType))return /systematic review|meta.analysis|evidence synthesis/i;
  if(/qualitative/i.test(studyType))return /qualitative|interviews|thematic analysis|focus group/i;
  if(/observational/i.test(studyType))return /cross.sectional|cohort|case.control|observational|longitudinal/i;
  if(/randomized|clinical/i.test(studyType))return /randomi[sz]ed|clinical trial|controlled trial/i;
  if(/computational|ml/i.test(studyType))return /machine learning|deep learning|computer vision|neural network/i;
  if(/case report/i.test(studyType))return /case report|case series/i;
  if(/letter/i.test(studyType))return /letter|correspondence/i;
  return null;
}
export function rankJournals(works:OAWork[],query:string,studyType=''):Journal[] {
  const tokens=new Set(meaningfulWords(query,12));
  const pattern=designPattern(studyType);
  const groups=new Map<string,{source:NonNullable<NonNullable<OAWork['primary_location']>['source']>;works:OAWork[];relevance:number}>();
  for(const work of works){
    const source=work.primary_location?.source;
    if(!source?.id || !source.display_name || source.type!=='journal')continue;
    const item=groups.get(source.id)||{source,works:[],relevance:0};
    if(item.works.length<5)item.works.push(work);
    const titleWords=new Set(meaningfulWords(work.display_name||'',15));
    const overlap=[...tokens].filter(t=>titleWords.has(t)).length;
    item.relevance+=Math.min(3,overlap);
    groups.set(source.id,item);
  }
  const results:Journal[]=[...groups].map(([id,item])=>{
    const matches=item.works.length;
    const total=works.filter(w=>w.primary_location?.source?.id===id).length;
    const designCount=pattern?item.works.filter(w=>pattern.test(w.display_name||'') || (/systematic review/i.test(studyType) && w.type==='review')).length:0;
    const score=Math.min(95,Math.max(25,Math.round(37+Math.min(32,total*5)+Math.min(22,item.relevance*3)+Math.min(5,designCount*2))));
    const designEvidence=pattern?(designCount>0?`${designCount} sampled publication${designCount===1?'':'s'} show related study-design terminology. This is not verification that the journal accepts your article type.`:'Comparable study design was not identified in this sample; article-type suitability is unverified.'):'Study-design compatibility has not been assessed. Upload a manuscript to provide this context.';
    const names=item.works.map(w=>w.display_name||'').filter(Boolean);
    const examples=names.slice(0,2).join(' • ');
    const sample:SampleWork[]=item.works.slice(0,3).map(w=>({title:w.display_name||'Untitled work',year:w.publication_year||null,doi:w.doi||null,url:w.doi||w.id||`https://openalex.org`,type:w.type||'unknown'}));
    return {id,name:item.source.display_name||'Unknown journal',issn:item.source.issn_l||null,publisher:item.source.host_organization_name||null,openAccess:typeof item.source.is_oa==='boolean'?item.source.is_oa:null,count:total,score,designEvidence,fitLabel:score>=72?'Higher literature overlap':score>=55?'Moderate literature overlap':'Exploratory match',works:sample,openalexUrl:id,reason:`${total} thematically related result${total===1?'':'s'} in the retrieved literature sample.${examples?` Examples: ${examples.slice(0,200)}.`:''}`,verification:'Aims and scope, permitted article type, indexing, APC, editorial standards and acceptance likelihood have NOT been independently verified.'};
  });
  return results.sort((a,b)=>b.score-a.score||b.count-a.count).slice(0,12);
}
export async function discoverJournals(input:string,studyType=''):Promise<JournalResponse>{
  const query=buildSearchQuery(input);
  if(query.length<5) throw new Error('Enter a sufficiently specific research topic, title, or abstract.');
  const url=new URL('https://api.openalex.org/works');
  url.searchParams.set('search',query);
  url.searchParams.set('per-page','100');
  url.searchParams.set('filter','from_publication_date:2020-01-01');
  url.searchParams.set('select','id,display_name,doi,publication_year,type,primary_location');
  if(process.env.OPENALEX_API_KEY)url.searchParams.set('api_key',process.env.OPENALEX_API_KEY);
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),20000);
  try {
    const response=await fetch(url.toString(),{signal:controller.signal,headers:{Accept:'application/json','User-Agent':'SubmitPilot/1.0 (journal discovery; open-source)'} ,cache:'no-store'});
    if(!response.ok)throw new Error(`OpenAlex returned HTTP ${response.status}. ${response.status===401||response.status===429?'Check your OpenAlex key or retry after rate limits reset.':'Try again later.'}`);
    const body=(await response.json()) as OAResponse;
    const works=body.results||[];
    return {journals:rankJournals(works,query,studyType),searched:query,sampledWorks:works.length,notice:'These matches are based on publication patterns in a sample of OpenAlex works. Scores express relative literature overlap ONLY, not manuscript quality, publisher eligibility or acceptance probability. Verify journal scope, article types, indexing and charges on official sites.'};
  } catch(e) {if(e instanceof Error&&e.name==='AbortError')throw new Error('The journal index timed out. Please retry.');throw e;}
  finally {clearTimeout(timer);}
}
