# 🔌 Complete Wiring Guide: Button, Pump & Relay

---

## 1️⃣ PUMP & RELAY CONNECTION

### **Relay Module Wiring**

```
┌─────────────────────────────────────────────────────────┐
│                    5V RELAY MODULE                      │
├─────────────────────────────────────────────────────────┤
│  GND  ──────────→ ESP32 GND                             │
│  VCC  ──────────→ ESP32 5V (or external 5V power)       │
│  IN   ──────────→ ESP32 GPIO 32 (RELAY_PIN)             │
│  NO   ──────────→ NOT USED (normally open)              │
│  COM  ──────────→ Pump Power + (12V positive)           │
│  NC   ──────────→ NOT USED (normally closed)            │
└─────────────────────────────────────────────────────────┘
```

### **Pump Power Wiring**

```
       12V POWER SUPPLY
       ├─ Positive (+) ──→ Relay COM pin
       └─ Negative (-) ──→ Pump Negative (GND)
       
       PUMP
       ├─ Positive (+) ──→ Relay NO pin (when relay activates)
       └─ Negative (-) ──→ 12V power supply GND


LOGIC:
• GPIO32 = LOW  → Relay activates → Pump ON (water flows)
• GPIO32 = HIGH → Relay deactivates → Pump OFF (no water)
```

### **Complete Pump Circuit Diagram**

```
        ┌──────────────────────────────────────┐
        │      12V EXTERNAL POWER SUPPLY       │
        │  + ─────────────┐          ┌─ -      │
        │                 │          │         │
        │                 ▼          ▼         │
        │            ┌─────────────┐          │
        │            │   RELAY     │          │
        │  ESP32 ────┤ IN  COM  NO ├── PUMP   │
        │  GPIO32    │   (from ESP)(to pump)  │
        │     │      │             │    │     │
        │     └──────┤ GND         │    │     │
        │            └─────────────┘    │     │
        │                │              │     │
        │                └──────────────┴─────┘
        │                (12V GND common)     │
        └──────────────────────────────────────┘
```

---

## 2️⃣ PUSH BUTTON (EMERGENCY EXIT) WIRING

### **Button Connection**

```
┌─────────────────────────────────────────┐
│        PUSH BUTTON (2 PIN)              │
├─────────────────────────────────────────┤
│  Pin 1 ──────────→ ESP32 GPIO 14        │
│  Pin 2 ──────────→ ESP32 GND            │
│  Resistor: 10kΩ (pull-up) already       │
│           built into ESP32              │
└─────────────────────────────────────────┘
```

### **Button Schematic**

```
    ESP32 GPIO 14
         │
         ├─────────────┐
         │          [BUTTON]
         │             │
    10kΩ PULLUP         │
    (internal)          │
         │              │
        GND ────────────┴─ Button Pin 2


When button PRESSED:  GPIO14 = LOW  (pressed)
When button RELEASED: GPIO14 = HIGH (not pressed)
```

### **Physical Installation**

Mount the button on the **inside wall of toilet** at a comfortable height (chest level, ~120cm from ground):

```
        DOOR (inside)
        │
        │  BUTTON
        │  ▲▲▲▲▲
        │  ║   ║  Emergency Exit Button
        │  ║ □ ║  "PRESS TO EXIT"
        │  ║   ║
        │  ▼▼▼▼▼
        │
        └─→ Door will open immediately when pressed
```

---

## 3️⃣ COMPLETE ESP32 PIN LAYOUT

```
┌────────────────────────────────────────────┐
│           ESP32 DEVKIT V1                  │
├────────────────────────────────────────────┤
│                                            │
│  GND ──→ All grounds (button, relay, etc) │
│  5V  ──→ Relay VCC + any 5V devices       │
│  3.3V ─→ RFID reader VCC                  │
│                                            │
│  GPIO 32  ──→ RELAY (pump control)        │
│  GPIO 22  ──→ GREEN LED (occupancy)       │
│  GPIO 14  ──→ PUSH BUTTON (emergency)     │
│                                            │
│  GPIO 15  ──→ DOOR SERVO PWM              │
│  GPIO 33  ──→ LID SERVO PWM               │
│                                            │
│  GPIO 13  ──→ DOOR SENSOR TRIG            │
│  GPIO 12  ──→ DOOR SENSOR ECHO            │
│  GPIO 26  ──→ LID SENSOR TRIG             │
│  GPIO 27  ──→ LID SENSOR ECHO             │
│                                            │
│  GPIO 5   ──→ RFID SS (select)            │
│  GPIO 4   ──→ RFID RST (reset)            │
│  GPIO 18  ──→ RFID CLK (SPI clock)        │
│  GPIO 19  ──→ RFID MOSI (SPI data)        │
│  GPIO 23  ──→ RFID MISO (SPI data)        │
│                                            │
└────────────────────────────────────────────┘
```

---

## 4️⃣ STEP-BY-STEP WIRING CHECKLIST

### **Step 1: Prepare Power**
- [ ] 12V power supply for pump
- [ ] Separate 5V power for relay VCC (can be from ESP32 5V if current low)
- [ ] Good quality wires (at least 18 AWG for 12V power)

