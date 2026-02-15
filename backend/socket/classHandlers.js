const Class = require('../models/Class');
const CodeSession = require('../models/CodeSession');
const crypto = require('crypto');

// In-memory cache for performance (50-60 concurrent students)
const inMemoryCache = new Map(); // socketId -> session data
const debounceTimers = new Map(); // socketId -> timeout
const DEBOUNCE_DELAY = 3000; // 3 seconds
const MAX_STUDENTS_PER_CLASS = 60;

const classHandlers = (io) => {
    const classNamespace = io.of('/class');

    classNamespace.on('connection', (socket) => {
        console.log(`✅ Socket connected: ${socket.id}`);

        // ========================================
        // join_class - Student joins a class
        // ========================================
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
                const studentId = crypto.randomUUID(); // UUID v4

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

                socket.emit('join_success', {
                    studentId,
                    sessionId: studentId,
                    socketId: socket.id,
                    isClassActive: classDoc.isActive
                });
                console.log(`👤 ${studentName} joined class ${classCode} (${socket.id})`);

            } catch (error) {
                console.error('join_class error:', error);
                socket.emit('join_error', { message: 'Server error, please try again' });
            }
        });

        // ========================================
        // rejoin_class - Student reconnects with existing session
        // ========================================
        socket.on('rejoin_class', async ({ studentId, studentName, classCode }) => {
            try {
                // 1. Validate class exists and check if active
                const classDoc = await Class.findOne({ classCode });
                if (!classDoc) {
                    return socket.emit('rejoin_error', { message: 'Invalid class code' });
                }

                // 2. Check if class is active
                if (!classDoc.isActive) {
                    return socket.emit('rejoin_error', {
                        message: 'Class is not currently live',
                        isClassInactive: true
                    });
                }

                // 3. Check student limit
                const currentStudents = Array.from(inMemoryCache.values())
                    .filter(session => session.classCode === classCode);

                if (currentStudents.length >= MAX_STUDENTS_PER_CLASS) {
                    return socket.emit('rejoin_error', {
                        message: `Class is full (maximum ${MAX_STUDENTS_PER_CLASS} students)`
                    });
                }

                // 4. Create/restore session in cache
                const sessionData = {
                    studentId, // Use existing UUID
                    studentName,
                    classCode,
                    socketId: socket.id,
                    html: '',
                    css: '',
                    lastUpdate: Date.now()
                };
                inMemoryCache.set(socket.id, sessionData);

                // 5. Update DB with new socket ID (async, non-blocking)
                CodeSession.updateOne(
                    { studentId },
                    {
                        socketId: socket.id,
                        studentName,
                        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
                    },
                    { upsert: true }
                ).catch(err => console.error('DB update error:', err));

                // 6. Join room and notify
                socket.join(classCode);
                socket.to(classCode).emit('student_joined', {
                    studentName,
                    socketId: socket.id,
                    studentId,
                    timestamp: Date.now(),
                    isReconnect: true
                });

                socket.emit('rejoin_success', {
                    sessionId: studentId,
                    socketId: socket.id,
                    isClassActive: true
                });
                console.log(`🔄 ${studentName} rejoined class ${classCode} (${socket.id})`);

            } catch (error) {
                console.error('rejoin_class error:', error);
                socket.emit('rejoin_error', { message: 'Server error, please try again' });
            }
        });

        // ========================================
        // teacher_join_room - Teacher joins room for notifications (NOT as student)
        // ========================================
        socket.on('teacher_join_room', ({ classCode }) => {
            try {
                // Teacher joins Socket.IO room to receive notifications
                // but is NOT added to inMemoryCache or student list
                socket.join(classCode);
                console.log(`👨‍🏫 Teacher joined room ${classCode} (${socket.id})`);
            } catch (error) {
                console.error('teacher_join_room error:', error);
            }
        });

        // ========================================
        // subscribe_to_student - Teacher selects student
        // ========================================
        socket.on('subscribe_to_student', async ({ studentSocketId }) => {
            try {
                // Unsubscribe from previous student (if any)
                if (socket.currentSubscription) {
                    socket.leave(`student:${socket.currentSubscription}`);
                }

                // Subscribe to new student's personal room
                socket.join(`student:${studentSocketId}`);
                socket.currentSubscription = studentSocketId;

                // Send initial code snapshot from in-memory cache (instant, no DB)
                const studentCode = inMemoryCache.get(studentSocketId);
                if (studentCode) {
                    socket.emit('student_code_snapshot', {
                        socketId: studentSocketId,
                        html: studentCode.html,
                        css: studentCode.css,
                        studentName: studentCode.studentName,
                        lastUpdate: studentCode.lastUpdate
                    });
                }

                console.log(`👨‍🏫 Teacher subscribed to student ${studentSocketId}`);

            } catch (error) {
                console.error('subscribe_to_student error:', error);
            }
        });

        // ========================================
        // code_update - Student types code
        // ========================================
        socket.on('code_update', async ({ html, css }) => {
            try {
                const session = inMemoryCache.get(socket.id);
                if (!session) {
                    return; // Student not properly joined
                }

                // 1. Update in-memory cache (instant, for teacher)
                inMemoryCache.set(socket.id, {
                    ...session,
                    html,
                    css,
                    lastUpdate: Date.now()
                });

                // 2. Emit ONLY to subscribed teachers (targeted, not broadcast)
                socket.to(`student:${socket.id}`).emit('student_code_update', {
                    socketId: socket.id,
                    html,
                    css,
                    timestamp: Date.now()
                });

                // 3. Debounced DB write (3s delay)
                if (debounceTimers.has(socket.id)) {
                    clearTimeout(debounceTimers.get(socket.id));
                }

                debounceTimers.set(socket.id, setTimeout(async () => {
                    try {
                        await CodeSession.updateOne(
                            { socketId: socket.id },
                            { html, css, lastUpdate: new Date() }
                        );
                        debounceTimers.delete(socket.id);
                    } catch (err) {
                        console.error('DB update error:', err);
                    }
                }, DEBOUNCE_DELAY));

            } catch (error) {
                console.error('code_update error:', error);
            }
        });

        // ========================================
        // get_student_list - Teacher requests student list
        // ========================================
        socket.on('get_student_list', ({ classCode }) => {
            try {
                const students = Array.from(inMemoryCache.values())
                    .filter(session => session.classCode === classCode)
                    .map(session => ({
                        socketId: session.socketId,
                        studentId: session.studentId,
                        studentName: session.studentName,
                        lastUpdate: session.lastUpdate
                    }));

                socket.emit('student_list', { students });
            } catch (error) {
                console.error('get_student_list error:', error);
            }
        });

        // ========================================
        // teacher_broadcast - Teacher sends message to all students
        // ========================================
        socket.on('teacher_broadcast', ({ classCode, message }) => {
            try {
                socket.to(classCode).emit('teacher_message', { message });
                console.log(`📢 Broadcast to ${classCode}: ${message}`);
            } catch (error) {
                console.error('teacher_broadcast error:', error);
            }
        });

        // ========================================
        // teacher_kick_student - Teacher kicks student
        // ========================================
        socket.on('teacher_kick_student', async ({ studentSocketId }) => {
            try {
                // Emit force disconnect to student
                classNamespace.to(studentSocketId).emit('force_disconnect', {
                    message: 'You were removed from the class by the teacher'
                });

                // Disconnect the student
                const studentSocket = classNamespace.sockets.get(studentSocketId);
                if (studentSocket) {
                    studentSocket.disconnect(true);
                }

                console.log(`❌ Student ${studentSocketId} kicked by teacher`);
            } catch (error) {
                console.error('teacher_kick_student error:', error);
            }
        });

        // ========================================
        // disconnect - Student leaves
        // ========================================
        socket.on('disconnect', async () => {
            try {
                const session = inMemoryCache.get(socket.id);
                if (!session) return;

                // Clear debounce timer
                if (debounceTimers.has(socket.id)) {
                    clearTimeout(debounceTimers.get(socket.id));
                    debounceTimers.delete(socket.id);
                }

                // Immediate DB write (preserve code before cleanup)
                try {
                    await CodeSession.updateOne(
                        { socketId: socket.id },
                        { html: session.html, css: session.css, lastUpdate: new Date() }
                    );
                } catch (err) {
                    console.error('Final DB save error:', err);
                }

                // Delete from cache
                inMemoryCache.delete(socket.id);

                // Notify room
                socket.to(session.classCode).emit('student_left', {
                    socketId: socket.id,
                    studentId: session.studentId,
                    studentName: session.studentName,
                    reason: 'disconnected'
                });

                console.log(`👋 ${session.studentName} left class ${session.classCode}`);
            } catch (error) {
                console.error('disconnect error:', error);
            }
        });
    });
};

module.exports = classHandlers;
