// Test the cleanProductName function
function cleanProductName(text) {
  // Split by newlines in case format is "1 kg\nNuts" or "Nuts\n1 kg"
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Pattern to match quantity + unit combinations
  const quantityUnitPattern = /^\s*\d+(\.\d+)?\s*[x×X]?\s*\d*(\.\d+)?\s*(kg|kilogram|g|gram|mg|milligram|oz|ounce|ml|milliliter|l|liter|cl|centiliter|fl\s*oz|pack|packs|pc|pcs|piece|pieces|each|ea|box|boxes|bottle|bottles|can|cans|jar|jars|lb|lbs|pound|pounds)\b/i;

  let cleaned = '';
  
  // Process each line - keep lines that don't look like quantities
  for (const line of lines) {
    if (!quantityUnitPattern.test(line)) {
      // This line doesn't start with a quantity/unit, so keep it
      if (cleaned) {
        cleaned += ' ' + line;
      } else {
        cleaned = line;
      }
    }
  }
  
  // If we removed all lines, just clean the original text as fallback
  if (!cleaned) {
    cleaned = text.trim();
    // Try to remove quantity/unit from start
    cleaned = cleaned.replace(/^\s*\d+(\.\d+)?\s*[x×X]?\s*\d*(\.\d+)?\s*(kg|kilogram|g|gram|mg|milligram|oz|ounce|ml|milliliter|l|liter|cl|centiliter|fl\s*oz|pack|packs|pc|pcs|piece|pieces|each|ea|box|boxes|bottle|bottles|can|cans|jar|jars|lb|lbs|pound|pounds)\s+/i, '').trim();
  }
  
  return cleaned;
}

// Test cases
const testCases = [
  '1 kg nuts',
  '1kg nuts',
  'nuts\n1 kg',
  '1 kg\nnuts',
  '500 g almonds',
  '2 packs chocolate',
  '3 x 100g bars',
  'milk 1 liter',
  '1l milk',
  'Organic Free Range Eggs\n12 pack',
  'Premium Almonds\n500g',
  'extra virgin olive oil\n750ml',
  'almonds',
  'honey',
  '2x1kg sugar'
];

console.log('🧪 Testing cleanProductName function:\n');
testCases.forEach(test => {
  const cleaned = cleanProductName(test);
  console.log(`Input:  "${test}"`);
  console.log(`Output: "${cleaned}"`);
  console.log();
});
