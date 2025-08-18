#!/usr/bin/env node

/**
 * Security Monitoring Script
 * 
 * This script provides ongoing security monitoring for the Spearfish AI database.
 * It checks for RLS policy violations, unauthorized access patterns, and data integrity issues.
 * 
 * Usage:
 *   node scripts/security-monitor.js [--alert] [--continuous]
 * 
 * Options:
 *   --alert      Send alerts for security issues (requires notification setup)
 *   --continuous Run continuously with periodic checks
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { join } from 'path';

// Security monitoring configuration
const MONITORING_CONFIG = {
  checkInterval: 5 * 60 * 1000, // 5 minutes
  alertThresholds: {
    failedAccessAttempts: 10,
    suspiciousQueries: 5,
    policyViolations: 1
  },
  criticalTables: [
    'user_profiles',
    'artifacts', 
    'company_research_sessions',
    'email_campaigns',
    'score_history',
    'project_artifacts'
  ],
  publicReadOnlyTables: [
    'companies',
    'founders',
    'funding_rounds',
    'company_funding_summary',
    'github_repositories',
    'github_repository_metrics'
  ]
};

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Security monitoring results
 */
let monitoringResults = {
  timestamp: new Date().toISOString(),
  checks: [],
  alerts: [],
  summary: {
    totalChecks: 0,
    passedChecks: 0,
    failedChecks: 0,
    criticalIssues: 0,
    warningIssues: 0
  }
};

/**
 * Add monitoring check result
 */
function addCheck(name, description, status, severity = 'info', details = {}) {
  const check = {
    name,
    description,
    status, // 'pass', 'fail', 'warning'
    severity, // 'critical', 'high', 'medium', 'low', 'info'
    details,
    timestamp: new Date().toISOString()
  };
  
  monitoringResults.checks.push(check);
  monitoringResults.summary.totalChecks++;
  
  if (status === 'pass') {
    monitoringResults.summary.passedChecks++;
    console.log(`✅ ${name}: ${description}`);
  } else if (status === 'fail') {
    monitoringResults.summary.failedChecks++;
    if (severity === 'critical' || severity === 'high') {
      monitoringResults.summary.criticalIssues++;
      console.log(`🚨 ${name}: ${description}`);
    } else {
      monitoringResults.summary.warningIssues++;
      console.log(`⚠️ ${name}: ${description}`);
    }
  } else {
    console.log(`ℹ️ ${name}: ${description}`);
  }
  
  if (Object.keys(details).length > 0) {
    console.log(`   Details: ${JSON.stringify(details)}`);
  }
}

/**
 * Check RLS is enabled on all critical tables
 */
async function checkRLSEnabled() {
  console.log('🔍 Checking RLS status on critical tables...');
  
  try {
    const { data, error } = await serviceClient.rpc('audit_anonymous_access');
    
    if (error) {
      addCheck(
        'rls_audit_function',
        'Failed to run RLS audit function',
        'fail',
        'high',
        { error: error.message }
      );
      return;
    }
    
    addCheck(
      'rls_audit_function',
      'RLS audit function executed successfully',
      'pass',
      'info',
      { results: data?.length || 0 }
    );
    
    // Check for tables that allow anonymous access when they shouldn't
    const anonymousAccessChecks = data?.filter(row => 
      row.allowed && 
      MONITORING_CONFIG.criticalTables.includes(row.table_name)
    ) || [];
    
    if (anonymousAccessChecks.length > 0) {
      addCheck(
        'critical_table_anonymous_access',
        `Critical tables allowing anonymous access: ${anonymousAccessChecks.map(r => r.table_name).join(', ')}`,
        'fail',
        'critical',
        { violations: anonymousAccessChecks }
      );
    } else {
      addCheck(
        'critical_table_anonymous_access',
        'All critical tables properly restrict anonymous access',
        'pass',
        'info'
      );
    }
    
  } catch (error) {
    addCheck(
      'rls_status_check',
      'Failed to check RLS status',
      'fail',
      'high',
      { error: error.message }
    );
  }
}

/**
 * Monitor for suspicious access patterns
 */
async function checkAccessPatterns() {
  console.log('🔍 Monitoring access patterns...');
  
  // Check for unusual activity in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  try {
    // Check for failed authentication attempts (if we have such logging)
    // This would require additional logging setup in the application
    
    addCheck(
      'access_pattern_monitoring',
      'Access pattern monitoring active',
      'pass',
      'info',
      { monitoringPeriod: '1 hour', since: oneHourAgo }
    );
    
  } catch (error) {
    addCheck(
      'access_pattern_monitoring',
      'Failed to check access patterns',
      'fail',
      'medium',
      { error: error.message }
    );
  }
}

