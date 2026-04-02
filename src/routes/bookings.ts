import { Router } from 'express';
import { dbGet, dbAll, dbRun } from '../database/index.js';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get all bookings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { studentId, lessonId } = req.query;
    let query = `
      SELECT b.*, l.date, l.startTime, l.endTime, l.type, l.location,
             u.firstName || ' ' || u.lastName as studentName,
             i.firstName || ' ' || i.lastName as instructorName
      FROM bookings b
      JOIN lessons l ON b.lessonId = l.id
      JOIN users u ON b.studentId = u.id
      JOIN users i ON l.instructorId = i.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (studentId) {
      query += ' AND b.studentId = ?';
      params.push(studentId);
    }

    if (lessonId) {
      query += ' AND b.lessonId = ?';
      params.push(lessonId);
    }

    // Students only see their own bookings
    if (req.user!.role === 'student') {
      query += ' AND b.studentId = ?';
      params.push(req.user!.id);
    }

    // Instructors see bookings for their lessons
    if (req.user!.role === 'instructor') {
      query += ' AND l.instructorId = ?';
      params.push(req.user!.id);
    }

    query += ' ORDER BY l.date, l.startTime';

    const bookings = await dbAll(query, params);
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create booking (Students only)
router.post('/', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const { lessonId, notes } = req.body;
    const studentId = req.user!.id;

    // Check if lesson exists and is available
    const lesson = await dbGet('SELECT * FROM lessons WHERE id = ?', [lessonId]);
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    if (lesson.status !== 'available') {
      return res.status(400).json({ error: 'Lesson is not available' });
    }

    // Check if student already booked this lesson
    const existingBooking = await dbGet(
      'SELECT * FROM bookings WHERE lessonId = ? AND studentId = ?',
      [lessonId, studentId]
    );
    if (existingBooking) {
      return res.status(400).json({ error: 'Already booked this lesson' });
    }

    // Check if lesson is full
    const bookingCount = await dbGet(
      'SELECT COUNT(*) as count FROM bookings WHERE lessonId = ? AND status = ?',
      [lessonId, 'confirmed']
    );
    if (bookingCount.count >= lesson.maxStudents) {
      return res.status(400).json({ error: 'Lesson is full' });
    }

    const result = await dbRun(
      'INSERT INTO bookings (lessonId, studentId, notes) VALUES (?, ?, ?)',
      [lessonId, studentId, notes]
    );

    // Update lesson status if full
    if (bookingCount.count + 1 >= lesson.maxStudents) {
      await dbRun("UPDATE lessons SET status = 'booked' WHERE id = ?", [lessonId]);
    }

    res.status(201).json({ id: result.lastID, lessonId, studentId, notes, status: 'confirmed' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Cancel booking (Students can cancel their own, admins can cancel any)
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    
    const booking = await dbGet('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Students can only cancel their own bookings
    if (req.user!.role === 'student' && booking.studentId !== req.user!.id) {
      return res.status(403).json({ error: 'Can only cancel your own bookings' });
    }

    await dbRun("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [bookingId]);

    // Update lesson status back to available
    await dbRun("UPDATE lessons SET status = 'available' WHERE id = ?", [booking.lessonId]);

    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update booking status (Admin and Instructors)
router.put('/:id/status', authenticateToken, authorizeRoles('admin', 'instructor'), async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const { status } = req.body;

    const booking = await dbGet('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Instructors can only update bookings for their lessons
    if (req.user!.role === 'instructor') {
      const lesson = await dbGet('SELECT * FROM lessons WHERE id = ?', [booking.lessonId]);
      if (lesson.instructorId !== req.user!.id) {
        return res.status(403).json({ error: 'Can only update bookings for your lessons' });
      }
    }

    await dbRun('UPDATE bookings SET status = ? WHERE id = ?', [status, bookingId]);
    res.json({ message: 'Booking status updated' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
