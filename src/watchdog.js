// Bekçi: zamanlanmış paylaşımlar kaçtıysa kendisi düzeltir (ilgili workflow'u elle tetikler), düzelmezse çalışma KIRMIZI biter
// (GitHub sahibine e-posta gönderir). Amaç: kimse izlemese de paylaşımların kesilmemesi.
//   Her kontrol "bu saatte şu iş yapılmış olmalıydı" der; yapılmamışsa workflow_dispatch ile tetikler.
//   Aynı sorun ilk kez görüldüğünde yalnızca tetiklenir; HEALTH_GRACE_H saatten uzun sürerse çalışma başarısız sayılır.
// Gerekenler: GITHUB_TOKEN (actions: write), GITHUB_REPOSITORY, Buffer anahtarları.
import { readFile, writeFile } from 'node:fs/promises';
import { loadChartState } from './chartState.js';
import { loadSeriesConfig } from './artistSeries.js';
import { loadReleaseLog, recentReleases, MIN_RELEASES } from './newReleasesClips.js';
import { fetchDailyChart } from './dailyChart.js';
import { fetchWeeklyChart } from './weeklyChart.js';
import { countRecentPosts } from './bufferPost.js';
import { tiktokEnabled } from './tiktok.js';
import { trtDate, trtWeekday } from './slots.js';

const STATE = new URL('../data/watchdogState.json', import.meta.url);
const GRACE_H = Number(process.env.HEALTH_GRACE_H || 8);
const trtHour = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));

async function loadState() {
  try {
    return JSON.parse(await readFile(STATE, 'utf-8'));
  } catch {
    return { problems: {} };
  }
}

async function dispatch(workflow) {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !token) return 'GITHUB_TOKEN/GITHUB_REPOSITORY yok';
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'watchdog' },
    body: JSON.stringify({ ref: process.env.GITHUB_REF_NAME || 'main' }),
  });
  return res.status === 204 ? 'tetiklendi' : `HTTP ${res.status}`;
}

