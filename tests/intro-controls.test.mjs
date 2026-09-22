import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('real mouse clicks reach both opening choices while parallax and star trail are active', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    page.setDefaultTimeout(5000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://localhost:5173');
    await page.getByRole('button', { name: /跳过序章/ }).click();
    await page.waitForTimeout(900);
    for (const action of ['later', 'enter']) {
      const button = page.locator(`.question-card [data-action="${action}"]`);
      const before = await button.boundingBox();
      await page.mouse.move(before.x + 8, before.y + before.height / 2);
      await page.waitForTimeout(750);
      const after = await button.boundingBox();
      assert.ok(Math.abs(before.x-after.x) < .5 && Math.abs(before.y-after.y) < .5, 'button stays still');
      const hits = await button.evaluate(el => {
        const r = el.getBoundingClientRect();
        return [.15, .5, .85].map(t => document.elementFromPoint(r.x+r.width*t, r.y+r.height/2)?.closest('button') === el);
      });
      assert.deepEqual(hits, [true, true, true]);
    }
    await page.mouse.move(500, 350);
    for (let i=0;i<20;i++) { await page.mouse.move(500+i*10, 350+Math.sin(i/5)*45); await page.waitForTimeout(12); }
    assert.equal(await page.locator('.star-cursor').isVisible(), true);
    assert.equal(await page.locator('.cursor-trail').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
    const litPixels = await page.locator('.cursor-trail').evaluate(el => {
      const bytes = el.getContext('2d').getImageData(0,0,el.width,el.height).data;
      let lit = 0; for(let i=3;i<bytes.length;i+=4) if(bytes[i])lit++; return lit;
    });
    assert.ok(litPixels > 20, 'trail has visible particles');
    await mkdir('tests/artifacts', { recursive: true });
    await page.screenshot({ path: 'tests/artifacts/opening-star-trail.png', fullPage: true });
    await page.getByRole('button', { name: '暂时不要', exact: true }).click();
    await page.locator('.waiting-card:not([hidden])').waitFor();
    assert.match(await page.locator('.waiting-title').textContent(), /一直等你/);
    await page.getByRole('button', { name: '返回选择', exact: true }).click();
    await page.getByRole('button', { name: '进入我们的世界', exact: true }).click();
    await page.locator('.cake-screen').waitFor();
    assert.equal(await page.locator('.cursor-trail').count(), 0);
    assert.equal(await page.locator('.star-pointer-enabled').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('phone tap on postpone can continue into the world without replaying the prologue', { timeout: 20000 }, async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    page.setDefaultTimeout(5000);
    await page.goto('http://localhost:5173');
    await page.getByRole('button', { name: '暂时不要', exact: true }).tap();
    await page.locator('.waiting-card:not([hidden])').waitFor();
    await page.screenshot({ path: 'tests/artifacts/mobile-waiting.png', fullPage: true });
    await page.getByRole('button', { name: '准备好了，进入世界', exact: true }).tap();
    await page.locator('.cake-screen').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  } finally { await browser.close(); }
});
