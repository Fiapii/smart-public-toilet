# SMART PUBLIC TOILET - STEP-BY-STEP SETUP GUIDE

## 🔧 PART 1: HARDWARE ASSEMBLY (Physical Wiring)

### STEP 1: Prepare Your Workspace
```
✓ Have breadboard(s) ready on a stable surface
✓ Gather all components (listed in COMPLETE_WIRING_GUIDE.md)
✓ Use a multimeter to test components before assembly
✓ Organize jumper wires by color for easy tracking
```

### STEP 2: Mount the ESP32 on Breadboard
```
Place ESP32 with:
- USB connector on left side
- Pins facing DOWN into breadboard
- GPIO pins distributed evenly for easier wiring
```

### STEP 3: Create Power Rails (CRITICAL!)

**Step 3a: 5V Power Rail**
```
1. Connect ESP32 5V pin to positive rail on breadboard
2. Connect ESP32 GND pin to negative (ground) rail
3. Power rail should run full length of breadboard for easy access
   ┌────────────────────────────────────┐
   │ 5V positive ───────────────────│   │
   │ GND negative ───────────────────│   │
   └────────────────────────────────────┘
```

**Step 3b: 3.3V Power Rail (if needed)**
```
1. Connect ESP32 3V3 pin to another positive rail
2. Use for: RFID reader only (NOT sensors!)
```

**Step 3c: Common Ground (CRITICAL FOR 12V SYSTEM)**
```
If using 12V pump:
1. Connect ESP32 GND to 12V power supply GND
2. This MUST be done! Without it, relay won't work properly
3. Use thick wire for ground connections (less resistance)
```

### STEP 4: Wire the Servo Motors

**Servo 1 (Door) - GPIO 15**
```
Physical Servo Connector:
┌─────────────────┐
│ • Red (VCC)     │
│ • Brown (GND)   │
│ • Yellow (PWM)  │
└─────────────────┘

Breadboard connections:
- Red wire    ──► 5V rail
- Brown wire  ──► GND rail
- Yellow wire ──► GPIO 15 (via jumper wire)

⚠️ Make sure servo gets solid 5V power (not through GPIO)
```

**Servo 2 (Lid) - GPIO 33**
```
Same as Servo 1, but:
- Yellow wire connects to GPIO 33
- Separate from Servo 1 for independent control
```

### STEP 5: Wire the RELAY (Pump Control)

**Relay Module - GPIO 32**
```
Relay Module has 3 connectors:
┌──────────────────────┐
│ VCC  │ IN  │ GND     │
└──────────────────────┘

Breadboard connections:
- VCC (left)   ──► 5V rail
- GND (right)  ──► GND rail  
- IN (middle)  ──► GPIO 32

Relay Internal Setup (should be pre-wired):
  ┌────────────┐
  │ COM  │ NO  │
  └────────────┘
  
- COM (Common) ──► 12V power supply (+)
- NO (Normally Open) ──► Pump power (+)
- Pump GND ──► 12V power supply (-)
```

### STEP 6: Wire Ultrasonic Sensor 1 (EXIT)

**HC-SR04 Module - GPIO 26 (TRIG), GPIO 27 (ECHO)**
```
Physical Sensor Connector:
┌─────────────┐
│ VCC TRIG... │
│ ECHO GND    │
└─────────────┘

Breadboard connections:
- VCC   ──► 5V rail
- GND   ──► GND rail
- TRIG  ──► GPIO 26
- ECHO  ──► Voltage Divider (see below)

⚠️ CRITICAL: VOLTAGE DIVIDER ON ECHO PIN
   The sensor outputs 5V, but ESP32 GPIO expects 3.3V max
   
   Create voltage divider using 1kΩ and 2kΩ resistors:
   
   From Sensor ECHO:
        │
       [1kΩ resistor]
        │
        ├─────────────► GPIO 27
        │
       [2kΩ resistor]
        │
       GND
   
   This safely converts 5V → 3.3V
```

### STEP 7: Wire Ultrasonic Sensor 2 (BOWL)

**HC-SR04 Module - GPIO 13 (TRIG), GPIO 12 (ECHO)**
```
Same as Sensor 1, but different pins:
- TRIG  ──► GPIO 13
- ECHO  ──► Voltage Divider ──► GPIO 12

Same voltage divider configuration!
```

### STEP 8: Wire Push Button (INSIDE)

**Momentary Button - GPIO 14**
```
Button has 2 pins, connected diagonally on button:

              GPIO 14
                │
              10kΩ
                │
                ├────► 3.3V
                │
            Button
                │
              GND

When button is PRESSED:  GPIO 14 reads LOW
When button is RELEASED: GPIO 14 reads HIGH (pulled up by resistor)
```

### STEP 9: Wire LED Status (GREEN)