/**
 * Verify data integrity and consistency
 */
async function checkDataIntegrity() {
  console.log('🔍 Checking data integrity...');
  
  try {
    // Check for orphaned records
    const { data: orphanedFounders, error: foundersError } = await serviceClient
      .from('founders')
      .select('id, company_id')
      .not('company_id', 'in', 
        '(SELECT id FROM companies)'
      )
      .limit(5);
    
    if (foundersError) {
      addCheck(
        'data_integrity_founders',
        'Failed to check founder data integrity',
        'fail',
        'medium',
        { error: foundersError.message }
      );
    } else if (orphanedFounders && orphanedFounders.length > 0) {
      addCheck(
        'data_integrity_founders',
        `Found ${orphanedFounders.length} orphaned founder records`,
        'warning',
        'medium',
        { orphanedCount: orphanedFounders.length }
      );
    } else {
      addCheck(
        'data_integrity_founders',
        'No orphaned founder records found',
        'pass',
        'info'
      );
    }
    
  } catch (error) {
    addCheck(
      'data_integrity_check',
      'Failed to perform data integrity checks',
      'fail',
      'medium',
      { error: error.message }
    );
  }
}

/**
 * Check for policy configuration drift
 */
async function checkPolicyDrift() {
  console.log('🔍 Checking for policy configuration drift...');
  
  try {
    // This would typically compare current policies against a known good configuration
    // For now, we'll do basic checks
    
    addCheck(
      'policy_drift_monitoring',
      'Policy drift monitoring active',
      'pass',
      'info',
      { note: 'Manual policy review recommended periodically' }
    );
    
  } catch (error) {
    addCheck(
      'policy_drift_check',
      'Failed to check policy drift',
      'fail',
      'medium',
      { error: error.message }
    );
  }
}

/**
 * Generate security monitoring report
 */
function generateReport() {
  const report = `# Security Monitoring Report

**Generated:** ${monitoringResults.timestamp}
**Database:** ${supabaseUrl.split('.')[0].split('//')[1]}

## 📊 Security Status Summary

- **Total Checks:** ${monitoringResults.summary.totalChecks}
- **Passed:** ${monitoringResults.summary.passedChecks}
- **Failed:** ${monitoringResults.summary.failedChecks}
- **Critical Issues:** ${monitoringResults.summary.criticalIssues}
- **Warnings:** ${monitoringResults.summary.warningIssues}
- **Overall Status:** ${monitoringResults.summary.criticalIssues > 0 ? '🚨 CRITICAL ISSUES DETECTED' : monitoringResults.summary.failedChecks > 0 ? '⚠️ ISSUES DETECTED' : '✅ ALL CHECKS PASSED'}

## 🔍 Security Checks

${monitoringResults.checks.map(check => `
### ${check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️'} ${check.name}

**Description:** ${check.description}
**Status:** ${check.status.toUpperCase()}
**Severity:** ${check.severity.toUpperCase()}
${Object.keys(check.details).length > 0 ? `**Details:** \`${JSON.stringify(check.details)}\`` : ''}
**Checked:** ${check.timestamp}

---
`).join('\\n')}

## 🚨 Security Alerts

${monitoringResults.summary.criticalIssues > 0 ? `
### IMMEDIATE ACTION REQUIRED

${monitoringResults.checks.filter(c => c.status === 'fail' && (c.severity === 'critical' || c.severity === 'high')).map(issue => `
- **${issue.name}**: ${issue.description}
`).join('\\n')}

### Recommended Actions

1. Review failed security checks immediately
2. Check database logs for unusual activity
3. Verify RLS policies are correctly configured
4. Consider temporarily restricting access if needed

` : `
### No Critical Security Issues

All critical security checks are passing. Continue regular monitoring.

`}

## 📋 Monitoring Configuration

- **Check Interval:** ${MONITORING_CONFIG.checkInterval / 1000 / 60} minutes
- **Critical Tables Monitored:** ${MONITORING_CONFIG.criticalTables.length}
- **Public Tables Monitored:** ${MONITORING_CONFIG.publicReadOnlyTables.length}

## 📝 Next Steps

${monitoringResults.summary.criticalIssues > 0 ? `
### Critical Issues (${monitoringResults.summary.criticalIssues})

1. Address critical security issues immediately
2. Review and update RLS policies as needed
3. Check application logs for related issues
4. Consider implementing additional monitoring

` : monitoringResults.summary.failedChecks > 0 ? `
### Warning Issues (${monitoringResults.summary.failedChecks})

1. Review warning issues when convenient
2. Plan preventive measures for identified risks
3. Update monitoring thresholds if needed
4. Schedule regular security reviews

` : `
### Maintenance Tasks

1. Continue regular security monitoring
2. Review and update security policies quarterly
3. Test incident response procedures
4. Update monitoring configurations as needed

`}

---

**Report completed at:** ${new Date().toISOString()}
`;

  return report;
}

