# SMART TOILET SYSTEM - STATE MACHINE & FLOW DIAGRAMS

## 🔄 COMPLETE STATE MACHINE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                         SYSTEM STATE FLOW                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

                              IDLE (0)
                           🏁 Ready
                    ┌─────────┬──────────┐
                    │         │          │
          Payment   │      RFID          │ No activity
          OR RFID   │       Tap          │
                    ▼         ▼          ▼
                ┌──────────────────┐
                │ DOOR_OPENING (1) │
                │ 🚪 Servo → 90°   │
                └────────┬─────────┘
                         │
                      0.5s pass
                         │
                         ▼
                ┌──────────────────┐
                │ DOOR_OPEN (2)    │
                │ 🚪 Hold 10 sec   │
                └────────┬─────────┘
                         │
                      10s pass
                         │
                         ▼
                ┌──────────────────┐
                │ DOOR_CLOSING (3) │
                │ 🚪 Servo → 0°    │
                └────────┬─────────┘
                         │
                      0.5s pass
                         │
                         ▼
                    ┌──────────────┐
                    │ OCCUPIED (4) │
                    │ 👤 Person in │
                    └──┬──────┬───┬┘
                       │      │   │
          Button   Motion Bowl Motion Exit
           Press   Sensor Sensor  Sensor Trigger
             OR    5cm    5cm     5cm
           Motion  IN     IN      OUT
                    │      │   │
                    │      │   └────────────┐
                    │      │                │
                    │      ▼                ▼
                    │   ┌──────────────┐   ┌──────────────┐
                    │   │ LID_OPEN (5) │   │ EXIT_OPENING │
                    │   │🪑 Servo→90°  │   │  🚪 Servo→90° │
                    │   └────┬─────────┘   └──────┬───────┘
                    │        │                    │
                    │     0.5s pass            0.5s pass
                    │        │                    │
                    │        ▼                    ▼
                    │   ┌──────────────┐   ┌──────────────┐
                    │   │LID_WAIT (6)  │   │ EXIT_OPEN(10)│
                    │   │ Wait 0.5s    │   │ Hold 10s     │
                    │   └────┬─────────┘   └──────┬───────┘
                    │        │                    │
                    │     0.5s pass            10s pass
                    │        │                    │
                    │        ▼                    ▼
                    │   ┌──────────────┐   ┌──────────────┐
                    │   │ FLUSHING (7) │   │EXIT_CLOSING  │
                    │   │💧 Pump ON    │   │🚪 Servo→0°   │
                    │   └────┬─────────┘   │              │
                    │        │             │  Close door  │
                    │     5s pump          │  Close lid   │
                    │        │             │  Turn OFF    │
                    │        ▼             │              │
                    │   ┌──────────────┐   │              │
                    │   │LID_CLOSE (8) │   │              │
                    │   │🪑 Servo→0°   │   │              │
                    └─►└────┬─────────┘   └──────┬───────┘
                             │                   │
                          0.5s pass            0.5s pass
                             │                   │
                             └─────┬─────────────┘
                                   │
                                   ▼
                              ┌──────────┐
                              │ IDLE (0) │
                              │ 🏁 Ready │
                              └──────────┘
```

---

## 📱 PAYMENT FLOW (Web Integration)

```
User Opens Browser
    │
    ▼
┌──────────────────────┐
│ index.html Displayed │
│ "Pay to Enter" Button│
└──────┬───────────────┘
       │
User enters phone number
       │
       ▼
┌──────────────────────────┐
│ Clicks "Pay to Enter"    │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ POST /api/payments/create        │
│ {                                │
│   phone: "25078XXXXXXX",         │
│   amount: 100,                   │
│   toilet_id: 1                   │
│ }                                │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ Server sends to PayPack          │
│ Waits for USSD prompt            │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ User enters PIN on phone         │
│ PayPack confirms payment         │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ ESP32 polls every 2 seconds      │
│ GET /api/hardware/payment-check/1│
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ Payment confirmed?               │
│ "command": "OPEN_DOOR"           │
└──────┬───────────────────────────┘
       │ YES
       ▼
