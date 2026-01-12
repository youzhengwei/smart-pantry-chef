// Test the exact matching logic
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
  const queryWords = queryNorm.split(' ').filter(w => w.length > 0);

  console.log(`\n🔍 Search Query: "${query}"`);
  console.log(`📝 Normalized: "${queryNorm}"`);
  console.log(`🔤 Query Words: [${queryWords.join(', ')}]\n`);

  const cleanedProductTexts = productTexts.map(text => cleanProductName(text));

  const matched = queryWords.length === 0 ? [] : cleanedProductTexts.filter((productName, idx) => {
    const productNorm = normalize(productName);
    const isMatch = queryWords.every(queryWord => {
      const wordRegex = new RegExp(`(^|\\s)${queryWord}(\\s|$|s\\s|ed\\s)`, 'i');
      return wordRegex.test(' ' + productNorm + ' ');
    });
    
    console.log(`  ${isMatch ? '✓' : '✗'} "${productName}" -> normalized: "${productNorm}"`);
    return isMatch;
  });

  console.log(`\n✅ Matched: ${matched.length}/${productTexts.length}`);
  if (matched.length > 0) {
    console.log(`📌 Results: ${matched.join(', ')}`);
  }
}

// Test Case 1: Searching for "nuts"
const productsForNuts = [
  '1 kg nuts',
  '500g almonds',
  '2 packs chocolate',
  'Premium Mixed Nuts\n250g',
  'cashew nuts',
  'honey roasted peanuts',
  'oil'
];
testMatching('nuts', productsForNuts);

// Test Case 2: Searching for "milk"
const productsForMilk = [
  '1l milk',
  '500ml yogurt',
  'milk\n1 liter',
  'almond milk',
  'fresh milk bottle\n1l',
  'cheese',
  'ice cream'
];
testMatching('milk', productsForMilk);

// Test Case 3: Searching for "chocolate bar"
const productsForChocolate = [
  '2 x 100g chocolate bar',
  'chocolate bar',
  'dark chocolate\n100g',
  'chocolate chips',
  'milk chocolate bar pack',
  'cocoa'
];
testMatching('chocolate bar', productsForChocolate);
