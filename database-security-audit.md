# Database Security Audit Report

**Generated:** 2025-08-16T03:17:08.947Z
**Database:** axtjjdmiitwwwwmyikuq

## 📊 Summary

- **Tables Total:** 18
- **Tables with RLS:** 0
- **Tables without RLS:** 18
- **RLS Policies:** 4
- **Database Indexes:** 3

### 🚨 Issues Found

- **Critical:** 23
- **High:** 1
- **Medium:** 29
- **Low:** 0

---

## 🔍 Detailed Findings

### Tables Configuration

| Table | Status | Access | Notes |
|-------|--------|--------|-------|
| companies | ❌ No RLS | 🔐 Restricted | Invalid API key |
| user_profiles | ❌ No RLS | 🔐 Restricted | Invalid API key |
| artifacts | ❌ No RLS | 🔐 Restricted | Invalid API key |
| score_history | ❌ No RLS | 🔐 Restricted | Invalid API key |
| score_batch_logs | ❌ No RLS | 🔐 Restricted | Invalid API key |
| github_repositories | ❌ No RLS | 🔐 Restricted | Invalid API key |
| github_repository_metrics | ❌ No RLS | 🔐 Restricted | Invalid API key |
| github_repository_languages | ❌ No RLS | 🔐 Restricted | Invalid API key |
| company_github_repositories | ❌ No RLS | 🔐 Restricted | Invalid API key |
| github_sync_logs | ❌ No RLS | 🔐 Restricted | Invalid API key |
| yc_sync_logs | ❌ No RLS | 🔐 Restricted | Invalid API key |
| founders | ❌ No RLS | 🔐 Restricted | Invalid API key |
| funding_rounds | ❌ No RLS | 🔐 Restricted | Invalid API key |
| company_funding_summary | ❌ No RLS | 🔐 Restricted | Invalid API key |
| company_research_sessions | ❌ No RLS | 🔐 Restricted | Invalid API key |
| research_findings | ❌ No RLS | 🔐 Restricted | Invalid API key |
| project_artifacts | ❌ No RLS | 🔐 Restricted | Invalid API key |
| email_campaigns | ❌ No RLS | 🔐 Restricted | Invalid API key |

### Access Policy Analysis

Total policy checks: **4**


#### user_profiles
- **Access:** restricted
- **Appropriate:** ✅ Yes


#### artifacts
- **Access:** restricted
- **Appropriate:** ✅ Yes


#### research_findings
- **Access:** restricted
- **Appropriate:** ✅ Yes


#### email_campaigns
- **Access:** restricted
- **Appropriate:** ✅ Yes


### Performance Tests


| Table | Test | Duration | Status |
|-------|------|----------|--------|
| companies | Filtering by spearfish_score | 20ms | ❌ |
| companies | Filtering by batch and AI status | 23ms | ❌ |
| user_profiles | Looking up by clerk_user_id | 39ms | ❌ |


### Database Functions


| Function | Status | Type |
|----------|--------|------|
| get_company_artifacts | ❌ Missing | Public |
| search_companies | ❌ Missing | Public |
| upsert_founder_data | ✅ Available | Helper |
| upsert_funding_summary | ✅ Available | Helper |
| user_id | ✅ Available | Helper |
| clerk_user_id | ✅ Available | Helper |
| user_company_id | ✅ Available | Helper |
| is_company_admin | ✅ Available | Helper |


---

## 🚨 Security Issues


### MEDIUM: TABLE_ACCESS_ERROR
**Table:** companies

**Issue:** Table access error: Invalid API key

**Recommendation:** Verify table exists and is properly configured

---


### CRITICAL: RLS_MISSING
**Table:** user_profiles

**Issue:** Sensitive table error: Invalid API key

**Recommendation:** Check table exists and has proper RLS: ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

---


### CRITICAL: RLS_MISSING
**Table:** artifacts

**Issue:** Sensitive table error: Invalid API key

**Recommendation:** Check table exists and has proper RLS: ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;

---


### MEDIUM: TABLE_ACCESS_ERROR
**Table:** score_history

