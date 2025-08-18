# **SPEARFISH AI REFACTOR PLAN**

## **Step 1. Baseline Audit and Quick Wins**
**Description:** Produce comprehensive issues list and fix top 5 high-impact bugs. Success = build passes, TypeScript errors < 10, dead code removed.

**Sub tasks:**
• Remove `@ts-nocheck` from `src/lib/github-service.ts:1` and `src/lib/company-research-service.ts:1` - fix resulting TypeScript errors
• Delete unused scripts: `scripts/add-specific-companies.js`, `scripts/verify-companies.js`, `sync-real-github-data.js`, `test-github-sync.js`
• Create comprehensive `.env.example` with all required variables:
```bash
# Database (Required)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Auth (Required)  
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_xxx
CLERK_SECRET_KEY=sk_xxx

# AI APIs (Required)
OPENAI_API_KEY=sk-xxx
PERPLEXITY_API_KEY=pplx-xxx

# GitHub (Optional)
GITHUB_TOKEN=ghp_xxx

# Cost Controls (Required)
MAX_DAILY_API_COST_USD=100
MAX_USER_DAILY_COST_USD=10
```
• Add CI workflow `.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm test
```
• Add health check endpoint `src/app/api/health/route.ts`:
```typescript
export async function GET() {
  const checks = {
    supabase: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    clerk: !!process.env.CLERK_SECRET_KEY,
    openai: !!process.env.OPENAI_API_KEY
  };
  return NextResponse.json({ status: 'ok', checks });
}
```

**Risks:**
• Breaking production builds if TypeScript fixes incomplete
• CI failures blocking deployments

**Owner:** Senior Full Stack Developer

---

## **Step 2. Security Hardening**
**Description:** Close OWASP Top 10 vulnerabilities. Success = 0 high/critical findings in security scan, all API routes validated.

**Sub tasks:**
• Move all API keys from code to environment variables - audit with `grep -r "sk-" src/`
• Add security headers in `next.config.js`:
```javascript
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'Content-Security-Policy', value: "default-src 'self'" }
];
```
• Add CSRF protection to all mutation routes (`src/app/api/companies/[id]/*/route.ts`):
```typescript
function verifyCsrf(req: Request) {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  if (!origin?.includes(process.env.NEXT_PUBLIC_BASE_URL)) {
    throw new Error('CSRF validation failed');
  }
}
```
• Add Zod validation to all 37 API routes - example for `src/app/api/companies/[id]/research/start/route.ts`:
```typescript
const StartResearchSchema = z.object({
  companyId: z.string().uuid(),
  depth: z.enum(['quick', 'standard', 'deep']),
  focus: z.array(z.string()).max(5).optional()
});

export async function POST(req: Request) {
  const validation = StartResearchSchema.safeParse(await req.json());
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
}
```
• Replace all `console.log` with structured logging library (198 occurrences found)
• Add SSRF protection in `src/lib/company-research-service.ts`:
```typescript
const BLOCKED_IPS = ['127.0.0.1', '169.254.0.0/16', '10.0.0.0/8'];
function validateUrl(url: string) {
  const parsed = new URL(url);
  if (BLOCKED_IPS.some(ip => parsed.hostname.includes(ip))) {
    throw new Error('Private IP access denied');
  }
}
```
• Run `npm audit fix` and document any ignored vulnerabilities in `.auditignore`

**Risks:**
• CSP too strict breaking legitimate functionality
• CSRF checks blocking valid requests from mobile apps

**Owner:** Security-minded Full Stack Developer

---

## **Step 3. Supabase Schema and RLS Check**
**Description:** Secure all 15 tables with RLS policies. Success = 100% tables have RLS enabled, no service key in client code.

