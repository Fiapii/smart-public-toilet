// Simple QR code generator using online API (no npm required)
const https = require('https');

const CLIENT_URL = 'http://localhost:8081/client.html';

function generateQRCode() {
  console.log(`Generating QR code for: ${CLIENT_URL}`);
  
  // Using Google Chart API for QR code generation
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(CLIENT_URL)}`;
  
  console.log('\n📱 QR Code URL (click to view and scan):');
  console.log(qrUrl);
  console.log('\n💡 Instructions:');
  console.log('1. Copy the URL above and paste it in your browser');
  console.log('2. Right-click on the QR code image and save it');
  console.log('3. Scan the saved QR code with your phone camera');
  console.log('\n🔗 Direct link to client.html:');
  console.log(CLIENT_URL);
}

generateQRCode();
