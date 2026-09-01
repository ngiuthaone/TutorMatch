const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Navigate to the event creator
  await page.goto('http://localhost:3000/events/new');
  
  // Wait for the page to fully load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Get the iframe
  const iframe = await page.locator('iframe').first();
  const frame = await iframe.contentFrame();
  
  // Wait for the frame to load
  await page.waitForTimeout(2000);

  // Helper function to fill a field if it exists
  async function fillField(selector, value, name) {
    const el = await frame.getByRole('textbox', selector);
    if (await el.count() > 0) {
      await el.click();
      await el.fill(value);
      console.log(`Filled ${name}`);
    } else {
      console.log(`Not found: ${name}`);
    }
  }

  // Fill in the working title
  await fillField({ name: /Working title/ }, 'Test Workshop', 'title');

  // Fill in the one-sentence promise
  await fillField({ name: /One-sentence promise/ }, 'Learn something new and exciting', 'promise');

  // Select category
  await frame.getByLabel('Category').selectOption('Lifestyle');
  console.log('Selected category');

  // Add an outcome
  await frame.getByRole('textbox', { name: /e\.g\. Shape and glaze/ }).click();
  await frame.getByRole('textbox', { name: /e\.g\. Shape and glaze/ }).fill('Make something cool');
  await frame.getByRole('button', { name: 'Add outcome' }).click();
  console.log('Added outcome');

  // Add a moment
  await frame.getByRole('button', { name: 'Add moment' }).click();
  await page.waitForTimeout(500);
  
  await frame.getByRole('textbox', { name: 'Moment title' }).first().click();
  await frame.getByRole('textbox', { name: 'Moment title' }).first().fill('Welcome');

  await frame.getByRole('textbox', { name: /What happens in this part/ }).first().click();
  await frame.getByRole('textbox', { name: /What happens in this part/ }).first().fill('Meet the team and get settled');
  console.log('Added moment');

  // Add an included item
  await frame.getByRole('textbox', { name: /e\.g\. Clay and pottery tools/ }).click();
  await frame.getByRole('textbox', { name: /e\.g\. Clay and pottery tools/ }).fill('All materials');
  await frame.getByRole('button', { name: 'Add item' }).first().click();
  console.log('Added included item');

  // Add a bring item
  await frame.getByRole('textbox', { name: /e\.g\. Comfortable clothes/ }).click();
  await frame.getByRole('textbox', { name: /e\.g\. Comfortable clothes/ }).fill('Comfortable clothes');
  await frame.getByRole('button', { name: 'Add item' }).nth(1).click();
  console.log('Added bring item');

  // Add FAQ
  await frame.getByRole('button', { name: 'Add question' }).click();
  await page.waitForTimeout(500);
  
  await frame.getByRole('textbox', { name: 'Question' }).first().click();
  await frame.getByRole('textbox', { name: 'Question' }).first().fill('Do I need experience?');

  await frame.getByRole('textbox', { name: 'Answer' }).first().click();
  await frame.getByRole('textbox', { name: 'Answer' }).first().fill('No, beginners welcome!');
  console.log('Added FAQ');

  // Add session
  await frame.getByRole('button', { name: 'Add' }).first().click();
  console.log('Added session');

  // Fill capacity
  await frame.getByRole('spinbutton', { name: 'Capacity' }).click();
  await frame.getByRole('spinbutton', { name: 'Capacity' }).fill('15');
  console.log('Filled capacity');

  // Fill venue
  await fillField({ name: /Studio, café/ }, 'Test Studio', 'venue name');
  await fillField({ name: /Street, district/ }, '123 Hoan Kiem, Ha Noi', 'address');
  await fillField({ name: /Entrance, parking/ }, 'Arrive 10 minutes early', 'arrival');

  // Set price using JavaScript (radio button is hidden)
  await page.evaluate(() => {
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentDocument) {
      const radio = iframe.contentDocument.querySelector('input[type="radio"][value="Paid"]');
      if (radio) radio.click();
    }
  });
  console.log('Selected Paid');
  await page.waitForTimeout(500);

  // Fill price
  const priceInput = await frame.getByRole('spinbutton', { name: /Price per person/ });
  if (await priceInput.count() > 0) {
    await priceInput.click();
    await priceInput.fill('250000');
    console.log('Filled price');
  }

  // Set cancellation
  await frame.getByLabel('Cancellation deadline').selectOption('24 hours before start');
  await frame.getByLabel('Refund policy').selectOption('Full refund before deadline');
  console.log('Set cancellation');

  console.log('Form filled! Ready to click "Review and publish"');
  
  // Keep the browser open
  await page.waitForTimeout(60000);
  await browser.close();
})();