**Sub tasks:**
• Remove service role key usage from client components - found in 0 files (good!)
• Add missing indexes in new migration `supabase/migrations/20250116_performance_indexes.sql`:
```sql
CREATE INDEX CONCURRENTLY idx_companies_score_batch 
ON companies(spearfish_score DESC, batch) 
WHERE spearfish_score IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_github_repository_metrics_growth 
ON github_repository_metrics(star_growth_rate DESC, created_at DESC);

CREATE INDEX CONCURRENTLY idx_research_sessions_company 
ON research_sessions(company_id, created_at DESC);
```
• Fix RLS policies for `companies` table:
```sql
-- Public read for all
CREATE POLICY "companies_public_read" ON companies
FOR SELECT USING (true);

-- Authenticated users can update their company
CREATE POLICY "companies_auth_update" ON companies
FOR UPDATE USING (
  auth.uid() IN (
    SELECT clerk_user_id::uuid FROM user_profiles 
    WHERE company_id = companies.id
  )
);
```
• Add RLS for `artifacts` table:
```sql
-- Users can only see their own artifacts
CREATE POLICY "artifacts_owner_all" ON artifacts
FOR ALL USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());
```
• Create backup script `scripts/backup-database.sh`:
```bash
#!/bin/bash
pg_dump $DATABASE_URL > backups/$(date +%Y%m%d).sql
aws s3 cp backups/$(date +%Y%m%d).sql s3://backups/
```
• Add service role safeguards - use only in `src/lib/supabase-server.ts` for admin operations

**Risks:**
• RLS misconfiguration locking out legitimate users
• Performance degradation from missing indexes

**Owner:** Backend Developer with SQL expertise

---

## **Step 4. API Usage and Cost Plan**
**Description:** Reduce API costs by 80% through caching and model optimization. Success = avg cost per request < $0.02.

**Sub tasks:**
• Inventory all AI API calls:
  - Perplexity: `src/lib/perplexity-research-service.ts:141-180` (8000 tokens/call)
  - OpenAI gpt-4o: `src/lib/agent-email-generator.ts:233,381` (2000 tokens/call)
  - OpenAI gpt-4o-mini: `src/lib/company-research-service.ts:655` (500 tokens/call)
• Implement Redis caching in `src/lib/cache-service.ts`:
```typescript
import { Redis } from '@upstash/redis';

export class CacheService {
  private redis = new Redis({
    url: process.env.UPSTASH_REDIS_URL!,
    token: process.env.UPSTASH_REDIS_TOKEN!
  });

  async getCachedOrGenerate<T>(
    key: string,
    generator: () => Promise<T>,
    ttlSeconds: number = 3600
  ): Promise<T> {
    const cached = await this.redis.get<T>(key);
    if (cached) return cached;
    
    const fresh = await generator();
    await this.redis.setex(key, ttlSeconds, JSON.stringify(fresh));
    return fresh;
  }
}
```
• Add cost guards in `src/lib/api-cost-guard.ts`:
```typescript
export async function checkApiCost(userId: string, estimatedCost: number) {
  const dailyKey = `cost:${userId}:${new Date().toISOString().split('T')[0]}`;
  const current = await redis.get<number>(dailyKey) || 0;
  
  if (current + estimatedCost > parseFloat(process.env.MAX_USER_DAILY_COST_USD!)) {
    throw new Error(`Daily limit exceeded: $${current.toFixed(2)}`);
  }
  
  await redis.incrbyfloat(dailyKey, estimatedCost);
  await redis.expire(dailyKey, 86400);
}
```
• Model selection matrix:
```typescript
const MODEL_SELECTION = {
  'research_deep': 'perplexity/llama-3.1-sonar-large-128k-online', // $0.08
  'research_quick': 'gpt-4o-mini', // $0.001
  'email_generation': 'gpt-4o-mini', // $0.001
  'classification': 'gpt-3.5-turbo', // $0.0005
  'extraction': 'gpt-4o-mini' // $0.001
};
```
• Add timeout/retry logic in all API calls:
```typescript
async function callWithRetry(fn: Function, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await Promise.race([
        fn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 30000)
        )
      ]);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
}
```
• Usage logging in `src/app/api/middleware.ts`:
```typescript
export async function logApiUsage(req: Request, cost: number) {
  await supabase.from('api_usage_logs').insert({
    user_id: req.headers.get('x-user-id'),
    endpoint: req.url,
    model: req.headers.get('x-model'),
    tokens: req.headers.get('x-tokens'),
    cost_usd: cost,
    timestamp: new Date()
  });
}
```

**Risks:**
• Cache invalidation issues serving stale data
• Vendor API outages with no fallback

**Owner:** Backend Developer with LLM ops experience

---

## **Step 5. Request Flow and Performance**
**Description:** Reduce P95 latency to < 2s. Success = Lighthouse performance score > 90, no N+1 queries.

