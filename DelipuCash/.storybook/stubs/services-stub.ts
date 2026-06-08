/**
 * Web stub for the heavy `@/services` barrel (it re-exports ad/purchases/SSE/notification
 * hooks). The presentational survey components only need formatCurrency/formatDate, so the
 * Storybook web build aliases the bare `@/services` import to this. (`@/services/api`,
 * `@/services/hooks`, etc. are NOT aliased — only the bare barrel.)
 */
export const formatCurrency = (n: number) => `UGX ${n}`;
export const formatDate = (_d: string) => 'Jun 1, 2026';
