/**
 * ESP32 Temperature Monitoring & Relay Control System
 * Web Serial API Client & Live Dashboard Logic
 */

// Application State
const state = {
  port: null,
  reader: null,
  writer: null,
  keepReading: false,
  isConnected: false,
  isDemoMode: false,
  demoTimer: null,
  relayState: 'OFF',
  temperature: null,
  humidity: null,
};

// DOM Elements
const elements = {
  unsupportedBanner: document.getElementById('unsupported-banner'),
  connectionBadge: document.getElementById('connection-badge'),
  connectionStatusText: document.getElementById('connection-status-text'),
  baudRateSelect: document.getElementById('baud-rate-select'),
  btnConnect: document.getElementById('btn-connect'),
  btnDisconnect: document.getElementById('btn-disconnect'),
  
  // Metrics - Temperature
  tempValue: document.getElementById('temp-value'),
  tempFahrenheit: document.getElementById('temp-fahrenheit'),
  tempCategory: document.getElementById('temp-category'),
  tempBar: document.getElementById('temp-bar'),
  tempSensorPill: document.getElementById('temp-sensor-pill'),

  // Metrics - Humidity
  humidityValue: document.getElementById('humidity-value'),
  humidityCategory: document.getElementById('humidity-category'),
  humidityBar: document.getElementById('humidity-bar'),
  humiditySensorPill: document.getElementById('humidity-sensor-pill'),

  // Relay Controls
  relayStateTag: document.getElementById('relay-state-tag'),
  relayIndicator: document.getElementById('relay-indicator'),
  relayStatusText: document.getElementById('relay-status-text'),
  btnRelayOn: document.getElementById('btn-relay-on'),
  btnRelayOff: document.getElementById('btn-relay-off'),
  relaySubnote: document.getElementById('relay-subnote'),

  // Terminal & Stream
  serialTerminal: document.getElementById('serial-terminal'),
  lastUpdate: document.getElementById('last-update'),
  demoModeToggle: document.getElementById('demo-mode-toggle'),
  btnClearTerminal: document.getElementById('btn-clear-terminal'),
  customCommandInput: document.getElementById('custom-command-input'),
  btnSendCommand: document.getElementById('btn-send-command'),

  // Toast Notification
  toastMessage: document.getElementById('toast-message'),
  toastText: document.getElementById('toast-text'),
  btnCloseToast: document.getElementById('btn-close-toast')
};

// Check Web Serial API Support
function checkBrowserSupport() {
  const isSupported = 'serial' in navigator;
  if (!isSupported) {
    elements.unsupportedBanner.classList.remove('hidden');
    elements.btnConnect.disabled = true;
    logTerminal('System', 'Web Serial API is not supported in this browser. Please use Chrome/Edge on Desktop.', 'error-line');
  }
  return isSupported;
}

// Toast Notifications
let toastTimeout = null;
function showToast(message, type = 'info') {
  if (toastTimeout) clearTimeout(toastTimeout);

  elements.toastText.textContent = message;
  elements.toastMessage.className = `toast-message toast-${type}`;
  elements.toastMessage.classList.remove('hidden');

  toastTimeout = setTimeout(() => {
    elements.toastMessage.classList.add('hidden');
  }, 4500);
}

// Close Toast
elements.btnCloseToast.addEventListener('click', () => {
  elements.toastMessage.classList.add('hidden');
});

// Terminal Logging Utility
function logTerminal(prefix, message, lineClass = '') {
  const line = document.createElement('div');
  line.className = `log-line ${lineClass}`;
  
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  line.textContent = `[${timeStr}] [${prefix}] ${message}`;

  elements.serialTerminal.appendChild(line);

  // Keep terminal buffer capped at 150 lines
  while (elements.serialTerminal.childNodes.length > 150) {
    elements.serialTerminal.removeChild(elements.serialTerminal.firstChild);
  }

  // Auto-scroll to bottom
  elements.serialTerminal.scrollTop = elements.serialTerminal.scrollHeight;
}

// Clear Terminal
elements.btnClearTerminal.addEventListener('click', () => {
  elements.serialTerminal.innerHTML = '';
  logTerminal('System', 'Console cleared.', 'system-line');
});

