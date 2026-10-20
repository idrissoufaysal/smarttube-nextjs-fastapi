import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Wrappers de navigation conscients de la locale : utiliser ces import
// (et non next/link / next/navigation) pour tout lien ou push interne,
// afin de conserver /fr ou /en dans l'URL.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
