# QUICK REFERENCE CARD - PRINT THIS!

## 📋 ESP32 PIN LAYOUT (Top View)

```
LEFT SIDE (Pins)          RIGHT SIDE (Pins)
─────────────────         ─────────────────
GND                       GND
3V3                       5V
15  (Servo Door)         18  (SPI CLK)
33  (Servo Lid)          19  (SPI MISO)
32  (Relay IN)           21  (I2C SDA)
26  (US1 TRIG)           22  (LED Green)
27  (US1 ECHO)           5   (RFID CS)
12  (US2 ECHO)           4   (RFID RST)
13  (US2 TRIG)           17
14  (Button)             16
```

---

## 🔌 COMPONENT PIN ASSIGNMENTS

### SERVOS
| Component | GPIO | Function |
|-----------|------|----------|
| Door Servo (1) | 15 | PWM output to servo signal |
| Lid Servo (2) | 33 | PWM output to servo signal |

### ULTRASONIC SENSORS
| Component | TRIG GPIO | ECHO GPIO | Note |
|-----------|-----------|-----------|------|
| Sensor 1 (Exit) | 26 | 27 | ECHO needs voltage divider! |
| Sensor 2 (Bowl) | 13 | 12 | ECHO needs voltage divider! |

### OTHER COMPONENTS
| Component | GPIO | Notes |
|-----------|------|-------|
| Button | 14 | Pull-up to 3.3V with 10kΩ |
| LED Green | 22 | Needs 330Ω series resistor |
| Relay IN | 32 | HIGH=Pump OFF, LOW=Pump ON |

### RFID (SPI BUS)
| Pin | GPIO | Function |
|-----|------|----------|
| VCC | 3.3V | Power (NOT 5V!) |
| GND | GND | Ground |
| RST | 4 | Reset |
| CS/SDA | 5 | Chip Select |
| MOSI | 23 | Master Out Slave In |
| MISO | 19 | Master In Slave Out |
| SCK | 18 | Clock |

---

## ⚠️ CRITICAL CONNECTIONS

### 1. VOLTAGE DIVIDERS (Must have these!)
```
For BOTH Ultrasonic Echo pins (GPIO 27 and 12):

From HC-SR04 ECHO output (5V):
    │
   [1kΩ resistor]
    │
    ├─────► To ESP32 GPIO (3.3V safe)
    │
   [2kΩ resistor]
    │
   GND

WITHOUT THIS: You will destroy GPIO pins!
```

### 2. COMMON GROUND (Absolute Must!)
```
Connect all GND together:
- ESP32 GND
- Relay GND  
- 12V PSU GND (if separate pump)
- All sensor GND
- Button GND
- LED GND (cathode)

⚠️ DO NOT SKIP THIS! Relay won't work otherwise!
```

### 3. POWER RAILS
```
5V Rail (from ESP32 5V):
├─ Servo 1 Red
├─ Servo 2 Red
├─ Relay VCC
├─ US Sensor 1 VCC
├─ US Sensor 2 VCC
└─ (All share 5V return through GND)

3.3V Rail (from ESP32 3V3):
├─ RFID VCC ONLY
└─ Button pull-up

GND Rail:
└─ ALL GND pins (see above)
```

---

## 🔧 WIRING QUICK STEPS

1. **Prepare breadboard**
   - Mount ESP32
   - Create 5V and GND rails

2. **Add Servos**
   - Servo1: Red→5V, Brown→GND, Yellow→GPIO15
   - Servo2: Red→5V, Brown→GND, Yellow→GPIO33

3. **Add Relay**
   - VCC→5V, GND→GND, IN→GPIO32

4. **Add Ultrasonic #1 (Exit)**
   - VCC→5V, GND→GND, TRIG→GPIO26
   - ECHO→Voltage Divider→GPIO27

5. **Add Ultrasonic #2 (Bowl)**
   - VCC→5V, GND→GND, TRIG→GPIO13
   - ECHO→Voltage Divider→GPIO12

6. **Add Button**
   - One pin→GPIO14
   - Other pin→GND
   - Add 10kΩ from GPIO14 to 3.3V (pull-up)

7. **Add LED**
   - Anode→[330Ω]→GPIO22
   - Cathode→GND

8. **Add RFID**
   - VCC→3.3V (NOT 5V!!!)
   - GND→GND
   - RST→GPIO4
   - CS→GPIO5
   - MOSI→GPIO23
   - MISO→GPIO19
   - SCK→GPIO18

---

## 📊 SENSOR RANGES

### Ultrasonic Sensors (HC-SR04)
- **Range**: 2cm to 400cm
- **Accuracy**: ±0.3cm
- **Trigger pulse**: 10µs
- **Output**: 5V pulse (needs divider!)
- **Frequency**: 40kHz
- **Timing**: ~100-180µs per 10cm

