import { NextResponse } from 'next/server';
import { discoverJournals } from '@/lib/journals';
export const runtime='nodejs'; export const maxDuration=35;
export async function POST(request:Request){
  try{const body=await request.json();const search=String(body.query||'').slice(0,1500);const results=await discoverJournals(search,String(body.studyType||'').slice(0,100));return NextResponse.json(results,{headers:{'Cache-Control':'no-store'}});}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not search journals.'},{status:502});}
}
