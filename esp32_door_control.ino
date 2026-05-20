/*
 * Smart Public Toilet - FINAL (with improved button debounce)
 * - Door only opens on exit sensor or button press
 * - Attractive serial messages with icons
 * - Ignores false button triggers at boot
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <SPI.h>
#include <MFRC522.h>

// ============================================================
//  CONFIG
// ============================================================
const char* WIFI_SSID     = "CM232_Airtel_4D0C";
const char* WIFI_PASSWORD = "ndahiro123";
const char* SERVER_IP     = "192.168.1.102";
const int   SERVER_PORT   = 5000;
const int   TOILET_ID     = 1;

// ============================================================
//  PINS
// ============================================================
#define TRIG1       13    // Exit ultrasonic — trigger
#define ECHO1       12    // Exit ultrasonic — echo
#define TRIG2       26    // Bowl ultrasonic — trigger
#define ECHO2       27    // Bowl ultrasonic — echo
#define SERVO_DOOR  15    // Door servo
#define SERVO_LID   33    // Lid servo
#define BTN_PIN     14    // Exit button (to GND, uses INPUT_PULLUP)
#define LED_PIN     22    // Status LED
#define RELAY_PIN   2    // Relay (LOW = pump ON)
#define RFID_SS      5    // RC522 SDA/SS
#define RFID_RST     4    // RC522 RST

// ============================================================
//  THRESHOLDS & TIMING
// ============================================================
#define DETECT_CM       5.0      // Presence within 15cm
#define DOOR_OPEN_MS    10000UL   // Door open 10s for entry/exit
#define LID_WAIT_MS      3000UL   // Lid open 3s before flush
#define PUMP_RUN_MS      5000UL   // Pump runs 5s
#define PAYMENT_MS       2000UL   // Poll server every 2s
#define RFID_COOL_MS     3000UL   // Ignore re-tap 3s

// ============================================================
//  SERVO ANGLES
// ============================================================
#define DOOR_OPEN_DEG    90
#define DOOR_SHUT_DEG     0
#define LID_OPEN_DEG     90
#define LID_SHUT_DEG      0

// Servo movement tuning (degrees per step, milliseconds per step)
#define DOOR_MOVE_STEP_DEG 2
#define DOOR_MOVE_STEP_MS  25

// ============================================================
//  STATE MACHINE
// ============================================================
enum State {
  S_IDLE,
  S_ENTRY_OPEN,
  S_OCCUPIED,
  S_LID_OPENING,
  S_LID_OPEN,
  S_FLUSHING,
  S_LID_CLOSING,
  S_EXIT_OPEN,
  S_CLEANUP
};

const char* STATE_NAMES[] = {
  "IDLE", "ENTRY_OPEN", "OCCUPIED",
  "LID_OPENING", "LID_OPEN", "FLUSHING",
  "LID_CLOSING", "EXIT_OPEN", "CLEANUP"
};

// ============================================================
//  GLOBALS
// ============================================================
Servo   doorServo;
Servo   lidServo;
MFRC522 rfid(RFID_SS, RFID_RST);

State         currentState   = S_IDLE;
unsigned long stateTimer     = 0;
unsigned long lastRfidTap    = 0;
unsigned long lastPayPoll    = 0;
bool          pumpRunning    = false;
bool          lidOpen        = false;
int           doorAngle      = DOOR_SHUT_DEG;
int           lidAngle       = LID_SHUT_DEG;

// Relay polarity: set to true if relay is active LOW (LOW turns pump ON)
const bool RELAY_ACTIVE_LOW = true;

// ============================================================
//  PRINT HELPERS
// ============================================================
void printSeparator() {
  Serial.println(F("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
}

void printHeader(const char* msg) {
  printSeparator();
  Serial.println(msg);
  printSeparator();
}

// ============================================================
//  ULTRASONIC
// ============================================================
float getDistance(int trig, int echo) {
  digitalWrite(trig, LOW);
  delayMicroseconds(2);
  digitalWrite(trig, HIGH);
  delayMicroseconds(10);
  digitalWrite(trig, LOW);
  long dur = pulseIn(echo, HIGH, 30000UL);
  if (dur == 0) return -1.0;
  return dur * 0.0343 / 2.0;
}

bool exitSensor() {
  float d = getDistance(TRIG1, ECHO1);
  if (d > 0 && d < DETECT_CM) {
    Serial.printf("  🚪 [>>] Exit sensor: %.1fcm — person detected\n", d);
    return true;
  }
  return false;
}

bool bowlSensor() {
  float d = getDistance(TRIG2, ECHO2);
  if (d > 0 && d < DETECT_CM) {
    Serial.printf("  🚽 [**] Bowl sensor: %.1fcm — person at toilet\n", d);
    return true;
  }
  return false;
}

// ============================================================
//  STATE HELPERS
// ============================================================
unsigned long sinceState() {
  return millis() - stateTimer;
}

void goToState(State s) {
  Serial.printf("\n🔄 STATE CHANGE: %s --> %s\n",
    STATE_NAMES[currentState], STATE_NAMES[s]);
  currentState = s;
  stateTimer   = millis();
}

// ============================================================
//  HARDWARE ACTIONS (with emojis)
// ============================================================
void openDoor() {
  Serial.println(F("🚪🚪🚪 DOOR: Opening... (smoothly) 🚪🚪🚪"));
  int from = doorAngle;
  int to = DOOR_OPEN_DEG;
  if (from != to) {
    int step = DOOR_MOVE_STEP_DEG;
    if (from < to) {
      for (int a = from; a <= to; a += step) {
        doorServo.write(a);
        delay(DOOR_MOVE_STEP_MS);
      }
    } else {
      for (int a = from; a >= to; a -= step) {
        doorServo.write(a);
        delay(DOOR_MOVE_STEP_MS);
      }
    }
    doorServo.write(to);
    doorAngle = to;
  }
  Serial.println(F("✅ DOOR: Open — person may enter/exit"));
}

void closeDoor() {
  Serial.println(F("🚪🚪🚪 DOOR: Closing... (smoothly) 🚪🚪🚪"));
  int from = doorAngle;
  int to = DOOR_SHUT_DEG;
  if (from != to) {
    int step = DOOR_MOVE_STEP_DEG;
    if (from < to) {
      for (int a = from; a <= to; a += step) {
        doorServo.write(a);
        delay(DOOR_MOVE_STEP_MS);
      }
    } else {
      for (int a = from; a >= to; a -= step) {
        doorServo.write(a);
        delay(DOOR_MOVE_STEP_MS);
      }
    }
    doorServo.write(to);
    doorAngle = to;
  }
  Serial.println(F("✅ DOOR: Closed and locked"));
}

void openLid() {
  if (lidOpen) return;
  Serial.println(F("🚽🚽🚽 LID: Opening... (rotating to 90°) 🚽🚽🚽"));
  lidServo.write(LID_OPEN_DEG);
  lidOpen = true;
  delay(600);
  Serial.println(F("✅ LID: Fully open — ready to use"));
}

void closeLid() {
  if (!lidOpen) return;
  Serial.println(F("🚽🚽🚽 LID: Closing... (rotating to 0°) 🚽🚽🚽"));
  lidServo.write(LID_SHUT_DEG);
  lidOpen = false;
  delay(600);
  Serial.println(F("✅ LID: Fully closed"));
}

void startPump() {
  if (pumpRunning) return;
  Serial.println(F("💧💧💧 PUMP: Starting flush... 💧💧💧"));
  if (RELAY_ACTIVE_LOW) digitalWrite(RELAY_PIN, LOW); else digitalWrite(RELAY_PIN, HIGH);
  pumpRunning = true;
  Serial.println(F("💦💦💦 FLUSHING — water flowing (5 seconds) 💦💦💦"));
}

void stopPump() {
  // Always try to deactivate the relay to ensure pump stops
  if (RELAY_ACTIVE_LOW) digitalWrite(RELAY_PIN, HIGH); else digitalWrite(RELAY_PIN, LOW);
  pumpRunning = false;
  Serial.println(F("✅💧 Flush complete — pump stopped"));
}

// ============================================================
//  LED
// ============================================================
void updateLED() {
  switch (currentState) {
    case S_IDLE:
      digitalWrite(LED_PIN, HIGH);
      break;
    case S_ENTRY_OPEN:
    case S_EXIT_OPEN:
      digitalWrite(LED_PIN, (millis() / 150) % 2);
      break;
    default:
      digitalWrite(LED_PIN, (millis() / 500) % 2);
      break;
  }
}

// ============================================================
//  BUTTON — reliable debounce (ignores power‑up glitches)
// ============================================================
bool buttonPressed() {
  static unsigned long lastPressTime = 0;
  static bool lastButtonState = HIGH;
  
  // Ignore button state for the first 500ms after boot
  if (millis() < 500) return false;
  
  bool currentState = digitalRead(BTN_PIN);
  
  if (currentState != lastButtonState) {
    lastPressTime = millis();
    lastButtonState = currentState;
    return false;
  }
  
  if (currentState == LOW && (millis() - lastPressTime) > 50) {
    // Non-blocking: wait for release state with a timeout to avoid hanging
    static unsigned long pressTime = 0;
    static bool waitingForRelease = false;

    if (!waitingForRelease) {
      pressTime = millis();
      waitingForRelease = true;
      return false; // initial press detected; confirm on release
    }

    // If still held but within timeout, keep waiting (don't block)
    if (digitalRead(BTN_PIN) == LOW) {
      // timeout after 5s to avoid locking the main loop
      if (millis() - pressTime > 5000) {
        waitingForRelease = false;
        return false;
      }
      return false;
    }

    // Button released — confirm press
    waitingForRelease = false;
    Serial.println(F("🔘 [BTN] Exit button pressed by user"));
    return true;
  }
  return false;
}

// ============================================================
//  HTTP HELPERS
// ============================================================
String serverBase() {
  return String("http://") + SERVER_IP + ":" + SERVER_PORT;
}

void postEvent(const char* evt, const char* detail = "") {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient h;
  h.setConnectTimeout(2000);
  h.setTimeout(2000);
  h.begin(serverBase() + "/api/hardware/log-event");
  h.addHeader("Content-Type", "application/json");
  StaticJsonDocument<200> d;
  d["toilet_id"]  = TOILET_ID;
  d["event_type"] = evt;
  d["details"]    = detail;
  String b;
  serializeJson(d, b);
  int code = h.POST(b);
  h.end();
  Serial.printf("  🌐 [NET] Event logged: %s (%d)\n", evt, code);
}

void setOccupied(bool occ) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient h;
  h.setConnectTimeout(2000);
  h.setTimeout(2000);
  h.begin(serverBase() + "/api/hardware/occupancy/" + TOILET_ID);
  h.addHeader("Content-Type", "application/json");
  StaticJsonDocument<64> d;
  d["is_occupied"] = occ;
  String b;
  serializeJson(d, b);
  h.POST(b);
  h.end();
  Serial.printf("  🌐 [NET] Occupancy set: %s\n", occ ? "OCCUPIED 🚫" : "FREE ✅");
}

// ============================================================
//  RFID
// ============================================================
bool checkRFID() {
  if (millis() - lastRfidTap < RFID_COOL_MS) return false;
  if (!rfid.PICC_IsNewCardPresent())          return false;

  Serial.println(F("\n🔍 [RFID] Card detected — reading..."));

  if (!rfid.PICC_ReadCardSerial()) {
    Serial.println(F("❌ [RFID] Could not read card — try again"));
    return false;
  }

  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (i > 0) uid += ":";
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  Serial.println("💳 [RFID] Card UID: " + uid);

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  lastRfidTap = millis();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(F("⚠️ [RFID] No WiFi — cannot verify payment"));
    return false;
  }

  Serial.println(F("📡 [RFID] Checking with server..."));

  HTTPClient h;
  h.setConnectTimeout(3000);
  h.setTimeout(3000);
  h.begin(serverBase() + "/api/hardware/rfid-tap");
  h.addHeader("Content-Type", "application/json");

  StaticJsonDocument<128> req;
  req["uid"]       = uid;
  req["toilet_id"] = TOILET_ID;
  String body;
  serializeJson(req, body);

  int    code = h.POST(body);
  String resp = h.getString();
  h.end();

  Serial.printf("📡 [RFID] Server HTTP %d\n", code);

  if (code < 200 || code > 299) {
    Serial.println(F("❌ Server not reachable — check your PC and firewall"));
    return false;
  }

  StaticJsonDocument<256> res;
  if (deserializeJson(res, resp)) {
    Serial.println(F("❌ Bad response from server"));
    return false;
  }

  const char* cmd = res["command"] | "DENY";
  const char* msg = res["message"] | "";

  Serial.printf("📡 [RFID] Server command: %s\n", cmd);

  if (strcmp(cmd, "OPEN_DOOR") == 0) {
    Serial.println(F("✅✅✅ ACCESS GRANTED — payment verified ✅✅✅"));
    return true;
  }

  // Denied messages with emojis
  if (strstr(msg, "balance") || strstr(msg, "insufficient") ||
      strstr(msg, "credit")  || strstr(msg, "funds")) {
    Serial.println(F("❌❌❌ ACCESS DENIED ❌❌❌"));
    Serial.println(F("💰 REASON: Insufficient balance — please top up your card"));
  } else if (strstr(msg, "unknown") || strstr(msg, "not found")) {
    Serial.println(F("❌❌❌ ACCESS DENIED ❌❌❌"));
    Serial.println(F("🆔 REASON: Card not registered in the system"));
  } else {
    Serial.println(F("❌❌❌ ACCESS DENIED ❌❌❌"));
    if (strlen(msg) > 0) Serial.printf("📝 REASON: %s\n", msg);
    else Serial.println(F("❓ REASON: Payment not confirmed"));
  }
  return false;
}

// ============================================================
//  PAYMENT POLL
// ============================================================
bool checkPayment() {
  if (millis() - lastPayPoll < PAYMENT_MS)  return false;
  if (WiFi.status() != WL_CONNECTED)        return false;
  lastPayPoll = millis();

  HTTPClient h;
  h.setConnectTimeout(2000);
  h.setTimeout(2000);
  h.begin(serverBase() + "/api/hardware/payment-check/" + TOILET_ID);
  int    code = h.GET();
  String resp = h.getString();
  h.end();

  if (code != 200) return false;

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, resp)) return false;

  const char* cmd = doc["command"] | "DENY";
  if (strcmp(cmd, "OPEN_DOOR") == 0) {
    Serial.println(F("\n💻💻💻 ONLINE PAYMENT CONFIRMED 💻💻💻"));
    Serial.println(F("💵 Payment received — door opening"));
    return true;
  }
  return false;
}

// ============================================================
//  SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(500);                     // let serial settle
  pinMode(BTN_PIN, INPUT_PULLUP);
  delay(50);                      // let pull‑up stabilise

  printHeader("  🚽 SMART PUBLIC TOILET  🚽  STARTING UP  ");

  // Pins
  pinMode(TRIG1,     OUTPUT); pinMode(ECHO1, INPUT);
  pinMode(TRIG2,     OUTPUT); pinMode(ECHO2, INPUT);
  pinMode(LED_PIN,   OUTPUT); digitalWrite(LED_PIN, LOW);
  pinMode(RELAY_PIN, OUTPUT); digitalWrite(RELAY_PIN, HIGH);
  Serial.println(F("✅ Pins configured"));

  // Servos
  doorServo.attach(SERVO_DOOR);
  lidServo.attach(SERVO_LID);
  delay(200);
  doorServo.write(DOOR_SHUT_DEG);
  lidServo.write(LID_SHUT_DEG);
  lidOpen = false;
  delay(600);
  Serial.println(F("✅ Servos initialised — door closed, lid closed"));

  // RFID
  SPI.begin(18, 19, 23, RFID_SS);
  delay(100);
  rfid.PCD_Init();
  delay(100);
  byte ver = rfid.PCD_ReadRegister(rfid.VersionReg);
  Serial.printf("✅ RFID chip version: 0x%02X", ver);
  if      (ver == 0x92) Serial.println(" — RC522 v2");
  else if (ver == 0x91) Serial.println(" — RC522 v1");
  else if (ver == 0x82) Serial.println(" — RC522 clone");
  else if (ver == 0x00) Serial.println(" — ERROR: check MOSI/MISO/SCK wires");
  else if (ver == 0xFF) Serial.println(" — ERROR: check SS wire to GPIO5");
  else                  Serial.printf(" — unknown (0x%02X)\n", ver);

  // WiFi
  Serial.printf("📡 WiFi: connecting to %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  for (int i = 0; i < 20 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n✅ WiFi connected — IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("✅ Server: http://%s:%d\n", SERVER_IP, SERVER_PORT);
  } else {
    Serial.println(F("\n⚠️ WiFi FAILED — RFID tap needs WiFi to verify payment"));
  }

  goToState(S_IDLE);
  printHeader("  🟢 SYSTEM READY — TAP CARD OR PAY ONLINE  🟢");
  Serial.println(F("💡 LED solid = free | slow blink = occupied | fast blink = door moving"));
  Serial.println();
}

// ============================================================
//  MAIN LOOP (unchanged logic)
// ============================================================
void loop() {
  updateLED();
  bool btn = buttonPressed();

  // Global failsafe — stuck 20 min
  if (currentState != S_IDLE && sinceState() > 20UL * 60 * 1000) {
    printHeader("  ⚠️ FAILSAFE: 20 MINUTE TIMEOUT — RESETTING  ");
    stopPump();
    closeLid();
    closeDoor();
    setOccupied(false);
    goToState(S_IDLE);
    return;
  }

  switch (currentState) {

    case S_IDLE:
      if (checkRFID() || checkPayment()) {
        printHeader("  🟢 ACCESS GRANTED — OPENING DOOR  ");
        Serial.println(F("🚫 Toilet is now OCCUPIED — no new payments accepted"));
        postEvent("door_open", "entry");
        openDoor();
        goToState(S_ENTRY_OPEN);
      }
      break;

    case S_ENTRY_OPEN:
      if (sinceState() >= DOOR_OPEN_MS) {
        Serial.println(F("\n⏱️ Entry time elapsed — closing door"));
        closeDoor();
        setOccupied(true);
        postEvent("occupied", "person entered");
        Serial.println(F("✅ Person is inside — monitoring sensors"));
        Serial.println(F("🚽 Approach bowl to open lid | 🚪 Press button or approach door to exit"));
        goToState(S_OCCUPIED);
      }
      break;

    case S_OCCUPIED: {
      if (bowlSensor()) {
        Serial.println(F("\n🚽 Person at toilet bowl — opening lid"));
        openLid();
        postEvent("lid_open", "bowl sensor triggered");
        goToState(S_LID_OPEN);
        break;
      }
      if (btn) {
        Serial.println(F("\n🔘 Exit button pressed — opening door"));
        postEvent("exit", "button pressed");
        openDoor();
        goToState(S_EXIT_OPEN);
        break;
      }
      if (exitSensor()) {
        Serial.println(F("\n🚪 Person approaching exit door — opening door"));
        postEvent("exit", "exit sensor triggered");
        openDoor();
        goToState(S_EXIT_OPEN);
        break;
      }
      // No auto-exit
      break;
    }

    case S_LID_OPEN:
      if (btn) {
        Serial.println(F("\n🔘 Exit button pressed during lid open — closing lid then opening door"));
        closeLid();
        postEvent("exit", "button during lid open");
        openDoor();
        goToState(S_EXIT_OPEN);
        break;
      }
      if (exitSensor()) {
        Serial.println(F("\n🚪 Exit sensor during lid open — closing lid then opening door"));
        closeLid();
        postEvent("exit", "sensor during lid open");
        openDoor();
        goToState(S_EXIT_OPEN);
        break;
      }
      if (sinceState() >= LID_WAIT_MS) {
        Serial.println(F("\n⏱️ Lid open for 3 seconds — starting flush"));
        startPump();
        postEvent("flush_start", "auto flush");
        goToState(S_FLUSHING);
      }
      break;

    case S_FLUSHING:
      if (sinceState() >= PUMP_RUN_MS) {
        stopPump();
        postEvent("flush", "flush complete");
        Serial.println(F("🚽 Closing lid after flush"));
        closeLid();
        goToState(S_LID_CLOSING);
      }
      break;

    case S_LID_CLOSING:
      if (sinceState() >= 1500) {
        Serial.println(F("✅ Lid closed — back to monitoring"));
        Serial.println(F("🚽 Approach bowl again to flush | 🚪 Press button or approach door to exit"));
        goToState(S_OCCUPIED);
      }
      break;

    case S_EXIT_OPEN:
      if (sinceState() >= DOOR_OPEN_MS) {
        Serial.println(F("\n⏱️ Exit time elapsed — closing door"));
        closeDoor();
        goToState(S_CLEANUP);
      }
      break;

    case S_CLEANUP:
      stopPump();
      closeLid();
      setOccupied(false);
      postEvent("door_close", "exit complete — toilet free");
      Serial.println(F("\n✅ Person has exited"));
      printHeader("  🟢 TOILET FREE — READY FOR NEXT PAYMENT  🟢");
      goToState(S_IDLE);
      break;
  }

  // Debug every 5 seconds
  static unsigned long lastDbg = 0;
  if (millis() - lastDbg >= 5000) {
    lastDbg = millis();
    float d1 = getDistance(TRIG1, ECHO1);
    float d2 = getDistance(TRIG2, ECHO2);
    Serial.printf("📊 [STATUS] State:%-12s  Exit:%5.1fcm  Bowl:%5.1fcm  Pump:%-3s  Lid:%-6s  WiFi:%s\n",
      STATE_NAMES[currentState],
      d1, d2,
      pumpRunning ? "ON"  : "OFF",
      lidOpen     ? "OPEN" : "CLOSED",
      WiFi.status() == WL_CONNECTED ? "OK" : "DOWN");
  }

  delay(50);
}