┌──────────────────────────────────┐
│ triggerDoorOpen()                │
│ setState(DOOR_OPENING)           │
└──────┬───────────────────────────┘
       │
       ▼
    DOOR OPENS
```

---

## 🚪 ENTRY FLOW (Step by Step)

```
┌─────────────────────────────────────────────────┐
│           ENTRY SEQUENCE                        │
└─────────────────────────────────────────────────┘

1. PAYMENT / RFID DETECTED
   └─ WiFi message to server
   └─ Server validates
   └─ Server returns "OPEN_DOOR"

2. DOOR_OPENING (0.5 seconds)
   └─ Servo 1 moves from 0° to 90°
   └─ 🚪 Door physically opens
   └─ Serial: "🚪 Door opening — entry hold 10s"

3. DOOR_OPEN (10 seconds)
   └─ Door stays open
   └─ Person walks in
   └─ Serial: "Person has 10 seconds to enter"

4. DOOR_CLOSING (0.5 seconds)
   └─ Servo 1 moves from 90° to 0°
   └─ 🚪 Door physically closes
   └─ Serial: "🚪 Door closed → OCCUPIED"
   └─ Backend: setBackendOccupancy(true)

5. OCCUPIED STATE (waiting)
   └─ System now waiting for person to use toilet
   └─ LED starts blinking (green)
   └─ Two sensors watching:
      ├─ EXIT sensor: person leaving? → EXIT_OPENING
      └─ BOWL sensor: person sitting? → LID_OPENING
```

---

## 🪑 USAGE FLOW (When person uses toilet)

```
┌─────────────────────────────────────────────────┐
│        USAGE SEQUENCE (Toilet Use)              │
└─────────────────────────────────────────────────┘

1. PERSON SITS DOWN
   └─ BOWL sensor detects (< 5cm)
   └─ Serial: "🪑 Person detected in bowl → opening lid"
   └─ setState(LID_OPENING)

2. LID_OPENING (0.5 seconds)
   └─ Servo 2 moves from 0° to 90°
   └─ 🪑 Lid opens up
   └─ Serial: "Lid opening for usage"
   └─ setState(LID_OPEN_WAIT)

3. LID_OPEN_WAIT (0.5 seconds)
   └─ Lid stays open
   └─ Waiting before pump starts
   └─ Serial: "Waiting before flush..."
   └─ setState(FLUSHING)

4. FLUSHING - PUMP ACTIVE (5 seconds)
   └─ Relay triggers pump
   └─ 💧 Water flows for 5 seconds
   └─ Serial: "💧 PUMP ON"
   └─ setState(LID_CLOSING)

5. LID_CLOSING (0.5 seconds)
   └─ Servo 2 moves from 90° to 0°
   └─ 🪑 Lid closes back down
   └─ Serial: "💧 PUMP OFF"
   └─ Serial: "Lid closing..."
   └─ setState(OCCUPIED)

6. BACK TO OCCUPIED
   └─ System ready for next flush if needed
   └─ OR waiting for person to exit
```

---

## 🚪 AUTO-EXIT FLOW (No motion for 5 seconds)

```
┌──────────────────────────────────────────────┐
│      AUTO-EXIT AFTER 5 SECONDS (NO MOTION)   │
└──────────────────────────────────────────────┘

While OCCUPIED state:
    │
    ├─ Motion detected?
    │  ├─ EXIT sensor (< 5cm)
    │  ├─ BOWL sensor (< 5cm)
    │  └─ Button pressed
    │
    └─ No motion for 5000ms?
       └─ Serial: "⏱️ No motion for 5s → auto-exit triggered"
       └─ setState(EXIT_OPENING)

       ┌─────────────────────────┐
       │   EXIT SEQUENCE         │
       └─────────────────────────┘
       
       1. EXIT_OPENING (0.5s)
          └─ Servo 1 moves to 90°
          └─ 🚪 Door opens
          └─ Serial: "🚪 Exit triggered"
       
       2. EXIT_OPEN (10s)
          └─ Door stays open
          └─ Person walks out
       
       3. EXIT_CLOSING (0.5s)
          └─ Servo 1 moves to 0°
          └─ 🚪 Door closes
          └─ Lid closed
          └─ Pump OFF
          └─ setState(IDLE)
          └─ Serial: "🏁 Exit complete → toilet AVAILABLE"

