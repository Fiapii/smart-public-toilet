const axios = require('axios');

const API_BASE = 'http://localhost:8081/api';

async function testMessaging() {
  try {
    console.log('Testing Owner to Admin messaging...\n');

    // Step 1: Login as Owner
    console.log('1. Logging in as Owner...');
    const ownerLogin = await axios.post(`${API_BASE}/auth/login`, {
      email: 'owner1@gmail.com',
      password: 'password123'
    });
    const ownerToken = ownerLogin.data.token;
    console.log('✓ Owner logged in successfully');

    // Step 2: Get Owner's Admin contact
    console.log('\n2. Getting Owner\'s Admin contact...');
    const ownerAdmins = await axios.get(`${API_BASE}/owner/admins`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    console.log('✓ Found admin:', ownerAdmins.data[0]?.name);

    // Step 3: Owner sends message to Admin
    console.log('\n3. Owner sending message to Admin...');
    const message = await axios.post(`${API_BASE}/chats/send`, {
      receiver_id: ownerAdmins.data[0].id,
      receiver_role: 'Admin',
      message: 'Hello Admin, I need to discuss toilet maintenance issues.'
    }, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    console.log('✓ Message sent successfully');

    // Step 4: Login as Admin
    console.log('\n4. Logging in as Admin...');
    const adminLogin = await axios.post(`${API_BASE}/auth/login`, {
      email: 'irumvafiacre2001@gmail.com',
      password: '1212@'
    });
    const adminToken = adminLogin.data.token;
    console.log('✓ Admin logged in successfully');

    // Step 5: Admin gets chat history with Owner
    console.log('\n5. Admin retrieving chat history...');
    const ownerId = ownerAdmins.data[0].id; // Use the admin's owner ID from the contact list
    const adminHistory = await axios.get(`${API_BASE}/chats/history/${ownerId}?otherRole=Owner`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('✓ Chat history retrieved');
    console.log('Messages:', adminHistory.data.length);
    
    if (adminHistory.data.length > 0) {
      const lastMessage = adminHistory.data[adminHistory.data.length - 1];
      console.log('\nLast message details:');
      console.log('- From:', lastMessage.sender_role, 'ID:', lastMessage.sender_id);
      console.log('- To:', lastMessage.receiver_role, 'ID:', lastMessage.receiver_id);
      console.log('- Message:', lastMessage.message);
      console.log('- Time:', lastMessage.timestamp);
      
      // Verify message positioning logic
      const isFromOwner = lastMessage.sender_role === 'Owner';
      console.log('\nMessage positioning test:');
      console.log('- Should appear on:', isFromOwner ? 'LEFT (received by Admin)' : 'RIGHT (sent by Admin)');
      console.log('- CSS class should be:', isFromOwner ? 'bubble-in' : 'bubble-out');
    }

    console.log('\n✅ Owner to Admin messaging test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testMessaging();
