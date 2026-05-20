# SMART PUBLIC TOILET - COMPLETE WIRING GUIDE

## 📋 COMPONENT LIST

### Main Controller
- **ESP32 Development Board** (with WiFi + Bluetooth)

### Actuators
- **Servo Motor 1** (Door Servo) - Standard 180° servo (SG90 or MG995)
- **Servo Motor 2** (Lid Servo) - Standard 180° servo (SG90 or MG995)
- **Water Pump Relay Module** - 5V relay module for pump control
- **Water Pump** - 12V DC pump or any 12V actuator

### Sensors
- **Ultrasonic Sensor 1 (Exit)** - HC-SR04
  - For detecting person leaving (mounted at door level, 5cm detection)
- **Ultrasonic Sensor 2 (Bowl)** - HC-SR04
  - For detecting person sitting (mounted inside toilet bowl area, 5cm detection)
- **Push Button** - Momentary push button (inside toilet)

### RFID System
- **MFRC522 RFID Reader Module** - with antenna
- **RFID Cards** - 13.56MHz compatible cards/fobs

### Power & Control
- **Power Supply 1** - 5V USB for ESP32
- **Power Supply 2** - 12V for pump (if using 12V pump)
- **Breadboard** - Full-size or multiple half-size
- **Jumper Wires** - Various lengths
- **LED** - Green LED for status (optional but recommended)
- **Resistors** - 330Ω for LED, 10kΩ for pull-ups (if needed)

---

## 🔌 DETAILED PIN CONNECTIONS

### ESP32 PIN LAYOUT
```
        ╔════════════════════════╗
        ║      ESP32 DEVKIT      ║
        ║                        ║
   GND  ║ GND                GND ║  GND
   3V3  ║ 3V3                5V  ║  5V (use for sensors)
   15   ║ 15                 18  ║  18 (SPI CLK - RFID)
   33   ║ 33                 19  ║  19 (SPI MOSI - RFID)
   32   ║ 32 (RELAY)         21  ║  21 (SDA I2C)
   26   ║ 26 (US1 TRIG)      22  ║  22 (LED GREEN)
   27   ║ 27 (US1 ECHO)       5  ║   5 (RFID CS)
   12   ║ 12 (US2 ECHO)       4  ║   4 (RFID RST)
   13   ║ 13 (US2 TRIG)      17  ║  17
   14   ║ 14 (BUTTON)        16  ║  16
        ║                        ║
        ╚════════════════════════╝
```

---

## 🔧 DETAILED WIRING CONNECTIONS

### SERVO 1 (DOOR) - Pin 15
```
Servo Pin          ESP32 Pin
┌─────────┐
│ Red     │────────► 5V (breadboard rail)
│ Brown   │────────► GND (breadboard rail)
│ Yellow  │────────► GPIO 15
└─────────┘
```

### SERVO 2 (LID) - Pin 33
```
Servo Pin          ESP32 Pin
┌─────────┐
│ Red     │────────► 5V (breadboard rail)
│ Brown   │────────► GND (breadboard rail)
│ Yellow  │────────► GPIO 33
└─────────┘
```

### RELAY MODULE (PUMP CONTROL) - Pin 32
```
Relay Module       ESP32 Pin
┌──────────┐
│ VCC      │────────► 5V (breadboard rail)
│ GND      │────────► GND (breadboard rail)
│ IN       │────────► GPIO 32
└──────────┘

Relay Internal Connection (don't modify):
  - NO (Normally Open) connects to pump power
  - C (Common) connects to 12V power supply positive
  - When GPIO 32 is LOW → Relay ON → Pump ON
  - When GPIO 32 is HIGH → Relay OFF → Pump OFF
```

### ULTRASONIC SENSOR 1 (EXIT) - Pins 26, 27
```
HC-SR04 Sensor     ESP32 Pin
┌──────────┐
│ VCC      │────────► 5V (breadboard rail)
│ TRIG     │────────► GPIO 26
│ ECHO     │────────► GPIO 27 (with voltage divider!)
│ GND      │────────► GND (breadboard rail)
└──────────┘

⚠️ IMPORTANT: ECHO PIN NEEDS VOLTAGE DIVIDER!
   HC-SR04 outputs 5V, ESP32 input is 3.3V max
   
   5V ─────[1kΩ]─────┬────► GPIO 27
                    │
   HC-SR04 ECHO     [2kΩ]
                    │
                   GND

   This reduces 5V to ~3.3V safely.
```

