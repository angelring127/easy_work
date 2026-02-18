// spec: specs/mobile-week-grid-responsive.plan.md
// seed: e2e/specs/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Mobile Layout and Visual Display', () => {
  test('Week grid displays properly on mobile viewport', async ({ page }) => {
    // 1. Set viewport to iPhone 12 size (390x844px)
    await page.setViewportSize({ width: 390, height: 844 });

    // 2. Navigate to /ko/login and authenticate with test-master@workeasy.test
    await page.goto('http://localhost:3000/ko/login');
    await page.getByRole('textbox', { name: '이메일' }).fill('test-master@workeasy.test');
    await page.getByRole('textbox', { name: '비밀번호를 입력하세요' }).fill('TestPassword123!');
    await page.getByRole('button', { name: '로그인' }).click();

    // 3. Navigate to /ko/schedule page
    await page.goto('http://localhost:3000/ko/schedule');
    await new Promise(f => setTimeout(f, 2 * 1000));

    // 4. Verify the week-grid header row displays all 7 days plus user column
    await expect(page.getByText('사용자')).toBeVisible();
    await expect(page.getByText('월')).toBeVisible();
    await expect(page.getByText('화')).toBeVisible();
    await expect(page.getByText('수')).toBeVisible();
    await expect(page.getByText('목')).toBeVisible();
    await expect(page.getByText('금')).toBeVisible();
    await expect(page.getByText('토')).toBeVisible();
    await expect(page.getByText('일')).toBeVisible();

    // 5. Verify the morning/afternoon staff count row is visible
    await expect(page.getByText('오전 인원')).toBeVisible();
    await expect(page.getByText('오후 인원')).toBeVisible();

    // 6. Verify user row displays correctly
    await expect(page.getByText('test-master')).toBeVisible();
    await expect(page.getByText('0h')).toBeVisible();
    await expect(page.getByText('마스터 관리자')).toBeVisible();

    // 7. Take screenshot of initial mobile view
    await page.screenshot({ 
      path: 'test-results/mobile-week-grid-initial.png', 
      fullPage: true 
    });
  });
});
