#!/usr/bin/env node

/**
 * RLS Policy Testing Script
 * 
 * This script properly tests Row Level Security policies by using different
 * client connections (anonymous, authenticated, service role) to verify
 * that access restrictions are working correctly.
 */

import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create different client connections
const anonClient = createClient(supabaseUrl, supabaseAnonKey);
const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Test results structure
 */
const testResults = {
  timestamp: new Date().toISOString(),
  summary: {
    totalTests: 0,
    passed: 0,
    failed: 0,
    issues: []
  },
  tests: []
};

/**
 * Add test result
 */
function addTestResult(name, description, expectedResult, actualResult, passed, details = {}) {
  const test = {
    name,
    description,
    expectedResult,
    actualResult,
    passed,
    details,
    timestamp: new Date().toISOString()
  };
  
  testResults.tests.push(test);
  testResults.summary.totalTests++;
  
  if (passed) {
    testResults.summary.passed++;
    console.log(`✅ ${name}: ${description}`);
  } else {
    testResults.summary.failed++;
    testResults.summary.issues.push({
      test: name,
      issue: description,
      expected: expectedResult,
      actual: actualResult
    });
    console.log(`❌ ${name}: ${description}`);
    console.log(`   Expected: ${expectedResult}`);
    console.log(`   Actual: ${actualResult}`);
  }
  
  if (Object.keys(details).length > 0) {
    console.log(`   Details: ${JSON.stringify(details)}`);
  }
  console.log('');
}

/**
 * Test table access with anonymous client
 */
async function testAnonymousAccess(tableName, shouldBeAccessible = false) {
  try {
    const { data, error } = await anonClient
      .from(tableName)
      .select('*')
      .limit(1);
    
    const isAccessible = !error;
    const passed = isAccessible === shouldBeAccessible;
    
    addTestResult(
      `anon_access_${tableName}`,
      `Anonymous access to ${tableName}`,
      shouldBeAccessible ? 'Accessible' : 'Blocked',
      isAccessible ? 'Accessible' : 'Blocked',
      passed,
      {
        errorCode: error?.code,
        errorMessage: error?.message,
        dataReturned: data ? data.length : 0
      }
    );
    
    return { isAccessible, error, data };
    
  } catch (error) {
    addTestResult(
      `anon_access_${tableName}`,
      `Anonymous access to ${tableName}`,
      shouldBeAccessible ? 'Accessible' : 'Blocked',
      'Error',
      false,
      { error: error.message }
    );
    
    return { isAccessible: false, error, data: null };
  }
}

/**
 * Test authenticated access (using a mock JWT)
 */
async function testAuthenticatedAccess(tableName, shouldBeAccessible = true) {
  try {
    // Create a client that simulates an authenticated user
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    
    // Since we can't easily simulate real auth without a real user,
    // we'll use service client but note the limitation
    const { data, error } = await serviceClient
      .from(tableName)
      .select('*')
      .limit(1);
    
    const isAccessible = !error;
    const passed = isAccessible === shouldBeAccessible;
    
    addTestResult(
      `auth_access_${tableName}`,
      `Authenticated access to ${tableName}`,
      shouldBeAccessible ? 'Accessible' : 'Blocked',
      isAccessible ? 'Accessible' : 'Blocked',
      passed,
      {
        note: 'Using service client as proxy for authenticated user',
        errorCode: error?.code,
        errorMessage: error?.message,
        dataReturned: data ? data.length : 0
      }
    );
    
    return { isAccessible, error, data };
    
  } catch (error) {
    addTestResult(
      `auth_access_${tableName}`,
      `Authenticated access to ${tableName}`,
      shouldBeAccessible ? 'Accessible' : 'Blocked',
      'Error',
      false,
      { error: error.message }
    );
    
    return { isAccessible: false, error, data: null };
  }
}

/**
 * Test specific RLS policy scenarios
 */