### ULTRASONIC SENSOR 2 (BOWL) - Pins 13, 12
```
HC-SR04 Sensor     ESP32 Pin
┌──────────┐
│ VCC      │────────► 5V (breadboard rail)
│ TRIG     │────────► GPIO 13
│ ECHO     │────────► GPIO 12 (with voltage divider!)
│ GND      │────────► GND (breadboard rail)
└──────────┘

⚠️ VOLTAGE DIVIDER:
   5V ─────[1kΩ]─────┬────► GPIO 12
                    │
   HC-SR04 ECHO     [2kΩ]
                    │
                   GND
```

### PUSH BUTTON (INSIDE) - Pin 14
```
Push Button        ESP32 Pin
┌─────────┐
│ Pin 1   │────────► GPIO 14 (via 10kΩ pull-up to 3.3V)
│ Pin 2   │────────► GND
└─────────┘

Internal: 10kΩ resistor from GPIO 14 to 3.3V (for pull-up)
When pressed: GPIO 14 → LOW
When released: GPIO 14 → HIGH (due to pull-up)
```

### LED STATUS (GREEN) - Pin 22
```
LED Green          ESP32 Pin
┌─────────┐
│ Anode   │───[330Ω]───► GPIO 22
│ Cathode │────────────► GND
└─────────┘

When GPIO 22 is HIGH → LED ON (blinks during use)
When GPIO 22 is LOW  → LED OFF (idle)
```

### RFID READER - SPI Pins (18, 19, 23, 4, 5)
```
MFRC522 Module     ESP32 Pin       Function
┌──────────┐
│ VCC      │────────► 3.3V ─────────► Power
│ GND      │────────► GND ───────────► Ground
│ RST      │────────► GPIO 4 ───────► Reset
│ SDA/CS   │────────► GPIO 5 ───────► Chip Select
│ MOSI     │────────► GPIO 23 ──────► SPI MOSI
│ MISO     │────────► GPIO 19 ──────► SPI MISO
│ SCK      │────────► GPIO 18 ──────► SPI Clock
└──────────┘

SPI Bus (shared):
- GPIO 18 = SCK (Clock)
- GPIO 19 = MISO (Master In Slave Out)
- GPIO 23 = MOSI (Master Out Slave In)
- GPIO 5 = CS (Chip Select for RFID)
```

---

## 📊 POWER DISTRIBUTION LAYOUT

### 5V Power Rail (Breadboard)
```
From ESP32 5V Pin:
    ├─► Servo 1 (Red wire)
    ├─► Servo 2 (Red wire)
    ├─► Relay Module (VCC)
    ├─► HC-SR04 #1 (VCC)
    ├─► HC-SR04 #2 (VCC)
    ├─► RFID Reader (VCC - via 3.3V!)
    └─► All GND pins tie together

Common GND (All devices):
    ├─► All device GND pins
    ├─► ESP32 GND
    ├─► Relay Module GND
    └─► 12V power supply GND (common ground!)
```

### 12V Power Rail (Pump Power - SEPARATE)
```
If using 12V pump:
    
    12V Supply (+)
         │
         ├─► Relay Module Common (C)
         │
    12V Supply (-)
         │
         └─► Pump GND (and ESP32 GND - MUST share common ground!)

Relay connects pump as:
    12V(+) ─► Relay Common
    Relay NO ─► Pump Positive
    Pump Negative ─► 12V(-) / ESP32 GND
```

---

## ⚡ BREADBOARD LAYOUT VISUALIZATION

