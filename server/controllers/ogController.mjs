/**
 * Open Graph Controller
 *
 * Serves HTML pages with OG meta tags for social media link previews.
 * When a shared DelipuCash video link is posted on WhatsApp, Twitter/X,
 * Facebook, etc., crawlers fetch this page and extract the OG tags to
 * render a rich preview card (thumbnail, title, description, branding).
 *
 * For human visitors (tapping the link on mobile), the page attempts to
 * open the app via deep link, then falls back to a branded landing page.
 *
 * Follows the same pattern as deepLinkController.mjs.
 */

import prisma from '../lib/prisma.mjs';
import { getSignedDownloadUrl, URL_EXPIRY } from '../lib/r2.mjs';

const APP_NAME = 'DelipuCash';
const APP_SCHEME = process.env.MOBILE_APP_SCHEME || 'delipucash';
const OG_BASE_URL = process.env.FRONTEND_URL || 'https://delipucashserver.vercel.app';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@delipucash.com';

// Fallback OG image when video has no thumbnail
const FALLBACK_OG_IMAGE = `${OG_BASE_URL}/api/r2/public/logo.png`;

// ===========================================================================
// Route Handler
// ===========================================================================

/**
 * GET /video/:id
 *
 * Serves an HTML page with Open Graph meta tags for social sharing previews
 * and a smart redirect to open the video in the DelipuCash app.
 */
export const videoOgRedirect = async (req, res) => {
  const { id } = req.params;

  // Validate UUID format to avoid unnecessary DB queries
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return res.status(400).send(generateErrorPage('Invalid video link.'));
  }

  try {
    const video = await prisma.video.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    if (!video) {
      return res.status(404).send(generateErrorPage('This video is no longer available.'));
    }

    // Generate a signed thumbnail URL for the OG image.
    // DOWNLOAD_URL_EXPIRY is 24 hours — sufficient for crawler fetch + caching.
    let thumbnailUrl = video.thumbnail || FALLBACK_OG_IMAGE;
    if (video.r2ThumbnailKey) {
      try {
        thumbnailUrl = await getSignedDownloadUrl(
          video.r2ThumbnailKey,
          URL_EXPIRY.DOWNLOAD_URL_EXPIRY
        );
      } catch {
        // Fall back to stored thumbnail URL
      }
    }

    const safeTitle = escapeHtml(video.title || 'Untitled Video');
    const creatorName = video.user
      ? escapeHtml(`${video.user.firstName || ''} ${video.user.lastName || ''}`.trim())
      : '';
    const rawDescription = video.description
      ? video.description.slice(0, 200)
      : `Watch and earn on ${APP_NAME}!`;
    const safeDescription = escapeHtml(rawDescription);

    const pageUrl = `${OG_BASE_URL}/video/${id}`;
    const deepLink = `${APP_SCHEME}://video/${encodeURIComponent(id)}`;

    const ogTitle = `${safeTitle} | ${APP_NAME}`;
    const ogDescription = video.description
      ? `${safeDescription} — Watch and earn on ${APP_NAME}!`
      : `Watch and earn on ${APP_NAME}!`;

    // Cache OG page for 5 minutes — crawlers re-fetch periodically
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');

    res.send(
      generateVideoOgPage({
        ogTitle,
        ogDescription,
        thumbnailUrl,
        pageUrl,
        deepLink,
        safeTitle,
        creatorName,
        views: video.views || 0,
        likes: video.likes || 0,
        duration: video.duration || 0,
      })
    );
  } catch (error) {
    console.error('[OG] Error generating video OG page:', error);
    res.status(500).send(generateErrorPage('Something went wrong. Please try again.'));
  }
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

