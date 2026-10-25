import { test, expect } from '@playwright/test';

async function clearAppData(page) {
  await page.goto('/akku-tracker/?e2e=1');
  await page.evaluate(async () => {
    localStorage.clear();
    if (indexedDB.databases) {
      for (const db of await indexedDB.databases()) {
        if (db.name === 'akku-tracker-db') indexedDB.deleteDatabase(db.name);
      }
    }
  });
  await page.reload();
}

test('start view has no visible camera image', async ({ page }) => {
  await clearAppData(page);
  await expect(page.locator('.version')).toHaveText('v0.3.35');
  await expect(page.locator('.signature')).toHaveText('by tillyfpv.de');
  await expect(page.locator('.site-link')).toHaveAttribute('href', 'https://tillyfpv.de/');
  await expect(page.locator('.app-info summary')).toHaveText('ⓘ Hinweise & Datenschutz');
  await expect(page.locator('.bottom-version')).toHaveCount(0);
  await expect(page.locator('.bottom-nav button')).toHaveCount(3);
  await expect(page.locator('#copter-form')).toBeHidden();
  await expect(page.locator('#qr-scanner')).toBeHidden();
  await expect(page.locator('video')).toHaveCount(1);
  await expect(page.locator('video')).toBeHidden();
});

test('scanner opens only after scan button and closes without leaving video visible', async ({ page }) => {
  await clearAppData(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => new MediaStream() },
    });
  });
  await page.getByRole('button', { name: /akku scannen/i }).click();
  await expect(page.locator('#qr-scanner')).toBeVisible();
  await expect(page.locator('#qr-video')).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.locator('#qr-scanner')).toBeHidden();
  await expect(page.locator('video')).toHaveCount(0);
});

test('after a successful scan no camera image remains in the page', async ({ page }) => {
  await clearAppData(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => new MediaStream() },
    });
  });
  await page.getByRole('button', { name: /akku scannen/i }).click();
  await expect(page.locator('#qr-scanner')).toBeVisible();
  await page.evaluate(() => window.__akkuTrackerTest.recordUse('BAT-001'));
  await expect(page.locator('#scan-result')).toBeVisible();
  await expect(page.locator('.bottom-nav')).toBeHidden();
  await expect(page.locator('.bottom-version')).toBeHidden();
  await expect(page.locator('.brand')).toBeHidden();
  await expect(page.locator('.app-info')).toBeHidden();
  await expect(page.locator('.quick-stats')).toBeHidden();
  await expect(page.locator('.scan-button')).toBeHidden();
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.locator('#qr-scanner')).toBeHidden();
  await expect(page.locator('body video')).toHaveCount(0);
  await expect(page.locator('#qr-canvas')).toHaveCount(0);
});
test('duplicate scan is rejected and does not open battery detail', async ({ page }) => {
  await clearAppData(page);
  await page.evaluate(() => window.__akkuTrackerTest.recordUse('BAT-001'));
  await expect(page.locator('#scan-result')).toBeVisible();
  await page.evaluate(() => window.__akkuTrackerTest.recordUse('BAT-001'));
  await expect(page.locator('#result-name')).toHaveText('Schon erfasst');
  await expect(page.locator('.success-check')).toHaveCount(0);
  await expect(page.locator('.reject-check')).toHaveCount(1);
  await expect(page.locator('#view-detail')).toBeHidden();
});

test('successful scan shows full-screen result overlay with copter buttons and timer', async ({ page }) => {
  await clearAppData(page);
  await page.evaluate(() => window.__akkuTrackerTest.recordUse('BAT-001'));
  await expect(page.locator('#scan-result')).toBeVisible();
  await expect(page.locator('#scan-result')).toHaveClass(/scan-overlay/);
  await expect(page.locator('#result-name')).toHaveText('Akku erkannt');
  await expect(page.locator('#scan-copter-timer')).toContainText('00:00:');
  expect(await page.locator('#scan-result').evaluate(el => getComputedStyle(el).zIndex)).toBe('70');
});

test('last usage shows battery, copter, date, time, and count', async ({ page }) => {
  await clearAppData(page);
  await page.evaluate(() => window.__akkuTrackerTest.recordUse('BAT-001'));
  await expect(page.locator('#last-used')).toHaveText(/Tattu 01 · Copter nicht zugeordnet · \d{2}\.\d{2}\.\d{4}.*Nutzung 1/);
});

test('copter choice grid adapts to the number of copters', async ({ page }) => {
  await clearAppData(page);
  await page.evaluate(() => window.__akkuTrackerTest.setScanCopters(6));
  await expect(page.locator('#scan-copter-choices')).toHaveAttribute('data-count', '0');
  await page.evaluate(() => {
    window.__akkuTrackerTest.setScanCopters = undefined;
    const box = document.querySelector('#scan-copter-choices');
    box.dataset.count = '1';
  });
  await expect(page.locator('#scan-copter-choices')).toHaveAttribute('data-count', '1');
});
