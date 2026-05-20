# FINAL TESTING & DEPLOYMENT CHECKLIST

## ✅ PRE-ASSEMBLY CHECKLIST

Before you start wiring, verify you have everything:

### Power & Control
- [ ] ESP32 Development Board (with USB cable)
- [ ] 5V Power supply (USB power bank with at least 500mA)
- [ ] 12V Power supply (for pump, if not using USB)
- [ ] Breadboard(s) - at least 400 tie-points total
- [ ] Jumper wires (various colors and lengths)
- [ ] Multimeter (for testing connections)

### Actuators & Relays
- [ ] Servo Motor 1 (door) - SG90 or MG995
- [ ] Servo Motor 2 (lid) - SG90 or MG995
- [ ] Relay Module (5V logic level)
- [ ] Water Pump (12V DC or appropriate)
- [ ] LED (Green) - small indicator
- [ ] Push Button (momentary)

### Sensors
- [ ] Ultrasonic Sensor 1 (HC-SR04) - exit
- [ ] Ultrasonic Sensor 2 (HC-SR04) - bowl
- [ ] RFID Reader Module (MFRC522)
- [ ] RFID Cards/Tags (13.56MHz)

### Resistors
- [ ] 1kΩ resistors (2x for voltage dividers)
- [ ] 2kΩ resistors (2x for voltage dividers)
- [ ] 10kΩ resistor (1x for button pull-up)
- [ ] 330Ω resistor (1x for LED)

---

## 🔧 PHASE 1: PHYSICAL ASSEMBLY

### Step 1: Verify All Components Work
```
[ ] Test each servo: Apply 5V, should move smoothly
[ ] Test ultrasonic sensors: Should show distances on multimeter
[ ] Test RFID reader: Light should glow when powered
[ ] Test pump: Should run when relay triggered
[ ] Test button: Continuity when pressed
```

### Step 2: Assemble Breadboard Layout
```
[ ] Place ESP32 on breadboard
[ ] Create 5V and GND rails
[ ] Connect all 9 component groups
[ ] Use color-coded wires for clarity:
    - RED: 5V power
    - BLACK: GND
    - YELLOW: GPIO signals
    - BLUE: Sensor signals
    - GREEN: Button/control
```

### Step 3: Install Voltage Dividers
```
⚠️ CRITICAL - Do NOT skip this!

[ ] Voltage divider for US1 Echo (GPIO 27)
    - 1kΩ from sensor to junction
    - 2kΩ from junction to GND
    - Junction to GPIO 27
    
[ ] Voltage divider for US2 Echo (GPIO 12)
    - Same configuration as above

Test with multimeter:
    - Without signal: ~1.0V
    - With 5V input: ~3.3V (safe!)
```

### Step 4: Verify All Connections
```
[ ] Multimeter test: Continuity on each wire
[ ] No crossed wires (visual inspection)
[ ] All power rails solid (no gaps)
[ ] All GND connections solid
[ ] Servo connectors firmly seated
[ ] Sensor connectors firmly seated
```

---

## 🖥️ PHASE 2: SOFTWARE SETUP

### Step 5: Arduino IDE Installation
```
[ ] Arduino IDE 2.0+ installed
[ ] ESP32 board support installed
[ ] All libraries installed:
    - ArduinoJson 6.x
    - ESP32Servo
    - MFRC522
```

### Step 6: Configure Code
```
Open: SMART_TOILET_FINAL.ino

[ ] Edit WiFi SSID (your network name)
[ ] Edit WiFi PASSWORD (your network password)
[ ] Edit SERVER_IP (your server/laptop IP)
[ ] Edit SERVER_PORT (5000 or your port)
[ ] Edit TOILET_ID (1, 2, 3, etc.)

Find your IP:
Windows: 
  - Open CMD
  - Type: ipconfig
  - Look for "IPv4 Address"
```

### Step 7: Upload to ESP32
```
[ ] Connect ESP32 via USB
[ ] Tools → Port → Select COM port
[ ] Tools → Board → ESP32 Dev Module
[ ] Sketch → Verify (compile check)
[ ] Sketch → Upload (send to board)
[ ] Wait for "Hard resetting via RTS pin..."
```

---

## 🧪 PHASE 3: COMPONENT-LEVEL TESTING

