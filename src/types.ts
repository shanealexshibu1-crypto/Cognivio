export type UserRole = 'student' | 'teacher' | 'monitor' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  age: number;
  grade?: string;
  section?: string;
  assignedTeacher?: string;
  onboarded: boolean;
  pinCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NutritionReport {
  id?: string;
  monitorId: string;
  monitorName?: string;
  teacherName?: string;
  classId: string;
  section: string;
  totalStudents: number;
  presentStudents: number;
  adequateCarbs: number;
  adequateProteins: number;
  adequateFats: number;
  adequateWater: number;
  junkFoodCount: number;
  healthScore?: number;
  date: string;
  createdAt: any;
}

export interface StudentJournal {
  id?: string;
  studentId: string;
  grade?: string;
  section?: string;
  date: string;
  mood: number;
  stress: number;
  energy: number;
  sleep: number;
  focus: number;
  happiness: number;
  anxiety: number;
  social: number;
  motivation: number;
  note: string;
}

export interface AIRecommendation {
  type: 'nutrition' | 'wellness' | 'emotional';
  title: string;
  content: string;
  impactLevel: 'low' | 'medium' | 'high';
}

export interface WellnessAlert {
  id?: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  status: 'pending' | 'resolved';
  journalId: string;
  snapshot: {
    mood: number;
    stress: number;
    energy: number;
  };
  createdAt: any;
  resolvedAt?: any;
  privateNote?: string;
}