# LinkedIn Profile Scraper API

A lightweight REST API that accepts a **LinkedIn profile URL** and returns structured JSON containing the profile's complete information. Built for the **Tross Hiring Challenge**.

---

## 🔍 Approach: Reverse Engineering LinkedIn's Internal (Voyager) API

This project does **not** use a headless browser (Puppeteer/Playwright) or any paid third-party service. Instead, it works by:

1. When you browse LinkedIn in your browser, the web app makes background HTTP requests to LinkedIn's internal API, called the **Voyager API** (e.g., `https://www.linkedin.com/voyager/api/...`), to fetch profile data as structured JSON.
2. By extracting your own browser session cookies (`li_at` and `JSESSIONID`) from a logged-in LinkedIn session, we can make identical HTTP requests programmatically from our backend.
3. LinkedIn's server treats these requests as legitimate browser traffic and returns the full profile data in JSON format.
4. We then parse, clean, and map this raw nested JSON into a well-structured API response.

**Key Benefits:**
- ⚡ Fast (no browser boot time)
- 🪶 Lightweight (no headless browser memory overhead)
- 🛠 Data comes natively in JSON (no HTML parsing)

---

## 🗂 Project Structure

```
├── src/
│   ├── index.ts        # Express server, routing, and rate limiting
│   ├── scraper.ts      # Voyager API HTTP client
│   ├── mapper.ts       # Data transformation (raw → clean JSON)
│   └── utils.ts        # URL normalizer and helpers
├── docs/               # Per-phase implementation plans
├── research/           # Test scripts for Voyager API (gitignored from .env)
├── Dockerfile          # Multi-stage production Docker build
├── .env.example        # Template for required environment variables
└── README.md
```

---

## ⚙️ Environment Variables

Before running locally, copy `.env.example` to `.env` and fill in your LinkedIn cookies.

```bash
cp .env.example .env
```

| Variable      | Description                                                    |
|---------------|----------------------------------------------------------------|
| `LI_AT`       | Your LinkedIn session auth token cookie                        |
| `JSESSIONID`  | Your LinkedIn CSRF session cookie                              |

### How to get your cookies:
1. Open your browser and go to [linkedin.com](https://www.linkedin.com).
2. Log in to your account.
3. Open **Developer Tools** (`F12`) → **Application** tab → **Cookies** → `www.linkedin.com`.
4. Copy the values for `li_at` and `JSESSIONID`.
5. Paste them into your `.env` file.

> ⚠️ **Important:** These cookies are tied to your LinkedIn session. Do NOT commit your `.env` file to Git.

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

# 3. Setup environment variables
cp .env.example .env
# Edit .env and add your LI_AT and JSESSIONID values

# 4. Run in development mode
npm run dev
```

The server will start on `http://localhost:3000`.

---

## 🐳 Docker Setup

```bash
# 1. Build the Docker image
docker build -t linkedin-scraper .

# 2. Run the container with your cookies passed as environment variables
docker run -p 3000:3000 \
  -e LI_AT="your_li_at_value" \
  -e JSESSIONID="your_jsessionid_value" \
  linkedin-scraper
```

---

## 📡 API Documentation

### Base URL
```
http://localhost:3000
```

---

### `GET /`
Health check endpoint.

**Response:**
```json
{
  "status": "success",
  "message": "LinkedIn Profile Scraper API is running!"
}
```

---

### `GET /api/profile`
Fetches and returns structured data for a LinkedIn profile.

**Query Parameters:**

| Parameter | Type   | Required | Description                              |
|-----------|--------|----------|------------------------------------------|
| `url`     | string | ✅ Yes   | Full LinkedIn profile URL                |

**Example Request:**
```
GET /api/profile?url=https://www.linkedin.com/in/williamhgates
```

**Successful Response (200):**
```json
{
  "status": "success",
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
        "description": "...",
        "dateRange": "2000 - Present"
      }
    ],
    "education": [
      {
        "school": "Harvard University",
        "degree": "Dropped out",
        "fieldOfStudy": "...",
        "dateRange": "1973 - 1975"
      }
    ],
    "skills": ["Philanthropy", "Global Health", "Software Development"],
    "certifications": [],
    "languages": ["English"]
  }
}
```

---

**Error Responses:**

| Status Code | Reason                                    | Example Message                                                      |
|-------------|-------------------------------------------|----------------------------------------------------------------------|
| `400`       | Missing or invalid LinkedIn URL           | `"Please provide a valid LinkedIn URL as a query parameter (?url=...)"`|
| `401`       | LinkedIn cookies expired or invalid       | `"LinkedIn authentication failed (401). Cookies may be expired."`    |
| `404`       | Profile not found or private              | `"Profile 'username' not found on LinkedIn."`                        |
| `429`       | Rate limit exceeded (30 req / 15 min)     | `"Too many requests from this IP, please try again after 15 minutes."`|
| `500`       | Unexpected server error                   | `"An unexpected error occurred while fetching profile data."`        |

---

## ⚠️ Known Limitations

1. **Cookie Expiration:** The `li_at` cookie expires after several months, or immediately if you log out. Update your environment variables when this happens.
2. **Private Profiles:** LinkedIn may return incomplete data for profiles with strict privacy settings.
3. **Rate Limits:** The API enforces a limit of **30 requests per 15 minutes** per IP to protect the underlying LinkedIn account from being flagged.
4. **API Changes:** As this uses an undocumented internal API, LinkedIn may change their endpoint structure without notice. The mapper may need updates if the JSON schema changes.

---

## 📄 License

ISC
