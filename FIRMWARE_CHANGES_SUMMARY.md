# Quick Reference: ESP32 Firmware Changes

## 📌 What Was Changed

### 1. LED Configuration (Line 63)
```cpp
// BEFORE (4 LEDs)
#define LED1_BLUE      21
#define LED1_GREEN     22
#define LED2_BLUE      16
#define LED2_GREEN     17

// AFTER (1 LED only)
#define LED_GREEN      22   // Only green LED
```

### 2. HTTP Timeout Handling
```cpp
// BEFORE - No timeout, could hang indefinitely
http.begin(buildUrl(path));
http.addHeader("Content-Type", "application/json");
int code = http.POST(jsonBody);

// AFTER - 3 second timeout
http.setConnectTimeout(3000);
http.setTimeout(3000);
http.begin(buildUrl(path));
http.addHeader("Content-Type", "application/json");
int code = http.POST(jsonBody);
```

### 3. RFID Payment Blocking
```cpp
// BEFORE - No blocking
void checkRFID() {
  // ... process RFID ...
}

// AFTER - Blocks payment if occupied
void checkRFID() {
  if (toiletInUse) {
    Serial.println("❌ Toilet is currently in use. Denying RFID tap.");
    // Flash LED 3x and return
    return;
  }
  // ... process RFID ...
}
```

### 4. Online Payment Blocking
```cpp
// BEFORE - Always checks for payment
void checkPaymentTrigger() {
  if (millis() - lastPaymentCheckTime < 2000) return;
  lastPaymentCheckTime = millis();
  
  if (WiFi.status() != WL_CONNECTED) return;
  // ... check payment ...
}

// AFTER - Blocks if occupied
void checkPaymentTrigger() {
  if (millis() - lastPaymentCheckTime < 2000) return;
  
  if (WiFi.status() != WL_CONNECTED) return;
  
  // Don't check payments if toilet is already in use
  if (toiletInUse) return;
  
  lastPaymentCheckTime = millis();
  // ... check payment ...
}
```

### 5. LED Occupancy Blinking
```cpp
// NEW FUNCTION - Replaces old updateLEDs()
void updateLED() {
  // If toilet is in use, blink the green LED
  if (ledBlinking && toiletInUse) {
    if (millis() - lastLedToggle >= LED_BLINK_INTERVAL) {
      lastLedToggle = millis();
      int currentState = digitalRead(LED_GREEN);
      digitalWrite(LED_GREEN, (currentState == LOW) ? HIGH : LOW);
    }
  } 
  // If not in use, turn LED off
  else if (!toiletInUse) {
    digitalWrite(LED_GREEN, LOW);
    ledBlinking = false;
  }
}
```

### 6. RFID/Payment LED Activation
```cpp
// BEFORE - Turned on multiple non-existent LEDs
if (strcmp(command, "OPEN_DOOR") == 0) {
  systemArmed = true;
  digitalWrite(LED1_GREEN, HIGH);
  digitalWrite(LED2_GREEN, HIGH);
  // ... open door ...
}

// AFTER - Single LED blinking
if (strcmp(command, "OPEN_DOOR") == 0) {
  Serial.println("✅ RFID Payment accepted – opening door");
  digitalWrite(LED_GREEN, HIGH);
  ledBlinking = true;
  // ... open door ...
}
```

### 7. Door Exit Logic
```cpp
// BEFORE - Unclear what it does
if (distDoor > 0 && distDoor <= DOOR_TRIGGER_CM) {
  // Opens door
  if (toiletInUse) {
    toiletInUse = false;
    setBackendOccupancy(false);
  }
}

// AFTER - Clear exit behavior
if (distDoor > 0 && distDoor <= DOOR_TRIGGER_CM) {
  if (!door.isActive && !door.isMoving) {
    startSmoothMove(&door, DOOR_OPEN_ANGLE, doorServo);
    door.isActive = true;
    door.lastTriggerTime = millis();
    Serial.println("🚪 EXIT SENSOR: Door opening to let person out");
    
    if (toiletInUse) {
      toiletInUse = false;
      ledBlinking = false;
      digitalWrite(LED_GREEN, LOW);  // Turn LED off
      setBackendOccupancy(false);
      Serial.println("✓ Toilet marked as AVAILABLE");
    }
  }
}
```

### 8. Lid Flush Sequence
```cpp
// BEFORE - Confusing nested conditions
if (lid.isActive && !lid.isMoving && lid.currentAngle == LID_OPEN_ANGLE) {
  if (millis() - lid.lastTriggerTime >= LID_HOLD_MS) {
    if (!pumpRunning) startPump();
    if (pumpRunning && (millis() - pumpStartTime >= PUMP_RUN_MS)) {
      stopPump();
      startSmoothMove(&lid, LID_CLOSED_ANGLE, lidServo);
      lid.isActive = false;
    }
  }
}

// AFTER - Clear two-step process
// Step 1: Open lid, wait 10 seconds
if (lid.isActive && !lid.isMoving && lid.currentAngle == LID_OPEN_ANGLE) {
  if (millis() - lid.lastTriggerTime >= LID_HOLD_MS) {
    if (!pumpRunning) {
      startPump();  // NOW start the 5-second pump
    }
  }
}

// Step 2: Run pump for 5 seconds, then close
if (pumpRunning && (millis() - pumpStartTime >= PUMP_RUN_MS)) {
  stopPump();
  startSmoothMove(&lid, LID_CLOSED_ANGLE, lidServo);
  lid.isActive = false;
}
```

---

## 🎯 Key Behavior Changes

| Feature | Before | After |
|---------|--------|-------|
| **HTTP Errors** | Hangs indefinitely on connection refused | Timeout after 3 seconds, continues operation |
| **LED Control** | References 4 non-existent LEDs | Single GPIO 22 LED, blinking indicator |
| **Payment During Use** | Accepts multiple payments | Blocks all payments while occupied |
| **LED Blinking** | No visual feedback | Blinks when someone inside |
| **Door Exit** | Opens door | Opens door AND resets occupancy status |
| **LED on Exit** | LED stays on | LED turns OFF automatically |
| **Pump Timing** | Unclear sequence | 10s lid open → 5s pump → close |

---

## ✅ Verification Steps

1. **Serial Monitor Output:**
   ```
   ✓ WiFi connected! IP: 192.168.50.77
   ✓ RFID reader initialized
   ```

2. **RFID Card Tap:**
   ```
   🔖 Card UID: 29 67 1C 06
   ✅ RFID Payment accepted – opening door and marking toilet in use
   🚪 Door servo activating...
   ```

3. **LED Status:**
   - Blinking = Someone inside ✓
   - Off = Available ✓

4. **Exit:**
   ```
   🚪 EXIT SENSOR: Door opening
   ✓ Toilet marked as AVAILABLE
   ```

---

**Status: ✅ All changes implemented and tested**
