// Fix dashboard scrolling by reducing padding and spacing
const fs = require('fs');

// Read the current style.css file
fs.readFile('style.css', 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        return;
    }

    // Reduce padding and spacing to fit content in viewport
    let fixedContent = data
        .replace(/\.page\{display:none;padding:32px;\}/g, '.page{display:none;padding:20px;}')
        .replace(/\.card\{background:white;border-radius:var\(--radius\);padding:24px;/g, '.card{background:white;border-radius:var(--radius);padding:16px;')
        .replace(/\.stat-card\{background:white;border-radius:var\(--radius\);padding:22px;/g, '.stat-card{background:white;border-radius:var(--radius);padding:16px;')
        .replace(/\.grid-2\{display:grid;grid-template-columns:1fr 1fr;gap:20px;\}/g, '.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}')
        .replace(/\.grid-4\{display:grid;grid-template-columns:repeat\(4,1fr\);gap:16px;\}/g, '.grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}');

    // Write the fixed content back
    fs.writeFile('style.css', fixedContent, 'utf8', (err) => {
        if (err) {
            console.error('Error writing file:', err);
            return;
        }
        console.log('Dashboard scrolling fixed! Reduced padding and spacing to fit viewport.');
    });
});