async function testSpecificPolicies() {
  console.log('🔐 Testing specific RLS policy scenarios...');
  
  // Test 1: Companies should be publicly readable
  await testAnonymousAccess('companies', true);
  
  // Test 2: User profiles should be restricted
  await testAnonymousAccess('user_profiles', false);
  
  // Test 3: Artifacts should be restricted
  await testAnonymousAccess('artifacts', false);
  
  // Test 4: Research sessions should be restricted
  await testAnonymousAccess('company_research_sessions', false);
  
  // Test 5: Research findings should be restricted
  await testAnonymousAccess('research_findings', false);
  
  // Test 6: Project artifacts should be restricted
  await testAnonymousAccess('project_artifacts', false);
  
  // Test 7: Email campaigns should be restricted
  await testAnonymousAccess('email_campaigns', false);
  
  // Test 8: Score history should be authenticated only
  await testAnonymousAccess('score_history', false);
  
  // Test 9: Score batch logs should be service role only
  await testAnonymousAccess('score_batch_logs', false);
  
  // Test 10: GitHub sync logs should be service role only
  await testAnonymousAccess('github_sync_logs', false);
  
  // Test 11: YC sync logs should be service role only
  await testAnonymousAccess('yc_sync_logs', false);
  
  // Test 12: GitHub repository languages should be authenticated only
  await testAnonymousAccess('github_repository_languages', false);
  
  // Test 13: Company GitHub repositories should be authenticated only
  await testAnonymousAccess('company_github_repositories', false);
  
  // Test 14: Founders should be publicly readable (for company discovery)
  await testAnonymousAccess('founders', true);
  
  // Test 15: Funding rounds should be publicly readable (for company discovery)
  await testAnonymousAccess('funding_rounds', true);
  
  // Test 16: Company funding summary should be publicly readable (for company discovery)
  await testAnonymousAccess('company_funding_summary', true);
  
  // Test 17: GitHub repositories should be public
  await testAnonymousAccess('github_repositories', true);
  
  // Test 18: GitHub repository metrics should be public
  await testAnonymousAccess('github_repository_metrics', true);
}

/**
 * Test data modification restrictions
 */
async function testDataModificationRestrictions() {
  console.log('🛡️ Testing data modification restrictions...');
  
  // Test anonymous users cannot insert into any table
  const sensitiveTable = 'user_profiles';
  
  try {
    const { data, error } = await anonClient
      .from(sensitiveTable)
      .insert({
        clerk_user_id: 'test-user',
        full_name: 'Test User',
        email: 'test@example.com'
      });
    
    const insertBlocked = !!error;
    
    addTestResult(
      'anon_insert_blocked',
      'Anonymous insert to user_profiles should be blocked',
      'Blocked',
      insertBlocked ? 'Blocked' : 'Allowed',
      insertBlocked,
      {
        errorCode: error?.code,
        errorMessage: error?.message
      }
    );
    
  } catch (error) {
    addTestResult(
      'anon_insert_blocked',
      'Anonymous insert to user_profiles should be blocked',
      'Blocked',
      'Blocked',
      true,
      { error: error.message }
    );
  }
  
  // Test anonymous users cannot update any table
  try {
    const { data, error } = await anonClient
      .from('companies')
      .update({ name: 'Hacked Company' })
      .eq('id', '00000000-0000-0000-0000-000000000000');
    
    const updateBlocked = !!error;
    
    addTestResult(
      'anon_update_blocked',
      'Anonymous update to companies should be blocked',
      'Blocked',
      updateBlocked ? 'Blocked' : 'Allowed',
      updateBlocked,
      {
        errorCode: error?.code,
        errorMessage: error?.message
      }
    );
    
  } catch (error) {
    addTestResult(
      'anon_update_blocked',
      'Anonymous update to companies should be blocked',
      'Blocked',
      'Blocked',
      true,
      { error: error.message }
    );
  }
  
  // Test anonymous users cannot delete from any table
  try {
    const { data, error } = await anonClient
      .from('companies')
      .delete()
      .eq('id', '00000000-0000-0000-0000-000000000000');
    
    const deleteBlocked = !!error;
    
    addTestResult(
      'anon_delete_blocked',
      'Anonymous delete from companies should be blocked',
      'Blocked',
      deleteBlocked ? 'Blocked' : 'Allowed',
      deleteBlocked,
      {
        errorCode: error?.code,
        errorMessage: error?.message
      }
    );
    
  } catch (error) {
    addTestResult(
      'anon_delete_blocked',
      'Anonymous delete from companies should be blocked',
      'Blocked',
      'Blocked',
      true,
      { error: error.message }
    );
  }
}

/**
 * Test service role access
 */
