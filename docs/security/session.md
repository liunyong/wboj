# Sliding Session Timeout

The platform now enforces a **sliding inactivity window** for every signed-in user. Each authenticated request refreshes the inactivity deadline for the active session, keeping people online while they remain active and gracefully expiring idle sessions.

## Key Behaviour

- **Default window:** 2 hours of inactivity per session.
- **Warning modal:** 15 minutes before expiry the UI presents a blocking countdown with “Extend” and “Log out” actions. Other UI content is inert until the user responds.
- **Extend:** Any activity (including choosing “Extend”) refreshes the deadline. The extend API call is rate-limited client-side (default 60 s) to avoid redundant writes.
- **Expiry:** When the window lapses without activity the session is invalidated, all API calls return `401`, and the UI redirects to `/login?expired=1`.
- **Multi-tab sync:** Tabs broadcast extensions, activity, and expiry notices through `BroadcastChannel` (or `localStorage` fallback) so that warnings collapse and logouts propagate everywhere.
- **Accessibility:** The warning modal traps focus, disables `Esc`, and keeps background content inert to ensure assistive technology only lands on the decision controls.

## Endpoints

| Method | Route                 | Description | Response |
| ------ | -------------------- | ----------- | -------- |
| GET    | `/api/session/state`  | Returns the server’s current timestamp and the inactivity deadline for the caller’s session. | `{ serverNow: number, inactivityExpiresAt: number }` |
| POST   | `/api/session/extend` | Forces an immediate touch of the session deadline (ignores rate limiting). | `{ inactivityExpiresAt: number }` |

All responses use Unix epoch milliseconds. Requests require a valid access token; expired or missing sessions respond with `401 SESSION_EXPIRED`.

## Configuration

Environment variables (all values accept raw milliseconds or shorthand such as `30m`):

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `INACTIVITY_TTL_MS` | `7200000` (2h) | Maximum idle time before a session expires. |
| `WARNING_LEAD_MS` | `900000` (15m) | Lead time for the warning modal to appear client-side. |
| `MIN_TOUCH_INTERVAL_MS` | `60000` (60s) | Minimum interval between persisted touches per session. The client respects the same interval when auto-extending. |

Any change to these values requires a process restart to take effect.

## Migration Notes

- Existing refresh sessions gain inactivity metadata the first time they are touched after deployment. Users actively working remain signed in; dormant sessions older than the window naturally expire.
- Ensure all environments include the new variables (or rely on defaults). Production deployments should confirm that `WARNING_LEAD_MS` aligns with UX expectations.
- The frontend warning modal depends on the `/api/session/*` endpoints. API gateways or proxies must surface these routes without additional auth rules.

## Client Flow Summary

1. On mount the keep-alive hook fetches `/api/session/state`, aligns for clock skew, and starts a 1 s ticker.
2. User activity (click, keydown, pointer, scroll, visibility) broadcasts `USER_ACTIVITY` and, no more than once every `MIN_TOUCH_INTERVAL_MS`, calls `/api/session/extend`.
3. When the ticker detects `remaining <= WARNING_LEAD_MS`, the modal opens with a live countdown (`mm:ss`).
4. “Extend” calls `/api/session/extend` immediately, broadcasting the new deadline to all tabs.
5. “Log out” invokes `/api/auth/logout`, broadcasts `SESSION_EXPIRED`, and redirects to `/login?expired=1`.
6. Any 401 during extend/state fetch triggers the same expiry flow, ensuring the UI never remains in a half-authenticated state.
