import { parseTagValue, shouldCountScan, todayKey } from './logic.mjs';

const DB_NAME = 'akku-tracker-db';
const STORE = 'state';
const COOLDOWN_MS = 60_000;
const state = { batteries: [], events: [], lastScanAt: {}, view: 'scan', selectedId: null };
const $ = (id) => document.getElementById(id);

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function loadState() {
  try {
    const db = await openDb();
    const value = await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get('data');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (value) Object.assign(state, value);
  } catch (error) {
    console.warn('IndexedDB unavailable', error);
    const value = localStorage.getItem('akku-tracker-state');
    if (value) Object.assign(state, JSON.parse(value));
  }
}
async function saveState() {
  const snapshot = JSON.parse(JSON.stringify({ batteries: state.batteries, events: state.events, lastScanAt: state.lastScanAt }));
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(snapshot, 'data');
      req.onsuccess = resolve; req.onerror = () => reject(req.error);
    });
  } catch {
    localStorage.setItem('akku-tracker-state', JSON.stringify(snapshot));
  }
}
function uid() { return `BAT-${String(state.batteries.length + 1).padStart(3, '0')}`; }
function batteryById(id) { return state.batteries.find((b) => b.id === id); }
function showToast(message, kind = 'ok') { const el = $('toast'); el.textContent = message; el.dataset.kind = kind; el.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => el.classList.remove('show'), 2600); }
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function statusLabel(status) { return ({ ok: 'OK', observe: 'Beobachten', damaged: 'Angeschlagen', broken: 'Kaputt', retired: 'Ausgemustert' })[status] || 'OK'; }
function statusClass(status) { return ({ ok: 'status-ok', observe: 'status-observe', damaged: 'status-damaged', broken: 'status-broken', retired: 'status-retired' })[status] || 'status-ok'; }
function formatDate(iso) { return iso ? new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso)) : '—'; }
function formatPrice(value) { return value === '' || value === null || value === undefined ? '—' : `${Number(value).toFixed(2).replace('.', ',')} €`; }
function render() {
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
  $('view-scan').hidden = state.view !== 'scan'; $('view-batteries').hidden = state.view !== 'batteries'; $('view-new').hidden = state.view !== 'new'; $('view-detail').hidden = state.view !== 'detail';
  const today = todayKey(); $('today-count').textContent = state.events.filter((e) => todayKey(new Date(e.at)) === today).length;
  const last = state.events.at(-1); const battery = last && batteryById(last.batteryId);
  $('last-used').textContent = battery ? `${battery.name} · Nutzung ${battery.uses}` : 'Noch kein Akku erfasst';
  $('battery-list').innerHTML = state.batteries.length ? state.batteries.map((b) => `<button class="battery-row" data-open="${b.id}"><span><strong>${esc(b.name)}</strong><small>${esc(b.id)}</small></span><span class="row-right"><b>${b.uses}</b><em class="${statusClass(b.status)}">${statusLabel(b.status)}</em></span></button>`).join('') : '<div class="empty">Noch keine Akkus angelegt.</div>';
  const selected = batteryById(state.selectedId); if (selected) renderDetail(selected);
  document.querySelectorAll('[data-open]').forEach((b) => b.onclick = () => { state.selectedId = b.dataset.open; state.view = 'detail'; render(); });
}
function renderDetail(b) { state.selectedId = b.id; $('detail-title').textContent = b.name; $('detail-id').textContent = b.id; $('detail-uses').textContent = b.uses; $('detail-status').textContent = statusLabel(b.status); $('detail-status').className = statusClass(b.status); $('detail-status-select').value = b.status; $('detail-purchase-date').textContent = formatDate(b.purchaseDate); $('detail-purchase-price').textContent = formatPrice(b.purchasePrice); $('detail-last').textContent = formatDate(b.lastUsedAt); $('detail-note').value = b.note || '';
  $('detail-events').innerHTML = state.events.filter((e) => e.batteryId === b.id).slice(-8).reverse().map((e) => `<li>${formatDate(e.at)} · Nutzung gespeichert${e.copter ? ` · ${esc(e.copter)}` : ''}</li>`).join('') || '<li>Noch keine Nutzungen</li>';
}
async function recordUse(raw) {
  const id = parseTagValue(raw).toUpperCase(); const b = batteryById(id);
  if (!b) { $('unknown-id').value = id; state.view = 'new'; render(); showToast(`Unbekannter Akku ${id}`, 'warn'); return; }
  const now = Date.now(); const previous = state.lastScanAt[id];
  if (!shouldCountScan(now, previous, COOLDOWN_MS)) { showToast(`${b.name} wurde gerade schon gezählt.`, 'warn'); state.selectedId = id; state.view = 'detail'; render(); return; }
  b.uses += 1; b.lastUsedAt = new Date(now).toISOString(); state.lastScanAt[id] = now; state.selectedId = id; state.events.push({ batteryId: id, at: b.lastUsedAt, copter: '' }); await saveState();
  $('scan-copter').value = '';
  $('result-name').textContent = b.name; $('result-uses').textContent = `Nutzung ${b.uses} gespeichert`; $('result-status').textContent = statusLabel(b.status); $('result-status').className = statusClass(b.status); $('scan-result').hidden = false; showToast(`${b.name}: Nutzung +1`); render();
}
async function decodeFile(file) {
  const bitmap = await createImageBitmap(file); const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height; const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); const image = ctx.getImageData(0, 0, canvas.width, canvas.height); if (!window.jsQR) throw new Error('QR-Modul fehlt'); const code = window.jsQR(image.data, image.width, image.height); if (!code) throw new Error('Kein QR-Code erkannt'); await recordUse(code.data);
}
function batteryQrText(id) { return id; }
function drawQr(id) {
  const qr = qrcode(0, 'M'); qr.addData(batteryQrText(id)); qr.make(); $('qr-output').innerHTML = qr.createSvgTag({ scalable: true, margin: 2 }); $('qr-label').textContent = id;
}
function openNew(prefill = '') { $('new-name').value = ''; $('new-capacity').value = ''; $('new-purchase-date').value = ''; $('new-purchase-price').value = ''; $('unknown-id').value = prefill; state.view = 'new'; render(); }
async function createBattery(event) { event.preventDefault(); const id = $('unknown-id').value.trim().toUpperCase() || uid(); if (batteryById(id)) { showToast('Diese Akku-ID gibt es bereits.', 'warn'); return; } const battery = { id, name: $('new-name').value.trim() || id, capacity: $('new-capacity').value.trim(), purchaseDate: $('new-purchase-date').value, purchasePrice: $('new-purchase-price').value === '' ? '' : Number($('new-purchase-price').value), uses: 0, status: 'ok', note: '', createdAt: new Date().toISOString(), lastUsedAt: null }; state.batteries.push(battery); await saveState(); state.selectedId = id; drawQr(id); $('new-created').hidden = false; render(); showToast(`${battery.name} angelegt`); }
async function saveScanCopter() { const event = state.events.at(-1); if (!event || event.batteryId !== state.selectedId) return; event.copter = $('scan-copter').value.trim(); await saveState(); showToast(event.copter ? `Zuordnung gespeichert: ${event.copter}` : 'Zuordnung entfernt'); }
async function saveDetail(event) { event.preventDefault(); const b = batteryById(state.selectedId); if (!b) return; b.status = $('detail-status-select').value; b.note = $('detail-note').value.trim(); await saveState(); render(); showToast('Bewertung gespeichert'); }
function showView(view) { state.view = view; $('scan-result').hidden = true; render(); }

