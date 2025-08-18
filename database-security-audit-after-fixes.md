🔍 Starting Supabase Database Security Audit...
📊 Project: axtjjdmiitwwwwmyikuq

🔍 Auditing table configuration and RLS policies...
✅ companies: Accessible (RLS likely configured)
✅ user_profiles: Accessible (RLS likely configured)
✅ artifacts: Accessible (RLS likely configured)
✅ score_history: Accessible (RLS likely configured)
✅ score_batch_logs: Accessible (RLS likely configured)
✅ github_repositories: Accessible (RLS likely configured)
✅ github_repository_metrics: Accessible (RLS likely configured)
✅ github_repository_languages: Accessible (RLS likely configured)
✅ company_github_repositories: Accessible (RLS likely configured)
✅ github_sync_logs: Accessible (RLS likely configured)
✅ yc_sync_logs: Accessible (RLS likely configured)
✅ founders: Accessible (RLS likely configured)
✅ funding_rounds: Accessible (RLS likely configured)
✅ company_funding_summary: Accessible (RLS likely configured)
✅ company_research_sessions: Accessible (RLS likely configured)
✅ research_findings: Accessible (RLS likely configured)
✅ project_artifacts: Accessible (RLS likely configured)
✅ email_campaigns: Accessible (RLS likely configured)
🔐 Auditing RLS policies...
✅ companies: Public access is appropriate
⚠️ HIGH: UNEXPECTED_PUBLIC_ACCESS - user_profiles
   Issue: Table is publicly accessible but may contain sensitive data
   Fix: Review RLS policies to ensure appropriate access restrictions

⚠️ HIGH: UNEXPECTED_PUBLIC_ACCESS - artifacts
   Issue: Table is publicly accessible but may contain sensitive data
   Fix: Review RLS policies to ensure appropriate access restrictions

⚠️ HIGH: UNEXPECTED_PUBLIC_ACCESS - score_history
   Issue: Table is publicly accessible but may contain sensitive data
   Fix: Review RLS policies to ensure appropriate access restrictions

⚠️ HIGH: UNEXPECTED_PUBLIC_ACCESS - score_batch_logs
   Issue: Table is publicly accessible but may contain sensitive data
   Fix: Review RLS policies to ensure appropriate access restrictions

✅ github_repositories: Public access is appropriate
✅ github_repository_metrics: Public access is appropriate
⚠️ HIGH: UNEXPECTED_PUBLIC_ACCESS - github_repository_languages
   Issue: Table is publicly accessible but may contain sensitive data
   Fix: Review RLS policies to ensure appropriate access restrictions

⚠️ HIGH: UNEXPECTED_PUBLIC_ACCESS - company_github_repositories
   Issue: Table is publicly accessible but may contain sensitive data
   Fix: Review RLS policies to ensure appropriate access restrictions

⚠️ HIGH: UNEXPECTED_PUBLIC_ACCESS - github_sync_logs
   Issue: Table is publicly accessible but may contain sensitive data
   Fix: Review RLS policies to ensure appropriate access restrictions

⚠️ HIGH: UNEXPECTED_PUBLIC_ACCESS - yc_sync_logs
   Issue: Table is publicly accessible but may contain sensitive data
   Fix: Review RLS policies to ensure appropriate access restrictions

⚠️ HIGH: UNEXPECTED_PUBLIC_ACCESS - founders
   Issue: Table is publicly accessible but may contain sensitive data
   Fix: Review RLS policies to ensure appropriate access restrictions

⚠️ HIGH: UNEXPECTED_PUBLIC_ACCESS - funding_rounds
   Issue: Table is publicly accessible but may contain sensitive data
   Fix: Review RLS policies to ensure appropriate access restrictions

⚠️ HIGH: UNEXPECTED_PUBLIC_ACCESS - company_funding_summary
   Issue: Table is publicly accessible but may contain sensitive data
   Fix: Review RLS policies to ensure appropriate access restrictions

⚠️ HIGH: UNEXPECTED_PUBLIC_ACCESS - company_research_sessions
   Issue: Table is publicly accessible but may contain sensitive data
   Fix: Review RLS policies to ensure appropriate access restrictions

⚠️ HIGH: UNEXPECTED_PUBLIC_ACCESS - research_findings
   Issue: Table is publicly accessible but may contain sensitive data
   Fix: Review RLS policies to ensure appropriate access restrictions

⚠️ HIGH: UNEXPECTED_PUBLIC_ACCESS - project_artifacts
   Issue: Table is publicly accessible but may contain sensitive data
   Fix: Review RLS policies to ensure appropriate access restrictions

⚠️ HIGH: UNEXPECTED_PUBLIC_ACCESS - email_campaigns
   Issue: Table is publicly accessible but may contain sensitive data
   Fix: Review RLS policies to ensure appropriate access restrictions

📊 Auditing database indexes and performance...
⏱️  companies - Filtering by spearfish_score: 73ms
⏱️  companies - Filtering by batch and AI status: 80ms
⏱️  user_profiles - Looking up by clerk_user_id: 76ms
🔸 MEDIUM: LIKELY_MISSING_INDEX - founders
   Issue: Foreign key should have index: company_id
   Fix: CREATE INDEX idx_founders_company_id ON founders(company_id);

🔸 MEDIUM: LIKELY_MISSING_INDEX - funding_rounds
   Issue: Foreign key should have index: company_id
   Fix: CREATE INDEX idx_funding_rounds_company_id ON funding_rounds(company_id);

🔸 MEDIUM: LIKELY_MISSING_INDEX - research_findings
   Issue: Foreign key should have index: research_session_id
   Fix: CREATE INDEX idx_research_findings_research_session_id ON research_findings(research_session_id);

⚙️ Auditing database functions...
✅ Function get_company_artifacts: Available
❌ Function search_companies: Not found - Could not find the function public.search_companies(limit_count, search_term) in the schema cache
✅ Function upsert_founder_data: Available
🔸 MEDIUM: WRITE_FUNCTION_ACCESSIBLE - N/A
   Issue: Function "upsert_founder_data" can modify data and may need access restrictions
   Fix: Review function permissions and ensure it's only callable by appropriate roles

✅ Function upsert_funding_summary: Available
🔸 MEDIUM: WRITE_FUNCTION_ACCESSIBLE - N/A
   Issue: Function "upsert_funding_summary" can modify data and may need access restrictions
   Fix: Review function permissions and ensure it's only callable by appropriate roles

✅ Function user_id: Available
✅ Function clerk_user_id: Available
✅ Function user_company_id: Available
✅ Function is_company_admin: Available
👤 Testing anonymous access patterns...
✅ Anonymous access to companies: OK
✅ Anonymous access to user_profiles: Properly restricted
✅ Anonymous access to artifacts: Properly restricted

✅ Database security audit completed!
📄 Report saved to: /Users/dwaynejoseph/Projects/spearfish-ai/database-security-audit.md

📊 Summary:
   Tables: 18 (18 with RLS)
   Policies: 18
   Issues: 0 critical, 15 high, 5 medium, 0 low

⚠️  HIGH PRIORITY ISSUES FOUND - Review the report and plan fixes
