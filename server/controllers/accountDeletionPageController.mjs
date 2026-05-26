/**
 * Public account-deletion landing page.
 *
 * Required by Google Play Store policy: every app must provide a publicly
 * reachable URL that explains the in-app deletion flow + offers an off-app
 * way to request deletion (we accept email).
 *
 * Mounted at GET /delete-account in server/index.js.
 */

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@delipucash.com';
const APP_STORE_URL = process.env.APP_STORE_URL || 'https://apps.apple.com/app/delipucash';
const PLAY_STORE_URL = process.env.GOOGLE_PLAY_URL || 'https://play.google.com/store/apps/details?id=com.arolainc.DelipuCash';

export const accountDeletionPage = (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="index,follow" />
  <title>Delete your DelipuCash account</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           max-width: 720px; margin: 40px auto; padding: 0 24px; line-height: 1.6;
           background: #ffffff; color: #1a1a2e; }
    @media (prefers-color-scheme: dark) {
      body { background: #0f0f23; color: #f9fafb; }
      a { color: #6c63ff; }
      .card { background: #1a1a1a; border-color: #2a2a2a; }
    }
    h1 { font-size: 28px; margin-top: 0; }
    h2 { font-size: 20px; margin-top: 32px; }
    .card { background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 12px;
            padding: 20px; margin: 24px 0; }
    ol li { margin-bottom: 8px; }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
    .btn { display: inline-block; padding: 10px 18px; border-radius: 8px;
           background: #4D4DFF; color: #fff; text-decoration: none; font-weight: 500; }
    .btn.secondary { background: transparent; color: #4D4DFF; border: 1px solid #4D4DFF; }
    .small { font-size: 14px; opacity: 0.75; }
  </style>
</head>
<body>
  <h1>Delete your DelipuCash account</h1>
  <p>You can permanently delete your DelipuCash account at any time. Below is what happens, what data is removed, and how to start the process.</p>

  <div class="card">
    <h2>Delete from inside the app (recommended)</h2>
    <ol>
      <li>Open the DelipuCash app and sign in.</li>
      <li>Go to <strong>Profile → Settings → Delete Account</strong>.</li>
      <li>Confirm with your password (and 2FA code, if enabled).</li>
      <li>Your account is immediately scheduled for permanent deletion.</li>
    </ol>
    <div class="actions">
      <a class="btn" href="${PLAY_STORE_URL}">Get app on Google Play</a>
      <a class="btn secondary" href="${APP_STORE_URL}">Get app on App Store</a>
    </div>
  </div>

  <div class="card">
    <h2>Don't have the app installed?</h2>
    <p>Email <a href="mailto:${SUPPORT_EMAIL}?subject=Account%20deletion%20request">${SUPPORT_EMAIL}</a> from the address linked to your account. Include the phrase <strong>"Delete my account"</strong> in the subject line. We will action your request within 7 business days.</p>
  </div>

  <h2>What gets deleted</h2>
  <ul>
    <li>Your name, phone number, profile photo, and verified MoMo numbers — wiped immediately.</li>
    <li>Your active sessions — revoked immediately so you are signed out everywhere.</li>
    <li>Your push notification token — removed so you stop receiving alerts.</li>
    <li>Your survey responses, question answers, video uploads, and stored files — purged within 30 days.</li>
    <li>Pending withdrawals — cancelled, and the underlying points are refunded to your balance before deletion.</li>
  </ul>

  <h2>What we keep (and why)</h2>
  <ul>
    <li><strong>Up to 30 days:</strong> a hashed reference to your account so we can reverse the deletion if you change your mind.</li>
    <li><strong>Permanently (anonymized):</strong> aggregate transaction records required by Ugandan financial regulations (BoU AML) and tax law. These contain no personal identifiers.</li>
  </ul>

  <p class="small">Last updated: April 2026 · DelipuCash by Arola Inc.</p>
</body>
</html>`);
};
