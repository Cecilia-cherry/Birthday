export function introCharacters(text) {
  return [...text].map((char, i) => `<span class="intro-char" style="--char-index:${i}" aria-hidden="true">${char}</span>`).join('');
}

function attachStarTrail(root, signal, reduced) {
  const canvas = root.querySelector('.cursor-trail');
  const cursor = root.querySelector('.star-cursor');
  if (reduced || !matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};
  // Keep the cursor outside the perspective scene and outside hit testing.
  document.body.append(canvas, cursor);
  const ctx = canvas.getContext('2d');
  let frame = 0, previous = null, lastTime = 0, particles = [];
  let width, height;
  function resize() {
    width = innerWidth; height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); previous = null; particles = [];
  }
  function hide() {
    document.body.classList.remove('star-pointer-enabled');
    cursor.classList.remove('visible'); previous = null; particles = [];
    cancelAnimationFrame(frame); frame = 0; ctx.clearRect(0, 0, width, height);
  }
  function draw(time) {
    const delta = lastTime ? Math.min(40, time - lastTime) : 16; lastTime = time;
    ctx.clearRect(0, 0, width, height); ctx.globalCompositeOperation = 'lighter';
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) {
      p.life -= delta; p.x += p.vx * delta; p.y += p.vy * delta;
      const fade = Math.max(0, p.life / p.duration);
      ctx.globalAlpha = fade * fade * .9;
      ctx.fillStyle = p.color;
      const radius = p.radius * (.45 + fade * .55);
      ctx.beginPath();
      if (p.star) {
        for (let j = 0; j < 8; j++) {
          const angle = j * Math.PI / 4, r = j % 2 ? radius * .24 : radius;
          const x = p.x + Math.cos(angle) * r, y = p.y + Math.sin(angle) * r;
          j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
      } else ctx.arc(p.x, p.y, radius * .4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (particles.length) frame = requestAnimationFrame(draw);
    else { frame = 0; lastTime = 0; }
  }
  function move(e) {
    if (e.pointerType === 'touch' || !root.isConnected || document.querySelector('dialog[open]') || root.dataset.stage === 'entering') { hide(); return; }
    const bounds = root.getBoundingClientRect();
    if (e.clientY < bounds.top || e.clientY > bounds.bottom) { hide(); return; }
    const point = { x: e.clientX, y: e.clientY };
    cursor.style.left = `${point.x}px`; cursor.style.top = `${point.y}px`;
    cursor.classList.add('visible'); document.body.classList.add('star-pointer-enabled');
    cursor.classList.toggle('over-control', !!e.target.closest('button'));
    const origin = previous || point;
    const count = Math.min(5, Math.max(1, Math.ceil(Math.hypot(point.x - origin.x, point.y - origin.y) / 7)));
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / count, duration = 420 + Math.random() * 430;
      particles.push({ x: origin.x + (point.x - origin.x) * t + (Math.random() - .5) * 10, y: origin.y + (point.y - origin.y) * t + (Math.random() - .5) * 10, vx: (Math.random() - .5) * .026, vy: -.008 - Math.random() * .015, radius: 1.5 + Math.random() * 3, color: ['#e5d8fb', '#b1dced', '#eedcc0'][Math.floor(Math.random() * 3)], star: Math.random() < .38, life: duration, duration });
    }
    if (particles.length > 100) particles.splice(0, particles.length - 100);
    previous = point;
    if (!frame) frame = requestAnimationFrame(draw);
  }
  resize();
  document.addEventListener('pointermove', move, { passive: true, signal });
  document.addEventListener('pointerout', e => { if (!e.relatedTarget) hide(); }, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); }, { signal });
  window.addEventListener('resize', resize, { passive: true, signal });
  return () => { hide(); canvas.remove(); cursor.remove(); };
}

