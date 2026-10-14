# 실행 환경과 배포

## 설정의 위치와 우선순위

| 위치 | 용도 |
| --- | --- |
| 루트 `.env.example` → `.env` | Compose 치환값. 예제에는 `VITE_TURNSTILE_SITE_KEY`만 있음; 필요한 `JUDGE0_URL` 등은 추가 |
| `backend/.env.example` → `.env` | backend 실행 환경; Compose `env_file`로 주입 |
| `frontend/.env.example` → `.env` | Vite 개발/빌드 설정; `VITE_*`는 브라우저 번들에 공개됨 |
| `backend/src/config/env.js` | 주요 backend 기본값; 일부 기능은 각 서비스에서 직접 env 읽음 |

기존 `.env`는 보존한다. 비밀값을 문서·로그·프런트 변수에 넣지 않는다. `docker compose config` 전체 출력에는 env_file 비밀값이 포함될 수 있으므로 검증에는 `--quiet`/`--services`를 쓴다.

Compose `environment`의 `PORT=4000`, `MONGO_URI=mongodb://mongo:27017/judge0`, `TRUST_PROXY=1`은 backend env_file 값을 덮어쓴다. Judge0도 Compose 치환값 `JUDGE0_URL`(shell 또는 루트 `.env`)이 우선하며 미지정 시 `http://server:2358`이다. **backend/.env만 바꿔서는 Compose의 Judge0 주소가 바뀌지 않는다.**

## 주요 환경변수

기본값은 실제 코드 기준이다. 전체 키 목록은 각 `.env.example`와 해당 서비스 코드를 확인한다.

| 기능 | 키와 기본값 / 조건 |
| --- | --- |
| 인증 | `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`: 운영 필수; 누락·예제/개발 prefix이면 시작 실패. TTL은 `15m`, `7d`; `MAX_SESSIONS_PER_USER=5` |
| 쿠키 | `REFRESH_COOKIE_NAME=oj_refresh`; 운영 `AUTH_EXPOSE_REFRESH_TOKEN=false`, 개발 true 기본. 프런트는 refresh cookie 사용 |
| 유휴 만료 | `INACTIVITY_TTL_MS=1800000`, `WARNING_LEAD_MS=300000`, `MIN_TOUCH_INTERVAL_MS=60000`; [세션](security/session.md) |
| CORS/URL | `FRONTEND_ORIGINS` comma allowlist가 `FRONTEND_ORIGIN`보다 우선. 코드 fallback은 `http://localhost:5173`; 운영은 `https://wboj.app`. `APP_BASE_URL`은 이메일 링크 주소 |
| 프록시 | `TRUST_PROXY`는 직접 실행 개발 false, 운영 기본 1. Compose는 1로 고정; 프록시 경로 변경 시 재검토 |
| Judge0 | `JUDGE0_URL`; `JUDGE0_MAX_CONCURRENCY=2`, `JUDGE0_MAX_RETRIES=2`, `JUDGE0_TIMEOUT_MS=20000` |
| 워커 | `SUBMISSION_WORKER_POLL_MS=1000`, `SUBMISSION_STALE_MS=300000`, `SUBMISSION_MAX_RUN_HISTORY=20` |
| Turnstile | backend `TURNSTILE_SECRET_KEY`, 선택 hostname 검증 `TURNSTILE_EXPECTED_HOSTNAME`, `LOGIN_CAPTCHA_THRESHOLD=3`; frontend 공개 `VITE_TURNSTILE_SITE_KEY` |
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`; 인증/비밀번호 재설정의 만료·재발송 간격은 backend 예제 확인 |
| Redis | `RATE_LIMIT_USE_REDIS=true`, `REDIS_URL`; npm 의존성은 이미 설치 목록에 있음. Redis 서비스는 Compose에 없음 |
| AI | `DIFFICULTY_AI_*`: 서버 전용, 모델/키 명시 설정 시 사용. [레이팅 설정](ratings.md) |
| 이미지 | 선택 `PUBLIC_UPLOAD_BASE_URL`은 upload controller가 읽음(현재 env 예제에는 없음). 공개 접근은 `/api/uploads/problems/...` 권장 |
| SEO | `VITE_SITE_URL`, `SEO_ALLOW_INDEXING`, `SEO_PRERENDER_AGENTS`, `API_CACHE_SECONDS`; frontend public sitemap/robots와 API sitemap 별도 관리 |

Compose의 frontend build arg는 현재 `VITE_TURNSTILE_SITE_KEY`만 제공한다. 각 서비스의 `.dockerignore`가 `.env`를 제외하므로 로컬 frontend/.env는 Docker build에 반영되지 않는다. 다른 `VITE_*`용 Compose build arg는 현재 제공되지 않는다. 기본 번들은 동일 출처 API와 SEO의 코드 fallback을 사용한다. 운영에서는 API URL을 비워 동일 출처 `/api`로 사용하는 구성이 맞다. 런타임 환경변수 변경만으로 이미 빌드한 SPA는 바뀌지 않는다.

## Compose 구성

- 외부 `ojnet` 네트워크가 미리 존재해야 한다. backend와 Judge0 API가 같은 네트워크에서 `server:2358`로 통신하거나, 접근 가능한 별도 `JUDGE0_URL`을 설정해야 한다. 외부 Judge0 stack의 파일/worker 설정은 이 저장소에서 확인할 수 없다.
- 공개 포트는 Caddy의 80/443이다. backend 4000, Mongo 27017은 **127.0.0.1에만** 바인딩한다. frontend에는 호스트 3000 포트 매핑이 없다.
- `mongo-express`는 `tools` profile, 호스트 `127.0.0.1:8081`. 필요할 때 `docker compose --profile tools up -d mongo-express`를 사용하며 루트 환경의 `MONGO_EXPRESS_USERNAME`, `MONGO_EXPRESS_PASSWORD`를 설정한다.
- 영속 볼륨은 `mongo-data`, `uploads-imgs`, `caddy_data`, `caddy_config`. Caddy TLS 발급에는 도메인 DNS와 포트 접근이 필요하다.
- Caddy는 `www.wboj.app`, `oj.wanbang.org`를 `https://wboj.app`으로 redirect한다. `/api/*`만 backend로 가며 `/uploads/*`는 현재 frontend로 전달된다. 이미지 URL은 `/api/uploads/*` 경로를 사용한다.

