# ✅ PAYMENT FLOW - COMPLETE VERIFICATION CHECKLIST

## Your Payment Just Worked! Here's Proof:

**What happened with your manual fix:**
1. ✅ Payment marked as completed in database
2. ✅ Revenue updated (+100 RWF)
3. ✅ Occupancy marked (is_occupied = 1)
4. ✅ Money appeared on dashboard

---

## Next Payment - Step-by-Step Flow (What SHOULD Happen):

### STEP 1: Customer Opens App
```
✅ Frontend loads /index.html
✅ Fetches toilet status from /api/public/toilets
✅ Shows "🟢 Toilet Free" (if is_occupied = 0)
✅ "💳 Pay to Enter" button is enabled
```

**What to check:**
- Button is clickable
- Toilet status shows correctly

---

### STEP 2: Customer Clicks Pay Button
```
✅ Modal opens: "Enter Phone Number"
✅ Customer enters phone (078xxxxxxx)
✅ Clicks "Initiate Payment"
```

**What to check:**
- Modal appears
- Phone input works
- Button submits form

---

### STEP 3: Backend Creates Payment Record
```
✅ POST /api/payments/create receives request
✅ Database: INSERT INTO payments
   - toilet_id = 1
   - amount = 100
   - phone_number = 250781234567 (normalized)
   - status = "pending"
   - transaction_id = (from PayPack)

✅ Response includes:
   {
     "success": true,
     "transaction_id": "5221d922...",
     "message": "Payment initiated"
   }
```

**What to check in logs:**
```
[LOG] Initiating PayPack payment: {phone_number, amount}
[LOG] PayPack response: {ref, status}
```

---

### STEP 4: Frontend Polls Payment Status (Every 2 Seconds)
```
✅ GET /api/payments/status/{transaction_id}
✅ Frontend shows: "Waiting for your confirmation on phone..."
✅ Customer enters PIN on their phone
```

**What to check:**
- Modal shows loading spinner
- Message updates in real-time

---

### STEP 5: Backend Confirms Payment
```
✅ PayPack returns: status = "successful"

✅ Database updates:
   - UPDATE payments SET status = "completed"
   - UPDATE payments SET paid_at = NOW()
   - UPDATE toilets SET revenue = revenue + 100
   - UPDATE toilets SET is_occupied = 1
   
✅ Event logged to sensor_events:
   - event_type = "payment"
   - details = "Online payment confirmed: RWF 100"

✅ SSE broadcasts payment event to dashboard
```

**What to check in database:**
```sql
-- Payment should show:
SELECT * FROM payments WHERE transaction_id = 'YOUR_TXN_ID';
-- Should show: status = "completed", paid_at = NOW()

-- Toilet should show:
SELECT revenue, is_occupied FROM toilets WHERE id = 1;
-- Should show: revenue increased, is_occupied = 1
```

---

### STEP 6: Frontend Gets Success Response
```
✅ Response from checkPaymentStatus:
   {
     "success": true,
     "status": "successful",
     "command": "OPEN_DOOR",
     "message": "Payment confirmed! Door is opening...",
     "transaction_id": "5221d922...",
     "amount": 100,
     "toilet_id": 1
   }

✅ Frontend shows: "✅ DOOR OPENING!"
✅ Frontend closes modal after 10 seconds
```

**What to check:**
- Modal shows success message
- "DOOR OPENING" message appears
- Modal auto-closes

---

### STEP 7: Dashboard Auto-Refreshes (SSE + Auto-Refresh)
```
✅ Dashboard listens to SSE events
✅ Receives: event_type = "payment"
✅ Calls loadOwnerDashboard()
✅ Dashboard updates:
   - Total Revenue: +100 RWF ✅
   - Toilet Status: OCCUPIED ✅
   - Transaction logged
```

**What to check on dashboard:**
- Revenue increases by 100
- Occupancy status shows as occupied
- Payment event appears in event log

---

### STEP 8: ESP32 Receives Door Command
```
✅ ESP32 polls: GET /api/hardware/payment-check/1 (every 2 seconds)

✅ Backend returns:
   {
     "command": "OPEN_DOOR",
     "message": "Payment accepted! RWF 100 charged",
     "transaction_id": "5221d922...",
     "amount": 100
   }

✅ ESP32 processes:
   - Opens door: servo 0° → 90°
   - Holds open: 10 seconds
   - Closes door: servo 90° → 0°
```

**What to check:**
- ESP32 serial output: "💻 ONLINE PAYMENT CONFIRMED"
- ESP32 serial output: "🚪 DOOR opening..."
- Physical door opens and closes

---

### STEP 9: Customer Enters Toilet
```
✅ Door is open for customer entry
✅ Toilet marked as OCCUPIED
✅ Revenue is recorded
```

