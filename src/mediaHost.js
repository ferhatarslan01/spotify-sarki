import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getRawUrl } from './gitPublish.js';

const BRANCH = 'media';
const KEEP_DAYS = 3;

function git(cwd, args) {
  return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function tryGit(cwd, args) {
  try {
    return git(cwd, args);
  } catch {
    return null;
  }
}

// Medya dosyalarini (kart/video) ana dali sisirmeden `media` dalinda barindirir.
// Her yayinda dal tek bir "orphan" commit'e sikistirilir, eski bloblar gecmiste birikmez.
// Dosya adi YYYYMMDD... ile baslamali (3 gunden eskiler otomatik silinir).
export function hostMedia(buffer, fileName) {
  const root = process.cwd();

  git(root, ['config', 'user.name', 'github-actions[bot]']);
  git(root, ['config', 'user.email', 'github-actions[bot]@users.noreply.github.com']);

  const hasRemote =
    tryGit(root, ['fetch', 'origin', `+${BRANCH}:refs/remotes/origin/${BRANCH}`]) !== null ||
    tryGit(root, ['rev-parse', '--verify', `refs/remotes/origin/${BRANCH}`]) !== null;

  const dir = join(mkdtempSync(join(tmpdir(), 'media-wt-')), 'wt');
  const squash = `media-squash-${process.pid}`;

  try {
    git(root, ['worktree', 'add', '--detach', dir, hasRemote ? `origin/${BRANCH}` : 'HEAD']);
    git(dir, ['checkout', '--orphan', squash]);
    if (!hasRemote) git(dir, ['rm', '-rf', '--quiet', '.']);

    const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
    for (const file of readdirSync(dir)) {
      const m = file.match(/^(\d{4})(\d{2})(\d{2})/);
      if (m && Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) < cutoff) {
        rmSync(join(dir, file), { force: true });
      }
    }

    writeFileSync(join(dir, fileName), buffer);
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', `media ${fileName}`]);
    git(dir, ['push', '--force', 'origin', `${squash}:${BRANCH}`]);
  } finally {
    tryGit(root, ['worktree', 'remove', '--force', dir]);
    tryGit(root, ['worktree', 'prune']);
    tryGit(root, ['branch', '-D', squash]);
  }

  return getRawUrl(fileName, BRANCH);
}
