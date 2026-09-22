import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

let browser;
function test(name, run) {
  nodeTest(name, { timeout: 90000 }, async () => {
    await mkdir('tests/artifacts', { recursive: true });
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    try { await run(); } finally { await browser.close(); }
  });
}

test('mouse movement reveals each prologue paragraph and waits for an explicit choice', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.clock.install({ time: new Date('2026-09-21T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-21T00:00:01Z'));
  await page.goto('http://localhost:5173');
  await page.locator('.game-intro').waitFor();
  assert.equal(await page.locator('.game-intro').getAttribute('data-stage'), 'stars');
  assert.equal(await page.locator('.intro-card:not([hidden])').count(), 0);
  assert.equal(await page.locator('.question-card [data-action="enter"]').isVisible(), false);
  assert.equal(await page.locator('.question-card [data-action="enter"]').isDisabled(), true);
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.cake-screen').count(), 0);
  await page.screenshot({ path: 'tests/artifacts/prologue-01-stars.png', fullPage: true });
  await page.clock.runFor(7000);
  assert.equal(await page.locator('.game-intro').getAttribute('data-stage'), 'stars');
  assert.equal(await page.locator('.intro-card:not([hidden])').count(), 0, 'text does not autoplay');
  await page.mouse.move(100, 300);
  await page.mouse.move(340, 300, { steps: 6 });
  assert.equal(await page.locator('.game-intro').getAttribute('data-stage'), 'memory');
  assert.equal(await page.locator('.memory-card .card-content').evaluate(el => getComputedStyle(el, '::before').content), 'none');
  const typed = await page.locator('.memory-card .intro-char.revealed').count();
  const total = await page.locator('.memory-card .intro-char').count();
  assert.ok(typed > 0 && typed < total);
  assert.equal(await page.locator('.question-card').isVisible(), false);
  await page.screenshot({ path: 'tests/artifacts/prologue-03-memory.png', fullPage: true });
  await page.mouse.move(820, 300, { steps: 8 });
  assert.equal(await page.locator('.game-intro').getAttribute('data-stage'), 'question');
  assert.equal(await page.locator('.memory-card').isVisible(), false);
  assert.equal(await page.locator('.intro-card:not([hidden])').count(), 1);
  assert.equal(await page.locator('.question-card [data-action="enter"]').isVisible(), false);
  await page.mouse.move(1320, 300, { steps: 8 });
  await page.mouse.move(100, 300, { steps: 10 });
  assert.equal(await page.locator('.game-intro').getAttribute('data-stage'), 'ready');
  assert.equal(await page.locator('.question-card [data-action="enter"]').isEnabled(), true);
  assert.equal(await page.locator('.cake-screen').count(), 0);
  await page.screenshot({ path: 'tests/artifacts/prologue-04-choice.png', fullPage: true });
  await page.locator('.game-intro').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  assert.match(await page.locator('.waiting-title').textContent(), /一直等你/);
  assert.equal(await page.locator('.game-intro').getAttribute('data-stage'), 'waiting');
  assert.equal(await page.locator('.waiting-card .card-content').evaluate(el => getComputedStyle(el, '::before').content), 'none');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.game-intro').getAttribute('data-stage'), 'entering');
  await page.clock.runFor(850);
  await page.locator('.cake-screen').waitFor();
  assert.equal(await page.locator('body').getAttribute('data-intro-stage'), null);
  assert.deepEqual(errors, []);
  await page.close();
});

test('mobile prologue can be skipped and replay starts a new sequence without stale callbacks', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5173');
  await page.locator('.game-intro').waitFor();
  await page.screenshot({ path: 'tests/artifacts/prologue-mobile-memory.png', fullPage: true });
  await page.getByRole('button', { name: /跳过序章/ }).tap();
  assert.equal(await page.locator('.game-intro').getAttribute('data-stage'), 'ready');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'tests/artifacts/prologue-mobile-choice.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole('button', { name: '进入我们的世界', exact: true }).tap();
  await page.locator('.cake-screen').waitFor();
  await page.getByRole('button', { name: '直接探索星球' }).tap();
  await page.getByRole('button', { name: '重播开场动画' }).tap();
  assert.equal(await page.locator('.game-intro').getAttribute('data-stage'), 'stars');
  assert.equal(await page.locator('.intro-card:not([hidden])').count(), 0);
  await page.locator('.game-intro').focus();
  await page.keyboard.press('Space');
  assert.equal(await page.locator('.game-intro').getAttribute('data-stage'), 'ready');
  await page.waitForTimeout(6500);
  assert.equal(await page.locator('.game-intro').getAttribute('data-stage'), 'ready');
  assert.equal(await page.locator('.cake-screen').count(), 0);
  await page.close();
});

test('reduced motion immediately presents the choice while still requiring a click to enter', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
  await page.goto('http://localhost:5173');
  await page.locator('.game-intro').waitFor();
  assert.equal(await page.locator('.game-intro').getAttribute('data-stage'), 'ready');
  assert.equal(await page.getByRole('button', { name: /跳过序章/ }).count(), 0);
  assert.equal(await page.locator('.cake-screen').count(), 0);
  await page.getByRole('button', { name: '进入我们的世界', exact: true }).click();
  await page.locator('.cake-screen').waitFor();
  await page.close();
});
