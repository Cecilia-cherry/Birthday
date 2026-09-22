const palettes = {
  sea: [[45, 71, 83], [115, 166, 173], [191, 202, 187]],
  violet: [[66, 54, 101], [144, 122, 169], [207, 184, 204]],
  dream: [[37, 40, 82], [117, 119, 172], [210, 182, 218]],
  sage: [[43, 77, 71], [117, 160, 141], [208, 208, 167]],
  peach: [[125, 64, 49], [208, 143, 104], [235, 198, 148]],
  blue: [[35, 52, 108], [94, 126, 189], [164, 189, 206]],
  jade: [[24, 70, 65], [72, 145, 128], [177, 218, 188]],
  amber: [[100, 55, 31], [194, 116, 55], [239, 195, 118]],
  cyan: [[23, 57, 82], [53, 143, 164], [164, 220, 223]],
  rose: [[91, 43, 68], [173, 88, 118], [231, 176, 184]]
};
const textureCache = new Map();
function noise(x, y, seed) {
  return Math.sin(x * 5 + Math.sin(y * 7 + seed) * 1.8) * .23 + Math.sin(y * 18 + Math.sin(x * 11) * 2) * .14 + Math.sin(x * 42 + y * 31 + Math.sin(y * 35)) * .065 + Math.sin(x * 113 - y * 82) * .025;
}
export function planetTexture(color, size = 420) {
  const key = color + size;
  if (textureCache.has(key)) return textureCache.get(key);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'); const img = ctx.createImageData(size, size);
  const pal = palettes[color] || palettes.violet;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (x + .5 - size / 2) / (size / 2), ny = (y + .5 - size / 2) / (size / 2);
    const r2 = nx * nx + ny * ny; if (r2 >= 1) continue;
    const nz = Math.sqrt(1 - r2);
    const u = Math.atan2(nx, nz), v = Math.asin(ny);
    let n = color === 'dream'
      ? noise(u * .8, v * .9, 11) * .38 + Math.sin(v * 9 + Math.sin(u * 2.5) * .9) * .17 + Math.sin(v * 28 + u * 6) * .022
      : noise(u * 1.5, v * 2, pal[0][0]) + Math.sin(v * 26 + Math.sin(u * 5) * .9 + noise(u * 3, v, 2) * 3) * (color === 'sea' ? .09 : .19);
    const value = Math.max(0, Math.min(.999, .48 + n));
    const segment = value < .5 ? 0 : 1, t = (value - segment * .5) * 2;
    const illumination = Math.max(.025, -nx * .58 - ny * .4 + nz * .51);
    const light = Math.pow(illumination, .72);
    const rim = Math.pow(1 - nz, 3) * (color === 'dream' ? .37 : .22);
    const i = (y * size + x) * 4;
    for (let c = 0; c < 3; c++) img.data[i + c] = (pal[segment][c] * (1 - t) + pal[segment + 1][c] * t) * light + pal[2][c] * rim;
    img.data[i + 3] = Math.min(255, (1 - Math.sqrt(r2)) * size * 255 / 2);
  }
  ctx.putImageData(img, 0, 0);
  const result = canvas.toDataURL('image/webp'); textureCache.set(key, result); return result;
}
export class Space {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.mode = 'intro'; this.particles = []; this.pointer = { x: 0, y: 0 }; this.pointerScreen = { x: 0, y: 0, active: false }; this.previous = 0;
    this.resize = this.resize.bind(this); this.frame = this.frame.bind(this);
    window.addEventListener('resize', this.resize, { passive: true }); this.resize();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(this.raf); this.previous = 0; }
      else this.raf = requestAnimationFrame(this.frame);
    });
    window.addEventListener('pointermove', e => { this.pointer.x = e.clientX / this.w - .5; this.pointer.y = e.clientY / this.h - .5; this.pointerScreen.x = e.clientX; this.pointerScreen.y = e.clientY; this.pointerScreen.active = true; }, { passive: true });
    window.addEventListener('pointerout', e => { if (!e.relatedTarget) this.pointerScreen.active = false; });
    this.raf = requestAnimationFrame(this.frame);
  }
  resize() {
    this.w = innerWidth; this.h = innerHeight;
    // Keep enough resolution for crisp particles without letting high-DPI phones
    // multiply the canvas workload during the cake's first reveal.
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    this.canvas.width = this.w * dpr; this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.stars = Array.from({ length: Math.min(420, Math.round(this.w * this.h / 2600)) }, () => ({ x: Math.random() * this.w, y: Math.random() * this.h, r: Math.random() < .035 ? 1.6 : Math.random() * .9 + .2, phase: Math.random() * 6.28, a: Math.random() * .5 + .15 }));
  }
  cake() {
    this.mode = 'cake'; this.cakeScatter = 0; this.burstTime = 0; this.cakeAge = 0; this.cakeStartedAt = performance.now(); this.cakeView = { yaw: 0, pitch: 0 }; this.cakeReady = false; this.candleLit = false; this.candleState = 'lighting'; this.candleStateStarted = this.cakeStartedAt; this.fireworkStarted = 0; this.pendingFirework = false; this.pendingScatter = null; this.pendingCakeProgress = 0; this.onDone = null; this.cakeFinished = false;
    const particles = [];
    const layers = [{ y: 49, r: 114, height: 56 }, { y: -7, r: 88, height: 51 }, { y: -56, r: 58, height: 47 }];
    const count = this.w < 600 ? 360 : 600;
    for (let l = 0; l < layers.length; l++) {
      const layer = layers[l];
      for (let i = 0; i < count / 3; i++) {
        const theta = Math.random() * Math.PI * 2;
        const top = Math.random() < .4, radius = top ? Math.sqrt(Math.random()) * layer.r : layer.r;
        const px = Math.cos(theta) * radius;
        const depth = Math.sin(theta) * radius;
        const py = top ? layer.y - layer.height : layer.y - Math.random() * layer.height;
        const shade = .5 + (1 - Math.cos(theta)) * .25;
        const color = top ? `rgba(246,226,213,${.6 + Math.random() * .4})` : `rgba(${Math.round(193 * shade)},${Math.round(164 * shade)},${Math.round(212 * shade)},.95)`;
        particles.push({ x: px, y: py, z: depth, color, size: Math.random() * 2 + 1.5 });
      }
      const rimCount = this.w < 600 ? 44 : 64;
      for (let i = 0; i < rimCount; i++) {
        const theta = i / rimCount * Math.PI * 2;
        particles.push({ x: Math.cos(theta) * layer.r, y: layer.y - layer.height, z: Math.sin(theta) * layer.r, color: '#f2d8c1', size: 2 });
      }
    }
    // One candle, also made entirely from particles.
    for (let y = -139; y < -106; y += 1.8) for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 5) particles.push({ x: Math.cos(angle) * 3, y, z: Math.sin(angle) * 3, color: Math.round(y) % 4 ? '#d8bee8' : '#f0d7df', size: 1.9 });
    for (let y = -144; y < -138; y += 1.2) for (let x = -1; x <= 1; x += 1) particles.push({ x, y, z: 0, color: '#49384e', size: 1.25 });
    const scale = Math.min(1.45, this.w / 430);
    this.particles = particles.map(p => {
      const angle = Math.random() * Math.PI * 2, distance = 180 + Math.random() * Math.max(this.w, this.h) * .65;
      const fireAngle = Math.random() * Math.PI * 2, fireDistance = 170 + Math.random() * Math.max(this.w, this.h) * .42;
      return { ...p, sx: (Math.random() - .5) * this.w / scale, sy: (Math.random() - .5) * this.h / scale, dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance, fx: Math.cos(fireAngle) * fireDistance, fy: Math.sin(fireAngle) * fireDistance, ox: 0, oy: 0, vx: 0, vy: 0, phase: Math.random() * 6.28 };
    });
    this.cakeHaloStars = Array.from({ length: this.w < 600 ? 96 : 150 }, () => {
      // Use explicit depth bands so foreground, middle and distant stars have
      // visibly different size, brightness and parallax speed.
      const roll = Math.random();
      const layer = roll < .5 ? 'far' : roll < .84 ? 'middle' : 'near';
      const depth = layer === 'far'
        ? { z: -300 + Math.random() * 150, size: .35 + Math.random() * .48, alpha: .48, orbit: 5 + Math.random() * 10, speed: .00004 + Math.random() * .00007 }
        : layer === 'middle'
          ? { z: -90 + Math.random() * 210, size: .78 + Math.random() * .72, alpha: .76, orbit: 10 + Math.random() * 19, speed: .00008 + Math.random() * .0001 }
          : { z: 170 + Math.random() * 190, size: 1.55 + Math.random() * 1.2, alpha: 1, orbit: 20 + Math.random() * 24, speed: .00014 + Math.random() * .00013 };
      return {
        layer,
        nx: (Math.random() - .5) * 1.12,
        ny: (Math.random() - .5) * 1.08,
        phase: Math.random() * Math.PI * 2,
        speed: depth.speed * (Math.random() < .5 ? -1 : 1),
        ...depth
      };
    });
    this.canvas.dataset.cakeStars = String(this.cakeHaloStars.length);
    this.canvas.dataset.cakeStarCoverage = 'screen';
    this.canvas.dataset.cakeStarDepth = 'far-middle-near';
  }
  finishCake() {
    if (this.cakeFinished) return;
    this.cakeFinished = true;
    const span = Math.max(this.w, this.h), minRadius = Math.min(this.w, this.h) * .24;
    this.universeStartedAt = performance.now();
    this.universeParticles = this.particles.filter((_, index) => index % 2 === 0).map((point, index) => {
      const radius = minRadius + Math.sqrt(Math.random()) * (span * .52 - minRadius);
      const angle = Math.atan2(point.dy, point.dx) + (Math.random() - .5) * .45;
      return {
        startX: point.dx * .72 + point.x,
        startY: point.dy * .72 + point.y,
        radius,
        yRadius: radius * (.3 + Math.random() * .25),
        angle,
        depth: (Math.random() - .5) * 520,
        speed: (.000012 + Math.random() * .000022) * (Math.random() < .5 ? -1 : 1),
        color: point.color,
        size: Math.max(.65, point.size * (.55 + Math.random() * .35)),
        phase: point.phase || index * .37
      };
    });
    this.canvas.dataset.universeOrbit = 'true';
    this.canvas.dataset.universeTransition = '1800';
    this.canvas.dataset.universeParticles = String(this.universeParticles.length);
    this.mode = 'universe'; this.particles = [];
    const done = this.onDone; this.onDone = null; done?.();
  }
  firework() {
    if (this.mode !== 'cake') return;
    if (!this.cakeReady) { this.pendingFirework = true; return; }
    this.fireworkStarted = performance.now(); this.canvas.dataset.firework = 'true';
  }
  toggleCandle() {
    if (this.mode !== 'cake' || !this.cakeReady) return;
    const now = performance.now();
    if (['lit', 'relighting', 'lighting'].includes(this.candleState)) this.candleState = 'extinguishing';
    else this.candleState = 'relighting';
    this.candleStateStarted = now;
  }
  setCakeScatter(progress, onDone) {
    if (!['cake', 'scatter'].includes(this.mode)) return;
    this.onDone = onDone || this.onDone;
    if (!this.cakeReady) { this.pendingCakeProgress = Math.max(this.pendingCakeProgress, Math.min(1, progress)); return; }
    this.cakeScatter = Math.max(this.cakeScatter || 0, Math.min(1, progress));
    if (this.cakeScatter >= 1) this.finishCake();
  }
  scatter(onDone) { if (this.mode !== 'cake') return; if (!this.cakeReady) { this.pendingScatter = onDone; return; } this.mode = 'scatter'; this.burstTime = (this.cakeScatter || 0) * (this.reduced ? 600 : 3200); this.onDone = onDone; }
  gather(onDone) {
    this.mode = 'gather'; this.burstTime = 0; this.onDone = onDone;
    this.gatherStars = this.stars.map(s => ({ ...s }));
  }
  setUniverseView(progress, x = 0, y = 0) {
    const previous = this.universeView?.progress ?? progress;
    this.universeVelocity = Math.max(-.08, Math.min(.08, progress - previous));
    this.universeView = { progress, x, y };
  }
  frame(time) {
    const dt = this.previous ? Math.min(40, time - this.previous) : 16; this.previous = time;
    const ctx = this.ctx; ctx.clearRect(0, 0, this.w, this.h);
    for (const star of this.stars) {
      const a = this.reduced ? star.a : star.a * (.7 + .3 * Math.sin(time * .0006 + star.phase));
      ctx.fillStyle = `rgba(219,223,245,${a})`;
      const x = star.x - (this.reduced ? 0 : this.pointer.x * star.r * 9), y = star.y - (this.reduced ? 0 : this.pointer.y * star.r * 9);
      ctx.beginPath(); ctx.arc(x, y, star.r, 0, Math.PI * 2); ctx.fill();
      if (star.r > 1.5) { ctx.fillStyle = `rgba(231,222,255,${a * .5})`; ctx.fillRect(x - 4, y - .35, 8, .7); ctx.fillRect(x - .35, y - 4, .7, 8); }
    }
    if (this.mode === 'cake' || this.mode === 'scatter') {
      this.cakeAge += dt;
      if (this.mode === 'scatter') this.burstTime += dt;
      const duration = this.reduced ? 500 : 1800;
      if (this.mode === 'scatter') this.cakeScatter = Math.min(1, this.burstTime / duration);
      const p = this.cakeScatter || 0, move = p * p * (3 - 2 * p);
      const scale = Math.min(1.45, this.w / 430);
      const hover = this.reduced ? 0 : Math.sin((time - this.cakeStartedAt) * .00125) * 8;
      const cx = this.w / 2, cy = this.h * .56 + hover;
      this.canvas.dataset.cakeFloat = hover.toFixed(2);
      const gather = this.reduced ? 1 : Math.min(1, (time - this.cakeStartedAt) / 650);
      const reveal = gather * gather * (3 - 2 * gather);
      const ignition = this.reduced ? 1 : Math.max(0, Math.min(1, (time - this.cakeStartedAt - 720) / 900));
      let lightUp = ignition * ignition * (3 - 2 * ignition), blowSway = 0, smoke = 0;
      this.cakeReady = ignition >= 1;
      if (this.cakeReady && this.candleState === 'lighting') this.candleState = 'lit';
      if (this.candleState === 'extinguishing') {
        const t = Math.min(1, (time - this.candleStateStarted) / (this.reduced ? 120 : 760));
        const eased = t * t * (3 - 2 * t); lightUp = 1 - eased; blowSway = Math.sin(t * Math.PI) * 15 + t * 8;
        if (t === 1) { this.candleState = 'off'; this.candleStateStarted = time; }
      } else if (this.candleState === 'off') { lightUp = 0; smoke = Math.max(0, 1 - (time - this.candleStateStarted) / 1500); }
      else if (this.candleState === 'relighting') {
        const t = Math.min(1, (time - this.candleStateStarted) / (this.reduced ? 120 : 680));
        lightUp = t * t * (3 - 2 * t);
        if (t === 1) this.candleState = 'lit';
      }
      this.candleLit = lightUp > .08;
      this.canvas.dataset.candleLit = String(this.candleLit); this.canvas.dataset.candleState = this.candleState;
      let fireworkMove = 0, fireworkProgress = 0;
      if (this.fireworkStarted) {
        fireworkProgress = Math.min(1, (time - this.fireworkStarted) / (this.reduced ? 600 : 1900));
        fireworkMove = fireworkProgress < .28 ? 1 - Math.pow(1 - fireworkProgress / .28, 3) : 1 - ((fireworkProgress - .28) / .72) ** 2 * (3 - 2 * ((fireworkProgress - .28) / .72));
        if (fireworkProgress === 1) { this.fireworkStarted = 0; fireworkMove = 0; this.canvas.dataset.firework = 'false'; }
      }
      const viewEase = Math.min(1, dt * .006);
      this.cakeView.yaw += (this.pointer.x * 1.05 - this.cakeView.yaw) * viewEase;
      this.cakeView.pitch += (this.pointer.y * .42 - this.cakeView.pitch) * viewEase;
      this.canvas.dataset.cakeYaw = this.cakeView.yaw.toFixed(3);
      this.canvas.dataset.cakePitch = this.cakeView.pitch.toFixed(3);
      const cosYaw = Math.cos(this.cakeView.yaw), sinYaw = Math.sin(this.cakeView.yaw);
      const cosPitch = Math.cos(this.cakeView.pitch), sinPitch = Math.sin(this.cakeView.pitch);
      const flameDepth = -149 * sinPitch;
      const flameX = cx;
      const flameY = cy + (-149 * cosPitch + flameDepth * .27) * scale;
      const liveFlameX = flameX + blowSway * scale;
      const elapsed = time - this.cakeStartedAt;
      for (const star of this.cakeHaloStars) {
        const angle = star.phase + elapsed * star.speed;
        const spread = 1 + move * .28 + fireworkMove * .42;
        const px = (star.nx * this.w / scale + Math.cos(angle) * star.orbit) * spread;
        const pz = star.z * spread + Math.sin(angle) * star.orbit;
        const py = (star.ny * this.h / scale + Math.sin(time * .0012 + star.phase) * 10) * spread;
        const rotatedX = px * cosYaw + pz * sinYaw;
        const yawDepth = -px * sinYaw + pz * cosYaw;
        const rotatedY = py * cosPitch - yawDepth * sinPitch;
        const depth = py * sinPitch + yawDepth * cosPitch;
        const twinkle = .45 + .4 * Math.sin(time * .0022 + star.phase);
        const starPerspective = Math.max(.62, Math.min(1.5, 1 + depth / 720));
        const starAlpha = reveal * twinkle * (1 - p * .72) * (.78 + starPerspective * .22) * star.alpha;
        ctx.globalAlpha = starAlpha;
        ctx.fillStyle = depth > 0 ? '#f0deff' : '#a9cae2';
        const sx = cx + rotatedX * scale;
        const sy = cy + (rotatedY + depth * .27) * scale;
        const radius = star.size * scale * starPerspective;
        if (star.layer === 'near') {
          ctx.globalAlpha = starAlpha * .24;
          ctx.fillRect(sx - radius * 3.2, sy - .35, radius * 6.4, .7);
          ctx.fillRect(sx - .35, sy - radius * 3.2, .7, radius * 6.4);
          ctx.globalAlpha = starAlpha;
        }
        ctx.beginPath(); ctx.arc(sx, sy, radius, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.save(); ctx.globalAlpha = Math.max(0, (.1 + hover / 260) * (1 - p)); ctx.filter = `blur(${8 * scale}px)`; ctx.fillStyle = '#9174ad';
      ctx.beginPath(); ctx.ellipse(cx, this.h * .56 + 116 * scale, 105 * scale, 15 * scale, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.save(); ctx.globalAlpha = (.2 - Math.abs(hover) * .005) * (1 - p); ctx.setLineDash([2 * scale, 9 * scale]); ctx.lineDashOffset = -time * .012; ctx.strokeStyle = '#c4a7dc'; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.ellipse(cx, this.h * .56 + 115 * scale, 136 * scale, 25 * scale, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      const glow = ctx.createRadialGradient(cx, cy - 40, 0, cx, cy - 40, 245 * scale);
      glow.addColorStop(0, `rgba(178,134,196,${.13 * (1 - p)})`); glow.addColorStop(1, 'transparent'); ctx.fillStyle = glow; ctx.fillRect(0, 0, this.w, this.h);
      if (lightUp > 0) {
        const flameGlow = ctx.createRadialGradient(liveFlameX, flameY, 1, liveFlameX, flameY, 54 * scale);
        flameGlow.addColorStop(0, `rgba(255,226,157,${.34 * lightUp * (1 - p)})`);
        flameGlow.addColorStop(.24, `rgba(255,177,92,${.18 * lightUp * (1 - p)})`);
        flameGlow.addColorStop(1, 'transparent'); ctx.fillStyle = flameGlow; ctx.fillRect(liveFlameX - 60 * scale, flameY - 60 * scale, 120 * scale, 120 * scale);
      }
      let repelled = 0;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let index = 0; index < this.particles.length; index++) {
        const point = this.particles[index];
        const drift = this.reduced ? 0 : Math.sin(time * .001 + point.phase) * 1.6;
        const rotatedX = point.x * cosYaw + point.z * sinYaw;
        const yawDepth = -point.x * sinYaw + point.z * cosYaw;
        const rotatedY = point.y * cosPitch - yawDepth * sinPitch;
        const depth = point.y * sinPitch + yawDepth * cosPitch;
        const projectedX = rotatedX;
        const projectedY = rotatedY + depth * .27;
        const depthLight = Math.max(.62, Math.min(1.12, .86 + depth / 520));
        const particleAlpha = (.35 + reveal * .65) * (1 - p * .88) * (.76 + .24 * Math.sin(time * .001 + point.phase)) * depthLight;
        ctx.globalAlpha = particleAlpha;
        ctx.fillStyle = point.color;
        const baseX = point.sx + (projectedX - point.sx) * reveal;
        const baseY = point.sy + (projectedY - point.sy) * reveal;
        const fireX = point.fx * fireworkMove, fireY = point.fy * fireworkMove;
        const targetX = cx + baseX * scale + point.dx * move + fireX;
        const targetY = cy + baseY * scale + point.dy * move + fireY + drift;
        if (this.pointerScreen.active && this.mode === 'cake' && p < .04) {
          const mx = targetX + point.ox - this.pointerScreen.x, my = targetY + point.oy - this.pointerScreen.y;
          const distance = Math.hypot(mx, my), radius = this.w < 600 ? 72 : 105;
          if (distance > .1 && distance < radius) { const force = (1 - distance / radius) * 1.45 * (dt / 16); point.vx += mx / distance * force; point.vy += my / distance * force; }
        }
        const frameScale = dt / 16;
        point.vx += -point.ox * .035 * frameScale; point.vy += -point.oy * .035 * frameScale;
        const damping = Math.pow(.84, frameScale); point.vx *= damping; point.vy *= damping;
        point.ox += point.vx * frameScale; point.oy += point.vy * frameScale;
        if (Math.abs(point.ox) + Math.abs(point.oy) > 1) repelled++;
        const x = targetX + point.ox, y = targetY + point.oy;
        const perspective = Math.max(.82, Math.min(1.18, 1 + depth / 900));
        const trailX = point.vx * 3 + (fireworkProgress && fireworkProgress < .45 ? point.fx * .035 : 0);
        const trailY = point.vy * 3 + (fireworkProgress && fireworkProgress < .45 ? point.fy * .035 : 0);
        if (index % 2 === 0 && Math.abs(trailX) + Math.abs(trailY) > 1.4) { ctx.globalAlpha = particleAlpha * .28; ctx.strokeStyle = point.color; ctx.lineWidth = Math.max(.45, point.size * .45); ctx.beginPath(); ctx.moveTo(x - trailX, y - trailY); ctx.lineTo(x, y); ctx.stroke(); }
        if (index % 7 === 0) { const glowSize = point.size * scale * perspective * 3.2; ctx.globalAlpha = particleAlpha * .14; ctx.fillRect(x - glowSize * .35, y - glowSize * .35, glowSize, glowSize); }
        ctx.globalAlpha = particleAlpha;
        ctx.fillRect(x, y, point.size * scale * perspective, point.size * scale * perspective);
      }
      ctx.restore(); this.canvas.dataset.repelled = String(repelled);
      if (lightUp > 0) {
        const flicker = this.reduced ? 0 : Math.sin(time * .019) * 1.4 + Math.sin(time * .043) * .7;
        const flameHeight = (12 + lightUp * 11 + flicker) * scale;
        const flameWidth = (3 + lightUp * 3.4 + Math.sin(time * .027) * .55) * scale;
        const flameGradient = ctx.createLinearGradient(liveFlameX, flameY - flameHeight, liveFlameX, flameY + 5 * scale);
        flameGradient.addColorStop(0, '#ff9f43'); flameGradient.addColorStop(.48, '#ffd37d'); flameGradient.addColorStop(.78, '#fff3c2'); flameGradient.addColorStop(1, '#7ca7da');
        ctx.save(); ctx.globalAlpha = lightUp * (1 - p); ctx.shadowColor = '#ffbd65'; ctx.shadowBlur = 15 * scale;
        ctx.beginPath(); ctx.moveTo(liveFlameX + flicker * .45, flameY - flameHeight);
        ctx.bezierCurveTo(liveFlameX - flameWidth * 1.15, flameY - flameHeight * .38, liveFlameX - flameWidth, flameY + flameHeight * .28, liveFlameX, flameY + 4 * scale);
        ctx.bezierCurveTo(liveFlameX + flameWidth, flameY + flameHeight * .25, liveFlameX + flameWidth * .95, flameY - flameHeight * .35, liveFlameX + flicker * .45, flameY - flameHeight);
        ctx.fillStyle = flameGradient; ctx.fill();
        ctx.beginPath(); ctx.moveTo(liveFlameX + flicker * .2, flameY - flameHeight * .5); ctx.quadraticCurveTo(liveFlameX - flameWidth * .42, flameY, liveFlameX, flameY + 2 * scale); ctx.quadraticCurveTo(liveFlameX + flameWidth * .42, flameY, liveFlameX + flicker * .2, flameY - flameHeight * .5); ctx.fillStyle = '#fffbe8'; ctx.shadowBlur = 5 * scale; ctx.fill();
        ctx.restore();
        if (ignition < .72 && !this.reduced) {
          ctx.fillStyle = `rgba(255,211,125,${Math.sin(ignition * Math.PI)})`;
          for (let i = 0; i < 8; i++) { const seed = (i * 1.71 + ignition * 6.4) % 1; const angle = i * 2.3; const sx = flameX + Math.cos(angle) * seed * 14 * scale; const sy = flameY - seed * 34 * scale; ctx.fillRect(sx, sy, (1.8 - seed) * scale, (1.8 - seed) * scale); }
        }
      }
      if (smoke > 0 && !this.reduced) {
        ctx.save(); ctx.globalAlpha = smoke * .32 * (1 - p); ctx.strokeStyle = '#c7bdd0'; ctx.lineWidth = 1.15 * scale; ctx.filter = `blur(${1.4 * scale}px)`;
        const sway = Math.sin(time * .004) * 6 * scale;
        ctx.beginPath(); ctx.moveTo(flameX, flameY); ctx.bezierCurveTo(flameX - 8 * scale, flameY - 15 * scale, flameX + sway, flameY - 28 * scale, flameX + sway * .4, flameY - 43 * scale); ctx.stroke(); ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (this.cakeReady && this.pendingFirework && this.mode === 'cake') { this.pendingFirework = false; this.firework(); }
      if (this.cakeReady && this.pendingCakeProgress > 0 && this.mode === 'cake') { const pending = this.pendingCakeProgress; this.pendingCakeProgress = 0; this.setCakeScatter(pending, this.onDone); }
      if (this.cakeReady && this.pendingScatter && this.mode === 'cake') { const pending = this.pendingScatter; this.pendingScatter = null; this.scatter(pending); }
      if (p === 1) this.finishCake();
    }
    if (this.mode === 'universe' && this.universeParticles?.length) {
      const transition = Math.min(1, (time - this.universeStartedAt) / (this.reduced ? 500 : 1800));
      const ease = transition < .5 ? 4 * transition ** 3 : 1 - (-2 * transition + 2) ** 3 / 2;
      const elapsed = Math.max(0, time - this.universeStartedAt);
      const view = this.universeView || { progress: 0, x: this.pointer.x * 2, y: this.pointer.y * 2 };
      this.universeVelocity = (this.universeVelocity || 0) * .9;
      const cx = this.w / 2 - view.x * 42, cy = this.h * .51 - view.y * 28;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let index = 0; index < this.universeParticles.length; index++) {
        const point = this.universeParticles[index];
        const angle = point.angle + elapsed * point.speed;
        const orbitX = Math.cos(angle) * point.radius;
        const orbitY = Math.sin(angle) * point.yRadius;
        const rawDepth = Math.sin(angle) * point.depth + view.progress * 180;
        const depth = ((rawDepth + 600) % 1200 + 1200) % 1200 - 600;
        const x = cx + point.startX + (orbitX - point.startX) * ease + view.x * depth * .14;
        const y = cy + point.startY + (orbitY - point.startY) * ease + Math.sin(time * .0008 + point.phase) * 4 + view.y * depth * .1;
        const perspective = Math.max(.48, Math.min(1.65, 1 + depth / 760));
        const alpha = (.16 + perspective * .25) * (.72 + Math.sin(time * .0012 + point.phase) * .2);
        const size = point.size * perspective;
        ctx.globalAlpha = alpha; ctx.fillStyle = point.color;
        const streak = Math.min(18, Math.abs(this.universeVelocity || 0) * 250 * perspective);
        if (streak > 1 && index % 3 === 0) {
          const vx = x - cx, vy = y - cy, length = Math.max(1, Math.hypot(vx, vy));
          ctx.globalAlpha = alpha * .32; ctx.strokeStyle = point.color; ctx.lineWidth = Math.max(.4, size * .35);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - vx / length * streak, y - vy / length * streak); ctx.stroke();
          ctx.globalAlpha = alpha;
        }
        if (index % 6 === 0) { ctx.globalAlpha = alpha * .23; ctx.fillRect(x - size * 1.8, y - size * 1.8, size * 4.2, size * 4.2); ctx.globalAlpha = alpha; }
        ctx.fillRect(x, y, size, size);
      }
      ctx.restore(); ctx.globalAlpha = 1;
    }
    if (this.mode === 'gather') {
      this.burstTime += dt; const p = Math.min(1, this.burstTime / (this.reduced ? 300 : 1800));
      for (const s of this.gatherStars) {
        const targetX = this.w / 2 + Math.cos(s.phase) * 70;
        const targetY = this.h / 2 + Math.sin(s.phase) * 40;
        const ease = p * p * (3 - 2 * p);
        ctx.fillStyle = `rgba(237,209,172,${p * .8})`;
        ctx.beginPath(); ctx.arc(s.x + (targetX - s.x) * ease, s.y + (targetY - s.y) * ease, 1.5, 0, Math.PI * 2); ctx.fill();
      }
      if (p === 1) { this.mode = 'letter'; this.onDone?.(); }
    }
    this.raf = requestAnimationFrame(this.frame);
  }
}
