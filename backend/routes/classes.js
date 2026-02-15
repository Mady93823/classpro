const express = require('express');
const { body, validationResult } = require('express-validator');
const Class = require('../models/Class');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// All routes are protected
router.use(authMiddleware);

// @route   POST /api/classes
// @desc    Create new class
// @access  Private (Teacher)
router.post('/',
    [
        body('className')
            .trim()
            .notEmpty().withMessage('Class name is required')
            .isLength({ max: 100 }).withMessage('Class name cannot exceed 100 characters')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, errors: errors.array() });
            }

            const { className } = req.body;

            const newClass = new Class({
                className,
                teacherId: req.userId
            });

            await newClass.save();

            res.status(201).json({
                success: true,
                message: 'Class created successfully',
                class: {
                    id: newClass._id,
                    className: newClass.className,
                    classCode: newClass.classCode,
                    isActive: newClass.isActive,
                    createdAt: newClass.createdAt
                }
            });

        } catch (error) {
            console.error('Create class error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
);

// @route   GET /api/classes
// @desc    Get all classes for logged-in teacher
// @access  Private (Teacher)
router.get('/', async (req, res) => {
    try {
        const classes = await Class.find({ teacherId: req.userId })
            .sort({ createdAt: -1 })
            .select('-__v');

        res.json({
            success: true,
            count: classes.length,
            classes
        });

    } catch (error) {
        console.error('Get classes error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   PATCH /api/classes/:id
// @desc    Update class (name or isActive)
// @access  Private (Teacher)
router.patch('/:id', async (req, res) => {
    try {
        const { className, isActive } = req.body;
        const classDoc = await Class.findById(req.params.id);

        if (!classDoc) {
            return res.status(404).json({ success: false, message: 'Class not found' });
        }

        // Ensure owner
        if (classDoc.teacherId.toString() !== req.userId) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        if (className !== undefined) {
            classDoc.className = className;
        }
        if (isActive !== undefined) {
            classDoc.isActive = isActive;
        }

        await classDoc.save();

        res.json({
            success: true,
            message: 'Class updated successfully',
            class: classDoc
        });

    } catch (error) {
        console.error('Update class error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   DELETE /api/classes/:id
// @desc    Delete class
// @access  Private (Teacher)
router.delete('/:id', async (req, res) => {
    try {
        const classDoc = await Class.findById(req.params.id);

        if (!classDoc) {
            return res.status(404).json({ success: false, message: 'Class not found' });
        }

        // Ensure owner
        if (classDoc.teacherId.toString() !== req.userId) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        await classDoc.deleteOne();

        res.json({
            success: true,
            message: 'Class deleted successfully'
        });

    } catch (error) {
        console.error('Delete class error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
