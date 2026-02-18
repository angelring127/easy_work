// spec: specs/mobile-week-grid-responsive.plan.md
// seed: e2e/specs/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Responsive Breakpoints and Tablet View', () => {
  test('Grid expands properly on tablet viewport', async ({ page }) => {
    // 1. Set viewport to tablet size (768x1024 - iPad portrait)
    await page.setViewportSize({ width: 768, height: 1024 });

    // Navigate to login page to authenticate
    await page.goto('http://localhost:3000/en/login');
    await page.getByRole('textbox', { name: 'Email' }).fill('test-master@workeasy.test');
    await page.getByRole('textbox', { name: 'Enter your password' }).fill('TestPassword123!');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // 2. Navigate to /en/schedule
    await page.goto('http://localhost:3000/en/schedule');
    
    // Wait for store context to load
    await new Promise(f => setTimeout(f, 3 * 1000));

    // 3. Verify grid cells use desktop/tablet styling (md: breakpoint)
    // Verify all 7 days fit on screen without horizontal scroll
    await expect(page.getByText('User')).toBeVisible();
    await expect(page.getByText('Mon')).toBeVisible();
    await expect(page.getByText('Tue')).toBeVisible();
    await expect(page.getByText('Wed')).toBeVisible();
    await expect(page.getByText('Thu')).toBeVisible();
    await expect(page.getByText('Fri')).toBeVisible();
    await expect(page.getByText('Sat')).toBeVisible();
    await expect(page.getByText('Sun')).toBeVisible();

    // 4. Verify padding increases to md:p-3 for headers, md:p-2 for other cells
    // 5. Verify gap increases to md:gap-1
    // 6. Verify font sizes increase (md:text-sm, md:text-xs)
    // Check tablet styling through element inspection
    const dayCellStyles = await page.evaluate(() => {
      const monText = Array.from(document.querySelectorAll('*')).find(el => 
        el.textContent?.trim() === 'Mon' && el.childElementCount === 0
      );
      if (!monText || !monText.parentElement) return null;
      
      const styles = window.getComputedStyle(monText.parentElement);
      return {
        padding: styles.padding,
        fontSize: window.getComputedStyle(monText).fontSize,
      };
    });
    
    // On tablet (768px), md:p-3 should be active (12px padding)
    expect(dayCellStyles?.padding).toBe('12px');
    // md:text-sm should be active (14px font size)
    expect(dayCellStyles?.fontSize).toBe('14px');

    // 7. Verify avatar size increases to md:h-6 md:w-6
    const avatarSize = await page.evaluate(() => {
      const avatar = Array.from(document.querySelectorAll('*')).find(el => 
        el.textContent?.trim() === 'T' && 
        el.className.includes('rounded-full') &&
        !el.className.includes('badge')
      );
      if (!avatar) return null;
      
      const styles = window.getComputedStyle(avatar);
      return {
        width: styles.width,
        height: styles.height,
      };
    });
    
    // md:h-6 md:w-6 should be 24px on tablet
    expect(avatarSize?.width).toBe('24px');
    expect(avatarSize?.height).toBe('24px');

    // Verify grid container properties
    const gridInfo = await page.evaluate(() => {
      const gridContainer = document.querySelector('[class*="overflow-x-auto"]');
      if (!gridContainer) return null;
      
      return {
        scrollWidth: gridContainer.scrollWidth,
        clientWidth: gridContainer.clientWidth,
        hasHorizontalScroll: gridContainer.scrollWidth > gridContainer.clientWidth,
      };
    });
    
    // On tablet (768px), all 7 days should fit without horizontal scroll
    expect(gridInfo?.hasHorizontalScroll).toBe(false);

    // 8. Take screenshot of tablet view and save to `test-results/tablet-week-grid.png`
    await page.screenshot({ 
      path: 'test-results/tablet-week-grid.png', 
      fullPage: true 
    });
  });
});