### Test 3a: Servo Motors
```
Serial Monitor (115200 baud):

[ ] ESP32 powers up
[ ] You hear servo "click" twice
[ ] Output shows:
    ✅ Servos initialized
    
Physical check:
[ ] Servo 1 (door) in 0° position
[ ] Servo 2 (lid) in 0° position
[ ] Both servos respond smoothly
```

### Test 3b: Ultrasonic Sensors
```
Serial Monitor output every 2 seconds:

📊 [IDLE] Pump:OFF Exit:255.0cm Bowl:127.5cm

Test:
[ ] Hand near Exit sensor (GPIO 27)
    - Distance should decrease
    - Should trigger at ~5cm or less
    
[ ] Hand near Bowl sensor (GPIO 12)
    - Distance should decrease
    - Should trigger at ~5cm or less

Debug if not working:
- Check voltage dividers with multimeter
- Check sensor power (5V)
- Check TRIG pin pulse
```

### Test 3c: RFID Reader
```
Hold RFID card near antenna:

Serial Monitor should show:
🔖 Card UID: AB CD EF 01 23
(actual numbers will be different)

If not working:
[ ] Check 3.3V power (NOT 5V!)
[ ] Check SPI pins: 18, 19, 23, 5, 4
[ ] Try different RFID cards
[ ] Check antenna is clear of obstacles
```

### Test 3d: Push Button
```
Press button inside toilet:

Serial Monitor (watch for state changes):
(No specific debug output, but state may change)

Multimeter test:
[ ] GPIO 14 reads HIGH when not pressed
[ ] GPIO 14 reads LOW when pressed
[ ] Consistent debouncing
```

### Test 3e: LED Status
```
[ ] LED OFF when system idle
[ ] LED blinks when in OCCUPIED state
[ ] Blink rate ~500ms on/off
[ ] Stops blinking when returning to IDLE
```

### Test 3f: Relay & Pump
```
Manually trigger pump (modify code or use logic analyzer):

Serial Monitor shows:
💧 PUMP ON
💧 PUMP OFF

Physical check:
[ ] Relay makes "click" sound when ON
[ ] Relay makes "click" sound when OFF
[ ] Pump motor starts when relay ON
[ ] Pump motor stops when relay OFF

If not working:
[ ] Check GPIO 32 connection
[ ] Check relay VCC power (5V)
[ ] Check relay Common→12V(+)
[ ] Check relay NO→Pump(+)
[ ] CRITICAL: Check 12V(-) = ESP32 GND
```

---

## 🌐 PHASE 4: WIFI & API INTEGRATION

### Test 4a: WiFi Connection
```
Serial Monitor shows:

📡 Connecting to WiFi: YOUR_SSID
..........
✅ WiFi connected
IP: 192.168.x.xxx
Server: http://192.168.x.xxx:5000

If WiFi fails:
[ ] Check SSID spelling (case-sensitive)
[ ] Check password spelling (case-sensitive)
[ ] Check router 2.4GHz is enabled
[ ] Check network is not hidden
[ ] Try using IP instead of hostname
```

### Test 4b: Server Connection
```
From another computer:
[ ] Ping server: ping 192.168.x.xxx
    Should show replies
    
[ ] Try accessing in browser:
    http://192.168.x.xxx:5000
    Should show something (error or page)
    
[ ] Check Node.js server is running
    Terminal should show:
    Server running on port 5000
    
If not connected:
[ ] Check firewall allows port 5000
[ ] Check both devices on same network
[ ] Check server process is running
```

### Test 4c: API Endpoints
```
From browser, try:
[ ] http://server:5000/api/public/toilets
    Should show toilet list

From ESP32 Serial Monitor:
[ ] [HTTP] POST /api/hardware/log-event → 200 OK
[ ] [HTTP] POST /api/hardware/occupancy/1 → 200 OK
[ ] [HTTP] GET /api/hardware/payment-check/1 → 200 OK

If fails:
[ ] Check Node.js backend is running
[ ] Check database is running
[ ] Check API routes in Node.js code
```

---

## 🎯 PHASE 5: FULL SYSTEM INTEGRATION TEST

