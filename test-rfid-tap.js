#!/usr/bin/env node
/**
 * Test RFID Tap Endpoint
 * Simulates ESP32 tapping an RFID card
 */

const http = require('http');

function testRfidTap(uid, toiletId) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      uid: uid,
      toilet_id: toiletId
    });

    const options = {
      hostname: '192.168.1.105',
      port: 5000,
      path: '/api/hardware/rfid-tap',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: JSON.parse(data)
        });
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing RFID Payment System\n');
  console.log('📍 Server: http://192.168.1.105:5000');
  console.log('🚽 Toilet ID: 1\n');

  // Test 1: Valid card with sufficient balance
  console.log('Test 1: Valid card (29 67 1C 06) with RWF 5000 balance');
  console.log('-'.repeat(50));
  try {
    const result = await testRfidTap('29 67 1C 06', 1);
    console.log('✅ Status:', result.statusCode);
    console.log('📋 Response:', JSON.stringify(result.data, null, 2));
    console.log();
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log();
  }

  // Test 2: Another valid card
  console.log('Test 2: Valid card (AA BB CC DD) with RWF 10000 balance');
  console.log('-'.repeat(50));
  try {
    const result = await testRfidTap('AA BB CC DD', 1);
    console.log('✅ Status:', result.statusCode);
    console.log('📋 Response:', JSON.stringify(result.data, null, 2));
    console.log();
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log();
  }

  // Test 3: Card with low balance
  console.log('Test 3: Card with low balance (11 22 33 44) - RWF 2000 (needs RWF 200)');
  console.log('-'.repeat(50));
  try {
    const result = await testRfidTap('11 22 33 44', 2);
    console.log('✅ Status:', result.statusCode);
    console.log('📋 Response:', JSON.stringify(result.data, null, 2));
    console.log();
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log();
  }

  // Test 4: Unknown card (should auto-register)
  console.log('Test 4: Unknown card (NEW CARD) - should auto-register');
  console.log('-'.repeat(50));
  try {
    const result = await testRfidTap('FF FF FF FF', 1);
    console.log('✅ Status:', result.statusCode);
    console.log('📋 Response:', JSON.stringify(result.data, null, 2));
    console.log();
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log();
  }

  console.log('✨ All tests completed!\n');
  console.log('📊 Next Steps:');
  console.log('  1. Check database for payments table - should have new records');
  console.log('  2. Check rfid_cards table - balances should be updated');
  console.log('  3. Check sensor_events table - should log all tap events');
  console.log('  4. ESP32 should receive OPEN_DOOR command for valid payments');
}

runTests().catch(console.error);
