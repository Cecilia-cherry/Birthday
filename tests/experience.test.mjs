import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

let browser;
const baseURL = 'http://localhost:5173';
const artifacts = path.resolve('tests/artifacts');
function test(name, run) {
  nodeTest(name, { timeout: 90000 }, async () => {
    await mkdir('tests/artifacts', { recursive: true });
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    try { await run(); } finally { await browser.close(); }
  });
}
async function start(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, ...options });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseURL);
  await page.locator('.intro').waitFor();
  const skipIntro = page.getByRole('button', { name: /跳过序章/ });
  if (await skipIntro.isVisible()) await skipIntro.click();
  await page.getByRole('button', { name: '进入我们的世界', exact: true }).waitFor();
  return { page, context, errors };
}
async function explore(page) {
  const skipIntro = page.getByRole('button', { name: /跳过序章/ });
  if (await skipIntro.isVisible()) await skipIntro.click();
  await page.getByRole('button', { name: '进入我们的世界', exact: true }).click();
  await page.getByRole('button', { name: '直接探索星球' }).click();
}

test('birthday journey: opening, particle cake, nine planets, letter, replay and music state', async () => {
  const { page, context, errors } = await start();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${artifacts}/desktop-opening.png`, fullPage: true });
  const openingLineStyles = await page.locator('.question-card .message-line').evaluateAll(lines => lines.map(line => { const s = getComputedStyle(line); return [s.color, s.fontFamily, s.fontSize, s.fontWeight, s.letterSpacing, s.textShadow].join('|'); }));
  assert.equal(new Set(openingLineStyles).size, 1, 'opening question lines use one consistent text style');
  assert.equal(await page.locator('.question-card .card-content').evaluate(el => getComputedStyle(el, '::before').content), 'none');
  await page.getByRole('button', { name: '暂时不要', exact: true }).click();
  assert.match(await page.locator('.waiting-title').textContent(), /一直等你/);
  await page.getByRole('button', { name: '返回选择', exact: true }).click();
  await page.getByRole('button', { name: '开启音乐' }).click();
  await page.getByRole('button', { name: '关闭音乐' }).waitFor();
  await page.waitForFunction(() => Number(document.body.dataset.musicTime) > .15);
  assert.equal(await page.locator('body').getAttribute('data-music-state'), 'playing', 'the repaired BGM decodes and its playback time advances');
  await page.getByRole('button', { name: '关闭音乐' }).click();
  await page.getByRole('button', { name: '进入我们的世界', exact: true }).click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${artifacts}/desktop-cake.png`, fullPage: true });
  assert.ok(Number(await page.locator('#starfield').getAttribute('data-cake-stars')) >= 96, 'small stars surround the 3D cake');
  assert.equal(await page.locator('#starfield').getAttribute('data-cake-star-coverage'), 'screen', 'the floating cake-star layer spans the screen');
  assert.equal(await page.locator('#starfield').getAttribute('data-cake-star-depth'), 'far-middle-near', 'the star field has explicit foreground, middle and distant layers');
  assert.equal(await page.locator('.story-line').first().evaluate(el => Number(getComputedStyle(el).opacity)), 0);
  await page.mouse.wheel(0, 60);
  await page.waitForTimeout(180);
  const revealed = await page.locator('.story-line').first().evaluate(el => Number(getComputedStyle(el).opacity));
  assert.ok(revealed > 0 && revealed < 1, 'cake-screen copy follows the scroll gesture');
  assert.equal(await page.locator('.cake-screen').count(), 1, 'one small gesture does not skip the particle transition');
  await page.mouse.move(1320, 120); await page.waitForTimeout(320);
  await page.screenshot({ path: `${artifacts}/desktop-cake-upper-angle.png`, fullPage: true });
  const upperFloat = Number(await page.locator('#starfield').getAttribute('data-cake-float'));
  const rightAngle = Number(await page.locator('#starfield').getAttribute('data-cake-yaw'));
  const upperAngle = Number(await page.locator('#starfield').getAttribute('data-cake-pitch'));
  await page.mouse.move(120, 840, { steps: 5 }); await page.waitForTimeout(480);
  await page.screenshot({ path: `${artifacts}/desktop-cake-lower-angle.png`, fullPage: true });
  const lowerFloat = Number(await page.locator('#starfield').getAttribute('data-cake-float'));
  const leftAngle = Number(await page.locator('#starfield').getAttribute('data-cake-yaw'));
  const lowerAngle = Number(await page.locator('#starfield').getAttribute('data-cake-pitch'));
  assert.ok(rightAngle > .15 && leftAngle < -.15 && upperAngle < -.08 && lowerAngle > .08, 'particle cake rotates through 3D viewing angles with the pointer');
  assert.ok(Math.abs(upperFloat - lowerFloat) > 1, 'particle cake keeps a visible floating motion');
  assert.equal(await page.locator('#starfield').getAttribute('data-candle-lit'), 'true', 'the candle finishes its ignition animation before scattering');
  await page.mouse.move(720, 520); await page.waitForTimeout(260);
  const pushed = Number(await page.locator('#starfield').getAttribute('data-repelled'));
  assert.ok(pushed > 10, 'nearby particles are pushed away by the pointer');
  await page.mouse.move(30, 30); await page.waitForTimeout(1300);
  assert.ok(Number(await page.locator('#starfield').getAttribute('data-repelled')) < pushed, 'repelled particles spring back toward the cake');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelector('#starfield')?.dataset.candleState === 'off');
  assert.equal(await page.locator('#starfield').getAttribute('data-candle-lit'), 'false');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelector('#starfield')?.dataset.candleState === 'lit');
  await page.getByRole('button', { name: '点击粒子蛋糕，让星尘炸开后重新聚合' }).click();
  await page.waitForFunction(() => document.querySelector('#starfield')?.dataset.firework === 'true');
  await page.waitForTimeout(280); await page.screenshot({ path: `${artifacts}/desktop-cake-firework.png`, fullPage: true });
  assert.equal(await page.locator('.cake-screen').count(), 1, 'clicking creates a firework without leaving the cake screen');
  await page.waitForFunction(() => document.querySelector('#starfield')?.dataset.firework === 'false');
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 120);
  await page.locator('.universe').waitFor();
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('.universe').getAttribute('data-transition-ms'), '1800', 'the expanded universe uses a 1.8 second eased transition');
  assert.equal(await page.locator('.universe .section-heading').evaluate(el => getComputedStyle(el).display), 'none');
  assert.equal(await page.locator('.header .brand > span').evaluate(el => getComputedStyle(el).display), 'none');
  assert.equal(await page.locator('.footer').evaluate(el => getComputedStyle(el).display), 'none');
  assert.equal(await page.locator('.journey-bar p').evaluate(el => getComputedStyle(el).display), 'none', 'third-screen prose is visually removed');
  assert.equal(await page.locator('.universe-memory-preview').count(), 9, 'each planet has a paired photo preview');
  assert.equal(await page.locator('.planet-stop').count(), 9, 'the requested nine city planets are present');
  assert.equal(await page.locator('.universe').getAttribute('data-planet-spacing'), 'desktop-380-mobile-320');
  assert.equal(await page.locator('.universe').getAttribute('data-pointer-scale-range'), '1.00');
  assert.equal(await page.locator('.universe').getAttribute('data-camera-scale-range'), '0.32-1.55');
  assert.deepEqual(new Set(await page.locator('.universe-memory-preview').evaluateAll(items => items.map(item => item.dataset.depth))), new Set(['near', 'middle', 'far']));
  assert.deepEqual(new Set(await page.locator('.planet-stop').evaluateAll(items => items.map(item => item.dataset.depth))), new Set(['near', 'middle', 'far']));
  assert.equal(await page.locator('#starfield').getAttribute('data-universe-orbit'), 'true', 'outer cake particles continue orbiting in the expanded universe');
  assert.ok(Number(await page.locator('#starfield').getAttribute('data-universe-particles')) > 250);
  assert.equal(await page.locator('.universe').getAttribute('data-travel-mode'), 'first-person-free');
  assert.equal(await page.locator('.universe').getAttribute('data-wheel-sensitivity'), '0.0014', 'wheel navigation uses a deliberately low continuous sensitivity');
  assert.equal(await page.locator('.universe-depth-object').count(), 18, 'foreground space objects fill the first-person view');
  assert.deepEqual(new Set(await page.locator('.universe-depth-object').evaluateAll(items => items.map(item => item.dataset.depth))), new Set(['near', 'middle', 'far']));
  const stage = await page.locator('.universe-stage').boundingBox();
  await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height * .45); await page.waitForTimeout(750);
  assert.equal(await page.locator('.universe').getAttribute('data-universe-index'), '0');
  const initialPlanetBox = await page.locator('.planet-stop.is-current').boundingBox();
  assert.ok(Math.abs(initialPlanetBox.x + initialPlanetBox.width / 2 - (stage.x + stage.width / 2)) > 40, 'the active planet keeps its world position instead of being forced to screen center');
  await page.mouse.move(stage.x + 20, stage.y + stage.height * .3); await page.waitForTimeout(180);
  const leftView = await page.locator('.planet-stop.is-current .travel-planet').evaluate(el => getComputedStyle(el).transform);
  const leftPlanetBox = await page.locator('.planet-stop.is-current').boundingBox();
  const leftPointerScale = Number(await page.locator('.planet-stop.is-current').getAttribute('data-pointer-scale'));
  await page.mouse.move(stage.x + stage.width - 20, stage.y + stage.height * .62); await page.waitForTimeout(180);
  const rightView = await page.locator('.planet-stop.is-current .travel-planet').evaluate(el => getComputedStyle(el).transform);
  const rightPlanetBox = await page.locator('.planet-stop.is-current').boundingBox();
  const rightPointerScale = Number(await page.locator('.planet-stop.is-current').getAttribute('data-pointer-scale'));
  assert.notEqual(leftView, rightView, 'pointer movement changes the planet viewing angle');
  assert.ok(Math.abs((leftPlanetBox.x + leftPlanetBox.width / 2) - (rightPlanetBox.x + rightPlanetBox.width / 2)) > 100, 'pointer movement has a wide spatial viewing range');
  assert.ok(leftPlanetBox.x > stage.x + stage.width * .08, 'the active planet stays away from the left screen edge');
  assert.ok(rightPlanetBox.x + rightPlanetBox.width < stage.x + stage.width * .92, 'the active planet stays away from the right screen edge');
  assert.equal(leftPointerScale, 1, 'pointer movement does not change planet scale');
  assert.equal(rightPointerScale, 1, 'pointer movement keeps planet scale fixed');
  assert.ok(Math.abs(leftPlanetBox.width - rightPlanetBox.width) < 1, 'planet size stays fixed while only the pointer moves');
  const zhongshanBeforeApproach = await page.locator('.planet-stop').nth(1).boundingBox();
  assert.equal(await page.locator('.universe-memory-preview.is-current>img').count(), 1, 'each planet shows one cover photo');
  assert.match(await page.locator('.universe-memory-preview.is-current>img').getAttribute('src'), /public\/photos\/xiamen\/01\.jpg/);
  assert.equal(await page.locator('.universe').getAttribute('data-universe-index'), '0', 'looking around does not force navigation');
  await page.mouse.wheel(0, 120); await page.waitForTimeout(320);
  const gentleProgress = Number(await page.locator('.universe').getAttribute('data-universe-progress'));
  assert.ok(gentleProgress > 0 && gentleProgress < .2, 'one wheel tick advances the camera smoothly without jumping');
  assert.equal(await page.locator('.universe').getAttribute('data-universe-index'), '0', 'one wheel tick cannot skip to the next planet');
  await page.mouse.wheel(0, 120); await page.mouse.wheel(0, 120); await page.mouse.wheel(0, 120); await page.waitForTimeout(1600);
  assert.equal(await page.locator('.universe').getAttribute('data-universe-index'), '1', 'continued wheel movement reaches the next planet with eased motion');
  assert.match(await page.locator('.universe-memory-preview.is-current>img').getAttribute('src'), /public\/photos\/zhongshan\/01\.jpg/);
  const zhongshanPlanetBox = await page.locator('.planet-stop.is-current').boundingBox();
  assert.ok(zhongshanPlanetBox.width > zhongshanBeforeApproach.width * 1.3, 'a planet grows continuously as the camera approaches it');
  const zhongshanPhotoBox = await page.locator('.universe-memory-preview.is-current').boundingBox();
  assert.ok(zhongshanPhotoBox.y > stage.y + 30, 'the lowered planet leaves the photo clear of the top edge');
  assert.ok(zhongshanPhotoBox.y + zhongshanPhotoBox.height < zhongshanPlanetBox.y + zhongshanPlanetBox.height * .55, 'the Zhongshan cover photo stays above its planet');
  assert.ok(Math.abs(
    zhongshanPhotoBox.x + zhongshanPhotoBox.width / 2 -
    (zhongshanPlanetBox.x + zhongshanPlanetBox.width / 2)
  ) < 20, 'the cover photo remains horizontally centered above its planet');
  await page.getByRole('button', { name: '显示上海星球' }).click();
  await page.waitForTimeout(2100);
  assert.match(await page.locator('.universe-memory-preview.is-current>img').getAttribute('src'), /public\/photos\/shanghai\/01\.jpg/);
  const shanghaiPlanetBox = await page.locator('.planet-stop.is-current').boundingBox();
  const shanghaiPhotoBox = await page.locator('.universe-memory-preview.is-current').boundingBox();
  assert.ok(shanghaiPhotoBox.y + shanghaiPhotoBox.height < shanghaiPlanetBox.y + shanghaiPlanetBox.height * .55, 'the Shanghai cover photo stays above its planet');
  assert.ok(Math.abs(
    shanghaiPhotoBox.x + shanghaiPhotoBox.width / 2 -
    (shanghaiPlanetBox.x + shanghaiPlanetBox.width / 2)
  ) < 20, 'the Shanghai cover is bound to the same horizontal position as its planet');
  await page.getByRole('button', { name: '显示珠海星球' }).click();
  assert.equal(await page.locator('.universe').getAttribute('data-photo-state'), 'hidden', 'a planet photo starts hidden');
  await page.waitForTimeout(2100);
  assert.equal(await page.locator('.universe').getAttribute('data-photo-state'), 'revealed', 'the photo appears after the planet enters view');
  assert.match(await page.locator('.universe-memory-preview.is-current').textContent(), /珠海/);
  const nearWidth = (await page.locator('.planet-stop').nth(4).boundingBox()).width;
  const farWidth = (await page.locator('.planet-stop').nth(0).boundingBox()).width;
  assert.ok(nearWidth > farWidth * 1.5, 'planet size changes with simulated depth');
  await page.getByRole('button', { name: '显示嘉兴星球' }).click();
  assert.equal(await page.locator('.universe').getAttribute('data-photo-state'), 'hidden');
  await page.waitForTimeout(1900);
  const activePlanetBox = await page.locator('.planet-stop.is-current').boundingBox();
  const activePhotoBox = await page.locator('.universe-memory-preview.is-current').boundingBox();
  assert.ok(activePhotoBox.y + activePhotoBox.height < activePlanetBox.y + activePlanetBox.height * .55, 'the animated photo appears above the active planet');
  assert.match(await page.locator('.universe-memory-preview.is-current > :first-child').evaluate(el => getComputedStyle(el).animationName), /universe-photo-materialize/);
  await page.screenshot({ path: `${artifacts}/desktop-universe.png`, fullPage: true });
  await page.getByRole('button', { name: '星光的尽头，有一封给你的信' }).click();
  assert.match(await page.locator('#toast').textContent(), /滑到最后一颗星球/);
  assert.equal(await page.locator('.planet-stop.visited').count(), 0, 'the letter does not require visiting planets');
  await page.getByRole('button', { name: '显示泉州星球' }).click();
  await page.locator('.birthday-letter').waitFor({ timeout: 7000 });
  assert.equal(await page.locator('.planet-stop').count(), 0, 'reaching the final planet opens the letter automatically');
  assert.equal(await page.locator('.letter-screen').getAttribute('data-letter-animation'), 'envelope-open');
  assert.match(await page.locator('.opening-envelope-flap').evaluate(el => getComputedStyle(el).animationName), /opening-flap/);
  assert.match(await page.locator('.birthday-letter').evaluate(el => getComputedStyle(el).animationName), /letter-card-unfold/);
  await page.waitForTimeout(3000);
  assert.match(await page.locator('.letter-content').textContent(), /地图上还有很多空白，想和你一起慢慢填满。/);
  await page.screenshot({ path: `${artifacts}/desktop-letter.png`, fullPage: true });
  await page.getByRole('button', { name: '返回我们的宇宙' }).click();
  await page.getByRole('button', { name: '显示厦门星球' }).click();
  await page.waitForTimeout(2200);
  const expectedPhotoCounts = { '厦门': 7, '中山': 5, '珠海': 4, '湖州': 6, '上海': 9, '嘉兴': 5, '漳州': 5, '福州': 5, '泉州': 6 };
  for (const city of ['厦门', '中山', '珠海', '湖州', '上海', '嘉兴', '漳州', '福州', '泉州']) {
    await page.getByRole('button', { name: `显示${city}星球` }).click();
    await page.waitForTimeout(750);
    await page.getByRole('button', { name: new RegExp(`探索${city}，`) }).click();
    assert.equal(await page.locator('.memory-info h2').textContent(), city);
    assert.equal(await page.locator('.photo-dots button').count(), expectedPhotoCounts[city], `${city} exposes every saved browser photo`);
    if (city === '厦门') {
      assert.equal(await page.locator('.memory-date').textContent(), '2022年11月');
      assert.equal(await page.locator('.memory-info h3').textContent(), '第一次一起看海');
      await page.screenshot({ path: `${artifacts}/desktop-memory.png`, fullPage: true });
    }
    await page.keyboard.press('Escape');
  }
  assert.equal(await page.locator('.planet-stop.visited').count(), 9);
  await page.getByRole('button', { name: '重播开场动画' }).click();
  await page.getByRole('button', { name: /跳过序章/ }).click();
  await page.getByRole('button', { name: '进入我们的世界', exact: true }).click();
  await page.locator('.cake-screen').waitFor();
  await page.waitForFunction(() => document.querySelector('#starfield')?.dataset.candleLit === 'true');
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 120);
  await page.locator('.universe').waitFor();
  assert.deepEqual(errors, []);
  await context.close();
});

