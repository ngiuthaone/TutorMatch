const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Navigate to the event creator
  await page.goto('http://localhost:3000/events/new');
  
  // Wait for the page to fully load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Check if iframe exists
  const iframeCount = await page.locator('iframe').count();
  console.log(`Found ${iframeCount} iframes`);
  
  if (iframeCount > 0) {
    const iframe = await page.locator('iframe').first();
    const frame = await iframe.contentFrame();
    await frame.waitForLoadState('domcontentloaded');
    
    const titleInput = await frame.getByRole('textbox', { name: /Working title/ });
    const titleCount = await titleInput.count();
    console.log(`Found ${titleCount} title inputs in iframe`);
    
    if (titleCount > 0) {
      await titleInput.click();
      await titleInput.fill('Test Workshop');
      console.log('Filled title');
    }
  } else {
    // Try to find the form directly
    const titleInput = await page.getByRole('textbox', { name: /Working title/ });
    const titleCount = await titleInput.count();
    console.log(`Found ${titleCount} title inputs directly on page`);
    
    if (titleCount > 0) {
      await titleInput.click();
      await titleInput.fill('Test Workshop');
      console.log('Filled title directly');
    }
  }

  await page.waitForTimeout(3000);
  await browser.close();
})();