Done! Ready for next payment.
```

---

## 🔘 BUTTON OVERRIDE FLOW

```
┌──────────────────────────────────────────────┐
│  MANUAL BUTTON PRESS (Inside toilet)         │
└──────────────────────────────────────────────┘

Anytime while OCCUPIED:
    │
    └─ Button pressed (GPIO 14 → LOW)
       │
       ├─ During LID_OPENING/WAIT/FLUSHING
       │  └─ Force close lid → EXIT_OPENING
       │
       ├─ During OCCUPIED (waiting)
       │  └─ Force EXIT_OPENING
       │
       └─ Then EXIT_OPEN → EXIT_CLOSING → IDLE
```

---

## 🔖 RFID FLOW (Card Tap)

```
┌──────────────────────────────────────────────┐
│         RFID CARD TAP DETECTION              │
└──────────────────────────────────────────────┘

Card touches reader (2-5cm):
    │
    ├─ System in IDLE only?
    │  └─ If not idle: ignore tap silently
    │
    ├─ Within cooldown? (3 seconds)
    │  └─ Ignore tap
    │
    └─ Valid tap!
       │
       └─ Extract UID: "AB CD EF 01 23"
       │  Serial: "🔖 Card UID: AB CD EF 01 23"
       │
       └─ POST /api/hardware/rfid-tap
          {
            "uid": "AB CD EF 01 23",
            "toilet_id": 1
          }
       │
       └─ Server checks database
          ├─ Card valid & active?
          │  └─ response: {"command": "OPEN_DOOR", "message": "Card OK"}
          │     triggerDoorOpen() → DOOR_OPENING
          │
          └─ Card invalid / inactive?
             └─ response: {"command": "DENY", "message": "Card blocked"}
                LED flashes twice (denied indication)
                Serial: "❌ RFID denied"
```

---

## 📊 SENSOR DETECTION STATES

```
┌──────────────────────────────────────────────┐
│      SENSOR STATE DETECTION (During OCCUPIED)│
└──────────────────────────────────────────────┘

CONTINUOUS MONITORING:

EXIT SENSOR (GPIO 27 - Exit door)
    │
    └─ Distance reading every 10ms
       │
       ├─ > 5cm: No detection
       │
       └─ ≤ 5cm: Detection!
          └─ Motion detected
          └─ Reset auto-exit timer
          └─ May trigger EXIT_OPENING


BOWL SENSOR (GPIO 12 - Inside toilet)
    │
    └─ Distance reading every 10ms
       │
       ├─ > 5cm: No detection
       │
       └─ ≤ 5cm: Detection!
          └─ Person in bowl
          └─ Reset auto-exit timer
          └─ If in OCCUPIED: trigger LID_OPENING


AUTO-EXIT TIMER
    │
    └─ Person detected?
       ├─ YES: Reset timer to 0
       │
       └─ NO: Increment timer
          └─ After 5000ms: EXIT_OPENING

Each sensor reading averages 5 samples for accuracy!
```

---

## 🔴 ERROR HANDLING & FAILSAFES

```
┌──────────────────────────────────────────────┐
│       SYSTEM SAFETY FAILSAFES                │
└──────────────────────────────────────────────┘

1. STUCK STATE TIMEOUT (20 minutes)
   └─ If any non-IDLE state > 20 min
   └─ Force reset: doors close, pump off, → IDLE
   └─ Serial: "⚠️ FAILSAFE: stuck for 20+ minutes"

2. PUMP WATCHDOG (6 seconds max)
   └─ If pump running > 6 seconds
   └─ Force pump OFF immediately
   └─ Serial: "⚠️ PUMP WATCHDOG: forced stop"

3. VOLTAGE CHECK
   └─ Ultrasonic ECHO pins monitored
   └─ Voltage dividers keep at 3.3V safe level
   └─ If reading out of range: ignored

4. WIFI TIMEOUT (3 second)
   └─ Payment API calls timeout after 3s
   └─ Doesn't block state machine
   └─ Graceful degradation

5. RFID COLLISION
   └─ Cooldown between taps (3 seconds)
   └─ Prevents double-triggering
   └─ Silently ignores duplicate taps