**Issue:** Table access error: Invalid API key

**Recommendation:** Verify table exists and is properly configured

---


### MEDIUM: TABLE_ACCESS_ERROR
**Table:** score_batch_logs

**Issue:** Table access error: Invalid API key

**Recommendation:** Verify table exists and is properly configured

---


### MEDIUM: TABLE_ACCESS_ERROR
**Table:** github_repositories

**Issue:** Table access error: Invalid API key

**Recommendation:** Verify table exists and is properly configured

---


### MEDIUM: TABLE_ACCESS_ERROR
**Table:** github_repository_metrics

**Issue:** Table access error: Invalid API key

**Recommendation:** Verify table exists and is properly configured

---


### MEDIUM: TABLE_ACCESS_ERROR
**Table:** github_repository_languages

**Issue:** Table access error: Invalid API key

**Recommendation:** Verify table exists and is properly configured

---


### MEDIUM: TABLE_ACCESS_ERROR
**Table:** company_github_repositories

**Issue:** Table access error: Invalid API key

**Recommendation:** Verify table exists and is properly configured

---


### MEDIUM: TABLE_ACCESS_ERROR
**Table:** github_sync_logs

**Issue:** Table access error: Invalid API key

**Recommendation:** Verify table exists and is properly configured

---


### MEDIUM: TABLE_ACCESS_ERROR
**Table:** yc_sync_logs

**Issue:** Table access error: Invalid API key

**Recommendation:** Verify table exists and is properly configured

---


### MEDIUM: TABLE_ACCESS_ERROR
**Table:** founders

**Issue:** Table access error: Invalid API key

**Recommendation:** Verify table exists and is properly configured

---


### MEDIUM: TABLE_ACCESS_ERROR
**Table:** funding_rounds

**Issue:** Table access error: Invalid API key

**Recommendation:** Verify table exists and is properly configured

---


### MEDIUM: TABLE_ACCESS_ERROR
**Table:** company_funding_summary

**Issue:** Table access error: Invalid API key

**Recommendation:** Verify table exists and is properly configured

---


### CRITICAL: RLS_MISSING
**Table:** company_research_sessions

**Issue:** Sensitive table error: Invalid API key

**Recommendation:** Check table exists and has proper RLS: ALTER TABLE company_research_sessions ENABLE ROW LEVEL SECURITY;

---


### MEDIUM: TABLE_ACCESS_ERROR
**Table:** research_findings

**Issue:** Table access error: Invalid API key

**Recommendation:** Verify table exists and is properly configured

---


### CRITICAL: RLS_MISSING
**Table:** project_artifacts

**Issue:** Sensitive table error: Invalid API key

**Recommendation:** Check table exists and has proper RLS: ALTER TABLE project_artifacts ENABLE ROW LEVEL SECURITY;

---


### CRITICAL: RLS_MISSING
**Table:** email_campaigns

**Issue:** Sensitive table error: Invalid API key

**Recommendation:** Check table exists and has proper RLS: ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

---


### MEDIUM: OVERLY_RESTRICTIVE
**Table:** companies

**Issue:** Table may be over-restricted if it should be publicly readable

**Recommendation:** Review if this table should allow public read access

---


### MEDIUM: OVERLY_RESTRICTIVE
**Table:** score_history

**Issue:** Table may be over-restricted if it should be publicly readable

**Recommendation:** Review if this table should allow public read access

---


### MEDIUM: OVERLY_RESTRICTIVE
**Table:** score_batch_logs

**Issue:** Table may be over-restricted if it should be publicly readable

**Recommendation:** Review if this table should allow public read access

---


### MEDIUM: OVERLY_RESTRICTIVE
**Table:** github_repositories

**Issue:** Table may be over-restricted if it should be publicly readable

**Recommendation:** Review if this table should allow public read access

---


### MEDIUM: OVERLY_RESTRICTIVE
**Table:** github_repository_metrics

**Issue:** Table may be over-restricted if it should be publicly readable

**Recommendation:** Review if this table should allow public read access

