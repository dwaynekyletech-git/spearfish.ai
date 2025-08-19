#!/usr/bin/env node

/**
 * Clean Up Bad HuggingFace Associations
 * 
 * This script removes HuggingFace model associations that don't pass
 * our strict validation rules, giving us a clean slate for the
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
class HFValidator {
  generateCompanyVariations(name, slug) {
    const variations = new Set();
    
    variations.add(name.toLowerCase());
    
    if (slug && slug.toLowerCase() !== name.toLowerCase()) {
      variations.add(slug.toLowerCase());
    }
    
    const cleanName = name
      .toLowerCase()
      .replace(/\s+(ai|inc|labs|technologies|tech|io|hq|co|corp|corporation|ltd|llc)$/i, '')
      .trim();
    
    if (cleanName !== name.toLowerCase()) {
      variations.add(cleanName);
    }
    
    const hyphenated = cleanName.replace(/\s+/g, '-');
    if (hyphenated !== cleanName) {
      variations.add(hyphenated);
    }
    
    const nospace = cleanName.replace(/\s+/g, '');
    if (nospace !== cleanName && nospace.length > 2) {
      variations.add(nospace);
    }
    
    const underscored = cleanName.replace(/\s+/g, '_');
    if (underscored !== cleanName) {
      variations.add(underscored);
    }
    
    return Array.from(variations).filter(v => v.length > 1);
  }

  doesAuthorMatchCompany(author, companyVariations) {
    const authorLower = author.toLowerCase();
    
    for (const variation of companyVariations) {
      if (authorLower === variation) {
        return true;
      }
      
      if (variation.length > 3 && authorLower.includes(variation)) {
        return true;
      }
      
      if (authorLower.length > 3 && variation.includes(authorLower)) {
        return true;
      }
      
      if (this.calculateSimilarity(authorLower, variation) > 0.8) {
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

async function cleanupBadHFAssociations() {
  console.log('🧹 CLEANING UP BAD HUGGINGFACE ASSOCIATIONS\n');
  console.log('=' .repeat(60));

  const validator = new HFValidator();
  let totalProcessed = 0;
  let totalRemoved = 0;
  let companiesUpdated = 0;

  try {
    // Get all current associations with company and model data
    console.log('\n📊 Fetching current HuggingFace associations...');
    
    const { data: associations, error } = await supabase
      .from('company_huggingface_models')
      .select(`
        id,
        company_id,
        model_id,
        companies!inner(id, name, slug),
        huggingface_models!inner(id, model_id, author, model_name)
      `);

    if (error) {
      throw new Error(`Failed to fetch HF associations: ${error.message}`);
    }

    if (!associations || associations.length === 0) {
      console.log('✅ No HuggingFace associations found to process');
      return;
    }

    console.log(`Found ${associations.length} associations to validate\n`);

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

    console.log(`Processing ${companiesMap.size} companies:\n`);

    // Validate each company's associations
    for (const [companyId, { company, associations: companyAssocs }] of companiesMap) {
      console.log(`🏢 Validating: ${company.name}`);
      
      const variations = validator.generateCompanyVariations(company.name, company.slug);
      console.log(`   Company variations: [${variations.join(', ')}]`);
      
      const toRemove = [];
      const toKeep = [];
      
      for (const assoc of companyAssocs) {
        totalProcessed++;
        
        const model = assoc.huggingface_models;
        const authorMatches = validator.doesAuthorMatchCompany(model.author, variations);
        
        if (authorMatches) {
          toKeep.push(assoc);
          console.log(`     ✅ KEEP: ${model.model_id} (author: ${model.author})`);
        } else {
          toRemove.push(assoc);
          console.log(`     ❌ REMOVE: ${model.model_id} (author: ${model.author})`);
        }
      }
      
      // Remove bad associations
      if (toRemove.length > 0) {
        console.log(`\n   🗑️  Removing ${toRemove.length} invalid associations...`);
        
        const idsToRemove = toRemove.map(a => a.id);
        const { error: removeError } = await supabase
          .from('company_huggingface_models')
          .delete()
          .in('id', idsToRemove);
          
        if (removeError) {
          console.log(`     ❌ Error removing associations: ${removeError.message}`);
        } else {
          totalRemoved += toRemove.length;
          companiesUpdated++;
          console.log(`     ✅ Removed ${toRemove.length} invalid associations`);
        }
        
        // Update the company's huggingface_models field
        console.log(`   🔄 Updating company's huggingface_models field...`);
        
        const validModels = toKeep.map(assoc => ({
          model_id: assoc.huggingface_models.model_id,
          model_name: assoc.huggingface_models.model_name,
          author: assoc.huggingface_models.author,
          task: assoc.huggingface_models.task || null,
          downloads: assoc.huggingface_models.downloads || 0,
          likes: assoc.huggingface_models.likes || 0,
          model_card_url: `https://huggingface.co/${assoc.huggingface_models.model_id}`,
          is_primary: false,
          last_synced: new Date().toISOString()
        }));
        
        // Set first model as primary if any exist
        if (validModels.length > 0) {
          validModels[0].is_primary = true;
        }
        
        const { error: updateError } = await supabase
          .from('companies')
          .update({
            huggingface_models: validModels,
            updated_at: new Date().toISOString()
          })
          .eq('id', companyId);
          
        if (updateError) {
          console.log(`     ❌ Error updating company: ${updateError.message}`);
        } else {
          console.log(`     ✅ Updated company with ${validModels.length} valid models`);
        }
      } else {
        console.log(`     ✅ All associations are valid - no changes needed`);
      }
      
      console.log('');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 CLEANUP COMPLETE!\n');
    console.log(`📊 Summary:`);
    console.log(`   • Total associations processed: ${totalProcessed}`);
    console.log(`   • Bad associations removed: ${totalRemoved}`);
    console.log(`   • Companies updated: ${companiesUpdated}`);
    if (totalProcessed > 0) {
      console.log(`   • Accuracy improvement: ${Math.round(((totalProcessed - totalRemoved) / totalProcessed) * 100)}%`);
    }
    console.log('');
    
    console.log('✨ Your HuggingFace data is now much more accurate!');
    console.log('   Visit your website to see the cleaned-up model data.');

  } catch (error) {
    console.error('❌ CLEANUP FAILED:', error);
    process.exit(1);
  }
}

// Run cleanup
cleanupBadHFAssociations().then(() => {
  console.log('\n✅ Cleanup script completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});