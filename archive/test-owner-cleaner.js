const axios = require('axios');

const API_BASE = 'http://localhost:8081/api';

async function testOwnerToCleaner() {
  try {
    console.log('Testing Owner to Cleaner messaging...\n');

    // Step 1: Login as Owner
    console.log('1. Logging in as Owner...');
    const ownerLogin = await axios.post(`${API_BASE}/auth/login`, {
      email: 'owner1@gmail.com',
      password: 'password123'
    });
    const ownerToken = ownerLogin.data.token;
    console.log('✓ Owner logged in successfully, ID:', ownerLogin.data.user?.id || 'Unknown');

    // Step 2: Get Owner's Cleaners
    console.log('\n2. Getting Owner\'s Cleaners...');
    const ownerCleaners = await axios.get(`${API_BASE}/owner/cleaners`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    console.log('✓ Found cleaners:', ownerCleaners.data.length);
    
    if (ownerCleaners.data.length === 0) {
      console.log('❌ No cleaners found for this owner');
      return;
    }

    const cleaner = ownerCleaners.data[0];
    console.log('Selected cleaner:', cleaner.name, 'ID:', cleaner.id);

    // Step 3: Owner sends message to Cleaner
    console.log('\n3. Owner sending message to Cleaner...');
    const message = await axios.post(`${API_BASE}/chats/send`, {
      receiver_id: cleaner.id,
      receiver_role: 'Cleaner',
      message: 'Please clean toilet #1, it needs maintenance.'
    }, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    console.log('✓ Message sent successfully');

    // Step 4: Login as Cleaner
    console.log('\n4. Logging in as Cleaner...');
    const cleanerLogin = await axios.post(`${API_BASE}/auth/login`, {
      email: 'cleaner1_1@gmail.com',
      password: 'password123'
    });
    const cleanerToken = cleanerLogin.data.token;
    console.log('✓ Cleaner logged in successfully, ID:', cleanerLogin.data.user?.id || 'Unknown');

    // Step 5: Cleaner gets chat history with Owner
    console.log('\n5. Cleaner retrieving chat history...');
    const ownerId = ownerLogin.data.user?.id || 1; // Fallback to ID 1 if undefined
    const cleanerHistory = await axios.get(`${API_BASE}/chats/history/${ownerId}?otherRole=Owner`, {
      headers: { Authorization: `Bearer ${cleanerToken}` }
    });
    console.log('✓ Chat history retrieved');
    console.log('Messages:', cleanerHistory.data.length);
    
    if (cleanerHistory.data.length > 0) {
      const lastMessage = cleanerHistory.data[cleanerHistory.data.length - 1];
      console.log('\nLast message details:');
      console.log('- From:', lastMessage.sender_role, 'ID:', lastMessage.sender_id);
      console.log('- To:', lastMessage.receiver_role, 'ID:', lastMessage.receiver_id);
      console.log('- Message:', lastMessage.message);
      console.log('- Time:', lastMessage.timestamp);
      
      // Verify message positioning logic for Cleaner's view
      const isFromOwner = lastMessage.sender_role === 'Owner';
      console.log('\nMessage positioning test (Cleaner\'s view):');
      console.log('- Should appear on:', isFromOwner ? 'LEFT (received by Cleaner)' : 'RIGHT (sent by Cleaner)');
      console.log('- CSS class should be:', isFromOwner ? 'bubble-in' : 'bubble-out');
      
      // Verify the message flow is correct
      const expectedFrom = 'Owner';
      const expectedTo = 'Cleaner';
      const actualFrom = lastMessage.sender_role;
      const actualTo = lastMessage.receiver_role;
      
      console.log('\nMessage flow verification:');
      console.log('- Expected: Owner → Cleaner');
      console.log('- Actual:', actualFrom, '→', actualTo);
      console.log('- Result:', actualFrom === expectedFrom && actualTo === expectedTo ? '✅ CORRECT' : '❌ INCORRECT');
    }

    console.log('\n✅ Owner to Cleaner messaging test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testOwnerToCleaner();
