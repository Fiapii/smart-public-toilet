const QRCode = require('qrcode');

// The URL for the client interface - adjust if your server runs on a different port or IP
const CLIENT_URL = 'http://localhost:5000/client.html';

async function generateQRCode() {
  try {
    console.log(`Generating QR code for: ${CLIENT_URL}`);
    
    // Generate QR code as a terminal output
    const qrString = await QRCode.toString(CLIENT_URL, { type: 'terminal' });
    console.log('\n' + qrString);
    
    // Save QR code as an image file
    await QRCode.toFile('client-qr-code.png', CLIENT_URL, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    console.log('\n✅ QR code saved as: client-qr-code.png');
    console.log(`📱 Scan this QR code to access: ${CLIENT_URL}`);
    console.log('💡 You can also open the image file to scan it with your phone camera');
    
  } catch (error) {
    console.error('Error generating QR code:', error);
  }
}

generateQRCode();
