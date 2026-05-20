# 📊 Payment Database Flow - Visual Guide

## 1️⃣ RFID Card Payment Flow

```
STEP 1: Card Tapped
─────────────────
ESP32 sends:
  POST /api/hardware/rfid-tap
  {
    uid: "29 67 1C 06",
    toilet_id: 1
  }

        ↓ ↓ ↓

STEP 2: Server Verifies Card
──────────────────────────────
Query: SELECT * FROM rfid_cards WHERE uid = '29 67 1C 06'

Current State (rfid_cards table):
┌─────────────────────────────────────────┐
│ id │ uid        │ balance │ is_active   │
├────┼────────────┼─────────┼─────────────┤
│ 1  │ 29 67 1C 06│  5000   │ TRUE ✅     │
└─────────────────────────────────────────┘

Check: balance >= 200? YES ✅

        ↓ ↓ ↓

STEP 3: Deduct Balance
──────────────────────
UPDATE rfid_cards 
SET balance = balance - 200 
WHERE id = 1

New State (rfid_cards table):
┌─────────────────────────────────────────┐
│ id │ uid        │ balance │ is_active   │
├────┼────────────┼─────────┼─────────────┤
│ 1  │ 29 67 1C 06│  4800   │ TRUE ✅     │
└─────────────────────────────────────────┘

        ↓ ↓ ↓

STEP 4: Record Payment
───────────────────────
INSERT INTO payments (
  toilet_id, amount, phone_number, 
  transaction_id, status, paid_at
)
VALUES (
  1, 200.00, 'RFID:29 67 1C 06',
  'RFID_1778743311214_1', 'Paid', NOW()
)

New Record (payments table):
┌──────────────────────────────────────────────────────────────┐
│ id │ toilet_id │ amount  │ phone_number │ status │ paid_at   │
├────┼───────────┼─────────┼──────────────┼────────┼───────────┤
│ 42 │ 1         │ 200.00  │ RFID:29 ...  │ Paid   │ NOW()     │
└──────────────────────────────────────────────────────────────┘

        ↓ ↓ ↓

STEP 5: Update Toilet Revenue
───────────────────────────────
UPDATE toilets 
SET revenue = revenue + 200 
WHERE id = 1

Toilet State (toilets table):
┌──────────────────────────────────────────┐
│ id │ location          │ revenue         │
├────┼───────────────────┼─────────────────┤
│ 1  │ Kigali City Mall  │ 5400 (was 5200) │
└──────────────────────────────────────────┘

        ↓ ↓ ↓

STEP 6: Log Event
──────────────────
INSERT INTO sensor_events (
  toilet_id, event_type, details
)
VALUES (
  1, 'rfid_tap',
  'Card 29 67 1C 06 paid RWF 200. New balance: 4800'
)

Event Logged (sensor_events table):
┌────────────────────────────────────────────────────────────┐
│ id  │ toilet_id │ event_type │ details                     │
├─────┼───────────┼────────────┼─────────────────────────────┤
│ 153 │ 1         │ rfid_tap   │ Card 29 67 1C 06 paid ...   │
└────────────────────────────────────────────────────────────┘

        ↓ ↓ ↓

STEP 7: Send Response to ESP32
────────────────────────────────
Response:
{
  "command": "OPEN_DOOR",
  "message": "Payment accepted! RWF 200 deducted. Remaining: 4800",
  "balance": 4800,
  "transaction_id": "RFID_1778743311214_1"
}

        ↓ ↓ ↓

STEP 8: Door Opens
───────────────────
ESP32 Receives: command = "OPEN_DOOR"
→ Sets systemArmed = true
→ Lights GREEN LED
→ Moves door servo to 90°
→ Door OPENS! 🚪
```

## 2️⃣ Online Payment (PayPack) Flow

