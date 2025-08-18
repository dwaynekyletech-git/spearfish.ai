import { NextResponse } from 'next/server';
import { getCacheService } from '@/lib/cache-service';

export async function GET() {
  try {
    const cacheService = getCacheService();
    
    // Test basic cache operations
    const testKey = 'test-key-' + Date.now();
    const testValue = { message: 'Hello Redis!', timestamp: new Date().toISOString() };
    
    // Try to set a value
    const setResult = await cacheService.set(testKey, testValue, 60, 'test');
    
    // Try to get the value back
    const getResult = await cacheService.get(testKey, 'test');
    
    // Test health check
    const healthResult = await cacheService.healthCheck();
    
    return NextResponse.json({
      success: true,
      testKey,
      setResult,
      getResult: getResult?.data,
      cached: getResult?.cached,
      healthCheck: healthResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}