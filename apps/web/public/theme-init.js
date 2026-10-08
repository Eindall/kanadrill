// Pose le thème avant le premier rendu (pas de flash). Chargé de façon synchrone dans le <head> :
// la CSP n'autorise que les scripts de l'origine, donc pas de script inline.
// Même clé et mêmes couleurs que src/app/core/theme.ts (un test vérifie l'alignement).
(function () {
  var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  try {
    var saved = localStorage.getItem('kanadrill-theme');
    if (saved === 'dark') dark = true;
    else if (saved === 'light') dark = false;
  } catch (e) {
    // stockage indisponible : réglage du système
  }
  if (dark) document.documentElement.classList.add('dark');
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0f1522' : '#eef1f5');
})();
