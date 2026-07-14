import { execSync } from 'node:child_process';

function run(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

export function pushFile(filePath, message) {
  run('git config user.name "github-actions[bot]"');
  run('git config user.email "github-actions[bot]@users.noreply.github.com"');
  run(`git add "${filePath}"`);

  try {
    run(`git commit -m "${message}"`);
  } catch {
    return false;
  }

  try {
    run('git push');
  } catch {
    // Uzak repo ilerlemis olabilir (paralel calisan baska bir workflow/test).
    // Rebase edip tekrar dene.
    run('git pull --rebase');
    run('git push');
  }
  return true;
}

export function getRawUrl(filePath, branch = 'main') {
  const remoteUrl = run('git config --get remote.origin.url');
  const match = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);
  if (!match) throw new Error(`Remote URL parse edilemedi: ${remoteUrl}`);
  const [, owner, repo] = match;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
}
