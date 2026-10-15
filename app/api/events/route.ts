import { NextResponse } from 'next/server';
import { discoverEvents } from '@/lib/events';
import { aiProvider } from '@/lib/ai';
import { canUseAI } from '@/lib/access';
export const runtime='nodejs'; export const maxDuration=60;
const list=(v:unknown,max:number)=>Array.isArray(v)?v.slice(0,max).map(x=>String(x).slice(0,80)).filter(Boolean):[];
export async function POST(request:Request){
  try{
    const body=await request.json();
    const phrases=list(body.phrases,5);const keywords=list(body.keywords,12);
    if(!phrases.length)return NextResponse.json({error:'No search phrases were provided.'},{status:400});
    const useWeb=body.web!==false&&aiProvider()==='gemini'&&canUseAI(request);
    return NextResponse.json(await discoverEvents({phrases,keywords,researchArea:String(body.researchArea||'').slice(0,120),csCategories:list(body.csCategories,3),cfpTags:list(body.cfpTags,4)},{useWeb}),{headers:{'Cache-Control':'no-store'}});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not search conferences.'},{status:502});}
}
