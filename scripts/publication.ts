import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import {
  exportPublicImages,
  LOCAL,
  paths,
  readLibrary,
  ROOT,
} from '../apps/admin/store.ts';
import {
  validatePublication,
  type Library,
  type PublicContent,
} from '../packages/shared/src/index.ts';
import { commitAndPush, publishPaths } from './git-publish.ts';
const exec = promisify(execFile);
export const digest = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(value) ?? 'undefined')
    .digest('hex');
export async function command(bin: string, args: string[], cwd = ROOT) {
  const { stdout, stderr } = await exec(bin, args, {
    cwd,
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return `${stdout}${stderr}`.trim();
}
export async function generate(data: Library) {
  const content = validatePublication(data);
  for (const p of content.photos)
    for (const v of p.variants) {
      const m = await sharp(join(paths.processed, v.file)).metadata();
      if (m.width !== v.width || m.height !== v.height || m.exif || m.xmp)
        throw Error(`图片尺寸或隐私验证失败：${p.id}`);
    }
  const temp = join(LOCAL, `publish-${randomUUID()}`);
  await mkdir(join(temp, 'images'), { recursive: true });
  try {
    await exportPublicImages(
      content.photos.flatMap((p) => p.variants.map((v) => v.file)),
      join(temp, 'images'),
    );
    await mkdir(join(ROOT, 'public'), { recursive: true });
    await mkdir(join(ROOT, 'content'), { recursive: true });
    const target = join(ROOT, 'public/images');
    const old = join(LOCAL, `previous-images-${randomUUID()}`);
    try {
      await rename(target, old);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    try {
      await rename(join(temp, 'images'), target);
      await writeFile(
        join(temp, 'gallery.json'),
        JSON.stringify(content, null, 2),
      );
      await rename(
        join(temp, 'gallery.json'),
        join(ROOT, 'content/gallery.json'),
      );
    } catch (e) {
      await rm(target, { recursive: true, force: true });
      try {
        await rename(old, target);
      } catch {}
      throw e;
    }
    await rm(old, { recursive: true, force: true });
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
  return content;
}
export function changeSummary(
  previous: PublicContent | undefined,
  next: PublicContent,
) {
  const counts = (key: 'photos' | 'collections' | 'journals') => {
    const old = new Map((previous?.[key] ?? []).map((x) => [x.id, digest(x)]));
    const current = new Map(next[key].map((x) => [x.id, digest(x)]));
    return {
      added: [...current.keys()].filter((id) => !old.has(id)).length,
      modified: [...current.keys()].filter(
        (id) => old.has(id) && old.get(id) !== current.get(id),
      ).length,
      removed: [...old.keys()].filter((id) => !current.has(id)).length,
    };
  };
  return {
    photos: counts('photos'),
    collections: counts('collections'),
    journals: counts('journals'),
    settings: digest(previous?.settings) !== digest(next.settings),
    categories: digest(previous?.categories) !== digest(next.categories),
  };
}
export async function gitStatus() {
  try {
    return await command('git', ['status', '--short', '--branch']);
  } catch {
    return '尚未初始化独立 Git 仓库';
  }
}
export async function repositoryFingerprint() {
  const files = (
    await command('git', [
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      '-z',
    ])
  )
    .split('\0')
    .filter(Boolean)
    .sort();
  const hash = createHash('sha256');
  for (const f of files) {
    hash.update(f);
    try {
      hash.update(await readFile(join(ROOT, f)));
    } catch {
      hash.update('missing');
    }
  }
  return hash.digest('hex');
}
export interface Plan {
  id: string;
  revision: number;
  contentHash: string;
  fingerprint: string;
  summary: ReturnType<typeof changeSummary>;
  builtAt: string;
  log: string;
  git: string;
  pushAvailable: boolean;
}
let plan: Plan | undefined;
export async function previewPublish() {
  let before: PublicContent | undefined;
  try {
    before = JSON.parse(
      await command('git', [
        'show',
        'refs/remotes/origin/main:content/gallery.json',
      ]),
    );
  } catch {}
  const data = await readLibrary();
  const next = await generate(data);
  const log = await command('npm', ['run', 'build:web']);
  await command('npm', ['run', 'audit:dist']);
  let fingerprint = '';
  let pushAvailable = false;
  try {
    fingerprint = await repositoryFingerprint();
    pushAvailable =
      (await command('git', ['remote', 'get-url', 'origin']))
        .replace(/\.git$/, '')
        .replace(/\/$/, '') === 'https://github.com/CastorRise/gallery';
  } catch {}
  plan = {
    id: randomUUID(),
    revision: data.revision,
    contentHash: digest(next),
    fingerprint,
    summary: changeSummary(before, next),
    builtAt: new Date().toISOString(),
    log,
    git: await gitStatus(),
    pushAvailable,
  };
  await mkdir(LOCAL, { recursive: true });
  await writeFile(
    join(LOCAL, 'build-status.json'),
    JSON.stringify({ ok: true, builtAt: plan.builtAt }),
  );
  return plan;
}
export async function confirmPublish(id: string, confirmation: string) {
  if (confirmation !== 'PUBLISH CastorRise/gallery')
    throw Error('请输入完整的发布确认文字');
  if (!plan || id !== plan.id) throw Error('发布计划不存在，请重新预览');
  const data = await readLibrary();
  if (
    data.revision !== plan.revision ||
    digest(validatePublication(data)) !== plan.contentHash
  )
    throw Error('内容已修改，请重新构建预览');
  if (!plan.pushAvailable)
    throw Error('未配置 CastorRise/gallery 远程仓库；请先确认创建独立仓库');
  if ((await repositoryFingerprint()) !== plan.fingerprint)
    throw Error('项目文件已变化，请重新预览');
  const branch = await command('git', ['branch', '--show-current']);
  if (branch !== 'main') throw Error('发布只允许 main 分支，请先处理分支状态');
  if (await command('git', ['ls-files', '-u']))
    throw Error('存在合并冲突，请先手动解决');
  const remote = await command('git', ['remote', 'get-url', 'origin']);
  if (!/^https:\/\/github\.com\/CastorRise\/gallery(?:\.git)?\/?$/.test(remote))
    throw Error('远程仓库身份不匹配');
  const tracked = await command('git', ['ls-files', '--cached']);
  if (
    tracked
      .split('\n')
      .some((p) => p.startsWith('.local/') || p.includes('/originals/'))
  )
    throw Error('Git 中存在本地私有文件，拒绝推送');
  const pending = (
    await command('git', ['diff', '--cached', '--name-only', '-z'])
  )
    .split('\0')
    .filter(Boolean);
  if (
    pending.some(
      (file) =>
        !publishPaths.some((p) => file === p || file.startsWith(p + '/')),
    )
  )
    throw Error('暂存区包含发布范围以外的文件，请先检查');
  for (const file of (
    await command('git', [
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      '-z',
    ])
  )
    .split('\0')
    .filter(Boolean)) {
    if (
      file.startsWith('.local/') ||
      /(^|\/)(?:\.env[^/]*|credentials(?:\.[^/]*)?|id_rsa|id_ed25519)$/.test(
        file,
      )
    )
      throw Error('Git 文件列表包含私有文件，拒绝发布');
    if (!/\.(webp|woff2?|png|jpe?g|zip)$/.test(file)) {
      const source = await readFile(join(ROOT, file), 'utf8').catch(() => '');
      if (
        /gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(
          source,
        )
      )
        throw Error('项目文件存在凭据模式，请先移除');
    }
  }
  await command('gh', ['auth', 'status']);
  // A rejected push retains the local commit and lets the same confirmed plan retry.
  try {
    const { sha, log } = await commitAndPush(command);
    plan = undefined;
    return { sha, log, url: 'https://castorrise.github.io/gallery/' };
  } catch (e) {
    if (plan) plan.fingerprint = await repositoryFingerprint();
    throw Error(
      `Git Push 失败，本地内容和提交均保留，可重试。${(e as Error).message}`,
    );
  }
}
