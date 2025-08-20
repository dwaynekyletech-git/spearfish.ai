# Founder Scraping Setup Guide

This guide explains how to set up automated founder data collection for your Spearfish AI platform.

## Overview

The founder scraping system automatically collects founder information from Y Combinator company pages and stores it in your database. It includes:

- **Intelligent scraping** with improved selectors for YC's current page structure
- **Retry logic** with exponential backoff for failed requests
- **Data quality indicators** in the UI
- **Manual trigger options** via the Team tab
- **Automated background jobs** via cron scheduling

## Setup Instructions

### 1. Environment Variables

Add the following to your `.env.local` file:

```bash
# Optional: Secure your cron endpoint
CRON_SECRET=your_secure_random_string_here
```

### 2. Database Migration

Run the scraping attempts migration:

```bash
# Apply the migration to create the scraping_attempts table
supabase db push
```

### 3. Manual Testing

Test the scraping functionality via the UI:

1. Go to any company profile page
2. Click on the "Team" tab
3. Click "Fetch Team Data" button
4. Observe the data quality indicators

Or test via API:

```bash
# Test individual company scraping
curl -X POST http://localhost:3000/api/companies/[company-id]/team \
  -H "Content-Type: application/json" \
  -d '{"action": "scrape"}'

# Test batch scraping (processes multiple companies)
curl -X POST http://localhost:3000/api/batch-scrape-founders \
  -H "Content-Type: application/json" \
  -d '{"limit": 5, "skip_existing": true}'
```

### 4. Automated Background Scraping

Set up a cron job to automatically scrape founder data:

#### Option A: Vercel Cron Jobs

Add to your `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/scrape-founders",
      "schedule": "0 2 * * *"
    }
  ]
}
```

#### Option B: External Cron Service

Set up a service like cron-job.org to call:

```
GET https://yourdomain.com/api/cron/scrape-founders
Authorization: Bearer your_cron_secret_here
```

#### Option C: GitHub Actions

Create `.github/workflows/scrape-founders.yml`:

```yaml
name: Scrape Founders Data
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:  # Allow manual triggering

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger founder scraping
        run: |
          curl -X GET "${{ secrets.APP_URL }}/api/cron/scrape-founders" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

## Configuration

### Batch Processing Settings

You can adjust these constants in `/api/cron/scrape-founders/route.ts`:

```typescript
const BATCH_SIZE = 5; // Companies per run
const MAX_RUNTIME_MS = 4 * 60 * 1000; // 4 minutes max
const COOLDOWN_HOURS = 24; // Wait before retrying failed companies
```

### Scraping Behavior

The system will:

1. **Skip existing data**: Companies with founder data are not re-scraped
2. **Implement cooldowns**: Failed companies wait 24 hours before retry
3. **Process in batches**: Maximum 5 companies per cron run
4. **Generate YC URLs**: Creates YC URLs for companies missing them
5. **Extract comprehensive data**: Names, titles, bios, LinkedIn, Twitter links

## Monitoring

### Success Metrics

Check scraping success via the API response:

```json
{
  "success": true,
  "stats": {
    "processed": 5,
    "successful": 4,
    "failed": 1,
    "total_founders_found": 8,
    "runtime_ms": 45000
  }
}
```

### Database Tracking

Monitor scraping attempts in the `scraping_attempts` table:

```sql
SELECT 
  company_id,
  success,
  founders_found,
  error_message,
  attempted_at
FROM scraping_attempts 
WHERE scrape_type = 'founders'
ORDER BY attempted_at DESC;
```

### UI Indicators

The Team tab shows real-time status:

- ✅ **Green**: Founders data available
- ⚠️ **Amber**: No founder data yet
- 🔄 **Blue**: Currently fetching data

## Troubleshooting

### Common Issues

1. **No founders found**: YC page structure may have changed
2. **Network timeouts**: YC may be rate limiting requests
3. **Database errors**: Check Supabase connection and RLS policies

### Debug Logs

Check application logs for detailed scraping information:

```
🔍 Scraping attempt 1/3 for Company Name
✅ Saved 2 founders for Company Name
⚠️ No founders found for Company Name after 3 attempts
```

### Manual Debugging

Test specific YC URLs manually:

```bash
curl https://www.ycombinator.com/companies/airbnb
```

## Security Considerations

1. **Rate limiting**: The system includes delays between requests
2. **Cron authentication**: Use CRON_SECRET to secure the endpoint
3. **RLS policies**: Database access is controlled by Supabase RLS
4. **Error handling**: Failed requests don't expose sensitive information

## Future Enhancements

Consider these improvements:

1. **Additional sources**: LinkedIn API, AngelList, company websites
2. **Image scraping**: Founder profile photos
3. **Role detection**: Automatic CEO/CTO/Founder classification
4. **Contact enrichment**: Email discovery and validation
5. **Update detection**: Notify when founder information changes

## Support

For issues or questions:

1. Check the application logs for detailed error messages
2. Verify YC URLs are accessible manually
3. Test individual company scraping before batch operations
4. Monitor the `scraping_attempts` table for patterns