export function startIntroSequence(root, onEnter) {
  const timers = new Set();
  const events = new AbortController();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const live = root.querySelector('.intro-live');
  const decision = root.querySelector('.intro-decision');
  const choices = root.querySelector('.entry-actions');
  const skip = root.querySelector('[data-action="skip-intro"]');
  const cards = [...root.querySelectorAll('.intro-card')];
  const removeTrail = attachStarTrail(root, events.signal, reduced);
  let disposed = false, pointerFrame = 0, storyProgress = 0, activeStoryCard = '', lastGesturePoint, touchPoint;

  function later(fn, delay) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!disposed && root.isConnected) fn();
    }, delay);
    timers.add(timer);
  }
  function clear() { timers.forEach(clearTimeout); timers.clear(); }
  function stage(name) { root.dataset.stage = name; document.body.dataset.introStage = name; }
  function showCard(name) {
    // Remove the outgoing paragraph before presenting the next one.
    cards.forEach(card => {
      const active = card.dataset.card === name;
      card.hidden = !active;
      card.setAttribute('aria-hidden', String(!active));
      card.classList.remove('is-leaving');
      card.classList.toggle('is-active', active);
    });
    root.querySelectorAll('[data-chapter]').forEach(dot => dot.classList.toggle('active', dot.dataset.chapter === name));
    if (name === 'question') { decision.inert = false; decision.removeAttribute('aria-hidden'); }
    stage(name);
    live.textContent = name === 'memory' ? '检测到一段属于我们的时空记忆。' : name === 'waiting' ? '没关系，我们的宇宙会一直等你。' : '是否进入我们的世界？';
  }
  function dismiss(name) { root.querySelector(`[data-card="${name}"]`).classList.add('is-leaving'); stage(`${name}-out`); }
  function revealCard(name, progress) {
    const chars = [...root.querySelectorAll(`[data-card="${name}"] .intro-char`)];
    const visible = Math.round(Math.max(0, Math.min(1, progress)) * chars.length);
    root.querySelector('.intro-cursor')?.classList.remove('intro-cursor');
    chars.forEach((char, index) => char.classList.toggle('revealed', index < visible));
    if (visible > 0 && visible < chars.length) chars[visible - 1].classList.add('intro-cursor');
  }
  function applyStoryProgress() {
    if (disposed || ['ready', 'waiting', 'entering'].includes(root.dataset.stage)) return;
    root.style.setProperty('--story-progress', storyProgress.toFixed(3));
    if (storyProgress < .02) return;
    if (storyProgress < .5) {
      if (activeStoryCard !== 'memory') { showCard('memory'); activeStoryCard = 'memory'; }
      revealCard('memory', (storyProgress - .02) / .36);
      if (storyProgress > .41) dismiss('memory');
      return;
    }
    if (activeStoryCard !== 'question') { showCard('question'); activeStoryCard = 'question'; }
    revealCard('question', (storyProgress - .5) / .4);
    if (storyProgress >= .96) ready();
  }
  function advanceStory(amount) {
    if (disposed || reduced || ['ready', 'waiting', 'entering'].includes(root.dataset.stage)) return;
    storyProgress = Math.min(1, storyProgress + Math.max(0, amount));
    applyStoryProgress();
  }
  function ready() {
    if (disposed || root.dataset.stage === 'entering') return;
    clear();
    const returning = root.dataset.stage === 'waiting';
    if (root.querySelector('[data-card="question"]').hidden) showCard('question');
    root.querySelectorAll('[data-card="question"] .intro-char').forEach(char => char.classList.add('revealed'));
    root.querySelector('.intro-cursor')?.classList.remove('intro-cursor');
    stage('ready'); choices.inert = false;
    choices.querySelectorAll('button').forEach(button => button.disabled = false);
    live.textContent = '是否进入我们的世界？请选择进入我们的世界，或暂时不要。';
    const skipHadFocus = document.activeElement === skip;
    skip.hidden = true;
    if (skipHadFocus || returning) choices.querySelector('button').focus({ preventScroll: true });
  }
  function postpone() {
    if (disposed || root.dataset.stage !== 'ready') return;
    clear(); showCard('waiting');
    root.querySelector('.waiting-title').focus({ preventScroll: true });
  }
  function enterWorld() {
    if (disposed || !['ready', 'waiting'].includes(root.dataset.stage)) return;
    clear(); stage('entering'); choices.inert = true;
    root.querySelectorAll('.entry-actions button').forEach(button => button.disabled = true);
    root.querySelectorAll('[data-action="enter"] .choice-copy').forEach(label => label.textContent = '正在进入我们的世界');
    live.textContent = '正在进入我们的世界。';
    later(onEnter, reduced ? 0 : 800);
  }
  root.addEventListener('keydown', e => {
    if (e.key === ' ' && !['ready', 'waiting', 'entering'].includes(root.dataset.stage) && !e.target.closest('button')) { e.preventDefault(); ready(); }
    if (['ready', 'waiting'].includes(root.dataset.stage) && ['ArrowLeft', 'ArrowRight'].includes(e.key)) {
      const activeChoices = root.querySelector('.intro-card:not([hidden]) .entry-actions');
      e.preventDefault(); activeChoices.querySelectorAll('button')[e.key === 'ArrowLeft' ? 0 : 1].focus({ preventScroll: true });
    }
  }, { signal: events.signal });
  document.addEventListener('keydown', e => {
    if (e.key === ' ' && document.activeElement === document.body && !document.querySelector('dialog[open]') && !['ready', 'waiting', 'entering'].includes(root.dataset.stage)) { e.preventDefault(); ready(); }
  }, { signal: events.signal });
  if (!reduced) {
    root.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      const point = { x: e.clientX, y: e.clientY };
      if (lastGesturePoint) advanceStory(Math.hypot(point.x - lastGesturePoint.x, point.y - lastGesturePoint.y) / 1200);
      lastGesturePoint = point;
      if (pointerFrame) return;
      const bounds = root.getBoundingClientRect();
      const x = (e.clientX - bounds.left) / bounds.width - .5;
      const y = (e.clientY - bounds.top) / bounds.height - .5;
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        root.style.setProperty('--scene-x', `${x * 25}px`); root.style.setProperty('--scene-y', `${y * 18}px`);
        root.style.setProperty('--tilt-x', `${-y * 5}deg`); root.style.setProperty('--tilt-y', `${x * 7}deg`);
      });
    }, { passive: true, signal: events.signal });
    root.addEventListener('pointerleave', () => {
      cancelAnimationFrame(pointerFrame); pointerFrame = 0;
      lastGesturePoint = null;
      for (const prop of ['--scene-x', '--scene-y', '--tilt-x', '--tilt-y']) root.style.removeProperty(prop);
    }, { signal: events.signal });
    root.addEventListener('wheel', e => advanceStory(Math.min(180, Math.abs(e.deltaY) + Math.abs(e.deltaX)) / 850), { passive: true, signal: events.signal });
    root.addEventListener('touchstart', e => { const touch = e.touches[0]; touchPoint = touch ? { x: touch.clientX, y: touch.clientY } : null; }, { passive: true, signal: events.signal });
    root.addEventListener('touchmove', e => {
      const touch = e.touches[0]; if (!touch || !touchPoint) return;
      const point = { x: touch.clientX, y: touch.clientY };
      advanceStory(Math.hypot(point.x - touchPoint.x, point.y - touchPoint.y) / 480); touchPoint = point;
    }, { passive: true, signal: events.signal });
  }
  stage('stars');
  if (reduced) ready();
  return {
    finish: ready, enter: enterWorld, postpone,
    cancel() { disposed = true; clear(); events.abort(); cancelAnimationFrame(pointerFrame); removeTrail(); delete document.body.dataset.introStage; }
  };
}