$('scan-file').onchange = async (e) => { const file = e.target.files[0]; if (!file) return; try { await decodeFile(file); } catch (err) { showToast(err.message, 'warn'); } e.target.value = ''; };
$('manual-scan').onsubmit = (e) => { e.preventDefault(); recordUse($('manual-id').value); $('manual-id').value = ''; };
$('new-form').onsubmit = createBattery; $('detail-form').onsubmit = saveDetail;
$('new-battery').onclick = () => openNew(); if ($('go-scan')) $('go-scan').onclick = () => showView('scan'); $('continue-scan').onclick = () => { $('scan-result').hidden = true; showView('scan'); }; $('save-scan-copter').onclick = saveScanCopter;
$('show-detail').onclick = () => { state.view = 'detail'; render(); }; $('export-data').onclick = () => { const blob = new Blob([JSON.stringify({ batteries: state.batteries, events: state.events }, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `akku-tracker-${todayKey()}.json`; a.click(); URL.revokeObjectURL(a.href); };
$('cancel-new').onclick = () => showView('scan');
document.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => showView(b.dataset.view));
window.addEventListener('hashchange', () => { const match = location.hash.match(/scan=([^&]+)/); if (match) recordUse(decodeURIComponent(match[1])); });
await loadState();
if (!state.batteries.length) state.batteries.push({ id: 'BAT-001', name: 'Tattu 01', capacity: '1300 mAh', purchaseDate: '', purchasePrice: '', uses: 0, status: 'ok', note: '', createdAt: new Date().toISOString(), lastUsedAt: null });
render();
