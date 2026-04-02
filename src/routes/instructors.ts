import { Router } from 'express';
import { dbGet, dbAll, dbRun } from '../database/index.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = Router();

// Get all instructors
router.get('/', authenticateToken, async (req, res) => {
  try {
    const instructors = await dbAll(`
      SELECT u.id, u.email, u.firstName, u.lastName, u.phone, u.createdAt,
             i.licenseNumber, i.specialization, i.experience, i.bio, i.isActive
      FROM users u
      JOIN instructors i ON u.id = i.userId
      WHERE u.role = 'instructor'
      ORDER BY u.firstName, u.lastName
    `);
    res.json(instructors);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get instructor by ID with schedule
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const instructorId = parseInt(req.params.id);

    const instructor = await dbGet(`
      SELECT u.id, u.email, u.firstName, u.lastName, u.phone, u.createdAt,
             i.licenseNumber, i.specialization, i.experience, i.bio, i.isActive
      FROM users u
      JOIN instructors i ON u.id = i.userId
      WHERE u.id = ? AND u.role = 'instructor'
    `, [instructorId]);

    if (!instructor) {
      return res.status(404).json({ error: 'Instructor not found' });
    }

    // Get upcoming lessons
    const lessons = await dbAll(`
      SELECT * FROM lessons
      WHERE instructorId = ? AND date >= date('now')
      ORDER BY date, startTime
    `, [instructorId]);

    instructor.schedule = lessons;

    res.json(instructor);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update instructor info (Admin only)
router.put('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const instructorId = parseInt(req.params.id);
    const { licenseNumber, specialization, experience, bio, isActive } = req.body;

    await dbRun(
      `UPDATE instructors SET licenseNumber = ?, specialization = ?, experience = ?, bio = ?, isActive = ?
       WHERE userId = ?`,
      [licenseNumber, specialization, experience, bio, isActive, instructorId]
    );

    res.json({ message: 'Instructor updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
