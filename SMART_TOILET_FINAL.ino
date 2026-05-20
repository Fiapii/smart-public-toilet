/*
 * ============================================================================
 *  SMART PUBLIC TOILET - COMPLETE WORKING CODE
 *  Final version with RFID, Payment API, Sensors, Servos, Pump
 *  
 *  FEATURES:
 *  - RFID card tap detection
 *  - Online payment via web interface (index.html)
 *  - Two ultrasonic sensors for occupancy detection
 *  - Two servo motors (door + lid)
 *  - Pump control via relay
 *  - Push button for manual exit
 *  - WiFi enabled with remote server integration
 *  
 *  AUTO-EXIT: If no motion detected for 5 seconds, door opens automatically
 *  ============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <SPI.h>
#include <MFRC522.h>

// ============================================================================
//  CONFIGURATION - MODIFY THESE FOR YOUR SETUP
// ============================================================================
const char* WIFI_SSID       = "CM232_Airtel_4D0C";    // Your WiFi SSID
const char* WIFI_PASSWORD   = "ndahiro123";           // Your WiFi Password
const char* SERVER_IP       = "192.168.1.103";        // Your Server IP
const int   SERVER_PORT     = 5000;                   // Your Server Port
const int   TOILET_ID       = 1;                      // Unique ID for this toilet

// ============================================================================
//  PIN DEFINITIONS - DO NOT CHANGE (unless you modified hardware)
// ============================================================================
// Ultrasonic Sensors
#define TRIG_PIN_1   26      // Exit sensor trigger
#define ECHO_PIN_1   27      // Exit sensor echo (needs voltage divider)
#define TRIG_PIN_2   13      // Bowl sensor trigger
#define ECHO_PIN_2   12      // Bowl sensor echo (needs voltage divider)

// Servo Motors
#define SERVO_PIN_1  15      // Door servo
#define SERVO_PIN_2  33      // Lid servo

// Other Components
#define BUTTON_PIN   14      // Manual button (pull-up to 3.3V)
#define LED_GREEN    22      // Status LED (green)
#define RELAY_PIN    32      // Pump relay control
#define RELAY_ON     LOW     // Relay trigger level
#define RELAY_OFF    HIGH    // Relay idle level

// RFID Module (SPI)
#define RFID_SS      5       // Chip Select
#define RFID_RST     4       // Reset
// SPI Pins (shared): CLK=18, MOSI=23, MISO=19

// ============================================================================
//  TIMING CONSTANTS
// ============================================================================
const float EXIT_TRIGGER_CM       = 5.0;              // 5cm detection range
const float LID_TRIGGER_CM        = 5.0;              // 5cm detection range

const int DOOR_OPEN_ANGLE         = 90;               // Servo full open
const int DOOR_CLOSED_ANGLE       = 0;                // Servo closed

const int LID_OPEN_ANGLE          = 90;               // Servo full open
const int LID_CLOSED_ANGLE        = 0;                // Servo closed

const unsigned long DOOR_HOLD_MS  = 10000;            // Keep door open 10s
const unsigned long PUMP_RUN_MS   = 5000;             // Pump runs 5s
const unsigned long LID_DELAY_MS  = 500;              // Delay before pump
const unsigned long RFID_COOLDOWN = 3000;             // Cooldown between taps
const unsigned long PAYMENT_POLL  = 2000;             // Check payment every 2s
const unsigned long AUTO_EXIT_MS  = 5000;             // Auto-exit after 5s no motion
const unsigned long LED_BLINK_MS  = 500;              // LED blink speed
const unsigned long BUTTON_DELAY  = 500;              // Button debounce

#define US_SAMPLES 5                                  // Ultrasonic averaging

// ============================================================================
//  STATE MACHINE ENUM
// ============================================================================
enum ToiletState {
  IDLE,              // 0: Ready for payment/RFID
  DOOR_OPENING,      // 1: Door servo moving to open
  DOOR_OPEN,         // 2: Door open, waiting
  DOOR_CLOSING,      // 3: Door servo moving to close
  OCCUPIED,          // 4: Person inside, waiting for usage
  LID_OPENING,       // 5: Lid servo opening
  LID_OPEN_WAIT,     // 6: Lid open, preparing pump
  FLUSHING,          // 7: Pump running
  LID_CLOSING,       // 8: Lid servo closing
  EXIT_OPENING,      // 9: Exit door servo opening
  EXIT_OPEN,         // 10: Exit door open, waiting
  EXIT_CLOSING       // 11: Exit door servo closing, returning to IDLE
};

// ============================================================================
//  GLOBAL VARIABLES
// ============================================================================
Servo   doorServo;                    // Door servo controller
Servo   lidServo;                     // Lid servo controller
MFRC522 rfid(RFID_SS, RFID_RST);      // RFID reader controller

ToiletState   state          = IDLE;  // Current state
unsigned long stateEnteredAt = 0;     // When we entered current state

bool          pumpRunning   = false;  // Is pump currently on?
bool          ledOn         = false;  // LED blink state

unsigned long lastRfidTime         = 0;  // Last RFID tap time (for cooldown)
unsigned long lastPaymentCheckTime = 0;  // Last payment check time
unsigned long lastPersonDetectedTime = 0; // For auto-exit timing
bool          personWasDetected      = false;

bool          lastButtonState  = HIGH;    // Previous button state
unsigned long lastButtonChange = 0;       // Last change time
unsigned long lastButtonPressTime = 0;    // Last press time
unsigned long lastLedToggle = 0;          // LED toggle time

// ============================================================================
//  HELPER FUNCTION: Get ultrasonic distance (with averaging)
// ============================================================================
float getDistance(int trig, int echo) {
  float samples[US_SAMPLES];
  int   valid = 0;
  
  // Take US_SAMPLES measurements
  for (int i = 0; i < US_SAMPLES; i++) {
    // Send 10µs pulse to trigger
    digitalWrite(trig, LOW);
    delayMicroseconds(4);
    digitalWrite(trig, HIGH);
    delayMicroseconds(10);
    digitalWrite(trig, LOW);
    
    // Measure echo pulse duration
    long dur = pulseIn(echo, HIGH, 38000UL);  // Max 38ms timeout
    
    if (dur > 0) {
      // Convert time to distance (0.0343 cm/µs)
      samples[valid++] = dur * 0.0343f / 2.0f;
    }
    delay(5);
  }
  
  if (valid == 0) return -1.0f;  // No valid reading
  
  // Sort samples and return median
  for (int a = 0; a < valid - 1; a++) {
    for (int b = a + 1; b < valid; b++) {
      if (samples[b] < samples[a]) {
        float tmp = samples[a];
        samples[a] = samples[b];
        samples[b] = tmp;
      }
    }
  }
  return samples[valid / 2];
}

// ============================================================================
//  STATE CHANGE FUNCTION
// ============================================================================
void setState(ToiletState newState) {
  if (state == newState) return;  // Already in this state
  state = newState;
  stateEnteredAt = millis();
  
  // Print state change for debugging
  const char* stateNames[] = {
    "IDLE", "DOOR_OPENING", "DOOR_OPEN", "DOOR_CLOSING",
    "OCCUPIED", "LID_OPENING", "LID_OPEN_WAIT", "FLUSHING",
    "LID_CLOSING", "EXIT_OPENING", "EXIT_OPEN", "EXIT_CLOSING"
  };
  Serial.printf("🔄 STATE → %s\n", stateNames[newState]);
}

// ============================================================================
//  Get time since entering current state
// ============================================================================
unsigned long sinceState() { 
  return millis() - stateEnteredAt; 
}

// ============================================================================
//  BUILD API URL
// ============================================================================
String buildUrl(const char* path) {
  return String("http://") + SERVER_IP + ":" + SERVER_PORT + path;
}

// ============================================================================
//  SEND HTTP POST REQUEST
// ============================================================================
String httpPost(const char* path, const String& jsonBody) {
  if (WiFi.status() != WL_CONNECTED) return "";
  
  HTTPClient http;
  http.setConnectTimeout(3000);
  http.setTimeout(3000);
  http.begin(buildUrl(path));
  http.addHeader("Content-Type", "application/json");
  
  int code = http.POST(jsonBody);
  String resp = "";
  
  if (code >= 200 && code < 300) {
    resp = http.getString();
    Serial.printf("[HTTP] POST %s → %d OK\n", path, code);
  } else {
    Serial.printf("[HTTP] POST %s → %d ERROR\n", path, code);
  }
  
  http.end();
  return resp;
}

// ============================================================================
//  LOG EVENT TO SERVER
// ============================================================================
void logEvent(const char* eventType, const char* details = "") {
  StaticJsonDocument<256> doc;
  doc["toilet_id"]  = TOILET_ID;
  doc["event_type"] = eventType;
  doc["details"]    = details;
  
  String body;
  serializeJson(doc, body);
  httpPost("/api/hardware/log-event", body);
}

// ============================================================================
//  UPDATE BACKEND OCCUPANCY STATUS
// ============================================================================
void setBackendOccupancy(bool isOccupied) {
  StaticJsonDocument<128> doc;
  doc["is_occupied"] = isOccupied;
  
  String body;
  serializeJson(doc, body);
  String path = "/api/hardware/occupancy/" + String(TOILET_ID);
  httpPost(path.c_str(), body);
}

// ============================================================================
//  UPDATE LED STATUS (blink during use, off when idle)
// ============================================================================
void updateLED() {
  // LED should blink when occupied
  bool shouldBlink = (state == OCCUPIED || state == LID_OPENING || 
                      state == LID_OPEN_WAIT || state == FLUSHING || 
                      state == LID_CLOSING);
  
  if (!shouldBlink) {
    digitalWrite(LED_GREEN, LOW);
    ledOn = false;
    return;
  }
  
  // Toggle LED every LED_BLINK_MS milliseconds
  if (millis() - lastLedToggle >= LED_BLINK_MS) {
    lastLedToggle = millis();
    ledOn = !ledOn;
    digitalWrite(LED_GREEN, ledOn ? HIGH : LOW);
  }
}

// ============================================================================
//  SERVO CONTROL FUNCTIONS
// ============================================================================
void setDoorAngle(int angle) { 
  doorServo.write(angle); 
}

void setLidAngle(int angle)   { 
  lidServo.write(angle); 
}

// ============================================================================
//  PUMP CONTROL FUNCTIONS
// ============================================================================
void startPump() {
  digitalWrite(RELAY_PIN, RELAY_ON);      // Turn relay ON
  pumpRunning = true;
  Serial.println("💧 PUMP ON");
  logEvent("flush_start", "Auto-flush started");
}

void stopPump() {
  digitalWrite(RELAY_PIN, RELAY_OFF);     // Turn relay OFF
  pumpRunning = false;
  Serial.println("💧 PUMP OFF");
  logEvent("flush", "Auto-flush completed");
}

// ============================================================================
//  TRIGGER DOOR OPEN (called by payment or RFID)
// ============================================================================
void triggerDoorOpen(const char* reason) {
  if (state != IDLE) {
    Serial.println("⚠️ Door open ignored — not idle");
    return;
  }
  
  Serial.printf("✅ Payment confirmed — opening door (%s)\n", reason);
  logEvent("door_open", reason);
  setState(DOOR_OPENING);
}

// ============================================================================
//  CHECK RFID READER
// ============================================================================
void checkRFID() {
  // Ignore card taps if not idle
  if (state != IDLE) {
    if (rfid.PICC_IsNewCardPresent()) {
      rfid.PICC_ReadCardSerial();
      rfid.PICC_HaltA();
      rfid.PCD_StopCrypto1();
    }
    return;
  }
  
  // No new card present?
  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial())   return;
  
  // Check cooldown
  if (millis() - lastRfidTime < RFID_COOLDOWN) {
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }
  lastRfidTime = millis();

  // Convert UID to hex string
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (i > 0) uid += " ";
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  
  Serial.print("🔖 Card UID: ");
  Serial.println(uid);
  
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  // Send RFID tap to server
  StaticJsonDocument<128> reqDoc;
  reqDoc["uid"] = uid;
  reqDoc["toilet_id"] = TOILET_ID;
  String body;
  serializeJson(reqDoc, body);
  
  String resp = httpPost("/api/hardware/rfid-tap", body);
  
  if (resp.isEmpty()) {
    Serial.println("⚠️ No server response — access denied");
    return;
  }
  
  // Parse response
  StaticJsonDocument<256> resDoc;
  if (deserializeJson(resDoc, resp)) {
    Serial.println("⚠️ JSON parse error");
    return;
  }
  
  const char* command = resDoc["command"] | "DENY";
  const char* message = resDoc["message"] | "";
  
  if (strcmp(command, "OPEN_DOOR") == 0) {
    triggerDoorOpen(message);
  } else {
    Serial.printf("❌ RFID denied: %s\n", message);
    // Flash LED twice as denied indication
    for (int i = 0; i < 2; i++) {
      digitalWrite(LED_GREEN, HIGH); 
      delay(200);
      digitalWrite(LED_GREEN, LOW);  
      delay(200);
    }
  }
}

// ============================================================================
//  CHECK FOR ONLINE PAYMENT (polls server)
// ============================================================================
void checkPaymentTrigger() {
  if (state != IDLE) return;
  if (millis() - lastPaymentCheckTime < PAYMENT_POLL) return;
  if (WiFi.status() != WL_CONNECTED) return;
  
  lastPaymentCheckTime = millis();

  // Get payment status from server
  HTTPClient http;
  http.setConnectTimeout(2000);
  http.setTimeout(2000);
  String path = "/api/hardware/payment-check/" + String(TOILET_ID);
  http.begin(buildUrl(path.c_str()));
  
  int code = http.GET();
  if (code == 200) {
    String resp = http.getString();
    StaticJsonDocument<256> doc;
    
    if (!deserializeJson(doc, resp)) {
      const char* command = doc["command"] | "DENY";
      const char* message = doc["message"] | "";
      
      if (strcmp(command, "OPEN_DOOR") == 0) {
        Serial.println("✅ Online payment confirmed");
        triggerDoorOpen(message);
      }
    }
  }
  
  http.end();
}

// ============================================================================
//  CHECK BUTTON PRESS (debounced)
// ============================================================================
bool buttonJustPressed() {
  bool reading = digitalRead(BUTTON_PIN);
  
  // Detect state change
  if (reading != lastButtonState) {
    lastButtonChange = millis();
  }
  
  // Wait for debounce time
  if (millis() - lastButtonChange >= 25) {
    // Check if button was pressed (HIGH → LOW)
    if (reading == LOW && lastButtonState == HIGH) {
      // Check cooldown between presses
      if (millis() - lastButtonPressTime >= BUTTON_DELAY) {
        lastButtonPressTime = millis();
        lastButtonState = reading;
        return true;
      }
    }
  }
  
  lastButtonState = reading;
  return false;
}

// ============================================================================
//  SETUP - Runs once at startup
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(500);
  
  Serial.println("\n========================================");
  Serial.println("   SMART PUBLIC TOILET - FULL SYSTEM");
  Serial.println("   RFID + Payment + Sensors + Servos");
  Serial.println("========================================\n");

  // Initialize GPIO pins
  pinMode(TRIG_PIN_1, OUTPUT); 
  pinMode(ECHO_PIN_1, INPUT);
  pinMode(TRIG_PIN_2, OUTPUT); 
  pinMode(ECHO_PIN_2, INPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_GREEN, OUTPUT); 
  digitalWrite(LED_GREEN, LOW);
  pinMode(RELAY_PIN, OUTPUT); 
  digitalWrite(RELAY_PIN, RELAY_OFF);

  // Initialize servos
  doorServo.attach(SERVO_PIN_1);
  lidServo.attach(SERVO_PIN_2);
  setDoorAngle(DOOR_CLOSED_ANGLE);
  setLidAngle(LID_CLOSED_ANGLE);
  
  Serial.println("✅ Servos initialized");

  // Initialize RFID reader
  SPI.begin(18, 19, 23, RFID_SS);
  rfid.PCD_Init();
  Serial.println("✅ RFID reader initialized");

  // Initialize WiFi
  Serial.printf("📡 Connecting to WiFi: %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  for (int i = 0; i < 30 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500); 
    Serial.print(".");
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n✅ WiFi connected\n");
    Serial.printf("   IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("   Server: http://%s:%d\n\n", SERVER_IP, SERVER_PORT);
  } else {
    Serial.println("\n⚠️ WiFi failed — running in offline mode\n");
  }

  setState(IDLE);
  Serial.println("✅ SYSTEM READY\n");
}

// ============================================================================
//  MAIN LOOP - Runs continuously
// ============================================================================
void loop() {
  // Check for RFID taps and online payments
  checkRFID();
  checkPaymentTrigger();

  // Read sensors
  float distExit = getDistance(TRIG_PIN_1, ECHO_PIN_1);  // Exit sensor
  float distLid  = getDistance(TRIG_PIN_2, ECHO_PIN_2);  // Bowl sensor
  
  // Update LED status
  updateLED();
  
  // Check button press
  bool btnPressed = buttonJustPressed();

  // ========== AUTO-EXIT LOGIC (when OCCUPIED) ==========
  if (state == OCCUPIED) {
    // Detect if person is still present
    bool personPresent = (distExit > 0 && distExit <= EXIT_TRIGGER_CM) ||
                         (distLid  > 0 && distLid  <= LID_TRIGGER_CM) ||
                         btnPressed;
    
    if (personPresent) {
      lastPersonDetectedTime = millis();
      if (!personWasDetected) {
        personWasDetected = true;
        Serial.println("👤 Person detected inside");
      }
    } else {
      // No person detected
      if (personWasDetected && (millis() - lastPersonDetectedTime >= AUTO_EXIT_MS)) {
        Serial.println("⏱️ No motion for 5s → auto-exit triggered");
        logEvent("auto_exit", "No motion detected");
        setState(EXIT_OPENING);
        personWasDetected = false;
      }
    }
  } else {
    personWasDetected = false;
  }

  // ========== FAILSAFE: stuck for > 20 minutes ==========
  if (state != IDLE && millis() - stateEnteredAt > 20UL * 60 * 1000) {
    Serial.println("⚠️ FAILSAFE: stuck for 20+ minutes, resetting");
    stopPump();
    setDoorAngle(DOOR_CLOSED_ANGLE);
    setLidAngle(LID_CLOSED_ANGLE);
    setBackendOccupancy(false);
    setState(IDLE);
  }

  // ========== PUMP WATCHDOG (max 6 seconds) ==========
  static unsigned long pumpStartTime = 0;
  if (pumpRunning) {
    if (pumpStartTime == 0) pumpStartTime = millis();
    if (millis() - pumpStartTime > 6000) {
      Serial.println("⚠️ PUMP WATCHDOG: forced stop");
      stopPump();
    }
  } else {
    pumpStartTime = 0;
  }

  // ========== STATE MACHINE ==========
  switch (state) {
    // ─────────────────────────────────────────
    case IDLE:
      // Waiting for payment or RFID
      break;

    // ─────────────────────────────────────────
    case DOOR_OPENING:
      // Servo moves door to open position
      setDoorAngle(DOOR_OPEN_ANGLE);
      Serial.println("🚪 Door opening — entry hold 10s");
      logEvent("door_open", "Entry door fully open");
      setState(DOOR_OPEN);
      break;

    // ─────────────────────────────────────────
    case DOOR_OPEN:
      // Keep door open for DOOR_HOLD_MS milliseconds
      if (sinceState() >= DOOR_HOLD_MS) {
        Serial.println("🚪 Closing entry door");
        logEvent("door_close", "Entry door closing");
        setState(DOOR_CLOSING);
      }
      break;

    // ─────────────────────────────────────────
    case DOOR_CLOSING:
      // Servo moves door to closed position
      setDoorAngle(DOOR_CLOSED_ANGLE);
      Serial.println("🚪 Door closed → person is now OCCUPIED");
      setBackendOccupancy(true);
      logEvent("occupied", "Toilet now occupied");
      lastPersonDetectedTime = millis();
      personWasDetected = true;
      setState(OCCUPIED);
      break;

    // ─────────────────────────────────────────
    case OCCUPIED: {
      // Person is inside, waiting for them to use toilet or exit
      
      // Check for exit trigger (button or exit sensor)
      bool exitTrigger = btnPressed || 
                        (distExit > 0 && distExit <= EXIT_TRIGGER_CM);
      if (exitTrigger) {
        Serial.println("🚪 Exit triggered → opening door");
        logEvent("exit_triggered", "Button or exit sensor");
        setState(EXIT_OPENING);
        break;
      }
      
      // Check for bowl occupancy (trigger lid opening)
      if (distLid > 0 && distLid <= LID_TRIGGER_CM) {
        Serial.println("🪑 Person detected in bowl → opening lid");
        logEvent("lid_open", "Lid opening for usage");
        setState(LID_OPENING);
      }
      break;
    }

    // ─────────────────────────────────────────
    case LID_OPENING:
      // Check if person exited during lid opening
      if (btnPressed || (distExit > 0 && distExit <= EXIT_TRIGGER_CM)) {
        setLidAngle(LID_CLOSED_ANGLE);
        setState(EXIT_OPENING);
        break;
      }
      
      // Move lid to open position
      setLidAngle(LID_OPEN_ANGLE);
      setState(LID_OPEN_WAIT);
      break;

    // ─────────────────────────────────────────
    case LID_OPEN_WAIT:
      // Lid is open, waiting before starting pump
      if (btnPressed || (distExit > 0 && distExit <= EXIT_TRIGGER_CM)) {
        setLidAngle(LID_CLOSED_ANGLE);
        setState(EXIT_OPENING);
        break;
      }
      
      // Wait LID_DELAY_MS before starting pump
      if (sinceState() >= LID_DELAY_MS) {
        startPump();
        setState(FLUSHING);
      }
      break;

    // ─────────────────────────────────────────
    case FLUSHING:
      // Pump is running, wait PUMP_RUN_MS before stopping
      if (sinceState() >= PUMP_RUN_MS) {
        stopPump();
        setState(LID_CLOSING);
      }
      break;

    // ─────────────────────────────────────────
    case LID_CLOSING:
      // Check if person wants to exit
      if (btnPressed || (distExit > 0 && distExit <= EXIT_TRIGGER_CM)) {
        setLidAngle(LID_CLOSED_ANGLE);
        setState(EXIT_OPENING);
        break;
      }
      
      // Close lid and go back to OCCUPIED
      setLidAngle(LID_CLOSED_ANGLE);
      setState(OCCUPIED);
      break;

    // ─────────────────────────────────────────
    case EXIT_OPENING:
      // Open door for exit
      setDoorAngle(DOOR_OPEN_ANGLE);
      setState(EXIT_OPEN);
      break;

    // ─────────────────────────────────────────
    case EXIT_OPEN:
      // Keep door open for DOOR_HOLD_MS milliseconds
      if (sinceState() >= DOOR_HOLD_MS) {
        setState(EXIT_CLOSING);
      }
      break;

    // ─────────────────────────────────────────
    case EXIT_CLOSING:
      // Close door, reset to IDLE
      setDoorAngle(DOOR_CLOSED_ANGLE);
      setBackendOccupancy(false);
      setLidAngle(LID_CLOSED_ANGLE);
      pumpRunning = false;
      digitalWrite(RELAY_PIN, RELAY_OFF);
      Serial.println("🏁 Exit complete → IDLE");
      logEvent("door_close", "Exit door closed, toilet available");
      setState(IDLE);
      break;
  }

  // ========== DEBUG OUTPUT (every 2 seconds) ==========
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint >= 2000) {
    lastPrint = millis();
    
    const char* stateNames[] = {
      "IDLE", "DOOR_OPENING", "DOOR_OPEN", "DOOR_CLOSING",
      "OCCUPIED", "LID_OPENING", "LID_OPEN_WAIT", "FLUSHING",
      "LID_CLOSING", "EXIT_OPENING", "EXIT_OPEN", "EXIT_CLOSING"
    };
    
    Serial.printf("📊 [%s] Pump:%s Exit:%.0fcm Bowl:%.0fcm\n",
                  stateNames[state], 
                  pumpRunning ? "ON" : "OFF", 
                  distExit, 
                  distLid);
  }
  
  delay(10);  // Small delay to prevent watchdog timeout
}

// ============================================================================
//  END OF CODE
// ============================================================================
