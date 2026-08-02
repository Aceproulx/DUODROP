/* =================================================================
   DUODROP — PayChangu Shared Utility
   Extracted so both payments.js and songs.js can verify transactions
   without circular dependencies.
   ================================================================= */

const https = require('https');

const PAYCHANGU_SECRET = process.env.PAYCHANGU_SECRET_KEY || 'sec-test-jLtkdv7zywbMYIp6jzgl2slpPzxpKBMi';

/**
 * Verify a PayChangu transaction by tx_ref.
 * @param {string} txRef
 * @returns {Promise<{ status: string, data?: object, message?: string }>}
 */
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

module.exports = { verifyPaychanguTransaction };
