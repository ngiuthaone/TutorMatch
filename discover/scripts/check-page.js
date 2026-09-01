const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Listen for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Console error:', msg.text());
    }
  });

  page.on('pageerror', err => {
    console.log('Page error:', err.message);
  });

  // Navigate to the event creator
  await page.goto('http://localhost:3000/events/new');
  
  // Wait for the page to fully load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  // Get the page title
  const title = await page.title();
  console.log('Page title:', title);

  // Get the page content
  const content = await page.content();
  console.log('Content length:', content.length);
  
  // Check if there's an error message
  if (content.includes('error') || content.includes('Error')) {
    console.log('Page contains error');
    const errorMatch = content.match(/error[^<]{0,200}/i);
    if (errorMatch) console.log('Error:', errorMatch[0]);
  }

  // Check for any text content
  const text = await page.evaluate(() => document.body.innerText);
  console.log('Page text:', text.substring(0, 1000));

  await browser.close();
})();
