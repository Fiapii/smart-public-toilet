# Smart Public Toilet System - Updated Workflow

## Overview
The system now supports **two payment methods** that both trigger door opening (SERVO 1):
1. **RFID Card** - Virtual money managed by owner
2. **Online Payment** - Real money via PayPack

---

## How It Works

### 1. RFID Card Payment Flow

#### Step 1: New Card Detected (First Tap)
```
User taps new card → 
ESP32 sends UID to /api/hardware/rfid-tap → 
Server AUTO-REGISTERS card with 0 balance →
Returns DENY + "is_new_card": true →
ESP32 shows denial (blue LED flash)
```

#### Step 2: Owner Adds Balance
```
Dashboard shows new card in RFID Cards list →
Owner taps "Add Balance" button →
Updates card balance via /api/rfid/cards/:id
```

#### Step 3: Authorized Payment (Subsequent Taps)
```
User taps card with balance ≥ 100 RWF →
ESP32 sends UID to /api/hardware/rfid-tap →
Server checks balance →
If balance sufficient:
  - Deducts 100 RWF
  - Returns { command: "OPEN_DOOR" }
  - ESP32 sets systemArmed = true and opens SERVO 1 (door)
  - Logs payment to dashboard
Else:
  - Returns DENY + insufficient balance message
```

---

### 2. Online Payment Flow

#### Step 1: User Initiates Payment
```
Web UI (/index.html) →
User enters phone number →
Clicks "Initiate Payment" →
Calls /api/payments/create
```

#### Step 2: Payment Confirmation
```
PayPack sends prompt to phone →
User enters PIN →
PayPack confirms payment →
Database marked as "completed"
```

#### Step 3: ESP32 Polls for Payment
```
ESP32 checks /api/hardware/payment-check/:toilet_id every 2 seconds →
Server finds completed, unconsumed payment →
Returns { command: "OPEN_DOOR" } →
Marks payment as consumed (consumed=1) →
ESP32 sets systemArmed = true and opens SERVO 1 (door)
```

---

### 3. Interior Movement Detection

#### After Door Opens (systemArmed = true):

**Ultrasonic Sensor 2 (Lid):**
```
Person sits down (distance ≤ 4cm) →
SERVO 2 opens (lid_open event) →
After 10 seconds →
Pump starts (flush for 3 seconds) →
SERVO 2 closes (lid_close event)
```

**Ultrasonic Sensor 1 (Exit):**
```
Person approaches door from inside (distance ≤ 6cm) →
SERVO 1 opens (door_open event) →
Stays open 3 seconds →
SERVO 1 closes (door_close event)
```

---

## Database Changes Required

### For New Installations:
- Run `schema.sql` (already updated with `consumed` column)

### For Existing Databases:
Run the migration:
```bash
mysql -u <user> -p < database/migrations/add_consumed_to_payments.sql
```

Or manually execute:
```sql
ALTER TABLE `payments` ADD COLUMN `consumed` BOOLEAN DEFAULT FALSE AFTER `paid_at`;
```

---

## New API Endpoints

### ESP32 → Server Communication

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/api/hardware/rfid-tap` | POST | Card tap event | `{command: "OPEN_DOOR"\|"DENY", message, ...}` |
| `/api/hardware/payment-check/:toilet_id` | GET | Poll for payment trigger | `{command: "OPEN_DOOR"\|"DENY", ...}` |
| `/api/hardware/log-event` | POST | Log door/lid/flush events | `{success: true}` |

### Dashboard/Owner → Server Communication

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/payments/create` | POST | Initiate payment via PayPack |
| `/api/payments/status/:transaction_id` | GET | Check payment status |
| `/api/rfid/cards` | GET | List all RFID cards (with auth) |
| `/api/rfid/cards/:id` | PUT | Top up / update card balance (with auth) |

---

## ESP32 Firmware Updates

### New Features:
1. **Auto HTTP Error Handling**: Only parses 2xx JSON responses
2. **Payment Polling**: Checks for pending payments every 2 seconds
3. **Both Payment Methods**: Now handles RFID + online payments
4. **Event Logging**: Logs all state changes to dashboard

### Configuration (in ESP32 code):
```cpp
const char* WIFI_SSID      = "Fiacre";
const char* WIFI_PASSWORD  = "0012345678";
const char* SERVER_IP      = "192.168.126.25";    // Your PC IP
const int   SERVER_PORT    = 5000;
const int   TOILET_ID      = 1;
```

---

## Dashboard Features for Owner

### RFID Card Management:
- **New Cards**: Listed automatically when first detected
- **Add Balance**: Top-up cards from dashboard
- **View History**: See all taps and payment history
- **Disable Card**: Deactivate lost cards

### Payment History:
- **Card Payments**: All RFID transactions logged
- **Online Payments**: All PayPack transactions tracked
- **Revenue**: Total earned from both payment methods

### Real-Time Events:
- New card registration alerts
- Payment confirmations
- Door/lid movements
- Sensor readings

---

## Troubleshooting

### Issue: ESP32 shows "JSON parse error"
**Solution**: Server fixed to only parse successful (2xx) responses

### Issue: New card not showing in dashboard
**Solution**: 
1. Check `/api/rfid/cards` endpoint returns new card
2. Ensure database migration is applied
3. Verify toilet_id in ESP32 matches database

### Issue: Payment doesn't trigger door
**Solution**:
1. Check payment status: `/api/payments/status/:transaction_id`
2. Ensure payment status is "completed" not "pending"
3. Verify ESP32 is polling `/api/hardware/payment-check/:toilet_id`
4. Check server logs for errors

### Issue: Card balance not deducted
**Solution**:
1. Ensure balance ≥ 100 RWF
2. Check card `is_active = 1` in database
3. Verify card UID matches exactly (case-insensitive but trimmed)

---

## Quick Start Checklist

- [ ] Update schema or run migration on existing database
- [ ] Restart Node.js server
- [ ] Upload new ESP32 firmware
- [ ] Configure WiFi credentials in ESP32
- [ ] Configure SERVER_IP and TOILET_ID in ESP32
- [ ] Test: Tap new card (should register with 0 balance)
- [ ] Test: Owner adds balance via dashboard
- [ ] Test: Tap card again (should open door)
- [ ] Test: Payment via web UI (should open door)
- [ ] Test: Interior sensors (lid opens, exit detects)