### **Step 2: Wire Relay Module**
- [ ] Relay GND → ESP32 GND
- [ ] Relay VCC → ESP32 5V
- [ ] Relay IN → ESP32 GPIO 32
- [ ] Relay COM → 12V power supply positive
- [ ] Relay NO → Pump positive wire

### **Step 3: Wire Pump**
- [ ] Pump positive → Relay NO pin
- [ ] Pump negative → 12V power supply negative (GND)
- [ ] Pump negative and 12V GND must share common ground

### **Step 4: Wire Push Button**
- [ ] Button Pin 1 → ESP32 GPIO 14
- [ ] Button Pin 2 → ESP32 GND
- [ ] No external resistor needed (ESP32 has internal pull-up)

### **Step 5: Ground Connection (IMPORTANT!)**
- [ ] All GNDs connected together:
  - [ ] ESP32 GND
  - [ ] Relay GND
  - [ ] 12V power supply GND
  - [ ] Button GND
  - [ ] Pump GND
- [ ] Use a common ground rail/bus

---

## 5️⃣ EMERGENCY BUTTON BEHAVIOR

### **How It Works:**

```
╔═══════════════════════════════════════════════════════════╗
║         EMERGENCY BUTTON OPERATION FLOW                  ║
╚═══════════════════════════════════════════════════════════╝

INSIDE TOILET (toiletInUse = true)

    User in toilet (LED blinking 🟢)
              │
              ├─ Normal exit: Walk to door sensor
              │             └─→ Door opens automatically
              │
              └─ EMERGENCY: Press button on wall
                             │
                             ├─ Door opens IMMEDIATELY
                             ├─ LED turns OFF
                             ├─ Pump stops (if running)
                             ├─ toiletInUse = false
                             └─ Serial: "🆘 EMERGENCY EXIT BUTTON PRESSED"
```

### **What the Button Does:**

1. **Immediately opens door** (without waiting for sensors)
2. **Stops pump** (if it's running)
3. **Turns LED off**
4. **Marks toilet as available**
5. **Logs emergency event** to server

### **Serial Output Example:**

```
🔖 Card UID: 29 67 1C 06
✅ RFID Payment accepted – opening door
🫖 LID SENSOR: Lid opening (10 sec hold)
💧 FLUSHING (pump ON)

🆘 EMERGENCY EXIT BUTTON PRESSED!     ← Button pressed
💧 Pump stopped by emergency button
🚪 Door opened by emergency exit button
✓ Toilet marked as AVAILABLE by emergency button
```

---

## 6️⃣ SAFETY PRECAUTIONS

### **Electrical Safety:**
- [ ] Use insulated wires (no bare copper exposed)
- [ ] Use wire connectors (not just twisted)
- [ ] Keep 12V and 3.3V circuits separate
- [ ] Double-check polarity before powering on
- [ ] Use fused power supply (5A minimum for relay)

### **Physical Safety:**
- [ ] Button mounted inside toilet (accessible to person)
- [ ] Button clearly labeled "EMERGENCY EXIT"
- [ ] Button easy to press in panic
- [ ] Button protected from accidental activation

### **Testing:**
- [ ] Test relay alone: relay should click when GPIO32 goes LOW
- [ ] Test button: Serial Monitor should show button press
- [ ] Test pump: Pump should run 5 seconds after lid opens
- [ ] Test emergency: Button should immediately open door

---

## 7️⃣ TROUBLESHOOTING

### **Pump Won't Turn On**
- [ ] Check relay clicking when pump should run
- [ ] Check 12V power supply voltage
- [ ] Check pump power connections (COM → pump positive)
- [ ] Check relay NO pin for proper connection

### **Relay Clicks But Pump Doesn't Run**
- [ ] Pump power not connected
- [ ] 12V power supply too weak
- [ ] Pump is defective

### **Button Won't Work**
- [ ] Check GPIO 14 connection
- [ ] Check button connection to GND
- [ ] Try pressing button while watching Serial Monitor
- [ ] Button might be faulty (test with multimeter)

### **Door Opens on Button Press But Pump Still Running**
- [ ] Firmware needs update (added below)
- [ ] Re-upload the modified code

---

## 8️⃣ WIRING CHECKLIST BEFORE POWER ON

```
Power & Ground:
  ✓ ESP32 5V connected to relay VCC
  ✓ 12V power supply positive connected to relay COM
  ✓ All GND wires connected to common rail
  ✓ Pump GND and 12V GND are the same

Relay:
  ✓ Relay IN connected to GPIO 32
  ✓ Relay GND connected to ESP32 GND
  ✓ Relay NO connected to pump positive
  ✓ Relay COM connected to 12V positive

Pump:
  ✓ Pump positive connected to relay NO
  ✓ Pump negative connected to common GND
  ✓ Pump has 12V supply

Button:
  ✓ Button pin 1 connected to GPIO 14
  ✓ Button pin 2 connected to GND
  ✓ Button is accessible from inside toilet

Test Points:
  ✓ Multimeter test: 12V between relay COM and GND
  ✓ Relay clicks when code runs
  ✓ Button press shows in Serial Monitor
```

---

**Status: Ready for wiring! 🔌**
