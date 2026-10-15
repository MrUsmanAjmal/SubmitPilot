import { NextResponse } from 'next/server';
import { impactLookupAvailable, lookupPublisherMetrics, type JournalRef } from '@/lib/impact';
import { canUseAI } from '@/lib/access';
export const runtime='nodejs'; export const maxDuration=60;
const str=(v:unknown,max:number)=>v==null||v===''?null:String(v).slice(0,max);
export async function POST(request:Request){
  try{
    const body=await request.json();
    const journals:JournalRef[]=(Array.isArray(body.journals)?body.journals:[]).slice(0,20).map((j:Record<string,unknown>)=>({id:String(j.id||'').slice(0,80),name:String(j.name||'').slice(0,200),issn:str(j.issn,20),publisher:str(j.publisher,120),homepage:str(j.homepage,300)})).filter((j:JournalRef)=>/^https:\/\/openalex\.org\/S\d+$/.test(j.id)&&j.name);
    if(!journals.length)return NextResponse.json({error:'No journals given.'},{status:400});
    if(!impactLookupAvailable())return NextResponse.json({error:'Impact Factor lookup needs a web search key (e.g. TAVILY_API_KEY) and GEMINI_API_KEY on the server.'},{status:503});
    if(!canUseAI(request))return NextResponse.json({error:'Hourly AI limit reached for your connection. Try again later.'},{status:429});
    return NextResponse.json(await lookupPublisherMetrics(journals),{headers:{'Cache-Control':'no-store'}});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Impact Factor lookup failed.'},{status:502});}
}
