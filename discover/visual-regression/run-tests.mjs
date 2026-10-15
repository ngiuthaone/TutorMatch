import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

async function completeWizard(page) {
  await page.waitForTimeout(3000);
  
  // Step 1: Click "Course" button
  try {
    await page.click('button:has-text("Course")');
    await page.waitForTimeout(500);
  } catch (e) {
    console.log('Could not click Course button');
  }
  
  // Step 2: Click "Next →" button
  try {
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log('Could not click Next →');
  }
  
  // Step 3: Fill title
  try {
    const titleInput = await page.$('input[type="text"], input:not([type])');
    if (titleInput) {
      await titleInput.fill('Test Course');
      await page.waitForTimeout(500);
    }
  } catch (e) {
    console.log('Could not fill title');
  }
  
  // Step 4: Click "Next →" twice more
  for (let i = 0; i < 2; i++) {
    try {
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(2000);
    } catch (e) {
      console.log(`Could not click Next → ${i+1}`);
    }
  }
  
  // Step 5: Click "Create course →"
  try {
    await page.click('button:has-text("Create course")');
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log('Could not click Create course →');
  }
}

async function capturePage(page, pageId, outputPath) {
  // Click the page link in sidebar
  try {
    await page.click(`[data-page="${pageId}"]`);
    await page.waitForTimeout(1500);
  } catch (e) {
    console.log(`Could not click page link for ${pageId}`);
  }
  
  await page.screenshot({ path: outputPath, fullPage: true });
}

function resizeImage(img, targetWidth, targetHeight) {
  const resized = new PNG({ width: targetWidth, height: targetHeight });
  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const srcX = Math.floor(x * img.width / targetWidth);
      const srcY = Math.floor(y * img.height / targetHeight);
      const srcIdx = (srcY * img.width + srcX) * 4;
      const dstIdx = (y * targetWidth + x) * 4;
      resized.data[dstIdx] = img.data[srcIdx];
      resized.data[dstIdx + 1] = img.data[srcIdx + 1];
      resized.data[dstIdx + 2] = img.data[srcIdx + 2];
      resized.data[dstIdx + 3] = img.data[srcIdx + 3];
    }
  }
  return resized;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: config.viewport });
  
  const pages = config.pages;
  
  // First, capture all test harness pages
  for (const pageId of pages) {
    const page = await context.newPage();
    await page.goto(config.testHarnessUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.click(`[data-page-link="${pageId}"]`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(config.outputDir, `harness-${pageId}.png`), fullPage: true });
    await page.close();
    console.log(`Harness ${pageId} captured`);
  }
  
  // Then capture React pages
  for (let i = 0; i < pages.length; i++) {
    const pageId = pages[i];
    const page = await context.newPage();
    await page.goto(config.reactAppUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Complete wizard only for first page
    if (i === 0) {
      await completeWizard(page);
    }
    
    await capturePage(page, pageId, path.join(config.outputDir, `react-${pageId}.png`));
    await page.close();
    console.log(`React ${pageId} captured`);
  }
  
  // Compare and generate report
  console.log('\nComparing images...');
  const results = [];
  
  for (const pageId of pages) {
    const harnessPath = path.join(config.outputDir, `harness-${pageId}.png`);
    const reactPath = path.join(config.outputDir, `react-${pageId}.png`);
    
    if (!fs.existsSync(harnessPath) || !fs.existsSync(reactPath)) {
      results.push({ page: pageId, match: 0, error: 'Missing screenshot' });
      continue;
    }
    
    const img1 = PNG.sync.read(fs.readFileSync(harnessPath));
    const img2 = PNG.sync.read(fs.readFileSync(reactPath));
    
    const { width, height } = img1;
    
    // Resize img2 to match img1 if needed
    let img2Data = img2.data;
    if (img2.width !== width || img2.height !== height) {
      const resized = resizeImage(img2, width, height);
      img2Data = resized.data;
    }
    
    const diff = new PNG({ width, height });
    const diffPixels = pixelmatch(
      img1.data, 
      img2Data, 
      diff.data, 
      width, 
      height, 
      { threshold: 0.1, includeAA: true }
    );
    
    const total = width * height;
    const match = 100 - (diffPixels / total * 100);
    
    fs.writeFileSync(path.join(config.outputDir, `diff-${pageId}.png`), PNG.sync.write(diff));
    
    results.push({ page: pageId, match: parseFloat(match.toFixed(2)), diffPixels });
    console.log(`${pageId}: ${match.toFixed(2)}%`);
  }
  
  // Save report
  fs.writeFileSync(path.join(config.outputDir, 'report.json'), JSON.stringify(results, null, 2));
  
  // Generate HTML report
  const html = `
<!DOCTYPE html>
<html><head><title>Visual Regression Report</title>
<style>
body{font-family:system-ui;margin:20px}.page{margin-bottom:30px;border:1px solid #ddd;padding:15px}
img{max-width:100%;height:auto;border:1px solid #eee}.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
</style></head><body>
<h1>Visual Regression Report</h1>
${results.map(r => `
<div class="page">
<h2>${r.page} - ${r.match}% match</h2>
<div class="grid">
<div><h3>Test Harness</h3><img src="harness-${r.page}.png"></div>
<div><h3>React App</h3><img src="react-${r.page}.png"></div>
<div><h3>Diff</h3><img src="diff-${r.page}.png"></div>
</div>
</div>
`).join('')}
</body></html>`;
  
  fs.writeFileSync(path.join(config.outputDir, 'report.html'), html);
  
  console.log('\nReport generated at', path.join(config.outputDir, 'report.html'));
  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
