export function parseTagValue(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (/^akku-tracker:\/\//i.test(value)) return value.replace(/^akku-tracker:\/\//i, '').split(/[/?#]/)[0];
  try {
    const url = new URL(value);
    return url.searchParams.get('battery') || url.hash.replace(/^#scan=/, '') || url.pathname.split('/').filter(Boolean).pop() || value;
  } catch {
    return value.replace(/^akku-tracker:\/\//i, '').replace(/^#scan=/i, '').trim();
  }
}

export function shouldCountScan(now, previous, cooldownMs = 60_000) {
  return previous == null || now - previous >= cooldownMs;
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createBackup(state) {
  return {
    format: 'akku-tracker-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    batteries: structuredClone(state.batteries || []),
    copters: structuredClone(state.copters || []),
    events: structuredClone(state.events || []),
    lastCopterByCells: structuredClone(state.lastCopterByCells || {}),
    lastScanAt: structuredClone(state.lastScanAt || {})
  };
}

export function parseBackup(raw) {
  let value;
  try { value = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { throw new Error('Backup-Format ist ungültiges JSON.'); }
  if (value && value.format === undefined && Array.isArray(value.batteries) && Array.isArray(value.events)) {
    return { format: 'akku-tracker-backup', version: 0, exportedAt: null, batteries: structuredClone(value.batteries), copters: structuredClone(value.copters || []), events: structuredClone(value.events), lastCopterByCells: structuredClone(value.lastCopterByCells || {}), lastScanAt: {} };
  }
  if (!value || value.format !== 'akku-tracker-backup' || value.version !== 1 || !Array.isArray(value.batteries) || !Array.isArray(value.copters) || !Array.isArray(value.events) || !value.lastCopterByCells || typeof value.lastCopterByCells !== 'object' || !value.lastScanAt || typeof value.lastScanAt !== 'object') throw new Error('Backup-Format oder Backup-Version nicht unterstützt.');
  return { format: value.format, version: value.version, exportedAt: value.exportedAt || null, batteries: structuredClone(value.batteries), copters: structuredClone(value.copters), events: structuredClone(value.events), lastCopterByCells: structuredClone(value.lastCopterByCells), lastScanAt: structuredClone(value.lastScanAt) };
}
