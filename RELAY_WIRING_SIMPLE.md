# 🔌 Simple Relay Wiring Guide - Just Follow These Steps

## ⚡ What You Need

- ✅ ESP32 microcontroller
- ✅ 5V relay module (single channel)
- ✅ 12V water pump
- ✅ 12V power supply
- ✅ Jumper wires
- ✅ Multimeter (optional, for testing)

## 🎯 The Relay

```
┌─────────────────────┐
│   5V Relay Module   │
├─────────────────────┤
│                     │
│  GND  VCC  IN       │
│  ○    ○    ○        │
│  │    │    │        │
│  │    │    └─ To ESP32 GPIO32
│  │    └────── To ESP32 5V
│  └─────────── To ESP32 GND
│                     │
│   ┌─────────────┐   │
│   │  NO  COM    │   │
│   │   ○   ○     │   │
│   │   │   │     │   │
│   │   └─ From 12V +   │
│   │   └─ To Pump +    │
│   └─────────────┘   │
│                     │
└─────────────────────┘
```

## 📍 Step 1: Relay → ESP32

```
RELAY PIN        ESP32 PIN
─────────────────────────────
GND      ─────→  GND (any)
VCC      ─────→  5V (5V pin)
IN       ─────→  GPIO32
```

**Visual Connection**:
```
Relay back side:
┌──────────────────┐
│ GND│VCC│ IN     │ ← Three pins to connect
├──────────────────┤
│   o │ o  │ o    │
│   │ │ │  │ │    │
│   └─┼─┼──┼─┘    │
│     │ │  │      │
│     ↓ ↓  ↓      │
│   ESP32 PINS    │
│   GND 5V GPIO32 │
└──────────────────┘
```

## 📍 Step 2: Connect 12V Pump Power

```
RELAY SWITCH SIDE (back of relay):
┌──────────────────────┐
│   NO    COM          │
│   ○     ○            │
│   │     │            │
│   ├─────┤            │
│  12V+  Pump+         │
│   │     │            │
│   └─────┘            │
└──────────────────────┘
```

**Connections**:
```
12V Supply (+)  ─→  Relay NO pin
Relay COM pin   ─→  Pump + wire
Pump - wire     ─→  12V Supply (-) GND
                     AND
                     ESP32 GND (important!)
```

## 🔗 Complete Wiring

```
┌─────────────────────┐
│       ESP32         │
│                     │
│  5V  ──┐            │
│  GND ──┼─┐          │
│  GPIO32─┼─┼─┐       │
│          │ │ │      │
│          │ │ │      │
└──────────┼─┼─┼──────┘
           │ │ │
           ↓ ↓ ↓
         ┌─────────┐
         │RELAY    │
         │ VCC GND │
         │  IN     │
         └────┬────┘
              │
           ┌──┴──┐
           │ NO  COM
           │     │
        12V│     │Pump+
         + │     │
           │     │
           └──┬──┘
         12V GND
           (Connect
            back to
            ESP32 GND)
            
           │
           ↓
         ┌─────────┐
         │  PUMP   │
         │ +   -   │
         └────┬────┘
              │
           12V GND
```

## ✅ Quick Connection Checklist

```
RELAY TO ESP32:
[ ] Relay GND    → ESP32 GND
[ ] Relay VCC    → ESP32 5V
[ ] Relay IN     → ESP32 GPIO32

RELAY TO PUMP:
[ ] Relay NO     → 12V Supply +
[ ] Relay COM    → Pump + wire
[ ] Pump - wire  → 12V Supply -
[ ] 12V Supply - → ESP32 GND (CRITICAL!)
```

## 🧪 Test It

### Test 1: Power Check
```
Multimeter to VCC pin:
Should show 5V
If not → Check 5V connection
```

### Test 2: Relay Click
```cpp
// Upload this to ESP32:
void setup() {
  pinMode(32, OUTPUT);
}

void loop() {
  digitalWrite(32, LOW);    // Relay ON
  delay(1000);
  
  digitalWrite(32, HIGH);   // Relay OFF
  delay(1000);
}
```

