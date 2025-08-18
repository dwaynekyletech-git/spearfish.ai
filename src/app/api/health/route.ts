import { NextResponse } from 'next/server';

export async function GET() {
  const checks = {
    supabase: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    clerk: !!process.env.CLERK_SECRET_KEY,
    openai: !!process.env.OPENAI_API_KEY
  };
  return NextResponse.json({ status: 'ok', checks });
}