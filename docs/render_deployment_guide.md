# Deploying LinkedIn Profile Scraper to Render.com

This guide walks you through deploying the LinkedIn Profile Scraper API on [Render.com](https://render.com) so it is accessible over a public HTTPS URL.

---

## Prerequisites
- ✅ All phase branches merged into `main` on GitHub.
- ✅ Your LinkedIn account **email and password** ready.
- ✅ (Optional) Your `LI_AT` and `JSESSIONID` cookies.

---

## Important: How the Scraper Works on Render

When deployed on Render, the **3-tier pipeline** operates differently than locally:

| Tier | Method | Works on Render Free? | Notes |
|------|--------|-----------------------|-------|
| 1 | In-memory cache | ✅ Yes | Instant, 0 LinkedIn calls |
| 2 | Voyager Dash API | ✅ Yes (reliable) | Clean AWS IPs are not flagged by LinkedIn |
| 3 | HTML/JSON-LD scrape | ✅ Yes | Falls back if Tier 2 blocked |
| 4 | Playwright browser | ❌ No | 512 MB RAM too low for Chromium |

> **Why no Playwright needed on Render?**
> The reason Playwright is needed locally is that your **home/residential IP gets temporarily flagged** by LinkedIn after the first direct API call. Render runs on **clean AWS cloud IPs** that LinkedIn has never flagged — so the direct Voyager API works reliably from there. Playwright is a local development fallback only.

---

## Step 1: Sign Up / Log In to Render

1. Go to [https://render.com](https://render.com).
2. Click **Get Started for Free**.
3. Sign up using your **GitHub** account.
4. Authorize Render to access your GitHub repositories.

---

## Step 2: Create a New Web Service

1. From the Render **Dashboard**, click **New +** → **Web Service**.
2. Click **Connect account** under GitHub if not already connected.
3. Search for **LinkedIn-Profile-Scrapper** and click **Connect**.

---

## Step 3: Configure the Web Service

Fill in the configuration form exactly as follows:

| Field             | Value                            |
|-------------------|----------------------------------|
| **Name**          | `linkedin-profile-scraper`       |
| **Region**        | Choose closest to you            |
| **Branch**        | `main`                           |
| **Runtime**       | `Docker`                         |
| **Instance Type** | `Free`                           |

> ✅ Render auto-detects the `Dockerfile` in the root of the repo.

---

## Step 4: Update Dockerfile for Playwright

Since we use Playwright Chromium as the fallback scraper, the Dockerfile needs to install the browser. Update it as follows before deploying:

<br>

**Option A: If you only want Tiers 1–3 (no Playwright)**

Keep the existing `Dockerfile` as-is. This is lightweight but Playwright won't be available.

**Option B: Full Playwright support (recommended)**

The `Dockerfile` should install Chromium system dependencies. Update it to:

```dockerfile
# Stage 1: Build
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: Production with Playwright dependencies
FROM node:20-slim AS production
WORKDIR /app

# Install Playwright system dependencies
RUN apt-get update && apt-get install -y \
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libatspi2.0-0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libxkbcommon0 libpango-1.0-0 \
    libcairo2 libasound2 libxshmfence1 \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production

# Install Playwright Chromium browser
RUN npx playwright install chromium

COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

---

## Step 5: Add Environment Variables

Scroll to the **Environment Variables** section. Add all of the following:

### Required (for stable Playwright auto-login):

| Key                  | Value                                           |
|----------------------|-------------------------------------------------|
| `LINKEDIN_EMAIL`     | Your LinkedIn account email address             |
| `LINKEDIN_PASSWORD`  | Your LinkedIn account password                  |

### Optional (for faster Tier 2 Voyager API path):

| Key          | Value                                |
|--------------|--------------------------------------|
| `LI_AT`      | Your `li_at` cookie value (no quotes)|
| `JSESSIONID` | Your `JSESSIONID` value (no quotes)  |

> ⚠️ **Do NOT include surrounding double quotes** when pasting into Render's dashboard.

---

## Step 6: Deploy

1. Click **Create Web Service**.
2. Render pulls your code, builds the Docker image, and deploys.
3. First build takes **3–5 minutes** (longer with Playwright deps).
4. Watch the build log — look for `Server is running on port 3000`.

---

## Step 7: Get Your Public HTTPS URL

Once deployed, you will see a URL like:
```
https://linkedin-profile-scraper.onrender.com
```

Test it:
```
GET https://linkedin-profile-scraper.onrender.com/api/profile?url=https://www.linkedin.com/in/williamhgates
```

---

## Step 8: First-Request Behavior

The **first request** after a fresh deploy will trigger the Playwright login flow:
- Takes ~20–30 seconds
- LinkedIn login page is loaded in the headless browser
- Credentials are filled in automatically
- Session is saved to `.linkedin_session.json` in the container

All subsequent requests will reuse the saved session and respond in 2–5 seconds.

> ⚠️ **Note:** On Render's free tier, the container restarts periodically. Each restart clears the saved session file, triggering a re-login on the next request. This is normal behavior.

---

## Updating Credentials (When Needed)

If your LinkedIn password changes or the account gets locked:

1. Go to your Render service → **Environment** tab.
2. Update `LINKEDIN_EMAIL` and/or `LINKEDIN_PASSWORD`.
3. Click **Save Changes** — Render automatically redeploys.

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Build fails | Playwright deps missing | Use the Option B Dockerfile |
| `CAPTCHA / checkpoint` error | LinkedIn flagged the account | Log in manually from your browser once to clear it |
| Service goes to sleep | Free tier idles after 15 min | First request after sleep takes ~30s to wake + login |
| `401 authentication failed` | Credentials wrong | Verify email/password in Render env vars |
| Profile not found | Private profile | Try with a different public profile URL |

> 💡 **Tip on Free Tier Sleep:** Render's free tier sleeps after 15 minutes of inactivity. The next request wakes it up (~30s). For always-on service, upgrade to a paid tier ($7/month).

---

## Summary

| Step | Action |
|------|--------|
| 1 | Sign up on Render with GitHub |
| 2 | Create a New Web Service |
| 3 | Connect `LinkedIn-Profile-Scrapper` repo, set Runtime = Docker |
| 4 | Update Dockerfile for Playwright (Option B) |
| 5 | Add `LINKEDIN_EMAIL`, `LINKEDIN_PASSWORD` (and optionally `LI_AT`, `JSESSIONID`) as env vars |
| 6 | Deploy and wait for build |
| 7 | Copy your HTTPS URL and test |
