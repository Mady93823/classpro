# Real-time Classroom App - Project Plan

## 🎯 Overview

A mobile-first real-time web application enabling teachers to conduct live HTML/CSS coding sessions where students code on mobile devices and teachers monitor all student work simultaneously on PC with live preview and projector capabilities.

**Project Type:** WEB (Full-stack with real-time features)

---

## ✅ Success Criteria

- [ ] Teacher can create/manage classes with unique codes
- [ ] Students join via class code using mobile-optimized interface
- [ ] Real-time bidirectional sync (student code → teacher view) with <100ms latency
- [ ] **Handle 50-60 concurrent students per class without lag**
- [ ] Teacher sees live code + preview ONLY for selected student (not all students)
- [ ] Projector mode: fullscreen student preview with switching
- [ ] Mobile editor with custom HTML/CSS quick-insert buttons
- [ ] Auto-reconnect on network loss (student side)
- [ ] Stable performance on 3G/4G mobile networks
- [ ] Deployable on local machine or VPS via `.env` configuration only

---

## ⚡ Performance Optimization Strategy

### Critical Requirements
- **50-60 concurrent students per class**
- **Mobile network stability** (handle 3G/4G latency and packet loss)
- **Minimal database load** (debounce writes)
- **Selective data flow** (teacher receives only selected student's updates)

### Optimization Architecture

#### 1. Selective Socket.IO Subscriptions

**Problem:** Broadcasting all 60 students' code updates to teacher = 60x unnecessary data transfer

**Solution:** Teacher subscribes only to the selected student

```javascript
// Teacher selects student → Server logic
socket.on('subscribe_to_student', ({ studentSocketId }) => {
  // Unsubscribe from previous student
  if (socket.currentSubscription) {
    socket.leave(`student:${socket.currentSubscription}`);
  }
  
  // Subscribe to new student's personal room
  socket.join(`student:${studentSocketId}`);
  socket.currentSubscription = studentSocketId;
  
  // Send initial code snapshot from in-memory cache
  const studentCode = inMemoryCache.get(studentSocketId);
  socket.emit('student_code_snapshot', studentCode);
});

// Student updates code → Only subscribed teachers receive it
socket.on('code_update', ({ html, css }) => {
  // Update in-memory cache (instant)
  inMemoryCache.set(socket.id, { html, css, timestamp: Date.now() });
  
  // Emit ONLY to subscribed teachers (not entire room)
  socket.to(`student:${socket.id}`).emit('student_code_update', { 
    socketId: socket.id, 
    html, 
    css 
  });
  
  // Debounced DB write (see below)
});
```

**Benefits:**
- Teacher receives 1 stream instead of 60
- Network bandwidth reduced by 98%
- No lag when switching students (instant cache retrieval)

---

#### 2. Debounced Database Writes

**Problem:** 60 students typing = 600+ DB writes/second = MongoDB overload

**Solution:** In-memory cache + batched DB writes

```javascript
const debounceTimers = new Map();
const DEBOUNCE_DELAY = 3000; // 3 seconds

socket.on('code_update', ({ html, css }) => {
  const studentId = socket.id;
  
  // 1. Update in-memory cache (instant, for teacher view)
  inMemoryCache.set(studentId, { html, css, updatedAt: Date.now() });
  
  // 2. Debounce DB write
  if (debounceTimers.has(studentId)) {
    clearTimeout(debounceTimers.get(studentId));
  }
  
  debounceTimers.set(studentId, setTimeout(async () => {
    await CodeSession.updateOne(
      { socketId: studentId },
      { html, css, lastUpdate: new Date() }
    );
    debounceTimers.delete(studentId);
  }, DEBOUNCE_DELAY));
});

// On disconnect, save immediately (no debounce)
socket.on('disconnect', async () => {
  if (debounceTimers.has(socket.id)) {
    clearTimeout(debounceTimers.get(socket.id));
    const data = inMemoryCache.get(socket.id);
    await CodeSession.updateOne({ socketId: socket.id }, data);
  }
  inMemoryCache.delete(socket.id);
});
```

**Benefits:**
- 60 students typing → 20 DB writes/second (200x reduction)
- Teacher still sees real-time updates (from in-memory cache)
- Code preserved on disconnect (immediate write)

---

#### 3. Mobile Network Optimization

**Problem:** 3G/4G has high latency (100-500ms) and packet loss

**Solution:** Client-side debouncing + delta compression

```javascript
// Client-side debouncing (student mobile)
const debouncedEmit = debounce((html, css) => {
  socket.emit('code_update', { html, css });
}, 500); // Wait 500ms after user stops typing

editorInstance.on('change', () => {
  const html = htmlEditor.getValue();
  const css = cssEditor.getValue();
  
  // Update local preview immediately (no network delay)
  updateLocalPreview(html, css);
  
  // Debounced emit to server (reduce network calls)
  debouncedEmit(html, css);
});
```

**Additional optimizations:**
- **Payload compression:** Use Socket.IO's built-in compression (`perMessageDeflate`)
- **Reconnection strategy:** Exponential backoff (1s → 2s → 4s → 8s max)
- **Heartbeat tuning:** Increase `pingInterval` to 30s (reduce keep-alive traffic)

---

#### 4. In-Memory Session Cache

**Technology:** Node.js `Map()` or Redis (if multi-server scaling needed)

```javascript
// Simple in-memory cache for single-server deployment
const inMemoryCache = new Map();

// Structure:
// socketId → { studentName, html, css, lastUpdate, classCode }

// On join
inMemoryCache.set(socket.id, { 
  studentName: 'Alice', 
  html: '', 
  css: '', 
  lastUpdate: Date.now(),
  classCode: 'A3B7C9'
});

// On code update
inMemoryCache.set(socket.id, { 
  ...inMemoryCache.get(socket.id), 
  html: newHtml, 
  css: newCss 
});

// On disconnect
inMemoryCache.delete(socket.id);
```

**Benefits:**
- Instant student list for teacher (no DB query)
- Instant code retrieval when teacher switches students
- Reduced MongoDB read load (60 students = 0 reads instead of 60)

---

#### 5. Socket.IO Configuration for Scale

```javascript
const io = new Server(server, {
  cors: { origin: process.env.SOCKET_CORS_ORIGIN },
  
  // Performance tuning for 60 concurrent connections
  pingInterval: 30000,        // 30s (reduce heartbeat traffic)
  pingTimeout: 10000,         // 10s (detect dead connections faster)
  upgradeTimeout: 15000,      // 15s (handle slow mobile networks)
  maxHttpBufferSize: 1e6,     // 1MB (limit payload size)
  
  // Enable compression for mobile networks
  perMessageDeflate: {
    threshold: 1024           // Compress messages > 1KB
  },
  
  // Connection limits
  transports: ['websocket', 'polling'], // Fallback for restrictive firewalls
});
```

---

### Performance Benchmarks (Target)

| Metric | Target | How to Verify |
|--------|--------|---------------|
| Student → Teacher latency | <500ms | Type in student editor → teacher sees update |
| Teacher student switch | <100ms | Click student → code loads |
| DB writes per second (60 students) | <20 | Monitor MongoDB metrics |
| Memory usage (60 students) | <500MB | Node.js `process.memoryUsage()` |
| Mobile network stability | No disconnects on 3G | Test with Chrome DevTools throttling |

---

## 🏗 Tech Stack

### Frontend
| Technology | Rationale |
|------------|-----------|
| **React 18** (Vite) | Fast HMR, smaller bundle than Next.js, no SSR needed for this use case |
| **Tailwind CSS** | Mobile-first responsive utilities, rapid prototyping |
| **Socket.IO Client** | Real-time bidirectional communication, auto-reconnect, namespace support |
| **CodeMirror 6** | Lightweight, mobile-friendly, HTML/CSS syntax highlighting |

**Why Vite over Next.js:** No SEO requirements, no SSR needed, faster dev server, simpler deployment.

### Backend
| Technology | Rationale |
|------------|-----------|
| **Node.js 18+** | Async I/O perfect for real-time, JavaScript ecosystem |
| **Express.js** | Minimal overhead, middleware ecosystem, Socket.IO integration |
| **Socket.IO** | WebSocket abstraction, rooms for class isolation, fallback to polling |
| **Mongoose** | Schema validation, MongoDB ODM, clean async/await API |

### Database
| Technology | Rationale |
|------------|-----------|
| **MongoDB** | Flexible schema for code sessions, horizontal scaling, JSON-native |

### Authentication
| Technology | Rationale |
|------------|-----------|
| **JWT (jsonwebtoken)** | Stateless, easy to verify, teacher-only auth (students use guest mode) |
| **bcryptjs** | Secure password hashing |

---

## 📁 File Structure

```
realtime-class-app/
├── backend/
│   ├── server.js                 # Entry point, Express + Socket.IO setup
│   ├── config/
│   │   └── db.js                 # MongoDB connection
│   ├── models/
│   │   ├── User.js               # Teacher accounts
│   │   ├── Class.js              # Class sessions with codes
│   │   └── CodeSession.js        # Student code (ephemeral, 24hr TTL)
│   ├── routes/
│   │   ├── auth.js               # POST /api/auth/login (JWT)
│   │   └── classes.js            # CRUD for classes
│   ├── middleware/
│   │   └── authMiddleware.js     # JWT verification
│   ├── socket/
│   │   └── classHandlers.js      # Socket.IO event handlers
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── pages/
│   │   │   ├── TeacherLogin.jsx      # Teacher auth
│   │   │   ├── TeacherDashboard.jsx  # Class list + create
│   │   │   ├── TeacherLiveView.jsx   # Left: students, Right: code+preview
│   │   │   ├── ProjectorMode.jsx     # Fullscreen student preview
│   │   │   └── StudentJoin.jsx       # Name + class code input (mobile)
│   │   ├── components/
│   │   │   ├── CodeEditor.jsx        # CodeMirror wrapper
│   │   │   ├── MobileToolbar.jsx     # < > { } buttons
│   │   │   ├── StudentList.jsx       # Sidebar component
│   │   │   └── LivePreview.jsx       # iframe sandbox
│   │   ├── hooks/
│   │   │   └── useSocket.js          # Socket.IO connection hook
│   │   ├── utils/
│   │   │   └── api.js                # Axios instance
│   │   └── styles/
│   │       └── index.css             # Tailwind imports
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── .env.example                   # All config variables
└── README.md                      # Setup instructions
```

---

## 🗃 Database Schema

### 1. Users (Teachers)
```javascript
{
  _id: ObjectId,
  email: String (unique, required),
  passwordHash: String (required),
  role: String (default: 'teacher'),
  createdAt: Date
}
```

**Indexes:** `email` (unique)

---

### 2. Classes
```javascript
{
  _id: ObjectId,
  className: String (required),
  classCode: String (unique, required, 6-char alphanumeric),
  teacherId: ObjectId (ref: User),
  isActive: Boolean (default: false),
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:** `classCode` (unique), `teacherId`

**Logic:** `classCode` auto-generated on creation (e.g., `A3B7C9`)

---

### 3. CodeSessions (Ephemeral)
```javascript
{
  _id: ObjectId,
  studentId: String (unique generated ID, e.g., UUID),
  studentName: String (required),
  classCode: String (required),
  socketId: String (required),
  html: String (default: ''),
  css: String (default: ''),
  lastUpdate: Date,
  createdAt: Date,
  expiresAt: Date (TTL index: 24 hours)
}
```

**Indexes:** 
- `classCode` (for quick lookup)
- `socketId` (unique, for disconnect handling)
- `studentId` (unique, for session identification)
- `expiresAt` (TTL: auto-delete after 24 hours)

**Logic:** 
- Session created on `join_class` with auto-generated `studentId` (UUID v4)
- Deleted on `disconnect` or after 24hrs (whichever first)
- **Max 60 students per class** (enforced on server)

---

## 🔄 Socket.IO Event Flow (Optimized for Scale)

### Namespace: `/class`

#### Client → Server Events

| Event | Payload | Server Action | Performance Notes |
|-------|---------|---------------|-------------------|
| `join_class` | `{ studentName, classCode }` | Validate code, create CodeSession in **in-memory cache**, save to DB (non-blocking), join room `classCode`, emit `student_joined` to room | Cache-first: instant student list for teacher |
| `subscribe_to_student` | `{ studentSocketId }` | Teacher-only: Unsubscribe from previous, join `student:{socketId}` room, send code snapshot from cache | Selective subscription: teacher receives 1 stream not 60 |
| `code_update` | `{ html, css }` | Update in-memory cache, emit to subscribed teachers only, debounced DB write (3s delay) | Client debounced (500ms), server debounced (3s) |
| `disconnect` | (auto) | Clear debounce timer, immediate DB write, delete from cache, emit `student_left` to room | Ensures code saved before session ends |

#### Server → Client Events

| Event | Target | Payload | Purpose | Performance Notes |
|-------|--------|---------|---------|-------------------|
| `join_success` | Sender | `{ sessionId, socketId }` | Confirm successful join | - |
| `join_error` | Sender | `{ message }` | Invalid class code | - |
| `student_list` | Teacher (on request) | `{ students: [{ name, socketId, lastUpdate }] }` | Full student list from in-memory cache | Instant (no DB query) |
| `student_joined` | Room (teachers only) | `{ studentName, socketId, timestamp }` | Update teacher's student list | Broadcast (low frequency) |
| `student_code_snapshot` | Teacher | `{ socketId, html, css, studentName }` | Initial code when teacher subscribes to student | From in-memory cache |
| `student_code_update` | Subscribed teachers only | `{ socketId, html, css, timestamp }` | Live code sync (real-time) | Targeted emission (not broadcast) |
| `student_left` | Room (teachers only) | `{ socketId, reason }` | Remove from teacher's list | Broadcast (low frequency) |
| `session_end` | Room (all) | `{}` | Teacher deactivated class | Rare event |

---

### Optimized Room Structure

**Old (Inefficient):**
```
Room: classCode "A3B7C9"
├── Teacher socket
├── Student 1 socket
├── Student 2 socket
└── ... (60 students)

Problem: Student update broadcasts to all 61 members
```

**New (Optimized):**
```
Room: classCode "A3B7C9" (for metadata events only)
├── Teacher socket
├── Student 1 socket
└── ... (60 students)

Personal Rooms (for code updates):
├── Room: "student:socket123" → Teacher subscribed here
├── Room: "student:socket456" → (no teacher, no emission)
└── Room: "student:socket789" → (no teacher, no emission)

Benefit: Student update emits ONLY to their personal room
```

---

## 👤 Task Breakdown

### **Priority 0: Foundation**

#### Task 1: Backend Setup
**Agent:** `backend-specialist`  
**Skills:** `nodejs-best-practices`, `clean-code`

**Actions:**
- Initialize `backend/` folder with `npm init`
- Install dependencies: `express`, `socket.io`, `mongoose`, `dotenv`, `jsonwebtoken`, `bcryptjs`, `cors`
- Create `server.js` with Express + Socket.IO server
- Set up `.env.example` with all required variables
- Create MongoDB connection in `config/db.js`

**Verification:**
```bash
cd backend && npm install
node server.js
# → "Server running on port 5000" + MongoDB connected
```

---

#### Task 2: Database Models
**Agent:** `backend-specialist`  
**Skills:** `database-design`, `clean-code`

**Actions:**
- Create `models/User.js` (email, passwordHash, role)
- Create `models/Class.js` (className, classCode generator, teacherId ref)
- Create `models/CodeSession.js` (TTL index for 24hr auto-delete)
- Add schema validation and indexes

**Verification:**
```javascript
// In Node REPL
const User = require('./models/User');
const Class = require('./models/Class');
const CodeSession = require('./models/CodeSession');
console.log(User.schema.paths); // → Shows email, passwordHash fields
```

---

#### Task 3: Teacher Auth Routes
**Agent:** `backend-specialist`  
**Skills:** `vulnerability-scanner`, `api-patterns`

**Actions:**
- Create `routes/auth.js`
  - `POST /api/auth/register` (create teacher account)
  - `POST /api/auth/login` (return JWT)
- Create `middleware/authMiddleware.js` (verify JWT)
- Hash passwords with bcrypt (salt rounds: 10)

**Verification:**
```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@test.com","password":"test123"}'
# → Returns 201 + success message

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@test.com","password":"test123"}'
# → Returns 200 + JWT token
```

---

#### Task 4: Class CRUD Routes
**Agent:** `backend-specialist`  
**Skills:** `api-patterns`, `clean-code`

**Actions:**
- Create `routes/classes.js` (protected with JWT middleware)
  - `POST /api/classes` (auto-generate 6-char classCode)
  - `GET /api/classes` (list teacher's classes)
  - `PATCH /api/classes/:id` (update className or isActive)
  - `DELETE /api/classes/:id` (soft delete or hard delete)

**Verification:**
```bash
# Create class (with JWT from login)
curl -X POST http://localhost:5000/api/classes \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"className":"HTML Basics 101"}'
# → Returns 201 + class object with unique classCode (e.g., "A3B7C9")

# List classes
curl http://localhost:5000/api/classes \
  -H "Authorization: Bearer <JWT>"
# → Returns array of teacher's classes
```

---

### **Priority 1: Real-time Core**

#### Task 5: Socket.IO Class Handlers (Performance Optimized)
**Agent:** `backend-specialist`  
**Skills:** `nodejs-best-practices`, `clean-code`

**Actions:**
- Create `socket/classHandlers.js` with **performance-first architecture**
- Set up **in-memory cache** (Node.js Map) for active sessions
- Implement **selective subscription pattern** (teacher subscribes to individual students)
- Implement **debounced database writes** (3-second delay, immediate on disconnect)
- Configure Socket.IO for 60 concurrent connections (see Performance section above)

**Event Handlers:**

1. **`join_class`** (Student joins)
   - Validate class code against DB
   - **Check `class.isActive === true`** (reject if class not active)
   - **Check current student count < 60** (reject if limit reached)
   - Generate unique `studentId` (UUID v4)
   - Create session in **in-memory cache first** (instant)
   - Save to MongoDB **asynchronously** (non-blocking)
   - Join room `classCode`
   - Emit `student_joined` to room (teacher adds to sidebar)

2. **`subscribe_to_student`** (Teacher selects student)
   - **NEW**: Teacher-only event
   - Leave previous personal room `student:{previousSocketId}`
   - Join new personal room `student:{selectedSocketId}`
   - Send initial code snapshot **from in-memory cache** (no DB query)

3. **`code_update`** (Student types code)
   - Update **in-memory cache immediately** (instant teacher view)
   - Emit to `student:{socket.id}` room **only** (targeted, not broadcast)
   - **Debounce DB write**: Clear existing timer, set new 3s timer
   - Client-side debounce: 500ms (reduce network calls)

4. **`disconnect`** (Student leaves)
   - **Clear debounce timer** (if exists)
   - **Immediate DB write** (preserve code before cleanup)
   - Delete from in-memory cache
   - Emit `student_left` to room

**Key Performance Features:**
```javascript
// In-memory cache structure
const inMemoryCache = new Map();
const debounceTimers = new Map();
const DEBOUNCE_DELAY = 3000;
const MAX_STUDENTS_PER_CLASS = 60;

// Example: join_class handler (with security checks)
socket.on('join_class', async ({ studentName, classCode }) => {
  try {
    // 1. Validate class exists and is active
    const classDoc = await Class.findOne({ classCode });
    if (!classDoc) {
      return socket.emit('join_error', { message: 'Invalid class code' });
    }
    
    if (!classDoc.isActive) {
      return socket.emit('join_error', { message: 'Class is not currently active' });
    }
    
    // 2. Check student limit (count from in-memory cache for performance)
    const currentStudents = Array.from(inMemoryCache.values())
      .filter(session => session.classCode === classCode);
    
    if (currentStudents.length >= MAX_STUDENTS_PER_CLASS) {
      return socket.emit('join_error', { 
        message: `Class is full (maximum ${MAX_STUDENTS_PER_CLASS} students)` 
      });
    }
    
    // 3. Generate unique studentId
    const studentId = require('crypto').randomUUID(); // UUID v4
    
    // 4. Create session in cache (instant)
    const sessionData = {
      studentId,
      studentName,
      classCode,
      socketId: socket.id,
      html: '',
      css: '',
      lastUpdate: Date.now()
    };
    inMemoryCache.set(socket.id, sessionData);
    
    // 5. Save to DB (async, non-blocking)
    CodeSession.create({
      studentId,
      studentName,
      classCode,
      socketId: socket.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    }).catch(err => console.error('DB save error:', err));
    
    // 6. Join room and notify
    socket.join(classCode);
    socket.to(classCode).emit('student_joined', { 
      studentName, 
      socketId: socket.id,
      studentId,
      timestamp: Date.now() 
    });
    socket.emit('join_success', { sessionId: studentId, socketId: socket.id });
    
  } catch (error) {
    console.error('join_class error:', error);
    socket.emit('join_error', { message: 'Server error, please try again' });
  }
});

// Example: Student update handler (optimized)
socket.on('code_update', async ({ html, css }) => {
  // 1. Cache update (instant, for teacher)
  inMemoryCache.set(socket.id, { 
    ...inMemoryCache.get(socket.id), 
    html, 
    css, 
    lastUpdate: Date.now() 
  });
  
  // 2. Emit ONLY to subscribed teachers
  socket.to(`student:${socket.id}`).emit('student_code_update', { 
    socketId: socket.id, 
    html, 
    css 
  });
  
  // 3. Debounced DB write
  if (debounceTimers.has(socket.id)) {
    clearTimeout(debounceTimers.get(socket.id));
  }
  
  debounceTimers.set(socket.id, setTimeout(async () => {
    await CodeSession.updateOne({ socketId: socket.id }, { html, css, lastUpdate: new Date() });
    debounceTimers.delete(socket.id);
  }, DEBOUNCE_DELAY));
});
```

**Verification:**
```javascript
// Test with 60 concurrent students (use load testing tool)
// Artillery config example:
config:
  target: 'http://localhost:5000'
  socketio:
    transports: ['websocket']
scenarios:
  - name: "60 concurrent students"
    engine: socketio
    flow:
      - emit:
          channel: 'join_class'
          data: { studentName: 'Student{{ $randomNumber(1,60) }}', classCode: 'A3B7C9' }
      - think: 2
      - emit:
          channel: 'code_update'
          data: { html: '<h1>Test</h1>', css: 'h1 { color: blue; }' }
          count: 10

# Run test:
# artillery run socket-load-test.yml

# Expected results:
# - All 60 students join successfully
# - DB writes < 20/second (monitor with MongoDB Atlas or mongotop)
# - Memory usage < 500MB
# - No socket disconnections
# - Teacher switches between students in < 100ms
```

**Manual Verification:**
- Simulate 5 students joining (open 5 browser tabs)
- **Test inactive class:** Deactivate class → student join attempt → "Class is not currently active" error
- **Test 60-student limit:** Join 60 students → 61st student gets "Class is full" error
- **Test studentId generation:** Check MongoDB after join → unique `studentId` (UUID format) exists
- Teacher clicks Student 1 → sees their code instantly
- Student 1 types → teacher sees update
- Teacher clicks Student 2 → switch happens in <100ms
- Students 3, 4, 5 type → teacher does NOT receive updates (selective subscription works)
- Check MongoDB after 3 seconds → code saved
- Disconnect 1 student → code saved immediately (no 3s delay)

---

### **Priority 2: Frontend - Teacher Interface**

#### Task 6: Frontend Setup + Routing
**Agent:** `frontend-specialist`  
**Skills:** `react-best-practices`, `tailwind-patterns`

**Actions:**
- Initialize Vite React app: `npm create vite@latest frontend -- --template react`
- Install: `react-router-dom`, `socket.io-client`, `axios`, `@codemirror/lang-html`, `@codemirror/lang-css`, `@uiw/react-codemirror`
- Install Tailwind CSS (follow Vite setup)
- Set up routes:
  - `/` → TeacherLogin
  - `/dashboard` → TeacherDashboard
  - `/live/:classId` → TeacherLiveView
  - `/projector/:classId` → ProjectorMode
  - `/student` → StudentJoin

**Verification:**
```bash
cd frontend && npm run dev
# → Open http://localhost:5173
# → All routes load without errors
```

---

#### Task 7: Teacher Login Page
**Agent:** `frontend-specialist`  
**Skills:** `frontend-design`, `clean-code`

**Actions:**
- Create `TeacherLogin.jsx`
- Mobile-first responsive form (email + password)
- On submit: POST to `/api/auth/login`, store JWT in localStorage
- Redirect to `/dashboard` on success
- Error handling (toast or inline errors)

**Verification:**
- Open http://localhost:5173
- Login with test teacher account
- → Redirects to `/dashboard`
- → JWT stored in localStorage
- → Axios default auth header set

---

#### Task 8: Teacher Dashboard (Class List)
**Agent:** `frontend-specialist`  
**Skills:** `frontend-design`, `react-best-practices`

**Actions:**
- Create `TeacherDashboard.jsx`
- Fetch classes: `GET /api/classes`
- Display as cards/table with:
  - Class name
  - Class code (copy button)
  - Active status (toggle switch)
  - Edit/Delete buttons
  - "Start Live Session" button → navigate to `/live/:classId`
- Create class form (modal or inline)

**Verification:**
- Create 2 test classes
- → See both in dashboard
- Click "Start Live Session" → navigate to live view
- Toggle isActive → API called, UI updates

---

#### Task 9: Teacher Live View (Main Interface)
**Agent:** `frontend-specialist`  
**Skills:** `frontend-design`, `react-best-practices`

**Actions:**
- Create `TeacherLiveView.jsx` with layout:
  - **Left Sidebar (25%):** Student list (clickable)
  - **Right Panel (75%):** Selected student's code editor (read-only) + live preview iframe
- Connect to Socket.IO `/class` namespace
- Listen for `student_joined`, `student_code_update`, `student_left`
- Click student → load their code into right panel
- "Projector Mode" button → opens `/projector/:classId` in new window

**Verification:**
- Open teacher live view
- Join with 2 students (simulate in different browsers/devices)
- → Both appear in left sidebar
- Click student → see their code in right panel
- Student types → teacher sees live update (<500ms delay)

---

#### Task 10: Projector Mode
**Agent:** `frontend-specialist`  
**Skills:** `frontend-design`, `react-best-practices`

**Actions:**
- Create `ProjectorMode.jsx`
- Fullscreen preview only (no editor, no sidebar)
- Student name overlay (top-left, semi-transparent)
- Keyboard shortcuts:
  - Arrow Left/Right: switch students
  - Escape: exit fullscreen
- Hide browser chrome (request fullscreen API)

**Verification:**
- Open projector mode
- Press F11 or fullscreen button
- → Only preview visible with student name
- Press arrow keys → switch between students
- Student types → preview updates in real-time

---

### **Priority 3: Frontend - Student Interface**

#### Task 11: Student Join Page
**Agent:** `frontend-specialist`  
**Skills:** `mobile-design`, `frontend-design`

**Actions:**
- Create `StudentJoin.jsx` (mobile-optimized)
- Large touch-friendly form:
  - Name input
  - Class code input (uppercase auto-transform)
  - "Join Class" button
- On submit: Connect Socket.IO, emit `join_class`
- On `join_success`: Navigate to editor (store sessionId in state)
- On `join_error`: Show error message

**Verification:**
- Open on mobile device or Chrome DevTools mobile view
- Enter valid class code → success
- Enter invalid code → error shown
- → Socket connection established

---

#### Task 12: Mobile Code Editor
**Agent:** `frontend-specialist`  
**Skills:** `mobile-design`, `react-best-practices`

**Actions:**
- Create `CodeEditor.jsx` with CodeMirror
- Mobile-optimized settings:
  - Font size: 14px (readable on small screens)
  - Line numbers off (save space)
  - Syntax highlighting: HTML/CSS
- Create `MobileToolbar.jsx`:
  - Buttons: `<` `>` `/` `{` `}` `(` `)` `;` `:`
  - Click → insert character at cursor position
- Split view: HTML editor (top 40%) + CSS editor (middle 40%) + Preview (bottom 20%)
- Debounce code updates (500ms) before emitting to Socket.IO

**Verification:**
- Open student page on mobile
- Type HTML → preview updates
- Click toolbar buttons → characters inserted
- → Teacher sees updates in real-time
- Toggle HTML/CSS tabs → both editable

---

#### Task 13: Student Auto-Reconnect
**Agent:** `frontend-specialist`  
**Skills:** `react-best-practices`, `clean-code`

**Actions:**
- Create `useSocket.js` hook with:
  - Auto-reconnect logic (Socket.IO default)
  - Store `studentName` and `classCode` in localStorage
  - On `disconnect` → show "Reconnecting..." toast
  - On `connect` after disconnect → auto re-join class (emit `join_class` with stored data)

**Verification:**
- Join as student
- Disconnect WiFi for 5 seconds
- Reconnect WiFi
- → Socket reconnects automatically
- → Student re-joins class without manual action
- → Code state preserved (local state, not lost)

---

### **Priority 4: Polish & Configuration**

#### Task 14: Environment Configuration
**Agent:** `backend-specialist`  
**Skills:** `deployment-procedures`, `clean-code`

**Actions:**
- Create comprehensive `.env.example`:
  ```env
  # Server
  PORT=5000
  NODE_ENV=development
  BASE_URL=http://localhost:5000
  
  # Database
  MONGO_URI=mongodb://localhost:27017/realtime-class
  
  # Auth
  JWT_SECRET=your_jwt_secret_here_change_in_production
  JWT_EXPIRE=7d
  
  # Frontend (CORS)
  FRONTEND_URL=http://localhost:5173
  
  # Socket.IO
  SOCKET_CORS_ORIGIN=http://localhost:5173
  ```
- Update `server.js` to use all env vars
- Add validation: crash on startup if required vars missing

**Verification:**
```bash
# Remove .env file
node server.js
# → Shows error: "MONGO_URI is required"

# Create .env with all vars
node server.js
# → Server starts successfully
```

---

#### Task 15: README & Setup Instructions
**Agent:** `frontend-specialist`  
**Skills:** `documentation-templates`, `clean-code`

**Actions:**
- Create `README.md` with:
  - Project overview
  - Prerequisites (Node 18+, MongoDB)
  - Installation steps (backend + frontend)
  - `.env` setup guide
  - Running locally (dev mode)
  - Deployment guide (VPS with PM2 or Docker)
  - Feature list
  - Tech stack
  - Socket.IO events documentation
  - Troubleshooting section

**Verification:**
- Follow README from scratch on clean machine (or VM)
- → App runs successfully without external help

---

#### Task 16: Security Best Practices
**Agent:** `security-auditor`  
**Skills:** `vulnerability-scanner`, `clean-code`

**Actions:**
- Implement security measures:
  - Helmet.js (HTTP headers)
  - Rate limiting (express-rate-limit) on auth routes
  - Input validation (express-validator) on all routes
  - CORS whitelist (only FRONTEND_URL)
  - JWT secret minimum 32 chars check
  - Prevent MongoDB injection (sanitize inputs)
  - **Iframe sandbox for preview:** `sandbox=""` (unrestricted, needed for full HTML/CSS rendering)
  - **Max 60 students per class** (server-enforced on `join_class` event)
  - **Class activation check:** Only allow join if `isActive === true`

**Verification:**
```bash
python .agent/skills/vulnerability-scanner/scripts/security_scan.py .
# → No critical issues found
```

---

### **Extra Smart Ideas (Bonus Tasks)**

#### Task 17: Teacher Broadcast Mode
**Agent:** `backend-specialist`  
**Skills:** `nodejs-best-practices`

**Actions:**
- New Socket.IO event: `teacher_broadcast`
- Payload: `{ message: String }`
- Server emits to all students in room
- Student UI: Show toast notification

**Verification:**
- Teacher clicks "Send Message" button
- → All students see notification

---

#### Task 18: Dark Mode for Projector
**Agent:** `frontend-specialist`  
**Skills:** `frontend-design`, `tailwind-patterns`

**Actions:**
- Add dark mode toggle in ProjectorMode
- Use Tailwind dark mode classes
- Persist preference in localStorage

**Verification:**
- Toggle dark mode → preview background dark
- Reload page → preference persists

---

#### Task 19: QR Code for Class Join
**Agent:** `frontend-specialist`  
**Skills:** `react-best-practices`

**Actions:**
- Install `qrcode.react`
- In TeacherDashboard, show QR code modal for each class
- QR contains: `http://FRONTEND_URL/student?code=A3B7C9&prefill=true`
- StudentJoin auto-fills class code from URL param

**Verification:**
- Scan QR with mobile
- → Student join page opens with class code prefilled

---

#### Task 20: Kick Student Option
**Agent:** `backend-specialist`  
**Skills:** `nodejs-best-practices`

**Actions:**
- New Socket.IO event: `teacher_kick_student`
- Payload: `{ socketId }`
- Server emits `force_disconnect` to specific student
- Delete their CodeSession
- Student UI: Show "You were removed from class" message

**Verification:**
- Teacher clicks "Kick" button next to student
- → Student sees message and disconnects
- → Student removed from teacher's list

---

## 🌍 Environment Variables (Complete List)

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Backend server port | `5000` |
| `NODE_ENV` | Environment mode | `development` or `production` |
| `BASE_URL` | Backend base URL | `http://localhost:5000` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/realtime-class` |
| `JWT_SECRET` | Secret key for JWT signing | `my_super_secret_key_change_this` |
| `JWT_EXPIRE` | JWT expiration time | `7d` |
| `FRONTEND_URL` | Frontend URL (for CORS) | `http://localhost:5173` |
| `SOCKET_CORS_ORIGIN` | Socket.IO CORS origin | `http://localhost:5173` |

---

## 🧪 Phase X: Final Verification

### Automated Checks

```bash
# 1. Lint Check (if ESLint configured)
cd frontend && npm run lint
cd ../backend && npm run lint

# 2. Security Scan
python .agent/skills/vulnerability-scanner/scripts/security_scan.py .

# 3. UX Audit (mobile + desktop)
python .agent/skills/frontend-design/scripts/ux_audit.py ./frontend/src

# 4. Load Testing (60 Concurrent Students)
# Install Artillery: npm install -g artillery
artillery quick --count 60 --num 10 http://localhost:5000

# → Expected: No timeouts, all 60 connections successful
# → Monitor: MongoDB writes < 20/sec, Memory < 500MB

# 5. Build Test
cd frontend && npm run build
# → No errors, dist/ folder created
```

---

### Manual Testing Checklist

#### Teacher Flow
- [ ] Login with valid credentials → success
- [ ] Create class → unique code generated
- [ ] Copy class code → clipboard works
- [ ] Toggle isActive → API updates, UI reflects
- [ ] Start live session → navigate to live view
- [ ] See student join → appears in sidebar
- [ ] Click student → code + preview load
- [ ] Student types → see real-time update (<500ms)
- [ ] Switch students → sidebar selection works
- [ ] Open projector mode → fullscreen preview
- [ ] Arrow keys in projector → switch students
- [ ] Delete class → confirmation, removed from list

#### Student Flow (Mobile Device)
- [ ] Open join page → form visible, touch-friendly
- [ ] Enter invalid code → error shown
- [ ] Enter valid code → join success
- [ ] See editor with toolbar → buttons large enough to tap
- [ ] Type HTML → preview updates
- [ ] Click `<` button → `<` inserted at cursor
- [ ] Type CSS → preview updates
- [ ] Lock screen for 10s → reconnects automatically
- [ ] Disable WiFi → "Reconnecting..." message
- [ ] Enable WiFi → re-joins class, code preserved

#### Real-time Performance (Critical for 60 Students)
- [ ] Student types → teacher sees update in <500ms
- [ ] **60 students typing simultaneously** → teacher still receives updates from selected student only
- [ ] Teacher switches between students → preview updates in <100ms (from cache)
- [ ] **Load test passed**: Artillery with 60 concurrent connections, no timeouts
- [ ] **DB writes monitored**: <20 writes/second during peak (60 students typing)
- [ ] **Memory usage**: <500MB with 60 active students
- [ ] Student disconnects → removed from teacher's list in <2s

#### Security
- [ ] Access `/api/classes` without JWT → 401 Unauthorized
- [ ] SQL/NoSQL injection attempts → sanitized
- [ ] XSS in student code → sandboxed in iframe
- [ ] CORS from unauthorized origin → blocked

---

### ✅ Definition of Done

- [ ] All Priority 0-3 tasks completed
- [ ] Security scan passes (no critical issues)
- [ ] Mobile UX tested on real device (iOS or Android)
- [ ] **Teacher can manage 60 concurrent students without lag** (load tested)
- [ ] **Selective subscription implemented** (teacher receives 1 stream, not 60)
- [ ] **Debounced DB writes working** (<20 writes/sec with 60 students)
- [ ] **In-memory cache operational** (instant student switching)
- [ ] Mobile network tested with Chrome DevTools 3G throttling
- [ ] README setup instructions work on fresh machine
- [ ] `.env.example` complete with all variables
- [ ] Code commented and clean (no console.logs in production)
- [ ] Build succeeds without warnings
- [ ] Deployable to VPS with single `.env` change

---

## 📊 Agent Assignment Summary

| Agent | Tasks | Primary Responsibilities |
|-------|-------|--------------------------|
| `backend-specialist` | 1-5, 14, 16, 17, 20 | Express setup, MongoDB models, Socket.IO, Auth, Security |
| `frontend-specialist` | 6-13, 15, 18, 19 | React UI, Tailwind styling, CodeMirror integration, Mobile UX |
| `security-auditor` | 16 | Security headers, input validation, vulnerability scan |

---

## 🎯 Next Steps After Plan Approval

1. **Review this plan** → Approve or request changes
2. **Run `/create`** → Start implementation with `app-builder` skill
3. **Follow task order** → Priority 0 → 1 → 2 → 3 → X
4. **Verify each task** → Don't skip verification steps
5. **Phase X completion** → Run all automated checks

---

**Estimated Development Time:** 12-16 hours (for experienced developer)

**Complexity:** Medium-High (real-time, mobile optimization, multi-role UX)

**Risk Areas:**
- Socket.IO connection stability on mobile networks (mitigated by auto-reconnect)
- Mobile keyboard covering editor (mitigated by viewport units + scroll-into-view)
- MongoDB TTL index delay (mitigated by manual deletion on disconnect)
