#!/usr/bin/env node

/**
 * Test the HuggingFace Validation System
 * 
 * This script tests our HuggingFace model validation logic against known AI companies
 * to ensure we avoid false positives and correctly identify company-owned models.
 */

// Simulate the validation logic to test it
class HFValidationTester {
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

  doesAuthorMatchCompany(author, companyVariations) {
    const authorLower = author.toLowerCase();
    
    for (const variation of companyVariations) {
      // Exact match (best case)
      if (authorLower === variation) {
        return true;
      }
      
      // Author contains variation (e.g., "meta-ai" contains "meta")
      if (variation.length > 3 && authorLower.includes(variation)) {
        return true;
      }
      
      // Variation contains author (e.g., "openai labs" contains "openai")  
      if (authorLower.length > 3 && variation.includes(authorLower)) {
        return true;
      }
      
      // High similarity match (80%+ similar)
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

// Test cases based on known HuggingFace organizations and potential false positives
const testCases = [
  {
    company: "OpenAI",
    correctModels: [
      { author: "openai", modelId: "openai/clip-vit-base-patch32" },
      { author: "openai", modelId: "openai/whisper-large-v2" }
    ],
    incorrectModels: [
      { author: "microsoft", modelId: "microsoft/DialoGPT-medium" },
      { author: "bigscience", modelId: "bigscience/bloom-560m" }
    ]
  },
  {
    company: "Meta",
    correctModels: [
      { author: "meta-llama", modelId: "meta-llama/Llama-2-7b-hf" },
      { author: "facebook", modelId: "facebook/bart-large" }
    ],
    incorrectModels: [
      { author: "openai", modelId: "openai/clip-vit-base-patch32" },
      { author: "google", modelId: "google/flan-t5-base" }
    ]
  },
  {
    company: "Google",
    correctModels: [
      { author: "google", modelId: "google/flan-t5-large" },
      { author: "google-bert", modelId: "google-bert/bert-base-uncased" }
    ],
    incorrectModels: [
      { author: "microsoft", modelId: "microsoft/DialoGPT-medium" },
      { author: "meta-llama", modelId: "meta-llama/Llama-2-7b-hf" }
    ]
  },
  {
    company: "Anthropic",
    correctModels: [
      { author: "anthropic", modelId: "anthropic/claude-3-haiku" }
    ],
    incorrectModels: [
      { author: "openai", modelId: "openai/whisper-large-v2" },
      { author: "huggingface", modelId: "huggingface/transformers" }
    ]
  },
  {
    company: "Mistral AI",
    correctModels: [
      { author: "mistralai", modelId: "mistralai/Mistral-7B-v0.1" },
      { author: "mistral-ai", modelId: "mistral-ai/mixtral-8x7b" }
    ],
    incorrectModels: [
      { author: "microsoft", modelId: "microsoft/DialoGPT-medium" },
      { author: "openai", modelId: "openai/clip-vit-base-patch32" }
    ]
  },
  {
    company: "Stability AI",
    correctModels: [
      { author: "stabilityai", modelId: "stabilityai/stable-diffusion-2-1" },
      { author: "stability-ai", modelId: "stability-ai/stable-diffusion-xl" }
    ],
    incorrectModels: [
      { author: "runwayml", modelId: "runwayml/stable-diffusion-v1-5" },
      { author: "openai", modelId: "openai/clip-vit-base-patch32" }
    ]
  }
];

console.log('🤗 TESTING HUGGINGFACE VALIDATION SYSTEM\n');
console.log('=' .repeat(60));

const tester = new HFValidationTester();
let totalTests = 0;
let passedTests = 0;

testCases.forEach(testCase => {
  console.log(`\n🏢 TESTING: ${testCase.company}`);
  console.log('─'.repeat(40));
  
  const variations = tester.generateCompanyVariations(testCase.company);
  console.log(`   Company variations: [${variations.join(', ')}]`);
  
  // Test correct models (should be accepted)
  if (testCase.correctModels) {
    console.log('\n   ✅ Testing CORRECT models (should be ACCEPTED):');
    testCase.correctModels.forEach(model => {
      totalTests++;
      const matches = tester.doesAuthorMatchCompany(model.author, variations);
      const status = matches ? '✅ PASS - ACCEPTED' : '🚨 FAIL - WOULD REJECT';
      console.log(`     ${status}: ${model.modelId}`);
      
      if (matches) {
        passedTests++;
      } else {
        console.log(`       (Author "${model.author}" didn't match company variations)`);
      }
    });
  }
  
  // Test incorrect models (should be rejected)
  if (testCase.incorrectModels) {
    console.log('\n   ❌ Testing INCORRECT models (should be REJECTED):');
    testCase.incorrectModels.forEach(model => {
      totalTests++;
      const matches = tester.doesAuthorMatchCompany(model.author, variations);
      const status = matches ? '🚨 FAIL - WOULD ACCEPT' : '✅ PASS - REJECTED';
      console.log(`     ${status}: ${model.modelId}`);
      
      if (!matches) {
        passedTests++;
      } else {
        console.log(`       (Author "${model.author}" incorrectly matched company variations)`);
      }
    });
  }
});

console.log('\n' + '='.repeat(60));
console.log('🎯 VALIDATION SYSTEM TEST RESULTS!\n');

const successRate = Math.round((passedTests / totalTests) * 100);
console.log(`📊 Test Results:`);
console.log(`   • Total tests: ${totalTests}`);
console.log(`   • Passed: ${passedTests}`);
console.log(`   • Failed: ${totalTests - passedTests}`);
console.log(`   • Success rate: ${successRate}%`);

if (successRate >= 90) {
  console.log('\n🎉 EXCELLENT! Validation system is working well');
} else if (successRate >= 80) {
  console.log('\n⚠️  GOOD but needs improvement. Review failed cases');
} else {
  console.log('\n🚨 POOR performance. Major validation issues detected');
}

console.log('\nKey Features Tested:');
console.log('  ✅ Exact author name matching');
console.log('  ✅ Company name variations (hyphenated, no-space, etc.)');  
console.log('  ✅ Substring matching for organization names');
console.log('  ✅ String similarity for minor variations');
console.log('  ✅ False positive prevention');

console.log('\nNext steps:');
console.log('  1. Add a HuggingFace token to your .env.local file');
console.log('  2. Run the discovery API to test with real data');
console.log('  3. Monitor results and adjust validation if needed');
console.log('  4. Create cleanup scripts for any false positives found');

console.log('');