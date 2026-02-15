const mongoose = require('mongoose');

const codeSessionSchema = new mongoose.Schema({
    studentId: {
        type: String,
        required: true,
        unique: true  // UUID v4
    },
    studentName: {
        type: String,
        required: [true, 'Student name is required'],
        trim: true,
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    classCode: {
        type: String,
        required: true,
        uppercase: true
    },
    socketId: {
        type: String,
        required: true,
        unique: true
    },
    html: {
        type: String,
        default: ''
    },
    css: {
        type: String,
        default: ''
    },
    lastUpdate: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        index: { expires: 0 } // TTL index: auto-delete when expiresAt is reached
    }
});

module.exports = mongoose.model('CodeSession', codeSessionSchema);
