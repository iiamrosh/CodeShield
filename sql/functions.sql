-- Function to get email from employee ID for authentication
CREATE OR REPLACE FUNCTION get_email_from_employee_id(p_employee_id TEXT)
RETURNS TEXT AS $$
DECLARE
    user_email TEXT;
BEGIN
    SELECT raw_user_meta_data->>'email' INTO user_email
    FROM auth.users
    WHERE raw_user_meta_data->>'employee_id' = p_employee_id;

    RETURN user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete form record by ID (bypasses RLS for managers)
CREATE OR REPLACE FUNCTION delete_form_record_by_id(record_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    record_exists BOOLEAN := FALSE;
BEGIN
    -- Check if user is a manager
    SELECT role INTO user_role
    FROM users
    WHERE id = auth.uid();

    IF user_role NOT IN ('HO middle Managers', 'Top Managers') THEN
        RAISE EXCEPTION 'Access denied. Only managers can delete form records.';
    END IF;

    -- Check if record exists
    SELECT EXISTS(SELECT 1 FROM form_records WHERE id = record_id) INTO record_exists;

    IF NOT record_exists THEN
        RAISE EXCEPTION 'Form record not found.';
    END IF;

    -- Delete the record
    DELETE FROM form_records WHERE id = record_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user role (helper function)
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM users
    WHERE id = auth.uid();

    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get projects accessible to current user
CREATE OR REPLACE FUNCTION get_accessible_projects()
RETURNS TABLE (
    id UUID,
    name TEXT,
    project_id TEXT,
    status TEXT,
    severity TEXT,
    location TEXT,
    department TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.name, p.project_id, p.status, p.severity, p.location, p.department, p.created_by, p.created_at, p.updated_at
    FROM projects p
    WHERE p.created_by = auth.uid()
       OR EXISTS (
           SELECT 1 FROM users u
           WHERE u.id = auth.uid()
           AND u.role IN ('Site Safety Officer', 'HO middle Managers', 'Top Managers')
       );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get form records for accessible projects
CREATE OR REPLACE FUNCTION get_accessible_form_records()
RETURNS TABLE (
    id UUID,
    form_type TEXT,
    project_id UUID,
    submitted_by_id UUID,
    data JSONB,
    submitted_at TIMESTAMP WITH TIME ZONE,
    status TEXT,
    updates JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT fr.id, fr.form_type, fr.project_id, fr.submitted_by_id, fr.data, fr.submitted_at, fr.status, fr.updates
    FROM form_records fr
    WHERE EXISTS (
        SELECT 1 FROM get_accessible_projects() ap
        WHERE ap.id = fr.project_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get training materials for accessible projects
CREATE OR REPLACE FUNCTION get_accessible_training_materials()
RETURNS TABLE (
    id UUID,
    project_id UUID,
    uploaded_by UUID,
    title TEXT,
    description TEXT,
    file_url TEXT,
    file_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    view_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT tm.id, tm.project_id, tm.uploaded_by, tm.title, tm.description, tm.file_url, tm.file_type, tm.created_at,
           COUNT(tmv.id) as view_count
    FROM training_materials tm
    LEFT JOIN training_material_views tmv ON tm.id = tmv.material_id
    WHERE EXISTS (
        SELECT 1 FROM get_accessible_projects() ap
        WHERE ap.id = tm.project_id
    )
    GROUP BY tm.id, tm.project_id, tm.uploaded_by, tm.title, tm.description, tm.file_url, tm.file_type, tm.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get safety drills for accessible projects
CREATE OR REPLACE FUNCTION get_accessible_safety_drills()
RETURNS TABLE (
    id UUID,
    project_id UUID,
    title TEXT,
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    steps TEXT[],
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT sd.id, sd.project_id, sd.title, sd.description, sd.due_date, sd.steps, sd.created_at
    FROM safety_drills sd
    WHERE EXISTS (
        SELECT 1 FROM get_accessible_projects() ap
        WHERE ap.id = sd.project_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get worker drill progress
CREATE OR REPLACE FUNCTION get_worker_drill_progress(p_worker_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    worker_id UUID,
    drill_id UUID,
    status TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_steps INTEGER[]
) AS $$
DECLARE
    current_user_role TEXT;
    target_worker_id UUID := COALESCE(p_worker_id, auth.uid());
BEGIN
    -- Check permissions
    SELECT role INTO current_user_role FROM users WHERE id = auth.uid();

    IF target_worker_id != auth.uid() AND current_user_role NOT IN ('Site Safety Officer', 'HO middle Managers', 'Top Managers') THEN
        RAISE EXCEPTION 'Access denied. Can only view own drill progress.';
    END IF;

    RETURN QUERY
    SELECT wd.id, wd.worker_id, wd.drill_id, wd.status, wd.completed_at, wd.completed_steps
    FROM worker_drills wd
    WHERE wd.worker_id = target_worker_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get notifications for current user
CREATE OR REPLACE FUNCTION get_user_notifications()
RETURNS TABLE (
    id UUID,
    project_id UUID,
    user_id UUID,
    target_role TEXT,
    title TEXT,
    message TEXT,
    is_read BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    current_user_role TEXT;
BEGIN
    SELECT role INTO current_user_role FROM users WHERE id = auth.uid();

    RETURN QUERY
    SELECT n.id, n.project_id, n.user_id, n.target_role, n.title, n.message, n.is_read, n.created_at
    FROM notifications n
    WHERE n.user_id = auth.uid()
       OR (n.user_id IS NULL AND n.target_role = current_user_role)
       OR (n.user_id IS NULL AND n.target_role IS NULL)
    ORDER BY n.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE notifications
    SET is_read = TRUE
    WHERE id = notification_id
      AND (user_id = auth.uid() OR user_id IS NULL);

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get training assignments for worker
CREATE OR REPLACE FUNCTION get_worker_training_assignments(p_worker_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    worker_id UUID,
    material_id UUID,
    status TEXT,
    assigned_at TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    material_title TEXT,
    material_description TEXT,
    material_file_url TEXT,
    material_file_type TEXT
) AS $$
DECLARE
    current_user_role TEXT;
    target_worker_id UUID := COALESCE(p_worker_id, auth.uid());
BEGIN
    -- Check permissions
    SELECT role INTO current_user_role FROM users WHERE id = auth.uid();

    IF target_worker_id != auth.uid() AND current_user_role NOT IN ('Site Safety Officer', 'HO middle Managers', 'Top Managers') THEN
        RAISE EXCEPTION 'Access denied. Can only view own training assignments.';
    END IF;

    RETURN QUERY
    SELECT ta.id, ta.worker_id, ta.material_id, ta.status, ta.assigned_at, ta.due_date,
           tm.title, tm.description, tm.file_url, tm.file_type
    FROM training_assignments ta
    JOIN training_materials tm ON ta.material_id = tm.id
    WHERE ta.worker_id = target_worker_id
    ORDER BY ta.assigned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update training assignment status
CREATE OR REPLACE FUNCTION update_training_assignment_status(assignment_id UUID, new_status TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    assignment_worker_id UUID;
BEGIN
    -- Get the worker_id for this assignment
    SELECT worker_id INTO assignment_worker_id
    FROM training_assignments
    WHERE id = assignment_id;

    -- Check if current user is the assigned worker
    IF assignment_worker_id != auth.uid() THEN
        RAISE EXCEPTION 'Access denied. Can only update own training assignments.';
    END IF;

    -- Validate status
    IF new_status NOT IN ('Not Started', 'In Progress', 'Completed') THEN
        RAISE EXCEPTION 'Invalid status. Must be one of: Not Started, In Progress, Completed';
    END IF;

    -- Update the assignment
    UPDATE training_assignments
    SET status = new_status
    WHERE id = assignment_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;