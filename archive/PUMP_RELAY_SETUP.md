# 💧 Water Pump & Relay Connection Guide

## 🔌 Complete Hardware Setup

### System Overview
```
┌─────────────────────────────────────────────────────────────┐
│  PAYMENT FLOW → DOOR OPENS → LID RISES → PUMP ACTIVATES    │
│                                                             │
│  RFID: Card tapped → RWF 200 deducted → Door opens        │
│  ONLINE: PayPack paid → Door opens                          │
│  SENSOR: Person sits → Lid opens → Pump starts             │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Relay Module Specifications

### 5V Relay Module (Most Common)
```
┌──────────────────────────────────┐
│  5V Relay Module                 │
├──────────────────────────────────┤
│  GND  │  VCC  │  IN   │ NO │ COM │ NC  │
│  ───  │  ───  │  ───  │ ─  │ ─   │ ─   │
│  ●    │  ●    │  ●    │    │     │     │
└──────────────────────────────────┘
```

**Pin Descriptions**:
- **GND** - Ground (connects to ESP32 GND)
- **VCC** - Power Supply (5V from ESP32 or external)
- **IN** - Control Input (from ESP32 GPIO32)
- **NO** - Normally Open (empty when relay OFF)
- **COM** - Common (shared connection)
- **NC** - Normally Closed (connected when relay OFF)

## 🔗 Wiring Diagram - Option 1 (Recommended for 12V Pump)

```
┌─────────────────┐
│    ESP32        │
│                 │
│ GPIO32  ────────┼──→ [Relay IN]
│ GND     ────────┼──→ [Relay GND]
│ 5V      ────────┼──→ [Relay VCC]
└─────────────────┘
         
    ┌──────────────────┐
    │  5V Relay        │
    │ (SPDT switch)    │
    │ COM──┬───NO───┐  │
    │      │        │  │
    │      └────NC──┘  │
    └──────────────────┘
            │
        ┌───┴───┐
        │       │
     [12V+]  [12V-]
        │       │
        │   ┌───┴─────┐
        └──→[Pump +]  │
            │ PUMP    │
            [Pump -]──┘
            │
        [12V GND]────→ ESP32 GND (IMPORTANT!)
```

## 🛠️ Step-by-Step Wiring Instructions

### Step 1: Prepare Components
You need:
- 1x ESP32 microcontroller
- 1x 5V Relay module (single channel SPDT)
- 1x Water pump (12V DC or 110V AC)
- Jumper wires (male-to-female)
- 12V power supply (for pump)
- Multimeter (for testing)

### Step 2: Connect Relay to ESP32

```
RELAY PIN          ESP32 PIN
─────────────────────────────
GND     ────────→  GND
VCC     ────────→  5V
IN      ────────→  GPIO32
```

**Exact Pin Locations on ESP32**:
```
ESP32 Board Layout:
┌───────────────────────────────────┐
│ USB                               │
├───────────────────────────────────┤
│ D1(TX)  D0(RX)                    │
│ D3(IO0) GND                       │
│ D4(IO2) 3V3                       │
│         EN(RST)                   │
│ GPIO5   GPIO18  GPIO23  GPIO19    │
│ GPIO17  GPIO16  GPIO4   GPIO0     │
│ GPIO2   GPIO15  GPIO13  GPIO12    │
│ GPIO14  GPIO27  GPIO26  GPIO25    │
│ GPIO33  GPIO32  GPIO35  GPIO34    │
│ GPIO39  GPIO36  GPIO1   GPIO3     │
│ 5V      GND                       │
└───────────────────────────────────┘
            ▲
        GPIO32 (RELAY_PIN)
```

### Step 3: Connect Relay to Pump

**For 12V Pump** (Most Common):

```
RELAY PIN          PUMP WIRING
──────────────────────────────
COM     ────────→  Pump +12V Input
NO      ────────→  12V Supply +
NC      ────────→  (Leave empty)
GND     ────────→  12V Supply -
                   (and ESP32 GND)
```

**CONNECTION DIAGRAM**:
```
┌──────────────────────────────────┐
│   12V Power Supply               │
│   +12V         -12V (GND)        │
│    │             │               │
│    └─────┬───────┘               │
│          │                       │
│    ┌─────┴──────┐                │
│    │            │                │
│  [NO]─────────[+Pump]            │
│    │            │                │
│  [COM]         [-Pump]───────────┼──→ GND
│    │                             │
│    └───[Relay GND]───────────────┼──→ ESP32 GND
│                                  │
└──────────────────────────────────┘
```

## ⚡ Wiring for Specific Relay Modules

### 5V Single Channel Relay Module (HW-482)
```
┌─────────────────────────────────────┐
│   HW-482 Relay Module               │
├─────────────────────────────────────┤
│  Pin 1 (GND)  ────→  ESP32 GND      │
│  Pin 2 (VCC)  ────→  ESP32 5V       │
│  Pin 3 (IN)   ────→  ESP32 GPIO32   │
│                                     │
│  Relay Contact Section:             │
│  Pin 4 (NO)   ────→  12V +          │
│  Pin 5 (COM)  ────→  Pump +         │
│  Pin 6 (NC)   ────→  (Empty)        │
│                                     │
│  Pump Ground  ────→  12V - / ESP32 GND
└─────────────────────────────────────┘
```

### 2-Channel Relay Module (If using one channel only)
```
Use Channel 1 only:
Pin 1 (GND-CH1)   → ESP32 GND
Pin 2 (VCC-CH1)   → ESP32 5V
Pin 3 (IN-CH1)    → ESP32 GPIO32
(Leave Pin 4,5,6 or other channels empty)
```

## 🧪 Testing the Relay

### Test 1: Relay Click Test
```cpp
// Upload this test code to ESP32
void setup() {
  Serial.begin(115200);
  pinMode(32, OUTPUT);
  digitalWrite(32, HIGH);  // Relay OFF
  delay(1000);
  Serial.println("Testing relay...");
}

