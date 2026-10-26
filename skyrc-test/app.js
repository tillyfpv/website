const $ = (id) => document.getElementById(id);

const els = {
  run: $('run-check'),
  connect: $('connect'),
  connectCard: $('connect-card'),
  connectResult: $('connect-result'),
  deviceInfo: $('device-info'),
  readChannel: $('read-channel'),
  telemetry: $('telemetry'),
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

let channelCharacteristic = null;
let channelResponseHandler = null;
let channelResponseReceived = false;

function channelRequest(channel = 0) {
  const packet = new Uint8Array(21);
  packet[0] = 0x0f;
  packet[1] = 0x55;
  packet[2] = channel;
  let checksum = 0;
  for (let i = 0; i < 20; i += 1) checksum = (checksum + packet[i]) & 0xff;
  packet[20] = checksum;
  return packet;
}

function parseChannelResponse(data) {
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (bytes.length < 21 || bytes[0] !== 0x0f || bytes[1] !== 0x55) {
    return `Unbekannte Antwort (${bytes.length} Bytes): ${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ')}`;
  }
  const u16 = (index) => (bytes[index] << 8) | bytes[index + 1];
  const status = {
    0: 'Stand-by', 1: 'Laden', 2: 'Entladen', 3: 'Pause', 4: 'Fertig',
    128: 'Eingangsspannung zu niedrig', 129: 'Eingangsspannung zu hoch',
    132: 'Verbindung unterbrochen', 134: 'Kapazitätslimit', 135: 'Zeitlimit',
    136: 'Ladegerät zu heiß', 137: 'Akku zu heiß', 138: 'Kurzschluss', 139: 'Verpolung'
  }[bytes[6]] || `Unbekannt (${bytes[6]})`;
  return [
    `Kanal ${String.fromCharCode(65 + bytes[2])}`,
    `Status: ${status}`,
    `Spannung: ${(u16(9) / 1000).toFixed(3)} V`,
    `Strom: ${(u16(11) / 1000).toFixed(3)} A`,
    `Kapazität: ${u16(13)} mAh`,
    `Temperatur: ${bytes[15]} °C`,
    `Laufzeit: ${Math.floor(u16(7) / 60)}:${String(u16(7) % 60).padStart(2, '0')}`,
    `Rückmeldung: ${bytes.length} Bytes`
  ].join('\n');
}

function handleChannelValue(event, source = 'notification') {
  if (source === 'notification') channelResponseReceived = true;
  els.telemetry.textContent = `${source === 'notification' ? 'Benachrichtigung' : 'Lesen'}:\n${parseChannelResponse(event.target.value)}`;
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
  els.deviceInfo.textContent = '';
  let server;
  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      // SkyRC/MC3000-style BLE service; no charge command is sent.
      optionalServices: ['0000ffe0-0000-1000-8000-00805f9b34fb']
    });
    els.connectResult.textContent = `Gerät ausgewählt: ${device.name || 'Name nicht übertragen'}. GATT-Verbindung wird geprüft …`;
    if (!device.gatt) throw new Error('Dieses Gerät stellt keine GATT-Verbindung bereit.');
    device.addEventListener('gattserverdisconnected', () => {
      els.connectResult.textContent = 'Bluetooth-Gerät wurde getrennt.';
    });
    server = await device.gatt.connect();
    const services = await server.getPrimaryServices();
    const lines = [`GATT verbunden: ${device.name || 'Name nicht übertragen'}`, `Dienste: ${services.length}`];
    for (const service of services) {
      lines.push(`\nService ${service.uuid}`);
      try {
        const characteristics = await service.getCharacteristics();
        for (const characteristic of characteristics) {
          const p = characteristic.properties;
          const flags = ['read', 'write', 'writeWithoutResponse', 'notify', 'indicate']
            .filter(flag => p[flag]).join(', ');
          lines.push(`  Characteristic ${characteristic.uuid}${flags ? ` (${flags})` : ''}`);
          if (characteristic.uuid.toLowerCase() === 'ffe1' || characteristic.uuid.toLowerCase().endsWith('ffe1')) {
            channelCharacteristic = characteristic;
          }
        }
      } catch (error) {
        lines.push(`  Charakteristiken nicht lesbar: ${error?.message || error}`);
      }
    }
    els.connectResult.textContent = 'GATT-Verbindung erfolgreich. Noch keine Ladeparameter gelesen.';
    els.deviceInfo.textContent = lines.join('\n');
    if (channelCharacteristic) {
      channelResponseHandler = handleChannelValue;
      if (channelCharacteristic.properties.notify) {
        await channelCharacteristic.startNotifications();
        channelCharacteristic.addEventListener('characteristicvaluechanged', channelResponseHandler);
      }
      els.readChannel.classList.remove('hidden');
      els.telemetry.textContent = 'Bereit für eine reine Statusabfrage von Kanal A.';
    }
  } catch (error) {
    if (error?.name === 'NotFoundError') {
      els.connectResult.textContent = 'Kein Gerät ausgewählt oder Suche abgebrochen.';
    } else {
      els.connectResult.textContent = `Verbindungstest fehlgeschlagen: ${error?.message || error}`;
    }
  } finally {
    els.connect.disabled = false;
  }
});

els.readChannel.addEventListener('click', async () => {
  if (!channelCharacteristic) return;
  els.readChannel.disabled = true;
  els.telemetry.textContent = 'Kanal A wird abgefragt …';
  try {
    channelResponseReceived = false;
    const packet = channelRequest(0);
    if (channelCharacteristic.properties.writeWithoutResponse) {
      await channelCharacteristic.writeValueWithoutResponse(packet);
    } else if (channelCharacteristic.properties.write) {
      await channelCharacteristic.writeValue(packet);
    } else {
      throw new Error('FFE1 unterstützt kein Schreiben.');
    }
    // Viele SkyRC-Geräte antworten per Notification. Nur wenn keine Notification kam, lesen wir ersatzweise zurück.
    await new Promise(resolve => setTimeout(resolve, 600));
    if (!channelResponseReceived && channelCharacteristic.properties.read) {
      const value = await channelCharacteristic.readValue();
      handleChannelValue({ target: { value } }, 'read');
    }
    if (!channelResponseReceived && !channelCharacteristic.properties.read) {
      els.telemetry.textContent = 'Keine Notification und keine lesbare Antwort erhalten.';
    }
  } catch (error) {
    els.telemetry.textContent = `Statusabfrage fehlgeschlagen: ${error?.message || error}`;
  } finally {
    els.readChannel.disabled = false;
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

