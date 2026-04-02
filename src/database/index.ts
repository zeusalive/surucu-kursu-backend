import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../data/database.sqlite');

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

export const dbRun = promisify(db.run.bind(db));
export const dbGet = promisify(db.get.bind(db));
export const dbAll = promisify(db.all.bind(db));

export function initializeDatabase(): void {
  db.serialize(() => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        phone TEXT,
        role TEXT CHECK(role IN ('admin', 'instructor', 'student')) NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Instructors additional info
    db.run(`
      CREATE TABLE IF NOT EXISTS instructors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        licenseNumber TEXT,
        specialization TEXT,
        experience INTEGER,
        bio TEXT,
        isActive BOOLEAN DEFAULT 1,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Students additional info
    db.run(`
      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        registrationDate DATE DEFAULT CURRENT_DATE,
        licenseType TEXT,
        theoryProgress INTEGER DEFAULT 0,
        practicalProgress INTEGER DEFAULT 0,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Lesson schedules
    db.run(`
      CREATE TABLE IF NOT EXISTS lessons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instructorId INTEGER NOT NULL,
        date DATE NOT NULL,
        startTime TIME NOT NULL,
        endTime TIME NOT NULL,
        type TEXT CHECK(type IN ('theory', 'practical')) NOT NULL,
        status TEXT CHECK(status IN ('available', 'booked', 'completed', 'cancelled')) DEFAULT 'available',
        maxStudents INTEGER DEFAULT 1,
        location TEXT,
        notes TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (instructorId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Bookings
    db.run(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lessonId INTEGER NOT NULL,
        studentId INTEGER NOT NULL,
        status TEXT CHECK(status IN ('confirmed', 'cancelled', 'completed', 'no_show')) DEFAULT 'confirmed',
        notes TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lessonId) REFERENCES lessons(id) ON DELETE CASCADE,
        FOREIGN KEY (studentId) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(lessonId, studentId)
      )
    `);

    // Insert default admin
    db.get("SELECT * FROM users WHERE email = ?", ['admin@surucukursu.com'], (err, row) => {
      if (!row) {
        db.run(`
          INSERT INTO users (email, password, firstName, lastName, role)
          VALUES (?, ?, ?, ?, ?)
        `, ['admin@surucukursu.com', '$2a$10$YourHashedPasswordHere', 'Admin', 'User', 'admin']);
      }
    });
  });
}
