/*
  =============================================================================
  ESP32 Temperature Monitoring & Relay Control System
  =============================================================================
  
  Hardware:
    - ESP32 Development Board (ESP32-WROOM-32 or similar)
    - DHT22 (AM2302) Temperature & Humidity Sensor
    - 5V / 3.3V Relay Module (Optocoupler-isolated)

  Wiring Configuration:
    - DHT22 VCC       -> ESP32 3.3V (or 5V depending on module)
    - DHT22 GND       -> ESP32 GND
    - DHT22 DATA      -> ESP32 GPIO 4 (Add a 10k pull-up resistor if using bare sensor)
    - Relay VCC       -> ESP32 5V (VIN)
    - Relay GND       -> ESP32 GND
    - Relay IN (Data) -> ESP32 GPIO 5

  Required Arduino Libraries:
    - DHT sensor library by Adafruit (Install via Arduino Library Manager)
    - Adafruit Unified Sensor (dependency for DHT library)

  Communication Protocol:
    - Serial Baud Rate: 115200 bps
    - Incoming commands: "ON" or "OFF" (terminated by newline \n)
    - Outgoing telemetry: JSON string per line (newline \n delimited)
      Example: {"temperature":25.4,"humidity":60.2,"relay":"ON","sensor_ok":true}
  =============================================================================
*/

#include <DHT.h>

// ==========================================
// PIN & SENSOR CONFIGURATION
// ==========================================
#define DHT_PIN         4         // Digital pin connected to DHT22 sensor DATA pin
#define DHT_TYPE        DHT22     // Sensor type: DHT22 (AM2302)
#define RELAY_PIN       5         // Digital pin connected to Relay module IN pin

// Set to true if your relay triggers on LOW (common for optocoupled relay modules)
// Set to false if your relay triggers on HIGH
const bool RELAY_ACTIVE_LOW = false;

// ==========================================
// TIMING & STATE VARIABLES
// ==========================================
DHT dht(DHT_PIN, DHT_TYPE);

bool currentRelayState = false;          // false = OFF, true = ON
unsigned long lastSensorReadTime = 0;   // Timestamp of last DHT22 reading
const unsigned long sensorInterval = 2000; // Sensor reading interval in milliseconds (2 seconds)

// Cached sensor values
float cachedTemperature = 0.0;
float cachedHumidity = 0.0;
bool isSensorValid = false;

// Buffer for incoming serial commands
String inputStringBuffer = "";

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Apply the physical relay output
void setRelay(bool turnOn) {
  currentRelayState = turnOn;
  
  if (RELAY_ACTIVE_LOW) {
    digitalWrite(RELAY_PIN, turnOn ? LOW : HIGH);
  } else {
    digitalWrite(RELAY_PIN, turnOn ? HIGH : LOW);
  }
}

// Send telemetry payload in clean JSON format over Serial
void sendTelemetryJSON() {
  Serial.print("{\"temperature\":");
  if (isSensorValid) {
    Serial.print(cachedTemperature, 1);
  } else {
    Serial.print("null");
  }

  Serial.print(",\"humidity\":");
  if (isSensorValid) {
    Serial.print(cachedHumidity, 1);
  } else {
    Serial.print("null");
  }

  Serial.print(",\"relay\":\"");
  Serial.print(currentRelayState ? "ON" : "OFF");
  Serial.print("\",\"sensor_ok\":");
  Serial.print(isSensorValid ? "true" : "false");
  
  if (!isSensorValid) {
    Serial.print(",\"error\":\"DHT22 reading failed\"");
  }
  
  Serial.println("}");
}

// Process incoming serial command string
void processSerialCommand(String cmd) {
  cmd.trim();
  cmd.toUpperCase();

  if (cmd.length() == 0) return;

  if (cmd == "ON" || cmd == "RELAY_ON" || cmd == "1") {
    setRelay(true);
    // Send immediate JSON confirmation
    sendTelemetryJSON();
  } 
  else if (cmd == "OFF" || cmd == "RELAY_OFF" || cmd == "0") {
    setRelay(false);
    // Send immediate JSON confirmation
    sendTelemetryJSON();
  } 
  else if (cmd == "STATUS" || cmd == "GET") {
    // Send current status immediately
    sendTelemetryJSON();
  }
  else {
    // Unknown command notification
    Serial.print("{\"error\":\"Unknown command: ");
    Serial.print(cmd);
    Serial.println("\"}");
  }
}

// ==========================================
// SETUP
// ==========================================
void setup() {
  // Initialize Serial port with 115200 baud
  Serial.begin(115200);
  delay(500);

  // Initialize Relay pin
  pinMode(RELAY_PIN, OUTPUT);
  setRelay(false); // Default to OFF

  // Initialize DHT22 Sensor
  dht.begin();

  Serial.println("{\"system\":\"ESP32 ThermoRelay Initialized\",\"status\":\"READY\"}");
}

// ==========================================
// MAIN LOOP
// ==========================================
void loop() {
  // 1. Non-blocking serial command listener
  while (Serial.available() > 0) {
    char inChar = (char)Serial.read();
    if (inChar == '\n' || inChar == '\r') {
      if (inputStringBuffer.length() > 0) {
        processSerialCommand(inputStringBuffer);
        inputStringBuffer = "";
      }
    } else {
      inputStringBuffer += inChar;
      // Prevent buffer overflow
      if (inputStringBuffer.length() > 64) {
        inputStringBuffer = "";
      }
    }
  }

  // 2. Non-blocking periodic sensor reading (every 2 seconds)
  unsigned long currentMillis = millis();
  if (currentMillis - lastSensorReadTime >= sensorInterval) {
    lastSensorReadTime = currentMillis;

    // Read humidity and temperature
    float h = dht.readHumidity();
    float t = dht.readTemperature(); // Celsius

    // Check if readings failed (NaN)
    if (isnan(h) || isnan(t)) {
      isSensorValid = false;
      cachedTemperature = 0.0;
      cachedHumidity = 0.0;
    } else {
      isSensorValid = true;
      cachedTemperature = t;
      cachedHumidity = h;
    }

    // Broadcast telemetry to connected web browser
    sendTelemetryJSON();
  }
}
