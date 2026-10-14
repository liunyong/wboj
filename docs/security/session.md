# 인증과 유휴 세션

구현 기준: `backend/src/services/authService.js`, `backend/src/middlewares/auth.js`, `backend/src/controllers/sessionController.js`, `frontend/src/context/AuthContext.jsx`, `frontend/src/hooks/useSessionKeepAlive.js`, `frontend/src/components/SessionExpiryModal.jsx`.

## 토큰과 세션

- access JWT의 사용자 ID와 session ID를 Mongo `User.sessions`에 대조한다. 비활성/삭제 계정, 만료/폐기 세션은 사용할 수 없다.
- refresh token은 HttpOnly cookie로 전달하고 서버에는 hash를 저장한다. cookie는 `SameSite=Strict`, path `/api/auth`, 운영에서 `Secure`다. refresh 시 세션을 회전한다.
- 프런트는 access token을 `oj.tokens` 키로 localStorage(실패 시 sessionStorage)에 보관한다. `authFetch`가 401이면 refresh 후 한 번 재요청한다. 갱신 실패 시 토큰과 개인 query cache를 정리한다.
- 유휴 만료와 JWT/refresh 만료는 별개다. extend는 유휴 기한만 바꾸며, refresh는 기존 세션을 소비한 뒤 새 세션/토큰과 새 만료 기한을 발급한다. 로그인 시점부터 고정된 최대 세션 수명 정책은 별도로 구현되어 있지 않다.

## 기본 정책

| 환경변수 | 코드/예제 기본값 | 의미 |
| --- | --- | --- |
| `ACCESS_TOKEN_TTL` | `15m` | access token 수명 |
| `REFRESH_TOKEN_TTL` | `7d` | refresh token 수명 |
| `MAX_SESSIONS_PER_USER` | `5` | 사용자별 보관 세션 수 |
| `INACTIVITY_TTL_MS` | `1800000` (30분) | 유휴 만료 시간 |
| `WARNING_LEAD_MS` | `300000` (5분) | 만료 전 경고 시간 |
| `MIN_TOUCH_INTERVAL_MS` | `60000` (1분) | 자동 연장 최소 간격 |

유휴 시간 관련 값은 밀리초 또는 `30m`, `5m`, `60s` 같은 표기를 지원한다. 변경 후 backend 재시작이 필요하다. **이 값은 코드 기본값이며 현재 운영값을 의미하지 않는다.** 프런트는 공개 policy API에서 정책을 가져온다. 이전 문서의 2시간/15분 설명은 현재 기본값과 다르다.

## 연장과 경고 흐름

1. 로그인 상태에서 hook이 `/api/session/state`를 조회하고 serverNow로 시계 차이를 보정한다. 1초 ticker로 남은 시간을 계산한다.
2. click, keydown, mousemove, scroll, touchstart, 탭 복귀 같은 사용자 활동이 자동 extend를 요청한다. 최소 간격과 진행 중 요청 공유로 중복을 줄인다.
3. `requireAuth`와 `authenticateOptional`은 **검증만** 한다. 일반 조회, 상태 조회, background polling이 스스로 유휴 시간을 갱신하지 않는다. `requireAuthAndTouch`는 별도 helper다.
4. 경고가 열리면 일반 활동에 따른 자동 연장을 중단한다. 배경은 inert 처리하고 모달은 focus를 가두며 Esc 닫기를 막는다. **Extend**를 선택하면 throttle을 우회해 연장한다.
5. 실제 연장 성공 시 `SESSION_EXTENDED`를 BroadcastChannel로 전파하고, 미지원 환경에서는 localStorage 이벤트를 사용한다. 만료/로그아웃도 다른 탭에 전파한다. 단순 활동 메시지로 다른 탭의 연장을 막지 않는다.
6. 기한 만료 또는 인증 복구 실패 시 로그아웃 상태로 바꾸고 `/login?expired=1`로 이동한다. 모달의 Log out도 같은 만료 흐름을 사용한다.

## API

| 메서드 / 경로 | 접근 | 응답·효과 |
| --- | --- | --- |
| GET `/api/session/policy` | 공개 | accessTokenTtl, refreshTokenTtl, inactivityTtlMs, warningLeadMs, minTouchIntervalMs |
| GET `/api/session/state` | 로그인 | `{ serverNow, inactivityExpiresAt }` |
| POST `/api/session/extend` | 로그인 | 강제 touch 후 `{ inactivityExpiresAt }` |
| GET `/api/session/sessions` | 로그인 | 현재 사용자의 세션 목록, 현재 세션 표시 |
| DELETE `/api/session/sessions/:id` | 로그인 | 지정 세션 폐기 |
| DELETE `/api/session/sessions` | 로그인 | body `{ scope: "others" }`는 다른 세션만 폐기, 기본은 전체 폐기 |

시각은 Unix epoch 밀리초다. 만료된 세션 API는 `401 SESSION_EXPIRED`를 반환한다. Bearer가 아예 없으면 `401 UNAUTHENTICATED`이며 다른 API에서도 인증 오류 코드가 다를 수 있다.

## 검증

`npm test --prefix backend -- tests/session.routes.test.js tests/session.service.test.js tests/auth.routes.test.js`와 `npm test --prefix frontend -- src/hooks/useSessionKeepAlive.test.jsx src/components/SessionExpiryModal.test.jsx`를 실행한다. 수동으로 두 탭의 연장·로그아웃 동기화, 모달 키보드 접근, background polling 중 유휴 만료를 확인한다. 현재 실행 상태는 [handoff](../handoff.md)에 기록한다.