```
STEP 1: User Initiates Payment
──────────────────────────────
Frontend sends:
  POST /api/payments/create
  {
    toilet_id: 1,
    amount: 200,
    phone_number: "250780000000"
  }

        ↓ ↓ ↓

STEP 2: Create Payment Record (PENDING)
─────────────────────────────────────────
INSERT INTO payments (
  toilet_id, amount, phone_number, status
)
VALUES (1, 200, '250780000000', 'pending')

Initial State (payments table):
┌──────────────────────────────────────────────────────────┐
│ id │ amount │ phone_number  │ status   │ consumed │ paid_at │
├────┼────────┼───────────────┼──────────┼──────────┼─────────┤
│ 43 │ 200.00 │ 250780000000  │ pending  │ 0        │ NULL    │
└──────────────────────────────────────────────────────────┘

        ↓ ↓ ↓

STEP 3: Call PayPack API
─────────────────────────
Server calls:
  paypack.initiateCashin(
    "250780000000",
    200
  )

PayPack Response:
{
  "ref": "PAYPACK_1234567890",
  "status": "initiated"
}

Update Record:
UPDATE payments 
SET transaction_id = 'PAYPACK_1234567890'
WHERE id = 43

Updated State (payments table):
┌─────────────────────────────────────────────────────────┐
│ id │ amount │ phone_number  │ transaction_id      │ status │
├────┼────────┼───────────────┼─────────────────────┼────────┤
│ 43 │ 200.00 │ 250780000000  │ PAYPACK_1234567890  │pending │
└─────────────────────────────────────────────────────────┘

Return to Frontend:
{
  "success": true,
  "transaction_id": "PAYPACK_1234567890",
  "message": "Payment initiated. Check your phone..."
}

        ↓ ↓ ↓

STEP 4: SMS Sent to User
─────────────────────────
User's Phone:
┌─────────────────────────┐
│ SmartLoo Payment Notice │
│ ──────────────────────  │
│ Amount: RWF 200         │
│ Please enter PIN        │
│                         │
│ Ref: PAYPACK_12...      │
└─────────────────────────┘

        ↓ ↓ ↓

STEP 5: Frontend Polling (Every 2 Seconds)
────────────────────────────────────────────
GET /api/payments/status/PAYPACK_1234567890

Server queries PayPack API:
  paypack.checkPaymentStatus("PAYPACK_1234567890")

PayPack Response:
  status: "pending" (user hasn't entered PIN yet)
  
Response to Frontend:
{
  "status": "pending",
  "message": "Waiting for your confirmation on phone..."
}

Frontend shows: ⏳ Waiting...

        ↓ ↓ ↓

STEP 6: User Enters PIN (On Their Phone)
──────────────────────────────────────────
User's Phone:
  [PIN: ····]
  [SEND]

PayPack confirms with bank/mobile operator
Payment processed!

        ↓ ↓ ↓

STEP 7: Next Poll - Payment Confirmed! 🎉
──────────────────────────────────────────
GET /api/payments/status/PAYPACK_1234567890

PayPack Response:
{
  "status": "successful",
  "message": "Payment confirmed"
}

Server NOW updates database:

UPDATE payments 
SET status = 'completed', paid_at = NOW()
WHERE transaction_id = 'PAYPACK_1234567890'

INSERT INTO sensor_events ...

UPDATE toilets 
SET revenue = revenue + 200 
WHERE id = 1

Updated State (payments table):
┌──────────────────────────────────────────────────────────┐
│ id │ amount │ phone_number  │ status     │ paid_at     │
├────┼────────┼───────────────┼────────────┼─────────────┤
│ 43 │ 200.00 │ 250780000000  │ completed  │ 2025-05... │
└──────────────────────────────────────────────────────────┘

Response to Frontend:
{
  "status": "successful",
  "command": "OPEN_DOOR",
  "message": "Payment confirmed! Door is opening...",
  "amount": 200,
  "toilet_id": 1
}

Frontend displays:
┌──────────────────────────┐
│ ✅ Payment Received!     │
│ 🚪 DOOR OPENING...       │
│ RWF 200 · Toilet 1       │
└──────────────────────────┘

        ↓ ↓ ↓

STEP 8: ESP32 Polls for Payment
────────────────────────────────
ESP32 continuously polls:
  GET /api/hardware/payment-check/1

Server Query:
SELECT * FROM payments 
WHERE toilet_id = 1 
  AND status = 'completed' 
  AND consumed = 0
ORDER BY paid_at DESC LIMIT 1

Found! (payment id = 43)

Mark as consumed:
UPDATE payments SET consumed = 1 WHERE id = 43

Response to ESP32:
{
  "command": "OPEN_DOOR",
  "message": "Payment accepted! Door opening...",
  "amount": 200,
  "transaction_id": "PAYPACK_1234567890"
}

Final State (payments table):
┌────────────────────────────────────────────────────────┐
│ id │ status    │ consumed │ transaction_id          │
├────┼───────────┼──────────┼────────────────────────┤
│ 43 │ completed │ 1 ✅     │ PAYPACK_1234567890    │
└────────────────────────────────────────────────────────┘

        ↓ ↓ ↓

STEP 9: Door Opens
───────────────────
ESP32 Receives: command = "OPEN_DOOR"
→ Sets systemArmed = true
→ Lights GREEN LED
→ Moves door servo to 90°
→ Door OPENS! 🚪
```

## 📋 Database Tables After Both Payments

