const fetch = global.fetch || require('node-fetch');
const path = require('path');
const { supabaseAdmin } = require('./supabase');

async function uploadFromUrlToSupabase(sourceUrl, destPath) {
  if (!supabaseAdmin) {
    return { error: new Error('Supabase admin client not configured') };
  }

  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`Failed to fetch ${sourceUrl}: ${res.statusText}`);
    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Ensure destPath is a safe relative path
    const safePath = destPath.replace(/^\/+/, '');

    const bucket = 'generated';

    // Upload
    const { data, error } = await supabaseAdmin.storage.from(bucket).upload(safePath, buffer, {
      contentType,
      upsert: true,
    });

    if (error) return { error };

    // Create a signed URL valid for 7 days
    const expiresIn = 60 * 60 * 24 * 7; // 7 days
    const { data: signed, error: signedErr } = await supabaseAdmin.storage.from(bucket).createSignedUrl(safePath, expiresIn);
    if (signedErr) return { error: signedErr };

    return { publicUrl: signed.signedUrl, path: safePath };
  } catch (err) {
    return { error: err };
  }
}

module.exports = {
  uploadFromUrlToSupabase,
};
