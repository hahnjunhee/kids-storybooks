/* 그림책 낭독 플레이어 + 읽기 방식(세로/페이지) — 공통 소스. 빌드(build.py)가 압축해 각 책 HTML에 인라인으로 넣는다.
 * 책 HTML은 본문·삽화를 바꾸지 않고, 이 스크립트가 상단바와 페이지 이동 UI를 런타임에 만든다.
 * 입력: <script type="application/json" id="narration-manifest"> (필드는 기획안 v1.1 §4).
 * 실패해도 기존 읽기는 그대로 동작해야 한다: 모든 저장소 접근은 try/catch, 오류는 UI 안내로 처리한다. */
(function () {
  'use strict';
  var VERSION = '1.0.0';
  if (window.__narrationLoaded) return;
  var mEl = document.getElementById('narration-manifest');
  if (!mEl) return;
  var M;
  try { M = JSON.parse(mEl.textContent); } catch (e) { console.warn('narration: manifest parse error'); return; }
  if (M.schema_version !== 1 || M.player_version !== VERSION) { console.warn('narration: version mismatch'); return; }
  window.__narrationLoaded = 1;

  var RATES = [0.9, 1, 1.15, 1.25, 1.35], DEFAULT_RATE = 1.15;
  var d = document;
  var sections = [].slice.call(d.querySelectorAll(M.sections));
  if (!sections.length) return;
  sections.forEach(function (s) { s.classList.add('nar-sec'); });
  var scenes = M.scenes.map(function (s) {
    s.el = d.querySelector(s.selector);
    s.sec = sections.indexOf(s.el);
    s.ok = !!s.el && s.sec >= 0;
    return s;
  });
  var firstOk = function () { for (var i = 0; i < scenes.length; i++) if (scenes[i].ok) return i; return -1; };

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  /* ---------- UI ---------- */
  var bar = d.createElement('div');
  bar.className = 'nar-bar';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', '낭독과 읽기 방식');
  bar.innerHTML =
    '<div class="nar-row"><button type="button" class="nar-play" data-a="play">🔊 듣기</button>' +
    '<span class="nar-ai">AI 음성</span>' +
    '<span class="nar-modes" role="group" aria-label="읽기 방식">' +
    '<button type="button" data-mode="scroll" aria-pressed="true" aria-label="세로 스크롤로 읽기">세로</button>' +
    '<button type="button" data-mode="page" aria-pressed="false" aria-label="페이지 넘기기로 읽기">페이지</button></span></div>' +
    '<div class="nar-panel" hidden><div class="nar-row">' +
    '<button type="button" data-a="first" aria-label="처음부터 듣기">처음</button>' +
    '<button type="button" data-a="prev" aria-label="이전 장면">◀ 이전</button>' +
    '<button type="button" data-a="next" aria-label="다음 장면">다음 ▶</button>' +
    '<select data-a="rate" aria-label="재생 속도">' +
    RATES.map(function (r) { return '<option value="' + r + '">' + (r === 1 ? '1.0' : r) + '배</option>'; }).join('') + '</select>' +
    '<button type="button" data-a="cont" aria-pressed="true" aria-label="연속 낭독">연속</button>' +
    '<button type="button" data-a="follow" hidden>따라가기</button></div>' +
    '<div class="nar-status" role="status" aria-live="polite"></div>' +
    '<div class="nar-err" hidden><span class="nar-errtext"></span> <button type="button" data-a="retry">다시 시도</button></div></div>';
  var hdr = d.querySelector('header');
  if (hdr && hdr.parentNode === d.body) hdr.parentNode.insertBefore(bar, hdr.nextSibling);
  else d.body.insertBefore(bar, d.body.firstChild);

  var container = d.querySelector(M.container) || sections[0].parentNode;
  var pager = d.createElement('nav');
  pager.className = 'nar-pager';
  pager.hidden = true;
  pager.setAttribute('aria-label', '페이지 이동');
  pager.innerHTML = '<button type="button" data-p="-1">◀ 이전 페이지</button><span class="nar-count" aria-live="polite"></span><button type="button" data-p="1">다음 페이지 ▶</button>';
  container.parentNode.insertBefore(pager, container.nextSibling);

  var $play = bar.querySelector('.nar-play'), $panel = bar.querySelector('.nar-panel'), $status = bar.querySelector('.nar-status');
  var $err = bar.querySelector('.nar-err'), $errText = bar.querySelector('.nar-errtext'), $rate = bar.querySelector('[data-a=rate]');
  var $cont = bar.querySelector('[data-a=cont]'), $follow = bar.querySelector('[data-a=follow]');
  var $prev = bar.querySelector('[data-a=prev]'), $next = bar.querySelector('[data-a=next]');

  function setBarHeight() { d.documentElement.style.setProperty('--nar-h', (bar.offsetHeight + 8) + 'px'); }

  /* ---------- 읽기 방식: 세로 스크롤 / 페이지 넘기기 ---------- */
  var mode = 'scroll', pageIdx = 0;
  function visibleIdx() {
    var y = bar.getBoundingClientRect().bottom + 12, n = 0;
    sections.forEach(function (s, i) { if (s.getBoundingClientRect().top <= y) n = i; });
    return n;
  }
  function renderMode() {
    var paged = mode === 'page';
    sections.forEach(function (s, i) { s.classList.toggle('nar-off', paged && i !== pageIdx); });
    pager.hidden = !paged;
    [].forEach.call(bar.querySelectorAll('[data-mode]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === mode)); });
    pager.querySelector('.nar-count').textContent = (pageIdx + 1) + ' / ' + sections.length;
    pager.querySelector('[data-p="-1"]').disabled = pageIdx === 0;
    pager.querySelector('[data-p="1"]').disabled = pageIdx === sections.length - 1;
    bar.setAttribute('data-view', mode);
  }
  function showSection(si, smooth) {
    var el = sections[si];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
  }
  function setPage(si, source) { // 페이지 모드에서 쪽 이동
    si = Math.max(0, Math.min(sections.length - 1, si));
    if (si === pageIdx && source === 'user') return;
    pageIdx = si; renderMode(); showSection(si, false);
    if (source === 'user') onUserPage(si);
  }
  function setMode(m) {
    if (m === mode) return;
    if (mode === 'scroll') pageIdx = visibleIdx();
    mode = m; renderMode();
    requestAnimationFrame(function () {
      if (state === 'playing' && cur >= 0) { follow = true; syncView(cur); } // 재생 중이면 재생 장면 쪽으로(재생은 건드리지 않는다). 정지·대기 중에는 읽던 위치 유지
      else showSection(pageIdx, false);
      updateUI();
    });
  }

  /* ---------- 낭독 ---------- */
  var au = d.createElement('audio');
  au.preload = 'none';
  au.setAttribute('playsinline', '');
  bar.appendChild(au); // 화면에는 나타나지 않는 오디오 요소(컨트롤 없음)
  var state = 'idle'; // idle | playing | paused | error
  var cur = -1;        // 현재(또는 마지막) 낭독 장면 인덱스
  var loaded = -1;     // 오디오에 올라간 장면
  var rate = DEFAULT_RATE, cont = true, follow = true, started = false, token = 0;
  var sr = parseFloat(store('nar-rate'));
  if (RATES.indexOf(sr) >= 0) rate = sr;

  function active() { return started && (state === 'playing' || state === 'paused' || state === 'error'); }
  function title(i) {
    var s = scenes[i], h = s && s.el && s.heading_selector ? s.el.querySelector(s.heading_selector) : null;
    return h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
  }
  function say(t) { $status.textContent = t; }
  function updateUI() {
    $play.textContent = state === 'playing' ? '⏸ 멈춤' : (state === 'paused' ? '▶ 이어서' : '🔊 듣기');
    $play.setAttribute('aria-label', state === 'playing' ? '낭독 멈춤' : (state === 'paused' ? '낭독 이어서 듣기' : '낭독 듣기'));
    $panel.hidden = !started;
    $rate.value = String(rate);
    $cont.setAttribute('aria-pressed', String(cont));
    $cont.textContent = cont ? '연속' : '한 장면';
    $follow.hidden = !(started && mode === 'scroll' && !follow);
    var base = cur >= 0 ? scenes[cur] : null;
    $prev.disabled = !started || prevOk(cur) < 0;
    $next.disabled = !started || nextOk(cur) < 0;
    bar.setAttribute('data-state', state);
    bar.setAttribute('data-scene', cur >= 0 ? base.scene_id : '');
    bar.setAttribute('data-rate', String(rate));
    bar.setAttribute('data-follow', String(follow));
    setBarHeight();
  }
  function prevOk(i) { for (var k = i - 1; k >= 0; k--) if (scenes[k].ok) return k; return -1; }
  function nextOk(i) { for (var k = i + 1; k < scenes.length; k++) if (scenes[k].ok) return k; return -1; }
  function sceneForSection(si) {
    var best = -1, i;
    for (i = 0; i < scenes.length; i++) if (scenes[i].ok && scenes[i].sec === si) return i;
    for (i = 0; i < scenes.length; i++) if (scenes[i].ok && scenes[i].sec < si) best = i;
    var last = -1; for (i = 0; i < scenes.length; i++) if (scenes[i].ok) last = i;
    if (best >= 0 && best !== last) return best; // 두 장면 사이의 비낭독 쪽은 앞 장면
    return firstOk();                              // 앞쪽이거나 마지막 장면 뒤(발견 노트 등)는 처음부터
  }
  function exactScene(si) { for (var i = 0; i < scenes.length; i++) if (scenes[i].ok && scenes[i].sec === si) return i; return -1; }

  function syncView(i) {
    var si = scenes[i].sec;
    if (mode === 'page') { pageIdx = si; renderMode(); showSection(si, false); }
    else if (follow) showSection(si, true);
  }
  function showError(msg) {
    state = 'error'; $errText.textContent = msg; $err.hidden = false;
    say('글은 그대로 읽을 수 있어요.'); updateUI();
  }
  function clearError() { $err.hidden = true; $errText.textContent = ''; }
  function onPlayRejected(e) {
    if (e && e.name === 'AbortError') return;
    if (e && e.name === 'NotAllowedError') { state = 'paused'; say('재생이 막혔어요. 듣기를 다시 눌러 주세요.'); updateUI(); return; }
    showError('음성을 재생하지 못했어요.');
  }
  function playScene(i) {
    if (i < 0 || !scenes[i].ok) return;
    var my = ++token;
    started = true; clearError();
    cur = i; loaded = i; state = 'playing';
    au.src = scenes[i].audio_url;
    au.defaultPlaybackRate = rate; au.playbackRate = rate;
    var p = au.play();
    if (p && p.catch) p.catch(function (e) { if (my === token) onPlayRejected(e); });
    say((i + 1) + ' / ' + scenes.length + ' · ' + title(i));
    syncView(i); updateUI();
  }
  function stop(msg) {
    token++; au.pause(); state = 'idle'; if (msg) say(msg); updateUI();
  }
  au.addEventListener('ended', function () {
    var n = cont ? nextOk(cur) : -1;
    if (n >= 0) { playScene(n); return; }
    state = 'idle'; say(cont ? '낭독이 끝났어요.' : '이 장면 낭독이 끝났어요.'); updateUI();
  });
  au.addEventListener('error', function () {
    if (!au.getAttribute('src')) return;
    showError('음성을 불러오지 못했어요.');
  });
  au.addEventListener('playing', function () { if (state === 'error') return; state = 'playing'; clearError(); updateUI(); prefetch(); });
  au.addEventListener('loadedmetadata', function () { au.playbackRate = rate; });
  function prefetch() {
    var n = cont ? nextOk(cur) : -1;
    if (n < 0 || (navigator.connection && navigator.connection.saveData) || !window.fetch) return;
    try { fetch(scenes[n].audio_url, { credentials: 'omit' }).catch(function () {}); } catch (e) {}
  }

  /* 본문과 음성 일치 검사(text_hash). 불일치 장면은 낭독에서 건너뛴다. */
  function norm(t) { return t.replace(/\s+/g, ' ').trim().normalize('NFC'); }
  function sceneText(s) {
    var u = [];
    if (s.heading_selector) { var h = s.el.querySelector(s.heading_selector); if (h) u.push(norm(h.textContent)); }
    (s.paragraph_selectors || []).forEach(function (sel) { [].forEach.call(s.el.querySelectorAll(sel), function (p) { u.push(norm(p.textContent)); }); });
    return u.filter(Boolean).join('\n');
  }
  function sha(str) {
    if (!(window.crypto && crypto.subtle && window.TextEncoder)) return Promise.resolve(null);
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (b) {
      return [].map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    }).catch(function () { return null; });
  }
  var ready = Promise.all(scenes.map(function (s) {
    if (!s.ok) return null;
    return sha(sceneText(s)).then(function (h) {
      if (h && h.indexOf(s.text_hash) !== 0) { s.ok = false; s.stale = true; console.warn('narration: 본문과 음성이 달라 건너뜀', s.scene_id); }
    });
  })).then(function () { updateUI(); });

  function startFromView() {
    ready.then(function () {
      var i = sceneForSection(mode === 'page' ? pageIdx : visibleIdx());
      if (i < 0) { say('이 책에는 들을 수 있는 장면이 없어요.'); return; }
      follow = true; playScene(i);
    });
  }
  function resume() {
    if (loaded !== cur || !au.getAttribute('src')) { playScene(cur); return; }
    state = 'playing'; var p = au.play(); if (p && p.catch) p.catch(onPlayRejected); updateUI();
  }
  function onUserPage(si) { // 사용자가 직접 쪽을 넘겼을 때(페이지 모드)
    var k = exactScene(si);
    if (state === 'playing') {
      if (k < 0) stop('이 쪽에는 낭독이 없어요.');
      else if (k !== cur) playScene(k);
    } else if (started) {
      var n = k >= 0 ? k : sceneForSection(si);
      if (n >= 0 && n !== cur) { cur = n; say((n + 1) + ' / ' + scenes.length + ' · ' + title(n)); }
      updateUI();
    }
  }
  function moveTo(t) {
    if (t < 0) return;
    follow = true;
    if (state === 'playing') playScene(t);
    else { cur = t; started = true; if (state === 'error') { state = 'paused'; clearError(); } if (state === 'idle') state = 'paused'; loaded = -1; syncViewForce(t); say((t + 1) + ' / ' + scenes.length + ' · ' + title(t)); updateUI(); }
  }
  function syncViewForce(i) { var f = follow; follow = true; syncView(i); follow = f; }

  bar.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var m = b.getAttribute('data-mode'); if (m) { setMode(m); return; }
    var a = b.getAttribute('data-a');
    if (a === 'play') {
      if (state === 'playing') { au.pause(); state = 'paused'; updateUI(); }
      else if (state === 'paused' && started) resume();
      else if (state === 'error') ready.then(function () { playScene(cur >= 0 ? cur : sceneForSection(mode === 'page' ? pageIdx : visibleIdx())); });
      else startFromView();
    } else if (a === 'first') { ready.then(function () { follow = true; playScene(firstOk()); }); }
    else if (a === 'prev') moveTo(prevOk(cur));
    else if (a === 'next') moveTo(nextOk(cur));
    else if (a === 'cont') { cont = !cont; updateUI(); }
    else if (a === 'follow') { follow = true; if (cur >= 0) syncView(cur); updateUI(); }
    else if (a === 'retry') { clearError(); ready.then(function () { playScene(cur >= 0 ? cur : firstOk()); }); }
  });
  $rate.addEventListener('change', function () {
    var r = parseFloat($rate.value); if (RATES.indexOf(r) < 0) return;
    rate = r; au.defaultPlaybackRate = r; au.playbackRate = r; store('nar-rate', String(r)); updateUI();
  });
  pager.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    setPage(pageIdx + parseInt(b.getAttribute('data-p'), 10), 'user');
  });

  /* 사용자가 직접 스크롤하면 자동 따라가기만 끈다(음성은 계속) */
  function userScrolled(e) {
    if (!started || mode !== 'scroll' || !follow || bar.contains(e.target)) return;
    follow = false; updateUI();
  }
  d.addEventListener('wheel', userScrolled, { passive: true });
  d.addEventListener('touchmove', userScrolled, { passive: true });

  /* 좌우 넘김: 스와이프와 방향키(페이지 모드) */
  var start = null;
  container.addEventListener('touchstart', function (e) { start = e.touches.length === 1 ? [e.touches[0].clientX, e.touches[0].clientY] : null; }, { passive: true });
  container.addEventListener('touchcancel', function () { start = null; });
  container.addEventListener('touchend', function (e) {
    if (!start || mode !== 'page') { start = null; return; }
    var t = e.changedTouches[0], dx = t.clientX - start[0], dy = t.clientY - start[1]; start = null;
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) setPage(pageIdx + (dx < 0 ? 1 : -1), 'user');
  }, { passive: true });
  d.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (mode === 'page' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); setPage(pageIdx + (e.key === 'ArrowRight' ? 1 : -1), 'user'); return; }
    if (started && mode === 'scroll' && follow && ['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'].indexOf(e.key) >= 0) { follow = false; updateUI(); }
  });
  window.addEventListener('resize', setBarHeight);

  renderMode(); updateUI();
})();
