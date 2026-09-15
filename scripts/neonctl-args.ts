export function buildResetBranchArgs(
  branchId: string,
  apiKey: string,
  projectId?: string,
): string[] {
  return [
    'neonctl',
    'branches',
    'reset',
    branchId,
    '--parent',
    '--api-key',
    apiKey,
    ...(projectId ? ['--project-id', projectId] : []),
  ]
}
