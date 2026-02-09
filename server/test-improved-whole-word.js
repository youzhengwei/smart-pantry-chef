/**
 * Test the improved whole-word matching logic
 * This tests the new stricter matching that prevents substring false matches
 */

const normalize = (str) => str
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function testMatching(query, productTexts) {
  const queryNorm = normalize(query).trim();
  const queryWords = queryNorm.split(' ').filter(w => w.length > 0);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 Search Query: "${query}"`);
  console.log(`📝 Normalized: "${queryNorm}"`);
  console.log(`🔤 Query Words: [${queryWords.join(', ')}]\n`);

  const matched = queryWords.length === 0 ? [] : productTexts.filter((productName) => {
    const productNorm = normalize(productName);
    const productWords = productNorm.split(' ');
    
    const isMatch = queryWords.every(queryWord => {
      // For ALL query words, require exact whole word match first
      if (productWords.includes(queryWord)) {
        return true;
      }
      
      // Check plural/singular variations (e.g., milk/milks, pen/pens)
      const singular = queryWord.replace(/s$/, '');
      const plural = queryWord + 's';
      if (productWords.includes(plural) || productWords.includes(singular)) {
        return true;
      }
      
      // Only allow substring matching for longer words (5+ chars) to catch compound words
      // This prevents "pen" matching "peng" but allows "chocolate" to match "ferrero-chocolate"
      if (queryWord.length >= 5) {
        return productWords.some(pw => pw.length >= queryWord.length && pw.includes(queryWord));
      }
      
      return false;
    });
    
    console.log(`  ${isMatch ? '✓' : '✗'} "${productName}" -> words: [${productWords.join(', ')}]`);
    return isMatch;
  });

  console.log(`\n✅ Matched: ${matched.length}/${productTexts.length}`);
  if (matched.length > 0) {
    console.log(`📌 Results: ${matched.map(m => `"${m}"`).join(', ')}`);
  }
}

// TEST CASE 1: "pen" should NOT match "Milo Peng..."
console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
console.log('║ TEST 1: Short word "pen" - Should NOT match "Peng"     ║');
console.log('╚═══════════════════════════════════════════════════════════╝');

const penTestProducts = [
  'Ballpoint Pen 0.7mm',
  'Gel Pen Set',
  'Pencil HB',
  'Milo Peng Nutri Up Chocolate Malt Drink',
  'Pens and Pencils Pack',
  'Felt Tip Pen'
];
testMatching('pen', penTestProducts);

// TEST CASE 2: "milk" should work correctly
console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
console.log('║ TEST 2: Word "milk" - Should match milk products      ║');
console.log('╚═══════════════════════════════════════════════════════════╝');

const milkTestProducts = [
  '1l fresh milk',
  'Almond milk 500ml',
  'Milo Peng Chocolate',
  'Full Cream Milk\n1 Liter',
  'Milkshake',
  'Cheese',
  'Yogurt'
];
testMatching('milk', milkTestProducts);

// TEST CASE 3: Short word "shit" example (different product)
console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
console.log('║ TEST 3: Short word should use exact matching only     ║');
console.log('╚═══════════════════════════════════════════════════════════╝');

const ShirtTestProducts = [
  'White Shirt Size M',
  'Blue T-Shirt',
  'Shirt Collar',
  'Tissue Box',
  'Shift Knob Car',
  'Sheaf of Paper'
];
testMatching('shirt', ShirtTestProducts);

// TEST CASE 4: Longer word "chocolate" - Can use substring matching
console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
console.log('║ TEST 4: Long word "chocolate" - Substring OK (5+ chars) ║');
console.log('╚═══════════════════════════════════════════════════════════╝');

const chocolateTestProducts = [
  'Dark Chocolate Bar',
  'Chocolate Chips',
  'Ferrero Rocher Chocolate',
  'Cocoa Powder',
  'Milk Chocolate 100g',
  'Chocolate Spread',
  'White Chocolate'
];
testMatching('chocolate', chocolateTestProducts);

// TEST CASE 5: Testing plurals
console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
console.log('║ TEST 5: Plural variations - Should match singular     ║');
console.log('╚═══════════════════════════════════════════════════════════╝');

const pluralTestProducts = [
  '1kg Almonds',
  '500g Almond Nuts',
  'Mixed Nuts Pack',
  'Peanut Butter',
  'Hazelnut Spread',
  'Brazil Nut'
];
testMatching('almond', pluralTestProducts);

console.log('\n\n✨ Test completed! Summary:');
console.log('- Short words (< 5 chars): Exact whole-word match only');
console.log('- Long words (5+ chars): Allow substring match within words');
console.log('- Plurals: Automatically handled (almond/almonds)');
console.log('- This prevents false matches like "pen" → "Peng"');
