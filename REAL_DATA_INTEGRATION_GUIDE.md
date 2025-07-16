# Real Data Integration Guide for Spearfish AI

This guide outlines all the steps needed to populate the Spearfish AI platform with real Y Combinator company data, including company information, GitHub repositories, and automated scoring.

## Overview

The platform needs real data for:
1. Y Combinator company information
2. GitHub repository associations
3. Technical metrics and scoring
4. Founder information
5. Job listings and hiring status

## Step 1: Y Combinator Company Data

### 1.1 Data Sources
- **YC Company Directory**: https://www.ycombinator.com/companies
- **YC API** (if available): Check for official YC API access
- **Web Scraping**: As a fallback, scrape public YC company data
- **Manual Entry**: For initial testing with select companies

### 1.2 Required Company Information
```sql
-- Fields needed for each company:
- name (company name)
- one_liner (short description)
- long_description (detailed description)
- website (company website URL)
- industry (primary industry/category)
- team_size (number of employees)
- batch (YC batch, e.g., "W24", "S23")
- status (Active, Acquired, Public, Inactive)
- founded_date
- regions (array of locations)
- tags (array of technology/market tags)
- is_hiring (boolean)
```

### 1.3 Implementation Steps
1. **Create YC Data Import Script**
   ```javascript
   // src/scripts/import-yc-companies.js
   - Fetch company data from YC sources
   - Transform to match our schema
   - Bulk insert into companies table
   - Handle duplicates and updates
   ```

2. **Set up automated sync**
   - Create cron job to check for new YC companies
   - Update existing company information
   - Track last sync timestamp

## Step 2: GitHub Repository Discovery

### 2.1 Discovery Methods

1. **Direct Website Parsing**
   ```javascript
   // Look for GitHub links on company websites
   - Parse company.website for github.com links
   - Check footer, about pages, team pages
   - Look for "github.com/[org-name]" patterns
   ```

2. **GitHub Search API**
   ```javascript
   // Search GitHub for company names
   const results = await octokit.search.repos({
     q: `org:${companyName} OR ${companyName} in:name`,
     sort: 'stars',
     order: 'desc'
   });
   ```

3. **Manual Curation**
   - Create admin interface for manual repository associations
   - Allow confidence scoring for associations
   - Track discovery method

### 2.2 Repository Association Process
1. **Automated Discovery**
   ```sql
   -- For each company without GitHub repos:
   1. Search GitHub API by company name
   2. Check company website for GitHub links
   3. Score confidence based on:
      - Name match similarity
      - Website domain match
      - Description similarity
      - Technology stack alignment
   ```

2. **Verification Steps**
   - Repositories with confidence > 0.8: Auto-approve
   - Repositories with confidence 0.5-0.8: Manual review
   - Repositories with confidence < 0.5: Reject

## Step 3: Founder Information

### 3.1 Data Sources
- LinkedIn API (with proper authorization)
- Crunchbase API
- YC founder profiles
- Twitter/X profiles

### 3.2 Implementation
```sql
-- Create founders table
CREATE TABLE founders (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  name TEXT NOT NULL,
  role TEXT,
  linkedin_url TEXT,
  twitter_handle TEXT,
  github_username TEXT,
  bio TEXT
);
```

## Step 4: Real-Time Data Sync

### 4.1 GitHub Data Sync (Already Implemented)
```javascript
// Current implementation syncs:
- Repository metrics (stars, forks, issues)
- Language breakdowns
- Contributor counts
- Commit activity
- Release history
```

### 4.2 Company Information Updates
1. **Weekly sync for company data**
   - Check for status changes (acquisitions, shutdowns)
   - Update team size
   - Update hiring status
   - Refresh descriptions

2. **Daily sync for metrics**
   - GitHub metrics (already implemented)
   - Website availability
   - News mentions (future feature)

## Step 5: Spearfish Score Calculation

### 5.1 Real Score Components
```javascript
// Current scoring factors:
1. teamSize: 15% (real employee count)
2. githubStars: 20% (actual GitHub stars)
3. githubGrowth: 15% (real month-over-month growth)
4. marketTiming: 10% (based on industry trends)
5. founderExperience: 10% (from founder profiles)
6. fundingMomentum: 10% (from funding data)
7. technologyStack: 10% (from GitHub languages)
8. communityEngagement: 10% (GitHub contributors, issues)
```

### 5.2 Score Update Process
1. **Recalculate scores daily**
   ```sql
   -- Run scoring algorithm for all companies
   UPDATE companies 
   SET spearfish_score = calculate_spearfish_score(company_id),
       score_updated_at = NOW()
   WHERE updated_at > NOW() - INTERVAL '24 hours';
   ```

2. **Track score history**
   - Already implemented in company_score_history table
   - Enables trend analysis

## Step 6: Implementation Timeline

### Phase 1: Manual Testing (Week 1)
- [ ] Manually add 10-20 YC companies
- [ ] Find and associate their GitHub repositories
- [ ] Verify scoring algorithm works correctly
- [ ] Test UI with real data

### Phase 2: Semi-Automated (Week 2-3)
- [ ] Build YC company import script
- [ ] Implement GitHub discovery algorithm
- [ ] Create admin interface for verification
- [ ] Set up basic cron jobs

### Phase 3: Fully Automated (Week 4+)
- [ ] Implement all data sources
- [ ] Set up monitoring and alerts
- [ ] Create data quality checks
- [ ] Build analytics dashboard

## Step 7: Data Quality & Compliance

### 7.1 Data Validation
- Verify company names match official records
- Validate GitHub repository ownership
- Cross-reference multiple data sources
- Flag suspicious or incorrect data

### 7.2 Legal Considerations
- Respect robots.txt for web scraping
- Use official APIs where available
- Include data source attribution
- Allow companies to claim/update their profiles
- Implement GDPR/CCPA compliance for personal data

## Step 8: Monitoring & Maintenance

### 8.1 Health Checks
```javascript
// Daily monitoring tasks:
- Check API rate limits
- Verify data sync completion
- Monitor error rates
- Track data freshness
```

### 8.2 Quality Metrics
- Track percentage of companies with GitHub data
- Monitor average confidence scores
- Check for stale data (> 7 days old)
- Measure scoring accuracy

## Quick Start Commands

```bash
# 1. Test with a single company
node scripts/import-single-company.js --name "Stripe" --batch "S09"

# 2. Import batch of companies
node scripts/import-yc-batch.js --batch "W24"

# 3. Discover GitHub repositories
node scripts/discover-github-repos.js --company-id "xxx"

# 4. Run full sync
npm run sync:all

# 5. Recalculate all scores
npm run scores:recalculate
```

## Environment Variables Needed

```env
# APIs for data collection
GITHUB_TOKEN=xxx                    # Already set
YC_API_KEY=xxx                      # If available
CRUNCHBASE_API_KEY=xxx             # For founder/funding data
CLEARBIT_API_KEY=xxx               # For company enrichment
LINKEDIN_API_KEY=xxx               # For founder profiles

# Feature flags
ENABLE_AUTO_GITHUB_DISCOVERY=true
ENABLE_SCORE_RECALCULATION=true
ENABLE_COMPANY_SYNC=true
```

## Next Steps

1. **Immediate**: Start with manual entry of 10 well-known YC companies
2. **This Week**: Build basic import scripts
3. **Next Week**: Implement GitHub auto-discovery
4. **Month 1**: Full automation with quality checks
5. **Ongoing**: Maintain data freshness and accuracy

---

*Note: This guide will evolve as we implement each phase. Update this document with lessons learned and new data sources discovered.*