void loop() {
  // Turn pump ON
  Serial.println("Pump ON");
  digitalWrite(32, LOW);
  delay(3000);
  
  // Turn pump OFF
  Serial.println("Pump OFF");
  digitalWrite(32, HIGH);
  delay(3000);
}
```

**Expected Results**:
- You should hear a "click" sound from the relay when toggling
- COM-NO connection closes when GPIO32 goes LOW
- COM-NC connection closes when GPIO32 goes HIGH

### Test 2: Using Multimeter
```
1. Set multimeter to Continuity mode
2. Probe between COM and NO pins
3. Send digitalWrite(32, LOW) - Multimeter beeps (connected)
4. Send digitalWrite(32, HIGH) - Multimeter silent (disconnected)
```

## 💧 Pump Activation Sequence (From ESP32 Code)

```
1. Person sits on toilet
   ↓
   Ultrasonic sensor detects proximity (< 10cm)
   ↓
   
2. Lid servo rises to 90°
   ↓
   LID_HOLD_MS = 5000 (5 seconds waiting)
   ↓
   
3. After 5 seconds...
   ↓
   startPump() is called:
   └─→ digitalWrite(RELAY_PIN, LOW)  // GPIO32 LOW
       └─→ Relay activates
           └─→ COM connects to NO
               └─→ Power flows to pump
   ↓
   PUMP_RUN_MS = 3000 (3 seconds flush)
   ↓
   
4. After 3 seconds...
   ↓
   stopPump() is called:
   └─→ digitalWrite(RELAY_PIN, HIGH)  // GPIO32 HIGH
       └─→ Relay deactivates
           └─→ COM disconnects from NO
               └─→ Pump stops
   ↓
   
5. Lid servo lowers to 0°
   ↓
   DONE! User can exit
```

## 🔧 Configuration Parameters (In ESP32 Code)

```cpp
#define RELAY_PIN      32   // GPIO pin controlling relay
const unsigned long LID_HOLD_MS  = 5000;  // Wait time before pump
const unsigned long PUMP_RUN_MS  = 3000;  // How long pump runs
```

To adjust timing:
- **LID_HOLD_MS**: Change 5000 to desired milliseconds
  - 1000 = 1 second
  - 5000 = 5 seconds (default)
  - 10000 = 10 seconds

- **PUMP_RUN_MS**: Change 3000 to desired milliseconds
  - 1000 = 1 second short flush
  - 3000 = 3 seconds (default)
  - 5000 = 5 seconds long flush

## ⚠️ Common Issues & Solutions

### Issue: Relay doesn't click when GPIO32 goes LOW
**Solutions**:
1. Check VCC pin has 5V (use multimeter)
2. Check GND connection is secure
3. Check GPIO32 is connected to IN pin
4. Verify relay module LEDs (should light up when relay ON)
5. Try different GPIO pin (adjust #define RELAY_PIN)

### Issue: Pump doesn't turn ON despite relay clicking
**Solutions**:
1. Check COM pin has 12V supply connected
2. Check NO pin connects to pump +12V
3. Verify pump - connects to 12V GND
4. Check ESP32 GND connects to 12V GND (CRITICAL!)
5. Use multimeter to test continuity between COM-NO when relay ON

### Issue: Relay clicks but pump turns ON permanently
**Solutions**:
1. You might have wired COM-NC instead of COM-NO
2. Swap the pump wires on the relay pins
3. Or try: `digitalWrite(32, HIGH)` to turn OFF instead

### Issue: Relay makes loud buzzing noise
**Solutions**:
1. The relay coil might be damaged
2. Replace the relay module
3. Or voltage might be unstable - check power supply

### Issue: Pump won't stop after 3 seconds
**Solutions**:
1. Check PUMP_RUN_MS value in code
2. Check stopPump() function is being called
3. Verify relay is actually switching (add Serial.println debug)
4. Check if relay is stuck mechanically

## 🧲 Alternative: Using a Relay with Common Return (Safer)

If pump has its own power supply, use this configuration:

```
12V Supply +  ──→  [NO pin]
                     │
12V Supply - / GND ──[COM pin]
                     │
                   Pump +
                     │
              [Pump - / GND]
```

This ensures pump power is isolated from ESP32 power.

## 📊 Wiring Checklist

Before uploading code:
- [ ] Relay GND connects to ESP32 GND
- [ ] Relay VCC connects to ESP32 5V
- [ ] Relay IN connects to ESP32 GPIO32
- [ ] Relay COM connects to 12V supply +
- [ ] Relay NO connects to Pump + wire
- [ ] Pump - connects to 12V GND
- [ ] 12V GND connects to ESP32 GND (CRITICAL!)
- [ ] All connections are secure (no loose wires)
- [ ] Relay makes clicking sound when testing
- [ ] Multimeter shows continuity COM-NO when relay ON

## 🎯 Testing Sequence

1. **Power test**: ESP32 and relay get power
2. **Click test**: Send digitalWrite(32, LOW) and hear relay click
3. **Manual pump test**: Connect 12V directly to pump to verify it works
4. **Full integration test**: Run main code, sit on sensor, hear pump activate
5. **Dashboard verification**: Check payment logged in database

---

**Status**: Ready for installation
**GPIO Pin**: 32 (can be changed if needed)
**Voltage**: 12V pump with 5V relay module
**Pump Delay**: 5 seconds after lid opens
**Pump Duration**: 3 seconds per flush
