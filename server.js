require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');

console.log('1. Starting requires...');
const authRoutes = require('./routes/authRoutes');
console.log('2. authRoutes loaded:', typeof authRoutes, authRoutes ? 'OK' : 'UNDEFINED');
const adminRoutes = require('./routes/adminRoutes');
console.log('3. adminRoutes loaded:', typeof adminRoutes);
// ... do the same for all routes

// Then after app.use lines:
app.use('/api/auth', authRoutes);
console.log('4. Auth routes mounted at /api/auth');
app.use('/api/admin', adminRoutes);
console.log('5. Admin routes mounted at /api/admin');
// ... etc.
// Route imports
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const ownerRoutes = require('./routes/ownerRoutes');
const cleanerRoutes = require('./routes/cleanerRoutes');
const hardwareRoutes = require('./routes/hardwareRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const chatRoutes = require('./routes/chatRoutes');
const publicRoutes = require('./routes/publicRoutes');
const rfidRoutes = require('./routes/rfidRoutes');

// Create app instance (only ONE)
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger Configuration
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Smart Public Toilet API',
      version: '1.0.0',
      description: 'IoT Management & Payment System for Smart Public Toilets',
      contact: {
        name: 'Developer'
      },
      servers: [
        {
          url: `http://localhost:${process.env.PORT || 5000}`,
          description: 'Local server'
        }
      ]
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{
      bearerAuth: []
    }]
  },
  apis: ['./routes/*.js', './server.js']
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Serve static files (HTML, CSS, JS)
app.use(express.static(__dirname));

// ========== ALL ROUTES ==========
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/cleaner', cleanerRoutes);
app.use('/api/hardware', hardwareRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/rfid', rfidRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Smart Public Toilet API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', details: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
  console.log('   Available endpoints:');
  console.log('   POST /api/hardware/rfid-tap');
  console.log('   POST /api/hardware/log-event');
  console.log('   GET  /api/health');
  console.log('   GET  /api-docs (Swagger)');
});
