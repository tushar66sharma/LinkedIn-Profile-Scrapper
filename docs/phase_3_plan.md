# Phase 3: Core Implementation Plan

## Objective
The goal of this phase is to build the actual web scraping functionality that accepts a LinkedIn URL, communicates with LinkedIn's internal Voyager API using the configured session cookies, extracts the raw JSON, and maps it to a clean, standardized format.

## Tasks to be completed in this phase
1. **URL Normalizer Utility:**
   - Create `src/utils.ts`.
   - Implement an `extractUsername(url: string)` function to safely extract the profile identifier (e.g., `john-doe`) from various forms of LinkedIn profile URLs.

2. **The Scraper Service:**
   - Create `src/scraper.ts`.
   - Implement `fetchProfileData(username: string)`.
   - This function will use Node's native `fetch` (or a similar HTTP client) to hit the `/voyager/api/identity/profiles/{username}/profileView` endpoint.
   - It will read `LI_AT` and `JSESSIONID` from `process.env` and inject them as headers (along with the `csrf-token`).

3. **Data Mapper / Transformation:**
   - Create `src/mapper.ts`.
   - The raw JSON returned by Voyager is extremely nested and contains a lot of internal IDs and metadata that the API consumer doesn't care about.
   - Implement a mapping function to extract and format:
     - Basic Info (Name, Headline, Location, About, Profile Image)
     - Experience (List of jobs, titles, companies, dates)
     - Education (List of schools, degrees)
     - Skills & Certifications
   - The mapped data will match a clean interface defined in TypeScript.

4. **Integrate with Express:**
   - Update `src/index.ts` to add the `GET /api/profile` endpoint.
   - Wire up the endpoint to take `req.query.url`, pass it to the URL normalizer, then to the scraper service, then to the mapper, and return the final JSON to the client.

## Next Steps (After this phase is merged)
Once Phase 3 is merged into main, the core functionality of the hiring challenge will be complete. We can test it locally using Postman or a browser by calling `http://localhost:3000/api/profile?url=https://www.linkedin.com/in/williamhgates`. Phase 4 will then handle error resilience and edge cases.
