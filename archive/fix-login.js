// Fix login form issues by removing email validation blocks
const fs = require('fs');

// Read the current interface.html file
fs.readFile('interface.html', 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        return;
    }

    // Remove all email validation that blocks login with demo credentials
    let fixedContent = data
        .replace(/if\s*\(!email\.toLowerCase\(\)\.endsWith\('@gmail\.com'\)\)\s*\{\s*return alert\('Only @gmail\.com emails are accepted\.'\);\s*\}/g, '')
        .replace(/if\s*\(!email\.toLowerCase\(\)\.endsWith\('@gmail\.com'\)\)\s*\{\s*return alert\("Please enter a valid @gmail\.com address\."\);\s*\}/g, '');

    // Write the fixed content back
    fs.writeFile('interface.html', fixedContent, 'utf8', (err) => {
        if (err) {
            console.error('Error writing file:', err);
            return;
        }
        console.log('Login form email validation blocks removed successfully!');
    });
});