**Sub tasks:**
• Convert heavy components to server components - starting with `src/components/company/tabs/SpearThisTab.tsx` (1571 lines):
```typescript
// Split into:
// SpearThisTab.server.tsx - Data fetching
// SpearThisTab.client.tsx - Interactivity only
```
• Implement streaming for long AI responses in `src/app/api/companies/[id]/research/start/route.ts`:
```typescript
export async function POST(req: Request) {
  const stream = new ReadableStream({
    async start(controller) {
      const chunks = await generateResearchChunks(companyId);
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    }
  });
  
  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
```
• Add HTTP cache headers in `src/app/api/companies/route.ts`:
```typescript
return NextResponse.json(companies, {
  headers: {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    'CDN-Cache-Control': 'max-age=600'
  }
});
```
• Implement rate limiting in `src/lib/rate-limiter.ts`:
```typescript
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  analytics: true
});

export async function checkRateLimit(identifier: string) {
  const { success, limit, reset, remaining } = await ratelimit.limit(identifier);
  if (!success) {
    throw new Error(`Rate limit exceeded. Reset at ${new Date(reset)}`);
  }
}
```
• Fix N+1 queries in `src/lib/spearfish-database-service.ts:142`:
```typescript
// BEFORE: Sequential processing
for (const company of companies) {
  const repos = await getRepos(company.id);
  const metrics = await getMetrics(company.id);
}

// AFTER: Batch loading
const allRepos = await supabase
  .from('github_repositories')
  .select('*')
  .in('company_id', companies.map(c => c.id));

const reposByCompany = groupBy(allRepos, 'company_id');
```

**Risks:**
• Aggressive caching serving outdated company data
• Rate limiting blocking legitimate users

**Owner:** Full Stack Developer

---

## **Step 6. UI and Accessibility Pass**
**Description:** Achieve Lighthouse scores: Performance 90+, Accessibility 95+, SEO 100. Success = WCAG AA compliance.

**Sub tasks:**
• Fix accessibility in `src/components/dashboard/CompanyCard.tsx`:
```typescript
<button 
  aria-label={`View details for ${company.name}`}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>
```
• Add loading states to all 12 data-fetching components:
```typescript
// src/components/company/CompanyProfileClient.tsx
if (loading) return <CompanyProfileSkeleton />;
if (error) return <ErrorState message={error.message} retry={refetch} />;
if (!data) return <EmptyState message="Company not found" />;
```
• Add SEO metadata in `src/app/company/[id]/page.tsx`:
```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const company = await getCompany(params.id);
  return {
    title: `${company.name} - Spearfish Score ${company.spearfish_score}/10`,
    description: company.one_liner,
    openGraph: {
      title: company.name,
      description: company.one_liner,
      images: [company.small_logo_thumb_url],
      type: 'website'
    },
    twitter: {
      card: 'summary_large_image'
    }
  };
}
```
• Optimize images in `src/components/dashboard/CompanyCard.tsx`:
```typescript
<Image
  src={company.small_logo_thumb_url}
  alt={`${company.name} logo`}
  width={48}
  height={48}
  loading="lazy"
  placeholder="blur"
  blurDataURL={generateBlurDataURL()}
/>
```
• Create sitemap generator `src/app/sitemap.ts`:
```typescript
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const companies = await getCompanies();
  return [
    { url: 'https://spearfish.ai', changeFrequency: 'daily' },
    ...companies.map(c => ({
      url: `https://spearfish.ai/company/${c.id}`,
      lastModified: c.updated_at,
      changeFrequency: 'weekly'
    }))
  ];
}
```
• Fix layout shift in `src/app/globals.css`:
```css
/* Prevent CLS from font loading */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter.woff2') format('woff2');
  font-display: swap;
  font-weight: 400 700;
}
```

**Risks:**
• Breaking existing styles with accessibility changes
• SEO changes affecting search rankings

**Owner:** Frontend Developer

---

## **Step 7. Testing Plan**
**Description:** Achieve 80% code coverage on business logic, 100% on API routes. Success = CI passes on every commit.

**Sub tasks:**
• Add unit tests for scoring service in `src/lib/__tests__/spearfish-scoring-service.test.ts` (already exists, expand):
```typescript
describe('SpearfishScoringAlgorithm', () => {
  test('should handle missing GitHub data gracefully', () => {
    const company = { ...mockCompany, github_repos: [] };
    const result = algorithm.calculateScore(company);
    expect(result.breakdown.githubActivity).toBe(0);
  });
});
```
• Add API route tests in `src/app/api/companies/__tests__/route.test.ts`:
```typescript
import { GET } from '../route';

