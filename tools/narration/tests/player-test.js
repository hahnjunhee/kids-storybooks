// 전기뱀장어 낭독 시범 브라우저 통합 시험(Playwright Chromium). tests/run-tests.sh로 실행한다.
// 낭독 적용본과 기준본(원본 HTML)을 같은 브라우저에서 비교해 본문·삽화·기존 기능 회귀도 확인한다.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/kids-storybooks';
const URL = BASE + '/books/korean-electric-eel-storybook.html';
const BASELINE = process.env.BASELINE || BASE + '/_baseline/eel.html'; // 공개 URL 시험 때는 로컬 서버의 기준본 주소를 지정한다
const OUT = process.argv[2] || '/tmp';
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
  return { state: b.dataset.state, scene: b.dataset.scene, mode: b.dataset.view, rate: b.dataset.rate, follow: b.dataset.follow, t: a.currentTime, paused: a.paused, src: (a.currentSrc || '').split('/').pop().split('?')[0], dur: a.duration, rateA: a.playbackRate, ended: a.ended, status: b.querySelector('.nar-status').textContent, errVisible: !b.querySelector('.nar-err').hidden };
});
const waitFor = (page, fn, arg, t = 8000) => page.waitForFunction(fn, arg, { timeout: t });
const click = (page, sel) => page.click(sel);
const play = (page) => click(page, '.nar-play');
async function waitPlaying(page, src, t = 8000) {
  await waitFor(page, (s) => { const b = document.querySelector('.nar-bar'), a = b.querySelector('audio'); return b.dataset.state === 'playing' && !a.paused && a.currentTime > 0.3 && (!s || a.currentSrc.indexOf(s) >= 0); }, src, t);
}
async function seekEnd(page, before = 0.5) { await page.evaluate((b) => { const a = document.querySelector('.nar-bar audio'); a.currentTime = Math.max(0, a.duration - b); }, before); }
async function aligned(page, id, t = 4000) { // 장면이 상단바 바로 아래에 맞춰졌는지
  await waitFor(page, (i) => { const bar = document.querySelector('.nar-bar').getBoundingClientRect(); const r = document.getElementById(i).getBoundingClientRect(); return Math.abs(r.top - bar.bottom) < 40; }, id, t);
}
async function swipe(page, x1, y1, x2, y2) {
  const c = await page.context().newCDPSession(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] });
  await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: (x1 + x2) / 2, y: (y1 + y2) / 2 }] });
  await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x2, y: y2 }] });
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const visibleSections = (page) => page.evaluate(() => [...document.querySelectorAll('main > section')].map((s) => getComputedStyle(s).display !== 'none'));

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const guard = async (name, fn) => { try { await fn(); } catch (e) { rec(name + ' (시험 실행 오류)', false, String(e).split('\n')[0].slice(0, 200)); } };

  // A. 모바일 레이아웃(320/375/480): 가로 스크롤, 터치 영역, 고정 상단바, AI 음성 표시
  for (const w of [320, 375, 480]) await guard('A 레이아웃 ' + w, async () => {
    const { ctx, page, errs } = await open(browser, { width: w });
    await page.waitForSelector('.nar-bar');
    const m0 = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, panelHidden: document.querySelector('.nar-panel').hidden, ai: document.querySelector('.nar-ai').textContent, barH: document.querySelector('.nar-bar').offsetHeight }));
    rec(`A${w} 가로 스크롤 없음(초기)`, m0.sw <= m0.cw, `${m0.sw}/${m0.cw}`);
    rec(`A${w} 초기에는 컨트롤 패널 숨김, "AI 음성" 표시`, m0.panelHidden && m0.ai === 'AI 음성');
    await play(page); await waitPlaying(page);
    const m1 = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.nar-bar button, .nar-bar select')].filter((e) => e.offsetParent !== null);
      const r = els.map((e) => e.getBoundingClientRect());
      return { n: els.length, minW: Math.round(Math.min(...r.map((x) => x.width))), minH: Math.round(Math.min(...r.map((x) => x.height))), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, barH: document.querySelector('.nar-bar').offsetHeight };
    });
    rec(`A${w} 터치 영역 44px 이상(패널 열림, 버튼 ${m1.n}개)`, m1.minW >= 44 && m1.minH >= 44, `최소 ${m1.minW}x${m1.minH}`);
    rec(`A${w} 가로 스크롤 없음(패널 열림)`, m1.sw <= m1.cw, `${m1.sw}/${m1.cw}, 상단바 높이 ${m1.barH}px`);
    await page.evaluate(() => window.scrollTo(0, 2000)); await sleep(200);
    const top = await page.evaluate(() => Math.round(document.querySelector('.nar-bar').getBoundingClientRect().top));
    rec(`A${w} 스크롤해도 상단바 고정`, top >= 0 && top <= 2, `top=${top}`);
    if (w === 320) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: OUT + '/shot-320-panel.png' }); }
    rec(`A${w} 콘솔 오류 없음`, errs.length === 0, errs.join(' | ').slice(0, 200));
    await ctx.close();
  });

  // B. 재생 시작, 기본 속도 1.15, 속도 선택과 저장
  await guard('B 재생·속도', async () => {
    const { ctx, page, errs } = await open(browser);
    await page.waitForSelector('.nar-bar');
    await play(page); await waitPlaying(page, 's00.mp3');
    let s = await st(page);
    rec('B 듣기를 누르면 현재 장면(표지)부터 재생', s.state === 'playing' && s.src === 's00.mp3' && s.scene === 'scene0', JSON.stringify({ src: s.src, scene: s.scene }));
    rec('B 기본 재생 속도 1.15배(오디오·표시 모두)', s.rateA === 1.15 && s.rate === '1.15' && (await page.inputValue('.nar-panel select')) === '1.15', `rateA=${s.rateA}`);
    rec('B 상태 문구에 장면 번호와 제목', /1 \/ 13 · 찌릿찌릿! 전기뱀장어의 비밀/.test(s.status), s.status);
    const ok = [];
    for (const r of ['0.9', '1', '1.15', '1.25', '1.35']) { await page.selectOption('.nar-panel select', r); await sleep(80); ok.push((await st(page)).rateA === parseFloat(r)); }
    rec('B 속도 0.9/1.0/1.15/1.25/1.35 모두 즉시 반영', ok.every(Boolean), ok.join(','));
    const opts = await page.$$eval('.nar-panel select option', (o) => o.map((x) => x.value));
    rec('B 속도 선택지는 정확히 5개(1.5배 없음)', JSON.stringify(opts) === JSON.stringify(['0.9', '1', '1.15', '1.25', '1.35']), opts.join(','));
    await page.selectOption('.nar-panel select', '1.25');
    await page.reload(); await page.waitForSelector('.nar-bar');
    rec('B 선택한 속도가 새로고침 후에도 유지(1.25)', (await st(page)).rate === '1.25');
    rec('B 콘솔 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
    await ctx.close();
  });

  // C. 장면 이동(재생 중/정지 중)과 화면 따라가기
  await guard('C 장면 이동', async () => {
    const { ctx, page, errs } = await open(browser);
    await page.waitForSelector('.nar-bar');
    await play(page); await waitPlaying(page, 's00.mp3');
    await click(page, '[data-a=next]'); await waitPlaying(page, 's01.mp3');
    let s = await st(page);
    rec('C 재생 중 다음 장면: 음성이 1장으로 전환', s.scene === 'scene1' && s.src === 's01.mp3' && /2 \/ 13 · 아마존으로 떠나요!/.test(s.status), s.status);
    await aligned(page, 'scene1');
    rec('C 세로 모드에서 화면이 해당 장면으로 이동(따라가기)', true);
    await click(page, '[data-a=prev]'); await waitPlaying(page, 's00.mp3');
    rec('C 재생 중 이전 장면: 표지로 복귀', (await st(page)).scene === 'scene0');
    await play(page); await sleep(150);
    s = await st(page);
    rec('C 멈춤: 정지 상태, 오디오 일시정지', s.state === 'paused' && s.paused);
    const tPaused = s.t;
    await click(page, '[data-a=next]'); await sleep(400);
    s = await st(page);
    rec('C 정지 중 다음 장면: 자동재생하지 않고 장면만 이동', s.state === 'paused' && s.paused && s.scene === 'scene1' && Math.abs(s.t - tPaused) < 0.5, `state=${s.state} scene=${s.scene}`);
    await play(page); await waitPlaying(page, 's01.mp3');
    rec('C 이어서 듣기: 이동한 장면(1장)부터 재생', (await st(page)).src === 's01.mp3');
    await click(page, '[data-a=first]'); await waitPlaying(page, 's00.mp3');
    rec('C 처음부터: 표지부터 다시 재생', (await st(page)).scene === 'scene0');
    rec('C 콘솔 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
    await ctx.close();
  });

  // D. 연속 낭독, 한 장면 모드, 마지막 장면 종료
  await guard('D 연속·종료', async () => {
    const { ctx, page, errs } = await open(browser);
    await page.waitForSelector('.nar-bar');
    await play(page); await waitPlaying(page, 's00.mp3');
    await click(page, '[data-a=next]'); await waitPlaying(page, 's01.mp3');
    await seekEnd(page, 0.4); await waitPlaying(page, 's02.mp3', 10000);
    let s = await st(page);
    rec('D 연속 낭독: 장면이 끝나면 다음 장면(2장)이 자동 재생', s.scene === 'scene2' && s.state === 'playing', s.scene);
    await aligned(page, 'scene2');
    rec('D 연속 낭독 중 화면이 다음 장면으로 따라감', true);
    await click(page, '[data-a=cont]');
    rec('D 연속 낭독 끄면 라벨이 "한 장면"', (await page.textContent('[data-a=cont]')) === '한 장면' && (await page.getAttribute('[data-a=cont]', 'aria-pressed')) === 'false');
    await seekEnd(page, 0.4); await waitFor(page, () => document.querySelector('.nar-bar').dataset.state === 'idle', null, 10000);
    s = await st(page);
    rec('D 한 장면 모드: 장면이 끝나면 정지(다음으로 넘어가지 않음)', s.state === 'idle' && s.src === 's02.mp3' && /이 장면 낭독이 끝났어요/.test(s.status), s.status);
    await click(page, '[data-a=cont]');
    // 마지막 장면까지 이동
    for (let i = 0; i < 20; i++) { if (await page.isDisabled('[data-a=next]')) break; await click(page, '[data-a=next]'); await sleep(60); }
    s = await st(page);
    rec('D 다음 장면 버튼이 마지막 장면(12장)에서 비활성', s.scene === 'scene12' && (await page.isDisabled('[data-a=next]')), s.scene);
    await play(page); await waitPlaying(page, 's12.mp3');
    await seekEnd(page, 0.4); await waitFor(page, () => document.querySelector('.nar-bar').dataset.state === 'idle', null, 10000);
    s = await st(page);
    rec('D 마지막 장면 종료 시 정지(발견 노트나 다음 파일로 넘어가지 않음)', s.state === 'idle' && s.src === 's12.mp3' && /낭독이 끝났어요/.test(s.status), s.status);
    rec('D 콘솔 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
    await ctx.close();
  });

  // E. 읽기 방식 전환: 재생 위치 유지
  await guard('E 모드 전환', async () => {
    const { ctx, page, errs } = await open(browser);
    await page.waitForSelector('.nar-bar');
    await play(page); await waitPlaying(page, 's00.mp3');
    await click(page, '[data-a=next]'); await waitPlaying(page, 's01.mp3');
    await click(page, '[data-a=next]'); await waitPlaying(page, 's02.mp3');
    await waitFor(page, () => document.querySelector('.nar-bar audio').currentTime > 2.5, null, 8000);
    const before = await st(page);
    await click(page, '.nar-modes [data-mode=page]'); await sleep(500);
    let s = await st(page); const vis = await visibleSections(page);
    rec('E 세로→페이지: 재생이 끊기지 않고 같은 위치에서 계속', s.state === 'playing' && !s.paused && s.src === 's02.mp3' && s.t >= before.t - 0.1 && s.t < before.t + 3, `전 ${before.t.toFixed(2)} 후 ${s.t.toFixed(2)}`);
    rec('E 페이지 모드: 재생 중인 장면(2장)의 쪽만 표시', vis.filter(Boolean).length === 1 && vis[2] === true, vis.map((v) => (v ? 1 : 0)).join(''));
    rec('E 페이지 표시 "3 / 14"(2장은 14쪽 중 3번째)', (await page.textContent('.nar-count')) === '3 / 14');
    const t2 = s.t;
    await click(page, '.nar-modes [data-mode=scroll]'); await sleep(900);
    s = await st(page); const vis2 = await visibleSections(page);
    rec('E 페이지→세로: 재생 위치 유지', s.state === 'playing' && !s.paused && s.src === 's02.mp3' && s.t >= t2, `${t2.toFixed(2)}→${s.t.toFixed(2)}`);
    rec('E 세로 모드: 모든 장면 다시 표시', vis2.every(Boolean));
    await aligned(page, 'scene2');
    rec('E 세로 모드: 재생 중인 장면(2장) 위치로 이동', true);
    // 정지 상태에서 읽던 위치 유지
    await play(page); await sleep(100);
    await page.evaluate(() => document.getElementById('scene5').scrollIntoView({ block: 'start' })); await sleep(300);
    await click(page, '.nar-modes [data-mode=page]'); await sleep(500);
    const vis3 = await visibleSections(page);
    rec('E 정지 중 모드 전환: 읽던 장면(5장) 유지', vis3.filter(Boolean).length === 1 && vis3[5] === true, vis3.map((v) => (v ? 1 : 0)).join(''));
    await click(page, '.nar-modes [data-mode=scroll]'); await sleep(700);
    await aligned(page, 'scene5');
    rec('E 정지 중 페이지→세로: 같은 장면(5장) 위치로 복귀', true);
    rec('E 콘솔 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
    await ctx.close();
  });

  // F. 페이지 모드에서 수동 이동(버튼·키·스와이프), 발견 노트 쪽
  await guard('F 수동 페이지 이동', async () => {
    const { ctx, page, errs } = await open(browser);
    await page.waitForSelector('.nar-bar');
    await click(page, '.nar-modes [data-mode=page]'); await sleep(300);
    await play(page); await waitPlaying(page, 's00.mp3');
    await click(page, '.nar-pager [data-p="1"]'); await waitPlaying(page, 's01.mp3');
    let s = await st(page);
    rec('F 재생 중 쪽 넘김(다음 페이지 버튼): 해당 장면 음성으로 이동', s.scene === 'scene1' && s.state === 'playing');
    await page.keyboard.press('ArrowRight'); await waitPlaying(page, 's02.mp3');
    rec('F 재생 중 오른쪽 방향키: 2장 음성', (await st(page)).scene === 'scene2');
    await swipe(page, 300, 350, 60, 350); await waitPlaying(page, 's03.mp3');
    rec('F 재생 중 왼쪽으로 스와이프(다음 쪽): 3장 음성', (await st(page)).scene === 'scene3');
    await swipe(page, 60, 350, 300, 350); await waitPlaying(page, 's02.mp3');
    rec('F 재생 중 오른쪽으로 스와이프(이전 쪽): 2장 음성', (await st(page)).scene === 'scene2');
    await play(page); await sleep(150);
    const pausedT = (await st(page)).t;
    await click(page, '.nar-pager [data-p="1"]'); await sleep(500);
    s = await st(page);
    rec('F 정지 중 쪽 넘김: 자동재생하지 않고 장면만 갱신', s.state === 'paused' && s.paused && s.scene === 'scene3' && /4 \/ 13/.test(s.status), `${s.state} ${s.scene}`);
    await play(page); await waitPlaying(page, 's03.mp3');
    rec('F 이어서 듣기: 넘긴 쪽의 장면부터', (await st(page)).src === 's03.mp3');
    // 발견 노트(낭독 없는 쪽)
    await page.evaluate(() => { for (let i = 0; i < 20; i++) { const b = document.querySelector('.nar-pager [data-p="1"]'); if (!b.disabled) b.click(); } });
    await sleep(500);
    s = await st(page);
    rec('F 재생 중 낭독 없는 쪽(발견 노트)으로 이동: 정지하고 안내', s.state === 'idle' && /이 쪽에는 낭독이 없어요/.test(s.status), s.status);
    rec('F 다음 페이지 버튼이 마지막 쪽에서 비활성, 표시 "14 / 14"', (await page.isDisabled('.nar-pager [data-p="1"]')) && (await page.textContent('.nar-count')) === '14 / 14');
    await play(page); await waitPlaying(page);
    rec('F 발견 노트 쪽에서 듣기: 첫 장면부터(낭독 범위 밖이므로)', (await st(page)).scene === 'scene0');
    rec('F 콘솔 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
    await ctx.close();
  });

  // G. 사용자 스크롤: 따라가기만 중지, 음성은 계속
  await guard('G 스크롤 따라가기', async () => {
    const { ctx, page, errs } = await open(browser);
    await page.waitForSelector('.nar-bar');
    await play(page); await waitPlaying(page, 's00.mp3');
    await click(page, '[data-a=next]'); await waitPlaying(page, 's01.mp3'); await aligned(page, 'scene1');
    await page.mouse.move(100, 400); await page.mouse.wheel(0, 400); await sleep(300);
    let s = await st(page);
    rec('G 직접 스크롤하면 따라가기만 꺼지고 음성은 계속', s.follow === 'false' && s.state === 'playing' && !s.paused);
    rec('G "따라가기" 재개 버튼 표시', await page.isVisible('[data-a=follow]'));
    await seekEnd(page, 0.4); await waitPlaying(page, 's02.mp3', 10000);
    const barBottom = await page.evaluate(() => document.querySelector('.nar-bar').getBoundingClientRect().bottom);
    const top2 = await page.evaluate(() => document.getElementById('scene2').getBoundingClientRect().top);
    rec('G 따라가기 꺼진 상태에서 다음 장면으로 넘어가도 화면은 그대로', Math.abs(top2 - barBottom) > 40, `scene2 top=${Math.round(top2)}`);
    await click(page, '[data-a=follow]'); await aligned(page, 'scene2');
    s = await st(page);
    rec('G 따라가기 재개: 현재 장면으로 이동하고 버튼 숨김', s.follow === 'true' && !(await page.isVisible('[data-a=follow]')));
    rec('G 콘솔 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
    await ctx.close();
  });

  // H. 오류 복구: 요청 차단, 재시도, 오프라인
  await guard('H 오류 복구', async () => {
    let block = true;
    const { ctx, page, errs } = await open(browser, { route: async (p) => { await p.route('**/audio/electric-eel/**', (r) => (block ? r.abort() : r.continue())); } });
    await page.waitForSelector('.nar-bar');
    const textBefore = await page.evaluate(() => document.getElementById('scene1').innerText);
    rec('H 음성 요청이 막혀도 듣기 버튼은 비활성이 아님', !(await page.isDisabled('.nar-play')));
    await play(page); await waitFor(page, () => document.querySelector('.nar-bar').dataset.state === 'error', null, 8000);
    let s = await st(page);
    rec('H 음성 로드 실패: 오류 안내와 다시 시도 버튼 표시', s.errVisible && (await page.isVisible('[data-a=retry]')) && /글은 그대로 읽을 수 있어요/.test(s.status), s.status);
    const textAfter = await page.evaluate(() => document.getElementById('scene1').innerText);
    rec('H 오류 중에도 본문은 그대로 읽힘', textBefore === textAfter && textAfter.length > 20);
    await click(page, '[data-a=retry]'); await waitFor(page, () => document.querySelector('.nar-bar').dataset.state === 'error', null, 8000);
    rec('H 차단 중 재시도는 계속 오류 상태(무한 반복 없음)', (await st(page)).errVisible);
    block = false; await click(page, '[data-a=retry]'); await waitPlaying(page, 's00.mp3', 10000);
    s = await st(page);
    rec('H 차단 해제 후 다시 시도: 정상 재생·오류 안내 숨김', s.state === 'playing' && !s.errVisible);
    rec('H 콘솔 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
    await ctx.close();
    // 오프라인
    const o = await open(browser);
    await o.page.waitForSelector('.nar-bar');
    await o.ctx.setOffline(true);
    await play(o.page); await waitFor(o.page, () => document.querySelector('.nar-bar').dataset.state === 'error', null, 8000);
    rec('H 오프라인: 오류 안내(버튼은 비활성 아님), 본문 읽기 유지', (await st(o.page)).errVisible && !(await o.page.isDisabled('.nar-play')) && (await o.page.evaluate(() => document.getElementById('scene2').innerText.length)) > 20);
    await o.ctx.setOffline(false); await click(o.page, '[data-a=retry]'); await waitPlaying(o.page, 's00.mp3', 10000);
    rec('H 온라인 복귀 후 다시 시도: 정상 재생', (await st(o.page)).state === 'playing');
    await o.ctx.close();
  });

  // I. 저장소 차단(localStorage 접근 예외)
  await guard('I 저장소 차단', async () => {
    const init = () => { const bad = () => { throw new DOMException('blocked', 'SecurityError'); }; Storage.prototype.getItem = bad; Storage.prototype.setItem = bad; Storage.prototype.removeItem = bad; };
    const { ctx, page, errs } = await open(browser, { init });
    await page.waitForSelector('.nar-bar');
    await play(page); await waitPlaying(page, 's00.mp3');
    let s = await st(page);
    rec('I 저장소가 차단돼도 재생 정상, 기본 속도 1.15배', s.state === 'playing' && s.rateA === 1.15);
    await page.selectOption('.nar-panel select', '1.35'); await sleep(100);
    rec('I 저장소 차단 상태에서도 속도 변경은 현재 세션에 적용', (await st(page)).rateA === 1.35);
    rec('I 콘솔 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
    await ctx.close();
  });

  // J. 인쇄, 기존 기능 회귀
  await guard('J 인쇄·회귀', async () => {
    const o = await open(browser, { width: 900, height: 900 });
    const b = await open(browser, { width: 900, height: 900, url: BASELINE });
    await o.page.waitForSelector('.nar-bar');
    await o.page.click('.nar-modes [data-mode=page]'); await sleep(300);
    await o.page.emulateMedia({ media: 'print' });
    const pr = await o.page.evaluate(() => ({ bar: getComputedStyle(document.querySelector('.nar-bar')).display, pager: getComputedStyle(document.querySelector('.nar-pager')).display, secs: [...document.querySelectorAll('main > section')].map((s) => getComputedStyle(s).display !== 'none') }));
    rec('J 인쇄 미디어: 상단바·페이지 이동 숨김', pr.bar === 'none' && pr.pager === 'none');
    rec('J 페이지 모드에서도 인쇄는 모든 장면(14쪽) 표시', pr.secs.every(Boolean) && pr.secs.length === 14, pr.secs.length + '개');
    const pdfCount = async (p) => { const buf = await p.pdf({ preferCSSPageSize: true, printBackground: true }); const txt = buf.toString('latin1'); const m = txt.match(/\/Type\s*\/Page(?![a-z])/g); return m ? m.length : 0; };
    await o.page.emulateMedia({ media: 'print' });
    const [n1, n0] = [await pdfCount(o.page), await pdfCount(b.page)];
    rec('J 인쇄(PDF) 쪽 수가 기준본과 동일', n1 === n0 && n0 > 0, `낭독 적용 ${n1}쪽, 기준 ${n0}쪽`);
    await o.page.emulateMedia({ media: 'screen' });
    // 본문·삽화·머리말·꼬리말 동일성(런타임 DOM)
    const sig = (p) => p.evaluate(async () => {
      const norm = (h) => h.replace(/ ?nar-sec/g, '').replace(/ ?nar-off/g, '').replace(/ class=""/g, '');
      const sha = async (s) => { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 12); };
      const secs = []; for (const s of document.querySelectorAll('main > section')) secs.push(await sha(norm(s.outerHTML)));
      return { secs, header: await sha(document.querySelector('header').outerHTML), footer: await sha(document.querySelector('footer').outerHTML), imgs: document.querySelectorAll('main img').length, title: document.title, lang: document.documentElement.lang };
    });
    const [s1, s0] = [await sig(o.page), await sig(b.page)];
    rec('J 모든 장면·삽화(14개 섹션 HTML) 기준본과 동일', JSON.stringify(s1.secs) === JSON.stringify(s0.secs) && s1.secs.length === 14);
    rec('J 머리말·꼬리말·제목·lang·삽화 수 동일', s1.header === s0.header && s1.footer === s0.footer && s1.imgs === s0.imgs && s1.title === s0.title && s1.lang === s0.lang, `삽화 ${s1.imgs}`);
    // 글자 크기·인쇄 버튼(기존 기능)
    const exist = async (p) => p.evaluate(() => { window.__p = 0; window.print = () => { window.__p++; }; const out = []; document.getElementById('larger').click(); out.push(getComputedStyle(document.documentElement).getPropertyValue('--scale')); document.getElementById('larger').click(); out.push(getComputedStyle(document.documentElement).getPropertyValue('--scale')); document.getElementById('smaller').click(); out.push(getComputedStyle(document.documentElement).getPropertyValue('--scale')); document.getElementById('print').click(); return { out, printed: window.__p, fs: getComputedStyle(document.querySelector('.story')).fontSize }; });
    const [e1, e0] = [await exist(o.page), await exist(b.page)];
    rec('J 기존 글자 크기 ±·인쇄 버튼 동작이 기준본과 동일', JSON.stringify(e1) === JSON.stringify(e0) && e1.printed === 1, JSON.stringify(e1));
    const lay = async (p) => p.evaluate(() => { const r = document.querySelector('header').getBoundingClientRect(); return { w: Math.round(document.querySelector('main').getBoundingClientRect().width), sw: document.documentElement.scrollWidth }; });
    rec('J 데스크톱 폭에서 본문 영역 폭이 기준본과 동일, 가로 스크롤 없음', JSON.stringify(await lay(o.page)) === JSON.stringify(await lay(b.page)));
    rec('J 콘솔 오류 없음', o.errs.length === 0 && b.errs.length === 0, [...o.errs, ...b.errs].join(' | ').slice(0, 200));
    await o.ctx.close(); await b.ctx.close();
  });

  // K. 본문과 음성 불일치(해시), 버전 불일치
  await guard('K 불일치 방어', async () => {
    // 원본 HTML은 브라우저 안에서 가져온다(Node 쪽 요청은 프록시 환경에서 외부 도메인을 못 찾을 수 있다)
    const t = await open(browser);
    const raw = await t.page.evaluate(() => fetch(location.href).then((x) => x.text()));
    await t.ctx.close();
    const mod = (fn) => ({ route: async (p) => { await p.route('**/korean-electric-eel-storybook.html', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fn(raw) })); } });
    const o1 = await open(browser, mod((b) => b.replace('<h2>특별한 능력</h2>', '<h2>특별한 능럭</h2>')));
    await o1.page.waitForSelector('.nar-bar');
    await sleep(500);
    await play(o1.page); await waitPlaying(o1.page, 's00.mp3');
    await click(o1.page, '[data-a=next]'); await waitPlaying(o1.page, 's01.mp3');
    await click(o1.page, '[data-a=next]'); await waitPlaying(o1.page, 's02.mp3');
    rec('K 본문이 바뀐 장면(3장)의 음성은 다음 장면 이동에서 건너뜀', true);
    await click(o1.page, '[data-a=next]'); await waitPlaying(o1.page, 's04.mp3');
    const s = await st(o1.page);
    rec('K 3장(본문 변경)을 건너뛰고 4장 음성으로 이동', s.scene === 'scene4', s.scene);
    rec('K 불일치 경고가 콘솔에 남음', o1.warns.some((w) => /건너뜀/.test(w)), o1.warns.join(' | ').slice(0, 120));
    await seekEnd(o1.page, 0.3);
    await o1.ctx.close();
    const o2 = await open(browser, mod((b) => b.replace(/"player_version":"[0-9.]+"/, '"player_version":"9.9.9"')));
    await sleep(500);
    rec('K 플레이어·manifest 버전 불일치: 낭독만 끄고 읽기 방식(세로/페이지)은 유지', (await o2.page.$('.nar-bar')) !== null && (await o2.page.getAttribute('.nar-bar', 'data-narration')) === 'off' && !(await o2.page.isVisible('.nar-play')) && (await o2.page.isVisible('.nar-modes')) && (await o2.page.evaluate(() => document.querySelectorAll('main > section').length)) === 14);
    await o2.ctx.close();
  });

  // L. 접근성: 이름, 상태 영역, 키보드 포커스
  await guard('L 접근성', async () => {
    const { ctx, page, errs } = await open(browser);
    await page.waitForSelector('.nar-bar');
    await play(page); await waitPlaying(page);
    const nm = await page.evaluate(() => [...document.querySelectorAll('.nar-bar button, .nar-bar select')].filter((e) => e.offsetParent !== null).map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim()).filter(Boolean).length);
    const all = await page.evaluate(() => [...document.querySelectorAll('.nar-bar button, .nar-bar select')].filter((e) => e.offsetParent !== null).length);
    rec('L 보이는 모든 컨트롤에 접근 가능한 이름', nm >= all, `${nm}/${all}`);
    rec('L 상태 문구는 role=status(aria-live)', (await page.getAttribute('.nar-status', 'role')) === 'status' && (await page.getAttribute('.nar-status', 'aria-live')) === 'polite');
    rec('L 토글 버튼은 aria-pressed 사용', (await page.getAttribute('.nar-modes [data-mode=scroll]', 'aria-pressed')) === 'true' && (await page.getAttribute('.nar-modes [data-mode=page]', 'aria-pressed')) === 'false' && (await page.getAttribute('[data-a=cont]', 'aria-pressed')) === 'true');
    await page.keyboard.press('Tab'); const tag = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
    rec('L 키보드 Tab으로 컨트롤에 포커스 이동', ['BUTTON', 'SELECT', 'A'].includes(tag), tag);
    rec('L 콘솔 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
    await ctx.close();
  });

  // M. 템플릿(음성 없이 읽기 방식만): 낭독 UI는 숨기고 세로/페이지 전환·페이지 이동만 제공
  await guard('M 템플릿 읽기 방식', async () => {
    const T = BASE + '/templates/storybook.html';
    for (const w of [320, 480]) {
      const { ctx, page, errs } = await open(browser, { width: w, url: T });
      await page.waitForSelector('.nar-bar');
      const m = await page.evaluate(() => {
        const vis = (s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none'; };
        const els = [...document.querySelectorAll('.nar-modes button')];
        const r = els.map((e) => e.getBoundingClientRect());
        return { play: vis('.nar-play'), ai: vis('.nar-ai'), panel: vis('.nar-panel'), modes: vis('.nar-modes'), n: els.length, minW: Math.round(Math.min(...r.map((x) => x.width))), minH: Math.round(Math.min(...r.map((x) => x.height))), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, narr: document.querySelector('.nar-bar').dataset.narration };
      });
      rec(`M${w} 낭독 컨트롤(듣기·AI 음성·패널)은 숨김, 읽기 방식 버튼만 표시`, !m.play && !m.ai && !m.panel && m.modes && m.n === 2 && m.narr === 'off', JSON.stringify(m));
      rec(`M${w} 터치 영역 44px 이상·가로 스크롤 없음`, m.minW >= 44 && m.minH >= 44 && m.sw <= m.cw, `최소 ${m.minW}x${m.minH}, ${m.sw}/${m.cw}`);
      await page.click('.nar-modes [data-mode=page]'); await sleep(400);
      let vis = await visibleSections(page);
      rec(`M${w} 페이지 모드: 첫 쪽만 표시, "1 / 4"`, vis.filter(Boolean).length === 1 && vis[0] === true && (await page.textContent('.nar-count')) === '1 / 4', vis.map((v) => (v ? 1 : 0)).join(''));
      await click(page, '.nar-pager [data-p="1"]'); await page.keyboard.press('ArrowRight'); await sleep(300);
      vis = await visibleSections(page);
      rec(`M${w} 다음 페이지 버튼·방향키로 3번째 쪽("3 / 4")`, vis[2] === true && vis.filter(Boolean).length === 1 && (await page.textContent('.nar-count')) === '3 / 4');
      await swipe(page, 60, 300, 300, 300); await sleep(300);
      rec(`M${w} 오른쪽 스와이프로 이전 쪽("2 / 4")`, (await page.textContent('.nar-count')) === '2 / 4');
      await page.click('.nar-modes [data-mode=scroll]'); await sleep(900);
      const al = await page.evaluate(() => { const b = document.querySelector('.nar-bar').getBoundingClientRect().bottom; return Math.round(Math.abs(document.getElementById('scene1').getBoundingClientRect().top - b)); });
      rec(`M${w} 세로로 돌아오면 보던 장면(1장)에 위치`, al < 40, `차이 ${al}px`);
      rec(`M${w} 콘솔 오류 없음`, errs.length === 0, errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
    const { ctx, page } = await open(browser, { width: 900, height: 900, url: T });
    await page.waitForSelector('.nar-bar'); await page.click('.nar-modes [data-mode=page]'); await page.emulateMedia({ media: 'print' });
    const pr = await page.evaluate(() => ({ bar: getComputedStyle(document.querySelector('.nar-bar')).display, secs: [...document.querySelectorAll('main > section')].map((s) => getComputedStyle(s).display !== 'none') }));
    rec('M 템플릿 인쇄: 상단바 숨김, 모든 장면(4개 섹션) 표시', pr.bar === 'none' && pr.secs.length === 4 && pr.secs.every(Boolean));
    await page.emulateMedia({ media: 'screen' });
    const f = await page.evaluate(() => { document.getElementById('larger').click(); return getComputedStyle(document.documentElement).getPropertyValue('--scale'); });
    rec('M 템플릿 글자 크기 + 버튼 동작', f === '1.10', f);
    await ctx.close();
  });

  // N. 장애 격리: 낭독 모듈이 실패해도 기본 열람(세로/페이지 넘김)은 유지된다
  await guard('N 장애 격리', async () => {
    const t = await open(browser);
    const raw = await t.page.evaluate(() => fetch(location.href).then((x) => x.text()));
    await t.ctx.close();
    const MRE = /(<script type="application\/json" id="narration-manifest">)(.*?)(<\/script>)/s;
    const mutate = (fn) => (b) => b.replace(MRE, (m, a, j, c) => { const o = JSON.parse(j.replace(/<\\\//g, '</')); const r = fn(o); return a + (typeof r === 'string' ? r : JSON.stringify(o).replace(/<\//g, '<\\/')) + c; });
    const withRoute = (fn) => ({ route: async (p) => { await p.route('**/korean-electric-eel-storybook.html', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fn(raw) })); } });
    // 읽기 방식이 정상인지: 낭독 UI 숨김, 세로↔페이지 전환, 쪽 이동(버튼·스와이프), 세로로 복귀
    const readingWorks = async (page) => {
      const m = await page.evaluate(() => ({ narr: document.querySelector('.nar-bar').dataset.narration, play: getComputedStyle(document.querySelector('.nar-play')).display, panel: getComputedStyle(document.querySelector('.nar-panel')).display }));
      await page.click('.nar-modes [data-mode=page]'); await sleep(300);
      const v1 = (await visibleSections(page)).filter(Boolean).length;
      await click(page, '.nar-pager [data-p="1"]'); await click(page, '.nar-pager [data-p="1"]'); await sleep(200);
      const c1 = await page.textContent('.nar-count');
      await swipe(page, 300, 300, 60, 300); await sleep(250);
      const c2 = await page.textContent('.nar-count');
      await page.keyboard.press('ArrowLeft'); await sleep(200);
      const c3 = await page.textContent('.nar-count');
      await page.click('.nar-modes [data-mode=scroll]'); await sleep(500);
      const v2 = (await visibleSections(page)).every(Boolean);
      return { off: m.narr === 'off' && m.play === 'none' && m.panel === 'none', ok: v1 === 1 && c1 === '3 / 14' && c2 === '4 / 14' && c3 === '3 / 14' && v2, detail: `${c1},${c2},${c3}` };
    };
    const cases = [
      ['manifest JSON 손상', (b) => b.replace(MRE, (m, a, j, c) => a + '{BROKEN' + j.slice(1) + c)],
      ['플레이어 버전 불일치', mutate((o) => { o.player_version = '9.9.9'; })],
      ['manifest.scenes 형식 오류', mutate((o) => { o.scenes = 'x'; })],
      ['연결되는 장면이 하나도 없음(선택자 오류)', mutate((o) => { o.scenes.forEach((s) => { s.selector = '#nope'; }); })],
      ['container·sections 선택자 오류(기본값 main > section으로 대체, 낭독은 유지)', mutate((o) => { o.container = '!!bad'; o.sections = '!!bad'; }), false],
    ];
    for (const [name, fn, expectOff = true] of cases) {
      const o = await open(browser, withRoute(fn));
      await o.page.waitForSelector('.nar-bar'); await sleep(200);
      const r = await readingWorks(o.page);
      rec(`N ${name}: ${expectOff ? '낭독 UI는 꺼지고 ' : ''}읽기 방식은 정상`, (expectOff ? r.off : true) && r.ok, r.detail);
      rec(`N ${name}: 처리되지 않은 오류 없음`, o.errs.length === 0, o.errs.join(' | ').slice(0, 160));
      await o.ctx.close();
    }
    // 음성 파일 누락(404): 낭독은 오류 안내, 읽기 방식은 정상
    { const o = await open(browser, { route: async (p) => { await p.route('**/audio/electric-eel/**', (r) => r.fulfill({ status: 404, body: 'nf' })); } });
      await o.page.waitForSelector('.nar-bar');
      await play(o.page); await waitFor(o.page, () => document.querySelector('.nar-bar').dataset.state === 'error', null, 8000);
      await o.page.click('.nar-modes [data-mode=page]'); await sleep(300);
      await click(o.page, '.nar-pager [data-p="1"]'); await swipe(o.page, 300, 300, 60, 300); await sleep(300);
      const c = await o.page.textContent('.nar-count'); const v = (await visibleSections(o.page)).filter(Boolean).length;
      await o.page.click('.nar-modes [data-mode=scroll]'); await sleep(400);
      rec('N 음성 파일 404(오류 안내 중): 페이지 넘김·모드 전환 정상', (await st(o.page)).errVisible && c === '3 / 14' && v === 1 && (await visibleSections(o.page)).every(Boolean), c);
      rec('N 음성 파일 404: 처리되지 않은 오류 없음', o.errs.length === 0, o.errs.join(' | ').slice(0, 160));
      await o.ctx.close(); }
    // 낭독 코드의 런타임 예외(재생 호출이 던짐): 낭독만 꺼지고 읽기 방식 유지
    { const o = await open(browser, { init: () => { HTMLMediaElement.prototype.play = function () { throw new Error('boom'); }; } });
      await o.page.waitForSelector('.nar-bar');
      await play(o.page); await sleep(500);
      const r = await readingWorks(o.page);
      rec('N 재생 중 예외 발생: 낭독만 꺼지고 읽기 방식 유지', r.off && r.ok, r.detail);
      rec('N 재생 중 예외 발생: 처리되지 않은 오류 없음(경고만)', o.errs.length === 0 && o.warns.some((w) => /오류로 낭독을 끔/.test(w)), o.errs.join(' | ').slice(0, 160));
      await o.ctx.close(); }
    // 낭독 모듈 초기화 중 예외(오디오 요소 부착 실패): 낭독만 꺼지고 읽기 방식 유지
    { const o = await open(browser, { init: () => { const orig = Node.prototype.appendChild; Node.prototype.appendChild = function (c) { if (c && c.tagName === 'AUDIO') throw new Error('init-fail'); return orig.apply(this, arguments); }; } });
      await o.page.waitForSelector('.nar-bar'); await sleep(200);
      const r = await readingWorks(o.page);
      rec('N 낭독 초기화 예외: 낭독만 꺼지고 읽기 방식 유지', r.off && r.ok, r.detail);
      rec('N 낭독 초기화 예외: 처리되지 않은 오류 없음', o.errs.length === 0, o.errs.join(' | ').slice(0, 160));
      await o.ctx.close(); }
    // 오프라인 + 본문 불일치에서도 읽기 방식 정상
    { const o = await open(browser);
      await o.page.waitForSelector('.nar-bar'); await o.ctx.setOffline(true);
      await play(o.page); await waitFor(o.page, () => document.querySelector('.nar-bar').dataset.state === 'error', null, 8000);
      await o.page.click('.nar-modes [data-mode=page]'); await sleep(300); await click(o.page, '.nar-pager [data-p="1"]'); await sleep(200);
      rec('N 오프라인(오류 안내 중): 페이지 넘김 정상', (await o.page.textContent('.nar-count')) === '2 / 14' && (await visibleSections(o.page)).filter(Boolean).length === 1);
      await o.ctx.close(); }
  });

  await browser.close();
  const fails = results.filter((r) => !r.ok);
  fs.writeFileSync(OUT + '/player-test-results.json', JSON.stringify(results, null, 1));
  console.log(`\n시험 ${results.length}개, 통과 ${results.length - fails.length}, 실패 ${fails.length}`);
  process.exit(fails.length ? 1 : 0);
})();
