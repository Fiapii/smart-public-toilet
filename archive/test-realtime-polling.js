const axios = require('axios');

const API_BASE = 'http://localhost:8081/api';

async function testRealTimePolling() {
  try {
    console.log('Testing Real-Time Message Polling...\n');

    // Step 1: Login as Owner
    console.log('1. Logging in as Owner...');
    const ownerLogin = await axios.post(`${API_BASE}/auth/login`, {
      email: 'owner1@gmail.com',
      password: 'password123'
    });
    const ownerToken = ownerLogin.data.token;
    console.log('✓ Owner logged in successfully');

    // Step 2: Get Owner's Admin
    console.log('\n2. Getting Owner\'s Admin contact...');
    const ownerAdmins = await axios.get(`${API_BASE}/owner/admins`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const admin = ownerAdmins.data[0];
    console.log('✓ Found admin:', admin.name);

    // Step 3: Login as Admin
    console.log('\n3. Logging in as Admin...');
    const adminLogin = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@gmail.com', // Use the correct admin email from seed data
      password: 'password123'
    });
    const adminToken = adminLogin.data.token;
    console.log('✓ Admin logged in successfully');

    // Step 4: Get initial message count
    console.log('\n4. Getting initial message count...');
    const initialHistory = await axios.get(`${API_BASE}/chats/history/${admin.id}?otherRole=Admin`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const initialCount = initialHistory.data.length;
    console.log('✓ Initial message count:', initialCount);

    // Step 5: Simulate polling - check messages every 2 seconds
    console.log('\n5. Starting polling simulation (checking every 2 seconds)...');
    let pollCount = 0;
    const maxPolls = 5;
    
    const pollInterval = setInterval(async () => {
      pollCount++;
      console.log(`\n--- Poll #${pollCount} ---`);
      
      try {
        // Check for new messages
        const currentHistory = await axios.get(`${API_BASE}/chats/history/${admin.id}?otherRole=Admin`, {
          headers: { Authorization: `Bearer ${ownerToken}` }
        });
        
        const currentCount = currentHistory.data.length;
        console.log(`Current message count: ${currentCount}`);
        
        if (currentCount > initialCount) {
          console.log('🔔 NEW MESSAGE DETECTED!');
          const newMessage = currentHistory.data[currentCount.data.length - 1];
          console.log('New message details:');
          console.log('- From:', newMessage.sender_role);
          console.log('- To:', newMessage.receiver_role);
          console.log('- Message:', newMessage.message);
          console.log('- Time:', newMessage.timestamp);
          console.log('- Should appear on: LEFT (received by Owner)');
          console.log('- CSS class: bubble-in');
          
          // Stop polling after detecting new message
          clearInterval(pollInterval);
          console.log('\n✅ Real-time polling test completed successfully!');
          return;
        } else {
          console.log('No new messages...');
        }
        
        // If this is the 3rd poll, send a test message from Admin to trigger detection
        if (pollCount === 3) {
          console.log('Sending test message from Admin to Owner...');
          await axios.post(`${API_BASE}/chats/send`, {
            receiver_id: ownerLogin.data.user?.id || 1,
            receiver_role: 'Owner',
            message: 'This is a test message from Admin during polling!'
          }, {
            headers: { Authorization: `Bearer ${adminToken}` }
          });
          console.log('✓ Test message sent');
        }
        
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          console.log('\n⏰ Polling completed - max polls reached');
        }
        
      } catch (error) {
        console.error('Polling error:', error.message);
      }
    }, 2000); // Poll every 2 seconds

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testRealTimePolling();
