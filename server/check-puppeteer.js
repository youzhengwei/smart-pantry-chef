// Quick diagnostic script to check Puppeteer installation
import puppeteer from 'puppeteer';

async function checkPuppeteer() {
  console.log('='.repeat(60));
  console.log('🔍 Puppeteer Installation Check');
  console.log('='.repeat(60));
  
  try {
    // Check executable path
    console.log('\n1. Checking Chromium executable...');
    const execPath = puppeteer.executablePath();
    console.log('   ✓ Executable path:', execPath);
    
    // Try to launch browser
    console.log('\n2. Attempting to launch browser...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process'
      ]
    });
    console.log('   ✓ Browser launched successfully');
    
    // Get browser version
    const version = await browser.version();
    console.log('   ✓ Browser version:', version);
    
    // Try to open a page
    console.log('\n3. Opening a test page...');
    const page = await browser.newPage();
    await page.goto('https://example.com', { waitUntil: 'networkidle2', timeout: 10000 });
    const title = await page.title();
    console.log('   ✓ Page title:', title);
    
    await browser.close();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL CHECKS PASSED - Puppeteer is working correctly!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ ERROR:', error.message);
    console.error('='.repeat(60));
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

checkPuppeteer();
