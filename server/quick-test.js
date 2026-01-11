// Timeout wrapper for test  
async function runWithTimeout() {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Test timeout after 90s')), 90000)
  );

  const testPromise = (async () => {
    console.log('🧪 Testing /search-products endpoint...\n');

    const testQuery = 'milk';
    
    const response = await fetch('http://localhost:3000/search-products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: testQuery })
    });

    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Response:', errorText);
      process.exit(1);
    }

    const data = await response.json();
    
    console.log(`\n📝 Query: "${data.query}"`);
    console.log(`\n📊 Summary:`);
    console.log(`   Total stores: ${data.summary.total}`);
    console.log(`   ✓ Available: ${data.summary.available}`);
    console.log(`   ✗ Not found: ${data.summary.unavailable}`);
    
    console.log(`\n📍 Results:`);
    data.results.forEach((result, index) => {
      const status = result.hasItem ? '✓ YES' : '✗ NO';
      console.log(`\n${index + 1}. ${result.storeName} (${result.storeCode})`);
      console.log(`   Status: ${status}`);
      console.log(`   URL: ${result.url}`);
      if (result.error) {
        console.log(`   ⚠️  Error: ${result.error}`);
      }
    });

    console.log('\n✅ Test completed successfully!');
  })();

  return Promise.race([testPromise, timeout]);
}

runWithTimeout().catch(e => {
  console.error('❌ Test failed:', e.message);
  process.exit(1);
});
