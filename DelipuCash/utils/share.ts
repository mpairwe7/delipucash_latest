/**
 * Share URL Utilities
 *
 * Generates OG-enabled share URLs for content types.
 * Share URLs point to the server domain (delipucashserver.vercel.app)
 * which serves HTML with OG meta tags + smart app redirect.
 *
 * The domain must match:
 * - app.json: ios.associatedDomains and android.intentFilters
 * - deepLinkController.mjs: AASA and assetlinks.json
 */

const SHARE_BASE_URL = 'https://delipucashserver.vercel.app';

/**
 * Generate a shareable URL for a video that includes OG metadata.
 * When opened in a browser, shows rich preview card + redirects to app.
 * When shared on social media, crawlers see OG tags for rich link previews.
 */
export function generateVideoShareUrl(videoId: string): string {
  return `${SHARE_BASE_URL}/video/${videoId}`;
}
