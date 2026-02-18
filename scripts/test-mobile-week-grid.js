const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testMobileWeekGrid() {
  // Create results directory
  const resultsDir = path.join(__dirname, '..', 'test-results', 'manual');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });

  console.log('\n=== Testing Mobile Week-Grid Responsive Improvements ===\n');

  // Test 1: Mobile view (iPhone 12)
  console.log('1. Testing Mobile View (iPhone 12 - 390x844)...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
  });
  const mobilePage = await mobileContext.newPage();

  await mobilePage.goto('http://localhost:3000/ko/schedule');
  await mobilePage.waitForLoadState('networkidle');
  await mobilePage.waitForTimeout(2000);

  const mobileScreenshot = path.join(resultsDir, 'mobile-view-390x844.png');
  await mobilePage.screenshot({ path: mobileScreenshot, fullPage: true });
  console.log(`   ✓ Screenshot saved: ${mobileScreenshot}`);

  // Get grid measurements
  const mobileMeasurements = await mobilePage.evaluate(() => {
    const grid = document.querySelector('.grid.grid-cols-8');
    const cells = document.querySelectorAll('.grid.grid-cols-8 > div');
    const firstCell = cells[0];

    if (!firstCell) return null;

    const computedStyle = window.getComputedStyle(firstCell);
    const rect = firstCell.getBoundingClientRect();

    return {
      minWidth: computedStyle.minWidth,
      padding: computedStyle.padding,
      gap: window.getComputedStyle(grid).gap,
      cellWidth: rect.width,
      cellHeight: rect.height
    };
  });

  if (mobileMeasurements) {
    console.log('   Mobile Grid Measurements:');
    console.log(`   - Cell min-width: ${mobileMeasurements.minWidth}`);
    console.log(`   - Cell padding: ${mobileMeasurements.padding}`);
    console.log(`   - Grid gap: ${mobileMeasurements.gap}`);
    console.log(`   - Actual cell size: ${Math.round(mobileMeasurements.cellWidth)}x${Math.round(mobileMeasurements.cellHeight)}px`);
  }

  await mobileContext.close();

  // Test 2: Tablet view (iPad)
  console.log('\n2. Testing Tablet View (iPad - 768x1024)...');
  const tabletContext = await browser.newContext({
    viewport: { width: 768, height: 1024 }
  });
  const tabletPage = await tabletContext.newPage();

  await tabletPage.goto('http://localhost:3000/ko/schedule');
  await tabletPage.waitForLoadState('networkidle');
  await tabletPage.waitForTimeout(2000);

  const tabletScreenshot = path.join(resultsDir, 'tablet-view-768x1024.png');
  await tabletPage.screenshot({ path: tabletScreenshot, fullPage: true });
  console.log(`   ✓ Screenshot saved: ${tabletScreenshot}`);

  // Get tablet measurements
  const tabletMeasurements = await tabletPage.evaluate(() => {
    const grid = document.querySelector('.grid.grid-cols-8');
    const cells = document.querySelectorAll('.grid.grid-cols-8 > div');
    const firstCell = cells[0];

    if (!firstCell) return null;

    const computedStyle = window.getComputedStyle(firstCell);
    const rect = firstCell.getBoundingClientRect();

    return {
      minWidth: computedStyle.minWidth,
      padding: computedStyle.padding,
      gap: window.getComputedStyle(grid).gap,
      cellWidth: rect.width,
      cellHeight: rect.height
    };
  });

  if (tabletMeasurements) {
    console.log('   Tablet Grid Measurements:');
    console.log(`   - Cell min-width: ${tabletMeasurements.minWidth}`);
    console.log(`   - Cell padding: ${tabletMeasurements.padding}`);
    console.log(`   - Grid gap: ${tabletMeasurements.gap}`);
    console.log(`   - Actual cell size: ${Math.round(tabletMeasurements.cellWidth)}x${Math.round(tabletMeasurements.cellHeight)}px`);
  }

  await tabletContext.close();

  // Test 3: Desktop view
  console.log('\n3. Testing Desktop View (1920x1080)...');
  const desktopContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const desktopPage = await desktopContext.newPage();

  await desktopPage.goto('http://localhost:3000/ko/schedule');
  await desktopPage.waitForLoadState('networkidle');
  await desktopPage.waitForTimeout(2000);

  const desktopScreenshot = path.join(resultsDir, 'desktop-view-1920x1080.png');
  await desktopPage.screenshot({ path: desktopScreenshot, fullPage: true });
  console.log(`   ✓ Screenshot saved: ${desktopScreenshot}`);

  await desktopContext.close();

  // Test 4: English locale mobile
  console.log('\n4. Testing English Locale on Mobile...');
  const enMobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 }
  });
  const enMobilePage = await enMobileContext.newPage();

  await enMobilePage.goto('http://localhost:3000/en/schedule');
  await enMobilePage.waitForLoadState('networkidle');
  await enMobilePage.waitForTimeout(2000);

  const enMobileScreenshot = path.join(resultsDir, 'mobile-view-english-390x844.png');
  await enMobilePage.screenshot({ path: enMobileScreenshot, fullPage: true });
  console.log(`   ✓ Screenshot saved: ${enMobileScreenshot}`);

  await enMobileContext.close();

  await browser.close();

  console.log('\n=== Testing Complete ===\n');
  console.log(`All screenshots saved to: ${resultsDir}`);

  return {
    mobile: mobileMeasurements,
    tablet: tabletMeasurements,
    screenshotDir: resultsDir
  };
}

testMobileWeekGrid().catch(console.error);
