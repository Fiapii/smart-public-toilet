# 💳 Online Payment + Door Opening Flow Guide

## 🎯 Complete Payment System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    COMPLETE SYSTEM FLOW                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  USER INTERFACE (index.html)                                         │
│  ↓                                                                   │
│  [PAY 200 RWF] → User enters phone → Server: /api/payments/create   │
│  ↓                                                                   │
│  DATABASE: payments table                                            │
│  • transaction_id: PAYPACK_xxxxx                                    │
│  • status: pending                                                   │
│  • toilet_id: 1                                                      │
│  • amount: 200.00                                                    │
│  ↓                                                                   │
│  PayPack Service                                                     │
│  • SMS to user phone with PIN prompt                                │
│  • User enters PIN                                                   │
│  ↓                                                                   │
│  FRONTEND Polling: /api/payments/status/:transaction_id              │
│  Every 2 seconds, checking PayPack status                           │
│  ↓                                                                   │
│  STATUS CHANGES TO "completed"                                       │
│  • Revenue added to toilets table                                    │
│  • Event logged to sensor_events                                     │
│  • Payment record marked with consumed flag                          │
│  ↓                                                                   │
│  FRONTEND Shows: "✅ Payment Received! 🚪 DOOR OPENING..."          │
│  ↓                                                                   │
│  ESP32 POLLING: /api/hardware/payment-check/1 (every 2 seconds)    │
│  ↓                                                                   │
│  SERVER Response: { command: "OPEN_DOOR", amount: 200, ... }       │
│  ↓                                                                   │
│  ESP32 ACTIONS:                                                      │
│  • Sets systemArmed = true                                           │
│  • Lights GREEN LED                                                  │
│  • Moves door servo to 90° (OPEN)                                    │
│  • Sets waitingForEntryClose = true                                  │
│  ↓                                                                   │
│  USER ENTERS & SITS ON TOILET                                        │
│  ↓                                                                   │
│  ULTRASONIC SENSOR detects proximity                                 │
│  • Lid servo moves to 90° (OPEN)                                     │
│  • Waits 5 seconds                                                   │
│  • Pump relay activates (GPIO32 goes LOW)                            │
│  • 💧 Automatic flush for 3 seconds                                  │
│  • Pump relay deactivates (GPIO32 goes HIGH)                         │
│  • Lid closes                                                        │
│  ↓                                                                   │
│  USER EXITS & DOOR CLOSES                                            │
│  ↓                                                                   │
│  DATABASE SUMMARY:                                                   │
│  ✅ payments table - Has payment record with status "Paid"          │
│  ✅ toilets table - Revenue increased by RWF 200                    │
│  ✅ sensor_events - Logged payment event with details               │
│  ✅ rfid_cards - (Not used for online payment)                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## 📱 Step-by-Step Payment Process

### Step 1: User Initiates Payment

**Frontend (index.html)**:
```javascript
User clicks: [💳 Pay to Enter]
    ↓
Enters phone: 078xxxxxxx
    ↓
API Call: POST /api/payments/create
{
  toilet_id: 1,
  amount: 200,
  phone_number: "250780000000"
}
```

**Server Response**:
```json
{
  "success": true,
  "message": "Payment initiated. Please check your phone to confirm.",
  "transaction_id": "PAYPACK_1234567890",
  "payment_id": 42,
  "amount": 200
}
```

### Step 2: Database Initial Record

**payments table**:
```sql
INSERT INTO payments (toilet_id, amount, phone_number, status)
VALUES (1, 200.00, '250780000000', 'pending');

Result:
id: 42
toilet_id: 1
amount: 200.00
phone_number: 250780000000
transaction_id: PAYPACK_1234567890
status: pending
paid_at: NULL
consumed: 0
created_at: 2025-05-14 10:30:00
```

### Step 3: PayPack SMS Notification

**User's phone**:
```
SmartLoo Toilet Payment
Please enter PIN to confirm: 200 RWF
Transaction ID: PAYPACK_1234567890
```

User enters PIN on their phone.

### Step 4: Frontend Polling for Confirmation

**Every 2 seconds**:
```
GET /api/payments/status/PAYPACK_1234567890

Server checks PayPack API:
- Is payment confirmed? (YES/NO/PENDING)
```

### Step 5: Payment Confirmed - Multiple Things Happen

**Server Side**:

1. **Update Payment Record**:
```sql
UPDATE payments 
SET status = 'completed', paid_at = NOW()
WHERE transaction_id = 'PAYPACK_1234567890';
```

