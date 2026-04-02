import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { dbGet, dbRun } from '../database/index.js';
import { generateToken } from '../middleware/auth.js';
import { z } from 'zod';

import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  phone: z.string().optional(),
  role: z.enum(['admin', 'instructor', 'student']),
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    
    if (!user) {
      // Check default passwords for demo
      let role = '';
      let validPassword = false;
      
      if (email === 'admin@surucukursu.com' && password === 'admin123') {
        role = 'admin';
        validPassword = true;
      } else if (email === 'instructor@surucukursu.com' && password === 'instructor123') {
        role = 'instructor';
        validPassword = true;
      } else if (email === 'student@surucukursu.com' && password === 'student123') {
        role = 'student';
        validPassword = true;
      }
      
      if (validPassword) {
        // Create demo user if not exists
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await dbRun(
          'INSERT INTO users (email, password, firstName, lastName, role) VALUES (?, ?, ?, ?, ?)',
          [email, hashedPassword, role === 'admin' ? 'Admin' : role === 'instructor' ? 'Eğitmen' : 'Öğrenci', 'Demo', role]
        );
        
        const token = generateToken(result.lastID || 1, email, role);
        return res.json({
          token,
          user: {
            id: result.lastID || 1,
            email,
            firstName: role === 'admin' ? 'Admin' : role === 'instructor' ? 'Eğitmen' : 'Öğrenci',
            lastName: 'Demo',
            role,
          },
        });
      }
      
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    
    // Fallback for demo passwords
    let isValid = validPassword;
    if (!validPassword) {
      if ((email === 'admin@surucukursu.com' && password === 'admin123') ||
          (email === 'instructor@surucukursu.com' && password === 'instructor123') ||
          (email === 'student@surucukursu.com' && password === 'student123')) {
        isValid = true;
      }
    }
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id, user.email, user.role);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Register - Admin only
router.post('/register', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role } = registerSchema.parse(req.body);

    const existingUser = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role || 'student';

    const result = await dbRun(
      'INSERT INTO users (email, password, firstName, lastName, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, firstName, lastName, phone, userRole]
    );

    if (userRole === 'student') {
      await dbRun('INSERT INTO students (userId) VALUES (?)', [result.lastID]);
    } else if (userRole === 'instructor') {
      await dbRun('INSERT INTO instructors (userId) VALUES (?)', [result.lastID]);
    }

    const token = generateToken(result.lastID as number, email, userRole);

    res.status(201).json({
      token,
      user: {
        id: result.lastID,
        email,
        firstName,
        lastName,
        role: userRole,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
