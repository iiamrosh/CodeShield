-- Seed data for development and testing
-- This file contains sample data to populate the database for testing purposes

-- Insert sample users (passwords would be set through Supabase Auth)
-- Note: In production, users should be created through the application signup process

-- Sample projects (Expanded)
INSERT INTO projects (id, name, project_id, status, severity, location, department, created_by) VALUES
    (gen_random_uuid(), 'Metro Line Construction', 'PRJ001', 'Ongoing', 'Medium', 'Downtown Area', 'Civil Engineering', (SELECT id FROM users WHERE employee_id = 'EMP001' LIMIT 1)),
    (gen_random_uuid(), 'High-Rise Building', 'PRJ002', 'Ongoing', 'Critical', 'Business District', 'Structural Engineering', (SELECT id FROM users WHERE employee_id = 'EMP002' LIMIT 1)),
    (gen_random_uuid(), 'Bridge Maintenance', 'PRJ003', 'Ongoing', 'Safe', 'River Crossing', 'Infrastructure', (SELECT id FROM users WHERE employee_id = 'EMP003' LIMIT 1)),
    (gen_random_uuid(), 'Highway Expansion', 'PRJ004', 'Ongoing', 'Medium', 'Suburban Zone', 'Road Construction', (SELECT id FROM users WHERE employee_id = 'EMP001' LIMIT 1)),
    (gen_random_uuid(), 'Water Treatment Plant', 'PRJ005', 'Completed', 'Safe', 'Industrial Park', 'Civil Engineering', (SELECT id FROM users WHERE employee_id = 'EMP002' LIMIT 1)),
    (gen_random_uuid(), 'Shopping Mall Complex', 'PRJ006', 'Ongoing', 'Critical', 'City Center', 'Commercial Development', (SELECT id FROM users WHERE employee_id = 'EMP003' LIMIT 1));

