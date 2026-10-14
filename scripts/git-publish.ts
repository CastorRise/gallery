export const publishPaths = [
  'apps',
  'packages',
  'scripts',
  'tests',
  'docs',
  'content',
  'public',
  '.github',
  '.gitignore',
  '.prettierrc.json',
  '.prettierignore',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'playwright.config.ts',
  'README.md',
  'AGENTS.md',
];
export type Runner = (bin: string, args: string[]) => Promise<string>;
export async function commitAndPush(run: Runner) {
  await run('git', ['add', '--', ...publishPaths]);
  if (await run('git', ['diff', '--cached', '--name-only']))
    await run('git', [
      '-c',
      'user.name=CastorRise',
      'commit',
      '-m',
      `Publish gallery ${new Date().toISOString().slice(0, 10)}`,
    ]);
  const log = await run('git', ['push', 'origin', 'main']);
  const sha = await run('git', ['rev-parse', 'HEAD']);
  return { sha, log };
}
