import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const pageSize = 10;

type Page = { criteria: string; limit: number; loading: boolean };

export function useResultPages<T>(results: T[], criteria: string) {
  const [page, setPage] = useState<Page>({ criteria, limit: pageSize, loading: false });
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (page.criteria !== criteria) setPage({ criteria, limit: pageSize, loading: false });
  const limit = page.criteria === criteria ? page.limit : pageSize;
  const loading = page.criteria === criteria && page.loading;

  useEffect(() => () => {
    if (pending.current !== null) clearTimeout(pending.current);
    pending.current = null;
  }, [criteria]);

  const loadMore = useCallback(() => {
    if (limit >= results.length || loading || pending.current !== null) return;
    setPage({ criteria, limit, loading: true });
    pending.current = setTimeout(() => {
      pending.current = null;
      setPage(current => current.criteria === criteria
        ? { criteria, limit: limit + pageSize, loading: false }
        : current);
    }, 220);
  }, [criteria, limit, loading, results.length]);

  const items = useMemo(() => results.slice(0, limit), [results, limit]);
  return { items, loadMore, loading, hasMore: limit < results.length };
}
