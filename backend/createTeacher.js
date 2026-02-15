require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const createTeacher = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Check if teacher already exists
        const existing = await User.findOne({ email: 'teacher@test.com' });
        if (existing) {
            console.log('ℹ️  Teacher account already exists');
            process.exit(0);
        }

        // Create teacher
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('test123', salt);

        await User.create({
            email: 'teacher@test.com',
            passwordHash,
            role: 'teacher'
        });

        console.log('\n✅ Teacher account created successfully!');
        console.log('📧 Email: teacher@test.com');
        console.log('🔑 Password: test123\n');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

createTeacher();
