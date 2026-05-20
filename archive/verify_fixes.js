const fs = require('fs');
const html = fs.readFileSync('interface.html', 'utf8');
const adminRoutes = fs.readFileSync('routes/adminRoutes.js', 'utf8');
const ownerRoutes = fs.readFileSync('routes/ownerRoutes.js', 'utf8');

const pass = (label) => console.log('  ✅ PASS:', label);
const fail = (label) => console.log('  ❌ FAIL:', label);
const check = (label, condition) => condition ? pass(label) : fail(label);

console.log('\n=== BACKEND FIXES ===');
check('adminRoutes has GET /dashboard route',   adminRoutes.includes("router.get('/dashboard'"));
check('adminRoutes imports getAdminDashboard',  adminRoutes.includes('getAdminDashboard'));
check('ownerRoutes has POST /toilets',          ownerRoutes.includes("router.post('/toilets'"));

console.log('\n=== HTML STRUCTURE FIXES ===');
check('#superNav wrapper div exists',           html.includes('id="superNav"'));
check('chatHeaderName ID on header element',    html.includes('id="chatHeaderName"'));
check('chatHeaderRole ID on header element',    html.includes('id="chatHeaderRole"'));
check('chatHeaderAvatar ID on avatar',          html.includes('id="chatHeaderAvatar"'));
check('superTotalOwners ID on stat card',       html.includes('id="superTotalOwners"'));
check('superTotalToilets ID on stat card',      html.includes('id="superTotalToilets"'));
check('superTotalRev ID on stat card',          html.includes('id="superTotalRev"'));
check('superTotalCleaners ID on stat card',     html.includes('id="superTotalCleaners"'));

console.log('\n=== JS DEDUPLICATION FIXES ===');
const setRoleCount      = (html.match(/function setRole/g)       || []).length;
const showPageCount     = (html.match(/function showPage/g)      || []).length;
const ownerDashCount    = (html.match(/function loadOwnerDashboard/g) || []).length;
check('setRole() defined exactly once',         setRoleCount === 1);
check('showPage() defined exactly once',        showPageCount === 1);
check('loadOwnerDashboard() defined once',      ownerDashCount === 1);

console.log('\n=== CHAT LOGIC FIXES ===');
check('No broken .chat-window selector',        !html.includes('chat-window .chat-header-info'));
check('No broken .chat-window .chat-header',    !html.includes('chat-window .chat-header .avatar'));
check('selectChatContact passes role to refresh', html.includes('selectChatContact(currentChatUserId, currentChatUserRole)'));
check('No broken .btn-primary send selector',   !html.includes('btn-primary[onclick'));
check('prepareEditMessage uses .send-btn',      html.includes("querySelector('.send-btn')"));
check('chat polling interval declared',         html.includes('chatInterval = setInterval'));
check('superDash loads admin dashboard',        html.includes("page === 'superDash'") && html.includes('loadAdminDashboard'));
check('deleteMessage refreshes history only',   html.includes("'Delete this message?'") && !html.includes('loadChat(); // Refresh\r\n'));
check('Inline nav in selectChatContact',        html.includes("page-chat') && chatPageEl)"));

console.log('');
