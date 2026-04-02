import { Router } from 'express';
import { dbGet, dbAll, dbRun } from '../database/index.js';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

const lessonSchema = z.object({
  instructorId: z.number(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  type: z.enum(['theory', 'practical']),
  maxStudents: z.number().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

// Get all lessons
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { date, instructorId, type } = req.query;
    let query = `
      SELECT l.*, u.firstName || ' ' || u.lastName as instructorName
      FROM lessons l
      JOIN users u ON l.instructorId = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (date) {
      query += ' AND l.date = ?';
      params.push(date);
    }

    if (instructorId) {
      query += ' AND l.instructorId = ?';
      params.push(instructorId);
    }

    if (type) {
      query += ' AND l.type = ?';
      params.push(type);
    }

    // Instructors only see their own lessons
    if (req.user!.role === 'instructor') {
      query += ' AND l.instructorId = ?';
      params.push(req.user!.id);
    }

    query += ' ORDER BY l.date, l.startTime';

    const lessons = await dbAll(query, params);
    res.json(lessons);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create lesson (Admin and Instructor)
router.post('/', authenticateToken, authorizeRoles('admin', 'instructor'), async (req, res) => {
  try {
    const lessonData = lessonSchema.parse(req.body);
    
    // Instructors can only create lessons for themselves
    if (req.user!.role === 'instructor' && lessonData.instructorId !== req.user!.id) {
      return res.status(403).json({ error: 'Can only create lessons for yourself' });
    }

    const result = await dbRun(
      `INSERT INTO lessons (instructorId, date, startTime, endTime, type, maxStudents, location, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lessonData.instructorId,
        lessonData.date,
        lessonData.startTime,
        lessonData.endTime,
        lessonData.type,
        lessonData.maxStudents || 1,
        lessonData.location,
        lessonData.notes,
      ]
    );

    res.status(201).json({ id: result.lastID, ...lessonData });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Update lesson
router.put('/:id', authenticateToken, authorizeRoles('admin', 'instructor'), async (req, res) => {
  try {
    const lessonId = parseInt(req.params.id);
    const { date, startTime, endTime, status, location, notes } = req.body;

    // Check if lesson exists and user has permission
    const lesson = await dbGet('SELECT * FROM lessons WHERE id = ?', [lessonId]);
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    if (req.user!.role === 'instructor' && lesson.instructorId !== req.user!.id) {
      return res.status(403).json({ error: 'Can only update your own lessons' });
    }

    await dbRun(
      `UPDATE lessons SET date = ?, startTime = ?, endTime = ?, status = ?, location = ?, notes = ? WHERE id = ?`,
      [date, startTime, endTime, status, location, notes, lessonId]
    );

    res.json({ message: 'Lesson updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete lesson
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'instructor'), async (req, res) => {
  try {
    const lessonId = parseInt(req.params.id);

    const lesson = await dbGet('SELECT * FROM lessons WHERE id = ?', [lessonId]);
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    if (req.user!.role === 'instructor' && lesson.instructorId !== req.user!.id) {
      return res.status(403).json({ error: 'Can only delete your own lessons' });
    }

    await dbRun('DELETE FROM lessons WHERE id = ?', [lessonId]);
    res.json({ message: 'Lesson deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
