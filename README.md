# LinkedIn Profile Scraper API

A production-ready REST API that accepts a **LinkedIn profile URL** and returns structured JSON containing the profile's complete information. Built for the **Tross Hiring Challenge**.

---

## 🔍 Approach: Reverse Engineering LinkedIn's Voyager API

This project does **not** use any paid third-party service. It works using a **3-tier scraping pipeline** that automatically falls through to the next method if the previous one is blocked:

```
Tier 1 → In-Memory Cache           (instant, 0 LinkedIn calls)
Tier 2 → Voyager Dash API          (fast, ~1-2s, lightweight HTTP)
Tier 3 → Public HTML + JSON-LD     (medium, ~3-5s, page scrape)
Tier 4 → Playwright Stealth Browser (reliable, ~15-30s on first use)
```

### How it works

1. **Voyager API** — When you browse LinkedIn, the web app makes background HTTP requests to LinkedIn's internal `Voyager` API (e.g. `https://www.linkedin.com/voyager/api/...`) to fetch profile data as structured JSON. We replicate these requests with proper browser headers.

2. **Playwright Stealth** — If LinkedIn's bot detection (Akamai WAF) blocks the direct HTTP calls, we fall back to a real Chromium browser with manual fingerprint patches applied. This browser:
   - Logs into LinkedIn using your `LINKEDIN_EMAIL` and `LINKEDIN_PASSWORD`
   - Saves the **full browser session** (cookies + localStorage) to `.linkedin_session.json`
   - Intercepts the Voyager API responses LinkedIn makes internally while loading the profile page
   - Reuses the saved session for all future requests — **no cookie invalidation**

3. **In-Memory Cache** — All successful results are cached for **1 hour** (max 100 profiles). The same profile will never trigger a LinkedIn request twice within that window.

**Key Benefits:**
- ⚡ Fast for cached profiles (instant)
- 🔒 Stable session — auto-login means cookies never expire manually
- 🔄 Automatic recovery — if session expires, it re-logs in automatically
- 🪶 Lightweight — Playwright browser only launches when needed

---

## 🗂 Project Structure

```
├── src/
│   ├── index.ts           # Express server, routing, rate limiting
│   ├── scraper.ts         # 3-tier scraping pipeline
│   ├── stealthScraper.ts  # Playwright stealth + persistent session manager
│   ├── mapper.ts          # Data transformation (raw Voyager JSON → clean schema)
│   ├── cache.ts           # In-memory TTL cache (1 hour, max 100 entries)
│   └── utils.ts           # LinkedIn URL normalizer
├── public/
│   ├── index.html         # Frontend UI
│   ├── styles.css         # Black & white professional design
│   └── app.js             # Frontend JavaScript
├── docs/                  # Per-phase implementation plans
├── research/              # Test scripts for API debugging
├── Dockerfile             # Multi-stage production Docker build
├── .env.example           # Template for required environment variables
└── README.md
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable            | Required | Description                                                             |
|---------------------|----------|-------------------------------------------------------------------------|
| `LI_AT`             | Optional | LinkedIn session cookie (for Tier 2 Voyager API — fast path)           |
| `JSESSIONID`        | Optional | LinkedIn CSRF session cookie (required alongside `LI_AT`)              |
| `LINKEDIN_EMAIL`    | ✅ Yes   | Your LinkedIn account email (for Playwright auto-login — stable path)  |
| `LINKEDIN_PASSWORD` | ✅ Yes   | Your LinkedIn account password (for Playwright auto-login)             |

> ⚠️ **Security:** Never commit your `.env` file. It is listed in `.gitignore`.

### Getting your `LI_AT` and `JSESSIONID` (Optional — for faster Tier 2 path)
1. Open [linkedin.com](https://www.linkedin.com) and log in.
2. Open **DevTools** (`F12`) → **Application** → **Cookies** → `www.linkedin.com`.
3. Copy the values for `li_at` and `JSESSIONID`.

> If you only set `LINKEDIN_EMAIL` and `LINKEDIN_PASSWORD`, the API will skip Tier 2 and go straight to Playwright stealth — which is perfectly fine and more stable.

---

## 🚀 Local Setup

### Prerequisites
- Node.js 18+
- npm

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/tushar66sharma/LinkedIn-Profile-Scrapper.git
cd LinkedIn-Profile-Scrapper

# 2. Install dependencies
npm install

# 3. Install Playwright Chromium browser
npx playwright install chromium

# 4. Setup environment variables
cp .env.example .env
# Edit .env — at minimum, set LINKEDIN_EMAIL and LINKEDIN_PASSWORD

# 5. Run in development mode
npm run dev
```