## 배포 절차 (저장소 루트)

애플리케이션/설정 변경은 관련 검사 후 영향받는 서비스만 배포한다. 문서만 바꿀 때는 서비스 재시작이 필요 없다. 자동 CI는 검사와 Docker build만 수행하며 운영 배포 단계는 없다.

1. `git status --short`, 관련 테스트, frontend 변경 시 빌드를 확인한다. DB 작업이 있으면 [DB 문서](database.md)를 먼저 읽는다.
2. `.env`와 Judge0 연결, 외부 네트워크를 확인한다.

   ```bash
   docker compose config --quiet
   docker compose config --services
   docker network inspect ojnet
   ```

3. 아래에서 실제 영향받는 명령만 선택한다. backend가 이미 정상인 환경에서만 `--no-deps`를 사용한다.

   ```bash
   docker compose up -d --build --no-deps backend
   docker compose up -d --build --no-deps frontend
   ```

   최초 구성은 필수 외부 의존성과 env를 준비한 후 `docker compose up -d --build`로 시작한다. Caddyfile만 수정했으면 먼저 검증하고 reload한다.

   ```bash
   docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
   docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
   ```

4. 컨테이너 상태·최근 로그·DB readiness·공개 응답을 확인한다.

   ```bash
   docker compose ps
   docker compose logs --tail=100 backend frontend caddy
   curl -fsS --max-time 10 http://127.0.0.1:4000/api/health
   curl -fsS --max-time 10 https://wboj.app/api/health
   curl -fsS --max-time 20 https://wboj.app/ -o /tmp/wboj-deploy.html
   curl -fsS --max-time 10 https://wboj.app/api/session/policy
   ```

   frontend는 새 asset이 실제 제공되는지 브라우저에서 확인한다. 채점 변경은 별도 테스트 계정으로 제출과 완료 verdict까지 확인한다. `/api/live`와 `/api/health`만으로 Judge0 실행을 검증할 수 없다.

실패 시 적용 revision/이미지와 로그를 기록하고 이전 이미지/설정으로 영향 서비스만 복구한다. DB migration의 되돌리기는 이미지 rollback과 별도이며 복구 검증된 백업이 필요하다. 여러 backend로 확장하기 전에 프로세스 내 SSE/동시성 한계를 [handoff](handoff.md)에서 확인한다.