-- Sample form records (Expanded with more realistic data)
INSERT INTO form_records (form_type, project_id, submitted_by_id, data, status, updates) VALUES
    -- Safety Observations (Multiple)
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
        "ppeStatus": "Non-compliant",
        "likelihood": "Medium",
        "potentialConsequence": "Moderate",
        "correctiveActions": "Issued verbal warning and provided additional PPE training",
        "recommendedCorrectiveActions": "Implement daily PPE checks",
        "responsiblePerson": "Site Supervisor",
        "targetCompletionDate": "2024-01-20"
    }', 'Closed', '[{"updatedBy":"Safety Officer","timestamp":"2024-01-20T09:00:00.000Z","status":"Closed","notes":"Training completed, issue resolved"}]'),
    ('Safety Observations', (SELECT id FROM projects WHERE project_id = 'PRJ002'), (SELECT id FROM users WHERE employee_id = 'EMP002'), '{
        "observationId": "OBS002",
        "createdBy": "Sarah Manager",
        "project": "High-Rise Building",
        "date": "2024-01-18T11:20:00.000Z",
        "location": "Floor 20 - Welding Area",
        "workActivity": "Structural welding",
        "department": "Structural Engineering",
        "shift": "Day",
        "observationType": "Unsafe Condition",
        "severityLevel": "Critical",
        "description": "Welding cables crossing walkway creating trip hazard",
        "immediateCause": "Poor cable management",
        "rootCause": "No designated cable routing system",
        "ppeStatus": "Compliant",
        "likelihood": "High",
        "potentialConsequence": "Major",
        "correctiveActions": "Cables rerouted immediately and secured",
        "recommendedCorrectiveActions": "Install cable management system for all work areas",
        "responsiblePerson": "Electrical Supervisor",
        "targetCompletionDate": "2024-01-25"
    }', 'In Progress', '[{"updatedBy":"HO Manager","timestamp":"2024-01-19T10:00:00.000Z","status":"In Progress","notes":"Cable management system ordered, installation scheduled"}]'),
    ('Safety Observations', (SELECT id FROM projects WHERE project_id = 'PRJ003'), (SELECT id FROM users WHERE employee_id = 'EMP003'), '{
        "observationId": "OBS003",
        "createdBy": "David Senior",
        "project": "Bridge Maintenance",
        "date": "2024-01-22T09:15:00.000Z",
        "location": "Bridge Deck Section B",
        "workActivity": "Concrete repair",
        "department": "Infrastructure",
        "shift": "Day",
        "observationType": "Unsafe Condition",
        "severityLevel": "Safe",
        "description": "Safety barriers properly installed and maintained",
        "immediateCause": "N/A",
        "rootCause": "N/A",
        "ppeStatus": "Compliant",
        "likelihood": "Low",
        "potentialConsequence": "Minor",
        "correctiveActions": "No action required - positive observation",
        "recommendedCorrectiveActions": "Continue current safety practices",
        "responsiblePerson": "Site Engineer"
    }', 'Open', '[]'),
    
    -- Induction Training
    ('Induction Training', (SELECT id FROM projects WHERE project_id = 'PRJ001'), (SELECT id FROM users WHERE employee_id = 'EMP002'), '{
        "trainingId": "IT001",
        "createdBy": "Sarah Manager",
        "project": "Metro Line Construction",
        "date": "2024-01-16T08:00:00.000Z",
        "contractorName": "Metro Builders Ltd",
        "duration": 120,
        "attendees": 25,
        "topicCovered": "Site safety rules, emergency procedures, PPE requirements, hazard identification, and reporting protocols",
        "remarks": "All attendees passed safety quiz with 100% score"
    }', 'Closed', '[]'),
    ('Induction Training', (SELECT id FROM projects WHERE project_id = 'PRJ002'), (SELECT id FROM users WHERE employee_id = 'EMP002'), '{
        "trainingId": "IT002",
        "createdBy": "Sarah Manager",
        "project": "High-Rise Building",
        "date": "2024-01-19T09:00:00.000Z",
        "contractorName": "Tower Construction Co",
        "duration": 90,
        "attendees": 18,
        "topicCovered": "Height work safety, fall protection systems, scaffold safety, lifting operations safety",
        "remarks": "Two workers required additional training on harness usage"
    }', 'Closed', '[]'),
    
    -- Daily Training Talks
    ('Daily Training Talks', (SELECT id FROM projects WHERE project_id = 'PRJ001'), (SELECT id FROM users WHERE employee_id = 'EMP002'), '{
        "talkId": "DTT001",
        "createdBy": "Sarah Manager",
        "project": "Metro Line Construction",
        "date": "2024-01-17T07:30:00.000Z",
        "topic": "Electrical Safety and Lockout/Tagout Procedures",
        "duration": 15,
        "attendees": 32,
        "remarks": "Emphasis on de-energizing equipment before maintenance"
    }', 'Closed', '[]'),
    ('Daily Training Talks', (SELECT id FROM projects WHERE project_id = 'PRJ002'), (SELECT id FROM users WHERE employee_id = 'EMP002'), '{
        "talkId": "DTT002",
        "createdBy": "Sarah Manager",
        "project": "High-Rise Building",
        "date": "2024-01-23T07:30:00.000Z",
        "topic": "Preventing Slips, Trips and Falls",
        "duration": 20,
        "attendees": 28,
        "remarks": "Discussed housekeeping importance and proper footwear"
    }', 'Closed', '[]'),
    ('Daily Training Talks', (SELECT id FROM projects WHERE project_id = 'PRJ003'), (SELECT id FROM users WHERE employee_id = 'EMP003'), '{
        "talkId": "DTT003",
        "createdBy": "David Senior",
        "project": "Bridge Maintenance",
        "date": "2024-01-24T07:45:00.000Z",
        "topic": "Working Near Water - Safety Precautions",
        "duration": 25,
        "attendees": 15,
        "remarks": "Reviewed life jacket requirements and emergency rescue procedures"
    }', 'Closed', '[]'),
    
    -- First Aid Cases
    ('First Aid Cases', (SELECT id FROM projects WHERE project_id = 'PRJ002'), (SELECT id FROM users WHERE employee_id = 'EMP005'), '{
        "caseId": "FA001",
        "createdBy": "Emma Worker",
        "project": "High-Rise Building",
        "date": "2024-01-20T14:15:00.000Z",
        "injuredPersonName": "Mike Johnson",
        "injuryType": "Minor cut",
        "contractorName": "Tower Construction Co",
        "location": "Floor 15",
        "incidentDescription": "Worker cut hand while handling metal sheets",
        "treatmentGiven": "Applied bandage and antiseptic",
        "medicalDetails": "2cm laceration on left palm",
        "treatedBy": "First Aid Officer",
        "referredToHospital": "No",
        "supervisorNotified": "Yes",
        "returnedToWork": "Yes",
        "followUpActions": "Scheduled for follow-up check tomorrow",
        "remarks": "Worker returned to work after treatment"
    }', 'Closed', '[]'),
    ('First Aid Cases', (SELECT id FROM projects WHERE project_id = 'PRJ001'), (SELECT id FROM users WHERE employee_id = 'EMP004'), '{
        "caseId": "FA002",
        "createdBy": "John Worker",
        "project": "Metro Line Construction",
        "date": "2024-01-21T10:30:00.000Z",
        "injuredPersonName": "Carlos Rodriguez",
        "injuryType": "Eye irritation",
        "contractorName": "Metro Builders Ltd",
        "location": "Tunnel Section C",
        "incidentDescription": "Dust particle entered eye during drilling operation",
        "treatmentGiven": "Eye wash station used, eye flushed for 15 minutes",
        "medicalDetails": "Redness and irritation in right eye",
        "treatedBy": "Site Medic",
        "referredToHospital": "Yes",
        "supervisorNotified": "Yes",
        "returnedToWork": "No",
        "followUpActions": "Hospital clearance required before return to work",
        "remarks": "Worker transported to hospital for examination"
    }', 'Open', '[]'),
    
    -- PEP Talks
    ('PEP Talks', (SELECT id FROM projects WHERE project_id = 'PRJ002'), (SELECT id FROM users WHERE employee_id = 'EMP002'), '{
        "talkId": "PEP001",
        "createdBy": "Sarah Manager",
        "project": "High-Rise Building",
        "date": "2024-01-18T07:00:00.000Z",
        "taskName": "Installation of Glass Panels - Floor 18",
        "supervisor": "Tom Chen",
        "attendees": 8,
        "duration": 20,
        "hazardsIdentified": "Fall from height, glass breakage, lifting injuries, weather conditions",
        "controlMeasures": "Full body harness required, safety nets installed, proper lifting techniques, wind speed monitoring",
        "location": "Floor 18 - North Facade",
        "remarks": "Work permit issued, all workers certified for height work"
    }', 'Closed', '[]'),
    ('PEP Talks', (SELECT id FROM projects WHERE project_id = 'PRJ001'), (SELECT id FROM users WHERE employee_id = 'EMP002'), '{
        "talkId": "PEP002",
        "createdBy": "Sarah Manager",
        "project": "Metro Line Construction",
        "date": "2024-01-22T06:45:00.000Z",
        "taskName": "Confined Space Entry - Utility Tunnel",
        "supervisor": "James Patterson",
        "attendees": 5,
        "duration": 30,
        "hazardsIdentified": "Oxygen deficiency, toxic gases, limited egress, communication difficulties",
        "controlMeasures": "Gas monitoring continuous, rescue team on standby, communication equipment tested, ventilation system active",
        "location": "Utility Tunnel Access Point 3",
        "remarks": "Confined space entry permit obtained, air quality tested and approved"
    }', 'Closed', '[]'),
    
    -- Special Technical Training
    ('Special Technical Training', (SELECT id FROM projects WHERE project_id = 'PRJ002'), (SELECT id FROM users WHERE employee_id = 'EMP002'), '{
        "trainingId": "STT001",
        "createdBy": "Sarah Manager",
        "project": "High-Rise Building",
        "date": "2024-01-17T09:00:00.000Z",
        "trainingType": "Advanced Height Work and Rescue",
        "trainerName": "Michael Stevens - Certified Rope Access Trainer",
        "contractorName": "Tower Construction Co",
        "attendees": 12,
        "duration": 240,
        "topicsCovered": "Advanced rope access techniques, emergency descent procedures, rescue operations, equipment inspection and maintenance",
        "remarks": "All participants received certification valid for 2 years"
    }', 'Closed', '[]'),
    ('Special Technical Training', (SELECT id FROM projects WHERE project_id = 'PRJ001'), (SELECT id FROM users WHERE employee_id = 'EMP002'), '{
        "trainingId": "STT002",
        "createdBy": "Sarah Manager",
        "project": "Metro Line Construction",
        "date": "2024-01-19T13:00:00.000Z",
        "trainingType": "Excavation and Trenching Safety",
        "trainerName": "Robert Martinez - Geotechnical Engineer",
        "contractorName": "Metro Builders Ltd",
        "attendees": 20,
        "duration": 180,
        "topicsCovered": "Soil classification, slope stability, shoring systems, protective systems, cave-in prevention",
        "remarks": "Practical demonstration conducted at test excavation site"
    }', 'Closed', '[]'),
    
    -- Near Miss Reports
    ('Near Miss Reports', (SELECT id FROM projects WHERE project_id = 'PRJ001'), (SELECT id FROM users WHERE employee_id = 'EMP004'), '{
        "nearMissId": "NM001",
        "createdBy": "John Worker",
        "project": "Metro Line Construction",
        "date": "2024-01-25T10:45:00.000Z",
        "location": "Construction site entrance",
        "description": "Heavy equipment almost backed into worker crossing the site",
        "potentialConsequence": "Serious injury or fatality from being struck by equipment",
        "immediateAction": "Equipment operator stopped immediately, site access routes reviewed",
        "preventativeMeasures": "Install additional safety barriers, improve communication protocols, designate separate pedestrian walkways, add backup alarms to all equipment"
    }', 'In Progress', '[{"updatedBy":"Safety Officer","timestamp":"2024-01-26T08:00:00.000Z","status":"In Progress","notes":"Backup alarms installed, pedestrian routes being marked"}]'),
    ('Near Miss Reports', (SELECT id FROM projects WHERE project_id = 'PRJ002'), (SELECT id FROM users WHERE employee_id = 'EMP005'), '{
        "nearMissId": "NM002",
        "createdBy": "Emma Worker",
        "project": "High-Rise Building",
        "date": "2024-01-23T15:20:00.000Z",
        "location": "Floor 22 - Material Hoist Area",
        "description": "Unsecured materials nearly fell from hoist platform during lifting",
        "potentialConsequence": "Objects falling from height could cause severe injury or death to workers below",
        "immediateAction": "Load secured properly, area below cleared, hoist operation suspended for inspection",
        "preventativeMeasures": "Mandatory load securing checklist, additional training on material handling, install catch platforms"
    }', 'Closed', '[{"updatedBy":"HO Manager","timestamp":"2024-01-24T09:00:00.000Z","status":"Closed","notes":"Checklist implemented, training completed, catch platforms installed"}]'),
    ('Near Miss Reports', (SELECT id FROM projects WHERE project_id = 'PRJ003'), (SELECT id FROM users WHERE employee_id = 'EMP003'), '{
        "nearMissId": "NM003",
        "createdBy": "David Senior",
        "project": "Bridge Maintenance",
        "date": "2024-01-24T11:30:00.000Z",
        "location": "Bridge Support Pier 2",
        "description": "Worker almost slipped on wet surface near edge of pier",
        "potentialConsequence": "Fall into water - potential drowning",
        "immediateAction": "Area cordoned off, anti-slip mats deployed, worker briefed on wet surface hazards",
        "preventativeMeasures": "Install permanent anti-slip surfacing, improve drainage, mandatory safety lines when working near edges"
    }', 'Open', '[]'),
    
    -- Safety Advisory
    ('Safety Advisory', (SELECT id FROM projects WHERE project_id = 'PRJ002'), (SELECT id FROM users WHERE employee_id = 'EMP002'), '{
        "sawId": "SAW001",
        "createdBy": "Sarah Manager",
        "project": "High-Rise Building",
        "date": "2024-01-20T08:00:00.000Z",
        "location": "All Floors",
        "severityLevel": "High",
        "warningDetails": "Strong winds forecasted (45-60 km/h) for next 48 hours. All exterior work and crane operations to be suspended.",
        "correctiveActions": "Secure all loose materials, inspect tie-downs, suspend outdoor activities, monitor weather updates hourly",
        "issuedTo": "All site personnel and contractors"
    }', 'Closed', '[]'),
    ('Safety Advisory', (SELECT id FROM projects WHERE project_id = 'PRJ001'), (SELECT id FROM users WHERE employee_id = 'EMP002'), '{
        "sawId": "SAW002",
        "createdBy": "Sarah Manager",
        "project": "Metro Line Construction",
        "date": "2024-01-21T14:00:00.000Z",
        "location": "Tunnel Sections A, B, C",
        "severityLevel": "Medium",
        "warningDetails": "Elevated dust levels detected in tunnel areas. Respiratory protection mandatory.",
        "correctiveActions": "Issue P2 respirators to all tunnel workers, increase ventilation, implement dust suppression measures",
        "issuedTo": "Tunneling crew and supervisors"
    }', 'Open', '[]'),
    
    -- Stop Work Orders
    ('Stop Work Orders', (SELECT id FROM projects WHERE project_id = 'PRJ002'), (SELECT id FROM users WHERE employee_id = 'EMP002'), '{
        "swoId": "SWO001",
        "createdBy": "Sarah Manager",
        "project": "High-Rise Building",
        "date": "2024-01-18T13:45:00.000Z",
        "location": "Floor 25 - Concrete Pouring Area",
        "reason": "Scaffolding found to be inadequately braced and missing safety rails. Immediate collapse risk identified.",
        "correctiveActionRequired": "Complete scaffolding inspection by competent person, install all required bracing and guardrails, obtain engineering approval before resuming work",
        "authorizedBy": "Site Safety Manager - Sarah Manager"
    }', 'Closed', '[{"updatedBy":"Sarah Manager","timestamp":"2024-01-19T16:00:00.000Z","status":"Closed","notes":"Scaffolding repaired and certified safe, work resumed"}]'),
    
    -- Rectifications
    ('Rectifications', (SELECT id FROM projects WHERE project_id = 'PRJ001'), (SELECT id FROM users WHERE employee_id = 'EMP004'), '{
        "rectId": "RECT001",
        "observationId": "OBS001",
        "createdBy": "John Worker",
        "project": "Metro Line Construction",
        "date": "2024-01-20T10:00:00.000Z",
        "actionTaken": "Additional PPE training conducted for all drilling crew members. Daily PPE inspection checklist implemented. Safety officer assigned to monitor compliance.",
        "status": "Closed"
    }', 'Closed', '[]'),
    ('Rectifications', (SELECT id FROM projects WHERE project_id = 'PRJ002'), (SELECT id FROM users WHERE employee_id = 'EMP002'), '{
        "rectId": "RECT002",
        "observationId": "SWO001",
        "createdBy": "Sarah Manager",
        "project": "High-Rise Building",
        "date": "2024-01-19T15:30:00.000Z",
        "actionTaken": "Scaffolding completely re-inspected and certified. Additional diagonal bracing installed. All guardrails and toe boards added. Engineer sign-off obtained.",
        "status": "Closed"
    }', 'Closed', '[]'),
    
    -- Dangerous Occurrences
    ('Dangerous Occurrences', (SELECT id FROM projects WHERE project_id = 'PRJ001'), (SELECT id FROM users WHERE employee_id = 'EMP002'), '{
        "doId": "DO001",
        "createdBy": "Sarah Manager",
        "project": "Metro Line Construction",
        "date": "2024-01-16T16:20:00.000Z",
        "location": "Tunnel Section B - Station 150m",
        "description": "Partial tunnel collapse occurred in unsupported section. Approximately 3 cubic meters of soil and rock fell. No personnel in immediate area at time of collapse.",
        "consequence": "No injuries. Equipment damage minimal. Production stopped for 24 hours.",
        "emergencyResponse": "Area immediately evacuated and cordoned off. Geotechnical engineer called to site. Emergency shoring installed. Full structural assessment conducted. Authorities notified as required."
    }', 'Closed', '[{"updatedBy":"Top Manager","timestamp":"2024-01-17T10:00:00.000Z","status":"Closed","notes":"Investigation completed, additional ground support measures implemented"}]'),
    
    -- SIC Meetings
    ('SIC Meetings', (SELECT id FROM projects WHERE project_id = 'PRJ001'), (SELECT id FROM users WHERE employee_id = 'EMP002'), '{
        "meetingId": "SIC001",
        "createdBy": "Sarah Manager",
        "project": "Metro Line Construction",
        "date": "2024-01-15T14:00:00.000Z",
        "attendees": "Site Manager (John Smith), Safety Officer (Sarah Manager), HSE Rep (David Senior), Worker Reps (2), Management Rep (1)",
        "pointsDiscussed": "Monthly safety performance review - 3 incidents recorded. PPE compliance at 95%. New hazard: increased water ingress in tunnel section. Emergency drill scheduled for next week. Budget approved for additional lighting in work areas.",
        "actionItems": "1. Install additional sump pumps (Responsible: Site Engineer, Due: Jan 22)\n2. Conduct emergency evacuation drill (Responsible: Safety Officer, Due: Jan 20)\n3. Upgrade lighting in Sections A and C (Responsible: Electrical Contractor, Due: Jan 30)"
    }', 'Closed', '[]'),
    ('SIC Meetings', (SELECT id FROM projects WHERE project_id = 'PRJ002'), (SELECT id FROM users WHERE employee_id = 'EMP002'), '{
        "meetingId": "SIC002",
        "createdBy": "Sarah Manager",
        "project": "High-Rise Building",
        "date": "2024-01-22T15:00:00.000Z",
        "attendees": "Project Manager, Safety Manager (Sarah), 3 Worker Representatives, QA Manager, Subcontractor Reps (2)",
        "pointsDiscussed": "Review of near-miss incident at material hoist. New fall protection system to be installed on floors 20-25. Worker feedback on welfare facilities positive. Concern raised about traffic management around site entrance.",
        "actionItems": "1. Install additional fall arrest anchors (Due: Feb 5)\n2. Traffic management plan revision (Due: Jan 28)\n3. Schedule height work refresher training (Due: Feb 1)"
    }', 'Closed', '[]'),
    
    -- Good Practices
    ('Good Practices', (SELECT id FROM projects WHERE project_id = 'PRJ003'), (SELECT id FROM users WHERE employee_id = 'EMP003'), '{
        "gpId": "GP001",
        "createdBy": "David Senior",
        "project": "Bridge Maintenance",
        "date": "2024-01-23T10:30:00.000Z",
        "location": "Bridge Deck - Main Span",
        "description": "Crew implemented color-coded tool tethering system to prevent dropped objects. All tools above 2kg are secured with retractable lanyards. System has prevented multiple potential dropped object incidents."
    }', 'Open', '[]'),
    ('Good Practices', (SELECT id FROM projects WHERE project_id = 'PRJ001'), (SELECT id FROM users WHERE employee_id = 'EMP004'), '{
        "gpId": "GP002",
        "createdBy": "John Worker",
        "project": "Metro Line Construction",
        "date": "2024-01-24T09:00:00.000Z",
        "location": "Site Welfare Area",
        "description": "Workers voluntarily organized daily stretch and warm-up sessions before shift start. Initiative has resulted in reported reduction in muscle strain injuries and improved morale."
    }', 'Open', '[]');