### Detection Thresholds (in code)
```
#define EXIT_TRIGGER_CM  5.0   // Exit door sensor
#define LID_TRIGGER_CM   5.0   // Bowl sensor
```

---

## 🔋 POWER REQUIREMENTS

### Per Component
| Component | Voltage | Current | Notes |
|-----------|---------|---------|-------|
| ESP32 | 5V USB | ~200mA | Main board |
| Servo 1 | 5V | ~200mA (peak) | Door |
| Servo 2 | 5V | ~200mA (peak) | Lid |
| US Sensor 1 | 5V | ~15mA | Exit |
| US Sensor 2 | 5V | ~15mA | Bowl |
| Relay | 5V | ~80mA | Idle ~5mA |
| RFID | 3.3V | ~50mA | Peak |
| LED | 3.3V | ~20mA | 330Ω limited |
| Button | 3.3V | ~1mA | Pull-up |
| **Pump** | **12V** | **500-2000mA** | Via relay |

**Total 5V: ~500-600mA** → Use USB 5V power bank
**Pump 12V: Separate supply** → Must share GND with ESP32!

---

## 🎛️ CODE CONFIGURATION

Edit these lines in SMART_TOILET_FINAL.ino:

```cpp
// WiFi settings (required!)
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_PASSWORD";
const char* SERVER_IP     = "192.168.x.x";   // Your server
const int   SERVER_PORT   = 5000;

// Timing (can adjust if needed)
const float EXIT_TRIGGER_CM = 5.0;      // Detection range
const float LID_TRIGGER_CM  = 5.0;      // Detection range
const unsigned long DOOR_HOLD_MS    = 10000;  // 10 seconds
const unsigned long PUMP_RUN_MS     = 5000;   // 5 seconds
const unsigned long AUTO_EXIT_MS    = 5000;   // Auto-exit after 5s
```

---

## 🔍 TESTING SEQUENCE

1. **Power up ESP32** → Watch Serial Monitor
2. **Check Servos** → Should hear click to 0°
3. **Check WiFi** → Should show "✅ WiFi connected"
4. **Wave at sensors** → Distance should change
5. **Tap RFID card** → Should show Card UID
6. **Press button** → Should register press
7. **Trigger relay** → Should hear click
8. **Test payment** → Full flow test

---

## 🐛 3-STEP DEBUGGING

If something doesn't work:

1. **Check Power**
   - Multimeter: Verify 5V and 3.3V present
   - Check all GND connections

2. **Check Connections**
   - Visually inspect every wire
   - Use multimeter to test continuity
   - Check no crossed wires

3. **Check Serial Output**
   - Baud rate set to 115200?
   - Any error messages?
   - Distance values showing?

---

## 📱 PAYMENT FLOW (From index.html)

```
User enters phone number
         ↓
Clicks "Pay to Enter"
         ↓
ESP32 polls /api/hardware/payment-check/{toilet_id}
         ↓
If payment confirmed: triggerDoorOpen()
         ↓
Door servo → 90° (OPEN)
         ↓
Wait 10 seconds
         ↓
Door servo → 0° (CLOSE)
         ↓
State → OCCUPIED (waiting for usage)
```

---

## 📞 TROUBLESHOOTING QUICK REFERENCE

```
No serial output?
→ Check USB cable, check board selection, 115200 baud

Servos not moving?
→ Check 5V power, check GPIO 15 & 33, check servo connector

Sensors showing 0?
→ Check 5V power, check voltage dividers on ECHO pins

RFID not reading?
→ Check 3.3V (not 5V!), check SPI pins, hold card close

Button not working?
→ Check GPIO 14, check 10kΩ pull-up resistor

Relay not clicking?
→ Check GPIO 32, check relay power, check relay wiring
→ CRITICAL: Check common GND between ESP32 and 12V!

WiFi not connecting?
→ Check SSID/password spelling, check 2.4GHz enabled
```

---

## 📋 PRE-DEPLOYMENT CHECKLIST

- [ ] All 9 component groups wired
- [ ] Voltage dividers on ECHO pins (GPIO 27 & 12)
- [ ] Common ground connected
- [ ] Serial output working (SYSTEM READY shown)
- [ ] WiFi connected
- [ ] All sensors reading values
- [ ] RFID reading cards
- [ ] Button responding
- [ ] Relay making click sound
- [ ] Servos moving smoothly
- [ ] LED blinking during use
- [ ] Payment triggering door open
- [ ] Full cycle test successful

---

## 💾 CODE LOCATION
```
Main Code: SMART_TOILET_FINAL.ino
Config: Edit WIFI_SSID, WIFI_PASSWORD, SERVER_IP at top
Wiring: COMPLETE_WIRING_GUIDE.md
Setup: SETUP_GUIDE.md (detailed steps)
```

