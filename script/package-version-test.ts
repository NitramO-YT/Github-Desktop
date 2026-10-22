import assert from 'node:assert'
import { describe, it } from 'node:test'
import { withPreReleaseTilde } from './package-version'

describe('withPreReleaseTilde', () => {
  it('puts a tilde before the beta marker of a Linux build', () => {
    assert.equal(
      withPreReleaseTilde('3.6.8-beta4-linux1'),
      '3.6.8~beta4-linux1'
    )
  })

  it('handles the other pre-release markers', () => {
    assert.equal(withPreReleaseTilde('3.6.8-rc1-linux2'), '3.6.8~rc1-linux2')
    assert.equal(
      withPreReleaseTilde('3.6.8-alpha-linux1'),
      '3.6.8~alpha-linux1'
    )
  })

  it('leaves a final release alone', () => {
    assert.equal(withPreReleaseTilde('3.6.7-linux1'), '3.6.7-linux1')
  })

  it('leaves a version without the Linux suffix alone', () => {
    assert.equal(withPreReleaseTilde('3.6.8-beta4'), '3.6.8-beta4')
  })
})
