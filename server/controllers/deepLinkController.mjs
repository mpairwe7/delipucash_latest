/**
 * Deep Link Controller
 *
 * Serves smart redirect pages for mobile deep links.
 * When a user clicks a link in an email (e.g. password reset), this controller:
 *
 * 1. Android App Links / iOS Universal Links → OS intercepts the HTTPS URL and
 *    opens the app directly (if domain verification is configured and app is installed).
 * 2. Fallback → serves an HTML page that tries `delipucash://` custom scheme via
 *    JavaScript, then shows a manual "Open in App" button + an inline web form
 *    as a last resort.
 *
 * This is the 2026 industry-standard approach used by Stripe, Uber, Airbnb, etc.
 */

const APP_NAME = 'DelipuCash';
const APP_SCHEME = process.env.MOBILE_APP_SCHEME || 'delipucash';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@delipucash.com';

// --------------------------------------------------------------------------
// Deep Link Env Validation — warn loudly if placeholder values are in use
// --------------------------------------------------------------------------
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
const ANDROID_SHA256_FINGERPRINT = process.env.ANDROID_SHA256_FINGERPRINT;

if (!APPLE_TEAM_ID || APPLE_TEAM_ID === 'YOUR_APPLE_TEAM_ID') {
  const msg = '[DeepLink] WARNING: APPLE_TEAM_ID is not set or is a placeholder. iOS Universal Links will NOT work in production.';
  if (process.env.NODE_ENV === 'production') console.error(msg);
  else console.warn(msg);
}

if (!ANDROID_SHA256_FINGERPRINT || ANDROID_SHA256_FINGERPRINT.startsWith('00:00:')) {
  const msg = '[DeepLink] WARNING: ANDROID_SHA256_FINGERPRINT is not set or is a placeholder. Android App Links will NOT work in production.';
  if (process.env.NODE_ENV === 'production') console.error(msg);
  else console.warn(msg);
}

/**
 * GET /reset-password?token=...&email=...
 *
 * Smart redirect page that bridges email → mobile app.
 * - If Android App Links / iOS Universal Links are verified, the OS opens the app
 *   before this page even loads.
 * - If not, JavaScript tries the custom scheme, then shows a fallback UI.
 */
export const resetPasswordRedirect = (req, res) => {
  const { token, email } = req.query;

  if (!token || !email) {
    return res.status(400).send(generateErrorPage('Missing token or email parameter.'));
  }

  // URL-encode params for safe embedding in the deep link
  const encodedToken = encodeURIComponent(token);
  const encodedEmail = encodeURIComponent(email);

  // Sanitize for HTML context (display only)
  const safeToken = escapeHtml(token);
  const safeEmail = escapeHtml(email);

  // Deep link that Expo Router will handle → navigates to (auth)/reset-password
  const deepLink = `${APP_SCHEME}://reset-password?token=${encodedToken}&email=${encodedEmail}`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(generateRedirectPage(deepLink, safeToken, safeEmail));
};

/**
 * GET /.well-known/apple-app-site-association
 *
 * Required by iOS to verify Universal Links.
 * The `appID` format is: <TEAM_ID>.<BUNDLE_ID>
 *
 * ⚠️  Replace YOUR_APPLE_TEAM_ID with your actual Apple Developer Team ID.
 *     You can find it at: https://developer.apple.com/account → Membership → Team ID
 */
export const appleAppSiteAssociation = (req, res) => {
  const teamId = APPLE_TEAM_ID || 'YOUR_APPLE_TEAM_ID';
  const bundleId = 'com.arolainc.DelipuCash';

  res.setHeader('Content-Type', 'application/json');
  res.json({
    applinks: {
      apps: [],
      details: [
        {
          appID: `${teamId}.${bundleId}`,
          paths: ['/reset-password*', '/video/*'],
        },
      ],
    },
  });
};

/**
 * GET /.well-known/assetlinks.json
 *
 * Required by Android to verify App Links (auto-open without disambiguation dialog).
 *
 * ⚠️  Replace the sha256_cert_fingerprints with your actual signing key fingerprint.
 *     Get it via:  eas credentials → Android → Keystore → SHA-256 fingerprint
 *     Or:          keytool -list -v -keystore your.keystore | grep SHA256
 */
