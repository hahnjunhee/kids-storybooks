# Kids Storybooks 업로드 및 운영 가이드

## 운영 원칙
- 공개 그림책을 GitHub에서 버전 관리하고 GitHub Pages로 배포합니다.
- 저장소 이름은 `kids-storybooks`이며 도서관 이름에 특정 아동 이름을 사용하지 않습니다.
- 기존 원고와 삽화는 별도 요청 없이 수정하지 않습니다.

## 폴더 구조
```text
index.html
books/lulu-friends.html
books/jia-sea-otter.html
assets/cover-lulu.webp
assets/cover-sea-otter.webp
assets/lulu-friends/01.webp ... 12.webp
docs/BOOK_LIBRARY_OPERATIONS.md
```

## 새 그림책 등록
1. 제목·주제·장면 수·파일명을 확인합니다.
2. HTML을 `books/`에 추가합니다.
3. 삽화를 `assets/<book-slug>/`에 보관하고 가능하면 WebP로 최적화합니다.
4. `index.html`에 책 표지·소개·주제·링크를 추가합니다.
5. 모바일·PC에서 모든 장면, 링크, 글자 크기 조절, 인쇄 기능을 확인합니다.
6. GitHub에 커밋한 후 공개 주소에서 실제 화면을 점검합니다.

## 수정·이력
- 책 제목, 변경 장면, 원고/이미지 수정 여부를 커밋 메시지에 기록합니다.
- 큰 변경은 별도 브랜치와 Pull Request를 권장합니다.
- 원본 HTML은 보존하고, 이미지 분리 시 누락이 없는지 확인합니다.

## GitHub Pages 배포
Settings → Pages → Deploy from a branch → `main` / `/(root)`.
예상 주소: https://hahnjunhee.github.io/kids-storybooks/

## 현재 수록 예정
| 제목 | 파일 | 장면 |
|---|---|---:|
| 루루야, 나도 같이 놀아도 돼? | `books/lulu-friends.html` | 12 |
| 지아와 해달의 신비로운 바다숲 | `books/jia-sea-otter.html` | 10 |

## 공개·성능 점검
- 공개 웹사이트에 아동의 실사진, 주소, 학교 등 식별정보가 들어가지 않도록 확인합니다.
- 이미지 최적화와 캐싱으로 트래픽을 절감합니다.
- GitHub Pages는 무제한 호스팅이 아니므로 사용량과 배포 상태를 점검합니다.

**상태:** 이 문서는 운영 기준이며, 그림책 HTML과 이미지의 실제 업로드·Pages 활성화 여부를 별도로 검증해야 합니다.
