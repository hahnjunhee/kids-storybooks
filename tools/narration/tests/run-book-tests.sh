#!/usr/bin/env bash
# 책별 범용 브라우저 시험. 저장소 루트에서: bash tools/narration/tests/run-book-tests.sh <어댑터 JSON> <기준 git 참조(낭독 적용 전 원본)>
# 예: bash tools/narration/tests/run-book-tests.sh tools/narration/adapters/sea-otter.json origin/main
# 요건: node, Playwright(전역 설치 또는 NODE_PATH), git. 기준본 HTML은 git에서 꺼내 임시 폴더로 제공한다.
set -euo pipefail
AD="${1:?어댑터 JSON 경로}"; REF="${2:?기준 git 참조}"; PORT="${PORT:-8765}"
HTML="$(node -e "console.log(require('./$AD').html)")"
ADIR="$(node -e "console.log(require('./$AD').audio_dir)")"
TMP="$(mktemp -d)"; mkdir -p "$TMP/_baseline" "$TMP/out"
git show "$REF:$HTML" > "$TMP/_baseline/book.html"
node tools/narration/tests/serve.js "$PWD" "$PORT" "$TMP" &
SRV=$!; trap 'kill $SRV 2>/dev/null; rm -rf "$TMP"' EXIT; sleep 1
BASE="${BASE:-http://127.0.0.1:$PORT/kids-storybooks}" BOOK_PATH="$HTML" AUDIO_GLOB="**/$ADIR/**" \
BASELINE="${BASELINE:-http://127.0.0.1:$PORT/kids-storybooks/_baseline/book.html}" NODE_PATH="${NODE_PATH:-$(npm root -g)}" \
node tools/narration/tests/book-test.js "$TMP/out"