2. **Add to Toilet Revenue**:
```sql
UPDATE toilets 
SET revenue = revenue + 200
WHERE id = 1;
```

3. **Log Event**:
```sql
INSERT INTO sensor_events 
(toilet_id, event_type, details)
VALUES (1, 'payment', 'Online payment confirmed: RWF 200 via phone 250780000000...');
```

### Step 6: Frontend Response

**Server sends to frontend**:
```json
{
  "success": true,
  "status": "successful",
  "command": "OPEN_DOOR",
  "message": "Payment confirmed! Door is opening...",
  "transaction_id": "PAYPACK_1234567890",
  "amount": 200,
  "toilet_id": 1
}
```

**Frontend displays**:
```
✅ Payment Received!
🚪 DOOR OPENING...
Transaction: PAYPACK_1234567890
Amount: RWF 200
```

### Step 7: ESP32 Detects Payment Ready

**ESP32 polling loop** (every 2 seconds):
```cpp
GET /api/hardware/payment-check/1

Server Query:
SELECT * FROM payments 
WHERE toilet_id = 1 AND status = 'completed' AND consumed = 0;
```

**Server Response**:
```json
{
  "command": "OPEN_DOOR",
  "message": "Payment accepted! RWF 200 charged. Door opening...",
  "transaction_id": "PAYPACK_1234567890",
  "amount": 200
}
```

### Step 8: ESP32 Opens Door

```cpp
const char* command = resp_doc["command"] | "DENY";

if (strcmp(command, "OPEN_DOOR") == 0) {
    // ✅ Payment accepted
    Serial.println("✅ Payment confirmed – opening door.");
    systemArmed = true;
    digitalWrite(LED1_GREEN, HIGH);  // Green LED on
    digitalWrite(LED2_GREEN, HIGH);
    
    // Door servo opens
    startSmoothMove(&door, DOOR_OPEN_ANGLE, doorServo);
    door.isActive = true;
    entryOpenStart = millis();
    waitingForEntryClose = true;
}
```

### Step 9: Database Marks as Consumed

**Server auto-marks**:
```sql
UPDATE payments 
SET consumed = 1 
WHERE id = (SELECT id FROM payments WHERE transaction_id = 'PAYPACK_1234567890');
```

This prevents the door from triggering multiple times.

### Step 10: Complete Transaction Log

**Final Database State**:

**payments table**:
```
id: 42
toilet_id: 1
amount: 200.00
phone_number: 250780000000
transaction_id: PAYPACK_1234567890
status: completed ✅
paid_at: 2025-05-14 10:30:45
consumed: 1 ✅
created_at: 2025-05-14 10:30:00
```

**sensor_events table**:
```
id: 101
toilet_id: 1
event_type: 'payment'
details: 'Online payment confirmed: RWF 200 via phone 250780000000. Transaction: PAYPACK_1234567890'
created_at: 2025-05-14 10:30:45

id: 102
toilet_id: 1
event_type: 'payment_trigger'
details: 'Payment PAYPACK_1234567890 (200 RWF) triggered door opening'
created_at: 2025-05-14 10:30:46
```

**toilets table**:
```
id: 1
location: 'Kigali City Mall'
revenue: 5600.00  ← Increased from 5400.00 (+200)
created_at: ...
```

## 💻 Testing Online Payment Locally

### Step 1: Set Mock Payment Mode (For Testing)

**Edit .env file**:
```
MOCK_PAYMENT=true
```

When `MOCK_PAYMENT=true`, payments bypass real PayPack and are instantly marked as completed.

### Step 2: Test Payment API Directly

```bash
curl -X POST http://192.168.1.105:5000/api/payments/create \
  -H "Content-Type: application/json" \
  -d '{
    "toilet_id": 1,
    "amount": 200,
    "phone_number": "250780000000"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Payment initiated. Please check your phone to confirm.",
  "transaction_id": "MOCK_1714649445000",
  "payment_id": 43,
  "amount": 200,
  "mock": true
}
```

### Step 3: Check Payment Status

```bash
curl http://192.168.1.105:5000/api/payments/status/MOCK_1714649445000
```

**Response** (with MOCK_PAYMENT=true):
```json
{
  "success": true,
  "status": "successful",
  "command": "OPEN_DOOR",
  "message": "Payment confirmed! Door is opening...",
  "transaction_id": "MOCK_1714649445000",
  "amount": 200,
  "toilet_id": 1
}
```

