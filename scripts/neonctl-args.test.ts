import { describe, expect, it } from 'vitest'
import { buildResetBranchArgs } from './neonctl-args'

describe('buildResetBranchArgs', () => {
  it('project-scoped API key 用に project ID を明示する', () => {
    expect(buildResetBranchArgs('br-dev', 'api-key', 'project-id')).toEqual([
      'neonctl',
      'branches',
      'reset',
      'br-dev',
      '--parent',
      '--api-key',
      'api-key',
      '--project-id',
      'project-id',
    ])
  })

  it('project ID がない既存のローカル実行方法も維持する', () => {
    expect(buildResetBranchArgs('br-dev', 'api-key')).not.toContain('--project-id')
  })
})
