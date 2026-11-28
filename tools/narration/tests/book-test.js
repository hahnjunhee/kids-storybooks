// 책별 범용 브라우저 시험(Playwright Chromium). tests/run-book-tests.sh로 실행한다.
// 장면 수·장면 id·음성 파일명·제목은 책 HTML의 manifest와 DOM에서 읽어 오므로 책마다 코드를 바꾸지 않는다.
// 낭독 적용본과 기준본(원본 HTML)을 같은 브라우저에서 비교해 본문·삽화·기존 기능 회귀도 확인한다.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/kids-storybooks';
const BOOK_PATH = process.env.BOOK_PATH; // 예: books/sea-otter.html
const BASELINE = process.env.BASELINE;    // 기준본(원본) URL
const AUDIO_GLOB = process.env.AUDIO_GLOB; // 예: **/audio/sea-otter/**
const OUT = process.argv[2] || '/tmp';
if (!BOOK_PATH || !BASELINE || !AUDIO_GLOB) { console.error('BOOK_PATH, BASELINE, AUDIO_GLOB 환경변수가 필요함'); process.exit(2); }
const URL = BASE + '/' + BOOK_PATH;
const FILE_GLOB = '**/' + BOOK_PATH.split('/').pop();
const results = [];
function rec(name, ok, detail) { results.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(browser, o = {}) {
  const ctx = await browser.newContext({ viewport: { width: o.width || 375, height: o.height || 700 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  if (o.init) await ctx.addInitScript(o.init);
  const page = await ctx.newPage();
  const errs = [], warns = [];
  page.on('pageerror', (e) => errs.push('pageerror ' + e));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_ABORTED|Failed to load resource/.test(m.text())) errs.push(m.text()); if (m.type() === 'warning') warns.push(m.text()); });
  if (o.route) await o.route(page, ctx);
  await page.goto(o.url || URL, { waitUntil: 'load' });
  return { ctx, page, errs, warns };
}
const st = (page) => page.evaluate(() => {
  const b = document.querySelector('.nar-bar'); const a = b.querySelector('audio');
  return { state: b.dataset.state, scene: b.dataset.scene, view: b.dataset.view, rate: b.dataset.rate, follow: b.dataset.follow, t: a.currentTime, paused: a.paused, src: (a.currentSrc || '').split('/').pop().split('?')[0], rateA: a.playbackRate, status: b.querySelector('.nar-status').textContent, errVisible: !b.querySelector('.nar-err').hidden };
});
const waitFor = (page, fn, arg, t = 8000) => page.waitForFunction(fn, arg, { timeout: t });
const click = (page, sel) => page.click(sel);
const play = (page) => click(page, '.nar-play');
async function waitPlaying(page, src, t = 8000) {
  await waitFor(page, (s) => { const b = document.querySelector('.nar-bar'), a = b.querySelector('audio'); return b.dataset.state === 'playing' && !a.paused && a.currentTime > 0.3 && (!s || a.currentSrc.indexOf(s) >= 0); }, src, t);
}
const seekEnd = (page, before = 0.5) => page.evaluate((b) => { const a = document.querySelector('.nar-bar audio'); a.currentTime = Math.max(0, a.duration - b); }, before);
const aligned = (page, sel, t = 4000) => waitFor(page, (s) => { const bar = document.querySelector('.nar-bar').getBoundingClientRect(); const r = document.querySelector(s).getBoundingClientRect(); return Math.abs(r.top - bar.bottom) < 40; }, sel, t);
async function swipe(page, x1, y1, x2, y2) {
  const c = await page.context().newCDPSession(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] });
  await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: (x1 + x2) / 2, y: (y1 + y2) / 2 }] });
  await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x2, y: y2 }] });
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const visibleSections = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => getComputedStyle(e).display !== 'none'), sel);
const count = (page) => page.textContent('.nar-count');
// 스크롤이 멈출 때까지 기다린다(책 CSS에 scroll-behavior:smooth가 있으면 즉시 이동도 애니메이션으로 진행된다)
async function settle(page, max = 5000) {
  let last = -1, same = 0; const t0 = Date.now();
  while (Date.now() - t0 < max) { const y = await page.evaluate(() => Math.round(scrollY)); if (y === last) { if (++same >= 4) return; } else { same = 0; last = y; } await sleep(60); }
}

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ONLY = process.env.ONLY; // 예: ONLY=G 이면 이름이 G로 시작하는 항목만 실행
  const guard = async (name, fn) => { if (ONLY && !name.startsWith(ONLY)) return; try { await fn(); } catch (e) { rec(name + ' (시험 실행 오류)', false, String(e).split('\n')[0].slice(0, 220)); } };

  // 책 정보(manifest와 DOM에서)
  const probe = await open(browser);
  const raw = await probe.page.evaluate(() => fetch(location.href).then((x) => x.text()));
  const info = await probe.page.evaluate(() => {
    const m = JSON.parse(document.getElementById('narration-manifest').textContent);
    const secs = [...document.querySelectorAll(m.sections)];
    return { sectionsSel: m.sections, nSec: secs.length, review: m.review_status, scenes: m.scenes.map((s) => { const el = document.querySelector(s.selector); const h = el && s.heading_selector ? el.querySelector(s.heading_selector) : null; return { id: s.scene_id, sel: s.selector, file: s.audio_url.split('/').pop().split('?')[0], sec: secs.indexOf(el), title: h ? h.textContent.replace(/\s+/g, ' ').trim() : '' }; }) };
  });
  await probe.ctx.close();
  const SC = info.scenes, N = SC.length, S = info.sectionsSel;
  const fmt = (i) => `${i + 1} / ${N} · ${SC[i].title}`;
  console.log(`책: ${BOOK_PATH}, 낭독 장면 ${N}개, 전체 쪽 ${info.nSec}개, review_status=${info.review}`);
  rec('책 정보: 장면 2개 이상, 모든 장면이 섹션에 연결됨', N >= 2 && SC.every((s) => s.sec >= 0), `장면 ${N}, 쪽 ${info.nSec}`);
  const nonNarr = []; for (let i = 0; i < info.nSec; i++) if (!SC.some((s) => s.sec === i)) nonNarr.push(i);
  const lastIdx = N - 1;

  // A. 모바일 레이아웃
  for (const w of [320, 375, 480]) await guard('A 레이아웃 ' + w, async () => {
    const { ctx, page, errs } = await open(browser, { width: w });
    await page.waitForSelector('.nar-bar');
    const m0 = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, panelHidden: document.querySelector('.nar-panel').hidden, ai: document.querySelector('.nar-ai').textContent }));
    rec(`A${w} 가로 스크롤 없음(초기), 패널 숨김, "AI 음성" 표시`, m0.sw <= m0.cw && m0.panelHidden && m0.ai === 'AI 음성', `${m0.sw}/${m0.cw}`);
    await play(page); await waitPlaying(page);
    const m1 = await page.evaluate(() => { const els = [...document.querySelectorAll('.nar-bar button, .nar-bar select')].filter((e) => e.offsetParent !== null); const r = els.map((e) => e.getBoundingClientRect()); return { minW: Math.round(Math.min(...r.map((x) => x.width))), minH: Math.round(Math.min(...r.map((x) => x.height))), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
    rec(`A${w} 터치 영역 44px 이상·가로 스크롤 없음(패널 열림)`, m1.minW >= 44 && m1.minH >= 44 && m1.sw <= m1.cw, `최소 ${m1.minW}x${m1.minH}`);
    await page.evaluate(() => window.scrollTo(0, 2000)); await sleep(200);
    const top = await page.evaluate(() => Math.round(document.querySelector('.nar-bar').getBoundingClientRect().top));
    rec(`A${w} 스크롤해도 상단바 고정`, top >= 0 && top <= 2, `top=${top}`);
    rec(`A${w} 콘솔 오류 없음`, errs.length === 0, errs.join(' | ').slice(0, 200));
    await ctx.close();
  });

  // B. 재생 시작과 기본 속도
  await guard('B 재생·속도', async () => {
    const { ctx, page, errs } = await open(browser);
    await page.waitForSelector('.nar-bar');
    await play(page); await waitPlaying(page, SC[0].file);
    const s = await st(page);
    rec('B 듣기: 첫 장면부터 재생, 기본 속도 1.15배', s.state === 'playing' && s.src === SC[0].file && s.rateA === 1.15, `${s.src} ${s.rateA}`);
    rec('B 상태 문구 "n / N · 제목"', s.status === fmt(0), s.status);
    const ok = []; for (const r of ['0.9', '1', '1.15', '1.25', '1.35']) { await page.selectOption('.nar-panel select', r); await sleep(60); ok.push((await st(page)).rateA === parseFloat(r)); }
    rec('B 속도 5종 반영', ok.every(Boolean));
    rec('B 콘솔 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
    await ctx.close();
  });

  // C·D. 장면 이동, 연속/한 장면, 마지막 장면
  await guard('C 장면 이동', async () => {
    const { ctx, page, errs } = await open(browser);
    await page.waitForSelector('.nar-bar');
    await play(page); await waitPlaying(page, SC[0].file);
    await click(page, '[data-a=next]'); await waitPlaying(page, SC[1].file);
    let s = await st(page);
    rec('C 재생 중 다음 장면', s.scene === SC[1].id && s.src === SC[1].file && s.status === fmt(1), s.status);
    await aligned(page, SC[1].sel); rec('C 화면이 해당 장면으로 이동(따라가기)', true);
    await click(page, '[data-a=prev]'); await waitPlaying(page, SC[0].file);
    rec('C 재생 중 이전 장면', (await st(page)).scene === SC[0].id);
    await play(page); await sleep(150); s = await st(page);
    rec('C 멈춤', s.state === 'paused' && s.paused);
    await click(page, '[data-a=next]'); await sleep(400); s = await st(page);
    rec('C 정지 중 다음 장면: 자동재생하지 않고 장면만 이동', s.state === 'paused' && s.paused && s.scene === SC[1].id);
    await play(page); await waitPlaying(page, SC[1].file);
    rec('C 이어서 듣기: 이동한 장면부터', (await st(page)).src === SC[1].file);
    await click(page, '[data-a=first]'); await waitPlaying(page, SC[0].file);
    rec('C 처음부터', (await st(page)).scene === SC[0].id);
    rec('C 콘솔 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
    await ctx.close();
  });
  await guard('D 연속·종료', async () => {
    const { ctx, page, errs } = await open(browser);
    await page.waitForSelector('.nar-bar');
    await play(page); await waitPlaying(page, SC[0].file);
    await click(page, '[data-a=next]'); await waitPlaying(page, SC[1].file);
    await seekEnd(page, 0.4); await waitPlaying(page, SC[2].file, 10000);
    rec('D 연속 낭독: 장면 종료 시 다음 장면 자동 재생', (await st(page)).scene === SC[2].id);
    await aligned(page, SC[2].sel); rec('D 화면이 다음 장면으로 따라감', true);
    await click(page, '[data-a=cont]'); await seekEnd(page, 0.4);
    await waitFor(page, () => document.querySelector('.nar-bar').dataset.state === 'idle', null, 10000);
    let s = await st(page);
    rec('D 한 장면 모드: 종료 시 정지', s.state === 'idle' && s.src === SC[2].file && /이 장면 낭독이 끝났어요/.test(s.status), s.status);
    await click(page, '[data-a=cont]');
    for (let i = 0; i < N + 5; i++) { if (await page.isDisabled('[data-a=next]')) break; await click(page, '[data-a=next]'); await sleep(50); }
    s = await st(page);
    rec('D 다음 장면 버튼이 마지막 장면에서 비활성', s.scene === SC[lastIdx].id && (await page.isDisabled('[data-a=next]')), s.scene);
    await play(page); await waitPlaying(page, SC[lastIdx].file);
    await seekEnd(page, 0.4); await waitFor(page, () => document.querySelector('.nar-bar').dataset.state === 'idle', null, 10000);
    s = await st(page);
    rec('D 마지막 장면 종료 시 정지(다른 파일로 넘어가지 않음)', s.state === 'idle' && s.src === SC[lastIdx].file && /낭독이 끝났어요/.test(s.status), s.status);
    rec('D 콘솔 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
    await ctx.close();
  });

  // E. 읽기 방식 전환: 재생 위치 유지
  await guard('E 모드 전환', async () => {
    const { ctx, page, errs } = await open(browser);
    await page.waitForSelector('.nar-bar');
    await play(page); await waitPlaying(page, SC[0].file);
    await click(page, '[data-a=next]'); await waitPlaying(page, SC[1].file); await click(page, '[data-a=next]'); await waitPlaying(page, SC[2].file);
    await waitFor(page, () => document.querySelector('.nar-bar audio').currentTime > 2.5, null, 8000);
    const before = await st(page);
    await click(page, '.nar-modes [data-mode=page]'); await settle(page);
    let s = await st(page); const vis = await visibleSections(page, S);
    rec('E 세로→페이지: 재생이 끊기지 않고 같은 위치에서 계속', s.state === 'playing' && !s.paused && s.src === SC[2].file && s.t >= before.t - 0.1 && s.t < before.t + 3, `${before.t.toFixed(2)}→${s.t.toFixed(2)}`);
    rec('E 페이지 모드: 재생 중인 장면의 쪽만 표시', vis.filter(Boolean).length === 1 && vis[SC[2].sec] === true);
    rec('E 페이지 표시', (await count(page)) === `${SC[2].sec + 1} / ${info.nSec}`, await count(page));
    const t2 = s.t;
    await click(page, '.nar-modes [data-mode=scroll]'); await settle(page); s = await st(page);
    rec('E 페이지→세로: 재생 위치 유지', s.state === 'playing' && !s.paused && s.src === SC[2].file && s.t >= t2);
    rec('E 세로 모드: 모든 쪽 다시 표시', (await visibleSections(page, S)).every(Boolean));
    await aligned(page, SC[2].sel); rec('E 세로 모드: 재생 중인 장면 위치로 이동', true);
    const k = Math.min(4, N - 1);
    await play(page); await sleep(100);
    await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'start' }), SC[k].sel); await settle(page);
    await click(page, '.nar-modes [data-mode=page]'); await sleep(500);
    const vis3 = await visibleSections(page, S);
    rec('E 정지 중 모드 전환: 읽던 장면 유지', vis3.filter(Boolean).length === 1 && vis3[SC[k].sec] === true);
    await click(page, '.nar-modes [data-mode=scroll]'); await sleep(700); await aligned(page, SC[k].sel);
    rec('E 정지 중 페이지→세로: 같은 장면 위치로 복귀', true);
    rec('E 콘솔 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
    await ctx.close();
  });

  // F. 페이지 모드 수동 이동(버튼·방향키·스와이프), 낭독 없는 쪽
  await guard('F 수동 페이지 이동', async () => {
    const { ctx, page, errs } = await open(browser);
    await page.waitForSelector('.nar-bar');
    await click(page, '.nar-modes [data-mode=page]'); await sleep(300);
    await play(page); await waitPlaying(page, SC[0].file);
    const expectFor = (sec) => SC.findIndex((x) => x.sec === sec);
    let sec = SC[0].sec;
    for (const [name, act] of [['다음 페이지 버튼', () => click(page, '.nar-pager [data-p="1"]')], ['오른쪽 방향키', () => page.keyboard.press('ArrowRight')], ['왼쪽 스와이프', () => swipe(page, 300, 350, 60, 350)]]) {
      sec += 1; const k = expectFor(sec);
      await act(); await sleep(500); const s = await st(page);
      if (k >= 0) rec(`F 재생 중 ${name}: 해당 장면 음성으로 이동`, s.scene === SC[k].id && s.state === 'playing', s.scene);
      else rec(`F 재생 중 ${name}: 낭독 없는 쪽이면 정지하고 안내`, s.state === 'idle' && /이 쪽에는 낭독이 없어요/.test(s.status), s.status);
      if (k < 0) break;
    }
    await swipe(page, 60, 350, 300, 350); await sleep(400);
    await play(page); await sleep(150);
    const pausedScene = (await st(page)).scene;
    await click(page, '.nar-pager [data-p="1"]'); await sleep(400);
    const s2 = await st(page);
    rec('F 정지 중 쪽 넘김: 자동재생하지 않음', s2.paused && s2.state !== 'playing', s2.state);
    if (nonNarr.length) {
      await page.evaluate(() => { for (let i = 0; i < 60; i++) { const b = document.querySelector('.nar-pager [data-p="1"]'); if (!b.disabled) b.click(); } });
      await sleep(400);
      rec(`F 마지막 쪽 표시 "${info.nSec} / ${info.nSec}"`, (await count(page)) === `${info.nSec} / ${info.nSec}`);
      await play(page); await waitPlaying(page);
      rec('F 낭독 없는 쪽에서 듣기: 첫 장면부터', (await st(page)).scene === SC[0].id);
    }
    rec('F 콘솔 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
    await ctx.close();
  });

  // G. 사용자 스크롤은 따라가기만 끈다
  await guard('G 스크롤 따라가기', async () => {
    const { ctx, page, errs } = await open(browser);
    await page.waitForSelector('.nar-bar');
    await play(page); await waitPlaying(page, SC[0].file); await click(page, '[data-a=next]'); await waitPlaying(page, SC[1].file); await aligned(page, SC[1].sel);
    await page.mouse.move(100, 400); await page.mouse.wheel(0, 400); await sleep(300); await settle(page);
    const s = await st(page);
    rec('G 직접 스크롤: 따라가기만 꺼지고 음성은 계속, 재개 버튼 표시', s.follow === 'false' && s.state === 'playing' && !s.paused && (await page.isVisible('[data-a=follow]')));
    await click(page, '[data-a=follow]');
    try { await aligned(page, SC[1].sel, 6000); } catch (e) { const d = await st(page); const dd = await page.evaluate((sel) => Math.round(document.querySelector(sel).getBoundingClientRect().top - document.querySelector('.nar-bar').getBoundingClientRect().bottom), SC[1].sel); throw new Error(`정렬 실패: 현재 장면 ${d.scene}, 상태 ${d.state}, 거리 ${dd}px`); }
    rec('G 따라가기 재개: 현재 장면으로 이동', (await st(page)).follow === 'true');
    rec('G 콘솔 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
    await ctx.close();
  });

  // H. 오류 복구, I. 저장소 차단
  await guard('H 오류 복구', async () => {
    let block = true;
    const { ctx, page, errs } = await open(browser, { route: async (p) => { await p.route(AUDIO_GLOB, (r) => (block ? r.abort() : r.continue())); } });
    await page.waitForSelector('.nar-bar');
    const textBefore = await page.evaluate((sel) => document.querySelector(sel).innerText, SC[1].sel);
    rec('H 음성 요청이 막혀도 듣기 버튼은 비활성이 아님', !(await page.isDisabled('.nar-play')));
    await play(page); await waitFor(page, () => document.querySelector('.nar-bar').dataset.state === 'error', null, 8000);
    const s = await st(page);
    rec('H 음성 로드 실패: 오류 안내와 다시 시도 버튼', s.errVisible && (await page.isVisible('[data-a=retry]')) && /글은 그대로 읽을 수 있어요/.test(s.status));
    rec('H 오류 중에도 본문은 그대로', textBefore === (await page.evaluate((sel) => document.querySelector(sel).innerText, SC[1].sel)));
    block = false; await click(page, '[data-a=retry]'); await waitPlaying(page, SC[0].file, 10000);
    rec('H 차단 해제 후 다시 시도: 정상 재생', (await st(page)).state === 'playing');
    rec('H 콘솔 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
    await ctx.close();
    const o = await open(browser); await o.page.waitForSelector('.nar-bar'); await o.ctx.setOffline(true);
    await play(o.page); await waitFor(o.page, () => document.querySelector('.nar-bar').dataset.state === 'error', null, 8000);
    await o.page.click('.nar-modes [data-mode=page]'); await sleep(300); await click(o.page, '.nar-pager [data-p="1"]'); await sleep(200);
    rec('H 오프라인: 오류 안내 중에도 페이지 넘김 정상', (await count(o.page)) === '2 / ' + info.nSec);
    await o.ctx.setOffline(false); await o.ctx.close();
  });
  await guard('I 저장소 차단', async () => {
    const init = () => { const bad = () => { throw new DOMException('blocked', 'SecurityError'); }; Storage.prototype.getItem = bad; Storage.prototype.setItem = bad; Storage.prototype.removeItem = bad; };
    const { ctx, page, errs } = await open(browser, { init });
    await page.waitForSelector('.nar-bar'); await play(page); await waitPlaying(page, SC[0].file);
    rec('I 저장소 차단: 재생 정상, 기본 속도 1.15배', (await st(page)).rateA === 1.15);
    rec('I 콘솔 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
    await ctx.close();
  });

  // J. 인쇄와 기존 본문·삽화·기능 회귀(기준본과 비교)
  await guard('J 인쇄·회귀', async () => {
    const o = await open(browser, { width: 900, height: 900 });
    const b = await open(browser, { width: 900, height: 900, url: BASELINE });
    await o.page.waitForSelector('.nar-bar');
    await o.page.click('.nar-modes [data-mode=page]'); await sleep(300);
    await o.page.emulateMedia({ media: 'print' });
    const pr = await o.page.evaluate((sel) => ({ bar: getComputedStyle(document.querySelector('.nar-bar')).display, pager: getComputedStyle(document.querySelector('.nar-pager')).display, all: [...document.querySelectorAll(sel)].every((s) => getComputedStyle(s).display !== 'none') }), S);
    rec('J 인쇄 미디어: 상단바·페이지 이동 숨김, 모든 쪽 표시(페이지 모드에서도)', pr.bar === 'none' && pr.pager === 'none' && pr.all);
    const pdfCount = async (p) => { const buf = await p.pdf({ preferCSSPageSize: true, printBackground: true }); const m = buf.toString('latin1').match(/\/Type\s*\/Page(?![a-z])/g); return m ? m.length : 0; };
    await b.page.emulateMedia({ media: 'print' });
    const [n1, n0] = [await pdfCount(o.page), await pdfCount(b.page)];
    rec('J 인쇄(PDF) 쪽 수가 기준본과 동일', n1 === n0 && n0 > 0, `적용 ${n1}쪽, 기준 ${n0}쪽`);
    await o.page.emulateMedia({ media: 'screen' }); await b.page.emulateMedia({ media: 'screen' });
    const sig = (p) => p.evaluate(async (sel) => {
      const norm = (h) => h.replace(/ ?nar-sec/g, '').replace(/ ?nar-off/g, '').replace(/ class=""/g, '');
      const sha = async (s) => { const x = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(x)].map((v) => v.toString(16).padStart(2, '0')).join('').slice(0, 12); };
      const secs = []; for (const s of document.querySelectorAll(sel)) secs.push(await sha(norm(s.outerHTML)));
      const hd = document.querySelector('header'), ft = document.querySelector('footer');
      return { secs, header: hd ? await sha(hd.outerHTML) : null, footer: ft ? await sha(ft.outerHTML) : null, imgs: document.querySelectorAll('img').length, title: document.title, lang: document.documentElement.lang };
    }, S);
    const [s1, s0] = [await sig(o.page), await sig(b.page)];
    rec(`J 모든 쪽(${s1.secs.length}개)의 본문·삽화 HTML이 기준본과 동일`, JSON.stringify(s1.secs) === JSON.stringify(s0.secs) && s1.secs.length === info.nSec);
    rec('J 머리말·꼬리말·제목·lang·삽화 수 동일', s1.header === s0.header && s1.footer === s0.footer && s1.imgs === s0.imgs && s1.title === s0.title && s1.lang === s0.lang, `삽화 ${s1.imgs}`);
    // 기존 머리말 버튼 동작(글자 크기·인쇄 등)이 기준본과 같은지: 같은 순서로 눌러 결과를 비교
    const exist = (p) => p.evaluate(() => { window.__p = 0; window.print = () => { window.__p++; }; const out = []; const btns = [...document.querySelectorAll('header button')]; for (const k of [1, 1, 0, 2]) { if (btns[k]) { btns[k].click(); out.push(btns[k].textContent.trim() + ':' + getComputedStyle(document.documentElement).getPropertyValue('--scale').trim()); } } return { out, printed: window.__p, n: btns.length }; });
    const [e1, e0] = [await exist(o.page), await exist(b.page)];
    rec('J 기존 머리말 버튼(글자 크기·인쇄 등) 동작이 기준본과 동일', JSON.stringify(e1) === JSON.stringify(e0) && e1.n > 0, JSON.stringify(e1));
    const lay = (p) => p.evaluate(() => ({ w: Math.round(document.querySelector('main').getBoundingClientRect().width), sw: document.documentElement.scrollWidth }));
    rec('J 데스크톱 폭에서 본문 영역 폭이 기준본과 동일', JSON.stringify(await lay(o.page)) === JSON.stringify(await lay(b.page)));
    rec('J 콘솔 오류 없음', o.errs.length === 0 && b.errs.length === 0, [...o.errs, ...b.errs].join(' | ').slice(0, 200));
    await o.ctx.close(); await b.ctx.close();
  });

  // K. 본문·음성 불일치 방어, N. 장애 격리
  await guard('K·N 불일치 방어와 장애 격리', async () => {
    const withRoute = (fn) => ({ route: async (p) => { await p.route(FILE_GLOB, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fn(raw) })); } });
    const MRE = /(<script type="application\/json" id="narration-manifest">)(.*?)(<\/script>)/s;
    const mutate = (fn) => (b) => b.replace(MRE, (m, a, j, c) => { const o = JSON.parse(j.replace(/<\\\//g, '</')); fn(o); return a + JSON.stringify(o).replace(/<\//g, '<\\/') + c; });
    // 본문이 바뀐 장면은 건너뜀: 2번째 장면 제목의 마지막 글자를 바꾼다
    const t2 = SC[2].title;
    const o1 = await open(browser, withRoute((b) => b.replace(`>${t2}<`, `>${t2.slice(0, -1)}X<`)));
    await o1.page.waitForSelector('.nar-bar'); await sleep(500);
    await play(o1.page); await waitPlaying(o1.page, SC[0].file);
    await click(o1.page, '[data-a=next]'); await waitPlaying(o1.page, SC[1].file);
    await seekEnd(o1.page, 0.3); await waitPlaying(o1.page, SC[3].file, 10000);
    rec('K 본문이 바뀐 장면은 연속 낭독에서 건너뜀', (await st(o1.page)).scene === SC[3].id && o1.warns.some((w) => /건너뜀/.test(w)));
    await o1.ctx.close();
    const readingWorks = async (page) => {
      const m = await page.evaluate(() => ({ narr: document.querySelector('.nar-bar').dataset.narration, play: getComputedStyle(document.querySelector('.nar-play')).display }));
      await page.click('.nar-modes [data-mode=page]'); await sleep(300);
      const v1 = (await visibleSections(page, S)).filter(Boolean).length;
      await click(page, '.nar-pager [data-p="1"]'); await click(page, '.nar-pager [data-p="1"]'); await sleep(200);
      const c1 = await count(page);
      await swipe(page, 300, 300, 60, 300); await sleep(250); const c2 = await count(page);
      await page.click('.nar-modes [data-mode=scroll]'); await sleep(500);
      return { off: m.narr === 'off' && m.play === 'none', ok: v1 === 1 && c1 === `3 / ${info.nSec}` && c2 === `4 / ${info.nSec}` && (await visibleSections(page, S)).every(Boolean), detail: `${c1},${c2}` };
    };
    const cases = [['manifest JSON 손상', (b) => b.replace(MRE, (m, a, j, c) => a + '{BROKEN' + j.slice(1) + c)], ['플레이어 버전 불일치', mutate((o) => { o.player_version = '9.9.9'; })], ['연결되는 장면이 없음', mutate((o) => { o.scenes.forEach((s) => { s.selector = '#nope'; }); })]];
    for (const [name, fn] of cases) {
      const o = await open(browser, withRoute(fn)); await o.page.waitForSelector('.nar-bar'); await sleep(200);
      const r = await readingWorks(o.page);
      rec(`N ${name}: 낭독만 꺼지고 읽기 방식 정상, 처리되지 않은 오류 없음`, r.off && r.ok && o.errs.length === 0, r.detail + ' ' + o.errs.join('|').slice(0, 100));
      await o.ctx.close();
    }
    { const o = await open(browser, { route: async (p) => { await p.route(AUDIO_GLOB, (r) => r.fulfill({ status: 404, body: 'nf' })); } });
      await o.page.waitForSelector('.nar-bar'); await play(o.page); await waitFor(o.page, () => document.querySelector('.nar-bar').dataset.state === 'error', null, 8000);
      await o.page.click('.nar-modes [data-mode=page]'); await sleep(300); await click(o.page, '.nar-pager [data-p="1"]'); await sleep(200);
      rec('N 음성 404(오류 안내 중): 페이지 넘김 정상, 처리되지 않은 오류 없음', (await st(o.page)).errVisible && (await count(o.page)) === '2 / ' + info.nSec && o.errs.length === 0);
      await o.ctx.close(); }
    { const o = await open(browser, { init: () => { HTMLMediaElement.prototype.play = function () { throw new Error('boom'); }; } });
      await o.page.waitForSelector('.nar-bar'); await play(o.page); await sleep(500);
      const r = await readingWorks(o.page);
      rec('N 재생 중 예외: 낭독만 꺼지고 읽기 방식 정상, 처리되지 않은 오류 없음', r.off && r.ok && o.errs.length === 0, r.detail);
      await o.ctx.close(); }
  });

  await browser.close();
  const fails = results.filter((r) => !r.ok);
  fs.writeFileSync(OUT + '/book-test-results.json', JSON.stringify(results, null, 1));
  console.log(`\n시험 ${results.length}개, 통과 ${results.length - fails.length}, 실패 ${fails.length}`);
  process.exit(fails.length ? 1 : 0);
})();
