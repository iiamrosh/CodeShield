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
  projectId: string;
  status: 'Ongoing' | 'Completed';
  severity: 'Safe' | 'Medium' | 'Critical';
  location: string;
  department: string;
  createdBy: string;
  createdAt: string;
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
  formType: FormType;
  projectId: string;
  submittedById: string;
  data: Record<string, any>;
  submittedAt: string;
  status: 'Open' | 'In Progress' | 'Closed';
  updates: StatusUpdate[];
}