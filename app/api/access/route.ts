import {NextResponse} from 'next/server';
import {codeMatches} from '@/lib/access';
export const runtime='nodejs';
export async function POST(request:Request){try{const {code}=await request.json();const valid=codeMatches(String(code||''));return NextResponse.json({valid});}catch{return NextResponse.json({valid:false},{status:400});}}
