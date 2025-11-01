-- Additional performance indexes beyond what's in schema.sql

-- Users table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_employee_id ON users(employee_id);

-- Projects table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_severity ON projects(severity);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_location ON projects(location);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_department ON projects(department);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_created_at ON projects(created_at);

-- Form records table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_form_records_submitted_at ON form_records(submitted_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_form_records_data_gin ON form_records USING GIN (data);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_form_records_updates_gin ON form_records USING GIN (updates);

-- Partial indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_form_records_open ON form_records(status) WHERE status = 'Open';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_form_records_in_progress ON form_records(status) WHERE status = 'In Progress';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_form_records_closed ON form_records(status) WHERE status = 'Closed';

-- Training materials table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_training_materials_file_type ON training_materials(file_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_training_materials_uploaded_by ON training_materials(uploaded_by);

-- Training material views table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_training_material_views_viewed_at ON training_material_views(viewed_at);

-- Notifications table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_target_role ON notifications(target_role);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Training assignments table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_training_assignments_status ON training_assignments(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_training_assignments_assigned_at ON training_assignments(assigned_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_training_assignments_due_date ON training_assignments(due_date);

-- Safety drills table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_safety_drills_due_date ON safety_drills(due_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_safety_drills_created_at ON safety_drills(created_at);

-- Worker drills table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_worker_drills_status ON worker_drills(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_worker_drills_completed_at ON worker_drills(completed_at);

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_form_records_project_status ON form_records(project_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_form_records_project_type ON form_records(project_id, form_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_form_records_submitter_status ON form_records(submitted_by_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_training_materials_project_created ON training_materials(project_id, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_worker_drills_worker_status ON worker_drills(worker_id, status);

-- GIN indexes for JSON array operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_worker_drills_completed_steps_gin ON worker_drills USING GIN (completed_steps);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_safety_drills_steps_gin ON safety_drills USING GIN (steps);

-- Indexes for date range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_form_records_submitted_at_date ON form_records(DATE(submitted_at));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_created_at_date ON notifications(DATE(created_at));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_training_assignments_due_date_date ON training_assignments(DATE(due_date));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_safety_drills_due_date_date ON safety_drills(DATE(due_date));