test('compressed photos, selected cover and text persist; standalone gift opens and re-exports offline', async () => {
  const { page, context, errors } = await start();
  await page.getByRole('button', { name: '编辑旅行回忆' }).click();
  while (await page.locator('.remove-photo').count()) await page.locator('.remove-photo').last().click();
  const fixture = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 2400; canvas.height = 1600;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#34536a'; ctx.fillRect(0, 0, 2400, 1600);
    ctx.fillStyle = '#c6acb7'; ctx.fillRect(800, 300, 800, 900); return canvas.toDataURL('image/png').split(',')[1];
  });
  const buffer = Buffer.from(fixture, 'base64');
  await page.locator('[name="photos"]').setInputFiles([{ name: 'one.png', mimeType: 'image/png', buffer }, { name: 'two.png', mimeType: 'image/png', buffer }]);
  await page.locator('.upload-thumb').nth(1).waitFor();
  await page.getByRole('button', { name: '将第 2 张照片设为封面' }).click();
  await page.locator('[name="memory"]').fill('海风和你，都想记很久。\n测试字符 < > & " 保持原样。');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(), 1);
  assert.match(await page.locator('.dialog-toast').textContent(), /未保存/);
  await page.getByRole('button', { name: '保存这段回忆' }).click();
  await page.locator('.save-state').filter({ hasText: '已保存' }).waitFor();
  const dimensions = await page.locator('.cover-select img').first().evaluate(img => ({ width: img.naturalWidth, height: img.naturalHeight, src: img.src.slice(0, 23) }));
  assert.equal(dimensions.width, 1800); assert.equal(dimensions.height, 1200); assert.match(dimensions.src, /data:image\/webp/);
  await page.reload();
  await explore(page);
  await page.getByRole('button', { name: /探索厦门，/ }).click();
  assert.match(await page.locator('.photo-counter').textContent(), /02.*02/);
  assert.match(await page.locator('.memory-text').textContent(), /测试字符 < > & "/);
  await page.keyboard.press('ArrowRight');
  assert.match(await page.locator('.photo-counter').textContent(), /01.*02/);
  await page.keyboard.press('ArrowLeft');
  assert.match(await page.locator('.photo-counter').textContent(), /02.*02/);
  await page.getByRole('button', { name: '编辑这段回忆' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出礼物网页', exact: true }).click();
  const download = await downloadPromise;
  const giftPath = `${artifacts}/test-gift.html`; await download.saveAs(giftPath);
  const exported = await readFile(giftPath, 'utf8'); assert.match(exported, /window.__UNIVERSE_DATA__/); assert.ok(exported.length > 20000);
  const offline = await browser.newContext({ offline: true, viewport: { width: 1440, height: 960 } });
  const gift = await offline.newPage(); const giftErrors = []; gift.on('pageerror', e => giftErrors.push(e.message));
  await gift.goto(pathToFileURL(giftPath).href);
  await explore(gift);
  await gift.getByRole('button', { name: /探索厦门，/ }).click();
  assert.match(await gift.locator('.photo-counter').textContent(), /02.*02/);
  assert.match(await gift.locator('.memory-text').textContent(), /海风和你/);
  assert.ok(await gift.locator('.memory-photo').evaluate(img => img.complete && img.naturalWidth === 1800));
  await gift.getByRole('button', { name: '编辑这段回忆' }).click();
  await gift.locator('[name="headline"]').fill('导出后继续写下回忆');
  await gift.getByRole('button', { name: '保存这段回忆' }).click();
  await gift.locator('.save-state').filter({ hasText: '已保存' }).waitFor();
  const againPromise = gift.waitForEvent('download');
  await gift.getByRole('button', { name: '导出礼物网页', exact: true }).click();
  const again = await againPromise; const secondPath = `${artifacts}/test-gift-again.html`; await again.saveAs(secondPath);
  const secondPage = await offline.newPage(); await secondPage.goto(pathToFileURL(secondPath).href); await explore(secondPage);
  await secondPage.getByRole('button', { name: /探索厦门，/ }).click();
  assert.equal(await secondPage.locator('.memory-info h3').textContent(), '导出后继续写下回忆');
  assert.deepEqual(errors, []); assert.deepEqual(giftErrors, []);
  await offline.close(); await context.close();
});

test('mobile: no horizontal overflow, touch cake, swipe photos and accessible dialogs', async () => {
  const { page, context, errors } = await start({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  await page.screenshot({ path: `${artifacts}/mobile-opening.png`, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole('button', { name: '进入我们的世界', exact: true }).tap();
  await page.getByRole('button', { name: '点击粒子蛋糕，让星尘炸开后重新聚合' }).tap();
  assert.equal(await page.locator('.cake-screen').count(), 1);
  await page.getByRole('button', { name: '直接探索星球' }).tap();
  await page.locator('.universe').waitFor();
  await page.screenshot({ path: `${artifacts}/mobile-universe.png`, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole('button', { name: /探索厦门，/ }).tap();
  await page.screenshot({ path: `${artifacts}/mobile-memory.png`, fullPage: true });
  await page.getByRole('button', { name: '编辑这段回忆' }).tap();
  while (await page.locator('.remove-photo').count()) await page.locator('.remove-photo').last().tap();
  const buffer = Buffer.from(await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 400; return c.toDataURL('image/png').split(',')[1]; }), 'base64');
  await page.locator('[name="photos"]').setInputFiles([{ name: 'a.png', mimeType: 'image/png', buffer }, { name: 'b.png', mimeType: 'image/png', buffer }]);
  await page.locator('.upload-thumb').nth(1).waitFor();
  await page.getByRole('button', { name: '保存这段回忆' }).tap();
  await page.locator('.save-state').filter({ hasText: '已保存' }).waitFor();
  await page.getByRole('button', { name: '关闭编辑', exact: true }).tap();
  await page.getByRole('button', { name: /探索厦门，/ }).tap();
  await page.locator('.photo-panel').evaluate(el => {
    const start = new Touch({ identifier: 1, target: el, clientX: 260, clientY: 200 });
    const end = new Touch({ identifier: 1, target: el, clientX: 90, clientY: 200 });
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start], changedTouches: [start] }));
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [end] }));
  });
  assert.match(await page.locator('.photo-counter').textContent(), /02.*02/);
  await page.keyboard.press('Escape');
  for (const city of ['中山', '珠海', '湖州', '上海', '嘉兴', '漳州', '福州']) {
    await page.getByRole('button', { name: `显示${city}星球` }).tap();
    await page.waitForTimeout(100);
    await page.getByRole('button', { name: new RegExp(`探索${city}，`) }).tap();
    await page.keyboard.press('Escape');
  }
  await page.getByRole('button', { name: '显示泉州星球' }).tap();
  await page.locator('.birthday-letter').waitFor();
  await page.screenshot({ path: `${artifacts}/mobile-letter.png`, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []); await context.close();
});

test('small phone and tablet layouts stay within the viewport', async () => {
  for (const width of [320, 768, 1024]) {
    const { page, context } = await start({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `intro at ${width}`);
    await explore(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `universe at ${width}`);
    for (const box of await page.locator('.planet-stop').evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right }; }))) assert.ok(box.left >= 0 && box.right <= width, `planet at ${width}`);
    await context.close();
  }
});
