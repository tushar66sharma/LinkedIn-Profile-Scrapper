# Implementation Plan: LinkedIn Profile Scraper API

## Goal
Design and build a hosted API over HTTPS that accepts a LinkedIn profile URL and returns structured JSON containing the profile's information. The solution will rely on reverse engineering LinkedIn's internal APIs (Voyager) and will not use any paid third-party scraping services, strictly adhering to the Tross Hiring Challenge constraints.

## Approaches Evaluated

### 1. Web Scraping via Headless Browser (Puppeteer / Playwright)
- **Concept:** Launch a headless browser instance, log into a LinkedIn account, navigate to the target profile URL, and parse the HTML DOM to extract information.
- **Pros:** Highly capable of bypassing basic bot detection; renders JavaScript exactly as a real user would.
- **Cons:** Very slow (taking multiple seconds per request), highly resource-intensive (requires significant RAM/CPU on the server), and highly fragile (any UI changes by LinkedIn will break the scraper).

### 2. Reverse Engineering Internal API (Voyager) - **[RECOMMENDED APPROACH]**
- **Concept:** When you browse LinkedIn, the web application makes background HTTP requests to its own internal API (called the "Voyager API") to fetch profile data in JSON format. By extracting the authentication cookies and CSRF tokens from our own browser session, we can programmatically send identical HTTP requests directly to these internal endpoints from our backend.
- **Pros:** Extremely fast, lightweight, and scalable. The data is returned natively in JSON, making extraction much cleaner than parsing HTML. It perfectly aligns with the challenge's instruction to "Reverse engineer LinkedIn APIs".
- **Cons:** Requires manual extraction and occasional refreshing of session cookies. LinkedIn may change their internal API structure, requiring maintenance.

**Decision:** We will proceed with **Approach 2** as it provides the most optimal, API-friendly response times and adheres to the spirit of the "reverse engineering" requirement.

---

## Phased Implementation Plan

### Phase 1: Research & Reverse Engineering
Before writing code, we must understand how the LinkedIn web app fetches profile data.
1. **Network Interception:** Open a LinkedIn profile in a browser with Developer Tools open (Network tab).
2. **Identify Endpoints:** Look for XHR/Fetch requests to `https://www.linkedin.com/voyager/api/...` (specifically GraphQL or profileView endpoints) that return the profile's JSON data.
3. **Analyze Authentication:** Document the required headers. The most critical are:
   - `Cookie`: Specifically the `li_at` (auth token) and `JSESSIONID` (session ID) cookies.
   - `csrf-token` / `X-RestLi-Protocol-Version`: Required to authorize the request.
4. **URL Parsing:** Determine how to extract the exact profile ID/vanity name from various LinkedIn URL formats to inject into our API requests.

### Phase 2: Backend Architecture & Setup
1. **Tech Stack Selection:** Node.js with Express (or Fastify) and TypeScript. It is lightweight, excellent for handling asynchronous HTTP requests, and natively handles JSON manipulation.
2. **Project Initialization:** Set up the repository, ESLint, Prettier, and TypeScript configuration.
3. **Environment Variables:** Set up a `.env` file to securely store the `li_at` and `JSESSIONID` cookies. *These will never be committed to the repository.*

### Phase 3: Core Implementation
1. **Routing:** Create a single `GET /api/profile?url=<linkedin_url>` endpoint.
2. **URL Normalizer:** Build a utility function that validates the incoming URL and extracts the username identifier (e.g., extracting `john-doe` from `https://www.linkedin.com/in/john-doe/`).
3. **Service Layer (The Scraper):** 
   - Construct the exact HTTP GET request to the Voyager API endpoint discovered in Phase 1.
   - Attach the cookies and headers dynamically from environment variables.
   - Handle rate limiting or authorization errors gracefully.
4. **Data Transformation (Schema Mapping):** The Voyager API returns massive, deeply nested, and messy JSON. We will create a mapper function to extract only the required fields (Name, Headline, Location, About, Experience, Education, Skills, Certifications, Languages, Profile Image) and format them into a clean, custom response schema.

### Phase 4: Error Handling & Edge Cases
- **Invalid URLs:** Return a 400 Bad Request.
- **Profile Not Found / Private Profiles:** Handle 404s and 403s from LinkedIn and return appropriate semantic API errors.
- **Session Expiration:** If the `li_at` cookie expires, the API should log an alert and return a 500 Internal Server Error with a message indicating backend configuration is required.

### Phase 5: Deployment & Documentation
1. **Dockerization:** Create a `Dockerfile` for consistent deployment.
2. **Hosting:** Deploy to a free/low-cost tier of a service like Render or Railway. These services automatically provision HTTPS certificates.
3. **Documentation:** Write a comprehensive `README.md` containing:
   - Instructions on how to get `li_at` and `JSESSIONID` cookies from the browser.
   - Local setup instructions.
   - API Endpoint documentation (Request format, Response schema).
   - The approach taken (explaining the Voyager API).
   - Known limitations (e.g., cookie expiration, rate limits).

---

## Open Questions for the User
Before we begin Phase 1 and start writing code, please clarify the following:

1. **Tech Stack Preference:** I have proposed Node.js/TypeScript with Express. Are you comfortable with this, or do you have a strict preference for Python (FastAPI) or another language?
2. **Hosting Service:** Do you have an existing account on Render, Heroku, Railway, or Vercel that you would prefer to use for the HTTPS deployment?
3. **Execution Mode:** Would you like me to start creating the initial boilerplate code now, or would you prefer to conduct the Phase 1 network analysis yourself and provide me with the exact Voyager API endpoint you want to use?