async function lastRunAgeH(workflow) {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) return null;
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'watchdog', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/runs?per_page=1&status=completed`, { headers });
  if (!r.ok) return null;
  const run = (await r.json()).workflow_runs?.[0];
  return run ? (Date.now() - new Date(run.run_started_at ?? run.created_at).getTime()) / 3600e3 : null;
}

async function main() {
  const today = trtDate();
  const wd = trtWeekday();
  const hour = trtHour();
  const checks = []; // { key, ok, detail, workflow }

  // 1) Genel nabız: kanallarda son saatlerde hiç gönderi yoksa bir şey bozuk
  try {
    const x = await countRecentPosts(process.env.BUFFER_CHANNEL_ID, 30);
    if (x !== null) checks.push({ key: 'x-nabiz', ok: x > 0, detail: `X: son 30 saatte ${x} gönderi` });
    if (tiktokEnabled()) {
      const t = await countRecentPosts(process.env.BUFFER_TIKTOK_CHANNEL_ID, 36);
      if (t !== null) checks.push({ key: 'tiktok-nabiz', ok: t > 0, detail: `TikTok: son 36 saatte ${t} gönderi` });
    }
  } catch (err) {
    console.error(`Nabız kontrolü yapılamadı: ${String(err.message).split('\n')[0]}`);
  }

  // 2) Sanatçı serisi: bugün 17:00'dan sonra hâlâ bugünün sanatçısı zamanlanmadıysa
  try {
    const { start, artists } = await loadSeriesConfig();
    const items = (await loadChartState('artistSeriesState.json')).items ?? {};
    const unfinished = artists.some((a) => !(items[a.key]?.x && items[a.key]?.tiktok));
    const doneToday = Object.values(items).some((v) => v.date === today && (v.x || v.tiktok));
    if (unfinished && (!start || today >= start) && hour >= 17) checks.push({ key: 'sanatci-serisi', ok: doneToday, detail: `Sanatçı serisi: bugün (${today}) paylaşım ${doneToday ? 'var' : 'YOK'}`, workflow: 'artist-series.yml' });
  } catch (err) {
    console.error(`Seri kontrolü yapılamadı: ${String(err.message).split('\n')[0]}`);
  }

  // 3) Haftalık klipli liste: Pazar 17:00'dan sonra ya da Pzt-Çar öğleden sonra, bu haftanın listesi paylaşılmadıysa
  try {
    if ((wd === 0 && hour >= 17) || (wd >= 1 && wd <= 3 && hour >= 12)) {
      const { date } = await fetchWeeklyChart();
      const st = await loadChartState('weeklyClipsState.json');
      checks.push({ key: 'haftalik-klipli', ok: st.date === date && (st.x || st.tiktok), detail: `Haftalık klipli liste (${date}): ${st.date === date ? 'paylaşıldı/zamanlandı' : 'YOK'}`, workflow: 'weekly-clips.yml' });
    }
  } catch (err) {
    console.error(`Haftalık liste kontrolü yapılamadı: ${String(err.message).split('\n')[0]}`);
  }

  // 4) Düello: 18:00'dan sonra bugünün listesiyle düello yoksa
  try {
    if (hour >= 18) {
      const { date } = await fetchDailyChart();
      const st = await loadChartState('duelState.json');
      checks.push({ key: 'duello', ok: st.lastPostedDate === date, detail: `Düello (liste ${date}): son paylaşım ${st.lastPostedDate ?? '-'}`, workflow: 'duel.yml' });
    }
  } catch (err) {
    console.error(`Düello kontrolü yapılamadı: ${String(err.message).split('\n')[0]}`);
  }

  // 5) Cumartesi yeni çıkanlar: 17:00'dan sonra, yeterli yayın varken
  try {
    if (wd === 6 && hour >= 17) {
      const enough = recentReleases(await loadReleaseLog(), { today }).length >= MIN_RELEASES;
      const st = await loadChartState('newReleasesClipsState.json');
      if (enough) checks.push({ key: 'cumartesi-yeni-cikanlar', ok: st.date === today, detail: `Cumartesi yeni çıkanlar: ${st.date === today ? 'var' : 'YOK'}`, workflow: 'new-releases-clips.yml' });
    }
  } catch (err) {
    console.error(`Yeni çıkanlar kontrolü yapılamadı: ${String(err.message).split('\n')[0]}`);
  }

  // 6) Pazar özeti: Pazar 18:00'dan sonra haftalık kayıt hâlâ doluysa özet gitmemiştir
  try {
    if (wd === 0 && hour >= 18) {
      const log = JSON.parse(await readFile(new URL('../data/weeklyReleaseLog.json', import.meta.url), 'utf-8'));
      checks.push({ key: 'pazar-ozeti', ok: log.length === 0, detail: `Pazar özeti: haftalık kayıtta ${log.length} yayın kaldı`, workflow: 'weekly-digest.yml' });
    }
  } catch (err) {
    console.error(`Özet kontrolü yapılamadı: ${String(err.message).split('\n')[0]}`);
  }

  // 7) Sık çalışan akışlar: son tamamlanan çalışma çok eskiyse (GitHub cron'u atlıyor) elle tetikle
  for (const [wf, maxH] of [['release-check.yml', 3], ['chart-trends.yml', 5]]) {
    try {
      const age = await lastRunAgeH(wf);
      if (age !== null && hour >= 9 && hour < 23) checks.push({ key: `calisma-${wf}`, ok: age <= maxH, detail: `${wf}: son çalışma ${age.toFixed(1)} saat önce`, workflow: wf });
    } catch (err) {
      console.error(`${wf} kontrolü yapılamadı: ${String(err.message).split('\n')[0]}`);
    }
  }

  const state = await loadState();
  const problems = {};
  let failed = false;
  for (const c of checks) {
    if (c.ok) {
      console.log(`✓ ${c.detail}`);
      continue;
    }
    const since = state.problems[c.key] ?? new Date().toISOString();
    problems[c.key] = since;
    const ageH = (Date.now() - new Date(since).getTime()) / 3600e3;
    const action = c.workflow ? await dispatch(c.workflow) : 'otomatik düzeltme yok';
    console.log(`✗ ${c.detail} (sorun ${ageH.toFixed(1)} saattir sürüyor; ${c.workflow ? `${c.workflow} ${action}` : action})`);
    if (ageH >= GRACE_H) failed = true;
  }
  await writeFile(STATE, JSON.stringify({ checkedAt: new Date().toISOString(), problems }, null, 2) + '\n');
  if (failed) {
    console.error(`Bekçi: bir sorun ${GRACE_H} saatten uzun süredir düzelmedi; çalışma başarısız sayılıyor (GitHub e-posta gönderir).`);
    process.exitCode = 1;
  }
}

main();