### Step 4: Check Payment Trigger (ESP32 call)

```bash
curl http://192.168.1.105:5000/api/hardware/payment-check/1
```

**Response**:
```json
{
  "command": "OPEN_DOOR",
  "message": "Payment accepted! RWF 200 charged. Door opening...",
  "transaction_id": "MOCK_1714649445000",
  "amount": 200
}
```

### Step 5: Verify Database

```bash
node verify-database.js
```

Should show:
```
💰 Recent Payments:
  1. Transaction: MOCK_1714649445000 | Amount: RWF 200 | Status: Paid

🚽 Toilet Revenue:
  Toilet 1 (Kigali City Mall): RWF 5800.00 revenue (increased)

📝 Events:
  [payment] Online payment confirmed...
  [payment_trigger] Door triggered...
```

## 📊 Real vs Mock Payments

### With MOCK_PAYMENT=true (Testing)
```
Payment Flow:
① POST /api/payments/create → Instantly marked "Paid"
② GET /api/payments/status → Returns "OPEN_DOOR"
③ No SMS to user
④ Fast for testing
⚠️ Don't use in production
```

### With MOCK_PAYMENT=false (Production)
```
Payment Flow:
① POST /api/payments/create → Status = "pending"
② PayPack API → Sends SMS to user
③ GET /api/payments/status → Polls PayPack API
④ User enters PIN
⑤ PayPack confirms → Status = "completed"
⑥ Real money from user account
```

## 🧪 Full Integration Test

### Test 1: Using Web Interface
1. Open `http://192.168.1.105:5000/interface.html` (or http://192.168.1.105:5000/)
2. Click [💳 Pay to Enter]
3. Enter phone: 078xxxxxxx
4. With MOCK_PAYMENT=true, should complete instantly
5. Check database: `node verify-database.js`
6. Look for new payment record

### Test 2: Using cURL
```bash
# Create payment
RESPONSE=$(curl -s -X POST http://192.168.1.105:5000/api/payments/create \
  -H "Content-Type: application/json" \
  -d '{
    "toilet_id": 1,
    "amount": 200,
    "phone_number": "250780000000"
  }')

echo $RESPONSE | jq '.transaction_id'
# Output: PAYPACK_xxxxx or MOCK_xxxxx

# Check status
TXN_ID=$(echo $RESPONSE | jq -r '.transaction_id')
curl -s http://192.168.1.105:5000/api/payments/status/$TXN_ID | jq '.'
```

### Test 3: Simulating ESP32
```bash
# Check if payment is ready
curl -s http://192.168.1.105:5000/api/hardware/payment-check/1 | jq '.'

# Should show OPEN_DOOR command if payment completed
```

## 🔄 Troubleshooting

### Problem: Payment shows "pending" forever

**Solutions**:
1. Make sure MOCK_PAYMENT=true for testing
2. Check PayPack credentials in .env
3. Verify internet connection
4. Check server logs for PayPack API errors

### Problem: Database doesn't show payment

**Solutions**:
1. Verify database connection: `node verify-database.js`
2. Check toilet_id matches (1 is default)
3. Verify amount is 200 RWF
4. Check payment status table for errors

### Problem: ESP32 doesn't open door after payment

**Solutions**:
1. Check ESP32 is polling: Look for "[HTTP] POST /api/hardware/payment-check" in serial
2. Verify WiFi connection
3. Check door servo works (test with RFID first)
4. Check server is returning OPEN_DOOR command

### Problem: Door opens but revenue not updated

**Solutions**:
1. Query database: `SELECT * FROM toilets WHERE id = 1;`
2. Check revenue column - should have increased by 200
3. If not updated, check database query in paymentController.js

## 📈 Dashboard Integration

After payment completes, dashboard should show:

**Real-time Events** (via SSE):
- ✅ Payment event logged
- ✅ Door opening event logged
- ✅ Transaction ID displayed

**Statistics**:
- Revenue: Increased by RWF 200
- Payment count: +1
- Status: "Completed"

---

**Next Steps**:
1. Set MOCK_PAYMENT=true for local testing
2. Test full payment flow through web interface
3. Verify database records
4. Check ESP32 receives OPEN_DOOR command
5. Test with real payments (remove MOCK_PAYMENT or set to false)

**Status**: ✅ Ready for testing
**Tested**: RFID payments ✅ | Online payments ✅
**Database**: All events logged ✅
**ESP32**: Door opening ✅
