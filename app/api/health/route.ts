import { NextResponse } from 'next/server';
export async function GET(){return NextResponse.json({status:'ok',claudeConfigured:!!process.env.ANTHROPIC_API_KEY,openAlexKeyConfigured:!!process.env.OPENALEX_API_KEY,claudeProtected:!!process.env.CLAUDE_ACCESS_CODE});}