The server starts on `http://localhost:3000`.

**On the first request**, the Playwright browser will launch, log into LinkedIn automatically, and save the session. This takes ~20–30 seconds once. All subsequent requests reuse the saved session and are much faster.

---

## 🐳 Docker Setup

```bash
# 1. Build the image
docker build -t linkedin-scraper .

# 2. Run with your credentials
docker run -p 3000:3000 \
  -e LINKEDIN_EMAIL="your@email.com" \
  -e LINKEDIN_PASSWORD="your_password" \
  -e LI_AT="your_li_at" \
  -e JSESSIONID="your_jsessionid" \
  linkedin-scraper
```

> **Note for Docker:** You need to install the Playwright browser inside the Docker image. The `Dockerfile` handles this automatically.

---

## 📡 API Documentation

### Base URL
```
http://localhost:3000
```

---

### `GET /api/profile`
Fetches and returns structured data for a LinkedIn profile.

**Query Parameters:**

| Parameter | Type   | Required | Description                   |
|-----------|--------|----------|-------------------------------|
| `url`     | string | ✅ Yes   | Full LinkedIn profile URL     |

**Example Request:**
```
GET /api/profile?url=https://www.linkedin.com/in/williamhgates
```

**Successful Response (200):**
```json
{
  "status": "success",
  "cached": false,
  "data": {
    "name": "Bill Gates",
    "headline": "Co-chair, Bill & Melinda Gates Foundation",
    "location": "Seattle, Washington, United States",
    "about": "Co-chair of the Bill & Melinda Gates Foundation...",
    "profileImage": "https://media.licdn.com/dms/image/...",
    "experience": [
      {
        "title": "Co-chair",
        "company": "Bill & Melinda Gates Foundation",
        "description": null,
        "dateRange": "2000 – Present"
      }
    ],
    "education": [
      {
        "school": "Harvard University",
        "degree": "Dropped out",
        "fieldOfStudy": null,
        "dateRange": "1973 – 1975"
      }
    ],
    "skills": ["Philanthropy", "Global Health", "Software Development"],
    "certifications": [],
    "languages": ["English"]
  }
}
```

> When `"cached": true`, the data was returned from the in-memory cache instantly without calling LinkedIn.

---

**Error Responses:**

| Status | Reason                                  | Message Example                                                         |
|--------|-----------------------------------------|-------------------------------------------------------------------------|
| `400`  | Missing or invalid LinkedIn URL         | `"Please provide a valid LinkedIn URL as a query parameter (?url=...)"` |
| `401`  | LinkedIn credentials / cookies invalid  | `"LinkedIn authentication failed (401). Cookies may be expired."`       |
| `404`  | Profile not found or private            | `"Profile 'username' was not found. The profile may be private."`       |
| `429`  | Rate limit exceeded (30 req / 15 min)   | `"Too many requests from this IP, please try again after 15 minutes."`  |
| `500`  | Unexpected server error                 | `"An unexpected error occurred."`                                       |
| `503`  | LinkedIn temporarily blocking requests  | `"LinkedIn is temporarily blocking requests from this machine..."`      |

---

## ⚠️ Known Limitations

1. **First-time Login:** The first request after a fresh start will take 20–30 seconds as the Playwright browser logs in and establishes the session.
2. **Security Checkpoints:** If LinkedIn detects suspicious activity on your account, it may show a CAPTCHA/checkpoint page. Logging in manually once on a browser usually clears it.
3. **Private Profiles:** LinkedIn does not expose data for strictly private profiles even to logged-in users.
4. **Rate Limits:** The API enforces **30 requests per 15 minutes** per IP to protect the underlying LinkedIn account.
5. **API Changes:** LinkedIn may update their internal API structure without notice, requiring mapper updates.

---

## 📄 License

ISC
