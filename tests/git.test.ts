import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod,mkdir,mkdtemp,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { commitAndPush,publishPaths } from '../scripts/git-publish.ts';
const exec = promisify(execFile);
test('实际 Git commit/push、拒绝后的本地提交保留、重试与远程冲突不覆盖', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gallery-git-test-'));
  const source = join(dir, 'source'),
    remote = join(dir, 'remote.git');
  await mkdir(source);
  const run = async (bin: string, args: string[], cwd = source) => {
    assert.ok(!args.includes('--force'));
    const { stdout, stderr } = await exec(bin, args, { cwd });
    return `${stdout}${stderr}`.trim();
  };
  try {
    await run('git', ['init', '--bare', '--initial-branch=main', remote]);
    await run('git', ['init', '--initial-branch=main']);
    await run('git', ['config', 'user.email', 'test@example.invalid']);
    await run('git', ['remote', 'add', 'origin', remote]);
    for (const p of publishPaths) {
      if (p.includes('.') || p === 'README.md' || p === 'AGENTS.md')
        await writeFile(join(source, p), 'test\n');
      else {
        await mkdir(join(source, p), { recursive: true });
        await writeFile(join(source, p, 'fixture.txt'), 'test\n');
      }
    }
    const hook = join(remote, 'hooks/pre-receive');
    await writeFile(hook, '#!/bin/sh\nexit 1\n');
    await chmod(hook, 0o755);
    await assert.rejects(commitAndPush(run));
    const local = await run('git', ['rev-parse', 'HEAD']);
    assert.ok(local);
    assert.equal(await run('git', ['status', '--porcelain']), '');
    await rm(hook);
    const retried = await commitAndPush(run);
    assert.equal(retried.sha, local);
    assert.equal(
      await run('git', ['--git-dir', remote, 'rev-parse', 'HEAD']),
      local,
    );
    const other = join(dir, 'other');
    await run('git', ['clone', remote, other]);
    await run('git', ['config', 'user.email', 'test@example.invalid'], other);
    await run('git', ['config', 'user.name', 'CastorRise'], other);
    await writeFile(join(other, 'README.md'), 'remote change\n');
    await run('git', ['add', 'README.md'], other);
    await run('git', ['commit', '-m', 'Remote update'], other);
    await run('git', ['push', 'origin', 'main'], other);
    const remoteHead = await run('git', [
      '--git-dir',
      remote,
      'rev-parse',
      'HEAD',
    ]);
    await writeFile(join(source, 'README.md'), 'conflicting local change\n');
    await assert.rejects(commitAndPush(run), /rejected|fetch first/);
    assert.equal(
      await run('git', ['--git-dir', remote, 'rev-parse', 'HEAD']),
      remoteHead,
    );
    assert.notEqual(await run('git', ['rev-parse', 'HEAD']), remoteHead);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
