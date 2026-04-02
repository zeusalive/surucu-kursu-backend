import { Router, Request, Response } from 'express';
import { dbGet, dbAll, dbRun } from '../database/index.js';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

// Get all users (Admin only)
router.get('/', authenticateToken, authorizeRoles('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const users = await dbAll(
      'SELECT id, email, firstName, lastName, phone, role, createdAt FROM users ORDER BY createdAt DESC'
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Users can only view their own profile unless they're admin
    if (req.user!.role !== 'admin' && req.user!.id !== userId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const user = await dbGet(
      'SELECT id, email, firstName, lastName, phone, role, createdAt FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get additional info based on role
    if (user.role === 'instructor') {
      const instructor = await dbGet('SELECT * FROM instructors WHERE userId = ?', [userId]);
      user.instructorInfo = instructor;
    } else if (user.role === 'student') {
      const student = await dbGet('SELECT * FROM students WHERE userId = ?', [userId]);
      user.studentInfo = student;
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (req.user!.role !== 'admin' && req.user!.id !== userId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { firstName, lastName, phone } = req.body;

    await dbRun(
      'UPDATE users SET firstName = ?, lastName = ?, phone = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [firstName, lastName, phone, userId]
    );

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete user (Admin only)
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    
    await dbRun('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
