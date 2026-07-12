/* =================================================================
   DUODROP — Upload Routes (Cloudinary Signed Upload)
   POST /api/upload/audio-sign — signed params for audio upload
   POST /api/upload/image-sign — signed params for image upload

   The frontend uploads DIRECTLY to Cloudinary using these signed
   params, so large files never pass through our server.
   ================================================================= */
const router     = require('express').Router();
const cloudinary = require('../config/cloudinary');
const { requireAuth } = require('../middleware/auth');

// ── Sign audio upload ─────────────────────────────────────────
router.post('/audio-sign', requireAuth, (req, res) => {
  try {
    const timestamp    = Math.round(Date.now() / 1000);
    const folder       = 'duodrop/audio';
    const resource_type = 'video'; // Cloudinary uses 'video' for audio files

    const paramsToSign = { timestamp, folder };
    const signature    = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);

    res.json({
      signature,
      timestamp,
      folder,
      resource_type,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey:    process.env.CLOUDINARY_API_KEY,
    });
  } catch (err) {
    console.error('[upload/audio-sign]', err);
    res.status(500).json({ error: 'Failed to generate audio upload signature' });
  }
});

// ── Sign image upload ─────────────────────────────────────────
router.post('/image-sign', requireAuth, (req, res) => {
  try {
    const timestamp    = Math.round(Date.now() / 1000);
    const folder       = 'duodrop/artwork';
    const resource_type = 'image';

    const paramsToSign = { timestamp, folder };
    const signature    = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);

    res.json({
      signature,
      timestamp,
      folder,
      resource_type,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey:    process.env.CLOUDINARY_API_KEY,
    });
  } catch (err) {
    console.error('[upload/image-sign]', err);
    res.status(500).json({ error: 'Failed to generate image upload signature' });
  }
});

// ── Sign profile picture upload ───────────────────────────────
router.post('/avatar-sign', requireAuth, (req, res) => {
  try {
    const timestamp    = Math.round(Date.now() / 1000);
    const folder       = 'duodrop/avatars';
    const resource_type = 'image';

    const paramsToSign = { timestamp, folder };
    const signature    = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);

    res.json({
      signature,
      timestamp,
      folder,
      resource_type,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey:    process.env.CLOUDINARY_API_KEY,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate avatar upload signature' });
  }
});

module.exports = router;
