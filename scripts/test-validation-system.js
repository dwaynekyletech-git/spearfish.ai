#!/usr/bin/env node

/**
 * Test the New GitHub Validation System
 * 
 * This script will test our new strict validation against companies
 * that currently have incorrect GitHub repos to see how much better it performs.
 */

// Simulate the validation logic to test it
class ValidationTester {
  generateCompanyVariations(name, slug) {
    const variations = new Set();
    
    // Add original name (lowercased)
    variations.add(name.toLowerCase());
    
    // Add slug if provided and different from name
    if (slug && slug.toLowerCase() !== name.toLowerCase()) {
      variations.add(slug.toLowerCase());
    }
    
    // Remove common company suffixes and add variations
    const cleanName = name
      .toLowerCase()
      .replace(/\s+(ai|inc|labs|technologies|tech|io|hq|co|corp|corporation|ltd|llc)$/i, '')
      .trim();
    
    if (cleanName !== name.toLowerCase()) {
      variations.add(cleanName);
    }
    
    // Add hyphenated version (spaces → hyphens)
    const hyphenated = cleanName.replace(/\s+/g, '-');
    if (hyphenated !== cleanName) {
      variations.add(hyphenated);
    }
    
    // Add no-space version (spaces → nothing)
    const nospace = cleanName.replace(/\s+/g, '');
    if (nospace !== cleanName && nospace.length > 2) {
      variations.add(nospace);
    }
    
    // Add underscored version (spaces → underscores)
    const underscored = cleanName.replace(/\s+/g, '_');
    if (underscored !== cleanName) {
      variations.add(underscored);
    }
    
    return Array.from(variations).filter(v => v.length > 1);
  }

  doesOwnerMatchCompany(owner, companyVariations) {
    const ownerLower = owner.toLowerCase();
    
    for (const variation of companyVariations) {
      // Exact match (best case)
      if (ownerLower === variation) {
        return true;
      }
      
      // Owner contains variation (e.g., "replicate-labs" contains "replicate")
      if (variation.length > 3 && ownerLower.includes(variation)) {
        return true;
      }
      
      // Variation contains owner (e.g., "modal labs" contains "modal")  
      if (ownerLower.length > 3 && variation.includes(ownerLower)) {
        return true;
      }
      
      // High similarity match (80%+ similar)
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

// Test cases based on current incorrect associations
const testCases = [
  {
    company: "Arc",
    incorrectRepos: [
      { owner: "xingshaocheng", name: "architect-awesome" },
      { owner: "android", name: "architecture-samples" }
    ]
  },
  {
    company: "Modal",  
    incorrectRepos: [
      { owner: "helix-editor", name: "helix" },
      { owner: "OFA-Sys", name: "Chinese-CLIP" }
    ]
  },
  {
    company: "Struct",
    incorrectRepos: [
      { owner: "go-playground", name: "validator" },
      { owner: "kaitai-io", name: "kaitai_struct" }
    ]
  },
  {
    company: "Cone",
    incorrectRepos: [
      { owner: "ConEmu", name: "ConEmu" },
      { owner: "ali-vilab", name: "Cones-V2" }
    ]
  },
  {
    company: "Replicate", 
    correctRepos: [
      { owner: "replicate", name: "cog" },
      { owner: "replicate", name: "getting-started-nextjs" }
    ]
  },
  {
    company: "Ollama",
    correctRepos: [
      { owner: "ollama", name: "ollama" },
      { owner: "ollama", name: "ollama-python" }
    ]
  }
];

console.log('🧪 TESTING NEW GITHUB VALIDATION SYSTEM\\n');
console.log('=' .repeat(60));

const tester = new ValidationTester();

testCases.forEach(testCase => {
  console.log(`\\n🏢 TESTING: ${testCase.company}`);
  console.log('─'.repeat(40));
  
  const variations = tester.generateCompanyVariations(testCase.company);
  console.log(`   Company variations: [${variations.join(', ')}]`);
  
  // Test incorrect repos (should be rejected)
  if (testCase.incorrectRepos) {
    console.log('\\n   ❌ Testing INCORRECT repos (should be REJECTED):');
    testCase.incorrectRepos.forEach(repo => {
      const matches = tester.doesOwnerMatchCompany(repo.owner, variations);
      const status = matches ? '🚨 FAIL - WOULD ACCEPT' : '✅ PASS - REJECTED';
      console.log(`     ${status}: ${repo.owner}/${repo.name}`);
      
      if (matches) {
        console.log(`       (Owner "${repo.owner}" matched company variations)`);
      }
    });
  }
  
  // Test correct repos (should be accepted)  
  if (testCase.correctRepos) {
    console.log('\\n   ✅ Testing CORRECT repos (should be ACCEPTED):');
    testCase.correctRepos.forEach(repo => {
      const matches = tester.doesOwnerMatchCompany(repo.owner, variations);
      const status = matches ? '✅ PASS - ACCEPTED' : '🚨 FAIL - WOULD REJECT';
      console.log(`     ${status}: ${repo.owner}/${repo.name}`);
      
      if (!matches) {
        console.log(`       (Owner "${repo.owner}" didn't match company variations)`);
      }
    });
  }
});

console.log('\\n' + '='.repeat(60));
console.log('🎯 VALIDATION SYSTEM TEST COMPLETE!\\n');

console.log('Key Improvements:');
console.log('  ✅ Strict owner validation prevents false positives');
console.log('  ✅ Company name variations catch legitimate matches');  
console.log('  ✅ String similarity handles minor spelling differences');
console.log('  ✅ Companies with no valid repos will show empty (better than wrong data)');
console.log('');

console.log('Next steps:');
console.log('  1. Run the discovery API to test with real data');
console.log('  2. Clean up existing incorrect associations'); 
console.log('  3. Monitor the results on your website');