// Update Dashboard UI with Data Packet
function updateDashboard(data) {
  const timestamp = new Date().toLocaleTimeString();
  elements.lastUpdate.textContent = `Last packet: ${timestamp}`;

  // 1. Process Temperature
  if (data.temperature !== null && data.temperature !== undefined && !isNaN(data.temperature)) {
    const tempC = parseFloat(data.temperature);
    const tempF = (tempC * 9 / 5) + 32;

    elements.tempValue.textContent = tempC.toFixed(1);
    elements.tempFahrenheit.textContent = `${tempF.toFixed(1)} °F`;

    // Calculate Gauge Bar percentage (0°C to 50°C scale)
    const tempPercent = Math.min(Math.max((tempC / 50) * 100, 0), 100);
    elements.tempBar.style.width = `${tempPercent}%`;

    // Temperature classification
    if (tempC < 18) {
      elements.tempCategory.textContent = 'Cool / Low';
    } else if (tempC <= 27) {
      elements.tempCategory.textContent = 'Comfortable / Optimal';
    } else if (tempC <= 35) {
      elements.tempCategory.textContent = 'Warm';
    } else {
      elements.tempCategory.textContent = 'Hot / High Alert';
    }

    elements.tempSensorPill.className = 'sensor-pill sensor-ok';
    elements.tempSensorPill.textContent = 'DHT22 Normal';
  } else {
    elements.tempValue.textContent = '--.-';
    elements.tempFahrenheit.textContent = '--.- °F';
    elements.tempBar.style.width = '0%';
    elements.tempCategory.textContent = 'Sensor read error';
    elements.tempSensorPill.className = 'sensor-pill sensor-error';
    elements.tempSensorPill.textContent = 'Sensor Error';
    showToast('Warning: Unable to read temperature from DHT22 sensor.', 'warning');
  }

  // 2. Process Humidity
  if (data.humidity !== null && data.humidity !== undefined && !isNaN(data.humidity)) {
    const hum = parseFloat(data.humidity);
    elements.humidityValue.textContent = hum.toFixed(1);

    // Calculate Gauge Bar percentage (0% to 100% scale)
    const humPercent = Math.min(Math.max(hum, 0), 100);
    elements.humidityBar.style.width = `${humPercent}%`;

    // Humidity classification
    if (hum < 30) {
      elements.humidityCategory.textContent = 'Dry (< 30%)';
    } else if (hum <= 60) {
      elements.humidityCategory.textContent = 'Comfortable (30% - 60%)';
    } else {
      elements.humidityCategory.textContent = 'High Humidity (> 60%)';
    }

    elements.humiditySensorPill.className = 'sensor-pill sensor-ok';
    elements.humiditySensorPill.textContent = 'DHT22 Normal';
  } else {
    elements.humidityValue.textContent = '--.-';
    elements.humidityBar.style.width = '0%';
    elements.humidityCategory.textContent = 'Sensor read error';
    elements.humiditySensorPill.className = 'sensor-pill sensor-error';
    elements.humiditySensorPill.textContent = 'Sensor Error';
  }

  // 3. Process Relay Status
  if (data.relay) {
    const relayNormalized = String(data.relay).trim().toUpperCase();
    applyRelayState(relayNormalized);
  }
}

// Apply Relay State in Dashboard
function applyRelayState(relayStatus) {
  state.relayState = relayStatus;

  if (relayStatus === 'ON') {
    elements.relayStateTag.className = 'status-tag tag-on';
    elements.relayStateTag.textContent = 'RELAY ON';

    elements.relayIndicator.className = 'relay-glow-indicator on';
    elements.relayStatusText.textContent = 'ACTIVE (ON)';

    elements.btnRelayOn.classList.add('active');
    elements.btnRelayOff.classList.remove('active');
  } else {
    elements.relayStateTag.className = 'status-tag tag-off';
    elements.relayStateTag.textContent = 'RELAY OFF';

    elements.relayIndicator.className = 'relay-glow-indicator off';
    elements.relayStatusText.textContent = 'INACTIVE (OFF)';

    elements.btnRelayOff.classList.add('active');
    elements.btnRelayOn.classList.remove('active');
  }
}

// Update UI Connection State
function setConnectedUI(isConnected) {
  state.isConnected = isConnected;

  if (isConnected) {
    elements.connectionBadge.className = 'status-indicator-badge connected';
    elements.connectionStatusText.textContent = 'Connected';

    elements.btnConnect.classList.add('hidden');
    elements.btnDisconnect.classList.remove('hidden');

    elements.baudRateSelect.disabled = true;
    elements.btnRelayOn.disabled = false;
    elements.btnRelayOff.disabled = false;
    elements.customCommandInput.disabled = false;
    elements.btnSendCommand.disabled = false;
    elements.relaySubnote.textContent = 'Ready: Click buttons to control the ESP32 relay';
  } else {
    elements.connectionBadge.className = 'status-indicator-badge disconnected';
    elements.connectionStatusText.textContent = 'Disconnected';

    elements.btnConnect.classList.remove('hidden');
    elements.btnDisconnect.classList.add('hidden');

    elements.baudRateSelect.disabled = false;
    elements.btnRelayOn.disabled = true;
    elements.btnRelayOff.disabled = true;
    elements.customCommandInput.disabled = true;
    elements.btnSendCommand.disabled = true;
    elements.relaySubnote.textContent = 'Connect to ESP32 to send serial commands';
  }
}

