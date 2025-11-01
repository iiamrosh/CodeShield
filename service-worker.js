
// Import Dexie and Supabase from a CDN. This is necessary because service workers can't use ES modules from HTML import maps.
importScripts("https://unpkg.com/dexie@3/dist/dexie.js");
importScripts("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");

// IMPORTANT: You must manually paste your Supabase URL and Key here as well, as environment variables are not available in the worker.
const SUPABASE_URL = 'https://ykoqzdempfwypbhovypt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlrb3F6ZGVtcGZ3eXBiaG92eXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NTQxODQsImV4cCI6MjA3NzIzMDE4NH0.NLojAiSstJNjugSbrjJBeqUWoWhvM-RpXmJ2_ORwyZc';

const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Create the local database schema using Dexie
const db = new Dexie("meil_safety_offline");
db.version(4).stores({
  // '++id' means auto-incrementing primary key
  // 'data' will store form fields
  // 'file' will store the Blob object for the photo/video
  upload_queue: '++id, data, file',
  drafts: '++id, form_type, project_id',
  user_cache: 'id', // Cache user profile for offline access
  projects_cache: 'id', // Cache projects for offline access
  forms_cache: 'id', // Cache form records for offline access
  training_materials_cache: 'id', // Cache training materials
  notifications_cache: 'id', // Cache notifications
  drills_cache: 'id', // Cache safety drills
  sync_queue: '++id, action, table, data, timestamp', // Queue for all offline operations
});

// The main sync event handler
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reports') {
    event.waitUntil(Promise.all([syncReports(), syncQueue()]));
  }
});

async function syncQueue() {
  console.log('Service Worker: Processing sync queue.');
  const queueItems = await db.sync_queue.toArray();

  if (queueItems.length === 0) {
    console.log('Service Worker: No queued operations.');
    return;
  }

  console.log(`Service Worker: Found ${queueItems.length} queued operations.`);

  for (const item of queueItems) {
    try {
      switch (item.action) {
        case 'UPDATE_PROJECT':
          await supabase.from('projects').update(item.data).eq('id', item.data.id);
          console.log(`Service Worker: Synced UPDATE_PROJECT for ${item.data.id}`);
          break;
        case 'DELETE_PROJECT':
          await supabase.from('projects').delete().eq('id', item.data.id);
          console.log(`Service Worker: Synced DELETE_PROJECT for ${item.data.id}`);
          break;
        case 'UPDATE_STATUS':
          await supabase.from('form_records').update({
            status: item.data.status,
            updates: item.data.updates
          }).eq('id', item.data.id);
          console.log(`Service Worker: Synced UPDATE_STATUS for ${item.data.id}`);
          break;
        case 'DELETE_FORM':
          await supabase.rpc('delete_form_record_by_id', { record_id: item.data.id });
          console.log(`Service Worker: Synced DELETE_FORM for ${item.data.id}`);
          break;
        default:
          console.warn(`Service Worker: Unknown sync action: ${item.action}`);
      }
      // Remove from queue on success
      await db.sync_queue.delete(item.id);
    } catch (error) {
      console.error(`Service Worker: Failed to sync ${item.action}:`, error);
      // Keep in queue for retry
    }
  }
  console.log('Service Worker: Sync queue processing finished.');
}

async function syncReports() {
  console.log('Service Worker: Sync event triggered for reports.');
  const pendingReports = await db.upload_queue.toArray();

  if (pendingReports.length === 0) {
    console.log('Service Worker: No reports to sync.');
    return;
  }

  console.log(`Service Worker: Found ${pendingReports.length} pending reports. Starting upload.`);

  for (const report of pendingReports) {
    try {
      let photoUrl = null;
      const submissionData = report.data.data; // The actual form fields are nested
      
      // Step 1: If there's a file, upload it to Supabase Storage first.
      if (report.file) {
        const filePath = `uploads/${report.data.submittedById}/${Date.now()}_${report.file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('safety-uploads')
          .upload(filePath, report.file);

        if (uploadError) {
          throw new Error('File upload failed: ' + uploadError.message);
        }
        
        const { data: urlData } = supabase.storage.from('safety-uploads').getPublicUrl(filePath);
        photoUrl = urlData.publicUrl;
      }
      
      // Step 2: Add the photo URL back to the data blob if it exists.
      if (photoUrl) {
          const photoField = Object.keys(submissionData).find(k => k.toLowerCase().includes('photo'));
          if (photoField) {
            submissionData[photoField] = photoUrl;
          }
      }

      // Step 3: Insert the main form record into the 'form_records' table in Supabase.
      const { error: insertError } = await supabase
        .from('form_records')
        .insert([{
            form_type: report.data.formType,
            project_id: report.data.projectId,
            submitted_by_id: report.data.submittedById,
            data: submissionData, // Store the form-specific fields
            status: 'Open',
        }]);

      if (insertError) {
        throw new Error('Database insert failed: ' + insertError.message);
      }

      // Step 4: If successful, delete the report from the local IndexedDB queue.
      await db.upload_queue.delete(report.id);
      console.log(`Service Worker: Successfully synced and deleted report ID ${report.id}.`);

    } catch (error) {
      console.error(`Service Worker: Failed to sync report ID ${report.id}. Error:`, error);
      // If it fails, we leave it in the queue, and the browser will try again later.
    }
  }
  console.log('Service Worker: Sync process finished.');
}