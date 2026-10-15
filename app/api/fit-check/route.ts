import { NextResponse } from 'next/server';
import { checkFit } from '@/lib/fitCheck';
import { aiConfigured } from '@/lib/ai';
import { canUseAI } from '@/lib/access';
export const runtime='nodejs'; export const maxDuration=90;
const str=(v:unknown,max:number)=>v==null||v===''?null:String(v).slice(0,max);
const list=(v:unknown,max:number)=>Array.isArray(v)?v.slice(0,max).map(x=>String(x).slice(0,80)).filter(Boolean):undefined;
export async function POST(request:Request){
  try{
    const body=await request.json(); const j=body.journal||{};
    const journal={id:String(j.id||'').slice(0,80),name:String(j.name||'').slice(0,200),publisher:str(j.publisher,120),homepage:str(j.homepage,300),issn:str(j.issn,20)};
    if(!/^https:\/\/openalex\.org\/S\d+$/.test(journal.id)||!journal.name)return NextResponse.json({error:'Choose a journal from the results.'},{status:400});
    const mode=body.mode==='abstract'?'abstract':'manuscript';
    const text=String(body.text||'').slice(0,80000);
    if(text.length<(mode==='abstract'?100:500))return NextResponse.json({error:mode==='abstract'?'Paste an abstract of at least a few sentences to check fit.':'Upload a manuscript to check fit.'},{status:400});
    if(!aiConfigured())return NextResponse.json({error:'The fit check needs an AI key on the server.'},{status:503});
    if(!canUseAI(request,3))return NextResponse.json({error:'Hourly AI limit reached for your connection. Try again later.'},{status:429});
    return NextResponse.json(await checkFit({journal,mode,title:String(body.title||'').slice(0,400),text,phrases:list(body.phrases,5),keywords:list(body.keywords,12)}),{headers:{'Cache-Control':'no-store'}});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Fit check failed.'},{status:502});}
}
