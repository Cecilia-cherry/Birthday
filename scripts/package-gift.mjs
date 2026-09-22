import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const files = ['index.html', 'src/style.css', 'src/data.js', 'src/space.js', 'src/intro.js', 'src/app.js'];
const [shell, css, ...scripts] = await Promise.all(files.map(file => readFile(file, 'utf8')));
const code = scripts.map(s => s.replace(/^import .*;\n/gm, '').replace(/^export /gm, '')).join('\n').replace(/const icons =/, 'const esc = escapeHTML;\nconst icons =');
const template = shell.replace(/<link rel="icon"[^>]+>/, '').replace(/<link rel="stylesheet"[^>]+>/, () => `<style>${css}</style>`).replace(/<script type="module" src="[^\"]+"><\/script>/, () => `<script>__UNIVERSE_PAYLOAD__</script><script type="module">${code.replace(/<\/script/gi, '<\\/script')}</script>`);
const data = JSON.parse(await readFile('public/memories.json', 'utf8'));
const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg' };
async function inline(src) {
  if (src.startsWith('data:')) return src;
  if (/^https?:/i.test(src)) throw new Error('请先将照片或音乐下载至 public，再生成独立网页。');
  const buffer = await readFile(path.resolve(src));
  return `data:${mimeTypes[path.extname(src).toLowerCase()] || 'application/octet-stream'};base64,${buffer.toString('base64')}`;
}
for (const place of data.places) place.photos = await Promise.all(place.photos.map(inline));
if (data.music) data.music = await inline(data.music);
const safeJSON = value => JSON.stringify(value).replace(/</g, '\\u003c');
const payload = `window.__UNIVERSE_DATA__=${safeJSON(data)};window.__UNIVERSE_EXPORT__="birthday-gift";window.__UNIVERSE_TEMPLATE__=${safeJSON(template)};`;
await writeFile('欢迎进入我们的世界.html', template.replace('__UNIVERSE_PAYLOAD__', () => payload));
console.log('Created → 欢迎进入我们的世界.html · Opens offline in a browser.');
