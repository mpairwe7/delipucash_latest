/**
 * Share URL Utilities
 *
 * Generates OG-enabled share URLs for content types.
 * Share URLs point to the server domain which serves HTML
 * with OG meta tags + smart app redirect.
 *
 * The domain must match:
 * - app.json: ios.associatedDomains and android.intentFilters
 * - deepLinkController.mjs: AASA and assetlinks.json
 */

const SHARE_BASE_URL = process.env.EXPO_PUBLIC_SHARE_BASE_URL
  || 'https://delipucash-latest.vercel.app';

/**
 * Generate a shareable URL for a video that includes OG metadata + UTM params.
 * When opened in a browser, shows rich preview card + redirects to app.
 * When shared on social media, crawlers see OG tags for rich link previews.
 */
export function generateVideoShareUrl(videoId: string): string {
  const params = new URLSearchParams({
    utm_source: 'app',
    utm_medium: 'share',
    utm_campaign: 'video',
  });
  return `${SHARE_BASE_URL}/video/${videoId}?${params.toString()}`;
}
