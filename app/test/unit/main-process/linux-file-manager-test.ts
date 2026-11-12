import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  getShowFoldersArgs,
  showDirectoryOnLinux,
  showFolderInFileManager,
} from '../../../src/main-process/linux-file-manager'

/** The folder list argument, as gdbus receives it. */
function folderList(path: string) {
  const args = getShowFoldersArgs(path)
  return args[args.length - 2]
}

/** An exec that answers the way gdbus would, without running it. */
function fakeExec(error: Error | null, stderr = '') {
  const calls = new Array<{ file: string; args: ReadonlyArray<string> }>()
  const exec = (
    file: string,
    args: ReadonlyArray<string>,
    callback: (error: Error | null, stdout: string, stderr: string) => void
  ) => {
    calls.push({ file, args })
    callback(error, error === null ? '()\n' : '', stderr)
  }
  return { exec, calls }
}

describe('getShowFoldersArgs', () => {
  it('calls ShowFolders on the session bus', () => {
    const args = getShowFoldersArgs('/home/user/repo')
    assert.deepEqual(args.slice(0, 2), ['call', '--session'])
    assert(args.includes('org.freedesktop.FileManager1.ShowFolders'))
    assert.equal(args[args.length - 1], '')
  })

  it('passes the folder as a file URI in a GVariant string array', () => {
    assert.equal(folderList('/home/user/repo'), '["file:///home/user/repo"]')
  })

  it('percent-encodes spaces and accented letters', () => {
    assert.equal(
      folderList('/home/user/Mes dépôts'),
      '["file:///home/user/Mes%20d%C3%A9p%C3%B4ts"]'
    )
  })

  it('keeps apostrophes and commas, which a double-quoted string allows', () => {
    assert.equal(folderList("/srv/l'app,v2"), `["file:///srv/l'app,v2"]`)
  })

  it('leaves no double quote or backslash to end the string early', () => {
    assert.equal(folderList('/tmp/a"b\\c'), '["file:///tmp/a%22b%5Cc"]')
  })
})

describe('showFolderInFileManager', () => {
  it('asks gdbus and does not fall back when the file manager answers', () => {
    const { exec, calls } = fakeExec(null)
    let fellBack = false
    showFolderInFileManager('/home/user/repo', () => (fellBack = true), exec)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].file, 'gdbus')
    assert.equal(fellBack, false)
  })

  it('falls back when no file manager provides the interface', () => {
    const { exec } = fakeExec(
      new Error('Command failed'),
      'Error: GDBus.Error:org.freedesktop.DBus.Error.ServiceUnknown'
    )
    let fellBack = false
    showFolderInFileManager('/home/user/repo', () => (fellBack = true), exec)
    assert.equal(fellBack, true)
  })

  it('falls back when gdbus is missing', () => {
    const { exec } = fakeExec(new Error('spawn gdbus ENOENT'))
    let fellBack = false
    showFolderInFileManager('/home/user/repo', () => (fellBack = true), exec)
    assert.equal(fellBack, true)
  })

  it('does not fall back when the call only timed out', () => {
    const { exec } = fakeExec(
      new Error('Command failed'),
      'Error: Timeout was reached'
    )
    let fellBack = false
    showFolderInFileManager('/home/user/repo', () => (fellBack = true), exec)
    assert.equal(fellBack, false)
  })
})

describe('showDirectoryOnLinux', () => {
  it('reveals the .git entry of a repository', async () => {
    const { exec, calls } = fakeExec(null)
    const revealed = new Array<string>()
    await showDirectoryOnLinux(
      '/home/user/repo',
      path => revealed.push(path),
      () => assert.fail('no fallback expected'),
      async path => path === '/home/user/repo/.git',
      exec
    )
    assert.deepEqual(revealed, ['/home/user/repo/.git'])
    assert.equal(calls.length, 0)
  })

  it('shows any other directory through ShowFolders', async () => {
    const { exec, calls } = fakeExec(null)
    const revealed = new Array<string>()
    await showDirectoryOnLinux(
      '/home/user/.config/GitHub Desktop/logs',
      path => revealed.push(path),
      () => assert.fail('no fallback expected'),
      async () => false,
      exec
    )
    assert.deepEqual(revealed, [])
    assert.equal(calls.length, 1)
    assert.equal(calls[0].file, 'gdbus')
  })
})
