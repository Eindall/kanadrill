/** Nom lisible de l'appareil d'après le User-Agent (« Chrome sur Linux »), sans dépendance : affichage seulement. */
export function parseUserAgent(userAgent: string | null | undefined): string {
  const ua = userAgent ?? '';

  // L'ordre compte : Edge et Opera annoncent aussi « Chrome », Chrome annonce aussi « Safari ».
  const browser = /Edg(?:e|A|iOS)?\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\/|FxiOS\//.test(ua)
        ? 'Firefox'
        : /Chrome\/|CriOS\//.test(ua)
          ? 'Chrome'
          : /Version\/.*Safari\//.test(ua)
            ? 'Safari'
            : null;

  // Idem : Android contient « Linux », iPhone/iPad contiennent « Mac OS X ».
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad|iPod/.test(ua)
        ? 'iOS'
        : /Macintosh|Mac OS X/.test(ua)
          ? 'macOS'
          : /CrOS/.test(ua)
            ? 'ChromeOS'
            : /Linux|X11/.test(ua)
              ? 'Linux'
              : null;

  if (browser && os) return `${browser} sur ${os}`;
  return browser ?? os ?? 'Appareil inconnu';
}
