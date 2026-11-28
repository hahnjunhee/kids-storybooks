#!/usr/bin/env bash
# 저장소 루트에서 실행: bash tools/narration/tests/run-tests.sh [기준 git 참조, 기본 origin/main]
# 요건: node, Playwright(전역 설치 또는 NODE_PATH), git. 기준본 HTML은 git에서 꺼내 임시 폴더로 제공한다.
set -euo pipefail
REF="${1:-origin/main}"; PORT="${PORT:-8765}"
TMP="$(mktemp -d)"; mkdir -p "$TMP/_baseline"
git show "$REF:books/korean-electric-eel-storybook.html" > "$TMP/_baseline/eel.html"
node tools/narration/tests/serve.js "$PWD" "$PORT" "$TMP" &
SRV=$!; trap 'kill $SRV 2>/dev/null; rm -rf "$TMP"' EXIT; sleep 1
mkdir -p "$TMP/out"
BASE="http://127.0.0.1:$PORT/kids-storybooks" NODE_PATH="${NODE_PATH:-$(npm root -g)}" node tools/narration/tests/player-test.js "$TMP/out"