### Test 5a: RFID Payment Flow
```
1. System shows: STATE → IDLE
2. Hold RFID card near reader
3. Serial Monitor shows:
   🔖 Card UID: AB CD EF 01 23
   [HTTP] POST /api/hardware/rfid-tap → 200 OK
   ✅ Payment confirmed — opening door (RFID)
4. Watch state transitions:
   STATE → DOOR_OPENING
   🚪 Door opening
   STATE → DOOR_OPEN
   (after 10s)
   STATE → DOOR_CLOSING
   🚪 Door closed
   STATE → OCCUPIED
5. LED blinks (green)
6. Serial shows:
   📊 [OCCUPIED] Pump:OFF Exit:...

Pass: ✓ All states transitioned correctly
```

### Test 5b: Online Payment Flow
```
1. System shows: STATE → IDLE
2. Open index.html in browser
3. Enter phone number: 078XXXXXXX
4. Click "Pay to Enter"
5. Watch ESP32 Serial Monitor:
   [HTTP] GET /api/hardware/payment-check/1
   (repeats every 2 seconds)
6. When payment ready:
   ✅ Online payment confirmed
   STATE → DOOR_OPENING
7. Same flow as Test 5a follows

Pass: ✓ Payment triggers door opening
```

### Test 5c: Usage Flow (Bowl Detection)
```
While OCCUPIED:
1. Simulate person sitting (hand ~5cm above bowl sensor)
2. Serial shows:
   Bowl:4.8cm (distance decreased)
   🪑 Person detected in bowl
   STATE → LID_OPENING
   🪑 Lid opening
3. Wait for state changes:
   STATE → LID_OPEN_WAIT
   (after 0.5s)
   STATE → FLUSHING
   💧 PUMP ON
   (pump runs for 5 seconds)
   💧 PUMP OFF
   STATE → LID_CLOSING
   (after 5s)
4. Back to OCCUPIED

Pass: ✓ Full flush cycle complete
```

### Test 5d: Exit Flow (Button Press)
```
While OCCUPIED (no active flush):
1. Press button
2. Serial shows:
   STATE → EXIT_OPENING
   🚪 Exit triggered
   STATE → EXIT_OPEN
3. Wait 10 seconds for door to close
4. Serial shows:
   STATE → EXIT_CLOSING
   🏁 Exit complete → toilet AVAILABLE
   STATE → IDLE
5. Back to IDLE, ready for next payment

Pass: ✓ Manual exit works
```

### Test 5e: Auto-Exit Flow (5-second timeout)
```
1. Person enters (payment or RFID)
2. Goes through DOOR_OPENING → OCCUPIED
3. Wait 5 seconds without any motion
4. Serial shows:
   ⏱️ No motion for 5s → auto-exit triggered
   STATE → EXIT_OPENING
5. Door opens, waits, closes
6. Back to IDLE

Pass: ✓ Auto-exit triggers correctly
```

---

## ✔️ PHASE 6: FULL SYSTEM VALIDATION

### Test 6a: 30-Minute Continuous Operation
```
[ ] Run system for 30 minutes
[ ] Cycle through payment 3+ times
[ ] Simulate users entering and exiting
[ ] Monitor Serial output for errors
[ ] Check no memory leaks (Serial should be clean)
[ ] Check no missed states
[ ] Check all timing is accurate

Pass: ✓ System stable over time
```

### Test 6b: Stress Test (Rapid Payments)
```
[ ] Trigger 10 rapid payments
[ ] Check system doesn't crash
[ ] Check states transition properly
[ ] Check no payments are missed
[ ] Check relay doesn't get stuck

Pass: ✓ System handles rapid events
```

### Test 6c: Sensor Noise Rejection
```
[ ] Wave hand rapidly near exit sensor
   Should NOT trigger false exits
[ ] Vibrate sensor modules
   Should NOT cause state changes
[ ] Cover sensor with paper
   Should NOT trigger

Pass: ✓ System ignores noise
```

### Test 6d: WiFi Disconnection Recovery
```
[ ] System running and connected
[ ] Disable WiFi on network
[ ] Watch system for 1 minute
   Serial: "⚠️ WiFi failed"
[ ] Re-enable WiFi
[ ] Watch system reconnect
   Serial: "✅ WiFi connected"
[ ] RFID still works (local)

Pass: ✓ Graceful degradation, recovery works
```

