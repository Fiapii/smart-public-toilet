// API Configuration
const API_BASE = 'http://localhost:5000/api';

// State Management
let currentUser = null;
let authToken = null;

// Utility Functions
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// API Helper Functions
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken && { 'Authorization': `Bearer ${authToken}` })
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  } catch (error) {
    showToast(error.message, 'error');
    throw error;
  }
}

// Authentication Functions
async function login(email, password, role) {
  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, role })
    });

    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(currentUser));

    showToast('Login successful!');
    navigateToDashboard(role);
  } catch (error) {
    console.error('Login error:', error);
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  authToken = null;
  currentUser = null;

  document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
  document.getElementById('loginScreen').classList.add('active');
  showToast('Logged out successfully');
}

function navigateToDashboard(role) {
  document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));

  if (role === 'Admin') {
    document.getElementById('adminDashboard').classList.add('active');
    document.getElementById('adminName').textContent = currentUser.name;
    loadAdminDashboard();
  } else if (role === 'Owner') {
    document.getElementById('ownerDashboard').classList.add('active');
    document.getElementById('ownerName').textContent = currentUser.name;
    loadOwnerDashboard();
  } else if (role === 'Cleaner') {
    document.getElementById('cleanerDashboard').classList.add('active');
    document.getElementById('cleanerName').textContent = currentUser.name;
    loadCleanerDashboard();
  }
}

// Admin Dashboard Functions
async function loadAdminDashboard() {
  try {
    const data = await apiRequest('/admin/dashboard');
    
    document.getElementById('totalRevenue').textContent = `RWF ${data.totalRevenue.toLocaleString()}`;
    document.getElementById('totalToilets').textContent = data.totalToilets;
    document.getElementById('totalCleaners').textContent = data.totalCleaners;
    document.getElementById('totalOwners').textContent = data.totalOwners;

    loadOwnersTable(data.owners);
  } catch (error) {
    console.error('Error loading admin dashboard:', error);
  }
}

