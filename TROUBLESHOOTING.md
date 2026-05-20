# Troubleshooting Guide

## 🔴 Common Issues & Solutions

### Issue 1: "WiFi failed — running in offline mode"

**Problem:**
```
⚠️  WiFi failed — running in offline mode
```

**Causes:**
- WIFI_SSID is incorrect (check spelling: "Fiacre")
- WIFI_PASSWORD is incorrect or wrong
- ESP32 WiFi module issue
- Router not broadcasting WiFi at 2.4GHz (some routers use 5GHz only)

**Solutions:**
1. Verify WiFi credentials in code (Lines 43-44)
   ```cpp
   const char* WIFI_SSID      = "Fiacre";       // Exact spelling
   const char* WIFI_PASSWORD  = "0012345678";   // Correct password
   ```

2. Check router settings - must be 2.4GHz WiFi (ESP32 doesn't support 5GHz)

3. Restart ESP32 after uploading code

4. Try moving ESP32 closer to router

5. If still failing, use Serial Monitor to see WiFi debug:
   ```cpp
   WiFi.setDebugOutput(true);  // Add this line before WiFi.begin()
   ```

---

### Issue 2: "[HTTP] POST ... FAILED (no connection or timeout)"

**Problem:**
```
[HTTP] POST /api/hardware/rfid-tap FAILED (no connection or timeout)
```

**Causes:**
- Server (Node.js) is not running
- Server IP is wrong (should be 192.168.50.25)
- Server port is wrong (should be 5000)
- Server is running but not listening on that IP:port
- Network firewall blocking connection

**Solutions:**
1. **Verify server is running:**
   ```bash
   # On your Windows PC, check if port 5000 is open
   netstat -ano | findstr :5000
   
   # Should show Node.js process listening
   ```

2. **Check server IP:**
   - On PC: `ipconfig` → look for IPv4 Address (192.168.x.x)
   - Make sure it matches line 47 in ESP32 code
   - Should be on SAME WiFi network as ESP32

3. **Verify Node.js server:**
   ```bash
   cd c:\NEW_PROJECT_CODES\smart-public-toilet
   node server.js
   
   # Should show: "Server running on port 5000"
   ```

4. **Test connection from ESP32 perspective:**
   - In Arduino Serial Monitor, you should see:
     ```
     ✓ WiFi connected! IP: 192.168.50.77
        Server: http://192.168.50.25:5000/api
     ```

5. **If still failing, check Windows Firewall:**
   - Allow Node.js through Windows Firewall
   - Or temporarily disable for testing

---

### Issue 3: Door doesn't open when RFID card is tapped

**Problem:**
- Card UID appears in serial but door doesn't open

**Possible Causes:**

**Cause A: Server doesn't return "OPEN_DOOR" command**
```
[RFID] ⚠️  No server response — offline mode, denying
```
- Solution: Make sure server is running (see Issue 2)

**Cause B: Card balance is too low**
```
❌ Access denied: Insufficient balance
```
- Solution: Check card balance in database
- Default fare: RWF 200 per use

**Cause C: Toilet is already in use**
```
❌ Toilet is currently in use. Denying RFID tap (payment blocked).
```
- Solution: Wait for current user to exit (sensor 1 will detect exit)
- Green LED will turn OFF when toilet becomes available

**Cause D: Servo not connected**
- Serial will show door servo initialization
- Check GPIO 15 has servo connected
- Check servo power supply

---

### Issue 4: LED is not blinking

**Problem:**
- Green LED doesn't blink when door opens

**Solutions:**

1. **Verify LED is connected:**
   - GPIO 22 (D22) should have LED positive
   - LED negative to GND
   - LED should have resistor (220-470Ω)

2. **Check code is sending signal:**
   ```cpp
   // Should see in serial:
   ✅ RFID Payment accepted – opening door and marking toilet in use
   ```

3. **Test LED directly:**
   - Upload this test sketch:
   ```cpp
   void setup() {
     pinMode(22, OUTPUT);
   }
   
   void loop() {
     digitalWrite(22, HIGH);
     delay(500);
     digitalWrite(22, LOW);
     delay(500);
   }
   ```
   - LED should blink every 1 second

4. **Check LED polarity:**
   - Long leg = positive (GPIO 22)
   - Short leg = negative (GND)

---

### Issue 5: Sensor 1 (door) not triggering

**Problem:**
- Sensor detects but door doesn't open when person approaches

**Solutions:**

1. **Check distance:**
   - Sensor triggers at 6cm by default (can adjust: `DOOR_TRIGGER_CM`)
   - Hold hand at different distances, check serial output
   - Distance should appear in serial: `Distance: 5.2cm`

2. **Verify sensor connections:**
   - TRIG = GPIO 13
   - ECHO = GPIO 12
   - Both need 5V power and GND

3. **Test sensor:**
   - Bring hand close to sensor
   - Serial should show: `🚪 EXIT SENSOR: Door opening`

4. **If sensor reads always 0 or -1:**
   - Sensor may be disconnected
   - Try different GPIO pins

---

### Issue 6: Sensor 2 (lid) not triggering

**Problem:**
- Motion detected but lid doesn't open

**Possible Causes:**

**Cause A: Toilet must be in use first**
- Sensor 2 ONLY works if `toiletInUse = true`
- First, open door via RFID/payment
- Then wave hand at lid sensor
- Serial shows: `🫖 LID SENSOR: Lid opening`

**Cause B: Servo not working**
- GPIO 33 should have lid servo
- Check servo power supply

**Cause C: Sensor detection distance too short**
- Default: 10cm (can adjust: `LID_TRIGGER_CM = 10.0`)
- Try different distances

---

### Issue 7: Pump doesn't run or lid doesn't close

**Problem:**
- Lid opens but pump never runs or lid never closes

**Solutions:**

1. **Verify pump timing:**
   - Lid should stay open for 10 seconds: `LID_HOLD_MS = 10000`
   - Pump should run for 5 seconds: `PUMP_RUN_MS = 5000`
   - Serial shows: `💧 FLUSHING (pump ON)` → (5s) → `💧 Flush complete (pump OFF)`

2. **Check relay/pump:**
   - GPIO 32 controls relay
   - When `digitalWrite(RELAY_PIN, LOW)` → pump ON
   - When `digitalWrite(RELAY_PIN, HIGH)` → pump OFF
   - Listen for relay clicking when pump should run

3. **Test relay with simple code:**
   ```cpp
   void setup() {
     pinMode(32, OUTPUT);
   }
   
   void loop() {
     digitalWrite(32, LOW);   // Pump ON
     delay(2000);
     digitalWrite(32, HIGH);  // Pump OFF
     delay(2000);
   }
   ```

4. **Check pump power:**
   - Pump needs 12V
   - Verify external power supply

---

### Issue 8: Multiple payments accepted (blocking not working)

**Problem:**
- Second RFID tap works while first person still inside

**Should see:**
```
❌ Toilet is currently in use. Denying RFID tap (payment blocked).
```

**Verify:**
1. First RFID tap succeeds and serial shows:
   ```
   ✅ RFID Payment accepted
   ```

2. Try another tap immediately:
   ```
   ❌ Toilet is currently in use. Denying RFID tap (payment blocked).
   ```

3. Green LED should be blinking

4. Exit via door sensor → LED turns OFF

5. Now try RFID again - should work

**If still accepting payments:**
- Check `toiletInUse` variable is being set correctly
- Verify door sensor is working (exit not being detected)

---

### Issue 9: Door/Lid servo goes to wrong position

**Problem:**
- Door opens but goes too far or not far enough
- Lid does same

**Solutions:**

1. **Adjust servo angles (Lines 95-96):**
   ```cpp
   const int   DOOR_OPEN_ANGLE   = 90;      // 0 = closed, 90 = open
   const int   DOOR_CLOSED_ANGLE = 0;
   const int   LID_OPEN_ANGLE    = 90;      // 0 = closed, 90 = open
   const int   LID_CLOSED_ANGLE  = 0;
   ```
   - Try: 80, 85, 95, 100 if 90 doesn't work right

2. **Smooth movement speed (Line 97):**
   ```cpp
   const int   STEP_DELAY_MS = 15;  // Lower = faster, Higher = slower
   ```

---

## 🟢 What Success Looks Like

### Boot Sequence:
```
╔════════════════════════════════════════╗
║   SMART PUBLIC TOILET — ESP32 BOOT    ║
╚════════════════════════════════════════╝
✓ Servos initialized
✓ RFID reader initialized
📡 Connecting to WiFi: Fiacre
✓ WiFi connected! IP: 192.168.50.77
   Server: http://192.168.50.25:5000/api

╔════════════════════════════════════════╗
║        SYSTEM READY FOR USE            ║
║  • RFID card: Pay and enter            ║
║  • Online payment: Door opens + LED    ║
║  • LED blinking = Person inside        ║
╚════════════════════════════════════════╝
```

### RFID Payment Flow:
```
🔖 Card UID: 29 67 1C 06
✅ RFID Payment accepted – opening door
🚪 EXIT SENSOR: Door opening to let person out
✓ Toilet marked as AVAILABLE
```

### LED Status:
```
Blinking 🟢🟢🟢 = Someone inside
Off    🔴 = Available for next user
```

---

## 📞 Still Not Working?

1. **Check serial output carefully** - it tells you exactly what's happening
2. **Verify all connections** - loose wire is most common issue
3. **Restart ESP32** - upload code and wait 5 seconds
4. **Restart Node.js server** - sometimes helps with connection issues
5. **Test individually:**
   - WiFi alone
   - Servos alone
   - Sensors alone
   - Then together

**Good luck! 🚀**
