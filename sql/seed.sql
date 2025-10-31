-- Seed data for development and testing
-- This file contains sample data to populate the database for testing purposes

-- Insert sample users (passwords would be set through Supabase Auth)
-- Note: In production, users should be created through the application signup process

-- Sample projects
INSERT INTO projects (id, name, project_id, status, severity, location, department, created_by) VALUES
    (gen_random_uuid(), 'Metro Line Construction', 'PRJ001', 'Ongoing', 'Medium', 'Downtown Area', 'Civil Engineering', (SELECT id FROM users WHERE employee_id = 'EMP001' LIMIT 1)),
    (gen_random_uuid(), 'High-Rise Building', 'PRJ002', 'Ongoing', 'Critical', 'Business District', 'Structural Engineering', (SELECT id FROM users WHERE employee_id = 'EMP002' LIMIT 1)),
    (gen_random_uuid(), 'Bridge Maintenance', 'PRJ003', 'Ongoing', 'Safe', 'River Crossing', 'Infrastructure', (SELECT id FROM users WHERE employee_id = 'EMP003' LIMIT 1));

-- Sample form records
INSERT INTO form_records (form_type, project_id, submitted_by_id, data, status) VALUES
    ('Safety Observations', (SELECT id FROM projects WHERE project_id = 'PRJ001'), (SELECT id FROM users WHERE employee_id = 'EMP004'), '{
        "observationId": "OBS001",
        "createdBy": "John Worker",
        "project": "Metro Line Construction",
        "date": "2024-01-15T08:30:00.000Z",
        "location": "Tunnel Section A",
        "workActivity": "Drilling operations",
        "department": "Tunneling",
        "shift": "Day",
        "observationType": "Unsafe Act",
        "severityLevel": "Medium",
        "description": "Worker not wearing proper PPE during drilling",
        "immediateCause": "Lack of supervision",
        "rootCause": "Inadequate training on PPE requirements",
        "correctiveActions": "Issued verbal warning and provided additional PPE training",
        "recommendedCorrectiveActions": "Implement daily PPE checks",
        "responsiblePerson": "Site Supervisor",
        "targetCompletionDate": "2024-01-20"
    }', 'Closed'),
    ('First Aid Cases', (SELECT id FROM projects WHERE project_id = 'PRJ002'), (SELECT id FROM users WHERE employee_id = 'EMP005'), '{
        "caseId": "FA001",
        "createdBy": "Safety Officer",
        "project": "High-Rise Building",
        "date": "2024-01-20T14:15:00.000Z",
        "injuredPersonName": "Mike Johnson",
        "injuryType": "Minor cut",
        "location": "Floor 15",
        "incidentDescription": "Worker cut hand while handling metal sheets",
        "treatmentGiven": "Applied bandage and antiseptic",
        "medicalDetails": "2cm laceration on left palm",
        "treatedBy": "First Aid Officer",
        "referredToHospital": "No",
        "supervisorNotified": "Yes",
        "returnedToWork": "Yes",
        "remarks": "Worker returned to work after treatment"
    }', 'Closed'),
    ('Near Miss Reports', (SELECT id FROM projects WHERE project_id = 'PRJ001'), (SELECT id FROM users WHERE employee_id = 'EMP004'), '{
        "nearMissId": "NM001",
        "createdBy": "John Worker",
        "project": "Metro Line Construction",
        "date": "2024-01-25T10:45:00.000Z",
        "location": "Construction site entrance",
        "description": "Heavy equipment almost backed into worker crossing the site",
        "potentialConsequence": "Serious injury or fatality",
        "immediateAction": "Equipment operator stopped immediately",
        "preventativeMeasures": "Install additional safety barriers and improve communication protocols"
    }', 'In Progress');