---

### STEP 10: Customer Exits
```
✅ Customer presses button or crosses exit sensor
✅ Door opens again for 10 seconds
✅ Door closes
✅ Occupancy set to 0 (is_occupied = FALSE)
```

---

## Complete Flow Diagram

```
Customer enters phone
        ↓
POST /api/payments/create
        ↓
Database: INSERT payment (status=pending)
PayPack: Initiates payment
        ↓
Frontend polls every 2 seconds
        ↓
Customer enters PIN
        ↓
PayPack confirms: status=successful
        ↓
GET /api/payments/status/{txn_id}
        ↓
Database updates:
  - status = "completed"
  - revenue += 100
  - is_occupied = 1
        ↓
Response: "command": "OPEN_DOOR"
        ↓
[SPLIT] Frontend                    [SPLIT] ESP32
  ↓                                    ↓
Shows success                    Polls payment-check
Dashboard refreshes             Receives OPEN_DOOR
Revenue updates                 Opens door
                                       ↓
                                Customer enters
```

---

## Testing Checklist for Next Payment

### Before Payment:
- [ ] Backend running: `npm start`
- [ ] ESP32 connected to WiFi (SSID: Fiacre)
- [ ] ESP32 serial monitor open (115200 baud)
- [ ] Database accessible

### During Payment:
- [ ] Phone receives PayPack PIN prompt
- [ ] Customer enters PIN
- [ ] Frontend shows "Waiting for confirmation..."
- [ ] Modal shows "DOOR OPENING" within 10 seconds

### After Payment (Frontend):
- [ ] Dashboard shows +100 RWF revenue ✅
- [ ] Dashboard shows occupancy = OCCUPIED ✅
- [ ] Payment event appears in event log ✅

### After Payment (ESP32):
- [ ] Serial shows: "💻 ONLINE PAYMENT CONFIRMED"
- [ ] Serial shows: "🚪 DOOR opening..."
- [ ] Door servo moves 0° → 90° → back to 0°
- [ ] Door physically opens for 10 seconds

### After Payment (Database):
```sql
-- Check payment
SELECT status, amount, paid_at FROM payments 
WHERE toilet_id = 1 ORDER BY created_at DESC LIMIT 1;
-- Should show: status = "completed", paid_at = NOW()

-- Check revenue
SELECT revenue FROM toilets WHERE id = 1;
-- Should show: increased by 100

-- Check occupancy
SELECT is_occupied FROM toilets WHERE id = 1;
-- Should show: 1 (true)
```

---

## If Something Goes Wrong:

### Payment shows "failed" but money was deducted:
1. Use: `POST /api/payments/manual-confirm` endpoint
2. Or use the SQL fix from STUCK_PAYMENT_FIX.md

### Door doesn't open:
1. Check ESP32 serial for "ONLINE PAYMENT CONFIRMED"
2. If not there → ESP32 isn't receiving OPEN_DOOR command
3. Check: `GET /api/hardware/payment-check/1` manually
4. Verify toilet_id = 1 matches

### Dashboard doesn't show revenue:
1. Check: Payment status in database = "completed"
2. Check: Revenue in database was updated
3. Refresh dashboard (F5)
4. If still blank → Check browser DevTools Console for errors

### No "DOOR OPENING" message:
1. Check: Frontend got success response
2. Check: Transaction ID is correct
3. Manually test: `GET /api/payments/status/{txn_id}`

---

## Code Verification (What's Already Fixed):

✅ **Payment Creation:**
- Sets status = "pending"
- Normalizes phone number
- Gets transaction_id from PayPack

✅ **Payment Confirmation:**
- Updates status = "completed"
- Updates revenue += amount
- Updates is_occupied = 1
- Returns "command": "OPEN_DOOR"

✅ **Door Opening:**
- ESP32 polls /api/hardware/payment-check/{toilet_id}
- Receives OPEN_DOOR command
- Opens door 0° → 90° → 0°

✅ **Dashboard Updates:**
- SSE listens for payment events
- Auto-refresh every 10 seconds
- Shows revenue and occupancy

✅ **Error Recovery:**
- Manual confirmation endpoint available
- PayPack status mapping improved
- Debug logging enabled

---

## Key Points:

1. **Every step is logged** → Check backend logs for errors
2. **Multiple verification points** → Can debug at each step
3. **Manual recovery available** → Can fix stuck payments
4. **Auto-recovery on dashboard** → Refreshes even without SSE

---

## Ready to Test?

1. ✅ Deploy updated code to Render (auto-deploys in 1-2 min)
2. ✅ Try a new payment
3. ✅ Follow checklist above
4. ✅ Check all steps complete
5. ✅ Money appears + Door opens = SUCCESS! 🚪

Let me know if ANY step fails and I'll debug it!
