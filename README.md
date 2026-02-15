# Real-time Classroom App

A real-time, mobile-first web application for online HTML/CSS classes. Teachers can monitor up to 60 students coding on their mobile devices with live previews and projector mode.

## 🎯 Features

### Teacher Features (PC-Optimized)
- 🔐 Secure JWT authentication
- 📚 Class management with unique 6-character codes
- 👥 Live student monitoring (up to 60 concurrent students)
- 📺 Projector mode for demonstrations
- 🎬 Selective subscription (view only selected student's code)
- ⚡ In-memory caching for instant student switching

### Student Features (Mobile-Optimized)
- 📱 Mobile-friendly code editor
- ⌨️ Quick-insert toolbar (< > { } ( ) ; :)
- 👀 Live preview of HTML/CSS
- 🔄 Auto-reconnect on network loss
- 🚀 Client-side debouncing (500ms) for smooth typing

## 🏗️ Tech Stack

**Backend:**
- Node.js 18+
- Express.js
- Socket.IO (optimized for 60 concurrent users)
- MongoDB (with TTL indexes)
- JWT authentication
- bcryptjs, helmet, CORS, rate-limiting

**Frontend:**
- React 18 (Vite)
- Tailwind CSS
- React Router
- Socket.IO Client
- CodeMirror 6 (HTML/CSS syntax)
- Axios

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm
- MongoDB running locally or MongoDB Atlas URI

### 1. Clone & Install

```bash
# Clone repository
git clone <your-repo-url>
cd class_pro

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Environment Setup

**Backend (.env):**
```bash
cd backend
cp .env.example .env
# Edit .env and set:
# - MONGO_URI (MongoDB connection string)
# - JWT_SECRET (min 32 characters)
# - FRONTEND_URL (default: http://localhost:5173)
```

**Frontend (.env):**
```bash
cd frontend
cp .env.example .env
# Edit .env if backend URL is different from localhost:5000
```

### 3. Create Test Teacher Account

```bash
cd backend
node -e "
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const User = require('./models/User');
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash('test123', salt);
  await User.create({ email: 'teacher@test.com', passwordHash: hash });
  console.log('✅ Teacher created: teacher@test.com / test123');
  process.exit(0);
});
"
```

## 🚀 Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Server runs on http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# App runs on http://localhost:5173
```

### Production Mode

```bash
cd frontend
npm run build

cd ../backend
npm start
# Serve frontend/dist from Express or deploy separately
```

## 📖 Usage Guide

### For Teachers:

1. **Login:** Go to `http://localhost:5173` → Login with credentials
2. **Create Class:** Dashboard → "Create Class" → Enter name → Get 6-char code
3. **Activate Class:** Toggle "Active" status (students can only join active classes)
4. **Go Live:** Click "Go Live" → View students in sidebar
5. **Monitor Student:** Click student name → See their code + preview in real-time
6. **Projector Mode:** Click "Projector Mode" → Fullscreen preview → Use arrow keys to switch students

### For Students:

1. **Join:** Go to `http://localhost:5173/join`
2. **Enter Name & Code:** Teacher provides the 6-character class code
3. **Code:** Use tabs (HTML, CSS, Preview) and toolbar buttons
4. **Auto-Save:** Code syncs every 500ms, saved to DB every 3s

## ⚙️ Performance Optimizations

- **Selective Subscriptions:** Teacher receives updates only from selected student (not all 60)
- **In-Memory Cache:** Instant student list/code retrieval (no DB queries)
- **Debounced DB Writes:** 3-second server-side debounce (reduces MongoDB load 200x)
- **Client Debouncing:** 500ms for smooth mobile typing
- **Socket.IO Tuning:** Compression, optimized ping, namespace isolation
- **60-Student Limit:** Server-enforced to maintain performance

**Benchmark Targets:**
- Student-to-teacher latency:< 500ms
- Student switching: <100ms
- DB writes with 60 students: <20/second
- Memory usage: <500MB

## 🔒 Security Features

- JWT authentication (min 32-char secret)
- Password hashing (bcryptjs, salt rounds: 10)
- Rate limiting on auth routes (10 req/15min)
- CORS whitelist
- Helmet.js security headers
- Input validation (express-validator)
- Iframe sandbox for student code preview
- MongoDB injection prevention

## 📂 Project Structure

```
class_pro/
├── backend/
│   ├── config/db.js
│   ├── models/ (User, Class, CodeSession)
│   ├── routes/ (auth, classes)
│   ├── middleware/authMiddleware.js
│   ├── socket/classHandlers.js
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/ (CodeEditor, LivePreview, MobileToolbar, StudentList)
│   │   ├── pages/ (TeacherLogin, Dashboard, LiveView, ProjectorMode, StudentJoin)
│   │   ├── hooks/useSocket.js
│   │   ├── utils/ (api.js, debounce.js)
│   │   └── App.jsx
│   └── public/
└── README.md
```

## 🧪 Testing

```bash
# Security scan
python .agent/skills/vulnerability-scanner/scripts/security_scan.py .

# UX audit
python .agent/skills/frontend-design/scripts/ux_audit.py ./frontend/src

# Load test (requires Artillery)
npm install -g artillery
artillery quick --count 60 --num 10 http://localhost:5000
```

## 🐛 Troubleshooting

**Students can't join:**
- Check if class `isActive` is `true`
- Verify backend is running
- Check CORS settings in backend/server.js

**Real-time not working:**
- Check Socket.IO connection in browser console
- Verify SOCKET_CORS_ORIGIN in backend .env
- Ensure firewall allows WebSocket connections

**Performance issues:**
- Monitor MongoDB writes: should be <20/sec with 60 students
- Check memory usage: should be <500MB
- Verify in-memory cache is operational

## 📄 License

MIT

## 👨‍💻 Development

Built with performance and mobile-first design in mind. Optimized for 50-60 concurrent students per class with real-time code synchronization.

## 🌍 Production Deployment (Ubuntu VPS + Domain + SSL)

See the full step-by-step guide here:

- [`DEPLOYMENT_UBUNTU_VPS.md`](./DEPLOYMENT_UBUNTU_VPS.md)