-- Sample training materials (Expanded)
INSERT INTO training_materials (project_id, uploaded_by, title, description, file_url, file_type) VALUES
    ((SELECT id FROM projects WHERE project_id = 'PRJ001'), (SELECT id FROM users WHERE employee_id = 'EMP002'), 'PPE Safety Guidelines', 'Comprehensive guide to personal protective equipment', 'https://example.com/ppe-guide.pdf', 'pdf'),
    ((SELECT id FROM projects WHERE project_id = 'PRJ002'), (SELECT id FROM users WHERE employee_id = 'EMP003'), 'Height Work Safety Video', 'Training video on safe practices for working at heights', 'https://example.com/height-safety.mp4', 'video'),
    ((SELECT id FROM projects WHERE project_id = 'PRJ001'), (SELECT id FROM users WHERE employee_id = 'EMP002'), 'Emergency Response Procedures', 'Step-by-step emergency response guide', 'https://example.com/emergency-procedures.pdf', 'pdf'),
    ((SELECT id FROM projects WHERE project_id = 'PRJ003'), (SELECT id FROM users WHERE employee_id = 'EMP003'), 'Water Safety Training', 'Working near water bodies - safety protocols', 'https://example.com/water-safety.pdf', 'pdf'),
    ((SELECT id FROM projects WHERE project_id = 'PRJ002'), (SELECT id FROM users WHERE employee_id = 'EMP002'), 'Fall Protection Systems', 'Complete guide to fall arrest and prevention systems', 'https://example.com/fall-protection.pdf', 'pdf'),
    ((SELECT id FROM projects WHERE project_id = 'PRJ001'), (SELECT id FROM users WHERE employee_id = 'EMP002'), 'Confined Space Entry Video', 'Video tutorial on safe confined space procedures', 'https://example.com/confined-space.mp4', 'video'),
    ((SELECT id FROM projects WHERE project_id = 'PRJ004'), (SELECT id FROM users WHERE employee_id = 'EMP001'), 'Traffic Management Plan', 'Safety guidelines for working near traffic', 'https://example.com/traffic-management.pdf', 'pdf'),
    ((SELECT id FROM projects WHERE project_id = 'PRJ006'), (SELECT id FROM users WHERE employee_id = 'EMP003'), 'Electrical Safety Basics', 'Introduction to electrical hazards and controls', 'https://example.com/electrical-safety.pdf', 'pdf'),
    ((SELECT id FROM projects WHERE project_id = 'PRJ002'), (SELECT id FROM users WHERE employee_id = 'EMP002'), 'Crane Operations Safety', 'Safe lifting operations and signaling procedures', 'https://example.com/crane-safety.mp4', 'video'),
    ((SELECT id FROM projects WHERE project_id = 'PRJ001'), (SELECT id FROM users WHERE employee_id = 'EMP002'), 'Excavation Safety Guide', 'Preventing cave-ins and ensuring excavation safety', 'https://example.com/excavation-safety.pdf', 'pdf');

