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
