// Test ultra-lenient matching
function cleanProductName(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const quantityUnitPattern = /^\s*\d+(\.\d+)?\s*[x×X]?\s*\d*(\.\d+)?\s*(kg|kilogram|g|gram|mg|milligram|oz|ounce|ml|milliliter|l|liter|cl|centiliter|fl\s*oz|pack|packs|pc|pcs|piece|pieces|each|ea|box|boxes|bottle|bottles|can|cans|jar|jars|lb|lbs|pound|pounds)\b/i;

  let cleaned = '';
  for (const line of lines) {
    if (!quantityUnitPattern.test(line)) {
      if (cleaned) {
        cleaned += ' ' + line;
      } else {
        cleaned = line;
      }
    }
  }
  
  if (!cleaned) {
    cleaned = text.trim();
    cleaned = cleaned.replace(/^\s*\d+(\.\d+)?\s*[x×X]?\s*\d*(\.\d+)?\s*(kg|kilogram|g|gram|mg|milligram|oz|ounce|ml|milliliter|l|liter|cl|centiliter|fl\s*oz|pack|packs|pc|pcs|piece|pieces|each|ea|box|boxes|bottle|bottles|can|cans|jar|jars|lb|lbs|pound|pounds)\s+/i, '').trim();
  }
  
  return cleaned;
}

const normalize = (str) => str
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function testMatching(query, productTexts) {
  const queryNorm = normalize(query).trim();

  console.log(`\n🔍 Search Query: "${query}"`);
  console.log(`📝 Normalized: "${queryNorm}"\n`);

  const cleanedProductTexts = productTexts.map(text => cleanProductName(text));

  const matched = cleanedProductTexts.filter((productName) => {
    const productNorm = normalize(productName);
    const isMatch = productNorm.includes(queryNorm);
    
    console.log(`  ${isMatch ? '✓' : '✗'} "${productName}" -> normalized: "${productNorm}"`);
    return isMatch;
  });

  console.log(`\n✅ Matched: ${matched.length}/${productTexts.length}`);
  if (matched.length > 0) {
    console.log(`📌 Results: ${matched.join(', ')}`);
  }
}

// Test with various product formats
const testProducts = [
  '1kg Fresh Milk',
  'Full Cream Milk\n1L',
  'Almond Milk 500ml',
  'Soy Milk',
  'Chocolate Milk',
  '200g Mixed Nuts',
  'Cashew Nuts Premium\n250g',
  'Roasted Peanuts',
  'Honey',
  'Butter',
  'Cheese',
  '1kg Rice',
  'Olive Oil 500ml'
];

console.log('========== ULTRA LENIENT MATCHING TEST ==========');
testMatching('milk', testProducts);
testMatching('nuts', testProducts);
testMatching('nut', testProducts);
