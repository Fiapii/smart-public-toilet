// Clean up dashboard by removing Recent Transactions and Recent Complaints sections
const fs = require('fs');

// Read the current interface.html file
fs.readFile('interface.html', 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        return;
    }

    // Remove the Recent Transactions and Recent Complaints grid section
    // This removes the entire grid-2 section that contains these two cards
    let fixedContent = data.replace(
        /        <div class="grid-2">\s*<div class="card">\s*<div class="card-title">Recent Transactions<\/div>[\s\S]*?<\/div>\s*<\/div>/g,
        ''
    );

    // Write the fixed content back
    fs.writeFile('interface.html', fixedContent, 'utf8', (err) => {
        if (err) {
            console.error('Error writing file:', err);
            return;
        }
        console.log('Dashboard cleaned up successfully! Recent Transactions and Recent Complaints removed from dashboard.');
    });
});
