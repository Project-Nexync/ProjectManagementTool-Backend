import express from 'express';
import db from '../config/db.config.js';

const router = express.Router();

router.get('/check-db', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ success: true, message: 'Database connection successful' });
    } catch (error) {
        console.error('Database connection error:', error);
        res.status(500).json({ success: false, message: 'Database connection failed', error: error.message });
    }
});

export default router;