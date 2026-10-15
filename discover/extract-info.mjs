import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000/courses/new', { waitUntil: 'networkidle' });
  
  // Wait a bit for any dynamic content
  await page.waitForTimeout(1000);
  
  const results = await page.evaluate(() => {
    const body = document.body;
    const pageTitle = document.querySelector('.page-title') || document.querySelector('.page-header h1');
    const firstButtonInTopbar = document.querySelector('header button, nav button, .topbar button, [role="navigation"] button');
    const firstInput = document.querySelector('input');
    const firstBtn = document.querySelector('.btn');
    
    const rootStyles = getComputedStyle(document.documentElement);
    
    return {
      bodyClass: body.getAttribute('class') || '',
      pageTitleClass: pageTitle ? pageTitle.getAttribute('class') : 'NOT_FOUND',
      firstTopbarButtonClass: firstButtonInTopbar ? firstButtonInTopbar.getAttribute('class') : 'NOT_FOUND',
      firstInputClass: firstInput ? firstInput.getAttribute('class') : 'NOT_FOUND',
      cssVarBackground: rootStyles.getPropertyValue('--background').trim(),
      cssVarFontTutoriaSans: rootStyles.getPropertyValue('--font-tutoria-sans').trim(),
      firstBtnOuterHTML: firstBtn ? firstBtn.outerHTML : 'NOT_FOUND'
    };
  });
  
  console.log(JSON.stringify(results, null, 2));
  
  await browser.close();
})();
