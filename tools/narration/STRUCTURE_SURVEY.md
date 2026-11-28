# 그림책 HTML 구조 전수 조사

조사일 2026-11-28, `tools/narration/survey.py`로 생성. 낭독 어댑터는 이 조사를 바탕으로 책마다 확정한다.
장면 후보는 이미지를 포함한 컨테이너의 직계 자식으로 자동 판정한 값이므로, 실제 어댑터 작성 때 본문 단위를 다시 확인한다.

## lulu-friends (`books/lulu-friends.html`)
- 크기: 전체 11KB, 이미지 제외 11.2KB. 이미지 12개(Base64 0, 외부 파일 12).
- 장면 컨테이너: <main>, 장면 후보 12개, 형태 <section.spread>.
- 장면 id: scene0 ~ scene11.
- 제목 요소: h2. 장면당 `p` 수: 1~1. `.story p`가 있는 장면: 0/12.
- 장면 밖 블록: <section.closing>(p=3).
- 상단: header 있음(버튼: 글자 −, 글자 +, 인쇄·PDF), 전체 버튼: 글자 −, 글자 +, 인쇄·PDF. 읽기 방식 전환 없음. header 고정(sticky) 아니오.
- `<body>` 태그 있음, 인라인 스크립트 132B, 인쇄 CSS 있음, lang=ko.

## sea-otter (`books/sea-otter.html`)
- 크기: 전체 959KB, 이미지 제외 9.0KB. 이미지 10개(Base64 10, 외부 파일 0).
- 장면 컨테이너: <main>, 장면 후보 10개, 형태 <section.spread>.
- 장면 id: scene0 ~ scene9.
- 제목 요소: h2. 장면당 `p` 수: 3~8. `.story p`가 있는 장면: 0/10.
- 장면 밖 블록: <section.activity>(p=3).
- 상단: header 있음(버튼: 글자 −, 글자 +, 인쇄·PDF), 전체 버튼: 글자 −, 글자 +, 인쇄·PDF. 읽기 방식 전환 없음. header 고정(sticky) 아니오.
- `<body>` 태그 있음, 인라인 스크립트 147B, 인쇄 CSS 있음, lang=ko.

## yeongheung (`books/yeongheung-seaside.html`)
- 크기: 전체 954KB, 이미지 제외 18.2KB. 이미지 14개(Base64 12, 외부 파일 2).
- 장면 컨테이너: <main>, 장면 후보 14개, 형태 <article.field-card>, <section.spread>.
- 장면 id: scene1 ~ scene12.
- 제목 요소: h2. 장면당 `p` 수: 2~8. `.story p`가 있는 장면: 14/14.
- 장면 밖 블록: <div.field-intro>(p=0).
- 상단: header 있음(버튼: 글자 −, 글자 +, 인쇄·PDF), 전체 버튼: 글자 −, 글자 +, 인쇄·PDF. 읽기 방식 전환 없음. header 고정(sticky) 아니오.
- `<body>` 태그 있음, 인라인 스크립트 380B, 인쇄 CSS 있음, lang=ko.

## craft-museum (`books/craft-museum-gardener.html`)
- 크기: 전체 1283KB, 이미지 제외 7.9KB. 이미지 12개(Base64 12, 외부 파일 0).
- 장면 컨테이너: <main.wrap>, 장면 후보 12개, 형태 <section.page>.
- 장면 id: 없음(안정적 id 부재, 어댑터가 순번 선택자 필요).
- 제목 요소: h2. 장면당 `p` 수: 1~1. `.story p`가 있는 장면: 0/12.
- 장면 밖 블록: 없음.
- 상단: header 있음(버튼: 가−, 가+, 인쇄), 전체 버튼: 가−, 가+, 인쇄. 읽기 방식 전환 없음. header 고정(sticky) 아니오.
- `<body>` 태그 있음, 인라인 스크립트 128B, 인쇄 CSS 있음, lang=ko.

## dinosaur (`books/korean-dinosaur-storybook.html`)
- 크기: 전체 1332KB, 이미지 제외 13.8KB. 이미지 13개(Base64 13, 외부 파일 0).
- 장면 컨테이너: <main>, 장면 후보 12개, 형태 <article>.
- 장면 id: s1 ~ s12.
- 제목 요소: h2, h3. 장면당 `p` 수: 5~12. `.story p`가 있는 장면: 0/12.
- 장면 밖 블록: 없음.
- 상단: header 있음(버튼: 없음), 전체 버튼: 글자 −, 글자 +, 인쇄, 야간 모드. 읽기 방식 전환 없음. header 고정(sticky) 아니오.
- `<body>` 태그 있음, 인라인 스크립트 622B, 인쇄 CSS 있음, lang=ko.

## electric-eel (`books/korean-electric-eel-storybook.html`)
- 크기: 전체 1616KB, 이미지 제외 8.6KB. 이미지 13개(Base64 13, 외부 파일 0).
- 장면 컨테이너: <main>, 장면 후보 13개, 형태 <section.spread>.
- 장면 id: scene0 ~ scene12.
- 제목 요소: h1, h2. 장면당 `p` 수: 1~5. `.story p`가 있는 장면: 13/13.
- 장면 밖 블록: <section#notes.activity>(p=6).
- 상단: header 있음(버튼: 글자 −, 글자 +, 인쇄·PDF), 전체 버튼: 글자 −, 글자 +, 인쇄·PDF. 읽기 방식 전환 없음. header 고정(sticky) 아니오.
- `<body>` 태그 있음, 인라인 스크립트 332B, 인쇄 CSS 있음, lang=ko.

## blood-friends (`books/blood-friends-v2.0.html`)
- 크기: 전체 447KB, 이미지 제외 5.0KB. 이미지 13개(Base64 13, 외부 파일 0).
- 장면 컨테이너: <main>, 장면 후보 13개, 형태 <section>.
- 장면 id: p0 ~ p12.
- 제목 요소: h1. 장면당 `p` 수: 1~1. `.story p`가 있는 장면: 0/13.
- 장면 밖 블록: <small>(p=0).
- 상단: header 없음(버튼: 없음), 전체 버튼: 이전, 다음. 읽기 방식 전환 없음. header 고정(sticky) 아니오.
- `<body>` 태그 없음, 인라인 스크립트 437B, 인쇄 CSS 없음, lang=ko.

## lua-pink-bicycle (`books/lua-pink-bicycle.html`)
- 크기: 전체 478KB, 이미지 제외 8.2KB. 이미지 14개(Base64 14, 외부 파일 0).
- 장면 컨테이너: <main>, 장면 후보 13개, 형태 <section.cover>, <section>.
- 장면 id: 없음(안정적 id 부재, 어댑터가 순번 선택자 필요).
- 제목 요소: h1, h2. 장면당 `p` 수: 1~9. `.story p`가 있는 장면: 0/13.
- 장면 밖 블록: 없음.
- 상단: header 없음(버튼: 없음), 전체 버튼: 이전, 다음, 책장 보기. 읽기 방식 전환 없음. header 고정(sticky) 아니오.
- `<body>` 태그 있음, 인라인 스크립트 1572B, 인쇄 CSS 있음, lang=ko.