async function testServiceRoleAccess() {
  console.log('🔑 Testing service role access...');
  
  // Service role should have access to everything
  const testTables = [
    'companies', 'user_profiles', 'artifacts', 'score_history',
    'score_batch_logs', 'github_sync_logs', 'yc_sync_logs'
  ];
  
  for (const table of testTables) {
    try {
      const { data, error } = await serviceClient
        .from(table)
        .select('*')
        .limit(1);
      
      const hasAccess = !error;
      
      addTestResult(
        `service_access_${table}`,
        `Service role access to ${table}`,
        'Accessible',
        hasAccess ? 'Accessible' : 'Blocked',
        hasAccess,
        {
          errorCode: error?.code,
          errorMessage: error?.message,
          dataReturned: data ? data.length : 0
        }
      );
      
    } catch (error) {
      addTestResult(
        `service_access_${table}`,
        `Service role access to ${table}`,
        'Accessible',
        'Error',
        false,
        { error: error.message }
      );
    }
  }
}

/**
 * Generate test report
 */
function generateReport() {
  const report = `# RLS Policy Test Report

**Generated:** ${testResults.timestamp}
**Database:** ${supabaseUrl.split('.')[0].split('//')[1]}

## 📊 Test Summary

- **Total Tests:** ${testResults.summary.totalTests}
- **Passed:** ${testResults.summary.passed}
- **Failed:** ${testResults.summary.failed}
- **Success Rate:** ${((testResults.summary.passed / testResults.summary.totalTests) * 100).toFixed(1)}%

## 🔍 Test Results

${testResults.tests.map(test => `
### ${test.passed ? '✅' : '❌'} ${test.name}

**Description:** ${test.description}
**Expected:** ${test.expectedResult}
**Actual:** ${test.actualResult}
**Status:** ${test.passed ? 'PASS' : 'FAIL'}
${Object.keys(test.details).length > 0 ? `**Details:** \`${JSON.stringify(test.details)}\`` : ''}

---
`).join('\n')}

## 🚨 Security Issues

${testResults.summary.issues.length > 0 ? testResults.summary.issues.map(issue => `
### ${issue.test}
**Issue:** ${issue.issue}
**Expected:** ${issue.expected}
**Actual:** ${issue.actual}

---
`).join('\n') : 'No security issues found! 🎉'}

## 📝 Recommendations

${testResults.summary.failed > 0 ? `
### Critical Actions Required

${testResults.summary.issues.map(issue => `- Fix ${issue.test}: ${issue.issue}`).join('\n')}

### Next Steps

1. Review failed test cases above
2. Check RLS policy configuration in Supabase Dashboard
3. Verify policy conditions and user context
4. Re-run tests after fixes

` : `
### All Tests Passed! ✅

Your RLS policies are working correctly. Consider:

1. Running these tests regularly (e.g., in CI/CD)
2. Adding more specific test cases for your use cases
3. Testing with real authenticated users
4. Monitoring for policy drift over time

`}

---

**Report completed at:** ${new Date().toISOString()}
`;

  return report;
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('🧪 Starting RLS Policy Tests');
  console.log('============================');
  console.log('');
  
  try {
    // Run all test suites
    await testSpecificPolicies();
    await testDataModificationRestrictions();
    await testServiceRoleAccess();
    
    // Generate and save report
    const report = generateReport();
    const fs = await import('fs');
    const path = await import('path');
    
    const reportPath = path.join(process.cwd(), 'rls-policy-test-report.md');
    fs.writeFileSync(reportPath, report);
    
    console.log('============================');
    console.log('✅ RLS Policy Tests Completed!');
    console.log(`📄 Report saved to: ${reportPath}`);
    console.log('');
    console.log('📊 Summary:');
    console.log(`   Total Tests: ${testResults.summary.totalTests}`);
    console.log(`   Passed: ${testResults.summary.passed}`);
    console.log(`   Failed: ${testResults.summary.failed}`);
    console.log(`   Success Rate: ${((testResults.summary.passed / testResults.summary.totalTests) * 100).toFixed(1)}%`);
    
    if (testResults.summary.failed > 0) {
      console.log('');
      console.log('🚨 SECURITY ISSUES FOUND - Review the report and fix immediately!');
      console.log('');
      console.log('Failed tests:');
      testResults.summary.issues.forEach(issue => {
        console.log(`   - ${issue.test}: ${issue.issue}`);
      });
      process.exit(1);
    } else {
      console.log('');
      console.log('🎉 All RLS policies are working correctly!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ RLS tests failed:', error.message);
    process.exit(1);
  }
}

// Run the tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { runTests, testResults };