```
payments Table:
┌─────┬─────────┬────────┬──────────────────┬────────────┬──────────┐
│ id  │ toilet  │ amount │ phone_number     │ status     │ consumed │
├─────┼─────────┼────────┼──────────────────┼────────────┼──────────┤
│ 42  │ 1       │ 200.00 │ RFID:29 67 ...   │ Paid       │ 1        │
│ 43  │ 1       │ 200.00 │ 250780000000     │ completed  │ 1        │
│ 44  │ 1       │ 200.00 │ RFID:AA BB ...   │ Paid       │ 1        │
└─────┴─────────┴────────┴──────────────────┴────────────┴──────────┘

Total: RWF 600 collected (3 payments)

rfid_cards Table:
┌────┬────────────┬──────────────┬─────────┐
│ id │ uid        │ holder_name  │ balance │
├────┼────────────┼──────────────┼─────────┤
│ 1  │ 29 67 1C06 │ Test Card 1  │ 4800    │ ← 200 deducted
│ 2  │ AA BB CCDD │ Test Card 2  │ 9800    │ ← 200 deducted
│ 3  │ 11 22 3344 │ Test Card 3  │ 1800    │
└────┴────────────┴──────────────┴─────────┘

toilets Table:
┌────┬──────────────────┬──────────┐
│ id │ location         │ revenue  │
├────┼──────────────────┼──────────┤
│ 1  │ Kigali City Mall │ 5600.00  │ ← Increased by 600
└────┴──────────────────┴──────────┘

sensor_events Table (Recent):
┌──────┬────────────┬──────────────────┬──────────────────────┐
│ id   │ event_type │ toilet_id        │ details              │
├──────┼────────────┼──────────────────┼──────────────────────┤
│ 150  │ rfid_tap   │ 1                │ Card 29 67 1C 06 ... │
│ 151  │ payment    │ 1                │ RWF 200 deducted...  │
│ 152  │ payment    │ 1                │ Online payment ...   │
│ 153  │ payment_tr │ 1                │ Payment triggered... │
│ 154  │ rfid_tap   │ 1                │ Card AA BB CC DD ... │
│ 155  │ payment    │ 1                │ RWF 200 deducted...  │
└──────┴────────────┴──────────────────┴──────────────────────┘
```

## 🔄 Key Differences

| Aspect | RFID Card | Online Payment |
|--------|-----------|----------------|
| **Payment Status** | Instantly "Paid" | Starts "pending" → "completed" |
| **Balance Tracking** | Deducted from card | Charged from account |
| **User Setup** | Pre-register card | Enter phone number |
| **Response Time** | <1 second | 30-60 seconds (SMS) |
| **Database Record** | Saved as RFID ID | Saved as PayPack ref |
| **Consumed Flag** | Set on first door trigger | Set on first door trigger |
| **Revenue Update** | Immediate | When payment confirmed |

## 🎯 Dashboard Queries

### Total Revenue Today
```sql
SELECT SUM(amount) as daily_revenue
FROM payments
WHERE DATE(paid_at) = CURDATE()
AND status IN ('Paid', 'completed');

Result: RWF 600 (from our 3 test payments)
```

### Payment Methods Breakdown
```sql
SELECT 
  CASE 
    WHEN phone_number LIKE 'RFID:%' THEN 'RFID Card'
    ELSE 'Online Payment'
  END as method,
  COUNT(*) as count,
  SUM(amount) as total
FROM payments
WHERE status IN ('Paid', 'completed')
GROUP BY method;

Result:
┌────────────────┬───────┬───────┐
│ method         │ count │ total │
├────────────────┼───────┼───────┤
│ RFID Card      │ 2     │ 400   │
│ Online Payment │ 1     │ 200   │
└────────────────┴───────┴───────┘
```

### Recent Transactions
```sql
SELECT 
  transaction_id,
  amount,
  CASE WHEN phone_number LIKE 'RFID:%' 
       THEN SUBSTR(phone_number, 6) 
       ELSE phone_number 
  END as identifier,
  status,
  paid_at
FROM payments
ORDER BY paid_at DESC
LIMIT 10;
```

## ✅ Verification Checklist

After payments, verify:

- [ ] **payments table**: Has new record
- [ ] **rfid_cards table**: Balance decreased (if RFID)
- [ ] **toilets table**: Revenue increased
- [ ] **sensor_events table**: Payment logged with details
- [ ] **consumed flag**: Set to 1 after door trigger
- [ ] **status**: "Paid" for RFID, "completed" for online
- [ ] **paid_at**: Timestamp is correct
- [ ] **transaction_id**: Unique identifier set

## 🧪 Quick Test Commands

```bash
# Check recent payments
mysql -u root -pfiacre2001 "smart public toilet" \
  -e "SELECT * FROM payments ORDER BY id DESC LIMIT 5"

# Check revenue
mysql -u root -pfiacre2001 "smart public toilet" \
  -e "SELECT id, location, revenue FROM toilets"

# Check card balances
mysql -u root -pfiacre2001 "smart public toilet" \
  -e "SELECT uid, balance FROM rfid_cards"

# Check payment events
mysql -u root -pfiacre2001 "smart public toilet" \
  -e "SELECT event_type, details FROM sensor_events \
       WHERE event_type IN ('payment', 'rfid_tap') \
       ORDER BY id DESC LIMIT 10"
```

---

**Payment System Status**: ✅ FULLY FUNCTIONAL
- RFID payments: Working
- Online payments: Working
- Database tracking: Complete
- Door triggering: Automatic
- Event logging: Real-time
