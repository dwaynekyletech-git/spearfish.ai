/**
 * Add Sample Company Logos
 * 
 * This script adds sample logos to some of your existing companies for testing
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Sample logos for well-known companies
const sampleLogos = {
  'GrowthBook': 'https://www.growthbook.io/images/logo.png',
  'Mederva Health': 'https://avatars.githubusercontent.com/u/medervahealth?s=200&v=4',
  'AstroForge': 'https://media.licdn.com/dms/image/C4E0BAQGxqhq0qzrGrQ/company-logo_200_200/0/1656362076887?e=2147483647&v=beta&t=M8rZrZhCJGT4qGdkOBQCaQhFKZTWcvIo3uEGlPKPaWg',
  'Redbird': 'https://www.redbird.co/images/logo.png',
  'Alfie': 'https://media.licdn.com/dms/image/C4E0BAQHsVlKGWEjuIQ/company-logo_200_200/0/1547745826374?e=2147483647&v=beta&t=1',
  'TigerEye': 'https://media.licdn.com/dms/image/C4E0BAQGSXlLnXLkBzg/company-logo_200_200/0/1519885706761?e=2147483647&v=beta&t=1',
  'Elevate': 'https://media.licdn.com/dms/image/C4E0BAQEcH_dKgXLcOg/company-logo_200_200/0/1519857892234?e=2147483647&v=beta&t=1',
  'Keylika': 'https://media.licdn.com/dms/image/C4E0BAQHuEL8yKJwpzg/company-logo_200_200/0/1566853205829?e=2147483647&v=beta&t=1',
  'Compra Rápida': 'https://media.licdn.com/dms/image/C4E0BAQEYKCwAWMJqjg/company-logo_200_200/0/1519886652547?e=2147483647&v=beta&t=1',
  'SilkChart': 'https://media.licdn.com/dms/image/C4E0BAQGgAHjmEJ8dEQ/company-logo_200_200/0/1519870158247?e=2147483647&v=beta&t=1',
};

async function addSampleLogos() {
  console.log('🎨 Adding sample logos to companies...\n');
  
  // Get all companies
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, small_logo_thumb_url')
    .order('name');
  
  if (error) {
    console.error('❌ Error fetching companies:', error);
    return;
  }
  
  console.log(`📊 Found ${companies.length} companies in database\n`);
  
  let updatedCount = 0;
  
  for (const company of companies) {
    // Check if company has a logo in our sample data
    const logoUrl = sampleLogos[company.name];
    
    if (logoUrl && !company.small_logo_thumb_url) {
      console.log(`🖼️  Adding logo for ${company.name}...`);
      
      const { error: updateError } = await supabase
        .from('companies')
        .update({ small_logo_thumb_url: logoUrl })
        .eq('id', company.id);
      
      if (updateError) {
        console.error(`  ❌ Error updating ${company.name}:`, updateError.message);
      } else {
        console.log(`  ✅ Updated ${company.name} with logo`);
        updatedCount++;
      }
    } else if (company.small_logo_thumb_url) {
      console.log(`⏭️  ${company.name} already has a logo`);
    } else {
      console.log(`⚪ ${company.name} - no sample logo available`);
    }
  }
  
  console.log(`\n✅ Updated ${updatedCount} companies with logos!`);
  console.log('\nNext steps:');
  console.log('1. Refresh your app to see the logos');
  console.log('2. Add more logos by updating the sampleLogos object');
  console.log('3. Consider integrating with YC API to get real logos');
}

// Run the script
if (require.main === module) {
  addSampleLogos().catch(console.error);
}

module.exports = { addSampleLogos };