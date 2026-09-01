const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Navigate to the event creator
  await page.goto('http://localhost:3000/events/new');
  await page.waitForTimeout(5000);

  // Check if iframe exists
  const iframeCount = await page.locator('iframe').count();
  console.log(`Found ${iframeCount} iframes`);
  
  if (iframeCount === 0) {
    console.log('No iframe found. Checking page content...');
    const content = await page.content();
    console.log(content.substring(0, 2000));
    await browser.close();
    return;
  }

  // Get the iframe
  const iframe = await page.locator('iframe').first();
  const frame = await iframe.contentFrame();
  
  // Wait for the frame to load
  await frame.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  
  // Check what's in the frame
  const frameContent = await frame.content();
  console.log('Frame content length:', frameContent.length);
  
  // Try to find the title input
  const titleInput = await frame.getByRole('textbox', { name: /Working title/ });
  const titleCount = await titleInput.count();
  console.log(`Found ${titleCount} title inputs`);
  
  if (titleCount === 0) {
    console.log('No title input found. Frame content:');
    console.log(frameContent.substring(0, 3000));
  }

  await browser.close();
})();