// Web Serial: Connect to ESP32
async function connectSerial() {
  if (!('serial' in navigator)) {
    showToast('Web Serial API is not supported in this browser.', 'error');
    return;
  }

  try {
    // 1. Request port from user
    logTerminal('System', 'Requesting serial port authorization...', 'system-line');
    state.port = await navigator.serial.requestPort();

    const baudRate = parseInt(elements.baudRateSelect.value, 10) || 115200;
    logTerminal('System', `Opening serial port at ${baudRate} baud...`, 'system-line');

    // 2. Open serial connection
    await state.port.open({ baudRate: baudRate });

    setConnectedUI(true);
    showToast(`Connected to ESP32 at ${baudRate} baud!`, 'success');
    logTerminal('System', `Connected successfully! Listening for telemetry...`, 'system-line');

    // 3. Start Reading stream
    state.keepReading = true;
    readSerialStream();

  } catch (err) {
    console.error('Serial Connection Error:', err);
    if (err.name === 'NotFoundError') {
      logTerminal('System', 'Port selection cancelled by user.', 'system-line');
    } else {
      const msg = err.message || 'Unknown error occurred while connecting.';
      logTerminal('Error', msg, 'error-line');
      showToast(`Connection Error: ${msg}`, 'error');
    }
    setConnectedUI(false);
  }
}

// Web Serial: Continuous Stream Reader with Line Buffering
async function readSerialStream() {
  let lineBuffer = '';
  const textDecoder = new TextDecoder();

  try {
    while (state.port && state.port.readable && state.keepReading) {
      state.reader = state.port.readable.getReader();

      try {
        while (true) {
          const { value, done } = await state.reader.read();
          if (done) {
            // Stream closed
            break;
          }

          if (value) {
            const chunk = textDecoder.decode(value, { stream: true });
            lineBuffer += chunk;

            // Split by newline delimiter
            const lines = lineBuffer.split(/\r?\n/);
            // Retain incomplete tail
            lineBuffer = lines.pop();

            for (const line of lines) {
              const cleanLine = line.trim();
              if (cleanLine.length > 0) {
                handleSerialLine(cleanLine);
              }
            }
          }
        }
      } catch (readError) {
        if (state.keepReading) {
          console.error('Read loop error:', readError);
          logTerminal('Error', `Serial read error: ${readError.message}`, 'error-line');
        }
      } finally {
        if (state.reader) {
          state.reader.releaseLock();
          state.reader = null;
        }
      }
    }
  } catch (err) {
    console.error('Stream processing error:', err);
  } finally {
    if (state.isConnected && !state.keepReading) {
      setConnectedUI(false);
    }
  }
}

// Parse Serial Line
function handleSerialLine(line) {
  // Check if it's JSON format
  if (line.startsWith('{') && line.endsWith('}')) {
    try {
      const data = JSON.parse(line);
      logTerminal('RX-JSON', line, 'rx-line');
      updateDashboard(data);
    } catch (parseError) {
      logTerminal('RX-RAW', line, 'rx-line');
    }
  } else {
    // Plain text debug message from ESP32
    logTerminal('RX-MSG', line, 'rx-line');

    // Handle plain text status responses if any (e.g. "RELAY:ON" or "RELAY:OFF")
    if (line.includes('RELAY:ON')) {
      applyRelayState('ON');
    } else if (line.includes('RELAY:OFF')) {
      applyRelayState('OFF');
    }
  }
}

