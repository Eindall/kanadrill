/**
 * Appareil dont le pointeur principal est tactile (téléphone, tablette). Le tracé au doigt n'est proposé que là :
 * à la souris il n'a pas grand sens, et un portable à écran tactile garde la souris comme pointeur principal.
 */
export function isTouchDevice(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}