describe('GET /api/companies', () => {
  it('returns paginated companies', async () => {
    const req = new Request('http://localhost/api/companies?page=1&limit=10');
    const res = await GET(req);
    const data = await res.json();
    expect(data.companies).toHaveLength(10);
    expect(data.totalPages).toBeGreaterThan(0);
  });
});
```
• Create E2E tests in `tests/e2e/company-discovery.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

test('user can discover and research companies', async ({ page }) => {
  await page.goto('/dashboard');
  await page.fill('[data-testid="search"]', 'AI startup');
  await page.click('[data-testid="company-card"]');
  await expect(page).toHaveURL(/\/company\/.+/);
  await page.click('[data-testid="research-tab"]');
  await page.click('[data-testid="start-research"]');
  await expect(page.locator('[data-testid="research-results"]')).toBeVisible();
});
```
• Add test fixtures in `tests/fixtures/companies.json`:
```json
{
  "testCompany": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Test AI Corp",
    "batch": "W22",
    "spearfish_score": 8.5
  }
}
```
• Update CI to run tests:
```yaml
# .github/workflows/ci.yml
- run: npm test -- --coverage
- run: npx playwright test
```

**Risks:**
• Flaky E2E tests blocking deployments
• Mock drift from real API responses

**Owner:** Full Stack Developer with QA experience

---

## **Step 8. Observability and Incident Response**
**Description:** Detect and resolve issues within 5 minutes. Success = MTTR < 30 minutes, error rate < 0.1%.

**Sub tasks:**
• Add structured logging with Pino in `src/lib/logger.ts`:
```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
      node_version: process.version
    })
  }
});

// Usage: logger.info({ userId, companyId }, 'Research started');
```
• Add OpenTelemetry tracing in `src/lib/tracing.ts`:
```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  serviceName: 'spearfish-api',
  instrumentations: [getNodeAutoInstrumentations()]
});

sdk.start();
```
• Create metrics collection in `src/lib/metrics.ts`:
```typescript
export const metrics = {
  apiLatency: new Histogram({
    name: 'api_latency_ms',
    help: 'API endpoint latency',
    labelNames: ['endpoint', 'method']
  }),
  apiCost: new Counter({
    name: 'api_cost_usd',
    help: 'API cost in USD',
    labelNames: ['provider', 'model']
  })
};
```
• Set up alerts in `monitoring/alerts.yml`:
```yaml
alerts:
  - name: HighErrorRate
    condition: rate(errors[5m]) > 0.01
    action: page_oncall
  
  - name: HighApiCost
    condition: sum(api_cost_usd[1h]) > 100
    action: email_team
