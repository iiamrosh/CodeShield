




export enum Page {
  Splash,
  Auth,
  ProjectHub,
  NewProject,
  SafetyOfficerDashboard,
  Form,
  HOManagerDashboard,
  TopManagerDashboard,
  WorkerDashboard,
  EditProfile,
  EditProject,
  ModuleLanding,
  IssueList,
  IssueDetail,
  ModuleSelection,
  ReportsDashboard,
  DraftList,
  TrainingMaterials,
  SafetyDrillsManagement,
  CreateSafetyDrill,
}

export enum FormType {
  SafetyObservations = "Safety Observations",
  InductionTraining = "Induction Training",
  DailyTrainingTalks = "Daily Training Talks",
  FirstAidCases = "First Aid Cases",
  PEPTalks = "PEP Talks",
  SpecialTechnicalTraining = "Special Technical Training",
  SafetyAdvisory = "Safety Advisory",
  StopWorkOrders = "Stop Work Orders",
  Rectifications = "Rectifications",
  NearMissReports = "Near Miss Reports",
  DangerousOccurrences = "Dangerous Occurrences",
  SICMeetings = "SIC Meetings",
  GoodPractices = "Good Practices",
  Reports = "Reports",
}

export type UserRole = 'Site Safety Officer' | 'HO middle Managers' | 'Top Managers' | 'Workers';

export interface User {
  id: string;
  fullName: string;
  employeeId: string;
  emergencyContact: string;
  role: UserRole;
  profilePhotoUrl?: string;
}

export interface Project {
  id: string;
  name: string;
  project_id: string;
  status: 'Ongoing' | 'Completed';
  severity: 'Safe' | 'Medium' | 'Critical';
  location: string;
  department: string;
  created_by: string | { id: string; full_name: string };
  created_at: string;
}

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date' | 'photo' | 'readonly' | 'number';
  options?: string[];
  placeholder?: string;
  required?: boolean;
}

export interface StatusUpdate {
  updatedBy: string;
  timestamp: string;
  status: 'Open' | 'In Progress' | 'Closed';
  notes: string;
}

export interface FormRecord {
  id: string;
  form_type: FormType;
  project_id: string;
  submitted_by_id: string | { id: string; full_name: string };
  data: Record<string, any>;
  submitted_at: string;
  status: 'Open' | 'In Progress' | 'Closed';
  updates: StatusUpdate[];
}

export interface DraftRecord {
  id?: number; // Auto-incremented by Dexie
  form_type: FormType;
  project_id: string;
  data: Record<string, any>;
  fileData: Record<string, File | null>;
  saved_at: string;
}

export interface TrainingMaterial {
  id: string;
  project_id: string;
  uploaded_by: string;
  title: string;
  description: string;
  file_url: string;
  file_type: 'pdf' | 'video' | 'image' | 'other';
  created_at: string;
  view_count?: number;
}

export interface Notification {
  id: string;
  project_id?: string;
  user_id?: string;
  target_role?: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// New types for Worker Dashboard features

export enum TrainingStatus {
  NotStarted = 'Not Started',
  InProgress = 'In Progress',
  Completed = 'Completed',
}

export interface TrainingAssignment {
  id: string;
  worker_id: string;
  material_id: string;
  status: TrainingStatus;
  assigned_at: string;
  due_date?: string;
  training_materials: TrainingMaterial; // Joined data
}

export enum DrillStatus {
  Pending = 'Pending',
  Completed = 'Completed',
}

export interface SafetyDrill {
  id: string;
  project_id: string;
  title: string;
  description: string;
  due_date?: string;
  created_at: string;
  steps: string[];
}

export interface WorkerDrill {
  id: string;
  worker_id: string;
  drill_id: string;
  status: DrillStatus;
  completed_at?: string;
  completed_steps: number[];
}