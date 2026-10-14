# 문제 작성: Markdown·수식·이미지

`frontend/src/components/ProblemEditor.jsx`와 `frontend/src/components/ProblemStatement.jsx`가 편집 미리보기와 문제 화면의 렌더러를 공유한다. GitHub Flavored Markdown, remark-math, KaTeX를 사용한다. 입력/출력 예시는 코드 영역으로 표시되므로 수식 설명은 본문·입출력 형식·제약·예시 설명에 작성한다.

## 수식

인라인은 한 쌍의 `$`, 블록은 별도 줄의 `$$`로 감싼다. Markdown 원문에는 LaTeX의 백슬래시 하나를 입력한다(JSON/JS 문자열의 escape와 구별).

```markdown
두 수의 합은 $a + b$이다.

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$
```

제목, 표, 목록, 코드 블록, 인용문도 사용할 수 있다. 발행 전에 미리보기로 실제 표현을 확인한다.

## 이미지

- 편집기 Insert Image는 `POST /api/uploads/images`에 multipart `file`을 전송한다. 로그인 사용자 업로드, 이미지 목록·삭제는 admin 계열 권한이다.
- PNG, JPEG, WEBP, AVIF를 파일 signature와 sharp로 검증한다. 최대 업로드 5 MiB, 입력 최대 2천만 픽셀, 4096보다 큰 가로/세로는 비율을 유지해 축소한다. SVG/GIF 업로드는 허용하지 않는다.
- 서버는 UUID 파일명으로 `backend/uploads/problems/`(backend에서 실행 시)에 저장한다. 이 디렉터리는 첫 업로드 때 생성되며 새 checkout에 없을 수 있다. Compose에서는 `/app/uploads/problems`의 `uploads-imgs` 볼륨에 보존한다.
- 응답의 `apiPath`를 우선 사용해 `![](/api/uploads/problems/파일명)`을 삽입한다. alt text를 직접 보완할 수 있다.
- Express는 `/uploads`와 `/api/uploads`를 모두 제공한다. 현재 Caddy는 `/api/*`만 backend로 전달하므로 배포된 사이트에서 `/uploads/...`를 직접 쓰면 이미지 대신 SPA 응답을 받을 수 있다. `/api/uploads/...`를 사용한다.
- `frontend/src/pages/AdminUploadsPage.jsx`에서 파일을 관리한다. 파일 삭제 시 본문 참조를 자동 수정하지 않으므로 사용 중인지 확인한다.

## 콘텐츠 처리

서버의 `backend/src/utils/sanitizeHtml.js`와 클라이언트의 `frontend/src/utils/markdown.js`가 허용하지 않는 HTML 속성·URL을 제거한다. 링크/이미지 URL은 HTTP(S), `/uploads/`, `/api/uploads/` 범위로 제한한다. 이 URL 정책은 외부 HTTP(S) 파일의 확장자를 전부 검증하는 업로드 정책과는 다르다. inline style, script, event handler에 의존하지 않는다.

문제당 testcase는 1~500개이며, 관리자의 ZIP 입력 처리는 `backend/src/services/testCaseZipService.js`에 있다. testcase는 Markdown 원문과 다른 실행 데이터다. 공개 API에 비공개 testcase를 포함시키지 않도록 controller의 권한 분기를 유지한다.

## 관련 검증

- `npm test --prefix frontend -- src/components/ProblemStatement.test.jsx src/pages/ProblemDetailPage.test.jsx`
- `npm test --prefix backend -- tests/problem.routes.test.js tests/uploads.routes.test.js`
- 수동: 편집 미리보기와 저장 후 본문, 이미지 공개 URL, 수식/표/코드 블록, testcase 비공개 범위.

모델·삭제 동작은 [DB](database.md), proxy/이미지 볼륨은 [배포](deployment.md), 숫자 난이도 확정은 [레이팅](ratings.md)을 확인한다.
