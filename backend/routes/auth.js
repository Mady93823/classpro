const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new teacher
// @access  Public
router.post('/register',
    [
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    ],
    async (req, res) => {
        try {
            // Validate input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, errors: errors.array() });
            }

            const { email, password } = req.body;

            // Check if user exists
            let user = await User.findOne({ email });
            if (user) {
                return res.status(400).json({
                    success: false,
                    message: 'User already exists with this email'
                });
            }

            // Hash password
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);

            // Create user
            user = await User.create({
                email,
                passwordHash,
                role: 'teacher'
            });

            res.status(201).json({
                success: true,
                message: 'Teacher account created successfully',
                user: {
                    id: user._id,
                    email: user.email,
                    role: user.role
                }
            });

        } catch (error) {
            console.error('Register error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
);

// @route   POST /api/auth/login
// @desc    Authenticate teacher and get token
// @access  Public
router.post('/login',
    [
        body('email').isEmail().normalizeEmail(),
        body('password').notEmpty().withMessage('Password is required')
    ],
    async (req, res) => {
        try {
            // Validate input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, errors: errors.array() });
            }

            const { email, password } = req.body;

            // Check if user exists
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            // Verify password
            const isMatch = await bcrypt.compare(password, user.passwordHash);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            // Generate JWT
            const payload = {
                id: user._id,
                email: user.email,
                role: user.role
            };

            const token = jwt.sign(
                payload,
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRE || '7d' }
            );

            res.json({
                success: true,
                token,
                user: {
                    id: user._id,
                    email: user.email,
                    role: user.role
                }
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
);

module.exports = router;