-- Sample notifications (Expanded)
INSERT INTO notifications (project_id, target_role, title, message) VALUES
    ((SELECT id FROM projects WHERE project_id = 'PRJ001'), 'Workers', 'Safety Meeting Reminder', 'Weekly safety meeting scheduled for tomorrow at 9 AM'),
    ((SELECT id FROM projects WHERE project_id = 'PRJ002'), 'Site Safety Officer', 'PPE Inspection Due', 'Monthly PPE inspection is due this week'),
    (NULL, 'Top Managers', 'Monthly Safety Report', 'Monthly safety performance report is now available for review'),
    ((SELECT id FROM projects WHERE project_id = 'PRJ002'), 'Workers', 'Weather Alert', 'High winds expected tomorrow. All outdoor work may be suspended.'),
    ((SELECT id FROM projects WHERE project_id = 'PRJ001'), 'Site Safety Officer', 'Near Miss Follow-up', 'Investigation required for near-miss incident NM001'),
    ((SELECT id FROM projects WHERE project_id = 'PRJ003'), 'HO middle Managers', 'Good Practice Recognition', 'Tool tethering system implemented - please review for other sites'),
    (NULL, 'Site Safety Officer', 'Training Certification Reminder', '5 workers have certifications expiring within 30 days'),
    ((SELECT id FROM projects WHERE project_id = 'PRJ006'), 'Workers', 'New Safety Procedure', 'Updated fall protection procedures effective immediately'),
    ((SELECT id FROM projects WHERE project_id = 'PRJ004'), 'Top Managers', 'Incident Report', 'Zero incidents reported this week - excellent safety performance');

