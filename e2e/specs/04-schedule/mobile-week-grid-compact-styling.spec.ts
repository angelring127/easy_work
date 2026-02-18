// spec: specs/mobile-week-grid-responsive.plan.md
// seed: e2e/specs/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Mobile Layout and Visual Display', () => {
  test('Grid cells have compact mobile styling', async ({ page }) => {
    // 1. Navigate to schedule page on mobile viewport (390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3000/ko/login');
    await page.getByRole('textbox', { name: '이메일' }).fill('test-master@workeasy.test');
    await page.getByRole('textbox', { name: '비밀번호를 입력하세요' }).fill('TestPassword123!');
    await page.getByRole('button', { name: '로그인' }).click();

    await page.goto('http://localhost:3000/ko/schedule');
    await page.waitForSelector('text=스케줄 관리');

    // 2. Measure the minimum width of a day column cell
    const dayCellMeasurement = await page.locator('.overflow-x-auto').evaluate((container) => {
      const headerCells = Array.from(container.querySelectorAll('div')).filter(div => {
        const text = div.textContent?.trim();
        return ['월', '화', '수', '목', '금', '토', '일'].includes(text || '');
      });
      
      if (headerCells.length === 0) return null;
      
      const parentCell = headerCells[0].parentElement;
      return {
        width: parentCell?.offsetWidth || 0,
        computedMinWidth: parentCell ? window.getComputedStyle(parentCell).minWidth : '0px',
        className: parentCell?.className || ''
      };
    });

    expect(dayCellMeasurement).not.toBeNull();
    expect(dayCellMeasurement?.width).toBeGreaterThanOrEqual(70);

    // 3. Measure the minimum height of user assignment cells
    const assignmentCellMeasurement = await page.locator('.overflow-x-auto').evaluate((container) => {
      const emptyCells = Array.from(container.querySelectorAll('div')).filter(div => {
        return div.textContent?.trim() === '-' && div.className.includes('cursor-pointer');
      });
      
      if (emptyCells.length === 0) return null;
      
      const cell = emptyCells[0];
      const styles = window.getComputedStyle(cell);
      
      return {
        height: cell.offsetHeight,
        width: cell.offsetWidth,
        computedMinHeight: styles.minHeight,
        computedMinWidth: styles.minWidth,
        padding: styles.padding,
        className: cell.className
      };
    });

    expect(assignmentCellMeasurement).not.toBeNull();
    expect(assignmentCellMeasurement?.height).toBeGreaterThanOrEqual(70);
    expect(assignmentCellMeasurement?.className).toContain('min-h-[70px]');
    expect(assignmentCellMeasurement?.className).toContain('min-w-[70px]');

    // 4. Verify grid gaps between cells
    const gridGapMeasurement = await page.locator('.overflow-x-auto').evaluate((container) => {
      const gridElement = container.querySelector('.grid');
      if (!gridElement) return null;
      
      const styles = window.getComputedStyle(gridElement);
      return {
        gap: styles.gap,
        className: gridElement.className
      };
    });

    expect(gridGapMeasurement).not.toBeNull();
    expect(gridGapMeasurement?.className).toContain('gap-0.5');

    // 5. Verify cell padding
    expect(assignmentCellMeasurement?.className).toContain('p-0.5');
    expect(assignmentCellMeasurement?.padding).toBe('2px');

    // 6. Take screenshot highlighting compact layout
    await page.screenshot({ 
      path: 'test-results/mobile-week-grid-compact.png', 
      fullPage: true 
    });
  });
});