---


### MEDIUM: OVERLY_RESTRICTIVE
**Table:** github_repository_languages

**Issue:** Table may be over-restricted if it should be publicly readable

**Recommendation:** Review if this table should allow public read access

---


### MEDIUM: OVERLY_RESTRICTIVE
**Table:** company_github_repositories

**Issue:** Table may be over-restricted if it should be publicly readable

**Recommendation:** Review if this table should allow public read access

---


### MEDIUM: OVERLY_RESTRICTIVE
**Table:** github_sync_logs

**Issue:** Table may be over-restricted if it should be publicly readable

**Recommendation:** Review if this table should allow public read access

---


### MEDIUM: OVERLY_RESTRICTIVE
**Table:** yc_sync_logs

**Issue:** Table may be over-restricted if it should be publicly readable

**Recommendation:** Review if this table should allow public read access

---


### MEDIUM: OVERLY_RESTRICTIVE
**Table:** founders

**Issue:** Table may be over-restricted if it should be publicly readable

**Recommendation:** Review if this table should allow public read access

---


### MEDIUM: OVERLY_RESTRICTIVE
**Table:** funding_rounds

**Issue:** Table may be over-restricted if it should be publicly readable

**Recommendation:** Review if this table should allow public read access

---


### MEDIUM: OVERLY_RESTRICTIVE
**Table:** company_funding_summary

**Issue:** Table may be over-restricted if it should be publicly readable

**Recommendation:** Review if this table should allow public read access

---


### MEDIUM: OVERLY_RESTRICTIVE
**Table:** company_research_sessions

**Issue:** Table may be over-restricted if it should be publicly readable

**Recommendation:** Review if this table should allow public read access

---


### MEDIUM: OVERLY_RESTRICTIVE
**Table:** project_artifacts

**Issue:** Table may be over-restricted if it should be publicly readable

**Recommendation:** Review if this table should allow public read access

---


### CRITICAL: RLS_LIKELY_MISSING
**Table:** companies

**Issue:** Table shows signs of missing RLS configuration: Invalid API key

**Recommendation:** Enable RLS: ALTER TABLE companies ENABLE ROW LEVEL SECURITY; and create appropriate policies

---


### CRITICAL: RLS_LIKELY_MISSING
**Table:** user_profiles

**Issue:** Table shows signs of missing RLS configuration: Invalid API key

**Recommendation:** Enable RLS: ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY; and create appropriate policies

---


### CRITICAL: RLS_LIKELY_MISSING
**Table:** artifacts

**Issue:** Table shows signs of missing RLS configuration: Invalid API key

**Recommendation:** Enable RLS: ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY; and create appropriate policies

---


### CRITICAL: RLS_LIKELY_MISSING
**Table:** score_history

**Issue:** Table shows signs of missing RLS configuration: Invalid API key

**Recommendation:** Enable RLS: ALTER TABLE score_history ENABLE ROW LEVEL SECURITY; and create appropriate policies

---


### CRITICAL: RLS_LIKELY_MISSING
**Table:** score_batch_logs

**Issue:** Table shows signs of missing RLS configuration: Invalid API key

**Recommendation:** Enable RLS: ALTER TABLE score_batch_logs ENABLE ROW LEVEL SECURITY; and create appropriate policies

---


### CRITICAL: RLS_LIKELY_MISSING
**Table:** github_repositories

**Issue:** Table shows signs of missing RLS configuration: Invalid API key

**Recommendation:** Enable RLS: ALTER TABLE github_repositories ENABLE ROW LEVEL SECURITY; and create appropriate policies

---


### CRITICAL: RLS_LIKELY_MISSING
**Table:** github_repository_metrics

**Issue:** Table shows signs of missing RLS configuration: Invalid API key

**Recommendation:** Enable RLS: ALTER TABLE github_repository_metrics ENABLE ROW LEVEL SECURITY; and create appropriate policies

---


### CRITICAL: RLS_LIKELY_MISSING
**Table:** github_repository_languages

**Issue:** Table shows signs of missing RLS configuration: Invalid API key