export const androidAssetLinks = (req, res) => {
  const packageName = 'com.arolainc.DelipuCash';
  const sha256Fingerprint = ANDROID_SHA256_FINGERPRINT ||
    '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00';

  res.setHeader('Content-Type', 'application/json');
  res.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: packageName,
        sha256_cert_fingerprints: [sha256Fingerprint],
      },
    },
  ]);
};

// ===========================================================================
// HTML Generators
// ===========================================================================

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateRedirectPage(deepLink, token, email) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Reset Password – ${APP_NAME}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f0f0ff 0%, #e8e0f7 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(99, 102, 241, 0.12);
      max-width: 420px;
      width: 100%;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 { color: #fff; font-size: 22px; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.85); font-size: 14px; margin-top: 8px; }
    .body { padding: 32px 24px; }
    .spinner-wrap {
      text-align: center;
      margin-bottom: 24px;
    }
    .spinner {
      display: inline-block;
      width: 40px; height: 40px;
      border: 4px solid #e5e7eb;
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin .8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #status {
      text-align: center;
      color: #6b7280;
      font-size: 15px;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
      margin-bottom: 12px;
      transition: opacity .2s;
    }
    .btn:hover { opacity: .85; }
    .btn-primary {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: #fff;
    }
    .btn-secondary {
      background: #f3f4f6;
      color: #374151;
    }
    .hidden { display: none; }
    .footer {
      text-align: center;
      padding: 16px 24px 24px;
      border-top: 1px solid #f3f4f6;
    }
    .footer p { color: #9ca3af; font-size: 12px; line-height: 1.5; }
    .footer a { color: #6366f1; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>🔑 Reset Your Password</h1>
      <p>Opening ${APP_NAME} app…</p>
    </div>
    <div class="body">
      <!-- Phase 1: Trying to open the app -->
      <div id="phase-loading">
        <div class="spinner-wrap"><div class="spinner"></div></div>
        <p id="status">Redirecting to the app…</p>
      </div>

      <!-- Phase 2: Fallback buttons (shown if auto-redirect fails) -->
      <div id="phase-fallback" class="hidden">
        <p id="status" style="margin-bottom:20px; color:#374151; font-size:15px;">
          If the app didn't open automatically, tap the button below:
        </p>
        <a href="${deepLink}" class="btn btn-primary">Open in ${APP_NAME} App</a>
        <p style="text-align:center; color:#9ca3af; font-size:13px; margin:8px 0 16px;">
          Make sure ${APP_NAME} is installed on your device.
        </p>
      </div>
    </div>
    <div class="footer">
      <p>This link expires in 30 minutes.<br>
         Need help? <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
    </div>
  </div>

  <script>
    (function() {
      var deepLink = ${JSON.stringify(deepLink)};
      var fallback = document.getElementById('phase-fallback');
      var loading  = document.getElementById('phase-loading');

      // Attempt 1: Try redirect via hidden iframe (works on many Android browsers)
      try {
        var iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = deepLink;
        document.body.appendChild(iframe);
      } catch(e) {}

      // Attempt 2: Try window.location after a small delay
      setTimeout(function() {
        window.location.href = deepLink;
      }, 300);

      // After 2.5s, if we're still here, the app didn't open → show fallback
      setTimeout(function() {
        loading.classList.add('hidden');
        fallback.classList.remove('hidden');
      }, 2500);

      // If the page becomes hidden (app opened), do nothing
      document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
          // App opened successfully — clear the fallback timer
          loading.classList.add('hidden');
        }
      });
    })();
  </script>
</body>
</html>`;
}

function generateErrorPage(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error – ${APP_NAME}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f4f4f5;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 20px; margin: 0;
    }
    .card {
      background: #fff; border-radius: 16px; padding: 40px 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      max-width: 400px; width: 100%; text-align: center;
    }
    h1 { color: #ef4444; font-size: 20px; margin-bottom: 12px; }
    p  { color: #6b7280; font-size: 15px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>⚠️ Invalid Link</h1>
    <p>${escapeHtml(message)}</p>
    <p style="margin-top:16px">Please request a new password reset from the ${APP_NAME} app.</p>
  </div>
</body>
</html>`;
}
