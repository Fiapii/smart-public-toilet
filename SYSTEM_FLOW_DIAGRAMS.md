# System Behavior Flow Diagrams

## 🎯 Complete User Journey

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                    SMART PUBLIC TOILET SYSTEM v2.0                        ║
╚═══════════════════════════════════════════════════════════════════════════╝

START
  ├─ LED is OFF 🔴 (Toilet available)
  ├─ System waiting for payment
  └─ Both sensors ready

         ↓

[User Pays via RFID Card OR Online Payment]
  
  ├─ Payment verified by server
  ├─ Door servo opens ✓
  ├─ LED turns ON and BLINKS 🟢🟢🟢
  ├─ toiletInUse = true
  └─ Serial: "✅ Payment accepted"

         ↓

[User enters toilet]
  
  ├─ LED keeps BLINKING 🟢
  ├─ All future payments BLOCKED
  │  └─ If another card tapped:
  │     ├─ LED flashes 3x
  │     └─ Serial: "❌ Toilet in use"
  └─ No online payments accepted

         ↓

[User uses toilet & motion detected by Sensor 2]
  
  ├─ Lid servo opens
  ├─ Serial: "🫖 LID SENSOR: Lid opening"
  ├─ Lid stays OPEN for 10 seconds
  └─ LED keeps BLINKING 🟢

         ↓ (After 10 seconds)

[Automatic Flush Cycle Starts]
  
  ├─ Pump relay activates (GPIO 32 LOW)
  ├─ Serial: "💧 FLUSHING (pump ON)"
  ├─ Pump runs for EXACTLY 5 seconds
  └─ LED keeps BLINKING 🟢

         ↓ (After 5 seconds)

[Flush Complete]
  
  ├─ Pump relay deactivates (GPIO 32 HIGH)
  ├─ Lid servo closes
  ├─ Serial: "💧 Flush complete (pump OFF)"
  └─ LED keeps BLINKING 🟢

         ↓

[User exits via Sensor 1 (Door)]
  
  ├─ Motion detected at door
  ├─ Door servo opens
  ├─ Serial: "🚪 EXIT SENSOR: Door opening"
  ├─ toiletInUse = false ← KEY LINE
  ├─ LED turns OFF 🔴 ← KEY LINE
  ├─ Serial: "✓ Toilet marked as AVAILABLE"
  └─ System ready for next user

         ↓

READY FOR NEXT PAYMENT
  └─ Loop back to START

```

---

## 🚪 Door Sensor (GPIO 13/12) Timeline

```
Person Approaching Exit
  │
  ├─ 0cm → 6cm:  TRIGGER
  │              ├─ startSmoothMove(90°)
  │              ├─ door.isActive = true
  │              └─ door.lastTriggerTime = NOW
  │
  ├─ 6cm → 10cm: Door smooth opening (takes ~2 seconds)
  │              └─ angle: 0° → 90°
  │
  ├─ At angle 90°: Door fully open
  │                └─ isMoving = false
  │
  ├─ 0-10 sec:    Door stays OPEN
  │                └─ Person exits during this time
  │
  └─ 10 sec:      Auto-close triggered
                  ├─ startSmoothMove(0°)
                  ├─ Door smooth closing
                  └─ angle: 90° → 0°

RESULT: toiletInUse = false, LED = OFF 🔴
```

---

## 🫖 Lid Sensor (GPIO 26/27) Timeline

**ONLY WORKS IF toiletInUse = true**

```
Person Detected Inside Toilet
  │
  ├─ IF toiletInUse == false:
  │  └─ Sensor IGNORED (no action)
  │
  ├─ IF toiletInUse == true:
  │  └─ Continue...
  │
  ├─ Motion at 0-10cm: TRIGGER
  │                     ├─ startSmoothMove(90°)
  │                     └─ lid.lastTriggerTime = NOW
  │
  ├─ 0 sec:     Lid starts opening
  │             └─ angle: 0° → 90°
  │
  ├─ 0-2 sec:   Lid opening smooth (takes ~2 seconds)
  │
  ├─ 2-10 sec:  Lid fully open, HOLDING
  │             └─ isMoving = false
  │
  ├─ 10 sec:    PUMP TIME (trigger event)
  │             ├─ startPump() called
  │             └─ pumpStartTime = NOW
  │
  ├─ 10-15 sec: PUMP RUNNING ⚙️
  │             ├─ Relay: GPIO32 = LOW
  │             ├─ Water flowing (5 seconds)
  │             └─ Serial: "💧 FLUSHING"
  │
  ├─ 15 sec:    PUMP STOPS
  │             ├─ stopPump() called
  │             ├─ Relay: GPIO32 = HIGH
  │             ├─ startSmoothMove(0°) for lid
  │             └─ Serial: "💧 Flush complete"
  │
  ├─ 15-17 sec: Lid closing smooth (takes ~2 seconds)
  │             └─ angle: 90° → 0°
  │
  └─ 17+ sec:   Lid closed, waiting for next motion

