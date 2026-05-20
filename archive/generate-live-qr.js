const fs = require('fs');
const https = require('https');
const path = require('path');

// Read command line arguments for the URL
const args = process.argv.slice(2);
let targetUrl = args[0];

if (!targetUrl) {
  console.log('⚠️  No URL provided. Usage: node archive/generate-live-qr.js <your_railway_url>');
  console.log('Using default placeholder for demonstration...');
  targetUrl = 'https://prolific-insight-production.up.railway.app/';
}

// Make sure the URL directs to index.html (or root which serves index.html)
if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
  targetUrl = 'https://' + targetUrl;
}

console.log(`🚀 Generating a high-quality, scannable QR Code for: ${targetUrl}`);

// Clean URL for QR server parameter
const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=10&data=${encodeURIComponent(targetUrl)}`;

const outputFilePath = path.join(__dirname, '../toilet-qr-code.png');

console.log('⏳ Downloading QR code from generator API...');

https.get(qrApiUrl, (res) => {
  if (res.statusCode !== 200) {
    console.error(`❌ Failed to generate QR Code. Status Code: ${res.statusCode}`);
    return;
  }

  const fileStream = fs.createWriteStream(outputFilePath);
  res.pipe(fileStream);

  fileStream.on('finish', () => {
    fileStream.close();
    console.log('\n======================================================');
    console.log('🎉 SUCCESS! YOUR QR CODE HAS BEEN GENERATED!');
    console.log('======================================================');
    console.log(`💾 Saved to your project folder as: toilet-qr-code.png`);
    console.log(`🔗 Scannable URL: ${targetUrl}`);
    console.log('\n💡 You can print this image and paste it on the toilet door.');
    console.log('   Users can scan it to instantly open the pay page on their phones!');
    console.log('======================================================\n');
  });
}).on('error', (err) => {
  console.error('❌ Network error generating QR Code:', err.message);
});