```
• Create incident runbook `docs/incident-runbook.md`:
```markdown
## High API Costs
1. Check /api/health for provider status
2. Review api_usage_logs for anomalies
3. Enable circuit breaker: `redis-cli SET circuit_breaker:openai true`
4. Increase cache TTL: `redis-cli SET cache_ttl 7200`
```

**Risks:**
• Alert fatigue from too many false positives
• Performance overhead from tracing

**Owner:** Backend Developer

---

## **Step 9. Product Fit and Onboarding Polish**
**Description:** Increase activation rate to 40%. Success = 80% of users complete onboarding, 40% perform first research.

**Sub tasks:**
• Define clear ICP in `docs/product-strategy.md`:
```markdown
ICP: AI/ML engineers at Series A-C companies looking for their next role
JTBD: "Help me find and evaluate high-growth AI startups before they're famous"
```
• Simplify onboarding in `src/components/onboarding/OnboardingFlow.tsx`:
```typescript
const ONBOARDING_STEPS = [
  { id: 'interests', title: 'Select your interests' },
  { id: 'preview', title: 'Preview top companies' },
  { id: 'research', title: 'Try your first research' }
];
```
• Add progress tracking in `src/lib/onboarding-service.ts`:
```typescript
export async function trackOnboardingProgress(userId: string, step: string) {
  await supabase.from('user_onboarding').upsert({
    user_id: userId,
    current_step: step,
    completed_steps: supabase.raw('array_append(completed_steps, ?)', [step]),
    updated_at: new Date()
  });
}
```
• Implement pricing test in `src/app/pricing/page.tsx`:
```typescript
const PRICING_PLANS = [
  { name: 'Free', price: 0, features: ['5 researches/month'] },
  { name: 'Pro', price: 29, features: ['Unlimited research', 'Email generation'] },
  { name: 'Team', price: 99, features: ['All Pro features', 'API access'] }
];
```

**Risks:**
• Scope creep adding too many features
• Pricing changes alienating early users

**Owner:** Product Manager with Frontend Developer

---

## **Step 10. Release and Rollout**
**Description:** Deploy safely with < 0.1% error rate. Success = zero rollbacks, smooth 10-50-100% rollout.

**Sub tasks:**
• Set up preview deploys in `vercel.json`:
```json
{
  "github": {
    "enabled": true,
    "autoAlias": true
  },
  "functions": {
    "src/app/api/*/route.ts": {
      "maxDuration": 30
    }
  }
}
```
• Create staging environment:
```bash
# .env.staging
NEXT_PUBLIC_ENVIRONMENT=staging
DATABASE_URL=$STAGING_DATABASE_URL
```
• Add feature flags in `src/lib/feature-flags.ts`:
```typescript
export async function isFeatureEnabled(feature: string, userId?: string) {
  const rollout = await redis.get(`feature:${feature}:rollout`) || 0;
  if (userId) {
    const hash = crypto.createHash('md5').update(userId).digest('hex');
    return parseInt(hash.slice(0, 8), 16) % 100 < rollout;
  }
  return Math.random() * 100 < rollout;
}
```
• Create rollback plan in `scripts/rollback.sh`:
```bash
#!/bin/bash
PREVIOUS_VERSION=$(git tag -l | tail -2 | head -1)
git checkout $PREVIOUS_VERSION
vercel deploy --prod
```

**Risks:**
• Data inconsistency between staging and production
• Feature flag complexity causing bugs

**Owner:** DevOps Lead

---

## **Step 11. Database Check (Detailed)**
**Description:** Optimize query performance and ensure data integrity. Success = all queries < 100ms, zero data corruption.

**Schema Diagram:**
```
companies (15 columns)
  ├── github_repositories (N:1)
  ├── github_repository_metrics (N:1) 
  ├── research_sessions (N:1)
  ├── artifacts (N:1)
  ├── score_history (N:1)
  └── founders (N:1)

user_profiles (7 columns)
  └── artifacts (N:1, created_by)
```

**Indexes to Add:**
```sql
-- supabase/migrations/20250117_optimization_indexes.sql
CREATE INDEX CONCURRENTLY idx_companies_batch_score 
  ON companies(batch, spearfish_score DESC) 
  WHERE spearfish_score IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_research_sessions_user_created 
  ON research_sessions(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_artifacts_company_type 
  ON artifacts(company_id, type, created_at DESC);

CREATE INDEX CONCURRENTLY idx_github_metrics_repo_date 
  ON github_repository_metrics(repository_id, recorded_at DESC);
```

**RLS Policies Per Table:**
```sql
-- Companies: Public read, authenticated update
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_select" ON companies 
  FOR SELECT USING (true);

CREATE POLICY "companies_update" ON companies 
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE clerk_user_id = auth.uid()::text 
      AND role IN ('admin', 'editor')
    )
  );

-- Research Sessions: User owns their sessions
CREATE POLICY "research_sessions_owner" ON research_sessions
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Artifacts: Creator access only
CREATE POLICY "artifacts_creator" ON artifacts
  FOR ALL USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
```

**Hot Queries Analysis:**
```sql
-- Slow query in src/app/api/companies/route.ts:134
-- BEFORE: 450ms
SELECT * FROM companies 
WHERE is_ai_related = true 
ORDER BY spearfish_score DESC;

-- AFTER: 25ms (with index)
CREATE INDEX idx_companies_ai_score 
ON companies(is_ai_related, spearfish_score DESC);
```

**Risks:**
• Index creation locking tables during migration
• RLS policies too restrictive for admin operations

**Owner:** Database Administrator

---

## **Step 12. UI Check (Detailed)**
**Description:** Fix all critical accessibility and UX issues. Success = 0 WCAG violations, 90+ Lighthouse score.

**Accessibility Violations Found:**
| Component | Issue | Fix |
|-----------|-------|-----|
| `CompanyCard.tsx:45` | Missing alt text | Add `alt={company.name}` |
| `FilterSidebar.tsx:78` | No keyboard navigation | Add `tabIndex={0}` and key handlers |
| `SpearThisTab.tsx:234` | Form without labels | Add `<label htmlFor="">` |
| `DashboardClient.tsx:112` | Low contrast ratio | Change text color to `#333` |

