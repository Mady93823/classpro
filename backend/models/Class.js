const mongoose = require('mongoose');
const crypto = require('crypto');

const classSchema = new mongoose.Schema({
    className: {
        type: String,
        required: [true, 'Class name is required'],
        trim: true,
        maxlength: [100, 'Class name cannot exceed 100 characters']
    },
    classCode: {
        type: String,
        unique: true,
        uppercase: true,
        length: 6
    },
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isActive: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Auto-generate unique 6-character class code before saving
classSchema.pre('save', async function () {
    if (!this.classCode) {
        let code;
        let exists = true;

        // Generate unique code
        while (exists) {
            code = crypto.randomBytes(3).toString('hex').toUpperCase();
            exists = await mongoose.model('Class').findOne({ classCode: code });
        }

        this.classCode = code;
    }

    this.updatedAt = Date.now();
});

module.exports = mongoose.model('Class', classSchema);
