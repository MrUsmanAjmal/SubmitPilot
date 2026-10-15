import { NextResponse } from 'next/server';
import { extractKeywords, type SearchInput } from '@/lib/keywords';
import { canUseAI } from '@/lib/access';
export const runtime='nodejs'; export const maxDuration=40;
export async function POST(request:Request){
  try{
    const body=await request.json();
    const mode=(['field','topic','manuscript'].includes(body.mode)?body.mode:'topic') as SearchInput['mode'];
    const input:SearchInput={mode,field:body.field?String(body.field).slice(0,200):undefined,topic:body.topic?String(body.topic).slice(0,600):undefined,abstract:body.abstract?String(body.abstract).slice(0,6000):undefined,text:body.text?String(body.text).slice(0,20000):undefined,title:body.title?String(body.title).slice(0,400):undefined};
    if(!(input.field||input.topic||input.text))return NextResponse.json({error:'Enter a field, topic or manuscript first.'},{status:400});
    return NextResponse.json(await extractKeywords(input,canUseAI(request)),{headers:{'Cache-Control':'no-store'}});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not extract keywords.'},{status:500});}
}
