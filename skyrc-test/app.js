const $ = (id) => document.getElementById(id);

const els = {
  run: $('run-check'),
  connect: $('connect'),
  connectCard: $('connect-card'),
  connectResult: $('connect-result'),
  dot: $('status-dot'),
  overall: $('overall-status'),
  detail: $('status-detail'),
  secure: $('secure-value'),
  bluetooth: $('bluetooth-value'),
  browser: $('browser-value')
};

function setDot(state) {
  els.dot.className = `status-dot ${state}`;
}

function browserName() {
  const ua = navigator.userAgent;
  if (/CriOS/i.test(ua)) return 'Chrome auf iPhone/iPad';
  if (/FxiOS/i.test(ua)) return 'Firefox auf iPhone/iPad';
  if (/EdgiOS/i.test(ua)) return 'Edge auf iPhone/iPad';
  if (/Safari/i.test(ua) && /iPhone|iPad|iPod/i.test(ua)) return 'Safari auf iPhone/iPad';
  if (/Chrome/i.test(ua)) return 'Chrome';
  if (/Firefox/i.test(ua)) return 'Firefox';
  if (/Safari/i.test(ua)) return 'Safari';
  return 'Unbekannter Browser';
}

function setValue(element, value, state = '') {
  element.textContent = value;
  element.className = state;
}

function checkBrowser() {
  const secure = window.isSecureContext === true;
  const hasBluetooth = 'bluetooth' in navigator && typeof navigator.bluetooth?.requestDevice === 'function';
  const name = browserName();

  setValue(els.secure, secure ? 'Ja' : 'Nein', secure ? 'ok' : 'bad');
  setValue(els.bluetooth, hasBluetooth ? 'Vorhanden' : 'Nicht vorhanden', hasBluetooth ? 'ok' : 'bad');
  setValue(els.browser, name);

  if (!secure) {
    setDot('bad');
    els.overall.textContent = 'Kein sicherer Zugriff';
    els.detail.textContent = 'Bluetooth aus Webseiten benötigt HTTPS (oder localhost beim lokalen Test).';
    els.connectCard.classList.add('hidden');
    return { secure, hasBluetooth };
  }

  if (!hasBluetooth) {
    setDot('bad');
    els.overall.textContent = 'Browser unterstützt es nicht';
    els.detail.textContent = 'Dieser Browser stellt keine Web-Bluetooth-Schnittstelle bereit. Auf iPhone/iPad ist das bei Safari und iOS-Browsern der normale Stand.';
    els.connectCard.classList.add('hidden');
    return { secure, hasBluetooth };
  }

  setDot('good');
  els.overall.textContent = 'Technisch möglich – Verbindung testen';
  els.detail.textContent = 'Der Browser stellt Web Bluetooth bereit. Das tatsächliche SkyRC-Protokoll ist damit noch nicht bestätigt.';
  els.connectCard.classList.remove('hidden');
  return { secure, hasBluetooth };
}

els.run.addEventListener('click', checkBrowser);

els.connect.addEventListener('click', async () => {
  els.connect.disabled = true;
  els.connectResult.textContent = 'Bluetooth-Auswahldialog wird geöffnet …';
  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: []
    });
    els.connectResult.textContent = `Gerät ausgewählt: ${device.name || 'Name nicht übertragen'}. Noch keine SkyRC-Daten gelesen.`;
  } catch (error) {
    if (error?.name === 'NotFoundError') {
      els.connectResult.textContent = 'Kein Gerät ausgewählt oder Suche abgebrochen.';
    } else {
      els.connectResult.textContent = `Verbindungstest abgebrochen: ${error?.message || error}`;
    }
  } finally {
    els.connect.disabled = false;
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