-- Sample training assignments (Expanded)
INSERT INTO training_assignments (worker_id, material_id, status, due_date) VALUES
    ((SELECT id FROM users WHERE employee_id = 'EMP004'), (SELECT id FROM training_materials WHERE title = 'PPE Safety Guidelines'), 'Completed', '2024-02-01'),
    ((SELECT id FROM users WHERE employee_id = 'EMP005'), (SELECT id FROM training_materials WHERE title = 'Height Work Safety Video'), 'In Progress', '2024-02-15'),
    ((SELECT id FROM users WHERE employee_id = 'EMP004'), (SELECT id FROM training_materials WHERE title = 'Emergency Response Procedures'), 'Not Started', '2024-02-20'),
    ((SELECT id FROM users WHERE employee_id = 'EMP005'), (SELECT id FROM training_materials WHERE title = 'Fall Protection Systems'), 'Completed', '2024-02-05'),
    ((SELECT id FROM users WHERE employee_id = 'EMP004'), (SELECT id FROM training_materials WHERE title = 'Confined Space Entry Video'), 'In Progress', '2024-02-18'),
    ((SELECT id FROM users WHERE employee_id = 'EMP005'), (SELECT id FROM training_materials WHERE title = 'Crane Operations Safety'), 'Not Started', '2024-02-25'),
    ((SELECT id FROM users WHERE employee_id = 'EMP004'), (SELECT id FROM training_materials WHERE title = 'Excavation Safety Guide'), 'Completed', '2024-01-28');

