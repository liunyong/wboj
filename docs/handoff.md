# WBOJ 인수인계

## 관리자 일반 사용자 시점 전환 (2026-10-14)

- 왼쪽 Administration 아래 `Admin view` / `User view` 스위치를 추가했다. 일반 사용자 시점에서도 복귀 스위치는 유지하며 관리자 메뉴·버튼·경로는 일반 사용자 역할을 따른다. 같은 계정의 소유자 권한은 유지한다. 새로고침·로그아웃 시 해제된다.
- AuthContext는 실제 사용자와 화면용 사용자를 구분하고, 전환 시 기존 조회를 취소하고 캐시를 지운 뒤 화면을 다시 마운트한다. 서버 인증 미들웨어는 `X-WBOJ-View-As: user` 요청의 관리자 역할만 낮춘다. DB 역할·세션은 변경하지 않으며 일반 사용자의 권한 상승은 허용하지 않는다.
- 검증: backend 전체 17개 파일·92/92, frontend 전체 17개 파일·72/72 통과. backend 변경 파일 두 개 구문 검사, frontend build, Compose 설정 검사, `git diff --check` 통과. 전체 backend 검사의 최초 샌드박스 실행은 MongoDB 포트 바인딩 EPERM으로 중단했고 제한 밖 재실행에서 통과했다.
- backend/frontend만 재빌드·배포했고 backend healthy, frontend Up, 공개 health/database up을 확인했다. 배포된 frontend와 모의 API를 사용하는 Chromium 검사에서 데스크톱·모바일 전환/복귀, 관리자 메뉴와 비공개 문제 숨김, 일반 사용자 목록 열 구성, 캐시 재조회, 요청 헤더를 확인했다. 실제 운영 계정 로그인·DB 변경은 하지 않았다. 서버 권한 제한은 테스트 전용 MongoDB를 사용하는 API 테스트로 검증했다.

## Problems 목록 태그 표시 (2026-10-14)

- 문제 목록의 제목 아래 표시값을 `algorithms`에서 `tags`로 바꿨다. 태그가 없으면 줄을 숨긴다. 관련 CSS 이름도 태그에 맞췄다.
- 검증: 목록 UI 테스트 9/9, frontend build, Compose 설정 검사, `git diff --check` 통과. frontend만 재빌드·배포했고 컨테이너 Up, 공개 목록 JS 번들의 태그 표시 코드, 공개 health/database up을 확인했다. 실제 브라우저 시각 검사는 실행하지 않았다. backend는 변경하지 않아 이번 작업에서 backend 테스트는 재실행하지 않았다.

## 문제 상세 태그 표시 (2026-10-14)

- 문제 상세 상단 Author·Source 아래에 저장된 태그를 `Tags` 줄로 표시한다. 태그가 없으면 숨기고, 긴 태그는 줄바꿈한다. 기존 API의 `tags`를 사용한다.
- 검증: 문제 상세 UI 테스트 5/5, frontend build, Compose 설정 검사, `git diff --check` 통과. frontend만 재빌드·배포했으며 컨테이너 Up, 공개 상세 페이지 JS 번들의 태그 표시 코드 및 공개 health/database up을 확인했다. 실제 브라우저 시각 검사는 실행하지 않았다. backend 변경은 없어 이번 작업에서 backend 테스트를 재실행하지 않았다.

## Display Name 저장 오류 수정 (2026-10-14)

- 원인: Settings는 `avatarUrl: ''`을 포함해 프로필을 저장하지만 서버 URL 검증이 빈 문자열을 거부해 Display Name 저장도 실패했다.
- 수정: 프로필 API의 Avatar URL에 빈 문자열(아바타 제거)을 허용한다. 유효하지 않은 비어 있지 않은 URL은 계속 거부한다. 설정 폼 저장·DB 반영, 아바타 설정/제거, 잘못된 URL의 변경 방지, 미인증 요청 거부 회귀 테스트를 추가했다.
- 검증: 관련 테스트 5/5, backend 전체 17개 파일·89/89 통과. 변경 JS 두 파일의 `node --check`, `git diff --check`, `docker compose config --quiet` 통과. 아래 이전 기록의 로그인 제한 timeout은 이번 전체 실행에서 재현되지 않았다.
- 배포: backend만 기존 Compose로 재빌드·배포했다. 컨테이너 healthy, 공개 `/api/health`에서 database up 확인. 배포된 컨테이너의 스키마에서도 빈 Avatar URL이 포함된 설정 요청의 검증 통과를 확인했다. 실제 사용자 계정으로 브라우저 저장은 실행하지 않았다. frontend 변경은 없어 UI 테스트/빌드는 실행하지 않았다.

