#!/usr/bin/env ts-node

/**
 * Test Script for Industry Extraction Service
 * 
 * Tests the industry extraction logic with various sample company data
 * to ensure it's working correctly before deployment.
 */

const { extractIndustry, extractMultipleIndustries } = require('../src/lib/industry-extraction-service');

interface TestCase {
  name: string;
  tags: string[];
  description?: string;
  expectedIndustry: string;
  expectedMinConfidence: number;
}

const testCases: TestCase[] = [
  // AI Companies
  {
    name: "OpenAI",
    tags: ["AI", "Artificial Intelligence", "LLM", "GPT"],
    description: "AI research company developing large language models",
    expectedIndustry: "Artificial Intelligence",
    expectedMinConfidence: 0.8
  },
  {
    name: "Anthropic",
    tags: ["AI Safety", "LLM", "Research"],
    description: "AI safety company focused on developing safe, beneficial AI systems",
    expectedIndustry: "Artificial Intelligence",
    expectedMinConfidence: 0.7
  },

  // Fintech Companies
  {
    name: "Stripe",
    tags: ["Payments", "Fintech", "B2B", "API"],
    description: "Online payment processing platform for businesses",
    expectedIndustry: "Financial Technology",
    expectedMinConfidence: 0.7
  },
  {
    name: "Coinbase",
    tags: ["Cryptocurrency", "Crypto", "Trading", "Blockchain"],
    description: "Cryptocurrency exchange and wallet platform",
    expectedIndustry: "Financial Technology",
    expectedMinConfidence: 0.7
  },

  // Enterprise Software
  {
    name: "Slack",
    tags: ["B2B", "SaaS", "Enterprise", "Communication"],
    description: "Business communication platform for teams",
    expectedIndustry: "Enterprise Software",
    expectedMinConfidence: 0.7
  },
  {
    name: "Zoom",
    tags: ["SaaS", "Video Conferencing", "Enterprise", "Communication"],
    description: "Video conferencing and communication platform",
    expectedIndustry: "Enterprise Software",
    expectedMinConfidence: 0.7
  },

  // Healthcare Technology
  {
    name: "Teladoc",
    tags: ["Healthtech", "Telemedicine", "Digital Health"],
    description: "Telemedicine and virtual healthcare platform",
    expectedIndustry: "Healthcare Technology",
    expectedMinConfidence: 0.7
  },

  // E-commerce
  {
    name: "Shopify",
    tags: ["E-commerce", "B2C", "Retail", "Online Store"],
    description: "E-commerce platform for online stores",
    expectedIndustry: "E-commerce",
    expectedMinConfidence: 0.7
  },

  // Developer Tools
  {
    name: "GitHub",
    tags: ["Developer Tools", "API", "DevOps", "Code Repository"],
    description: "Code repository and collaboration platform for developers",
    expectedIndustry: "Developer Tools",
    expectedMinConfidence: 0.7
  },

  // Edge Cases
  {
    name: "Generic Tech Company",
    tags: ["Technology", "Software", "Platform"],
    description: "A technology company building software platforms",
    expectedIndustry: "Technology",
    expectedMinConfidence: 0.3
  },
  {
    name: "Ambiguous Company",
    tags: ["Innovation", "Solutions", "Digital"],
    description: "We provide innovative digital solutions",
    expectedIndustry: "Technology",
    expectedMinConfidence: 0.3
  }
];

function runTests() {
  console.log("🧪 Testing Industry Extraction Service\n");
  console.log("=".repeat(60));
  
  let passed = 0;
  let total = testCases.length;

  testCases.forEach((testCase, index) => {
    console.log(`\n📋 Test ${index + 1}: ${testCase.name}`);
    console.log(`Tags: [${testCase.tags.join(', ')}]`);
    console.log(`Description: ${testCase.description || 'N/A'}`);
    
    const result = extractIndustry(
      testCase.tags,
      testCase.description,
      testCase.name
    );
    
    console.log(`\n🔍 Results:`);
    console.log(`  Primary Industry: ${result.primaryIndustry}`);
    console.log(`  Sub-Industries: [${result.subIndustries.join(', ')}]`);
    console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`  Method: ${result.extractionMethod}`);
    console.log(`  Matched Tags: [${result.matchedTags.join(', ')}]`);

    // Validate results
    const industryMatch = result.primaryIndustry === testCase.expectedIndustry;
    const confidenceMatch = result.confidence >= testCase.expectedMinConfidence;
    
    if (industryMatch && confidenceMatch) {
      console.log(`✅ PASS`);
      passed++;
    } else {
      console.log(`❌ FAIL`);
      if (!industryMatch) {
        console.log(`   Expected industry: ${testCase.expectedIndustry}, got: ${result.primaryIndustry}`);
      }
      if (!confidenceMatch) {
        console.log(`   Expected confidence >= ${testCase.expectedMinConfidence}, got: ${result.confidence}`);
      }
    }

    // Test multiple industries extraction
    const multipleIndustries = extractMultipleIndustries(
      testCase.tags,
      testCase.description,
      testCase.name
    );
    console.log(`  All Industries: [${multipleIndustries.join(', ')}]`);
  });

  console.log("\n" + "=".repeat(60));
  console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log("🎉 All tests passed! Industry extraction is working correctly.");
    process.exit(0);
  } else {
    console.log(`⚠️  ${total - passed} tests failed. Review the extraction logic.`);
    process.exit(1);
  }
}

// Additional utility functions for testing specific scenarios
function testSpecificTags() {
  console.log("\n🔬 Testing specific tag patterns:\n");
  
  const specificTests = [
    { tags: ["B2B"], expected: "Enterprise Software" },
    { tags: ["B2C"], expected: "Consumer Products" },
    { tags: ["SaaS"], expected: "Enterprise Software" },
    { tags: ["AI", "ML"], expected: "Artificial Intelligence" },
    { tags: ["Fintech", "Payments"], expected: "Financial Technology" },
    { tags: ["Healthtech", "Medical"], expected: "Healthcare Technology" },
    { tags: ["E-commerce", "Marketplace"], expected: "E-commerce" },
    { tags: ["Developer Tools", "API"], expected: "Developer Tools" },
  ];

  specificTests.forEach(test => {
    const result = extractIndustry(test.tags);
    const match = result.primaryIndustry === test.expected;
    console.log(`Tags: [${test.tags.join(', ')}] → ${result.primaryIndustry} ${match ? '✅' : '❌'}`);
    if (!match) {
      console.log(`  Expected: ${test.expected}`);
    }
  });
}

// Run the tests
if (require.main === module) {
  runTests();
  testSpecificTags();
}