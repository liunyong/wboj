## Automated Tests

- `npm test --prefix backend`

## Manual Verification

1. Start the backend in production mode so rate limiters are active:

   ```bash
   NODE_ENV=production npm start --prefix backend
   ```

2. Register a new user (expect `201`):

   ```bash
   curl -i -X POST http://localhost:4000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"username":"demoUser","email":"demo@example.com","password":"Secret123!","confirmPassword":"Secret123!"}'
   ```

3. Attempt to register the same email again (expect `409` with `{ "code": "DUPLICATE", "field": "email" }`):

   ```bash
   curl -i -X POST http://localhost:4000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"username":"otherUser","email":"demo@example.com","password":"Secret123!","confirmPassword":"Secret123!"}'
   ```

4. Exercise the login rate limiter (21st failed attempt returns `429` with `{ "code": "RATE_LIMITED" }`):

   ```bash
   for i in $(seq 1 21); do
     curl -s -X POST http://localhost:4000/api/auth/login \
       -H "Content-Type: application/json" \
       -d '{"email":"demo@example.com","password":"WrongPass123!"}' | jq '.code? // empty'
   done
   ```

5. Confirm that a successful login is allowed after failures:

   ```bash
   curl -i -X POST http://localhost:4000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"demo@example.com","password":"Secret123!"}'
   ```

6. Request a password reset and complete it with the emailed token (inspect the database for the stored hash if you need to verify linkage):

   ```bash
   curl -i -X POST http://localhost:4000/api/auth/password/reset/request \
     -H "Content-Type: application/json" \
     -d '{"email":"demo@example.com"}'
   ```

   ```bash
   curl -i -X POST http://localhost:4000/api/auth/password/reset \
     -H "Content-Type: application/json" \
     -d '{"email":"demo@example.com","token":"<RAW_TOKEN>","password":"NewSecret123!","confirmPassword":"NewSecret123!"}'
   ```

7. (Optional) Enable Redis-backed rate limiting by installing `redis` and `rate-limit-redis`, then set:

   ```bash
   export RATE_LIMIT_USE_REDIS=true
   export REDIS_URL=redis://localhost:6379
   ```
