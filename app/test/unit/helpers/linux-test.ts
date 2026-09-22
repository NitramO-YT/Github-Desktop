import { describe, it } from 'node:test'
import assert from 'node:assert'
import { convertToFlatpakPath } from '../../../src/lib/helpers/linux'

describe('convertToFlatpakPath()', () => {
  if (__LINUX__) {
    it('converts /usr paths', () => {
      const path = '/usr/bin/subl'
      const expectedPath = '/var/run/host/usr/bin/subl'
      assert.strictEqual(convertToFlatpakPath(path), expectedPath)
    })

    it('preserves /opt paths', () => {
      const path = '/opt/slickedit-pro2018/bin/vs'
      assert.strictEqual(convertToFlatpakPath(path), path)
    })
  }

  if (__WIN32__) {
    it('returns same path', () => {
      const path = 'C:\\Windows\\System32\\Notepad.exe'
      assert.strictEqual(convertToFlatpakPath(path), path)
    })
  }

  if (__DARWIN__) {
    it('returns same path', () => {
      const path = '/usr/local/bin/code'
      assert.strictEqual(convertToFlatpakPath(path), path)
    })
  }
})
