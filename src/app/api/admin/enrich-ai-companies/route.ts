/**
 * Admin AI Company Enrichment API Route
 * 
 * DEPRECATED: This endpoint used Apify integration which has been removed.
 * Company data is now imported via manual JSON files using the import-yc-json endpoint.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: false,
    error: 'This endpoint has been deprecated',
    message: 'Apify enrichment has been removed. Use /api/admin/import-yc-json to import company data from JSON files.',
    migration_info: {
      old_approach: 'Automated Apify scraping',
      new_approach: 'Manual JSON file import',
      import_endpoint: '/api/admin/import-yc-json',
      cli_command: 'npm run import:yc -- --file your-file.json'
    }
  }, { status: 410 }); // 410 Gone
}

export async function POST() {
  return NextResponse.json({
    success: false,
    error: 'This endpoint has been deprecated',
    message: 'Apify enrichment has been removed. Use /api/admin/import-yc-json to import company data from JSON files.',
    migration_info: {
      old_approach: 'Automated Apify scraping',
      new_approach: 'Manual JSON file import',
      import_endpoint: '/api/admin/import-yc-json',
      cli_command: 'npm run import:yc -- --file your-file.json'
    }
  }, { status: 410 }); // 410 Gone
}