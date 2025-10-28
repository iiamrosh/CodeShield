
// Import Dexie and Supabase from a CDN. This is necessary because service workers can't use ES modules from HTML import maps.
importScripts("https://unpkg.com/dexie@3/dist/dexie.js");
importScripts("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");

// IMPORTANT: You must manually paste your Supabase URL and Key here as well, as environment variables are not available in the worker.
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';

const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Create the local database schema using Dexie
const db = new Dexie("meil_safety_offline");
db.version(1).stores({
  // '++id' means auto-incrementing primary key
  // 'data' will store form fields
  // 'file' will store the Blob object for the photo/video
  upload_queue: '++id, data, file',
});

// The main sync event handler
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reports') {
    event.waitUntil(syncReports());
  }
});

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
      // Step 1: If there's a file, upload it to Supabase Storage first.
      if (report.file) {
        const filePath = `uploads/${report.data.submittedById}/${Date.now()}_${report.file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('safety-uploads') // Make sure you create a bucket named 'safety-uploads' in Supabase
          .upload(filePath, report.file);

        if (uploadError) {
          throw new Error('File upload failed: ' + uploadError.message);
        }

        // Get the public URL of the uploaded file
        const { data: urlData } = supabase.storage.from('safety-uploads').getPublicUrl(filePath);
        photoUrl = urlData.publicUrl;
      }
      
      // Step 2: Add the photo URL to the report data
      // We assume your photo fields are named like 'beforePhoto', 'afterPhoto', etc.
      // This logic might need to be adjusted based on your form structure.
      const submissionData = { ...report.data };
      if (photoUrl) {
          const photoField = Object.keys(submissionData).find(k => k.toLowerCase().includes('photo'));
          if (photoField) {
            submissionData[photoField] = photoUrl;
          }
      }

      // Step 3: Insert the main form record into the 'form_records' table in Supabase.
      // NOTE: You need to create a `form_records` table in Supabase.
      const { error: insertError } = await supabase
        .from('form_records')
        .insert([{
            form_type: submissionData.formType,
            project_id: submissionData.projectId,
            submitted_by_id: submissionData.submittedById,
            data: submissionData, // Store the entire form data blob
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
