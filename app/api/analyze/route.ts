import { NextResponse } from 'next/server';
import { analyzeRules } from '@/lib/analysis';
import { analyzeWithAI } from '@/lib/aiAnalysis';
import { canUseAI } from '@/lib/access';
import { parseManuscript } from '@/lib/parser';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request) {
  try {
    const form=await request.formData();const file=form.get('file'); const paste=form.get('text');
    let text=''; let name='Pasted manuscript';
    if(file instanceof File){name=file.name;text=await parseManuscript(file);}
    else if(typeof paste==='string' && paste.trim().length>=120 && paste.length<=170000){text=paste.trim();}
    else return NextResponse.json({error:'Upload a DOCX, text-based PDF, TXT, or paste at least 120 characters of manuscript text.'},{status:400});
    let analysis=analyzeRules(text,name);let aiError:string|undefined;
    if(canUseAI(request,2)) {try{analysis=await analyzeWithAI(text,name);}catch(e){aiError=e instanceof Error?e.message:'AI screening failed';}}
    return NextResponse.json({analysis,text,fileName:name,aiError},{headers:{'Cache-Control':'no-store'}});
  }catch(err){return NextResponse.json({error:err instanceof Error?err.message:'Unable to process manuscript.'},{status:400});}
}
