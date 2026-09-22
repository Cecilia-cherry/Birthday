import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

test('delivered standalone HTML opens offline with the Xiamen, Shanghai and Zhongshan photos', async () => {
  await import('../scripts/package-gift.mjs');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ offline: true });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve('欢迎进入我们的世界.html')).href);
    await page.getByRole('button', { name: /跳过序章/ }).click();
    await page.getByRole('button', { name: '进入我们的世界', exact: true }).waitFor();
    assert.equal(await page.title(), '欢迎进入我们的世界');
    assert.equal(await page.locator('.intro-card:not([hidden])').count(), 1);
    assert.equal(await page.locator('.memory-card').isVisible(), false);
    const data = await page.evaluate(() => window.__UNIVERSE_DATA__);
    assert.equal(data.places.length, 8);
    assert.deepEqual(data.places.map(place => place.city), ['厦门', '中山', '珠海', '上海', '嘉兴', '漳州', '福州', '泉州']);
    assert.equal(data.places[0].date, '2022年11月');
    assert.equal(data.places[0].headline, '第一次一起看海');
    assert.equal(data.musicTitle, '第57次取消发送');
    assert.equal(data.places[0].photos.length, 7);
    assert.ok(data.places[0].photos.every(photo => /^data:image\/jpeg;base64,/.test(photo)));
    assert.equal(data.places[1].photos.length, 5);
    assert.ok(data.places[1].photos.every(photo => /^data:image\/jpeg;base64,/.test(photo)));
    assert.equal(data.places[2].photos.length, 0);
    assert.equal(data.places[3].photos.length, 9);
    assert.ok(data.places[3].photos.every(photo => /^data:image\/jpeg;base64,/.test(photo)));
    assert.equal(data.places[4].photos.length, 0);
    assert.deepEqual(data.places.slice(5).map(place => place.city), ['漳州', '福州', '泉州']);
    assert.ok(data.places.slice(5).every(place => place.photos.length === 0));
    assert.match(data.music, /^data:audio\/mp4;base64,/);
    assert.deepEqual(errors, []);
    await context.close();
  } finally { await browser.close(); }
});