function loadOwnersTable(owners) {
  const tbody = document.querySelector('#ownersTable tbody');
  tbody.innerHTML = owners.map(owner => `
    <tr>
      <td>${owner.name}</td>
      <td>${owner.email}</td>
      <td>${owner.totalToilets || 0}</td>
      <td>RWF ${(owner.ownerRevenue || 0).toLocaleString()}</td>
      <td>${owner.cleanerCount || 0}</td>
      <td>
        <button class="btn btn-icon" onclick="deleteOwner(${owner.id})">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

async function addOwner(name, email, password) {
  try {
    await apiRequest('/admin/owners', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    showToast('Owner added successfully!');
    closeModal();
    loadAdminDashboard();
  } catch (error) {
    console.error('Error adding owner:', error);
  }
}

async function deleteOwner(id) {
  if (!confirm('Are you sure you want to delete this owner?')) return;
  
  try {
    await apiRequest(`/admin/owners/${id}`, { method: 'DELETE' });
    showToast('Owner deleted successfully!');
    loadAdminDashboard();
  } catch (error) {
    console.error('Error deleting owner:', error);
  }
}

// Owner Dashboard Functions
async function loadOwnerDashboard() {
  try {
    const data = await apiRequest('/owner/dashboard');
    
    document.getElementById('ownerRevenue').textContent = `RWF ${data.totalRevenue.toLocaleString()}`;
    document.getElementById('ownerToiletCount').textContent = data.toiletCount;
    document.getElementById('ownerCleanerCount').textContent = data.cleanerCount;

    loadOwnerToiletsTable(data.toilets);
  } catch (error) {
    console.error('Error loading owner dashboard:', error);
  }
}

function loadOwnerToiletsTable(toilets) {
  const tbody = document.querySelector('#ownerToiletsTable tbody');
  tbody.innerHTML = toilets.map(toilet => `
    <tr>
      <td>${toilet.location}</td>
      <td><span class="badge badge-${toilet.status === 'operational' ? 'success' : 'danger'}">${toilet.status}</span></td>
      <td>${toilet.cleaner_id || 'Not assigned'}</td>
      <td>${toilet.soap_level || 'N/A'}</td>
      <td>${toilet.smell_level || 'N/A'}</td>
      <td>
        <button class="btn btn-icon" onclick="deleteToilet(${toilet.id})">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

async function addToilet(location, cleanerId) {
  try {
    await apiRequest('/owner/toilet', {
      method: 'POST',
      body: JSON.stringify({ location, cleaner_id: cleanerId })
    });
    showToast('Toilet added successfully!');
    closeModal();
    loadOwnerDashboard();
  } catch (error) {
    console.error('Error adding toilet:', error);
  }
}

async function addCleaner(name, email, password) {
  try {
    await apiRequest('/owner/cleaners', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    showToast('Cleaner added successfully!');
    closeModal();
    loadOwnerDashboard();
  } catch (error) {
    console.error('Error adding cleaner:', error);
  }
}

async function loadOwnerCleaners() {
  try {
    const cleaners = await apiRequest('/owner/cleaners');
    return cleaners;
  } catch (error) {
    console.error('Error loading cleaners:', error);
    return [];
  }
}

// Cleaner Dashboard Functions
async function loadCleanerDashboard() {
  try {
    const alerts = await apiRequest('/cleaner/alerts');
    loadCleanerToiletsGrid(alerts);
  } catch (error) {
    console.error('Error loading cleaner dashboard:', error);
  }
}

function loadCleanerToiletsGrid(toilets) {
  const grid = document.getElementById('cleanerToiletsGrid');
  grid.innerHTML = toilets.map(toilet => `
    <div class="toilet-card">
      <h4>${toilet.location}</h4>
      <div class="toilet-status">
        <div class="status-item">
          <i class="fas fa-soap"></i> ${toilet.soap_level}
        </div>
        <div class="status-item">
          <i class="fas fa-wind"></i> ${toilet.smell_level}
        </div>
      </div>
      <button class="btn btn-primary" onclick="updateToiletStatus(${toilet.id})">
        Update Status
      </button>
    </div>
  `).join('');
}

async function updateToiletStatus(id, status, soapLevel, smellLevel) {
  try {
    await apiRequest(`/cleaner/toilets/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, soap_level: soapLevel, smell_level: smellLevel })
    });
    showToast('Toilet status updated!');
    loadCleanerDashboard();
  } catch (error) {
    console.error('Error updating toilet status:', error);
  }
}

// Modal Functions
function showAddOwnerModal() {
  const modal = document.getElementById('modalContainer');
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Add New Owner</h3>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <form id="addOwnerForm">
        <div class="form-group">
          <label>Name</label>
          <input type="text" id="ownerName" required>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="ownerEmail" required>
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="ownerPassword" required>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Add Owner</button>
        </div>
      </form>
    </div>
  `;
  modal.classList.add('active');

  document.getElementById('addOwnerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    addOwner(
      document.getElementById('ownerName').value,
      document.getElementById('ownerEmail').value,
      document.getElementById('ownerPassword').value
    );
  });
}

function showAddToiletModal() {
  const modal = document.getElementById('modalContainer');
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Add New Toilet</h3>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <form id="addToiletForm">
        <div class="form-group">
          <label>Location</label>
          <input type="text" id="toiletLocation" required>
        </div>
        <div class="form-group">
          <label>Assign Cleaner</label>
          <select id="toiletCleaner">
            <option value="">No Cleaner</option>
          </select>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Add Toilet</button>
        </div>
      </form>
    </div>
  `;
  modal.classList.add('active');

  loadOwnerCleaners().then(cleaners => {
    const select = document.getElementById('toiletCleaner');
    cleaners.forEach(cleaner => {
      const option = document.createElement('option');
      option.value = cleaner.id;
      option.textContent = cleaner.name;
      select.appendChild(option);
    });
  });

  document.getElementById('addToiletForm').addEventListener('submit', (e) => {
    e.preventDefault();
    addToilet(
      document.getElementById('toiletLocation').value,
      document.getElementById('toiletCleaner').value
    );
  });
}

function showAddCleanerModal() {
  const modal = document.getElementById('modalContainer');
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Add New Cleaner</h3>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <form id="addCleanerForm">
        <div class="form-group">
          <label>Name</label>
          <input type="text" id="cleanerName" required>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="cleanerEmail" required>
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="cleanerPassword" required>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Add Cleaner</button>
        </div>
      </form>
    </div>
  `;
  modal.classList.add('active');

  document.getElementById('addCleanerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    addCleaner(
      document.getElementById('cleanerName').value,
      document.getElementById('cleanerEmail').value,
      document.getElementById('cleanerPassword').value
    );
  });
}

function closeModal() {
  const modal = document.getElementById('modalContainer');
  modal.classList.remove('active');
  modal.innerHTML = '';
}

// Sidebar Toggle
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const mainContent = document.querySelector('.main-content');
  
  sidebar.classList.toggle('collapsed');
  mainContent.classList.toggle('expanded');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const savedToken = localStorage.getItem('token');
  const savedUser = localStorage.getItem('user');
  
  if (savedToken && savedUser) {
    authToken = savedToken;
    currentUser = JSON.parse(savedUser);
    navigateToDashboard(currentUser.role);
  }

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const role = document.getElementById('loginRole').value;
    
    await login(email, password, role);
  });
});

function showForgotPassword() {
  showToast('Password reset functionality coming soon', 'warning');
}