---

## 📋 SYSTEM READINESS CHECKLIST

Before going to production, verify EVERY item:

### Hardware
- [ ] All 9 component groups wired correctly
- [ ] Voltage dividers installed on ECHO pins
- [ ] Common ground verified with multimeter
- [ ] No loose connections (physical inspection)
- [ ] Servos move smoothly (0-90°)
- [ ] Pump relay makes click sound
- [ ] All sensors powered and responding

### Software
- [ ] Code compiles without errors
- [ ] WiFi credentials correct
- [ ] Server IP and port correct
- [ ] Code uploaded successfully
- [ ] Serial Monitor shows "SYSTEM READY"

### Integration
- [ ] WiFi connects at startup
- [ ] Server API responding (200 OK)
- [ ] RFID reads cards consistently
- [ ] Payment API working
- [ ] All states transition smoothly
- [ ] LED status indicators working
- [ ] Pump timing is correct (10s + 5s)

### Testing
- [ ] Test 5a: RFID flow ✓
- [ ] Test 5b: Online payment flow ✓
- [ ] Test 5c: Usage flow ✓
- [ ] Test 5d: Exit flow ✓
- [ ] Test 5e: Auto-exit flow ✓
- [ ] Test 6a: 30-min continuous ✓
- [ ] Test 6b: Rapid payments ✓
- [ ] Test 6c: Sensor noise ✓
- [ ] Test 6d: WiFi recovery ✓

### Safety
- [ ] No exposed wires
- [ ] No water near electronics
- [ ] Servo movement tested (no jams)
- [ ] Pump doesn't run continuously
- [ ] Button is accessible inside
- [ ] LED visible for status

---

## 📱 QUICK TROUBLESHOOTING (During Testing)

### Issue: Servo not moving
```
Check list:
→ 5V power to servo?    (multimeter at Red/Brown)
→ Servo signal to GPIO? (test wire continuity)
→ Code GPIO correct?    (check SERVO_PIN_1 = 15)
→ Servo brand works?    (test with separate 5V)
```

### Issue: Sensors show fixed value
```
Check list:
→ Power on sensor?      (check VCC)
→ Voltage divider OK?   (test with multimeter)
→ Echo pin connected?   (check GPIO pin)
→ TRIG pin connected?   (check GPIO pin)
→ Sensor getting ultrasonic reflections?
```

### Issue: RFID not reading
```
Check list:
→ 3.3V power? (NOT 5V!) (check VCC voltage)
→ SPI pins correct?     (18, 19, 23, 5, 4)
→ Antenna clear?        (no metal nearby)
→ Card valid?           (try different card)
```

### Issue: Payment not triggering door
```
Check list:
→ WiFi connected?       (check Serial)
→ Server running?       (check Node.js)
→ API responding?       (check browser)
→ GPIO 32 connected?    (check relay)
→ Relay power OK?       (check VCC)
```

---

## 🚀 DEPLOYMENT

Once all tests pass:

1. **Physical installation**
   - Mount all sensors in correct positions
   - Secure wiring with cable ties
   - Protect electronics from water
   - Ensure good ventilation

2. **Final verification**
   - Power up system
   - Verify Serial shows "SYSTEM READY"
   - Run 5 payment cycles
   - Check all states work

3. **User instruction**
   - Post instructions in toilet
   - Test with real users
   - Monitor Serial for first day
   - Be ready for adjustments

4. **Maintenance**
   - Monitor system daily for errors
   - Check sensor cleanliness
   - Verify WiFi stability
   - Log any unusual behavior

---

## 📞 SUPPORT

If you encounter issues:

1. **Check Serial Monitor Output**
   - Baud rate: 115200
   - Look for error messages
   - Match against troubleshooting section

2. **Test Individual Components**
   - Test servo separately
   - Test sensor separately
   - Test relay separately

3. **Use Multimeter**
   - Verify all voltages
   - Check continuity
   - Identify bad connections

4. **Review Documentation**
   - COMPLETE_WIRING_GUIDE.md (full details)
   - QUICK_REFERENCE.md (pin assignments)
   - STATE_MACHINE_FLOWS.md (state transitions)
   - SETUP_GUIDE.md (step-by-step)