**Recommendation:** Enable RLS: ALTER TABLE github_repository_languages ENABLE ROW LEVEL SECURITY; and create appropriate policies

---


### CRITICAL: RLS_LIKELY_MISSING
**Table:** company_github_repositories

**Issue:** Table shows signs of missing RLS configuration: Invalid API key

**Recommendation:** Enable RLS: ALTER TABLE company_github_repositories ENABLE ROW LEVEL SECURITY; and create appropriate policies

---


### CRITICAL: RLS_LIKELY_MISSING
**Table:** github_sync_logs

**Issue:** Table shows signs of missing RLS configuration: Invalid API key

**Recommendation:** Enable RLS: ALTER TABLE github_sync_logs ENABLE ROW LEVEL SECURITY; and create appropriate policies

---


### CRITICAL: RLS_LIKELY_MISSING
**Table:** yc_sync_logs

**Issue:** Table shows signs of missing RLS configuration: Invalid API key

**Recommendation:** Enable RLS: ALTER TABLE yc_sync_logs ENABLE ROW LEVEL SECURITY; and create appropriate policies

---


### CRITICAL: RLS_LIKELY_MISSING
**Table:** founders

**Issue:** Table shows signs of missing RLS configuration: Invalid API key

**Recommendation:** Enable RLS: ALTER TABLE founders ENABLE ROW LEVEL SECURITY; and create appropriate policies

---


### CRITICAL: RLS_LIKELY_MISSING
**Table:** funding_rounds

**Issue:** Table shows signs of missing RLS configuration: Invalid API key

**Recommendation:** Enable RLS: ALTER TABLE funding_rounds ENABLE ROW LEVEL SECURITY; and create appropriate policies

---


### CRITICAL: RLS_LIKELY_MISSING
**Table:** company_funding_summary

**Issue:** Table shows signs of missing RLS configuration: Invalid API key

**Recommendation:** Enable RLS: ALTER TABLE company_funding_summary ENABLE ROW LEVEL SECURITY; and create appropriate policies

---


### CRITICAL: RLS_LIKELY_MISSING
**Table:** company_research_sessions

**Issue:** Table shows signs of missing RLS configuration: Invalid API key

**Recommendation:** Enable RLS: ALTER TABLE company_research_sessions ENABLE ROW LEVEL SECURITY; and create appropriate policies

---


### CRITICAL: RLS_LIKELY_MISSING
**Table:** research_findings

**Issue:** Table shows signs of missing RLS configuration: Invalid API key

**Recommendation:** Enable RLS: ALTER TABLE research_findings ENABLE ROW LEVEL SECURITY; and create appropriate policies

---


### CRITICAL: RLS_LIKELY_MISSING
**Table:** project_artifacts

**Issue:** Table shows signs of missing RLS configuration: Invalid API key

**Recommendation:** Enable RLS: ALTER TABLE project_artifacts ENABLE ROW LEVEL SECURITY; and create appropriate policies

---


### CRITICAL: RLS_LIKELY_MISSING
**Table:** email_campaigns

**Issue:** Table shows signs of missing RLS configuration: Invalid API key

**Recommendation:** Enable RLS: ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY; and create appropriate policies

---


### MEDIUM: WRITE_FUNCTION_ACCESSIBLE


**Issue:** Function "upsert_founder_data" can modify data and may need access restrictions

**Recommendation:** Review function permissions and ensure it's only callable by appropriate roles

---


### MEDIUM: WRITE_FUNCTION_ACCESSIBLE


**Issue:** Function "upsert_funding_summary" can modify data and may need access restrictions

**Recommendation:** Review function permissions and ensure it's only callable by appropriate roles

---


### HIGH: PUBLIC_ACCESS_BLOCKED
**Table:** companies

**Issue:** Public table "companies" is not accessible to anonymous users

**Recommendation:** Check RLS policies to ensure public read access is allowed

---


## 🛠️ Recommended Actions


