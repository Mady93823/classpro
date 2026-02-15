require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const classHandlers = require('./socket/classHandlers');

// Validate required environment variables
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET', 'FRONTEND_URL'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`❌ Error: ${envVar} is required in .env file`);
        process.exit(1);
    }
}

// Validate JWT secret length
if (process.env.JWT_SECRET.length < 32) {
    console.error('❌ Error: JWT_SECRET must be at least 32 characters for security');
    process.exit(1);
}

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO with performance tuning for 60 concurrent connections
const io = new Server(httpServer, {
    cors: {
        origin: process.env.SOCKET_CORS_ORIGIN || process.env.FRONTEND_URL,
        methods: ['GET', 'POST'],
        credentials: true
    },
    // Performance tuning
    pingInterval: 30000,        // 30s (reduce heartbeat traffic)
    pingTimeout: 10000,         // 10s (detect dead connections faster)
    upgradeTimeout: 15000,      // 15s (handle slow mobile networks)
    maxHttpBufferSize: 1e6,     // 1MB (limit payload size)
    // Enable compression for mobile networks
    perMessageDeflate: {
        threshold: 1024           // Compress messages > 1KB
    },
    transports: ['websocket', 'polling'] // Fallback for restrictive firewalls
});

// Connect to MongoDB
connectDB();

// Security Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting (for auth routes)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per windowMs
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});

// Routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/classes', require('./routes/classes'));

// Health check route
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'development' ? err.message : 'Server error'
    });
});

// Initialize Socket.IO handlers
classHandlers(io);

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📡 Socket.IO namespace: /class`);
    console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
    console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    httpServer.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});
