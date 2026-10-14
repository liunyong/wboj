# WBOJ (Wanbang Online Judge)

서비스: <https://wboj.app>

문제 작성, 코드 제출, Judge0 채점, 사용자 활동 통계, 레이팅·시즌 순위와 관리자 도구를 제공한다. Express API와 MongoDB, React SPA로 구성되며 Judge0는 별도로 준비한다.

## 문서

| 문서 | 내용 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 새 Codex 대화에서 읽을 작업 규칙·진입점·명령 |
| [구조와 흐름](docs/architecture.md) | 컴포넌트, API, 채점과 데이터 처리 |
| [인수인계](docs/handoff.md) | 확인된 미완료 사항, 후속 작업과 검증 상태 |
| [DB](docs/database.md) | 모델·식별자·인덱스·삭제·마이그레이션 |
| [배포](docs/deployment.md) | 환경변수·Compose·프록시·확인 절차 |
| [세션](docs/security/session.md) | 토큰·유휴 만료·다중 탭·세션 관리 |
| [레이팅](docs/ratings.md) | 점수·최초 AC·시즌·AI 난이도 |
| [문제 작성](docs/authoring-math.md) | Markdown·수식·이미지 |
| [검증](TEST_PLAN.md) | 자동 테스트와 수동 확인 범위 |

기존 [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md), [backend/README.md](backend/README.md), [frontend/README.md](frontend/README.md)는 상세 문서로 연결하는 짧은 안내로 유지한다. [CHANGELOG.md](CHANGELOG.md)는 변경 기록이다.

## 로컬 개발

Node.js 22(현재 의존성에 맞춰 22.12 이상 권장), npm, MongoDB 6, 별도 Judge0 API/worker가 필요하다. 명령은 모두 저장소 루트에서 실행한다. 루트에는 npm 실행 스크립트가 없고 각 서비스의 package.json을 사용한다.

```bash
npm ci --prefix backend
npm ci --prefix frontend
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

기존 `.env`가 있으면 덮어쓰지 말고 필요한 키만 추가한다. 예제의 `mongo`, `server`는 컨테이너 주소다. 호스트에서 API를 실행할 때 `backend/.env`를 다음에 맞춘다.

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/judge0
JUDGE0_URL=http://127.0.0.1:2358
APP_BASE_URL=http://localhost:5173
FRONTEND_ORIGIN=http://localhost:5173
FRONTEND_ORIGINS=http://localhost:5173
```

ACCESS/REFRESH 토큰 비밀값을 각각 설정한다. 실제 SMTP 또는 개발용 메일 수신 환경이 있어야 가입 이메일 인증·비밀번호 재설정을 끝까지 확인할 수 있다. Turnstile 예제 키는 실제 키가 아니다. 개발 모드 서버는 비밀 키가 비어 있으면 검증을 생략하지만, 가입 UI는 Turnstile 토큰을 요구한다. 브라우저 가입 흐름에는 개발용 또는 실제 Turnstile 키 쌍이 필요하다. 운영에서는 실제 키와 호스트 설정을 사용한다.

MongoDB와 Judge0를 먼저 실행한 뒤 각각 별도 터미널에서 실행한다.

```bash
npm run dev --prefix backend
npm run dev --prefix frontend
```

API는 기본 `http://localhost:4000`, Vite는 `http://localhost:5173`이다. `frontend/.env`의 `VITE_API_URL=http://localhost:4000`은 브라우저의 API 대상이자 개발 프록시 대상이다. 빈 값이면 브라우저는 동일 출처 `/api`를 사용하며 Vite가 기본 백엔드로 프록시한다. 포트가 점유되면 Vite가 다른 포트를 선택할 수 있으므로 시작 로그와 CORS 허용 출처를 확인한다.

`npm start --prefix backend`는 watcher 없이 API를 실행한다. `npm run preview --prefix frontend`는 빌드된 SPA를 기본 4173 포트로 제공한다. 현재 설치된 Vite 8의 preview는 `server.proxy`를 상속하므로 동일 출처 `/api` 요청도 backend로 전달한다. 번들에 API URL이 지정되어 있으면 그 주소를 직접 사용한다. backend 허용 출처에는 preview 주소도 추가한다.

## 검증

```bash
npm test --prefix backend
npm test --prefix frontend
npm run build --prefix frontend
docker compose config --quiet
git diff --check
```

테스트 구성과 수동 확인은 [TEST_PLAN.md](TEST_PLAN.md), 실제 실행 결과는 [docs/handoff.md](docs/handoff.md)에 기록한다. Docker 운영은 [docs/deployment.md](docs/deployment.md)를 따른다.

`npm run seed --prefix backend`는 **기존 모든 문제와 문제 번호 counter를 삭제**한다. 새 개발 DB에서만 의도적으로 사용한다. 생성되는 admin의 이메일 인증 누락 등 현재 한계는 [인수인계](docs/handoff.md)에 기록되어 있다.
