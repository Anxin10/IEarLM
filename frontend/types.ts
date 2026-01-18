
export enum UserRole {
  OWNER = 'OWNER',   // 系統管理員 (Tier 1)
  MANAGER = 'MANAGER', // 一般管理員 (Tier 2)
  USER = 'USER'     // 使用者/醫師 (Tier 3)
}

export type UserStatus = 'active' | 'suspended' | 'invited';

export type Language = 'en' | 'zh';

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  avatar?: string;
  email: string;
  department: string;
  status: UserStatus;
  lastLogin?: string;
}

// New Types for Bilateral Exam Workflow
export type EarSide = 'left' | 'right';
export type ExamStatus = 'pending' | 'draft' | 'completed';

export interface Lesion {
  region: 'EAC' | 'TM';
  code: string;
  label_zh: string;
  label_en: string;
  is_normal: boolean;
  is_custom?: boolean;
  percentage?: number;
}

export interface EarExamRecord {
  status: ExamStatus;
  imageUrl?: string | null; // Changed: Allow null for explicit deletion
  diagnosis: string; // Summary string for list view
  detailedFindings?: { // New structured data
    EAC: Lesion[];
    TM: Lesion[];
  };
  notes: string;
  segmentationData?: {
    label: string;
    confidence: number;
    path: string;
    color: string;
  }[];
  lastUpdated?: string;
}

export interface ClinicalOrder {
  id: string;
  type: 'medication' | 'procedure' | 'referral' | 'observation';
  text: string;
  status: 'pending' | 'completed' | 'cancelled';
}

export interface EncounterShared {
  impression: string;
  orders: ClinicalOrder[];
  generalNotes: string;
}

export interface Patient {
  id: string;
  dbId?: number; // Internal Database ID
  name: string;
  birthDate?: string; // New field for DOB
  age: number;        // Calculated from birthDate
  gender: 'Male' | 'Female';
  visitDate: string;

  // Legacy fields kept for compatibility/summary
  diagnosis: string;
  status: 'Critical' | 'Stable' | 'Recovered';
  imageUrl: string;
  notes: string;
  segmentationData?: {
    label: string;
    confidence: number;
    path: string;
    color: string;
  }[];

  // New Structure for Bilateral Workflow
  exams?: {
    left: EarExamRecord;
    right: EarExamRecord;
    shared?: EncounterShared;
  };
  reportStatus?: 'none' | 'generated';
}

// Data model for the A4 Report Editor
export interface ReportData {
  patient_id: string;
  patient_name: string;
  visit_year: string;
  visit_month: string;
  visit_day: string;
  doctor_name: string;

  right_ear_eac: string;
  left_ear_eac: string;

  right_ear_tm: string;
  left_ear_tm: string;
  right_tm_percent: string;
  left_tm_percent: string;

  diagnosis: string;
  orders: string;
}

export interface DashboardStats {
  totalPatients: number;
  criticalCases: number;
  aiAccuracy: number;
  newPatientsThisMonth?: number;
  generatedReportsCount?: number;
  monthlyVisits: { name: string; visits: number }[];
  diseaseDistribution: { name: string; value: number }[];
  recentCases?: {
    id: string;
    patientName: string;
    diagnosis: string;
    date: string;
    status: string;
  }[];
}
