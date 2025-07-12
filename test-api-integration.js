// Test script to verify API endpoints work
// Run this with: node test-api-integration.js

const BASE_URL = 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 Testing API Integration...\n');

  // Test 1: Check if endpoints exist (should return 401 Unauthorized)
  console.log('1. Testing endpoint availability...');
  
  try {
    const tests = [
      { endpoint: '/api/users/profile', method: 'GET' },
      { endpoint: '/api/artifacts', method: 'GET' }
    ];

    for (const test of tests) {
      const response = await fetch(`${BASE_URL}${test.endpoint}`, {
        method: test.method
      });
      
      if (response.status === 401) {
        console.log(`✓ ${test.method} ${test.endpoint} - Correctly returns 401 (Unauthorized)`);
      } else if (response.status === 404) {
        console.log(`✗ ${test.method} ${test.endpoint} - Returns 404 (Endpoint not found)`);
      } else {
        console.log(`? ${test.method} ${test.endpoint} - Returns ${response.status}`);
      }
    }
  } catch (error) {
    console.log('✗ Failed to connect to the app. Make sure it\'s running with "npm run dev"');
    console.log('Error:', error.message);
    return;
  }

  console.log('\n2. Testing Supabase connection...');
  
  // Test 2: Check environment variables are loaded
  try {
    const envTest = await fetch(`${BASE_URL}/api/test-env`, {
      method: 'GET'
    });
    
    if (envTest.status === 404) {
      console.log('? Environment test endpoint not found (this is normal)');
      console.log('  You can create /api/test-env to test environment variables');
    }
  } catch (error) {
    console.log('? Could not test environment variables');
  }

  console.log('\n✅ API Integration Test Complete');
  console.log('\nNext steps:');
  console.log('1. Sign up/in through Clerk in your browser');
  console.log('2. Create a user profile via the API');
  console.log('3. Test creating and fetching artifacts');
  console.log('4. Verify RLS prevents seeing other companies\' data');
}

// Helper function to simulate fetch if not available
if (typeof fetch === 'undefined') {
  // For Node.js environments without fetch
  console.log('Note: Using node-fetch simulation. Install node-fetch for better testing.');
  global.fetch = async (url, options) => {
    const https = require('https');
    const http = require('http');
    const urlLib = require('url');
    
    return new Promise((resolve, reject) => {
      const parsedUrl = urlLib.parse(url);
      const lib = parsedUrl.protocol === 'https:' ? https : http;
      
      const req = lib.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.path,
        method: options?.method || 'GET',
        headers: options?.headers || {}
      }, (res) => {
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          ok: res.statusCode >= 200 && res.statusCode < 300
        });
      });
      
      req.on('error', reject);
      req.end();
    });
  };
}

testAPI();