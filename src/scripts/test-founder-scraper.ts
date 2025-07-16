import { createFounderScraperService } from '../lib/founder-scraper-service';

async function testFounderScraper() {
  const scraper = createFounderScraperService();
  
  // Test with TigerEye
  const testCompanies = [
    {
      id: 'test-tigereye',
      name: 'TigerEye',
      batch: 'W21',
      status: 'Active' as const,
      tags: ['b2b'],
      regions: ['usa'],
      is_hiring: false,
      github_repos: [],
      huggingface_models: [],
      website_url: 'https://tigereye.com',
      description: 'Sales forecasting platform',
      one_liner: 'Sales forecasting',
      team_size: 50,
      location: 'San Francisco',
      founded_year: 2020
    }
  ];
  
  console.log('🚀 Testing updated founder scraper with Active Founders parsing...\n');
  
  for (const company of testCompanies) {
    console.log(`\n📊 Testing ${company.name}`);
    console.log('━'.repeat(50));
    
    try {
      const result = await scraper.scrapeCompanyData(company);
      
      console.log(`✅ Company: ${company.name}`);
      console.log(`📍 Sources checked: ${result.sources.join(', ')}`);
      console.log(`👥 Founders found: ${result.founders.length}`);
      
      if (result.founders.length > 0) {
        console.log('\nFounder details:');
        result.founders.forEach((founder, index) => {
          console.log(`\n  ${index + 1}. ${founder.name}`);
          console.log(`     Title: ${founder.title}`);
          if (founder.linkedin_url) {
            console.log(`     LinkedIn: ${founder.linkedin_url}`);
          }
          if (founder.bio) {
            console.log(`     Bio: ${founder.bio.substring(0, 100)}...`);
          }
        });
      } else {
        console.log('❌ No founders found');
      }
      
    } catch (error) {
      console.error(`❌ Error testing ${company.name}:`, error);
    }
    
    console.log('\n' + '━'.repeat(50));
    
    // Add a small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✅ Testing complete!');
}

// Run the test
testFounderScraper().catch(console.error);