**LED - GPIO 22**
```
LED has 2 pins:
- Longer leg = Anode (+)
- Shorter leg = Cathode (-)

Connections:
┌─────────────┐
│ LED Anode   │───[330Ω resistor]───► GPIO 22
│ LED Cathode │─────────────────────► GND
└─────────────┘

When GPIO 22 is HIGH: LED lights up (blinks during use)
When GPIO 22 is LOW:  LED is off (idle state)
```

### STEP 10: Wire RFID Reader

**MFRC522 Module - SPI Pins + GPIO 4, 5**
```
MFRC522 Connector Pinout:
┌────────────────┐
│ GND SDA RST    │
│ +5V MOSI MISO  │
│ SCK            │
└────────────────┘

Breadboard connections (⚠️ Use 3.3V, NOT 5V!):
- GND  ──► GND rail
- +5V  ──► 3.3V rail (NOT 5V!)
- RST  ──► GPIO 4
- SDA  ──► GPIO 5
- MOSI ──► GPIO 23
- MISO ──► GPIO 19
- SCK  ──► GPIO 18

SPI pins (18, 19, 23) are shared - only one SPI device can use at a time
```

---

## 🖥️ PART 2: SOFTWARE SETUP

### STEP 11: Install Arduino IDE
```
1. Download from: https://www.arduino.cc/en/software
2. Install for Windows
3. Open Arduino IDE
```

### STEP 12: Install ESP32 Board Support
```
1. File → Preferences
2. In "Additional Boards Manager URLs" add:
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
3. Tools → Board Manager
4. Search "esp32"
5. Install "ESP32 by Espressif Systems"
6. Select Board: Tools → Board → ESP32 Dev Module
```

### STEP 13: Install Required Libraries
```
In Arduino IDE:
1. Sketch → Include Library → Manage Libraries

Search and install each:
- "ArduinoJson" by Benoit Blanchon (version 6.x)
- "ESP32Servo" by John K. Bennett
- "MFRC522" by GithubCommunity

2. Once installed, you can include them in code:
   #include <ArduinoJson.h>
   #include <ESP32Servo.h>
   #include <MFRC522.h>
```

### STEP 14: Configure WiFi in Code
```
Open: SMART_TOILET_FINAL.ino

Find these lines (near top):
───────────────────────────────────────
const char* WIFI_SSID       = "CM232_Airtel_4D0C";
const char* WIFI_PASSWORD   = "ndahiro123";
const char* SERVER_IP       = "192.168.1.103";
const int   SERVER_PORT     = 5000;
───────────────────────────────────────

CHANGE TO YOUR SETUP:
- WIFI_SSID: Your WiFi network name
- WIFI_PASSWORD: Your WiFi password
- SERVER_IP: Your server/laptop IP
- SERVER_PORT: Your Node.js server port (usually 5000)

To find your server IP:
Windows: Open CMD, type: ipconfig
Look for "IPv4 Address" (usually 192.168.x.x)
```

### STEP 15: Upload Code to ESP32
```
1. Connect ESP32 to computer via USB cable
2. In Arduino IDE:
   - Tools → Port → Select COM port (COMx)
   - Tools → Board → ESP32 Dev Module
   - Tools → Partition Scheme → Default 4MB with spiffs
3. Verify code: Sketch → Verify
4. Upload code: Sketch → Upload
5. Wait for "Hard resetting via RTS pin..." message
6. Code is now on ESP32!
```

### STEP 16: Test in Serial Monitor
```
1. Tools → Serial Monitor
2. Set Baud Rate to 115200
3. You should see:
   ========================================
   SMART PUBLIC TOILET - FULL SYSTEM
   RFID + Payment + Sensors + Servos
   ========================================
   
   ✅ Servos initialized
   ✅ RFID reader initialized
   📡 Connecting to WiFi: CM232_Airtel_4D0C
   ....
   ✅ WiFi connected
   IP: 192.168.1.XXX
   Server: http://192.168.1.103:5000
   
   ✅ SYSTEM READY
```

---

## ✅ PART 3: TESTING & VERIFICATION

### TEST 1: Test Servos
```
1. Open Serial Monitor (115200 baud)
2. Type in command box:
   - Nothing needed, servos auto-initialize
3. You should hear servo "click" as it moves to 0°
4. Watch both door and lid servos move
```

### TEST 2: Test Ultrasonic Sensors
```
Look at Serial Monitor output every 2 seconds:
📊 [IDLE] Pump:OFF Exit:45.2cm Bowl:120.5cm

- Exit:45.2cm = Sensor 1 distance
- Bowl:120.5cm = Sensor 2 distance

When you put hand ~5cm away:
- Should show distance decreasing
- When < 5cm: triggers action
```

### TEST 3: Test RFID Reader
```
1. Hold RFID card 2-5cm from antenna
2. In Serial Monitor you should see:
   🔖 Card UID: AB CD EF 01 23
   (actual numbers will be different)
3. If nothing: check 3.3V power, check SPI pins
```