확인일: 2026-10-14. 이번 저장소 코드·설정·문서 확인에서 드러난 사항만 기록한다. 이전 대화의 약속, 외부 issue, 운영자의 미완료 작업은 확인하지 않았으며 추정하지 않는다. 아래 항목은 아직 수정하지 않았다.

## 이번 작업

- 루트 AGENTS를 작업 진입점과 조건별 문서 안내로 정리했다.
- architecture/database/deployment를 분리하고 README·기존 구조 문서·서비스 README·검증/세션/문제 작성/레이팅 문서를 코드에 맞췄다.
- 애플리케이션 코드·환경 설정은 변경하지 않았다. 문서만 변경했으므로 운영 서비스 재배포는 하지 않았다. seed·migration·수동 backfill도 실행하지 않았다.

## 확인된 미완료 사항과 다음 단계

### 1. 기본 검사의 timeout (backend 미해결, frontend 재검사 통과)

- backend 전체: 17개 파일 중 16개 통과, 85개 테스트 중 84개 통과. `backend/tests/auth.routes.test.js`의 `rate limits repeated failed logins per user identifier in production mode`가 20초 timeout으로 실패했다. 동일 파일 단독 실행에서도 13/14 통과, 같은 timeout이 재현됐다.
- 실패 후 다음 인증 테스트 실행 중 `No document found ... on model User` 로그도 관찰됐다. timeout 뒤 남은 비동기 요청과 관계가 있는지는 확인하지 않았다.
- frontend 전체 첫 실행: 16개 파일 중 15개 통과, 69개 테스트 중 67개 통과. `frontend/src/pages/ProblemsPage.test.jsx`의 header 정렬 및 전체 archive 정렬 테스트 두 개가 기본 5초 timeout이었다. 해당 파일 단독 재실행은 9/9, 이후 전체 재실행은 16개 파일·69/69 모두 통과했다. 첫 실행은 backend 테스트·build와 병행했고 재검사는 단독 실행했다. 자원 경합이 원인인지는 확정하지 않았다.
- 다음 단계: 기본 timeout에서 backend 실패를 재현하고 bcrypt 반복 요청·테스트 환경·정리 시점과 자원 사용을 조사한다. frontend timeout이 반복되면 최초 병행 실행과 단독 통과 기록을 비교한다. timeout을 늘리거나 원인을 단정해 문제를 숨기지 않는다.

### 2. seed 관리자 계정의 이메일 인증

- 근거: `backend/scripts/seed.js`는 새 admin에 `emailVerified`를 지정하지 않는다. `backend/src/models/User.js` 기본값은 false이고 `backend/src/controllers/authController.js#login`은 미인증 로그인을 `EMAIL_NOT_VERIFIED`로 거부한다.
- 현재 영향: seed만으로 즉시 로그인 가능한 관리자 계정이 만들어진다고 보장할 수 없다. 브라우저에서 실제 seed 로그인은 실행하지 않았다.
- 다음 단계: 개발 관리자 부트스트랩의 인증 정책을 정하고 seed/안내를 함께 수정한 뒤 새 DB에서 로그인까지 검증한다. 운영 DB에서 seed를 실행하지 않는다. 기존 문제·counter 삭제 및 관련 데이터 잔존 위험은 [DB 문서](database.md) 참고.

### 3. 스크립트별 Mongo 기본 DB 불일치

- 근거: `backend/src/config/env.js`와 seed는 `judge0`, `backend/scripts/migrate-submissions.js`는 `wboj`, `backend/scripts/migrations/2025-10-roles-backfill.js`는 `online-judge`가 fallback이다.
- 현재 대응: 모든 데이터 작업은 명시적인 `MONGO_URI`와 대상 확인을 요구하도록 문서화했다.
- 다음 단계: 기존 운영 사용 방식을 확인하고 공통 설정을 쓰거나 URI 누락 시 실패하도록 코드 정책을 통일한다. roles script는 모든 admin을 승격하므로 별도 목적 확인이 필요하다.