6. BUTTON DEBOUNCE (25ms)
   └─ Mechanical bounce filtered
   └─ Multiple rapid presses: treated as one (500ms cooldown)

7. COMMON GROUND REQUIREMENT
   └─ CRITICAL: 12V and 3.3V circuits must share GND
   └─ Without it: Relay won't switch properly
```

---

## 📈 TIMING DIAGRAM

```
ENTRY SEQUENCE TIMING:
┌─────────────────────────────────────────────────────────┐
│ Payment Detected (0ms)                                  │
├─────────────────────────────────────────────────────────┤
│ DOOR_OPENING        │◄─── ~500ms ──────►│               │
├─────────────────────┼─────────────────────────────────┤
│ DOOR_OPEN           │◄─────── 10,000ms ──────────────►│
├─────────────────────┴──────────────────────────────────┤
│ DOOR_CLOSING        │◄─── ~500ms ──────►│               │
├─────────────────────┼──────────────────────────────────┤
│ OCCUPIED            │◄─ Waiting for usage or auto-exit│
└─────────────────────┴──────────────────────────────────┘

USAGE SEQUENCE TIMING:
┌─────────────────────────────────────────────────────────┐
│ Bowl Detected (0ms)                                     │
├─────────────────────────────────────────────────────────┤
│ LID_OPENING         │◄─── ~500ms ──────►│               │
├─────────────────────┼─────────────────────────────────┤
│ LID_OPEN_WAIT       │◄─── ~500ms ──────►│               │
├─────────────────────┼─────────────────────────────────┤
│ FLUSHING (PUMP ON)  │◄─────── 5,000ms ───────────────►│
├─────────────────────┼──────────────────────────────────┤
│ LID_CLOSING         │◄─── ~500ms ──────►│               │
└─────────────────────┴──────────────────────────────────┘

AUTO-EXIT SEQUENCE TIMING:
┌─────────────────────────────────────────────────────────┐
│ No Motion Detected                                      │
│ Timer: 0ms ─────────────► 5,000ms ──► EXIT_OPENING    │
│        ├─ Motion? → Reset to 0ms                       │
│        └─ No motion? → Continue counting...             │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 STATE SUMMARY TABLE

| State # | Name | Duration | Next State | Trigger |
|---------|------|----------|-----------|---------|
| 0 | IDLE | ∞ | DOOR_OPENING | Payment/RFID |
| 1 | DOOR_OPENING | ~500ms | DOOR_OPEN | Auto |
| 2 | DOOR_OPEN | 10s | DOOR_CLOSING | Auto |
| 3 | DOOR_CLOSING | ~500ms | OCCUPIED | Auto |
| 4 | OCCUPIED | ∞ | LID_OPENING or EXIT_OPENING | Sensor/Button |
| 5 | LID_OPENING | ~500ms | LID_OPEN_WAIT | Auto |
| 6 | LID_OPEN_WAIT | ~500ms | FLUSHING | Auto |
| 7 | FLUSHING | 5s | LID_CLOSING | Auto |
| 8 | LID_CLOSING | ~500ms | OCCUPIED | Auto |
| 9 | EXIT_OPENING | ~500ms | EXIT_OPEN | Auto |
| 10 | EXIT_OPEN | 10s | EXIT_CLOSING | Auto |
| 11 | EXIT_CLOSING | ~500ms | IDLE | Auto |

---

## 🔍 MONITORING OUTPUT (Serial Monitor)

```
What you should see every 2 seconds:

📊 [OCCUPIED] Pump:OFF Exit:45.2cm Bowl:123.5cm
📊 [OCCUPIED] Pump:OFF Exit:4.8cm Bowl:120.3cm   ◄─ Exit sensor triggered!
🚪 Exit triggered → opening door
STATE → EXIT_OPENING
STATE → EXIT_OPEN
🚪 Exit triggered
📊 [EXIT_OPEN] Pump:OFF Exit:120.5cm Bowl:120.2cm
STATE → EXIT_CLOSING
🏁 Exit complete → toilet AVAILABLE
STATE → IDLE
📊 [IDLE] Pump:OFF Exit:120.5cm Bowl:120.2cm
```

