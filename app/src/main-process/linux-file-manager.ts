import { execFile } from 'child_process'
import { pathToFileURL } from 'url'

// Long enough for D-Bus to start a file manager that is not running yet,
// which it does on its own when one provides the interface.
const ShowFoldersTimeoutSeconds = 10

/**
 * The arguments that have gdbus ask the file manager of the session, through
 * the org.freedesktop.FileManager1 interface most Linux file managers provide,
 * to show the contents of a directory.
 *
 * The URI goes inside a double-quoted GVariant string. pathToFileURL already
 * percent-encodes the double quote and the backslash, the only characters
 * such a string has to escape, so a path holding an apostrophe or a comma
 * goes through as it is; both are escaped again anyway, should that ever
 * change.
 */
export function getShowFoldersArgs(path: string): ReadonlyArray<string> {
  const uri = pathToFileURL(path).href.replace(/["\\]/g, '\\$&')

  return [
    'call',
    '--session',
    '--timeout',
    `${ShowFoldersTimeoutSeconds}`,
    '--dest',
    'org.freedesktop.FileManager1',
    '--object-path',
    '/org/freedesktop/FileManager1',
    '--method',
    'org.freedesktop.FileManager1.ShowFolders',
    `["${uri}"]`,
    // The startup notification id, which the main process has none to pass on.
    '',
  ]
}

type ExecFile = (
  file: string,
  args: ReadonlyArray<string>,
  callback: (error: Error | null, stdout: string, stderr: string) => void
) => void

/**
 * Shows a directory in the file manager already running, the way it handles
 * any folder another application asks it to show: Dolphin, for one, opens it
 * as a new tab of its window when set to. Opening the directory as a file
 * would start the file manager again instead, and Dolphin then opens a new
 * window holding the tabs it restored from its last session.
 *
 * When no file manager answers on D-Bus, or gdbus is missing, the directory
 * is opened with `fallback`. A call that only timed out is not retried that
 * way: the file manager may still be starting, and would then show the
 * directory twice.
 */
export function showFolderInFileManager(
  path: string,
  fallback: () => void,
  exec: ExecFile = execFile
) {
  exec('gdbus', getShowFoldersArgs(path), (error, _stdout, stderr) => {
    if (error === null) {
      return
    }

    if (/Timeout was reached/i.test(stderr)) {
      log.warn(`The file manager did not answer in time to show ${path}`)
      return
    }

    log.info(
      `No file manager answered on D-Bus to show ${path}, opening it instead: ${
        stderr.trim() || error.message
      }`
    )
    fallback()
  })
}
