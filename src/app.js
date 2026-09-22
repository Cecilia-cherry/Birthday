import { escapeHTML as esc, daysTogether, loadSaved, saveMemory, compressPhoto, preloadPhotos, MAX_PHOTOS } from './data.js';
import { Space, planetTexture } from './space.js';
import { introCharacters, startIntroSequence } from './intro.js';

const icons = {
  star: '<path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6Z"/>',
  arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
  back: '<path d="M20 12H5m5-5-5 5 5 5"/>',
  mute: '<path d="m11 5-5 4H3v6h3l5 4V5ZM16 9l6 6m0-6-6 6"/>',
  sound: '<path d="m11 5-5 4H3v6h3l5 4V5Zm5 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  replay: '<path d="M3 10a9 9 0 1 1 2 8M3 3v7h7"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  photo: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  letter: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>'
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.star}</svg>`;
const app = document.querySelector('#app');
const space = new Space(document.querySelector('#starfield'));
let config, places, screen = 'intro', currentPlace, photoIndex = 0, audio, editorDirty = false, editorBusy = false;
let visited = new Set(), letterSeen = false, letterUnlocked = false, lastFocused, toastTimer, activeDialog, draft;
let introPlayback;
let cakeJourney = 0;
let universeController, universeFocus = 0;
const textures = {};
function toast(message) {
  let el = document.querySelector('#toast');
  if (activeDialog?.open) {
    el = activeDialog.querySelector('.dialog-toast');
    if (!el) { el = document.createElement('div'); el.className = 'dialog-toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); activeDialog.append(el); }
  }
  el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 4200);
}

function planet(color, cls = '', ring = false) {
  if (!textures[color]) textures[color] = planetTexture(color, color === 'dream' && innerWidth > 760 ? 640 : 420);
  return `<span class="planet ${cls} ${ring ? 'has-rings' : ''}" aria-hidden="true"><span class="planet-ring back-ring"></span><span class="planet-sphere" style="background-image:url('${textures[color]}')"></span><span class="planet-ring front-ring"></span></span>`;
}
function header() {
  const musicTitle = config.musicTitle ? `BGM：${esc(config.musicTitle)}` : '';
  return `<header class="header"><button class="brand" data-action="home" aria-label="回到开场">${icon('star')}<span>OUR LITTLE UNIVERSE<small>${esc(config.title)}</small></span></button><div class="header-actions"><span class="since"><i></i> 始于 2022.11.03</span><span class="header-divider"></span><button class="icon-button music-button" data-action="music" aria-label="${audio && !audio.paused ? '关闭音乐' : config.music ? '开启音乐' : '音乐暂未添加'}" title="${config.music ? (musicTitle || '切换背景音乐') : musicTitle ? `${musicTitle}（待添加音频文件）` : '暂时无背景音乐'}">${icon(audio && !audio.paused ? 'sound' : 'mute')}</button><button class="icon-button" data-action="edit" aria-label="编辑旅行回忆" title="编辑旅行回忆">${icon('edit')}</button></div></header>`;
}
function footer() {
  return `<footer class="footer"><span class="footer-note"><i></i> 两个人 · ${places.length}座城 · 一个宇宙</span><span class="footer-center">MADE OF MEMORIES, MEANT FOR YOU</span><span class="birthday-mark">AUG. 12 <span>✧</span> FOR YOU</span></footer>`;
}
function universeMemoryPreviews() {
  return `<div class="universe-memory-layer" aria-live="polite">${places.map((place, index) => {
    const photos = place.photos || [];
    const cover = Math.min(place.cover || 0, Math.max(0, photos.length - 1));
    const visual = photos.length
      ? `<img src="${esc(photos[cover])}" alt="${esc(place.city)}旅行照片" decoding="async">`
      : `<span class="universe-photo-placeholder"><i>✦</i><strong>${esc(place.city)}</strong><small>等待放入照片</small></span>`;
    return `<article class="universe-memory-preview" data-preview-index="${index}" data-depth="far" aria-hidden="true">${visual}<div class="universe-preview-caption"><span>MEMORY 0${index + 1}</span><strong>${esc(place.city)}</strong><small>${esc(place.headline || '等待写入这颗星球的故事')}</small></div></article>`;
  }).join('')}</div>`;
}
function universeDepthField() {
  const objects = [
    ['orb', 7, 18, 520, 52], ['shard', 18, 72, 310, 31], ['petal', 28, 15, -180, 25],
    ['star', 37, 81, 580, 19], ['orb ringed', 48, 9, -420, 34], ['shard', 58, 24, 210, 22],
    ['petal', 68, 73, 470, 34], ['orb', 81, 16, 120, 42], ['star', 92, 61, 610, 22],
    ['shard', 88, 88, -230, 38], ['petal', 12, 46, -510, 18], ['orb ringed', 23, 91, 390, 30],
    ['star', 74, 43, -350, 14], ['shard', 4, 84, 650, 44], ['petal', 95, 28, 330, 28],
    ['orb', 61, 91, -80, 25], ['star', 43, 30, 360, 12], ['shard', 33, 55, -610, 16]
  ];
  return `<div class="universe-depth-field" aria-hidden="true">${objects.map(([type, x, y, z, size], index) => `<i class="universe-depth-object depth-${type.replace(' ', ' depth-')}" data-x="${x}" data-y="${y}" data-z="${z}" data-phase="${index}" style="--object-size:${size}px"></i>`).join('')}</div>`;
}
function render() {
  introPlayback?.cancel(); introPlayback = null;
  universeController?.cancel(); universeController = null;
  document.body.dataset.screen = screen;
  let content = '';
  if (screen === 'intro') content = `
    <main class="intro game-intro" data-stage="stars" tabindex="-1">
      <div class="intro-art" aria-hidden="true"><div class="intro-nebula"></div><div class="intro-light-shaft"></div><div class="intro-depth-plane"></div><div class="intro-foreground-dust"></div><div class="hero-orbit orbit-one"></div><div class="hero-orbit orbit-two"></div><div class="hero-orbit orbit-three"></div><div class="orbit-satellite"></div>${planet('dream', 'hero-planet', true)}${planet('peach', 'small-peach')}${planet('blue', 'small-blue')}<span class="art-star">✧</span></div>
      <div class="intro-vignette" aria-hidden="true"></div>
      <canvas class="cursor-trail" aria-hidden="true"></canvas><span class="star-cursor" aria-hidden="true">✦</span>
      <section class="intro-copy intro-stage" aria-label="生日序章">
        <article class="intro-card memory-card" data-card="memory" hidden aria-hidden="true">
          <div class="card-content"><span class="card-spark" aria-hidden="true">✧</span><h2 class="handwritten-message" aria-label="检测到一段属于我们的时空记忆。"><span class="message-line">${introCharacters('检测到一段属于')}</span><span class="message-line">${introCharacters('我们的时空记忆。')}</span></h2></div>
        </article>
        <article class="intro-card question-card" data-card="question" hidden aria-hidden="true">
          <div class="card-content intro-decision" inert aria-hidden="true">
            <span class="card-spark" aria-hidden="true">✧</span>
            <h2 class="intro-question handwritten-message" id="intro-question" aria-label="是否进入我们的世界？"><span class="message-line">${introCharacters('是否进入')}</span><span class="message-line">${introCharacters('我们的世界？')}</span></h2>
            <div class="entry-actions" role="group" aria-labelledby="intro-question" inert>
              <button class="button primary" data-action="enter" disabled><span class="choice-marker" aria-hidden="true">▹</span><span class="choice-copy">进入我们的世界</span>${icon('arrow')}</button>
              <button class="button quiet" data-action="later" disabled><span class="choice-marker" aria-hidden="true">▹</span>暂时不要</button>
            </div>
            <p class="later-message" role="status"></p>
          </div>
        </article>
        <article class="intro-card waiting-card" data-card="waiting" hidden aria-hidden="true">
          <div class="card-content"><span class="card-spark" aria-hidden="true">✧</span>
            <h2 class="handwritten-message waiting-title" tabindex="-1">没关系，<br><span>我们的宇宙会一直等你。</span></h2>
            <p class="waiting-note">等你准备好，我们再一起出发。</p>
            <div class="entry-actions waiting-actions"><button class="button primary" data-action="enter"><span class="choice-copy">准备好了，进入世界</span>${icon('arrow')}</button><button class="button quiet" data-action="back-to-choice">返回选择</button></div>
          </div>
        </article>
        <p class="intro-live sr-only" role="status" aria-live="polite" aria-atomic="true"></p>
      </section>
      <div class="intro-bottom"><div class="chapter-lights" aria-hidden="true"><i data-chapter="memory"></i><i data-chapter="question"></i></div><span class="gesture-hint">滑动鼠标，唤醒文字</span><button class="skip-intro" data-action="skip-intro">跳过序章 <span aria-hidden="true">SPACE ${icon('chevron')}</span></button><span class="await-choice"><i></i> 故事的下一页，由你开启</span></div>
    </main>`;
  if (screen === 'cake') content = `<main class="cake-screen screen-in" data-journey="0"><div class="section-heading scroll-reveal" aria-label="今天，宇宙为你亮起。8 月 12 日，生日快乐"><span class="eyebrow story-line" aria-hidden="true">A LITTLE WISH, JUST FOR YOU</span><h1 class="story-line" aria-hidden="true">今天，宇宙为你亮起。</h1><p class="story-line" aria-hidden="true">8 月 12 日 · 生日快乐</p></div><button class="cake-touch" data-action="firework" aria-label="点击粒子蛋糕，让星尘炸开后重新聚合"></button><div class="cake-prompt"><span class="tiny-spark">✧</span><p>移动鼠标，推开星尘，从不同角度看看蛋糕</p><small>点击烟花 · 空格吹灭/点燃蜡烛 · 滚动进入照片宇宙</small><span class="journey-progress" aria-hidden="true"><i></i></span><button class="text-button" data-action="skip">直接探索星球 ${icon('arrow')}</button></div></main>`;
  if (screen === 'universe') content = `<main class="universe universe-expanded universe-explorer screen-in" data-transition-ms="1800" data-universe-index="${universeFocus}" data-letter-unlocked="${letterUnlocked}"><div class="section-heading"><span class="eyebrow">BIRTHDAY UNIVERSE · MOVE TO EXPLORE</span><h1>把蛋糕，变成一整个宇宙。</h1><p>移动鼠标或左右滑动，沿着星轨遇见每一颗回忆星球。</p></div><div class="planet-system universe-stage" aria-label="移动鼠标或滑动，探索${places.length}颗回忆星球">${universeDepthField()}<svg class="orbit-map" viewBox="0 0 1200 530" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="600" cy="275" rx="505" ry="144" transform="rotate(-13 600 275)"/><ellipse cx="600" cy="275" rx="366" ry="203" transform="rotate(17 600 275)"/><ellipse cx="600" cy="275" rx="180" ry="245" transform="rotate(48 600 275)"/><path d="M90 425 1110 135" stroke-dasharray="2 12"/></svg><div class="system-sun" aria-hidden="true">✧</div>${universeMemoryPreviews()}${places.map((p, i) => `<button class="planet-stop universe-planet stop-${i} ${visited.has(p.id) ? 'visited' : ''}" data-index="${i}" data-depth="far" data-place="${p.id}" aria-label="探索${esc(p.city)}，${esc(p.planet)}${visited.has(p.id) ? '，已点亮' : ''}">${planet(p.color, 'travel-planet', i % 3 === 1)}<span class="planet-label"><span class="planet-number">${String(i + 1).padStart(2, '0')} <span>${visited.has(p.id) ? '✦' : '·'}</span></span><strong>${esc(p.city)}</strong><small>${esc(p.planet)}</small><span class="planet-discover">${visited.has(p.id) ? '重温这段回忆' : '点击探索'} ${icon('arrow')}</span></span></button>`).join('')}<span class="map-coordinate coord-left">CAKE PARTICLES · BIRTHDAY ORBIT<br>EST. NOVEMBER 2022</span><span class="map-coordinate coord-right">MOVE HORIZONTALLY<br>DEPTH CHANGES WITH YOU</span></div><div class="universe-explorer-controls"><span><i></i> 移动鼠标 / 左右滑动，推动宇宙</span><div class="universe-index" role="group" aria-label="选择回忆星球">${places.map((p, i) => `<button data-universe-index="${i}" aria-label="显示${esc(p.city)}星球" class="${i === universeFocus ? 'active' : ''}"><i></i><small>${String(i + 1).padStart(2, '0')}</small></button>`).join('')}</div><strong class="universe-focus-name">${esc(places[universeFocus]?.city || places[0].city)}</strong></div><div class="journey-bar"><div><span class="progress-stars">${places.map(p => `<i class="${visited.has(p.id) ? 'lit' : ''}">✦</i>`).join('')}</span><p>已点亮 <strong>${visited.size}</strong> / ${places.length} 颗回忆星球</p></div><button class="letter-link ${letterUnlocked ? 'unlocked' : ''}" data-action="letter" aria-label="${letterUnlocked ? '有一封信，想交给你' : '星光的尽头，有一封给你的信'}">${icon(letterUnlocked ? 'letter' : 'lock')}<span>${letterUnlocked ? '有一封信，想交给你' : '星光的尽头，有一封给你的信'}</span>${icon('arrow')}</button></div><button class="replay-button text-button" data-action="replay" aria-label="重播开场动画">${icon('replay')} 重播开场动画</button></main>`;
  if (screen === 'gather') content = `<main class="gather-screen screen-in"><span class="eyebrow">ALL THE STARS LEAD TO YOU</span><h1>每一颗星，都在说着同一句话。</h1></main>`;
  if (screen === 'letter') content = `<main class="letter-screen screen-in" data-letter-animation="envelope-open"><div class="letter-opening" aria-hidden="true"><div class="opening-envelope"><i class="opening-paper"><span>✧</span></i><i class="opening-envelope-back"></i><i class="opening-envelope-flap"></i><i class="opening-envelope-front"></i></div><span class="opening-glow"></span></div><span class="eyebrow">THE NEXT CHAPTER IS STILL OURS</span><article class="birthday-letter"><div class="letter-topline"><span>TO MY LOVE</span><span>08 / 12</span></div><div class="letter-emblem">${icon('star')}</div><p class="letter-salutation">亲爱的，</p><div class="letter-content">${config.letter.map((line, i) => `<p class="letter-line line-${i}">${esc(line)}</p>`).join('')}</div><div class="letter-signature"><span>未完待续的，是我们。</span><small>WITH YOU, ALWAYS.</small></div><div class="letter-stamp">${icon('star')}<span>OUR<br>UNIVERSE</span></div></article><p class="together-count">从 2022 年 11 月 3 日，到有你的每一天。<span>我们已经一起走过 <strong>${daysTogether(config.togetherSince).toLocaleString()}</strong> 天</span></p><button class="button outlined" data-action="universe">${icon('back')} 返回我们的宇宙</button></main>`;
  app.innerHTML = `${header()}${content}${footer()}<div id="modal-root"></div>`;
  if (screen === 'intro') introPlayback = startIntroSequence(app.querySelector('.intro'), enter);
  if (screen === 'cake') applyCakeJourney();
  if (screen === 'universe') requestAnimationFrame(() => { if (screen === 'universe') universeController = bindUniverseExplorer(); });
  if (screen !== 'intro') requestAnimationFrame(() => { const heading = app.querySelector('main h1, main article'); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); } });
}
function bindUniverseExplorer() {
  const root = document.querySelector('.universe-explorer');
  const stage = root?.querySelector('.universe-stage');
  if (!root || !stage) return null;
  const planets = [...stage.querySelectorAll('.universe-planet')];
  const previews = [...stage.querySelectorAll('.universe-memory-preview')];
  const depthObjects = [...stage.querySelectorAll('.universe-depth-object')];
  const dots = [...root.querySelectorAll('[data-universe-index]')];
  const name = root.querySelector('.universe-focus-name');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const events = new AbortController();
  let current = Math.max(0, Math.min(places.length - 1, universeFocus));
  let target = current, frame = 0, touchStart = null, cancelled = false, activeIndex = -1, previousTime = 0;
  let lookX = 0, lookY = 0, photoRevealTimer = 0, letterRevealTimer = 0;
  const navigationReadyAt = performance.now() + (reduced ? 180 : 1600);

  root.dataset.travelMode = 'first-person-free';
  root.dataset.wheelSensitivity = '0.0014';
  root.dataset.depthLayers = 'foreground-middle-distance';
  root.dataset.planetSpacing = 'desktop-380-mobile-320';
  root.dataset.pointerScaleRange = '1.00';
  root.dataset.cameraScaleRange = '0.32-1.55';

  function depthName(distance) { return distance < .62 ? 'near' : distance < 1.55 ? 'middle' : 'far'; }
  function updateLetterLink() {
    root.dataset.letterUnlocked = String(letterUnlocked);
    const button = root.querySelector('.letter-link');
    if (!button) return;
    button.classList.toggle('unlocked', letterUnlocked);
    button.setAttribute('aria-label', letterUnlocked ? '有一封信，想交给你' : '星光的尽头，有一封给你的信');
    button.innerHTML = `${icon(letterUnlocked ? 'letter' : 'lock')}<span>${letterUnlocked ? '有一封信，想交给你' : '星光的尽头，有一封给你的信'}</span>${icon('arrow')}`;
  }
  function updateActive(index) {
    if (index === activeIndex) return;
    activeIndex = index; universeFocus = index;
    clearTimeout(letterRevealTimer);
    if (index === places.length - 1) {
      letterUnlocked = true; updateLetterLink();
      letterRevealTimer = setTimeout(() => {
        if (!cancelled && screen === 'universe' && activeIndex === places.length - 1 && !activeDialog && !letterSeen) showLetter();
      }, reduced ? 320 : 1150);
    }
    root.dataset.universeIndex = String(index);
    planets.forEach((planet, i) => { planet.classList.toggle('is-current', i === index); planet.setAttribute('aria-current', String(i === index)); });
    clearTimeout(photoRevealTimer);
    root.dataset.photoState = 'hidden';
    previews.forEach(preview => { preview.classList.remove('is-current'); preview.setAttribute('aria-hidden', 'true'); });
    photoRevealTimer = setTimeout(() => {
      if (cancelled || activeIndex !== index) return;
      const preview = previews[index];
      preview?.classList.add('is-current'); preview?.setAttribute('aria-hidden', 'false');
      root.dataset.photoState = 'revealed';
      apply(current);
    }, reduced ? 60 : 520);
    dots.forEach((dot, i) => { dot.classList.toggle('active', i === index); dot.setAttribute('aria-pressed', String(i === index)); });
    if (name) name.textContent = places[index]?.city || '';
  }
  function apply(value) {
    if (cancelled || !root.isConnected) return;
    const width = stage.clientWidth || innerWidth, mobile = width < 620;
    const height = stage.clientHeight || innerHeight;
    const worldX = mobile
      ? [-.16, .17, -.14, .18, -.17, .14, -.12, .16, -.15]
      : [-.23, .21, -.19, .24, -.22, .18, -.16, .22, -.2];
    const worldY = mobile
      ? [.2, .08, .26, .12, .23, .06, .17, .28, .1]
      : [.22, .07, .28, .14, .24, .08, .18, .3, .1];
    const zSpacing = mobile ? 320 : 380;
    updateActive(Math.max(0, Math.min(places.length - 1, Math.round(value))));
    root.dataset.universeProgress = value.toFixed(3);
    root.style.setProperty('--camera-x', lookX.toFixed(3));
    root.style.setProperty('--camera-y', lookY.toFixed(3));
    space.setUniverseView?.(value, lookX, lookY);
    planets.forEach((planet, index) => {
      const distance = index - value, absolute = Math.abs(distance);
      const z = distance < -1.05 ? -760 : 260 - distance * zSpacing;
      const parallax = (mobile ? 24 : 54) + Math.max(0, z) * (mobile ? .08 : .18);
      const x = worldX[index] * width - lookX * parallax;
      const y = worldY[index] * height - lookY * ((mobile ? 20 : 38) + Math.max(0, z) * (mobile ? .05 : .1));
      const pointerScale = 1;
      const cameraScale = Math.max(.32, Math.min(1.55, 1.18 - distance * .36));
      const scale = distance < -1.05 ? .18 : Math.max(.24, Math.min(1.95, cameraScale * pointerScale));
      const opacity = distance < -1.05 ? 0 : Math.max(.13, 1 - Math.max(0, distance - .25) * .19 - Math.max(0, -distance) * .72);
      planet.style.left = '50%'; planet.style.top = '50%';
      planet.style.transform = `translate(-50%,-50%) translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${Math.round(z)}px) scale(${scale.toFixed(3)})`;
      planet.style.opacity = String(opacity);
      planet.style.zIndex = String(48 - Math.round(distance * 4));
      planet.style.filter = `blur(${Math.max(0, absolute - .48) * .72}px) saturate(${Math.max(.58, 1 - absolute * .09)})`;
      planet.style.pointerEvents = index === activeIndex ? 'auto' : 'none';
      planet.dataset.pointerScale = pointerScale.toFixed(3);
      planet.dataset.cameraScale = cameraScale.toFixed(3);
      const globe = planet.querySelector('.travel-planet');
      if (globe) {
        globe.style.setProperty('--globe-look-x', lookX.toFixed(3));
        globe.style.setProperty('--globe-look-y', lookY.toFixed(3));
        globe.style.setProperty('--globe-light-x', `${(31 + lookX * 12).toFixed(2)}%`);
        globe.style.setProperty('--globe-light-y', `${(27 + lookY * 9).toFixed(2)}%`);
        globe.style.setProperty('--globe-light-angle', `${(112 + lookX * 8).toFixed(2)}deg`);
        globe.style.transform = `rotateX(${(-lookY * 7).toFixed(2)}deg) rotateY(${(lookX * 10).toFixed(2)}deg)`;
        const sphere = globe.querySelector('.planet-sphere');
        if (sphere) sphere.style.backgroundPosition = `${(50 + lookX * 13).toFixed(1)}% ${(50 + lookY * 8).toFixed(1)}%`;
      }
      planet.dataset.depth = depthName(absolute);
    });
    previews.forEach((preview, index) => {
      const distance = index - value, absolute = Math.abs(distance);
      const hasFan = preview.classList.contains('has-photo-fan');
      const z = hasFan ? 0 : distance < -1.05 ? -760 : 260 - distance * zSpacing;
      const photoParallax = hasFan ? (mobile ? 12 : 24) : (mobile ? 24 : 54) + Math.max(0, z) * (mobile ? .08 : .18);
      const x = hasFan ? -lookX * photoParallax : worldX[index] * width - lookX * photoParallax;
      const y = hasFan ? (mobile ? -132 : -155) - lookY * (mobile ? 12 : 20) : worldY[index] * height - (mobile ? 165 : 190) - lookY * ((mobile ? 20 : 38) + Math.max(0, z) * (mobile ? .05 : .1));
      const scale = hasFan ? 1 : Math.max(.28, Math.min(1.16, (mobile ? .96 : 1.08) - distance * .26));
      const visible = index === activeIndex && preview.classList.contains('is-current');
      preview.style.left = '50%'; preview.style.top = '50%';
      preview.style.transform = `translate(-50%,-50%) translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${Math.round(z)}px) rotateX(${(-lookY * 4).toFixed(2)}deg) rotateY(${(lookX * 6).toFixed(2)}deg) rotate(${(index % 2 ? 2 : -3).toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      preview.style.opacity = visible ? '1' : '0';
      preview.style.zIndex = String(62 - Math.round(distance * 4));
      preview.style.filter = `blur(${visible ? 0 : 12}px) brightness(${visible ? 1 : 1.35})`;
      preview.dataset.depth = depthName(absolute);
    });
    depthObjects.forEach((object, index) => {
      const baseX = (Number(object.dataset.x) / 100 - .5) * width;
      const baseY = (Number(object.dataset.y) / 100 - .5) * height;
      const rawDepth = Number(object.dataset.z) + value * 235 + index * 3;
      const z = ((rawDepth + 720) % 1440 + 1440) % 1440 - 720;
      const depthRatio = (z + 720) / 1440;
      const drift = Math.sin(index * 1.73 + value * .9) * 14;
      const x = baseX + drift - lookX * (14 + depthRatio * 82);
      const y = baseY + Math.cos(index * 1.19 + value * .7) * 9 - lookY * (10 + depthRatio * 62);
      const scale = .42 + depthRatio * 1.15;
      object.style.transform = `translate(-50%,-50%) translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px) rotate(${(index * 37 + value * 16).toFixed(1)}deg) scale(${scale.toFixed(3)})`;
      object.style.opacity = String(.18 + depthRatio * .58);
      object.style.filter = `blur(${Math.max(0, .7 - depthRatio) * 2.4}px) brightness(${(.66 + depthRatio * .45).toFixed(2)})`;
      object.dataset.depth = depthRatio > .68 ? 'near' : depthRatio > .34 ? 'middle' : 'far';
    });
  }
  function animate(time) {
    frame = 0;
    if (cancelled) return;
    const dt = previousTime ? Math.min(40, time - previousTime) : 16;
    previousTime = time;
    current += (target - current) * (1 - Math.exp(-dt / 360));
    if (Math.abs(target - current) < .002) current = target;
    apply(current);
    if (current !== target) frame = requestAnimationFrame(animate);
  }
  function set(value, immediate = false) {
    target = Math.max(0, Math.min(places.length - 1, value));
    if (Math.round(target) !== activeIndex) {
      clearTimeout(photoRevealTimer);
      root.dataset.photoState = 'hidden';
      previews.forEach(preview => { preview.classList.remove('is-current'); preview.setAttribute('aria-hidden', 'true'); preview.style.opacity = '0'; });
    }
    if (immediate || reduced) { current = target; apply(current); return; }
    if (!frame) frame = requestAnimationFrame(animate);
  }
  stage.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const bounds = stage.getBoundingClientRect();
    const normalizedX = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const normalizedY = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    lookX = (normalizedX - .5) * 2; lookY = (normalizedY - .5) * 2;
    apply(current);
  }, { passive: true, signal: events.signal });
  stage.addEventListener('pointerleave', () => { lookX *= .35; lookY *= .35; apply(current); }, { signal: events.signal });
  stage.addEventListener('wheel', event => {
    event.preventDefault();
    if (performance.now() < navigationReadyAt) return;
    const delta = event.deltaY || event.deltaX;
    set(target + Math.max(-120, Math.min(120, delta)) * .0014);
  }, { passive: false, signal: events.signal });
  stage.addEventListener('touchstart', event => { const touch = event.changedTouches[0]; touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null; }, { passive: true, signal: events.signal });
  stage.addEventListener('touchend', event => {
    const touch = event.changedTouches[0]; if (!touch || !touchStart) return;
    const dx = touch.clientX - touchStart.x, dy = touch.clientY - touchStart.y;
    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) set(Math.round(target) + (dx < 0 ? 1 : -1));
    touchStart = null;
  }, { passive: true, signal: events.signal });
  window.addEventListener('resize', () => apply(current), { passive: true, signal: events.signal });
  updateLetterLink();
  apply(current);
  return { set, cancel() { cancelled = true; events.abort(); clearTimeout(photoRevealTimer); clearTimeout(letterRevealTimer); cancelAnimationFrame(frame); } };
}
function playMusic() {
  if (!audio || !audio.paused) return;
  audio.play().then(updateMusic).catch(() => toast('音乐暂时无法播放，可以点击右上角音乐按钮重试。'));
}
function enter() { cakeJourney = 0; lastPointer = null; screen = 'cake'; render(); space.cake(); playMusic(); }
function showUniverse() { space.mode = 'universe'; screen = 'universe'; render(); }
function scatter() { if (screen !== 'cake' || space.mode !== 'cake') return; document.querySelector('.cake-prompt')?.classList.add('fading'); space.scatter(showUniverse); }
function applyCakeJourney() {
  const root = document.querySelector('.cake-screen'); if (!root) return;
  root.dataset.journey = cakeJourney.toFixed(3);
  const textProgress = Math.min(1, cakeJourney / .3);
  root.querySelectorAll('.story-line').forEach((line, index) => {
    const progress = Math.max(0, Math.min(1, textProgress * 1.65 - index * .33));
    line.style.setProperty('--line-progress', progress.toFixed(3));
  });
  root.querySelector('.journey-progress i')?.style.setProperty('--journey-progress', cakeJourney.toFixed(3));
}
function advanceCakeJourney(amount, limit = 1) {
  if (screen !== 'cake' || activeDialog || !['cake', 'scatter'].includes(space.mode)) return;
  cakeJourney = Math.max(0, Math.min(limit, cakeJourney + amount));
  applyCakeJourney();
  const scatterProgress = Math.max(0, Math.min(1, (cakeJourney - .28) / .72));
  if (scatterProgress > .02) document.querySelector('.cake-prompt')?.classList.add('is-scattering');
  space.setCakeScatter(scatterProgress, showUniverse);
}
function showLetter() {
  if (!letterUnlocked) { toast('沿着星轨滑到最后一颗星球，生日信就会出现。'); return; }
  letterSeen = true; screen = 'gather'; render(); space.gather(() => { screen = 'letter'; render(); });
}
function openDialog(markup, className = '') {
  lastFocused = document.activeElement;
  const root = document.querySelector('#modal-root');
  root.innerHTML = `<dialog class="modal ${className}">${markup}</dialog>`;
  activeDialog = root.firstElementChild; activeDialog.showModal();
  document.body.classList.add('modal-open');
  activeDialog.addEventListener('cancel', e => { e.preventDefault(); closeDialog(); });
  activeDialog.addEventListener('click', e => { if (e.target === activeDialog) { const r = activeDialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog(); } });
}
function closeDialog(force = false) {
  if (editorBusy) { toast('正在处理照片或网页，请稍等片刻。'); return; }
  if (editorDirty && !force) { toast('还有未保存的修改，请先保存，或点击“放弃修改”。'); return; }
  const wasMemory = activeDialog?.classList.contains('memory-modal');
  activeDialog?.close(); document.querySelector('#modal-root').innerHTML = ''; activeDialog = null; editorDirty = false;
  document.body.classList.remove('modal-open');
  if (wasMemory) { render(); const match = document.querySelector(`[data-place="${currentPlace.id}"]`); match?.focus({ preventScroll: true }); }
  else lastFocused?.focus({ preventScroll: true });
}
function placeholder(p) {
  return `<div class="photo-placeholder theme-${p.color}"><div class="placeholder-orbit"></div>${planet(p.color, 'placeholder-planet', p.color === 'violet')}<span class="placeholder-star">✧</span><span class="placeholder-coordinate">${esc(p.coordinates)}</span><div class="placeholder-caption"><span>OUR MEMORIES IN</span><strong>${esc(p.city)}</strong><small>这一页，留给我们的照片</small></div><button class="button glass" data-action="edit-current">${icon('plus')} 放入旅行照片</button></div>`;
}
function photoPanel(p) {
  return `${p.photos.length ? `<img class="memory-photo" src="${esc(p.photos[photoIndex])}" alt="${esc(p.city)}旅行照片，第 ${photoIndex + 1} 张" decoding="async"><span class="photo-counter">${String(photoIndex + 1).padStart(2, '0')} <i>/</i> ${String(p.photos.length).padStart(2, '0')}</span>${p.photos.length > 1 ? `<button class="photo-nav prev" data-action="prev-photo" aria-label="上一张照片">${icon('chevron')}</button><button class="photo-nav next" data-action="next-photo" aria-label="下一张照片">${icon('chevron')}</button><div class="photo-dots">${p.photos.map((_, i) => `<button class="${i === photoIndex ? 'active' : ''}" data-photo="${i}" aria-label="查看第 ${i + 1} 张照片" aria-current="${i === photoIndex}"></button>`).join('')}</div>` : ''}` : placeholder(p)}`;
}
function openMemory(id) {
  currentPlace = places.find(p => p.id === id); if (!currentPlace) return;
  visited.add(id); photoIndex = Math.min(currentPlace.cover || 0, Math.max(0, currentPlace.photos.length - 1));
  preloadPhotos(currentPlace, photoIndex);
  const p = currentPlace, index = places.indexOf(p);
  openDialog(`<div class="memory-topbar"><span>MEMORY ${String(index + 1).padStart(2, '0')} / ${String(places.length).padStart(2, '0')}</span><button class="icon-button" data-action="close" aria-label="返回宇宙">${icon('close')}</button></div><div class="memory-layout"><div class="photo-panel" aria-label="旅行相册">${photoPanel(p)}</div><section class="memory-info"><span class="eyebrow">${icon('star')} ${esc(p.planet)}</span><h2>${esc(p.city)}</h2><p class="memory-date">${p.date ? esc(p.date) : '旅行时间 · 待填写'}</p><div class="small-rule"></div><h3>${esc(p.headline || '和你一起，走过这里。')}</h3><p class="memory-text ${!p.memory ? 'empty-copy' : ''}">${p.memory ? esc(p.memory).replace(/\n/g, '<br>') : '有些瞬间，想好好记下来。<br>在这里，写下只属于我们的旅行回忆。'}</p><span class="memory-coordinate">${esc(p.coordinates)}</span><div class="memory-actions"><button class="text-button" data-action="close">${icon('back')} 返回宇宙</button><button class="icon-button" data-action="edit-current" aria-label="编辑这段回忆">${icon('edit')}</button></div></section></div>`, 'memory-modal');
  const panel = activeDialog.querySelector('.photo-panel'); let touchStart;
  panel.addEventListener('touchstart', e => { touchStart = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }; }, { passive: true });
  panel.addEventListener('touchend', e => { if (!touchStart) return; const dx = e.changedTouches[0].clientX - touchStart.x, dy = e.changedTouches[0].clientY - touchStart.y; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) changePhoto(dx < 0 ? 1 : -1); touchStart = null; }, { passive: true });
}
function changePhoto(direction, target) {
  if (!currentPlace?.photos.length) return;
  photoIndex = target ?? (photoIndex + direction + currentPlace.photos.length) % currentPlace.photos.length;
  document.querySelector('.photo-panel').innerHTML = photoPanel(currentPlace); preloadPhotos(currentPlace, photoIndex);
}
function editorFields(p) {
  return `<div class="editor-fields"><label>星球名称<input name="planet" maxlength="24" value="${esc(p.planet)}" required></label><label>旅行时间<input name="date" maxlength="40" placeholder="例如：2023年5月" value="${esc(p.date)}"></label><label class="wide">一句话标题<input name="headline" maxlength="50" placeholder="给这段旅程起个名字" value="${esc(p.headline)}"></label><label class="wide">我们的回忆<textarea name="memory" rows="4" maxlength="2000" placeholder="那天的天气、走过的小路，或是你还记得的一句话……">${esc(p.memory)}</textarea></label></div><div class="upload-heading"><span>旅行照片 <small>${p.photos.length} / ${MAX_PHOTOS}</small></span><span>点击照片设为封面</span></div><div class="upload-grid">${p.photos.map((src, i) => `<div class="upload-thumb"><button type="button" data-cover="${i}" class="cover-select ${i === p.cover ? 'selected' : ''}" aria-label="将第 ${i + 1} 张照片设为封面" aria-pressed="${i === p.cover}"><img src="${esc(src)}" alt="第 ${i + 1} 张照片">${i === p.cover ? '<span>封面</span>' : ''}</button><button type="button" class="remove-photo" data-remove="${i}" aria-label="移除第 ${i + 1} 张照片">×</button></div>`).join('')}${p.photos.length < MAX_PHOTOS ? `<label class="upload-button">${icon('plus')}<span>添加照片</span><input type="file" name="photos" accept="image/jpeg,image/png,image/webp,image/avif" multiple aria-label="添加旅行照片"></label>` : ''}</div><p class="upload-note">JPG / PNG / WebP / AVIF · 自动压缩 · 每座城市最多 10 张${p.id === 'xiamen' ? '，厦门建议 5–10 张' : ''}</p>`;
}
function openEditor(id) {
  if (activeDialog) { activeDialog.close(); activeDialog = null; }
  currentPlace = places.find(p => p.id === id) || places[0];
  draft = structuredClone(currentPlace); editorDirty = false;
  openDialog(`<div class="editor-top"><div><span class="eyebrow">MAKE IT OURS</span><h2>把回忆装进星球</h2></div><button class="icon-button" data-action="close" aria-label="关闭编辑">${icon('close')}</button></div><p class="editor-description">保存那些值得记住的瞬间，给他一份只属于你们的宇宙。</p><div class="editor-tabs">${places.map(p => `<button type="button" data-edit-place="${p.id}" class="${p.id === draft.id ? 'active' : ''}">${esc(p.city)}</button>`).join('')}</div><form id="memory-form">${editorFields(draft)}<div class="editor-save"><button type="button" class="text-button" data-action="discard">放弃修改</button><span class="save-state" role="status"></span><button class="button primary" type="submit">${icon('check')} 保存这段回忆</button></div></form><div class="export-panel"><div><strong>准备好，把宇宙送给他。</strong><p>内容保存在当前浏览器。导出后，照片和文字会一起装进网页。</p></div><button class="button outlined" data-action="export">${icon('download')} 导出礼物网页</button></div>`, 'editor-modal');
  activeDialog.querySelector('form').addEventListener('input', e => { if (['planet', 'date', 'headline', 'memory'].includes(e.target.name)) { draft[e.target.name] = e.target.value; editorDirty = true; } });
  activeDialog.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault(); draft.planet = draft.planet.trim();
    if (!draft.planet) { toast('请给这颗星球起一个名字。'); return; }
    const button = e.target.querySelector('[type="submit"]'); button.disabled = true;
    try { await saveMemory(draft); places[places.findIndex(p => p.id === draft.id)] = structuredClone(draft); currentPlace = places.find(p => p.id === draft.id); editorDirty = false; document.querySelector('.save-state').textContent = '已保存'; toast('这段回忆，已经住进星球里了。'); }
    catch { toast('浏览器未能保存，请检查可用空间或退出隐私浏览后重试。'); }
    finally { button.disabled = false; }
  });
  activeDialog.querySelector('form').addEventListener('change', async e => {
    if (e.target.name !== 'photos') return;
    const files = [...e.target.files]; if (!files.length) return;
    if (draft.photos.length + files.length > MAX_PHOTOS) { toast(`这颗星球还能放入 ${MAX_PHOTOS - draft.photos.length} 张照片，请重新选择。`); e.target.value = ''; return; }
    editorBusy = true;
    const form = activeDialog.querySelector('form'); const controls = [...activeDialog.querySelectorAll('button, input, textarea')]; controls.forEach(c => c.disabled = true);
    document.querySelector('.save-state').textContent = '正在压缩照片…';
    try { const photos = []; for (const file of files) photos.push(await compressPhoto(file)); draft.photos.push(...photos); editorDirty = true; refreshEditorFields(); toast(`已添加 ${photos.length} 张照片，记得保存这段回忆。`); }
    catch (error) { toast(error.message || '照片读取失败，请尝试 JPG 或 PNG。'); }
    finally { editorBusy = false; controls.forEach(c => c.disabled = false); form.querySelector('.save-state').textContent = ''; }
  });
}
function refreshEditorFields() {
  const form = document.querySelector('#memory-form'); const footer = form.querySelector('.editor-save');
  [...form.children].filter(el => el !== footer).forEach(el => el.remove()); footer.insertAdjacentHTML('beforebegin', editorFields(draft));
}
async function exportGift() {
  if (editorDirty) { toast('请先保存这段回忆，再导出礼物。'); return; }
  editorBusy = true;
  const button = document.querySelector('[data-action="export"]'); button.disabled = true; button.innerHTML = `${icon('download')} 正在打包…`;
  try {
    let html;
    const data = { ...config, places };
    if (window.__UNIVERSE_TEMPLATE__) {
      html = window.__UNIVERSE_TEMPLATE__;
    } else {
      const paths = ['./index.html', './src/style.css', './src/data.js', './src/space.js', './src/intro.js', './src/app.js'];
      const [shell, css, ...scripts] = await Promise.all(paths.map(async path => { const response = await fetch(path); if (!response.ok) throw new Error('网页资源读取失败'); return response.text(); }));
      const code = scripts.map(s => s.replace(/^import .*;\n/gm, '').replace(/^export /gm, '')).join('\n').replace(/const icons =/, 'const esc = escapeHTML;\nconst icons =');
      html = shell.replace(/<link rel="icon"[^>]+>/, '').replace(/<link rel="stylesheet"[^>]+>/, () => `<style>${css}</style>`).replace(/<script type="module" src="[^\"]+"><\/script>/, () => `<script>__UNIVERSE_PAYLOAD__</script><script type="module">${code.replace(/<\/script/gi, '<\\/script')}</script>`);
    }
    const exportedPlaces = [];
    const toInline = async src => {
      if (src.startsWith('data:')) return src;
      const response = await fetch(src); if (!response.ok) throw new Error('有照片未能读取，请检查照片后重试。');
      const blob = await response.blob(); return await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
    };
    for (const p of places) exportedPlaces.push({ ...p, photos: await Promise.all(p.photos.map(toInline)) });
    data.places = exportedPlaces; if (data.music) data.music = await toInline(data.music);
    const safeJSON = value => JSON.stringify(value).replace(/</g, '\\u003c');
    const payload = `window.__UNIVERSE_DATA__=${safeJSON(data)};window.__UNIVERSE_EXPORT__=${safeJSON(Date.now().toString(36))};window.__UNIVERSE_TEMPLATE__=${safeJSON(html)};`;
    const output = html.replace('__UNIVERSE_PAYLOAD__', () => payload);
    const url = URL.createObjectURL(new Blob([output], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = '欢迎进入我们的世界.html'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast('礼物已导出。用浏览器打开网页文件，就能进入你们的宇宙。');
  } catch (error) { toast(error.message || '导出失败，请稍后重试。'); }
  finally { editorBusy = false; button.disabled = false; button.innerHTML = `${icon('download')} 导出礼物网页`; }
}
function updateMusic() {
  const playing = !!audio && !audio.paused;
  document.body.dataset.musicState = playing ? 'playing' : audio ? 'paused' : 'unavailable';
  document.body.dataset.musicTime = audio ? audio.currentTime.toFixed(2) : '0';
  document.querySelectorAll('.music-button').forEach(button => { button.innerHTML = icon(playing ? 'sound' : 'mute'); button.setAttribute('aria-label', playing ? '关闭音乐' : '开启音乐'); });
}

document.addEventListener('click', async e => {
  const button = e.target.closest('button');
  if (screen === 'cake' && !activeDialog && !button) { space.firework(); return; }
  if (!button || button.disabled) return;
  if (button.dataset.universeIndex !== undefined) { universeController?.set(Number(button.dataset.universeIndex)); return; }
  if (button.dataset.place) { universeFocus = Math.max(0, places.findIndex(place => place.id === button.dataset.place)); openMemory(button.dataset.place); return; }
  if (button.dataset.photo !== undefined) { changePhoto(0, Number(button.dataset.photo)); return; }
  if (button.dataset.editPlace) { if (editorDirty) { toast('请先保存这段回忆，或放弃修改，再切换城市。'); return; } openEditor(button.dataset.editPlace); return; }
  if (button.dataset.cover !== undefined) { draft.cover = Number(button.dataset.cover); editorDirty = true; refreshEditorFields(); return; }
  if (button.dataset.remove !== undefined) { const index = Number(button.dataset.remove); draft.photos.splice(index, 1); if (index < draft.cover) draft.cover--; else if (index === draft.cover) draft.cover = 0; editorDirty = true; refreshEditorFields(); return; }
  switch (button.dataset.action) {
    // Start within the click itself so browser autoplay policies keep the
    // user's activation. The visual transition intentionally begins later.
    case 'enter': playMusic(); introPlayback?.enter(); break;
    case 'skip-intro': introPlayback?.finish(); break;
    case 'later': introPlayback?.postpone(); break;
    case 'back-to-choice': introPlayback?.finish(); break;
    case 'home': space.mode = 'intro'; screen = 'intro'; render(); break;
    case 'scatter': scatter(); break;
    case 'firework': space.firework(); break;
    case 'skip': scatter(); break;
    case 'universe': showUniverse(); break;
    case 'replay': space.mode = 'intro'; screen = 'intro'; render(); break;
    case 'letter': showLetter(); break;
    case 'close': closeDialog(); break;
    case 'prev-photo': changePhoto(-1); break;
    case 'next-photo': changePhoto(1); break;
    case 'edit': openEditor(); break;
    case 'edit-current': openEditor(currentPlace.id); break;
    case 'discard': editorDirty = false; openEditor(draft.id); break;
    case 'export': await exportGift(); break;
    case 'music': if (!audio) { toast(config.musicTitle ? `已指定 BGM《${config.musicTitle}》，暂时没有背景音乐文件。` : '此刻，让星光安静地陪着我们。暂时没有背景音乐。'); } else if (audio.paused) audio.play().then(updateMusic).catch(() => toast('音乐暂时无法播放，请检查音乐文件。')); else { audio.pause(); updateMusic(); } break;
  }
});
document.addEventListener('keydown', e => {
  if (screen === 'cake' && !activeDialog && e.code === 'Space' && !e.repeat) { e.preventDefault(); space.toggleCandle(); return; }
  if (screen === 'universe' && !activeDialog && ['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); universeController?.set(universeFocus + (e.key === 'ArrowRight' ? 1 : -1)); return; }
  if (activeDialog?.classList.contains('memory-modal') && ['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); changePhoto(e.key === 'ArrowRight' ? 1 : -1); }
});
let lastPointer, touchY;
document.addEventListener('pointermove', e => { if (screen !== 'cake' || activeDialog || !['cake', 'scatter'].includes(space.mode)) return; if (lastPointer) advanceCakeJourney(Math.hypot(e.clientX - lastPointer.x, e.clientY - lastPointer.y) / 1800, .28); lastPointer = { x: e.clientX, y: e.clientY }; }, { passive: true });
document.addEventListener('wheel', e => { if (!activeDialog && screen === 'cake') advanceCakeJourney(Math.min(180, Math.abs(e.deltaY) + Math.abs(e.deltaX)) / 1300); }, { passive: true });
document.addEventListener('touchstart', e => { touchY = e.touches[0]?.clientY; }, { passive: true });
document.addEventListener('touchmove', e => { const y = e.touches[0]?.clientY; if (!activeDialog && screen === 'cake' && Number.isFinite(y) && Number.isFinite(touchY)) { advanceCakeJourney(Math.abs(y - touchY) / 720); touchY = y; } }, { passive: true });
document.addEventListener('error', e => { if (e.target.matches?.('.memory-photo')) { const panel = e.target.parentElement; panel.innerHTML = '<div class="photo-error">这张照片暂时无法打开。<br>请在编辑回忆里重新添加照片。</div>'; } }, true);

async function init() {
  try {
    if (window.__UNIVERSE_DATA__) config = window.__UNIVERSE_DATA__;
    else { const response = await fetch('./public/memories.json'); if (!response.ok) throw new Error('无法读取回忆'); config = await response.json(); }
    places = await Promise.all(config.places.map(async p => {
      try {
        const saved = await loadSaved(p.id);
        if (!saved) return p;
        return { ...p, ...saved, photos: saved.photos?.length ? saved.photos : p.photos, cover: saved.photos?.length ? saved.cover : p.cover };
      } catch { return p; }
    }));
    document.title = config.title;
    if (config.music) {
      audio = new Audio(config.music); audio.loop = true; audio.volume = .5;
      audio.addEventListener('playing', updateMusic); audio.addEventListener('pause', updateMusic); audio.addEventListener('timeupdate', updateMusic);
      audio.addEventListener('error', () => { audio = null; updateMusic(); });
    }
    render();
    const preload = () => places.forEach(p => preloadPhotos(p));
    if ('requestIdleCallback' in window) requestIdleCallback(preload); else setTimeout(preload, 800);
  } catch { app.innerHTML = '<main class="load-error"><h1>星光还在路上</h1><p>请通过本地服务打开网站，或使用导出的独立网页。</p><button class="button primary" onclick="location.reload()">重新加载</button></main>'; }
}
init();
