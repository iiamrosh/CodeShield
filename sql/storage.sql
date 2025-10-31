-- Create storage bucket for safety uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'safety-uploads',
    'safety-uploads',
    true,
    104857600, -- 100MB limit per file
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/mov',
        'video/avi',
        'video/wmv',
        'application/pdf'
    ]
);

-- Storage policies for safety-uploads bucket
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (
        bucket_id = 'safety-uploads' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Allow authenticated users to view files
CREATE POLICY "Authenticated users can view files" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'safety-uploads');

-- Allow users to update their own uploaded files
CREATE POLICY "Users can update own files" ON storage.objects
    FOR UPDATE TO authenticated USING (
        bucket_id = 'safety-uploads' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Allow managers to delete files
CREATE POLICY "Managers can delete files" ON storage.objects
    FOR DELETE TO authenticated USING (
        bucket_id = 'safety-uploads' AND
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role IN ('Site Safety Officer', 'HO middle Managers', 'Top Managers')
        )
    );

-- Create storage bucket for profile photos (optional, smaller size limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'profile-photos',
    'profile-photos',
    true,
    5242880, -- 5MB limit per file
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp'
    ]
);

-- Storage policies for profile-photos bucket
-- Allow users to upload their own profile photos
CREATE POLICY "Users can upload own profile photos" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (
        bucket_id = 'profile-photos' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Allow all authenticated users to view profile photos
CREATE POLICY "Authenticated users can view profile photos" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'profile-photos');

-- Allow users to update their own profile photos
CREATE POLICY "Users can update own profile photos" ON storage.objects
    FOR UPDATE TO authenticated USING (
        bucket_id = 'profile-photos' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Allow users to delete their own profile photos
CREATE POLICY "Users can delete own profile photos" ON storage.objects
    FOR DELETE TO authenticated USING (
        bucket_id = 'profile-photos' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );