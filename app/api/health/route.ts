import { NextResponse } from 'next/server';
import { aiConfigured, aiProvider } from '@/lib/ai';
import { scimagoTable } from '@/lib/metrics';
import { webSearchStatus } from '@/lib/webSearch';
export async function GET(){return NextResponse.json({status:'ok',aiConfigured:aiConfigured(),aiProvider:aiProvider(),openAlexKeyConfigured:!!process.env.OPENALEX_API_KEY,elsevierConfigured:!!process.env.ELSEVIER_API_KEY,scimagoLoaded:!!scimagoTable(),webSearch:webSearchStatus()});}
