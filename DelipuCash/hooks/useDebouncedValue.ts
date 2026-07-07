import { useEffect, useState } from 'react';

/**
 * Returns `value` after it has stopped changing for `delayMs`.
 *
 * Use to derive debounced query-keys for server-backed search
 * (`useQuery({ queryKey: [..., debounced], enabled: debounced.length > 2 })`)
 * instead of hand-rolling setTimeout effects in each screen.
 */
export function useDebouncedValue<T>(value: T, delayMs: number = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
