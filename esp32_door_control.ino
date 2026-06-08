/*
 * Smart Public Toilet - ESP32 with Render HTTPS backend
 * - Simplified: only door servo, exit sensor, two LEDs, button.
 * - Button opens door immediately when pressed (IDLE or OCCUPIED).
 * - Green LED = free, Red LED = occupied.
 * - RFID and online payment still work.
 * - MQ135 and soap sensors report data.
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <SPI.h>
#include <MFRC522.h>

// ============================================================
//  WIFI & SERVER (CHANGE THESE)
// ============================================================
const char* WIFI_SSID     = "Fiacre";
const char* WIFI_PASSWORD = "0011223344";
const char* SERVER_HOST   = "public-toilets-by-fiacre-iit-engineer.onrender.com";
const int   SERVER_PORT   = 443;
const int   TOILET_ID     = 1;  // ✅ MATCHES DATABASE TOILET ID - Change if needed (1, 2, 3, etc)

// ============================================================
//  PINS
// ============================================================
#define TRIG1       13    // Exit ultrasonic — trigger
#define ECHO1       12    // Exit ultrasonic — echo
#define SERVO_DOOR  15    // Door servo
#define BTN_PIN     14    // Exit button (to GND, uses INPUT_PULLUP)
#define GREEN_LED   22    // Green LED (free)
#define RED_LED     21    // Red LED (occupied)
#define RFID_SS      5    // RC522 SDA/SS
#define RFID_RST     4    // RC522 RST

// Sensors
#define MQ135_PIN   34    // MQ135 air quality sensor (analog input)
#define SOAP_SENSOR_PIN  35   // Analog water level sensor for soap

// ============================================================
//  THRESHOLDS & TIMING
// ============================================================
#define DETECT_CM       5.0      // Presence within 5cm
#define DOOR_OPEN_MS    10000UL  // Door open 10s for entry/exit
#define PAYMENT_MS       2000UL  // Poll server every 2s
#define RFID_COOL_MS     3000UL  // Ignore re-tap 3s
#define SENSOR_REPORT_MS 10000UL // Send sensor data every 10 seconds

// Air quality thresholds (adjust after calibration)
#define MQ135_LOW_THRESH    200
#define MQ135_MEDIUM_THRESH 500

// Soap level thresholds (analog values, 0-4095)
#define SOAP_DRY_VALUE     100
#define SOAP_LOW_THRESH    600
#define SOAP_MEDIUM_THRESH 2000

// Servo angles
#define DOOR_OPEN_DEG    90
#define DOOR_SHUT_DEG     0
#define DOOR_MOVE_STEP_DEG 2
#define DOOR_MOVE_STEP_MS  25

// ============================================================
//  STATE MACHINE (simplified)
// ============================================================
enum State {
  S_IDLE,
  S_ENTRY_OPEN,
  S_OCCUPIED,
  S_EXIT_OPEN,
  S_CLEANUP
};

const char* STATE_NAMES[] = {
  "IDLE", "ENTRY_OPEN", "OCCUPIED", "EXIT_OPEN", "CLEANUP"
};

// ============================================================
//  GLOBALS
// ============================================================
Servo   doorServo;
MFRC522 rfid(RFID_SS, RFID_RST);

State         currentState   = S_IDLE;
unsigned long stateTimer     = 0;
unsigned long lastRfidTap    = 0;
unsigned long lastPayPoll    = 0;
unsigned long lastSensorReport = 0;
int           doorAngle      = DOOR_SHUT_DEG;

WiFiClientSecure client;

String currentSoapLevel = "High";
String currentSmellLevel = "Low";

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
//  ULTRASONIC (exit only)
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
    Serial.printf("  🚪 Exit sensor: %.1fcm\n", d);
    return true;
  }
  return false;
}

// ============================================================
//  STATE HELPERS
// ============================================================
unsigned long sinceState() { return millis() - stateTimer; }

void goToState(State s) {
  Serial.printf("\n🔄 STATE: %s → %s\n", STATE_NAMES[currentState], STATE_NAMES[s]);
  currentState = s;
  stateTimer = millis();
}

// ============================================================
//  HARDWARE ACTIONS (door only)
// ============================================================
void openDoor() {
  Serial.println(F("🚪 DOOR opening..."));
  int from = doorAngle;
  int to = DOOR_OPEN_DEG;
  if (from != to) {
    int step = (from < to) ? DOOR_MOVE_STEP_DEG : -DOOR_MOVE_STEP_DEG;
    for (int a = from; (step>0 ? a<=to : a>=to); a += step) {
      doorServo.write(a);
      delay(DOOR_MOVE_STEP_MS);
    }
    doorServo.write(to);
    doorAngle = to;
  }
  Serial.println(F("✅ DOOR OPEN"));
}

void closeDoor() {
  Serial.println(F("🚪 DOOR closing..."));
  int from = doorAngle;
  int to = DOOR_SHUT_DEG;
  if (from != to) {
    int step = (from < to) ? DOOR_MOVE_STEP_DEG : -DOOR_MOVE_STEP_DEG;
    for (int a = from; (step>0 ? a<=to : a>=to); a += step) {
      doorServo.write(a);
      delay(DOOR_MOVE_STEP_MS);
    }
    doorServo.write(to);
    doorAngle = to;
  }
  Serial.println(F("✅ DOOR CLOSED"));
}

// ============================================================
//  LED (two colours)
// ============================================================
void updateLEDs() {
  if (currentState == S_IDLE || currentState == S_CLEANUP) {
    digitalWrite(GREEN_LED, HIGH);
    digitalWrite(RED_LED, LOW);
  } else {
    digitalWrite(GREEN_LED, LOW);
    digitalWrite(RED_LED, HIGH);
  }
}

// ============================================================
//  BUTTON (simple debounce)
// ============================================================
bool buttonPressed() {
  static unsigned long lastDebounce = 0;
  static bool lastState = HIGH;
  bool now = digitalRead(BTN_PIN);
  if (now != lastState) {
    lastDebounce = millis();
  }
  if ((millis() - lastDebounce) > 50 && now == LOW) {
    lastState = now;
    Serial.println(F("🔘 Button pressed"));
    return true;
  }
  lastState = now;
  return false;
}

// ============================================================
//  SENSOR READING & REPORTING
// ============================================================
void updateSensorLevels() {
  int mq = analogRead(MQ135_PIN);
  if (mq < MQ135_LOW_THRESH) currentSmellLevel = "Low";
  else if (mq < MQ135_MEDIUM_THRESH) currentSmellLevel = "Medium";
  else currentSmellLevel = "High";
  Serial.printf("🌫️ MQ135: %d → Smell: %s\n", mq, currentSmellLevel.c_str());

  int soap = analogRead(SOAP_SENSOR_PIN);
  if (soap < SOAP_DRY_VALUE) currentSoapLevel = "Low";
  else if (soap < SOAP_LOW_THRESH) currentSoapLevel = "Low";
  else if (soap < SOAP_MEDIUM_THRESH) currentSoapLevel = "Medium";
  else currentSoapLevel = "High";
  Serial.printf("🧴 Soap: %d → Level: %s\n", soap, currentSoapLevel.c_str());
}

void sendSensorData() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient https;
  https.begin(client, serverBase() + "/api/hardware/sensor-update");
  https.addHeader("Content-Type", "application/json");
  StaticJsonDocument<128> doc;
  doc["toilet_id"] = TOILET_ID;
  doc["soap_level"] = currentSoapLevel;
  doc["smell_level"] = currentSmellLevel;
  String body;
  serializeJson(doc, body);
  int code = https.POST(body);
  https.end();
  Serial.printf("📡 Sensor data sent (HTTP %d)\n", code);
}

// ============================================================
//  HTTPS HELPERS
// ============================================================
String serverBase() { return String("https://") + SERVER_HOST + ":" + SERVER_PORT; }

void postEvent(const char* evt, const char* detail = "") {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient https;
  https.begin(client, serverBase() + "/api/hardware/log-event");
  https.addHeader("Content-Type", "application/json");
  StaticJsonDocument<200> d;
  d["toilet_id"] = TOILET_ID;
  d["event_type"] = evt;
  d["details"] = detail;
  String b;
  serializeJson(d, b);
  https.POST(b);
  https.end();
  Serial.printf("  🌐 Event logged: %s\n", evt);
}

void setOccupied(bool occ) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient https;
  https.begin(client, serverBase() + "/api/hardware/occupancy/" + TOILET_ID);
  https.addHeader("Content-Type", "application/json");
  StaticJsonDocument<64> d;
  d["is_occupied"] = occ;
  String b;
  serializeJson(d, b);
  int code = https.PUT(b);
  https.end();
  Serial.printf("  🌐 Occupancy set: %s (%d)\n", occ ? "OCCUPIED" : "FREE", code);
}

bool checkPayment() {
  if (millis() - lastPayPoll < PAYMENT_MS) return false;
  if (WiFi.status() != WL_CONNECTED) return false;
  lastPayPoll = millis();

  HTTPClient https;
  https.begin(client, serverBase() + "/api/hardware/payment-check/" + TOILET_ID);
  int code = https.GET();
  if (code != 200) {
    https.end();
    return false;
  }
  String resp = https.getString();
  https.end();

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, resp)) return false;

  const char* cmd = doc["command"] | "DENY";
  if (strcmp(cmd, "OPEN_DOOR") == 0) {
    Serial.println(F("💻 ONLINE PAYMENT CONFIRMED"));
    return true;
  }
  return false;
}

bool checkRFID() {
  if (millis() - lastRfidTap < RFID_COOL_MS) return false;
  if (!rfid.PICC_IsNewCardPresent()) return false;
  if (!rfid.PICC_ReadCardSerial()) return false;

  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (i > 0) uid += ":";
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  Serial.println("💳 Card UID: " + uid);
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  lastRfidTap = millis();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(F("⚠️ No WiFi"));
    return false;
  }

  HTTPClient https;
  https.begin(client, serverBase() + "/api/hardware/rfid-tap");
  https.addHeader("Content-Type", "application/json");
  StaticJsonDocument<128> req;
  req["uid"] = uid;
  req["toilet_id"] = TOILET_ID;
  String body;
  serializeJson(req, body);
  int code = https.POST(body);
  String resp = https.getString();
  https.end();

  if (code < 200 || code > 299) {
    Serial.println(F("❌ Server not reachable"));
    return false;
  }

  StaticJsonDocument<256> res;
  if (deserializeJson(res, resp)) {
    Serial.println(F("❌ Bad response"));
    return false;
  }

  const char* cmd = res["command"] | "DENY";
  if (strcmp(cmd, "OPEN_DOOR") == 0) {
    Serial.println(F("✅ ACCESS GRANTED"));
    return true;
  }
  const char* msg = res["message"] | "";
  Serial.printf("❌ DENIED: %s\n", msg);
  return false;
}

// ============================================================
//  SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(500);
  pinMode(BTN_PIN, INPUT_PULLUP);
  pinMode(MQ135_PIN, INPUT);
  pinMode(SOAP_SENSOR_PIN, INPUT);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);

  printHeader("  🚽 SMART PUBLIC TOILET (SIMPLIFIED)  🚽");

  pinMode(TRIG1, OUTPUT);
  pinMode(ECHO1, INPUT);

  doorServo.attach(SERVO_DOOR);
  doorServo.write(DOOR_SHUT_DEG);
  delay(600);

  SPI.begin(18, 19, 23, RFID_SS);
  rfid.PCD_Init();
  byte ver = rfid.PCD_ReadRegister(rfid.VersionReg);
  Serial.printf("RFID version: 0x%02X\n", ver);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("Connecting to %s", WIFI_SSID);
  for (int i = 0; i < 20 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n✅ WiFi OK IP: %s\n", WiFi.localIP().toString().c_str());
    client.setInsecure();
  } else {
    Serial.println(F("\n⚠️ WiFi FAILED"));
  }

  goToState(S_IDLE);
  updateLEDs();
  printHeader("  🟢 SYSTEM READY – PRESS BUTTON TO OPEN DOOR  🟢");
}

// ============================================================
//  MAIN LOOP
// ============================================================
void loop() {
  updateLEDs();
  bool btn = buttonPressed();

  // Periodic sensor reporting
  if (millis() - lastSensorReport >= SENSOR_REPORT_MS) {
    lastSensorReport = millis();
    updateSensorLevels();
    sendSensorData();
  }

  // Global failsafe – 20 min timeout
  if (currentState != S_IDLE && sinceState() > 20UL * 60 * 1000) {
    printHeader("⚠️ TIMEOUT RESET");
    closeDoor();
    setOccupied(false);
    goToState(S_IDLE);
    return;
  }

  switch (currentState) {

    case S_IDLE:
      // Button first, then RFID, then payment
      if (btn || checkRFID() || checkPayment()) {
        printHeader("  🟢 ACCESS GRANTED – OPENING DOOR  ");
        postEvent("door_open", "entry");
        openDoor();
        goToState(S_ENTRY_OPEN);
      }
      break;

    case S_ENTRY_OPEN:
      if (sinceState() >= DOOR_OPEN_MS) {
        closeDoor();
        setOccupied(true);
        postEvent("occupied", "person entered");
        Serial.println("✅ Person inside");
        goToState(S_OCCUPIED);
      }
      break;

    case S_OCCUPIED:
      // Button or exit sensor opens door
      if (btn || exitSensor()) {
        if (btn) postEvent("exit", "button");
        else postEvent("exit", "sensor");
        openDoor();
        goToState(S_EXIT_OPEN);
      }
      break;

    case S_EXIT_OPEN:
      if (sinceState() >= DOOR_OPEN_MS) {
        closeDoor();
        goToState(S_CLEANUP);
      }
      break;

    case S_CLEANUP:
      setOccupied(false);
      postEvent("door_close", "exit complete");
      printHeader("  🟢 TOILET FREE  🟢");
      goToState(S_IDLE);
      break;
  }

  // Debug every 5 seconds
  static unsigned long lastDbg = 0;
  if (millis() - lastDbg >= 5000) {
    lastDbg = millis();
    float d1 = getDistance(TRIG1, ECHO1);
    Serial.printf("📊 State:%-11s Exit:%.1fcm WiFi:%s\n",
      STATE_NAMES[currentState], d1,
      WiFi.status() == WL_CONNECTED ? "OK" : "DOWN");
  }
  delay(50);
}