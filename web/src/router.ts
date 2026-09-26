import { useEffect, useState } from 'react';

export type Route =
  | { name: 'library' }
  | { name: 'outline'; book: string }
  | { name: 'read'; book: string; chapter: string }
  | { name: 'source'; book: string; chapter: string }
  | { name: 'all'; book: string }
  | { name: 'files'; book: string };

export function parseHash(hash: string): Route {
  const parts = hash
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });
  if (parts[0] !== 'b' || !parts[1]) return { name: 'library' };
  const book = parts[1];
  switch (parts[2]) {
    case 'read':
      return parts[3] ? { name: 'read', book, chapter: parts[3] } : { name: 'outline', book };
    case 'source':
      return parts[3] ? { name: 'source', book, chapter: parts[3] } : { name: 'outline', book };
    case 'all':
      return { name: 'all', book };
    case 'files':
      return { name: 'files', book };
    default:
      return { name: 'outline', book };
  }
}

export function href(route: Route): string {
  const e = encodeURIComponent;
  switch (route.name) {
    case 'library':
      return '#/';
    case 'outline':
      return `#/b/${e(route.book)}`;
    case 'read':
    case 'source':
      return `#/b/${e(route.book)}/${route.name}/${e(route.chapter)}`;
    case 'all':
    case 'files':
      return `#/b/${e(route.book)}/${route.name}`;
  }
}

export function navigate(route: Route) {
  window.location.hash = href(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
