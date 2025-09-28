// Test script for private key authentication
const fetch = require('node-fetch').default || require('node-fetch');

async function testPrivateKeyAuth() {
  console.log('🧪 Testing Private Key Authentication System');
  console.log('='.repeat(50));
  
  // Test private key (32 bytes in hex)
  const testPrivateKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  
  console.log('\n1. Testing Private Key Login...');
  try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ privateKey: testPrivateKey }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Private Key Login Success!');
      console.log('👤 User Created/Logged In:');
      console.log(`   - ID: ${data.user.id}`);
      console.log(`   - Username: ${data.user.username}`);
      console.log(`   - Public Key: ${data.user.public_key ? data.user.public_key.slice(0, 20) + '...' : 'N/A'}`);
      console.log(`   - Seller Address: ${data.user.seller_address ? data.user.seller_address.slice(0, 20) + '...' : 'N/A'}`);
      console.log(`   - Active Channel: ${data.user.active_channel ? 'Yes' : 'No'}`);
    } else {
      console.log('❌ Private Key Login Failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Network Error:', error.message);
  }
  
  console.log('\n2. Testing Invalid Private Key...');
  try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ privateKey: 'invalid_key' }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.log('✅ Invalid Private Key Rejected:', data.error);
    } else {
      console.log('❌ Invalid Private Key Accepted (Should Not Happen)');
    }
  } catch (error) {
    console.log('❌ Network Error:', error.message);
  }
  
  console.log('\n3. Testing Registration Endpoint...');
  try {
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'test@test.com', username: 'test', password: 'password' }),
    });
    
    const data = await response.json();
    console.log('📝 Registration Response:', data.message || data.info);
  } catch (error) {
    console.log('❌ Network Error:', error.message);
  }
  
  console.log('\n='.repeat(50));
  console.log('🎉 Testing Complete!');
}

// Run the test
testPrivateKeyAuth().catch(console.error);