```
Row 1: GND │ ●(GND) ● ●(GND) │ 5V  │ ●(5V) ● ●(5V)  │ GND │ ●(GND)
Row 2: Ser │ ●  ●  ●  ●     │     │  ●   ●  ●      │     │  ●
Row 3: 1Re │ ●  ●  ●  ●     │ 3V3 │  ●   ●  ●      │ GND │  ●
Row 4: d   │ ●  ●  ●  ●     │     │  ●   ●  ●      │     │  ●
Row 5:     │ ●  ●  ●  ●     │ Ser │  ●   ●  ●      │ Ser │  ●
Row 6:     │ ●  ●  ●  ●     │ 2Re │  ●   ●  ●      │ 1Re │  ●
Row 7: US1 │ ●  ●  ●  ●     │ d   │  ●   ●  ●      │ d   │  ●

Legend:
GND = Ground bus
5V = 5V power bus
Servo connections in separate columns
US1 = Ultrasonic #1 connections
```

---

## 🔌 POWER SUPPLY SUMMARY

### For Development/Testing:
```
┌─────────────────┐
│ USB 5V Power    │
│ (to ESP32)      │
└─────────────────┘
        │
     ESP32 ─────────► Provides 5V & 3.3V for:
        │              - Servos (5V)
        │              - Sensors (5V)
        │              - RFID (3.3V)
        │              - LED (3.3V)
        │              - Relay (5V)
        │
        └─── For pump: Use USB power bank or
             separate 12V supply with common GND
```

### For Production:
```
┌──────────┐         ┌──────────┐
│ 12V PSU  │         │ USB 5V   │
│ (Pump)   │         │ (ESP32)  │
└──────────┘         └──────────┘
     │                    │
     ├─► Pump         Breadboard
     │                 5V rail
     └─────GND─────────────┘ (Common Ground!)
```

---

## 🎯 SENSOR PLACEMENT

### Ultrasonic Sensor #1 (EXIT DOOR)
```
        ┌─────────────────┐
        │   Front View    │
        │                 │
        │   ┌───────────┐  │
Door ─► │   │  SENSOR   │  │  ◄─ 5cm detection range
        │   └───────────┘  │
        │                 │
        └─────────────────┘

Position: Mounted on frame near door entrance
Height: Human leg height (~40cm from floor)
Orientation: Pointing OUT toward door
Range: 5cm detection for person exiting
```

### Ultrasonic Sensor #2 (BOWL DETECTION)
```
        ┌─────────────────┐
        │   Top View      │
        │   (Inside Pot)  │
        │                 │
        │   ╔═════════╗   │
        │   ║ SENSOR  ║   │
        │   ║ (center)║   │
        │   ╚═════════╝   │
        │                 │
        │   Toilet Bowl   │
        │                 │
        └─────────────────┘

Position: Mounted at top center of toilet bowl
Height: Pointing down into bowl
Orientation: 45° angle downward
Range: 5cm detection for sitting person
```

---

## ✅ TESTING CHECKLIST

- [ ] Power connections verified (no shorts)
- [ ] Voltage dividers on US Echo pins (critical!)
- [ ] All GND pins connected together
- [ ] Servo power separate from logic power if possible
- [ ] RFID on 3.3V (not 5V!)
- [ ] Button pull-up resistor in place
- [ ] LED resistor (330Ω) in series
- [ ] Relay common pin to pump 12V
- [ ] Relay NO pin to pump positive
- [ ] Pump GND shared with ESP32 GND
- [ ] All sensors responding (Serial output)
- [ ] WiFi connection successful
- [ ] Payment API working from index.html

---

## 🐛 TROUBLESHOOTING

### Servos not moving:
- Check 5V power to servo
- Verify GPIO pins correct
- Check servo connector orientation (red/brown/yellow)

### Ultrasonic sensors not working:
- Verify voltage dividers on ECHO pins
- Test with Serial output: should show distance values
- Check TRIG and ECHO pins are correct

### RFID not reading cards:
- Verify 3.3V power (NOT 5V!)
- Check SPI pins: 18, 19, 23
- Check CS pin 5 and RST pin 4
- Hold card 2-5cm from antenna

### Button not responding:
- Check pull-up resistor (10kΩ to 3.3V)
- Verify GPIO 14 connection
- Test with Serial output on button press

### Pump relay not switching:
- Verify relay IN pin to GPIO 32
- Check relay relay power (5V)
- Confirm pump 12V circuit complete
- Test with multimeter for continuity

### WiFi not connecting:
- Verify SSID and password in code
- Check router signal strength
- Ensure ESP32 firmware is updated