### 4. 제출 상세의 testcase 결과 공개 범위

- 근거: `backend/src/controllers/submissionController.js#buildSubmissionDetail`은 `testCaseResults`(입력·정답 등)와 `runs`를 포함한다. `getSubmission`은 비소유자/비관리자에게 `source`만 제거한다. route는 optional auth다.
- 확인 범위: 코드 경로로 확인했으며 운영 데이터에 접근해 노출 여부를 검사하지 않았다. 기존 소스 비공개 테스트가 testcase 결과 비공개까지 보장하지는 않는다.
- 다음 단계: 공개 요약과 비공개 testcase의 정책을 정하고, guest/다른 사용자/소유자/admin 응답을 검증하는 테스트와 serializer 수정으로 적용한다. [architecture](architecture.md)에서는 현재 동작을 그대로 설명한다.

### 5. backend 다중 인스턴스 운영 전 준비

- 근거: `backend/src/services/submissionStreamService.js`의 이벤트 bus/최근 500개 event, `backend/src/services/judge0Service.js`의 동시성 queue는 프로세스 로컬이다. Mongo 작업 선점은 공유되지만 SSE 이벤트와 Judge0 동시성 총량은 공유되지 않는다.
- 현재 대응: 단일 backend Compose 구조를 문서화했다. Redis rate limiter 설정만으로 이 한계가 해결되지 않는다.
- 다음 단계: 다중 backend가 필요할 때 pub/sub 또는 DB 기반 변경 조회와 전체 채점 동시성 정책을 설계하고, 다른 인스턴스에서 생성된 제출의 UI 반영을 검증한다. 현재 다중 운영 장애가 발생했다고 단정하지 않는다.

### 6. 운영 백업·외부 서비스 검증 기록

- 확인 범위: 저장소에는 예약 DB/이미지 백업·복구 자동화가 없다. 외부 스케줄러 유무와 마지막 복구 시험 여부는 알 수 없다. Judge0 stack, 실제 SMTP/Turnstile/AI 제공자 설정도 이번 작업에서 검사하지 않았다.
- 다음 단계: 데이터 변경 전 운영자의 백업/복구 절차와 보관 위치를 확인하고 [DB 문서](database.md)에 비밀값 없이 절차를 보완한다. 외부 연동 변경 시 테스트 계정으로 실제 흐름을 검증한다.

## 검증 기록

실행 환경: Node v22.20.0, npm 11.7.0, Docker Compose v2.39.4.

| 명령/확인 | 결과 |
| --- | --- |
| `npm test --prefix backend` | 84/85 통과, 인증 rate limit 테스트 timeout |
| `npm test --prefix backend -- tests/auth.routes.test.js` | 13/14 통과, 동일 timeout 재현 |
| `npm test --prefix frontend` (첫 실행) | 67/69 통과, 문제 목록 두 테스트 timeout |
| `npm test --prefix frontend -- src/pages/ProblemsPage.test.jsx` | 9/9 통과 |
| `npm test --prefix frontend` (단독 재실행) | 16개 파일, 69/69 통과 |
| `npm run build --prefix frontend` | 통과 |
| `docker compose config --quiet` / `--services` | 통과; 기본 서비스 mongo/backend/frontend/caddy 확인 |
| 문서 경로·링크·명령 대조 | 14개 Markdown, 상대 링크 67개, 기존 저장소 경로 109개, npm script/테스트 경로 38개 확인 |
| `git diff --check` | 통과 |

`.env`와 업로드 디렉터리는 생성 대상이므로 예제 파일과 생성 코드를 대조했다. 포트·proxy는 Compose/Caddy/Nginx/Vite 설정을 확인했고 preview의 proxy 상속은 설치된 Vite 구현도 확인했다. 실행하지 않은 항목: 의존성 재설치, 개발 서버 새 기동, Docker 이미지 재빌드/재배포, DB 변경 script, 운영 데이터/실채점/메일/Turnstile/AI의 종단 간 확인.

후속 작업을 완료하면 항목과 관련 문서·검증 기록을 같은 변경에서 갱신한다. 확인되지 않은 내용은 사실로 승격하지 않는다.
