/* ================================================================
   DUODROP — Payments Route
   Verifies PayChangu transactions server-side using Secret Key
   before any song is permitted to be saved.
   ================================================================ */

const express = require('express');
const router  = express.Router();
const https   = require('https');

const PAYCHANGU_SECRET = process.env.PAYCHANGU_SECRET_KEY || 'sec-test-jLtkdv7zywbMYIp6jzgl2slpPzxpKBMi';

/* ── GET /api/payments/verify?tx_ref=<ref> ─────────────────────
   Calls PayChangu's Verify Transaction endpoint.
   Returns { status: 'success', data: {...} } on success
   or throws an error on failure / unverified payment.
   ──────────────────────────────────────────────────────────── */
router.get('/verify', async (req, res) => {
  const { tx_ref } = req.query;

  if (!tx_ref) {
    return res.status(400).json({ error: 'tx_ref is required' });
  }

  try {
    const result = await verifyPaychanguTransaction(tx_ref);

    if (result.status === 'success') {
      return res.json({ status: 'success', data: result.data });
    } else {
      return res.status(402).json({ status: 'failed', message: result.message || 'Payment not successful' });
    }
  } catch (err) {
    console.error('PayChangu verification error:', err.message);
    return res.status(500).json({ error: 'Payment verification failed', details: err.message });
  }
});

/* ── Helper: call PayChangu verify API ──────────────────────── */
function verifyPaychanguTransaction(txRef) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.paychangu.com',
      path:     `/payment/${encodeURIComponent(txRef)}`,
      method:   'GET',
      headers:  {
        'Authorization': `Bearer ${PAYCHANGU_SECRET}`,
        'Accept':        'application/json',
      },
    };

    const req = https.request(options, (response) => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          reject(new Error('Invalid JSON response from PayChangu'));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

module.exports = router;