// Send Command via Web Serial
async function sendSerialCommand(commandText) {
  if (state.isDemoMode) {
    // Simulate command in demo mode
    logTerminal('TX', commandText, 'tx-line');
    showToast(`[Demo] Command sent: "${commandText}"`, 'info');
    
    const cmdUpper = commandText.trim().toUpperCase();
    if (cmdUpper === 'ON' || cmdUpper === 'RELAY_ON') {
      applyRelayState('ON');
    } else if (cmdUpper === 'OFF' || cmdUpper === 'RELAY_OFF') {
      applyRelayState('OFF');
    }
    return;
  }

  if (!state.port || !state.port.writable || !state.isConnected) {
    showToast('Cannot send: ESP32 is not connected.', 'error');
    return;
  }

  try {
    const encoder = new TextEncoder();
    // Ensure command is terminated with newline
    const dataToSend = commandText.endsWith('\n') ? commandText : `${commandText}\n`;
    
    state.writer = state.port.writable.getWriter();
    await state.writer.write(encoder.encode(dataToSend));
    
    logTerminal('TX', commandText.trim(), 'tx-line');
    showToast(`Command sent: "${commandText.trim()}"`, 'success');
  } catch (err) {
    console.error('Write error:', err);
    logTerminal('Error', `Failed to send command: ${err.message}`, 'error-line');
    showToast(`Failed to send command: ${err.message}`, 'error');
  } finally {
    if (state.writer) {
      state.writer.releaseLock();
      state.writer = null;
    }
  }
}

// Disconnect from Serial Port
async function disconnectSerial() {
  state.keepReading = false;
  logTerminal('System', 'Disconnecting serial port...', 'system-line');

  try {
    if (state.reader) {
      await state.reader.cancel();
      state.reader = null;
    }
    if (state.port) {
      await state.port.close();
      state.port = null;
    }
    showToast('Disconnected from ESP32.', 'info');
    logTerminal('System', 'Serial port closed.', 'system-line');
  } catch (err) {
    console.error('Disconnect error:', err);
    logTerminal('Error', `Error closing port: ${err.message}`, 'error-line');
  } finally {
    setConnectedUI(false);
  }
}

// USB Disconnect Event (e.g., cable pulled out)
if ('serial' in navigator) {
  navigator.serial.addEventListener('disconnect', (event) => {
    if (state.port && event.target === state.port) {
      logTerminal('System', 'ESP32 device physically disconnected.', 'error-line');
      showToast('ESP32 device was unplugged.', 'warning');
      state.keepReading = false;
      state.port = null;
      setConnectedUI(false);
    }
  });
}

// Demo Mode Simulator
function toggleDemoMode(enable) {
  state.isDemoMode = enable;

  if (enable) {
    if (state.isConnected) {
      disconnectSerial();
    }
    setConnectedUI(true);
    elements.connectionStatusText.textContent = 'Demo Active';
    logTerminal('System', 'Demo Simulation Mode enabled. Generating simulated telemetry...', 'system-line');
    showToast('Demo Mode active. Simulating ESP32 telemetry.', 'info');

    // Run periodic mock telemetry
    let mockTemp = 24.5;
    let mockHum = 58.0;

    state.demoTimer = setInterval(() => {
      // Small random variations
      mockTemp += (Math.random() - 0.48) * 0.4;
      mockHum += (Math.random() - 0.48) * 0.8;

      // Keep within realistic bounds
      mockTemp = Math.max(16, Math.min(38, mockTemp));
      mockHum = Math.max(20, Math.min(85, mockHum));

      const mockPacket = {
        temperature: parseFloat(mockTemp.toFixed(1)),
        humidity: parseFloat(mockHum.toFixed(1)),
        relay: state.relayState,
        sensor_ok: true
      };

      const jsonStr = JSON.stringify(mockPacket);
      logTerminal('RX-DEMO', jsonStr, 'rx-line');
      updateDashboard(mockPacket);
    }, 2000);
  } else {
    if (state.demoTimer) {
      clearInterval(state.demoTimer);
      state.demoTimer = null;
    }
    setConnectedUI(false);
    logTerminal('System', 'Demo Mode disabled.', 'system-line');
    showToast('Demo Mode turned off.', 'info');
  }
}

// Event Listeners
elements.btnConnect.addEventListener('click', connectSerial);
elements.btnDisconnect.addEventListener('click', disconnectSerial);

elements.btnRelayOn.addEventListener('click', () => {
  sendSerialCommand('ON');
});

elements.btnRelayOff.addEventListener('click', () => {
  sendSerialCommand('OFF');
});

// Custom Command Sender
elements.btnSendCommand.addEventListener('click', () => {
  const cmd = elements.customCommandInput.value.trim();
  if (cmd) {
    sendSerialCommand(cmd);
    elements.customCommandInput.value = '';
  }
});

elements.customCommandInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    elements.btnSendCommand.click();
  }
});

// Demo Mode Toggle
elements.demoModeToggle.addEventListener('change', (e) => {
  toggleDemoMode(e.target.checked);
});

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
  checkBrowserSupport();
  logTerminal('System', 'Dashboard ready. Connect an ESP32 via USB or try Demo Mode.', 'system-line');
});
