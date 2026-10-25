import { useEffect, useState } from 'react';

/** Top-level pages addressed by the URL hash. Everything else is part of the inventory page. */
export type Route = 'inventory' | 'orders' | 'analytics';

const PAGES: Record<string, Route> = { '#orders': 'orders', '#analytics': 'analytics' };

const routeFromHash = (): Route => PAGES[window.location.hash] ?? 'inventory';

/** The current page, following hash changes (links and the Back button). */
export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(routeFromHash);
  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return route;
}