**Expected**: You hear "click click click"

If no click:
- Check IN connection to GPIO32
- Check VCC connection to 5V
- Check GND connection

### Test 3: Pump Power Check
```
Use multimeter to check:
• Relay NO pin: Should show 12V
• Relay COM pin: Becomes 12V when relay ON
• Pump + wire: Should get 12V when relay ON
```

## 🔥 CRITICAL: Ground Connection

```
⚠️  MUST CONNECT ALL THESE TOGETHER:
    ├─ ESP32 GND
    ├─ Relay GND
    └─ 12V Supply GND (-)

    WITHOUT THIS, RELAY WON'T WORK!
```

**Visual**:
```
12V Supply GND (-)
        ↓
    ┌───┴───┐
    │       │
    ↓       ↓
Relay GND  ESP32 GND
    
All three MUST connect together
```

## 💧 Pump Control Logic

```cpp
// GPIO32 LOW = Relay activates = Pump ON
digitalWrite(32, LOW);   // Pump starts
delay(3000);             // Runs for 3 seconds
digitalWrite(32, HIGH);  // Pump stops
```

## 🎯 In Your System

```
ESP32 detects: Lid opened by sensor
After 5 seconds: digitalWrite(32, LOW);
Relay clicks: "CLICK!"
Pump runs: Whoooosh! 💧
After 3 seconds: digitalWrite(32, HIGH);
Relay clicks back: "CLICK!"
Pump stops: All done!
```

## 📋 Wiring Summary

```
CONNECTIONS (Total: 6)
1. Relay GND    → ESP32 GND
2. Relay VCC    → ESP32 5V
3. Relay IN     → ESP32 GPIO32
4. Relay NO     → 12V +
5. Relay COM    → Pump +
6. Pump -       → 12V GND (+ shared ESP32 GND)
```

## ❌ Common Mistakes

```
❌ Forgetting to connect 12V GND to ESP32 GND
   → Relay doesn't work at all
   
❌ Connecting NO and NC instead of NO and COM
   → Pump stays ON permanently
   
❌ Wrong GPIO pin (using 33 instead of 32)
   → Relay never activates
   
❌ 12V directly to relay VCC
   → Fries the relay immediately
   
❌ Using 3.3V instead of 5V
   → Relay might not click
```

## 🎓 How Relay Works

```
When GPIO32 = LOW (0V):
    ↓
Relay coil gets powered
    ↓
Electromagnetic force pulls switch
    ↓
NO and COM connect
    ↓
12V flows through relay to pump
    ↓
💧 PUMP ON!

When GPIO32 = HIGH (3.3V):
    ↓
Relay coil unpowered
    ↓
Spring returns switch
    ↓
NO and COM disconnect
    ↓
12V stops flowing
    ↓
🛑 PUMP OFF!
```

## 📸 Diagram With Real Wires

```
                    ESP32
    ┌───────────────────────────────────┐
    │  ●(5V)  ●(GND)  ●(GPIO32)        │
    └───┬──────┬────────┬───────────────┘
        │      │        │
        │      │        │
        ↓      ↓        ↓
    ┌───────────────────┐
    │ Relay Module      │
    │ ●(VCC) ●(GND)    │
    │ ●(IN)            │
    │                   │
    │ ├─ NO ─┐          │
    │ ├─ COM ─┤          │
    │ └─ NC ──┘          │
    └───┬───────────────┘
        │       │
        ↓       ↓
    12V+       PUMP+
        │       │
        │      [PUMP]
        │       │
        ↓       ↓
    ────────────── 12V-/GND
    (Also connects to ESP32 GND)
```

## ✨ Installation Complete When:

- ✅ You hear 3 "clicks" when uploading test code
- ✅ Multimeter shows ~12V on NO when relay ON
- ✅ Pump spins when relay activates
- ✅ LED indicator on relay lights up
- ✅ All wires are secure and no loose connections

---

**Ready to use!** 

Next: Test full system with actual payment flow
```bash
node test-rfid-tap.js
```

Then watch door open and pump activate! 🎉