-- Sample safety drills (Expanded)
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
    ]),
    ((SELECT id FROM projects WHERE project_id = 'PRJ001'), 'Confined Space Rescue Drill', 'Practice emergency rescue from confined spaces', '2024-03-05', ARRAY[
        'Set up rescue equipment',
        'Review atmospheric monitoring',
        'Practice entry and retrieval procedures',
        'Test communication systems',
        'Debrief and document lessons learned'
    ]),
    ((SELECT id FROM projects WHERE project_id = 'PRJ002'), 'Fall Arrest System Inspection', 'Comprehensive inspection of all fall protection equipment', '2024-02-22', ARRAY[
        'Visual inspection of all anchor points',
        'Check harness webbing for wear',
        'Inspect lanyards and shock absorbers',
        'Test retractable lifelines',
        'Replace any defective equipment',
        'Update inspection records'
    ]),
    ((SELECT id FROM projects WHERE project_id = 'PRJ003'), 'Water Emergency Response', 'Practice water rescue procedures', '2024-03-10', ARRAY[
        'Deploy emergency flotation devices',
        'Practice throw rope techniques',
        'Review CPR procedures',
        'Test emergency communication',
        'Coordinate with local emergency services'
    ]);

-- Sample worker drill progress (Expanded)
INSERT INTO worker_drills (worker_id, drill_id, status, completed_steps, completed_at) VALUES
    ((SELECT id FROM users WHERE employee_id = 'EMP004'), (SELECT id FROM safety_drills WHERE title = 'Fire Evacuation Drill'), 'Completed', ARRAY[0,1,2,3,4], '2024-01-28T14:30:00.000Z'),
    ((SELECT id FROM users WHERE employee_id = 'EMP005'), (SELECT id FROM safety_drills WHERE title = 'PPE Compliance Check'), 'Pending', ARRAY[0,1], NULL),
    ((SELECT id FROM users WHERE employee_id = 'EMP004'), (SELECT id FROM safety_drills WHERE title = 'PPE Compliance Check'), 'Completed', ARRAY[0,1,2,3,4], '2024-01-25T11:00:00.000Z'),
    ((SELECT id FROM users WHERE employee_id = 'EMP005'), (SELECT id FROM safety_drills WHERE title = 'Fire Evacuation Drill'), 'Completed', ARRAY[0,1,2,3,4], '2024-01-28T14:35:00.000Z'),
    ((SELECT id FROM users WHERE employee_id = 'EMP004'), (SELECT id FROM safety_drills WHERE title = 'Confined Space Rescue Drill'), 'Pending', ARRAY[0,1,2], NULL),
    ((SELECT id FROM users WHERE employee_id = 'EMP005'), (SELECT id FROM safety_drills WHERE title = 'Fall Arrest System Inspection'), 'Pending', ARRAY[0], NULL);

