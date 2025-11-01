# Database Schema for MEIL Safety Management System

This directory contains the complete database schema, policies, and setup scripts for the MEIL Safety Management System built with Supabase.

## Files Overview

### `schema.sql`
Contains all database tables, relationships, constraints, and basic indexes. This is the foundation of the database structure.

**Key Tables:**
- `users` - User profiles and authentication data
- `projects` - Construction projects
- `form_records` - Safety reports and forms
- `training_materials` - Uploaded training content
- `training_material_views` - Track material view history
- `notifications` - System notifications
- `training_assignments` - Worker training assignments
- `safety_drills` - Safety drill definitions
- `worker_drills` - Worker drill progress tracking

### `policies.sql`
Row Level Security (RLS) policies for all tables. Ensures users can only access data they're authorized to see.

**Security Model:**
- Users can view/edit their own data
- Managers can access project-wide data
- Workers have limited access to assigned content
- Role-based permissions for different user types

### `storage.sql`
Supabase Storage bucket configuration and policies.

**Buckets:**
- `safety-uploads` - For form attachments, photos, training materials (100MB limit)
- `profile-photos` - For user profile pictures (5MB limit)

### `functions.sql`
Custom PostgreSQL functions for complex operations and data access.

**Key Functions:**
- `get_email_from_employee_id()` - Authentication helper
- `delete_form_record_by_id()` - Secure record deletion
- `get_accessible_projects()` - Project access control
- `get_user_notifications()` - Notification filtering
- `get_worker_training_assignments()` - Training assignment management

### `indexes.sql`
Performance optimization indexes beyond the basic ones in schema.sql.

**Index Types:**
- Single column indexes for common filters
- Composite indexes for multi-column queries
- GIN indexes for JSON and array operations
- Partial indexes for status-based queries

### `seed.sql`
Sample data for development and testing. Contains example projects, users, forms, and training materials.

## Setup Instructions

1. **Create a new Supabase project**

2. **Run the schema setup:**
   ```sql
   -- Run in Supabase SQL Editor in this order:
   \i sql/schema.sql
   \i sql/policies.sql
   \i sql/storage.sql
   \i sql/functions.sql
   \i sql/indexes.sql
   ```

3. **Optional: Load sample data:**
   ```sql
   \i sql/seed.sql
   ```

## Database Design Notes

### Authentication
- Uses Supabase Auth with custom user metadata
- Employee ID is stored in `raw_user_meta_data` for login
- RLS policies ensure proper access control

### Data Relationships
- Projects are the central entity
- All safety data is project-scoped
- Users have role-based access levels

### Performance Considerations
- JSONB used for flexible form data storage
- Comprehensive indexing for query optimization
- GIN indexes for JSON operations

### Security
- All tables have RLS enabled
- Policies based on user roles and project membership
- Storage buckets have file type and size restrictions

## Maintenance

- Run schema updates in development first
- Test RLS policies thoroughly
- Monitor query performance and add indexes as needed
- Regularly review and update security policies

## Troubleshooting

- If RLS blocks expected access, check user roles and policy conditions
- For performance issues, examine query plans and consider additional indexes
- Storage upload issues may be due to file type/size restrictions