function formatCount(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function generateVideoOgPage({
  ogTitle,
  ogDescription,
  thumbnailUrl,
  pageUrl,
  deepLink,
  safeTitle,
  creatorName,
  views,
  likes,
  duration,
}) {
  const durationStr = formatDuration(duration);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${ogTitle}</title>

  <!-- Open Graph -->
  <meta property="og:title" content="${ogTitle}">
  <meta property="og:description" content="${ogDescription}">
  <meta property="og:image" content="${escapeHtml(thumbnailUrl)}">
  <meta property="og:image:width" content="1280">
  <meta property="og:image:height" content="720">
  <meta property="og:type" content="video.other">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  <meta property="og:site_name" content="${APP_NAME}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${ogTitle}">
  <meta name="twitter:description" content="${ogDescription}">
  <meta name="twitter:image" content="${escapeHtml(thumbnailUrl)}">

  <!-- App deep link hints (for platforms that support them) -->
  <meta property="al:ios:app_name" content="${APP_NAME}">
  <meta property="al:ios:url" content="${escapeHtml(deepLink)}">
  <meta property="al:android:app_name" content="${APP_NAME}">
  <meta property="al:android:url" content="${escapeHtml(deepLink)}">
  <meta property="al:android:package" content="com.arolainc.DelipuCash">

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #fff;
    }
    .card {
      background: #1e1e30;
      border-radius: 20px;
      box-shadow: 0 12px 40px rgba(99, 102, 241, 0.15);
      max-width: 400px;
      width: 100%;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .thumbnail-wrap {
      position: relative;
      width: 100%;
      aspect-ratio: 16/9;
      background: #000;
      overflow: hidden;
    }
    .thumbnail-wrap img {
      width: 100%; height: 100%; object-fit: cover;
    }
    .play-overlay {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.35);
    }
    .play-btn {
      width: 64px; height: 64px; border-radius: 50%;
      background: rgba(99, 102, 241, 0.9);
      display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(8px);
    }
    .play-btn svg { margin-left: 4px; }
    .duration-badge {
      position: absolute; bottom: 8px; right: 8px;
      background: rgba(0,0,0,0.7); color: #fff;
      padding: 2px 8px; border-radius: 4px;
      font-size: 12px; font-weight: 600;
    }
    .content { padding: 20px; }
    .title {
      font-size: 18px; font-weight: 700; color: #fff;
      line-height: 1.3; margin-bottom: 6px;
    }
    .creator {
      font-size: 14px; color: rgba(255,255,255,0.6);
      margin-bottom: 12px;
    }
    .stats {
      display: flex; gap: 16px; margin-bottom: 20px;
      font-size: 13px; color: rgba(255,255,255,0.5);
    }
    .stats span { display: flex; align-items: center; gap: 4px; }

    /* Loading + Fallback */
    .spinner-wrap { text-align: center; margin-bottom: 16px; }
    .spinner {
      display: inline-block; width: 32px; height: 32px;
      border: 3px solid rgba(255,255,255,0.15);
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #phase-loading p {
      color: rgba(255,255,255,0.6); font-size: 14px;
      text-align: center;
    }
    .btn {
      display: block; width: 100%; padding: 14px;
      border: none; border-radius: 12px;
      font-size: 16px; font-weight: 600;
      cursor: pointer; text-align: center;
      text-decoration: none; margin-bottom: 10px;
      transition: opacity .2s;
    }
    .btn:hover { opacity: .85; }
    .btn-primary {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: #fff;
    }
    .btn-secondary {
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.7);
    }
    .hidden { display: none; }
    .branding {
      text-align: center; padding: 16px 20px 20px;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .branding p {
      color: rgba(255,255,255,0.35); font-size: 12px;
    }
    .branding a { color: #6366f1; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <!-- Video thumbnail with play button overlay -->
    <div class="thumbnail-wrap">
      <img src="${escapeHtml(thumbnailUrl)}" alt="${safeTitle}" loading="eager">
      <div class="play-overlay">
        <div class="play-btn">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><polygon points="5,3 19,12 5,21"/></svg>
        </div>
      </div>
      ${durationStr ? `<span class="duration-badge">${durationStr}</span>` : ''}
    </div>

    <div class="content">
      <h1 class="title">${safeTitle}</h1>
      ${creatorName ? `<p class="creator">by ${creatorName}</p>` : ''}
      <div class="stats">
        <span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          ${formatCount(views)} views
        </span>
        <span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          ${formatCount(likes)} likes
        </span>
      </div>

      <!-- Phase 1: Trying to open the app -->
      <div id="phase-loading">
        <div class="spinner-wrap"><div class="spinner"></div></div>
        <p>Opening in ${APP_NAME} app&hellip;</p>
      </div>

      <!-- Phase 2: Fallback (shown if auto-redirect fails) -->
      <div id="phase-fallback" class="hidden">
        <a href="${escapeHtml(deepLink)}" class="btn btn-primary">Open in ${APP_NAME} App</a>
        <a href="${escapeHtml(pageUrl)}" class="btn btn-secondary">Watch in Browser</a>
        <p style="text-align:center; color:rgba(255,255,255,0.35); font-size:12px; margin-top:8px;">
          Make sure ${APP_NAME} is installed on your device.
        </p>
      </div>
    </div>

    <div class="branding">
      <p>${APP_NAME} — Watch, engage &amp; earn.<br>
         Need help? <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
    </div>
  </div>

  <script>
    (function() {
      var deepLink = ${JSON.stringify(deepLink)};
      var fallback = document.getElementById('phase-fallback');
      var loading  = document.getElementById('phase-loading');

      // Attempt 1: Hidden iframe (works on many Android browsers)
      try {
        var iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = deepLink;
        document.body.appendChild(iframe);
      } catch(e) {}

      // Attempt 2: window.location after small delay
      setTimeout(function() {
        window.location.href = deepLink;
      }, 300);

      // After 2.5s, if still here, show fallback buttons
      setTimeout(function() {
        loading.classList.add('hidden');
        fallback.classList.remove('hidden');
      }, 2500);

      // If page becomes hidden (app opened), clear spinner
      document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
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
  <title>Video Not Found – ${APP_NAME}</title>
  <meta property="og:title" content="${APP_NAME}">
  <meta property="og:description" content="Watch, engage and earn on ${APP_NAME}!">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${APP_NAME}">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%);
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 20px; margin: 0;
    }
    .card {
      background: #1e1e30; border-radius: 20px; padding: 40px 24px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      max-width: 400px; width: 100%; text-align: center;
      border: 1px solid rgba(255,255,255,0.08);
    }
    h1 { color: #ef4444; font-size: 20px; margin-bottom: 12px; }
    p  { color: rgba(255,255,255,0.6); font-size: 15px; line-height: 1.5; }
    .btn {
      display: inline-block; margin-top: 20px; padding: 12px 24px;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: #fff; border-radius: 10px; text-decoration: none;
      font-weight: 600; font-size: 15px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Video Not Found</h1>
    <p>${escapeHtml(message)}</p>
    <a href="${APP_SCHEME}://" class="btn">Open ${APP_NAME}</a>
  </div>
</body>
</html>`;
}
