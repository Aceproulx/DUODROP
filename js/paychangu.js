/* ================================================================
   DUODROP — PayChangu Checkout (self-contained)
   -----------------------------------------------------------------
   Drop-in replacement for the official in.paychangu.com/js/popup.js
   library, which required a global `#wrapper` element and jQuery to
   render anything. Without them its success path threw a silent
   TypeError (the checkout iframe was never appended to the DOM) and
   its error path called jQuery ($), which does not exist in this app
   — so no popup ever appeared even though the popup_transfer API
   responded correctly.

   This implementation calls the same API directly and renders the
   hosted checkout in our own full-screen overlay. It also listens for
   the "removeIframe" message the checkout posts on cancel/abandon so
   the caller's onclose callback reliably fires. On payment success the
   checkout itself navigates the parent window to return_url, which is
   handled by the existing ?payment=success&tx_ref=... callback flow.
   ================================================================ */

let _pcgOnClose = null;

function PaychanguCheckout(options = {}) {
  const payload = {
    tx_ref: options.tx_ref,
    amount: options.amount,
    currency: options.currency || 'MWK',
    callback_url: options.callback_url,
    return_url: options.return_url,
    customer: {
      email: (options.customer && options.customer.email) || null,
      first_name: (options.customer && options.customer.first_name) || null,
      last_name: (options.customer && options.customer.last_name) || null,
    },
    customization: {
      title: (options.customization && options.customization.title) || null,
      description: (options.customization && options.customization.description) || null,
      logo: (options.customization && options.customization.logo) || null,
    },
    meta: options.meta,
  };

  const onClose = typeof options.onclose === 'function' ? options.onclose : null;

  fetch('https://api.paychangu.com/popup_transfer', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + options.public_key,
    },
    body: JSON.stringify(payload),
  })
    .then(res => res.json())
    .then(res => {
      if (res && res.data && res.data.checkout_url) {
        _openCheckoutOverlay(res.data.checkout_url, onClose);
      } else {
        if (typeof showToast === 'function') showToast(_extractPaychanguError(res), 'error');
        if (onClose) onClose();
      }
    })
    .catch(err => {
      console.error('[PayChangu]', err);
      if (typeof showToast === 'function') showToast('Could not reach the payment service. Please try again.', 'error');
      if (onClose) onClose();
    });
}

function _extractPaychanguError(res) {
  const m = res && res.message;
  if (typeof m === 'string') return m;
  if (m && typeof m === 'object') {
    for (const k in m) {
      if (Array.isArray(m[k]) && m[k].length) return m[k][0];
    }
  }
  return 'Payment could not be started. Please try again.';
}

function _openCheckoutOverlay(url, onClose) {
  _closeCheckoutOverlay();
  _pcgOnClose = onClose;

  const overlay = document.createElement('div');
  overlay.id = 'pcg-overlay';
  overlay.innerHTML = [
    '<div id="pcg-bar">',
    '  <span>Secure payment by PayChangu</span>',
    '  <button type="button" id="pcg-close" title="Close payment">&times;</button>',
    '</div>',
    `<iframe id="pcg-frame" src="${url}" allow="payment" allowfullscreen></iframe>`,
  ].join('');

  const close = () => {
    _closeCheckoutOverlay();
    const cb = _pcgOnClose;
    _pcgOnClose = null;
    if (typeof cb === 'function') cb();
  };

  overlay.querySelector('#pcg-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

function _closeCheckoutOverlay() {
  const el = document.getElementById('pcg-overlay');
  if (el) el.remove();
  document.body.style.overflow = '';
}

// The hosted checkout posts { removeIframe } when the payment flow is
// abandoned/cancelled. On completion it navigates the parent window to
// return_url instead, so the full page redirect handles the success case.
window.addEventListener('message', (event) => {
  if (event.data === 'removeIframe') {
    _closeCheckoutOverlay();
    const cb = _pcgOnClose;
    _pcgOnClose = null;
    if (typeof cb === 'function') cb();
  }
});