### TEST 4: Test Button
```
1. Press the button inside toilet
2. Should see in Serial Monitor:
   (no debug output, but state should change)
3. If not working: check GPIO 14, check 10kΩ pull-up resistor
```

### TEST 5: Test Relay/Pump
```
1. Upload code with test mode (or manually trigger)
2. When pump should activate:
   💧 PUMP ON
3. You should hear relay "click"
4. If pump doesn't run:
   - Check 12V power to pump
   - Check relay connections
   - Test with multimeter for continuity
```

### TEST 6: Test Full Flow
```
1. Open payment page: index.html in browser
2. Enter phone number: 078XXXXXXX
3. Press "Pay to Enter"
4. On ESP32, watch Serial Monitor as states change:
   STATE → DOOR_OPENING
   🚪 Door opening
   STATE → DOOR_OPEN
   STATE → DOOR_CLOSING
   STATE → OCCUPIED
   (wait for motion detection or auto-exit)
   STATE → EXIT_OPENING
   🚪 Exit triggered
   ...etc
```

---

## 🐛 TROUBLESHOOTING CHECKLIST

### Servos not moving?
```
☐ Check 5V power to servo (Red and Brown wires)
☐ Check GPIO pin assignments match code
☐ Verify servo signal wire firmly connected
☐ Test with Servo sweep sketch first
```

### Sensors not reading?
```
☐ Check sensor power (VCC on 5V)
☐ Check TRIG and ECHO pin assignments
☐ Check voltage dividers on ECHO pins (CRITICAL!)
☐ Try swapping Trigger/Echo connections
☐ Test sensor separately with simple sketch
```

### RFID not reading?
```
☐ Check 3.3V power (NOT 5V!)
☐ Check SPI pins: 18, 19, 23, 5, 4
☐ Hold card 2-5cm from antenna
☐ Try different cards/fobs
☐ Check SPI.begin() call in setup
```

### Relay not working?
```
☐ Check VCC power to relay (5V)
☐ Check IN pin to GPIO 32
☐ Check relay Common to 12V(+)
☐ Check relay NO to pump(+)
☐ Test relay with multimeter (measure continuity)
☐ CRITICAL: Ensure 12V and 3.3V grounds are connected!
```

### WiFi not connecting?
```
☐ Check SSID spelling exactly
☐ Check password exactly (case-sensitive)
☐ Verify server IP and port
☐ Try pinging server: ping 192.168.1.103
☐ Make sure router 2.4GHz is enabled (ESP32 only supports 2.4GHz)
```

### Button not working?
```
☐ Check GPIO 14 connection
☐ Check 10kΩ pull-up resistor to 3.3V
☐ Test with multimeter: should be HIGH when not pressed
☐ Should go LOW when pressed
```

---

## 📝 FINAL CHECKLIST BEFORE DEPLOYMENT

- [ ] All components physically connected
- [ ] All voltage dividers installed on ECHO pins
- [ ] Common ground between all power supplies
- [ ] WiFi credentials correct in code
- [ ] Server IP and port correct
- [ ] Code uploaded successfully (no upload errors)
- [ ] Serial Monitor shows "SYSTEM READY"
- [ ] All sensors responding (distance values showing)
- [ ] RFID reading cards correctly
- [ ] Button working
- [ ] Relay/pump can be triggered
- [ ] Servo motors respond to commands
- [ ] Payment system works from web page
- [ ] Door opens when payment received
- [ ] LED blinks during use
- [ ] Auto-exit triggers after 5 seconds no motion

---

## 🔧 COMPONENT PIN REFERENCE CARD

```
Print this and keep handy while wiring:

ESP32 GPIO Assignments:
├─ GPIO 4  = RFID RST
├─ GPIO 5  = RFID CS (SDA)
├─ GPIO 12 = Ultrasonic 2 ECHO (with divider!)
├─ GPIO 13 = Ultrasonic 2 TRIG
├─ GPIO 14 = Button
├─ GPIO 15 = Servo 1 (Door)
├─ GPIO 18 = SPI CLK (RFID)
├─ GPIO 19 = SPI MISO (RFID)
├─ GPIO 22 = LED Green
├─ GPIO 23 = SPI MOSI (RFID)
├─ GPIO 26 = Ultrasonic 1 TRIG
├─ GPIO 27 = Ultrasonic 1 ECHO (with divider!)
├─ GPIO 32 = Relay IN (Pump)
├─ GPIO 33 = Servo 2 (Lid)
├─ 5V  = Power rail
└─ GND = Ground (all connected)
```

---

## 🎯 NEXT STEPS

1. Follow Part 1 carefully - wiring is CRITICAL
2. Test each component individually
3. Upload code (Part 2)
4. Run comprehensive tests (Part 3)
5. Monitor Serial output for any errors
6. Once all tests pass, deploy to production

**If anything doesn't work, check the troubleshooting section!**

