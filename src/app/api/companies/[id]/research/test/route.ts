import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({
    success: true,
    message: 'Research test endpoint working',
    company_id: params.id,
  });
}