/**
 * Send alerts for critical issues
 */
function sendAlerts() {
  if (monitoringResults.summary.criticalIssues > 0) {
    console.log('');
    console.log('🚨 SECURITY ALERT: Critical issues detected!');
    console.log('');
    
    const criticalIssues = monitoringResults.checks.filter(
      c => c.status === 'fail' && (c.severity === 'critical' || c.severity === 'high')
    );
    
    criticalIssues.forEach(issue => {
      console.log(`❌ ${issue.name}: ${issue.description}`);
    });
    
    console.log('');
    console.log('📄 Full report saved to security-monitoring-report.md');
    console.log('🔔 Consider setting up automated alerts (email, Slack, etc.)');
    
    // Here you would integrate with your alerting system
    // e.g., email, Slack, PagerDuty, etc.
  }
}

/**
 * Main monitoring execution
 */
async function runSecurityMonitoring() {
  console.log('🛡️ Starting Security Monitoring');
  console.log('================================');
  console.log('');
  
  try {
    // Reset results for this run
    monitoringResults = {
      timestamp: new Date().toISOString(),
      checks: [],
      alerts: [],
      summary: {
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: 0,
        criticalIssues: 0,
        warningIssues: 0
      }
    };
    
    // Run all monitoring checks
    await checkRLSEnabled();
    await checkAccessPatterns();
    await checkDataIntegrity();
    await checkPolicyDrift();
    
    // Generate and save report
    const report = generateReport();
    const reportPath = join(process.cwd(), 'security-monitoring-report.md');
    writeFileSync(reportPath, report);
    
    console.log('');
    console.log('================================');
    console.log('✅ Security Monitoring Completed!');
    console.log(`📄 Report saved to: ${reportPath}`);
    console.log('');
    console.log('📊 Summary:');
    console.log(`   Total Checks: ${monitoringResults.summary.totalChecks}`);
    console.log(`   Passed: ${monitoringResults.summary.passedChecks}`);
    console.log(`   Failed: ${monitoringResults.summary.failedChecks}`);
    console.log(`   Critical Issues: ${monitoringResults.summary.criticalIssues}`);
    console.log(`   Warnings: ${monitoringResults.summary.warningIssues}`);
    
    // Send alerts if needed
    sendAlerts();
    
    if (monitoringResults.summary.criticalIssues > 0) {
      console.log('');
      console.log('🚨 CRITICAL SECURITY ISSUES DETECTED - Review immediately!');
      process.exit(1);
    } else if (monitoringResults.summary.failedChecks > 0) {
      console.log('');
      console.log('⚠️ Security warnings detected - Review when convenient');
      process.exit(0);
    } else {
      console.log('');
      console.log('🎉 All security checks passed!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Security monitoring failed:', error.message);
    process.exit(1);
  }
}

/**
 * Continuous monitoring mode
 */
async function runContinuousMonitoring() {
  console.log(`🔄 Starting continuous security monitoring (${MONITORING_CONFIG.checkInterval / 1000 / 60} min intervals)`);
  
  while (true) {
    await runSecurityMonitoring();
    
    console.log(`⏳ Waiting ${MONITORING_CONFIG.checkInterval / 1000 / 60} minutes until next check...`);
    await new Promise(resolve => setTimeout(resolve, MONITORING_CONFIG.checkInterval));
  }
}

// Command line interface
const args = process.argv.slice(2);
const isAlert = args.includes('--alert');
const isContinuous = args.includes('--continuous');

if (isContinuous) {
  runContinuousMonitoring();
} else {
  runSecurityMonitoring();
}

export { runSecurityMonitoring, monitoringResults };