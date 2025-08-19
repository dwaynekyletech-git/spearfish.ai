#!/usr/bin/env node

/**
 * Clean Up Bad GitHub Associations
 * 
 * This script removes GitHub repository associations that don't pass
 * our new strict validation rules, giving us a clean slate for the
 * improved discovery system.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Import validation logic (same as in the service)
class GitHubValidator {
  generateCompanyVariations(name, slug) {
    const variations = new Set();
    
    variations.add(name.toLowerCase());
    
    if (slug && slug.toLowerCase() !== name.toLowerCase()) {
      variations.add(slug.toLowerCase());
    }
    
    const cleanName = name
      .toLowerCase()
      .replace(/\\s+(ai|inc|labs|technologies|tech|io|hq|co|corp|corporation|ltd|llc)$/i, '')
      .trim();
    
    if (cleanName !== name.toLowerCase()) {
      variations.add(cleanName);
    }
    
    const hyphenated = cleanName.replace(/\\s+/g, '-');
    if (hyphenated !== cleanName) {
      variations.add(hyphenated);
    }
    
    const nospace = cleanName.replace(/\\s+/g, '');
    if (nospace !== cleanName && nospace.length > 2) {
      variations.add(nospace);
    }
    
    const underscored = cleanName.replace(/\\s+/g, '_');
    if (underscored !== cleanName) {
      variations.add(underscored);
    }
    
    return Array.from(variations).filter(v => v.length > 1);
  }

  doesOwnerMatchCompany(owner, companyVariations) {
    const ownerLower = owner.toLowerCase();
    
    for (const variation of companyVariations) {
      if (ownerLower === variation) {
        return true;
      }
      
      if (variation.length > 3 && ownerLower.includes(variation)) {
        return true;
      }
      
      if (ownerLower.length > 3 && variation.includes(ownerLower)) {
        return true;
      }
      
      if (this.calculateSimilarity(ownerLower, variation) > 0.8) {
        return true;
      }
    }
    
    return false;
  }

  calculateSimilarity(str1, str2) {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1;
    
    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLen);
  }

  levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

async function cleanupBadAssociations() {
  console.log('🧹 CLEANING UP BAD GITHUB ASSOCIATIONS\\n');
  console.log('=' .repeat(60));

  const validator = new GitHubValidator();
  let totalProcessed = 0;
  let totalRemoved = 0;
  let companiesUpdated = 0;

  try {
    // Get all current associations with company and repo data
    console.log('\\n📊 Fetching current GitHub associations...');
    
    const { data: associations, error } = await supabase
      .from('company_github_repositories')
      .select(`
        id,
        company_id,
        repository_id,
        companies!inner(id, name, slug),
        github_repositories!inner(id, full_name, name, owner)
      `);

    if (error) {
      throw new Error(`Failed to fetch associations: ${error.message}`);
    }

    if (!associations || associations.length === 0) {
      console.log('✅ No associations found to process');
      return;
    }

    console.log(`Found ${associations.length} associations to validate\\n`);

    // Group by company for better logging
    const companiesMap = new Map();
    associations.forEach(assoc => {
      const companyId = assoc.company_id;
      if (!companiesMap.has(companyId)) {
        companiesMap.set(companyId, {
          company: assoc.companies,
          associations: []
        });
      }
      companiesMap.get(companyId).associations.push(assoc);
    });

    console.log(`Processing ${companiesMap.size} companies:\\n`);

    // Validate each company's associations
    for (const [companyId, { company, associations: companyAssocs }] of companiesMap) {
      console.log(`🏢 Validating: ${company.name}`);
      
      const variations = validator.generateCompanyVariations(company.name, company.slug);
      console.log(`   Company variations: [${variations.join(', ')}]`);
      
      const toRemove = [];
      const toKeep = [];
      
      for (const assoc of companyAssocs) {
        totalProcessed++;
        
        const repo = assoc.github_repositories;
        const ownerMatches = validator.doesOwnerMatchCompany(repo.owner, variations);
        
        if (ownerMatches) {
          toKeep.push(assoc);
          console.log(`     ✅ KEEP: ${repo.full_name} (owner: ${repo.owner})`);
        } else {
          toRemove.push(assoc);
          console.log(`     ❌ REMOVE: ${repo.full_name} (owner: ${repo.owner})`);
        }
      }
      
      // Remove bad associations
      if (toRemove.length > 0) {
        console.log(`\\n   🗑️  Removing ${toRemove.length} invalid associations...`);
        
        const idsToRemove = toRemove.map(a => a.id);
        const { error: removeError } = await supabase
          .from('company_github_repositories')
          .delete()
          .in('id', idsToRemove);
          
        if (removeError) {
          console.log(`     ❌ Error removing associations: ${removeError.message}`);
        } else {
          totalRemoved += toRemove.length;
          companiesUpdated++;
          console.log(`     ✅ Removed ${toRemove.length} invalid associations`);
        }
        
        // Update the company's github_repos field
        console.log(`   🔄 Updating company's github_repos field...`);
        
        const validRepos = toKeep.map(assoc => ({
          full_name: assoc.github_repositories.full_name,
          html_url: `https://github.com/${assoc.github_repositories.full_name}`,
          description: assoc.github_repositories.description || null,
          stars_count: assoc.github_repositories.stars_count || 0,
          forks_count: assoc.github_repositories.forks_count || 0,
          language: assoc.github_repositories.language || null,
          is_primary: false,
          last_synced: new Date().toISOString()
        }));
        
        // Set first repo as primary if any exist
        if (validRepos.length > 0) {
          validRepos[0].is_primary = true;
        }
        
        const { error: updateError } = await supabase
          .from('companies')
          .update({
            github_repos: validRepos,
            updated_at: new Date().toISOString()
          })
          .eq('id', companyId);
          
        if (updateError) {
          console.log(`     ❌ Error updating company: ${updateError.message}`);
        } else {
          console.log(`     ✅ Updated company with ${validRepos.length} valid repos`);
        }
      } else {
        console.log(`     ✅ All associations are valid - no changes needed`);
      }
      
      console.log('');
    }

    console.log('\\n' + '='.repeat(60));
    console.log('🎉 CLEANUP COMPLETE!\\n');
    console.log(`📊 Summary:`);
    console.log(`   • Total associations processed: ${totalProcessed}`);
    console.log(`   • Bad associations removed: ${totalRemoved}`);
    console.log(`   • Companies updated: ${companiesUpdated}`);
    console.log(`   • Accuracy improvement: ${Math.round(((totalProcessed - totalRemoved) / totalProcessed) * 100)}%`);
    console.log('');
    
    console.log('✨ Your GitHub data is now much more accurate!');
    console.log('   Visit your website to see the cleaned-up repository data.');

  } catch (error) {
    console.error('❌ CLEANUP FAILED:', error);
    process.exit(1);
  }
}

// Run cleanup
cleanupBadAssociations().then(() => {
  console.log('\\n✅ Cleanup script completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});