### 🚨 CRITICAL - Fix Immediately
- Sensitive table error: Invalid API key (user_profiles)
- Sensitive table error: Invalid API key (artifacts)
- Sensitive table error: Invalid API key (company_research_sessions)
- Sensitive table error: Invalid API key (project_artifacts)
- Sensitive table error: Invalid API key (email_campaigns)
- Table shows signs of missing RLS configuration: Invalid API key (companies)
- Table shows signs of missing RLS configuration: Invalid API key (user_profiles)
- Table shows signs of missing RLS configuration: Invalid API key (artifacts)
- Table shows signs of missing RLS configuration: Invalid API key (score_history)
- Table shows signs of missing RLS configuration: Invalid API key (score_batch_logs)
- Table shows signs of missing RLS configuration: Invalid API key (github_repositories)
- Table shows signs of missing RLS configuration: Invalid API key (github_repository_metrics)
- Table shows signs of missing RLS configuration: Invalid API key (github_repository_languages)
- Table shows signs of missing RLS configuration: Invalid API key (company_github_repositories)
- Table shows signs of missing RLS configuration: Invalid API key (github_sync_logs)
- Table shows signs of missing RLS configuration: Invalid API key (yc_sync_logs)
- Table shows signs of missing RLS configuration: Invalid API key (founders)
- Table shows signs of missing RLS configuration: Invalid API key (funding_rounds)
- Table shows signs of missing RLS configuration: Invalid API key (company_funding_summary)
- Table shows signs of missing RLS configuration: Invalid API key (company_research_sessions)
- Table shows signs of missing RLS configuration: Invalid API key (research_findings)
- Table shows signs of missing RLS configuration: Invalid API key (project_artifacts)
- Table shows signs of missing RLS configuration: Invalid API key (email_campaigns)



### ⚠️ HIGH - Fix Soon
- Public table "companies" is not accessible to anonymous users (companies)



### 🔸 MEDIUM - Plan to Fix
- Table access error: Invalid API key (companies)
- Table access error: Invalid API key (score_history)
- Table access error: Invalid API key (score_batch_logs)
- Table access error: Invalid API key (github_repositories)
- Table access error: Invalid API key (github_repository_metrics)
- Table access error: Invalid API key (github_repository_languages)
- Table access error: Invalid API key (company_github_repositories)
- Table access error: Invalid API key (github_sync_logs)
- Table access error: Invalid API key (yc_sync_logs)
- Table access error: Invalid API key (founders)
- Table access error: Invalid API key (funding_rounds)
- Table access error: Invalid API key (company_funding_summary)
- Table access error: Invalid API key (research_findings)
- Table may be over-restricted if it should be publicly readable (companies)
- Table may be over-restricted if it should be publicly readable (score_history)
- Table may be over-restricted if it should be publicly readable (score_batch_logs)
- Table may be over-restricted if it should be publicly readable (github_repositories)
- Table may be over-restricted if it should be publicly readable (github_repository_metrics)
- Table may be over-restricted if it should be publicly readable (github_repository_languages)
- Table may be over-restricted if it should be publicly readable (company_github_repositories)
- Table may be over-restricted if it should be publicly readable (github_sync_logs)
- Table may be over-restricted if it should be publicly readable (yc_sync_logs)
- Table may be over-restricted if it should be publicly readable (founders)
- Table may be over-restricted if it should be publicly readable (funding_rounds)
- Table may be over-restricted if it should be publicly readable (company_funding_summary)
- Table may be over-restricted if it should be publicly readable (company_research_sessions)
- Table may be over-restricted if it should be publicly readable (project_artifacts)
- Function "upsert_founder_data" can modify data and may need access restrictions (System)
- Function "upsert_funding_summary" can modify data and may need access restrictions (System)




---

## 📈 Next Steps

1. **Address Critical Issues:** Fix any critical security vulnerabilities immediately
2. **Review High Priority Items:** Plan fixes for high-priority issues within 1 week
3. **Optimize Performance:** Consider addressing medium and low priority items for better performance
4. **Regular Audits:** Run this audit monthly to catch new issues early

*Audit completed successfully* ✅
