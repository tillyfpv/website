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
  await expect(page.locator('.version')).toHaveText('v0.3.11');
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
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.locator('#qr-scanner')).toBeHidden();
  await expect(page.locator('body video')).toHaveCount(0);
  await expect(page.locator('#qr-canvas')).toHaveCount(0);
});
test('duplicate manual scan is rejected and does not open battery detail', async ({ page }) => {
  await clearAppData(page);
  await page.evaluate(() => window.__akkuTrackerTest.recordUse('BAT-001'));
  await expect(page.locator('#scan-result')).toBeVisible();
  await page.evaluate(() => window.__akkuTrackerTest.recordUse('BAT-001'));
  await expect(page.locator('#result-name')).toHaveText('Schon erfasst');
  await expect(page.locator('.success-check')).toHaveCount(0);
  await expect(page.locator('.reject-check')).toHaveCount(1);
  await expect(page.locator('#view-detail')).toBeHidden();
});