SEQUENCE: Open 10s → Pump 5s → Close = 17 seconds total
```

---

## 🟢 LED Behavior

```
╔════════════════════════════════════════════════════════════════╗
║ LED STATE MACHINE (GPIO 22)                                    ║
╚════════════════════════════════════════════════════════════════╝

STATE 1: AVAILABLE (LED OFF)
┌─────────────────────────────────────────┐
│ ◯ LED = LOW (OFF)                       │
│ Status: Toilet free                     │
│ toiletInUse = false                     │
│ ledBlinking = false                     │
│                                         │
│ Action: Wait for payment                │
└─────────────────────────────────────────┘
        ↓ (RFID/Online payment accepted)
        
STATE 2: OCCUPIED BLINKING
┌─────────────────────────────────────────┐
│ ◉ LED = HIGH+BLINKING (ON)              │
│ Pattern: 500ms ON → 500ms OFF (repeat)  │
│ Status: Someone inside                  │
│ toiletInUse = true                      │
│ ledBlinking = true                      │
│                                         │
│ During this state:                      │
│ • LED changes state every 500ms         │
│ • Payments BLOCKED                      │
│ • Sensors ACTIVE                        │
│ • Pump ready                            │
└─────────────────────────────────────────┘
        ↓ (Door exit sensor triggered)
        
STATE 3: PAYMENT REJECTED FLASH
┌─────────────────────────────────────────┐
│ ◉◯◉◯◉◯ (3 quick flashes)                │
│ Pattern: HIGH 200ms, LOW 150ms × 3      │
│ Status: Payment denied                  │
│ toiletInUse = true (still)              │
│ Reason: Toilet occupied OR low balance  │
│                                         │
│ After flash: Resume STATE 2             │
└─────────────────────────────────────────┘
        ↓ (Or direct exit sensor trigger)
        
BACK TO STATE 1: AVAILABLE
└─────────────────────────────────────────┘
```

---

## 💳 Payment Flow Comparison

### RFID Card Path:
```
User taps card
      ↓
ESP32 reads UID
      ↓
POST to /api/hardware/rfid-tap
      ↓
Server checks balance (RWF 200)
      ↓
Server: "OPEN_DOOR" response ✓
      ↓
ESP32 actions:
├─ Door servo opens
├─ LED blinks (GPIO 22)
├─ toiletInUse = true
└─ logEvent("rfid_door_open")
      ↓
PERSON ENTERS
```

### Online Payment Path (PayPack):
```
User on index.html
      ↓
Enters phone number
      ↓
Clicks "Pay to Enter"
      ↓
PayPack payment confirmation
      ↓
Backend marks payment_id.status = "successful"
      ↓
ESP32 polls /api/hardware/payment-check/1
      ↓ (Every 2 seconds)
      ↓
Server: "OPEN_DOOR" response ✓
      ↓
ESP32 actions:
├─ Door servo opens
├─ LED blinks (GPIO 22)
├─ toiletInUse = true
└─ logEvent("payment_door_open")
      ↓
PERSON ENTERS
```

---

## 🔌 Hardware Connection Diagram

```
        ┌─────────────┐
        │   ESP32     │
        └─────────────┘
         │             │
    ┌────┴──────┬──────┴─────┬─────┐
    │ GPIO 15   │ GPIO 33    │ ... │
    │           │            │     │
    ▼           ▼            ▼     ▼
  Door Servo  Lid Servo   Relay  RFID Reader
     │          │          │        │
     ▼          ▼          ▼        ▼
  Door         Lid        Pump    Card Tap


        GPIO 22 (LED)
            │
            ▼
        Green LED (220Ω resistor)
            │
            ▼
           GND

        
        GPIO 13/12 (Sensor 1)
            │
            ▼
        Ultrasonic Door Sensor
        (triggers exit detection)
            

        GPIO 26/27 (Sensor 2)
            │
            ▼
        Ultrasonic Lid Sensor
        (triggers flush cycle)
```

---

## 📊 State Machine Summary

```
AVAILABLE (LED OFF) ←─────────────────────┐
    │                                      │
    │ RFID/Payment OK                      │
    ▼                                      │
OCCUPIED (LED BLINKING)                    │
    │                                      │
    ├─ Sensor 1 detects exit              │
    ├─ Door opens                         │
    └─ Exit confirmed ──────────────────→ AVAILABLE


When OCCUPIED (LED BLINKING):
    │
    ├─ Sensor 2 detects motion ──→ Lid opens (10s)
    │                            → Pump ON (5s)
    │                            → Lid closes
    │
    ├─ RFID tapped ──────────────→ Rejected (3x flash)
    │
    └─ Online payment check ─────→ Blocked (nothing happens)
```

---

**Visual Summary: This diagram shows exact timing and state transitions**
