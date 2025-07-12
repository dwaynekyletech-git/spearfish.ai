import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  try {
    const { userId } = await auth()
    
    return NextResponse.json({
      authenticated: !!userId,
      userId: userId || null,
      message: userId ? 'User is authenticated' : 'User not authenticated'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Auth check failed', details: error.message },
      { status: 500 }
    )
  }
}