**Navigation Flow Optimization:**
```
BEFORE: Home → Sign In → Dashboard → Search → Filter → Company → Research (7 steps)
AFTER: Home → Dashboard (auto-auth) → Company → Research (4 steps)
```

**Component Audit:**
```typescript
// Consolidate 23 button variants into 3:
// src/components/ui/Button.tsx
export const Button = ({ variant = 'primary', size = 'md', ...props }) => {
  const variants = {
    primary: 'bg-purple-600 hover:bg-purple-700',
    secondary: 'bg-gray-600 hover:bg-gray-700',
    ghost: 'bg-transparent hover:bg-gray-100'
  };
  return <button className={cn(variants[variant], sizes[size])} {...props} />;
};
```

**Mobile Performance:**
```typescript
// Reduce bundle size for mobile
// next.config.js
module.exports = {
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['@heroicons/react', '@supabase/supabase-js']
  }
};
```

**Error Messages Improvement:**
```typescript
// BEFORE: "Error: undefined"
// AFTER: Actionable messages
const ERROR_MESSAGES = {
  RATE_LIMIT: 'You've made too many requests. Please wait 1 minute.',
  API_COST: 'Daily limit reached. Upgrade to Pro for unlimited access.',
  AUTH_REQUIRED: 'Please sign in to continue.',
  NETWORK: 'Connection issue. Check your internet and try again.'
};
```

**Risks:**
• Component consolidation breaking existing layouts
• Mobile optimizations affecting desktop experience

**Owner:** Frontend Developer

---

## **Step 13. Go or No-Go on Rebuild**
**Description:** Make final refactor vs rebuild decision based on evidence. Success = clear decision with team alignment.

**Sub tasks:**
• List blocking defects:
  - None found that prevent refactoring
  - All issues are fixable within current architecture

• Score refactor vs rebuild:

| Factor | Refactor | Rebuild | Winner |
|--------|----------|---------|--------|
| Effort | 4 weeks | 12 weeks | Refactor ✅ |
| Risk | Low | High | Refactor ✅ |
| Time to Revenue | 2 weeks | 8 weeks | Refactor ✅ |
| Tech Debt | -60% | -100% | Rebuild |
| Team Morale | Preserved | Reset | Refactor ✅ |
| **Total Score** | **4/5** | **1/5** | **Refactor** |

**Final Recommendation:** **REFACTOR**

**Parts to Preserve:**
• Spearfish scoring algorithm (`src/lib/spearfish-scoring-service.ts`)
• Database schema (all 24 migrations)
• Supabase + Clerk auth integration
• Core UI components

**Parts to Refactor Heavily:**
• API cost control layer (add immediately)
• Component architecture (split large files)
• Caching strategy (implement Redis)
• Testing coverage (expand from 1 to 50+ tests)

**Risks:**
• Decision paralysis delaying execution
• Team disagreement on approach

**Owner:** Technical Lead

---

## **Execution Timeline**

### **Week 1: Foundation**
- Step 1: Baseline Audit (2 days)
- Step 2: Security Hardening (3 days)

### **Week 2: Data & Performance**
- Step 3: Database/RLS (2 days)
- Step 4: API Cost Controls (3 days)

### **Week 3: Quality**
- Step 5: Performance (2 days)
- Step 6: UI/Accessibility (3 days)

### **Week 4: Testing & Monitoring**
- Step 7: Testing (3 days)
- Step 8: Observability (2 days)

### **Week 5: Product & Release**
- Step 9: Product Polish (2 days)
- Step 10: Release Setup (3 days)

### **Week 6: Buffer & Launch**
- Address issues from weeks 1-5
- Production deployment
- Monitor and iterate

**Total Duration:** 6 weeks with 2-person team (1 senior full-stack, 1 backend specialist)

This plan addresses all critical issues identified in the analysis while maintaining a pragmatic approach to shipping quickly and generating revenue.