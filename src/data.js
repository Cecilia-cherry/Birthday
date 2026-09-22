export const MAX_PHOTOS = 10;
export function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function daysTogether(start, now = new Date()) {
  const [y, m, d] = start.split('-').map(Number);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((today - Date.UTC(y, m - 1, d)) / 86400000));
}
let dbPromise;
function db() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('our-universe-' + (window.__UNIVERSE_EXPORT__ || 'draft'), 1);
    request.onupgradeneeded = () => request.result.createObjectStore('memories');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}
export async function loadSaved(id) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = database.transaction('memories').objectStore('memories').get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function saveMemory(place) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('memories', 'readwrite');
    tx.objectStore('memories').put(place, place.id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('保存中断'));
  });
}
export async function compressPhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) throw new Error('请选择 JPG、PNG、WebP 或 AVIF 照片；HEIC 请先转换为 JPG。');
  if (file.size > 30 * 1024 * 1024) throw new Error('单张照片请小于 30 MB。');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', 0.82);
  } finally { bitmap.close(); }
}
export function preloadPhotos(place, current = place.cover || 0) {
  if (!place.photos.length) return;
  const indices = new Set([current, (current + 1) % place.photos.length, (current - 1 + place.photos.length) % place.photos.length]);
  for (const index of indices) { const image = new Image(); image.src = place.photos[index]; image.decode?.().catch(() => {}); }
}
