# ESP32 Temperature Monitoring & Relay Control System

A lightweight, real-time IoT dashboard and microcontroller system for monitoring environmental temperature and humidity via a **DHT22** sensor and toggling a physical **Relay** module directly from a web browser using the **Web Serial API**.

---

## 📁 Project Structure

```text
├── index.html           # Modern responsive dashboard UI (balanced slate theme)
├── style.css            # Custom CSS styling, animations, and gauge components
├── script.js            # Web Serial API communication and real-time JSON parser
├── ESP32/
│   └── esp32_code.ino   # Arduino C++ firmware for ESP32 with DHT22 & Relay logic
└── README.md            # Wiring diagrams, instructions, and documentation
```

---

## 🔌 Hardware Circuit & Wiring

### Components Required
- **ESP32 Development Board** (NodeMCU-32S, ESP32-WROOM, etc.)
- **DHT22 (AM2302)** Temperature and Humidity Sensor
- **Relay Module** (5V or 3.3V single channel with optocoupler)
- **USB Cable** (Data-capable Micro-USB or Type-C)
- Jumper wires and breadboard

### Pin Connections

| Component | Pin / Signal | ESP32 GPIO Pin | Notes |
| :--- | :--- | :--- | :--- |
| **DHT22 Sensor** | VCC | `3.3V` or `5V` | Use 3.3V if powered directly from ESP32 |
| | DATA | `GPIO 4` | 10kΩ pull-up to VCC if using bare 4-pin sensor |
| | GND | `GND` | Ground |
| **Relay Module** | VCC | `VIN` (5V) | Relays typically require 5V for coil triggering |
| | IN (Signal) | `GPIO 5` | Control signal from ESP32 |
| | GND | `GND` | Common Ground |

> **Note:** If your relay module is **Active-LOW** (triggers when input is LOW), simply check the configuration setting at the top of [esp32_code.ino](file:///d:/Project%20Works/temperature_control_sivasankarii/ESP32/esp32_code.ino):
> ```cpp
> const bool RELAY_ACTIVE_LOW = true; // Set to true if relay activates on LOW
> ```

---

## ⚡ ESP32 Firmware Setup

1. Open **Arduino IDE** (version 2.x recommended).
2. Install the **ESP32 Board Package**:
   - Go to **Tools** > **Board** > **Boards Manager...**
   - Search for `esp32` by Espressif Systems and install it.
3. Install the required **Libraries**:
   - Go to **Sketch** > **Include Library** > **Manage Libraries...**
   - Search for **"DHT sensor library"** by *Adafruit* and install it (install all required dependencies, including *Adafruit Unified Sensor*).
4. Open [ESP32/esp32_code.ino](file:///d:/Project%20Works/temperature_control_sivasankarii/ESP32/esp32_code.ino).
5. Select your board under **Tools** > **Board** (e.g. `ESP32 Dev Module`) and select the appropriate COM Port.
6. Click **Upload**.

---

## 🌐 Running the Frontend Dashboard

### Browser Requirements
The **Web Serial API** requires:
- A compatible desktop browser: **Google Chrome**, **Microsoft Edge**, or **Opera**.
- A **secure context**: Web Serial functions on `https://` or `http://localhost`.

### Quick Local Testing
You can serve the directory using any simple HTTP static server (or directly preview):

```bash
# Using Python 3:
python -m http.server 8000

# Using Node.js npx:
npx serve .
```

Then open `http://localhost:8000` in Google Chrome or Microsoft Edge.

### Hosted Online
When hosting the files on GitHub Pages, Netlify, Vercel, or Cloudflare Pages, HTTPS is automatically enabled, and the Web Serial API will work seamlessly.

---

## 🖥️ How to Use the System

1. **Connect the ESP32** to your computer via USB.
2. ⚠️ **Important:** Make sure the **Arduino IDE Serial Monitor is closed**! A serial port can only be opened by one program at a time.
3. In the browser, click **"Connect ESP32"**.
4. In the browser's native serial device picker, select your ESP32's USB-to-UART bridge (e.g., *CP2102*, *CH340*, or *USB JTAG/serial debug unit*), and click **Connect**.
5. Once connected:
   - The status badge will switch to **Connected** (pulsing green indicator).
   - Real-time temperature (°C / °F) and relative humidity (%) readings will update every 2 seconds.
   - Click **"Relay ON"** to energize the relay or **"Relay OFF"** to deactivate it.
   - The **Serial Stream & Debug Console** at the bottom will display raw JSON packets and confirmation messages.
6. **Demo Mode**: If you don't have physical hardware plugged in, you can flip the **Demo Mode** toggle to test and preview all gauges, relay states, and telemetry animations!

---

## 📡 Serial Protocol Reference

- **Baud Rate:** `115200` (8-N-1)
- **ESP32 Telemetry Broadcast (Every 2 seconds & on state change):**
  ```json
  {"temperature":26.5,"humidity":60.2,"relay":"ON","sensor_ok":true}
  ```
- **Browser to ESP32 Commands:**
  - `ON\n` -> Energizes the relay and returns updated status JSON.
  - `OFF\n` -> De-energizes the relay and returns updated status JSON.
  - `STATUS\n` -> Immediately requests current telemetry payload.
