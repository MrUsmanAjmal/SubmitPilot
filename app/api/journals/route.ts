import { NextResponse } from 'next/server';
import { discoverJournals, journalsByField } from '@/lib/journals';
import { canUseAI } from '@/lib/access';
export const runtime='nodejs'; export const maxDuration=60;
const list=(v:unknown,max:number)=>Array.isArray(v)?v.slice(0,max).map(x=>String(x).slice(0,80)).filter(Boolean):undefined;
export async function POST(request:Request){
  try{
    const body=await request.json();
    if(body.mode==='field')return NextResponse.json(await journalsByField(String(body.fieldId||''),String(body.fieldName||'this field').slice(0,120)),{headers:{'Cache-Control':'no-store'}});
    const results=await discoverJournals({query:String(body.query||'').slice(0,1500),title:body.title?String(body.title).slice(0,400):undefined,summary:body.summary?String(body.summary).slice(0,3000):undefined,keywords:list(body.keywords,12),phrases:list(body.phrases,5),studyType:String(body.studyType||'').slice(0,100)},{useAI:canUseAI(request)});
    return NextResponse.json(results,{headers:{'Cache-Control':'no-store'}});
  }
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not search journals.'},{status:502});}
}