-- Sample training material views (Expanded)
INSERT INTO training_material_views (material_id, worker_id) VALUES
    ((SELECT id FROM training_materials WHERE title = 'PPE Safety Guidelines'), (SELECT id FROM users WHERE employee_id = 'EMP004')),
    ((SELECT id FROM training_materials WHERE title = 'Height Work Safety Video'), (SELECT id FROM users WHERE employee_id = 'EMP005')),
    ((SELECT id FROM training_materials WHERE title = 'Emergency Response Procedures'), (SELECT id FROM users WHERE employee_id = 'EMP004')),
    ((SELECT id FROM training_materials WHERE title = 'Fall Protection Systems'), (SELECT id FROM users WHERE employee_id = 'EMP005')),
    ((SELECT id FROM training_materials WHERE title = 'Fall Protection Systems'), (SELECT id FROM users WHERE employee_id = 'EMP004')),
    ((SELECT id FROM training_materials WHERE title = 'Confined Space Entry Video'), (SELECT id FROM users WHERE employee_id = 'EMP004')),
    ((SELECT id FROM training_materials WHERE title = 'Excavation Safety Guide'), (SELECT id FROM users WHERE employee_id = 'EMP004')),
    ((SELECT id FROM training_materials WHERE title = 'PPE Safety Guidelines'), (SELECT id FROM users WHERE employee_id = 'EMP005')),
    ((SELECT id FROM training_materials WHERE title = 'Crane Operations Safety'), (SELECT id FROM users WHERE employee_id = 'EMP005'));