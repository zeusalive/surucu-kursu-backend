export interface User {
  id: number;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'admin' | 'instructor' | 'student';
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'admin' | 'instructor' | 'student';
}

export interface Instructor {
  id: number;
  userId: number;
  licenseNumber?: string;
  specialization?: string;
  experience?: number;
  bio?: string;
  isActive: boolean;
}

export interface Student {
  id: number;
  userId: number;
  registrationDate: string;
  licenseType?: string;
  theoryProgress: number;
  practicalProgress: number;
}

export interface Lesson {
  id: number;
  instructorId: number;
  date: string;
  startTime: string;
  endTime: string;
  type: 'theory' | 'practical';
  status: 'available' | 'booked' | 'completed' | 'cancelled';
  maxStudents: number;
  location?: string;
  notes?: string;
  createdAt: string;
}

export interface Booking {
  id: number;
  lessonId: number;
  studentId: number;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  notes?: string;
  createdAt: string;
}

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}
