# 그림책 도서관 운영 가이드

## 운영 원칙
- 공개 저장소 `kids-storybooks`를 GitHub Pages로 배포한다.
- 책장·문서·본문·파일명·메타데이터에 실제 아동 이름을 사용하지 않는다.
- 기본 별칭은 **루아**, 에피소드별 변경 또는 이름 생략 가능하다.
- 기존 원고와 삽화는 필요한 식별정보 정리 외에는 임의로 변경하지 않는다.
- 제작 세부 기준은 [가이드라인 v3.1](STORYBOOK_GUIDELINES.md)을 따른다.

## 저장소 구조
```text
index.html
books/lulu-friends.html
books/sea-otter.html
books/yeongheung-seaside.html
books/craft-museum-gardener.html
books/korean-dinosaur-storybook.html
books/korean-electric-eel-storybook.html
assets/cover-*.webp, cover-yeongheung.svg
docs/STORYBOOK_GUIDELINES.md
docs/ILLUSTRATION_STYLE_GUIDE_V2.3.md
docs/BOOK_LIBRARY_OPERATIONS.md
```

## 새 그림책 등록
1. 원고·별칭·장면·파일명을 확정한다.
2. 기본 배포는 Base64 이미지 내장 **단일 HTML**이며 `books/`에 저장한다. 이미지 분리형은 작품별 선택사항이다.
3. 표지와 공통 자산은 `assets/`에 저장한다. 원본 고해상도·비공개 캐릭터 시트는 공개 저장소에 넣지 않는다.
4. `books.json`에 책 항목(제목·소개·시리즈·권수·표지·태그·링크)을 한 줄 추가한다. `index.html`은 수정하지 않는다. 표지는 `assets/cover-*.webp`(base64 인라인 금지).
5. 이름 노출·이미지 누락·모바일·PC·글자 크기·인쇄·링크를 검증한다.
6. 공개 GitHub Pages URL의 실제 작동 여부를 확인한다. 확인하지 못하면 미검증으로 보고한다.

## 현재 수록
| 제목 | 파일 |
| --- | --- |
| 루루야, 나도 같이 놀아도 돼? | `books/lulu-friends.html` |
| 루아와 해달의 신비로운 바다숲 | `books/sea-otter.html` |
| 반짝반짝 영흥도 바다 여행 | `books/yeongheung-seaside.html` |
| 꽃을 피우다, 정원사 | `books/craft-museum-gardener.html` |
| 루아와 공룡이 남긴 비밀 (v1.5) | `books/korean-dinosaur-storybook.html` |

| 찌릿찌릿! 전기뱀장어의 비밀 (v1.0.1) | `books/korean-electric-eel-storybook.html` |

공룡동화 `-v1.5.html`은 대표 파일과 내용이 동일한 보존본, `-v1.3.html`은 이전 버전이다. 책장 링크는 대표 파일만 사용한다.

## 변경 및 공개
- 큰 변경은 브랜치·PR을 권장한다. 사용자 승인 없는 공개 게시를 하지 않는다.
- 커밋에는 변경한 작품·장면·문서 범위를 적는다.
- 기존 URL을 이름 없는 경로로 바꾸면 과거 링크가 깨질 수 있다.
- 현재 파일 수정만으로 Git 과거 커밋·캐시의 이름 흔적은 지워지지 않는다.
- GitHub Pages: `main` / `/(root)`; 공개 주소 https://hahnjunhee.github.io/kids-storybooks/