-- Sample training materials
INSERT INTO training_materials (project_id, uploaded_by, title, description, file_url, file_type) VALUES
    ((SELECT id FROM projects WHERE project_id = 'PRJ001'), (SELECT id FROM users WHERE employee_id = 'EMP002'), 'PPE Safety Guidelines', 'Comprehensive guide to personal protective equipment', 'https://example.com/ppe-guide.pdf', 'pdf'),
    ((SELECT id FROM projects WHERE project_id = 'PRJ002'), (SELECT id FROM users WHERE employee_id = 'EMP003'), 'Height Work Safety Video', 'Training video on safe practices for working at heights', 'https://example.com/height-safety.mp4', 'video'),
    ((SELECT id FROM projects WHERE project_id = 'PRJ001'), (SELECT id FROM users WHERE employee_id = 'EMP002'), 'Emergency Response Procedures', 'Step-by-step emergency response guide', 'https://example.com/emergency-procedures.pdf', 'pdf');

-- Sample notifications
INSERT INTO notifications (project_id, target_role, title, message) VALUES
    ((SELECT id FROM projects WHERE project_id = 'PRJ001'), 'Workers', 'Safety Meeting Reminder', 'Weekly safety meeting scheduled for tomorrow at 9 AM'),
    ((SELECT id FROM projects WHERE project_id = 'PRJ002'), 'Site Safety Officer', 'PPE Inspection Due', 'Monthly PPE inspection is due this week'),
    (NULL, 'Top Managers', 'Monthly Safety Report', 'Monthly safety performance report is now available for review');

-- Sample training assignments
INSERT INTO training_assignments (worker_id, material_id, status, due_date) VALUES
    ((SELECT id FROM users WHERE employee_id = 'EMP004'), (SELECT id FROM training_materials WHERE title = 'PPE Safety Guidelines'), 'Completed', '2024-02-01'),
    ((SELECT id FROM users WHERE employee_id = 'EMP005'), (SELECT id FROM training_materials WHERE title = 'Height Work Safety Video'), 'In Progress', '2024-02-15'),
    ((SELECT id FROM users WHERE employee_id = 'EMP004'), (SELECT id FROM training_materials WHERE title = 'Emergency Response Procedures'), 'Not Started', '2024-02-20');

-- Sample safety drills
INSERT INTO safety_drills (project_id, title, description, due_date, steps) VALUES
    ((SELECT id FROM projects WHERE project_id = 'PRJ001'), 'Fire Evacuation Drill', 'Practice emergency evacuation procedures', '2024-02-28', ARRAY[
        'Gather at designated assembly point',
        'Account for all personnel',
        'Check emergency equipment',
        'Review evacuation routes',
        'Practice emergency communication'
    ]),
    ((SELECT id FROM projects WHERE project_id = 'PRJ002'), 'PPE Compliance Check', 'Verify proper PPE usage across all work areas', '2024-02-15', ARRAY[
        'Inspect hard hats for damage',
        'Check safety glasses condition',
        'Verify harness and lanyard integrity',
        'Ensure proper footwear',
        'Document any deficiencies'
    ]);

-- Sample worker drill progress
INSERT INTO worker_drills (worker_id, drill_id, status, completed_steps) VALUES
    ((SELECT id FROM users WHERE employee_id = 'EMP004'), (SELECT id FROM safety_drills WHERE title = 'Fire Evacuation Drill'), 'Completed', ARRAY[0,1,2,3,4]),
    ((SELECT id FROM users WHERE employee_id = 'EMP005'), (SELECT id FROM safety_drills WHERE title = 'PPE Compliance Check'), 'Pending', ARRAY[0,1]);

-- Sample training material views
INSERT INTO training_material_views (material_id, worker_id) VALUES
    ((SELECT id FROM training_materials WHERE title = 'PPE Safety Guidelines'), (SELECT id FROM users WHERE employee_id = 'EMP004')),
    ((SELECT id FROM training_materials WHERE title = 'Height Work Safety Video'), (SELECT id FROM users WHERE employee_id = 'EMP005')),
    ((SELECT id FROM training_materials WHERE title = 'Emergency Response Procedures'), (SELECT id FROM users WHERE employee_id = 'EMP004'));