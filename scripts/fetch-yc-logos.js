/**
 * Fetch Real YC Company Logos
 * 
 * This script fetches real company logos from the YC API and updates your database
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchYCLogos() {
  console.log('🔍 Fetching YC company logos...\n');
  
  try {
    // Fetch companies from YC OSS API (all companies)
    const response = await fetch('https://yc-oss.github.io/api/companies/all.json');
    const ycCompanies = await response.json();
    
    console.log(`📊 Found ${ycCompanies.length} companies in YC API\n`);
    
    // Get our existing companies
    const { data: ourCompanies, error } = await supabase
      .from('companies')
      .select('id, name, small_logo_thumb_url')
      .order('name');
    
    if (error) {
      console.error('❌ Error fetching our companies:', error);
      return;
    }
    
    console.log(`📋 Found ${ourCompanies.length} companies in our database\n`);
    
    let updatedCount = 0;
    
    // Match companies by name and update logos
    for (const ourCompany of ourCompanies) {
      if (ourCompany.small_logo_thumb_url) {
        console.log(`⏭️  ${ourCompany.name} already has a logo`);
        continue;
      }
      
      // Try to find matching YC company
      const matchingYCCompany = ycCompanies.find(ycCompany => 
        ycCompany.name.toLowerCase().trim() === ourCompany.name.toLowerCase().trim()
      );
      
      if (matchingYCCompany && matchingYCCompany.small_logo_thumb_url) {
        console.log(`🎯 Found match for ${ourCompany.name}:`);
        console.log(`   YC Company: ${matchingYCCompany.name}`);
        console.log(`   Logo URL: ${matchingYCCompany.small_logo_thumb_url}`);
        
        // Update our company with the logo
        const { error: updateError } = await supabase
          .from('companies')
          .update({ 
            small_logo_thumb_url: matchingYCCompany.small_logo_thumb_url,
            yc_api_id: matchingYCCompany.id,
            batch: matchingYCCompany.batch || ourCompany.batch,
            one_liner: matchingYCCompany.one_liner || ourCompany.one_liner,
            website_url: matchingYCCompany.website_url || ourCompany.website_url,
            last_sync_date: new Date().toISOString()
          })
          .eq('id', ourCompany.id);
        
        if (updateError) {
          console.error(`  ❌ Error updating ${ourCompany.name}:`, updateError.message);
        } else {
          console.log(`  ✅ Updated ${ourCompany.name} with YC data`);
          updatedCount++;
        }
      } else {
        console.log(`⚪ ${ourCompany.name} - no YC match found`);
      }
      
      // Rate limiting - don't overwhelm the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n✅ Updated ${updatedCount} companies with YC logos!`);
    
    // Show some statistics
    const { data: companiesWithLogos } = await supabase
      .from('companies')
      .select('id')
      .not('small_logo_thumb_url', 'is', null);
    
    console.log(`📊 Total companies with logos: ${companiesWithLogos?.length || 0}`);
    console.log(`📊 Total companies without logos: ${(ourCompanies.length - (companiesWithLogos?.length || 0))}`);
    
  } catch (error) {
    console.error('❌ Error fetching YC data:', error);
  }
}

// Run the script
if (require.main === module) {
  fetchYCLogos().catch(console.error);
}

module.exports = { fetchYCLogos };