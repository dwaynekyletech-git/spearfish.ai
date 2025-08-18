# RLS Policy Test Report

**Generated:** 2025-08-16T03:16:52.590Z
**Database:** axtjjdmiitwwwwmyikuq

## 📊 Test Summary

- **Total Tests:** 28
- **Passed:** 15
- **Failed:** 13
- **Success Rate:** 53.6%

## 🔍 Test Results


### ❌ anon_access_companies

**Description:** Anonymous access to companies
**Expected:** Accessible
**Actual:** Blocked
**Status:** FAIL
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ✅ anon_access_user_profiles

**Description:** Anonymous access to user_profiles
**Expected:** Blocked
**Actual:** Blocked
**Status:** PASS
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ✅ anon_access_artifacts

**Description:** Anonymous access to artifacts
**Expected:** Blocked
**Actual:** Blocked
**Status:** PASS
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ✅ anon_access_company_research_sessions

**Description:** Anonymous access to company_research_sessions
**Expected:** Blocked
**Actual:** Blocked
**Status:** PASS
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ✅ anon_access_research_findings

**Description:** Anonymous access to research_findings
**Expected:** Blocked
**Actual:** Blocked
**Status:** PASS
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ✅ anon_access_project_artifacts

**Description:** Anonymous access to project_artifacts
**Expected:** Blocked
**Actual:** Blocked
**Status:** PASS
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ✅ anon_access_email_campaigns

**Description:** Anonymous access to email_campaigns
**Expected:** Blocked
**Actual:** Blocked
**Status:** PASS
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ✅ anon_access_score_history

**Description:** Anonymous access to score_history
**Expected:** Blocked
**Actual:** Blocked
**Status:** PASS
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ✅ anon_access_score_batch_logs

**Description:** Anonymous access to score_batch_logs
**Expected:** Blocked
**Actual:** Blocked
**Status:** PASS
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ✅ anon_access_github_sync_logs

**Description:** Anonymous access to github_sync_logs
**Expected:** Blocked
**Actual:** Blocked
**Status:** PASS
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ✅ anon_access_yc_sync_logs

**Description:** Anonymous access to yc_sync_logs
**Expected:** Blocked
**Actual:** Blocked
**Status:** PASS
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ✅ anon_access_github_repository_languages

**Description:** Anonymous access to github_repository_languages
**Expected:** Blocked
**Actual:** Blocked
**Status:** PASS
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ✅ anon_access_company_github_repositories

**Description:** Anonymous access to company_github_repositories
**Expected:** Blocked
**Actual:** Blocked
**Status:** PASS
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ❌ anon_access_founders

**Description:** Anonymous access to founders
**Expected:** Accessible
**Actual:** Blocked
**Status:** FAIL
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ❌ anon_access_funding_rounds

**Description:** Anonymous access to funding_rounds
**Expected:** Accessible
**Actual:** Blocked
**Status:** FAIL
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ❌ anon_access_company_funding_summary

**Description:** Anonymous access to company_funding_summary
**Expected:** Accessible
**Actual:** Blocked
**Status:** FAIL
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ❌ anon_access_github_repositories

**Description:** Anonymous access to github_repositories
**Expected:** Accessible
**Actual:** Blocked
**Status:** FAIL
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ❌ anon_access_github_repository_metrics

**Description:** Anonymous access to github_repository_metrics
**Expected:** Accessible
**Actual:** Blocked
**Status:** FAIL
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ✅ anon_insert_blocked

**Description:** Anonymous insert to user_profiles should be blocked
**Expected:** Blocked
**Actual:** Blocked
**Status:** PASS
**Details:** `{"errorMessage":"Invalid API key"}`

---


### ✅ anon_update_blocked

**Description:** Anonymous update to companies should be blocked
**Expected:** Blocked
**Actual:** Blocked
**Status:** PASS
**Details:** `{"errorMessage":"Invalid API key"}`

---


### ✅ anon_delete_blocked

**Description:** Anonymous delete from companies should be blocked
**Expected:** Blocked
**Actual:** Blocked
**Status:** PASS
**Details:** `{"errorMessage":"Invalid API key"}`

---


### ❌ service_access_companies

