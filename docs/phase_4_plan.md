# Phase 4: Error Handling, Rate Limiting & Edge Cases Plan

## Objective
The goal of this phase is to make our API robust against abuse and common edge cases. Since the LinkedIn Voyager API is heavily monitored, we need to ensure our API doesn't get flooded with requests that could flag our underlying LinkedIn account.

## Tasks to be completed in this phase
1. **Implement API Rate Limiting:**
   - Install `express-rate-limit` to prevent abuse.
   - Configure a global rate limit (e.g., maximum 30 requests per 15 minutes per IP) to protect the backend.

2. **Enhanced Error Responses:**
   - Review the error handling built in Phase 3.
   - Ensure the API returns structured JSON error responses (with standard HTTP status codes) in all failure scenarios:
     - `400 Bad Request` for invalid URLs.
     - `401 Unauthorized` if the `LI_AT` cookie expires or is invalid.
     - `404 Not Found` if the profile username doesn't exist.
     - `429 Too Many Requests` when the rate limit is exceeded.

3. **Graceful Handling of Missing Data:**
   - Ensure the mapper (`src/mapper.ts`) does not throw exceptions if LinkedIn changes its JSON schema slightly, but instead safely returns `null` for missing fields.

## Next Steps (After this phase is merged)
Once this branch is merged, the backend API is fully complete and production-ready. We will proceed to **Phase 5**, which involves creating the deployment configuration (Dockerfile) and writing the final `README.md` documentation required by the hiring challenge.
