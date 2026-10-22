/**
 * Turns a pre-release marker into the form Debian and RPM both order correctly.
 *
 * Both read a tilde as "lower than nothing", which is how `3.6.7~beta2` sorts
 * below `3.6.7`. Without it a pre-release can sort *above* the final release of
 * the same number, and the package manager then refuses to move a beta user
 * onto the stable version, seeing a downgrade. Debian sorts every such marker
 * above; RPM sorts `beta` below `linux` only by alphabetical order, and `rc`
 * above it.
 *
 * The -linuxN suffix this fork appends leaves the marker in the middle of the
 * version, where the pre-release rule of electron-installer-debian no longer
 * matches. electron-installer-redhat then turns the remaining hyphens into
 * dots, which gives `3.6.8~beta4.linux1`.
 */
export function withPreReleaseTilde(version: string): string {
  return version.replace(/-((?:RC|rc|pre|dev|beta|alpha)[._+-]?\d*)-/, '~$1-')
}
