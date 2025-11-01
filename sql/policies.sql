-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_material_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_drills ENABLE ROW LEVEL SECURITY;

-- Users policies
-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Allow authenticated users to insert (for signup)
CREATE POLICY "Allow authenticated users to insert" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Projects policies
-- All authenticated users can view projects
CREATE POLICY "All authenticated users can view projects" ON projects
    FOR SELECT TO authenticated USING (true);

-- Only Site Safety Officers and above can create projects
CREATE POLICY "Site Safety Officers and above can create projects" ON projects
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('Site Safety Officer', 'HO middle Managers', 'Top Managers')
        )
    );

-- Only project creators and managers can update projects
CREATE POLICY "Project creators and managers can update projects" ON projects
    FOR UPDATE TO authenticated USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('HO middle Managers', 'Top Managers')
        )
    );

-- Only managers can delete projects
CREATE POLICY "Managers can delete projects" ON projects
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('HO middle Managers', 'Top Managers')
        )
    );

-- Form records policies
-- All authenticated users can view form records for projects they have access to
CREATE POLICY "Users can view form records for accessible projects" ON form_records
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = form_records.project_id
            AND (
                p.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM users u
                    WHERE u.id = auth.uid()
                    AND u.role IN ('Site Safety Officer', 'HO middle Managers', 'Top Managers')
                )
            )
        )
    );

-- All authenticated users can insert form records
CREATE POLICY "Authenticated users can insert form records" ON form_records
    FOR INSERT TO authenticated WITH CHECK (
        submitted_by_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_id
        )
    );

-- Users can update form records they submitted or managers can update any
CREATE POLICY "Users can update their form records or managers any" ON form_records
    FOR UPDATE TO authenticated USING (
        submitted_by_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role IN ('Site Safety Officer', 'HO middle Managers', 'Top Managers')
        )
    );

-- Only managers can delete form records
CREATE POLICY "Managers can delete form records" ON form_records
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role IN ('HO middle Managers', 'Top Managers')
        )
    );

-- Training materials policies
-- All authenticated users can view training materials for their projects
CREATE POLICY "Users can view training materials for accessible projects" ON training_materials
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = training_materials.project_id
            AND (
                p.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM users u
                    WHERE u.id = auth.uid()
                    AND u.role IN ('Site Safety Officer', 'HO middle Managers', 'Top Managers')
                )
            )
        )
    );

-- Only managers can insert training materials
CREATE POLICY "Managers can insert training materials" ON training_materials
    FOR INSERT TO authenticated WITH CHECK (
        uploaded_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role IN ('Site Safety Officer', 'HO middle Managers', 'Top Managers')
        )
    );

-- Only managers can delete training materials
CREATE POLICY "Managers can delete training materials" ON training_materials
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role IN ('Site Safety Officer', 'HO middle Managers', 'Top Managers')
        )
    );

-- Training material views policies
-- Workers can view their own training views
CREATE POLICY "Workers can view own training views" ON training_material_views
    FOR SELECT TO authenticated USING (worker_id = auth.uid());

-- Workers can insert their own training views
CREATE POLICY "Workers can insert own training views" ON training_material_views
    FOR INSERT TO authenticated WITH CHECK (worker_id = auth.uid());

-- Workers can update their own training views
CREATE POLICY "Workers can update own training views" ON training_material_views
    FOR UPDATE TO authenticated USING (worker_id = auth.uid());

-- Notifications policies
-- Users can view notifications targeted to them or their role
CREATE POLICY "Users can view relevant notifications" ON notifications
    FOR SELECT TO authenticated USING (
        user_id = auth.uid() OR
        (user_id IS NULL AND target_role = (SELECT role FROM users WHERE id = auth.uid())) OR
        (user_id IS NULL AND target_role IS NULL)
    );

-- Managers can insert notifications
CREATE POLICY "Managers can insert notifications" ON notifications
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role IN ('Site Safety Officer', 'HO middle Managers', 'Top Managers')
        )
    );

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE TO authenticated USING (
        user_id = auth.uid() OR
        (user_id IS NULL AND target_role = (SELECT role FROM users WHERE id = auth.uid()))
    );

-- Training assignments policies
-- Workers can view their own assignments
CREATE POLICY "Workers can view own assignments" ON training_assignments
    FOR SELECT TO authenticated USING (worker_id = auth.uid());

-- Managers can view all assignments
CREATE POLICY "Managers can view all assignments" ON training_assignments
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role IN ('Site Safety Officer', 'HO middle Managers', 'Top Managers')
        )
    );

-- Managers can insert assignments
CREATE POLICY "Managers can insert assignments" ON training_assignments
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role IN ('Site Safety Officer', 'HO middle Managers', 'Top Managers')
        )
    );

-- Workers can update their own assignments
CREATE POLICY "Workers can update own assignments" ON training_assignments
    FOR UPDATE TO authenticated USING (worker_id = auth.uid());

-- Safety drills policies
-- All authenticated users can view safety drills for their projects
CREATE POLICY "Users can view safety drills for accessible projects" ON safety_drills
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = safety_drills.project_id
            AND (
                p.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM users u
                    WHERE u.id = auth.uid()
                    AND u.role IN ('Site Safety Officer', 'HO middle Managers', 'Top Managers')
                )
            )
        )
    );

-- Managers can insert safety drills
CREATE POLICY "Managers can insert safety drills" ON safety_drills
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role IN ('Site Safety Officer', 'HO middle Managers', 'Top Managers')
        )
    );

-- Managers can delete safety drills
CREATE POLICY "Managers can delete safety drills" ON safety_drills
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role IN ('Site Safety Officer', 'HO middle Managers', 'Top Managers')
        )
    );

-- Worker drills policies
-- Workers can view their own drill progress
CREATE POLICY "Workers can view own drill progress" ON worker_drills
    FOR SELECT TO authenticated USING (worker_id = auth.uid());

-- Managers can view all drill progress
CREATE POLICY "Managers can view all drill progress" ON worker_drills
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role IN ('Site Safety Officer', 'HO middle Managers', 'Top Managers')
        )
    );

-- Workers can insert/update their own drill progress
CREATE POLICY "Workers can manage own drill progress" ON worker_drills
    FOR ALL TO authenticated USING (worker_id = auth.uid()) WITH CHECK (worker_id = auth.uid());