import { useEffect, useState } from 'react';

/** Top-level pages addressed by the URL hash. Everything else is part of the inventory page. */
export type Route = 'inventory' | 'orders';

const routeFromHash = (): Route => (window.location.hash === '#orders' ? 'orders' : 'inventory');

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