**Description:** Service role access to companies
**Expected:** Accessible
**Actual:** Blocked
**Status:** FAIL
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ❌ service_access_user_profiles

**Description:** Service role access to user_profiles
**Expected:** Accessible
**Actual:** Blocked
**Status:** FAIL
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ❌ service_access_artifacts

**Description:** Service role access to artifacts
**Expected:** Accessible
**Actual:** Blocked
**Status:** FAIL
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ❌ service_access_score_history

**Description:** Service role access to score_history
**Expected:** Accessible
**Actual:** Blocked
**Status:** FAIL
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ❌ service_access_score_batch_logs

**Description:** Service role access to score_batch_logs
**Expected:** Accessible
**Actual:** Blocked
**Status:** FAIL
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ❌ service_access_github_sync_logs

**Description:** Service role access to github_sync_logs
**Expected:** Accessible
**Actual:** Blocked
**Status:** FAIL
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


### ❌ service_access_yc_sync_logs

**Description:** Service role access to yc_sync_logs
**Expected:** Accessible
**Actual:** Blocked
**Status:** FAIL
**Details:** `{"errorMessage":"Invalid API key","dataReturned":0}`

---


## 🚨 Security Issues


### anon_access_companies
**Issue:** Anonymous access to companies
**Expected:** Accessible
**Actual:** Blocked

---


### anon_access_founders
**Issue:** Anonymous access to founders
**Expected:** Accessible
**Actual:** Blocked

---


### anon_access_funding_rounds
**Issue:** Anonymous access to funding_rounds
**Expected:** Accessible
**Actual:** Blocked

---


### anon_access_company_funding_summary
**Issue:** Anonymous access to company_funding_summary
**Expected:** Accessible
**Actual:** Blocked

---


### anon_access_github_repositories
**Issue:** Anonymous access to github_repositories
**Expected:** Accessible
**Actual:** Blocked

---


### anon_access_github_repository_metrics
**Issue:** Anonymous access to github_repository_metrics
**Expected:** Accessible
**Actual:** Blocked

---


### service_access_companies
**Issue:** Service role access to companies
**Expected:** Accessible
**Actual:** Blocked

---


### service_access_user_profiles
**Issue:** Service role access to user_profiles
**Expected:** Accessible
**Actual:** Blocked

---


### service_access_artifacts
**Issue:** Service role access to artifacts
**Expected:** Accessible
**Actual:** Blocked

---


### service_access_score_history
**Issue:** Service role access to score_history
**Expected:** Accessible
**Actual:** Blocked

---


### service_access_score_batch_logs
**Issue:** Service role access to score_batch_logs
**Expected:** Accessible
**Actual:** Blocked

---


### service_access_github_sync_logs
**Issue:** Service role access to github_sync_logs
**Expected:** Accessible
**Actual:** Blocked

---


### service_access_yc_sync_logs
**Issue:** Service role access to yc_sync_logs
**Expected:** Accessible
**Actual:** Blocked

---


## 📝 Recommendations


### Critical Actions Required

- Fix anon_access_companies: Anonymous access to companies
- Fix anon_access_founders: Anonymous access to founders
- Fix anon_access_funding_rounds: Anonymous access to funding_rounds
- Fix anon_access_company_funding_summary: Anonymous access to company_funding_summary
- Fix anon_access_github_repositories: Anonymous access to github_repositories
- Fix anon_access_github_repository_metrics: Anonymous access to github_repository_metrics
- Fix service_access_companies: Service role access to companies
- Fix service_access_user_profiles: Service role access to user_profiles
- Fix service_access_artifacts: Service role access to artifacts
- Fix service_access_score_history: Service role access to score_history
- Fix service_access_score_batch_logs: Service role access to score_batch_logs
- Fix service_access_github_sync_logs: Service role access to github_sync_logs
- Fix service_access_yc_sync_logs: Service role access to yc_sync_logs

### Next Steps

1. Review failed test cases above
2. Check RLS policy configuration in Supabase Dashboard
3. Verify policy conditions and user context
4. Re-run tests after fixes



---

**Report completed at:** 2025-08-16T03:16:53.695Z
