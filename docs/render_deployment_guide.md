# Deploying LinkedIn Profile Scraper to Render.com

This guide walks you through deploying the LinkedIn Profile Scraper API on [Render.com](https://render.com) so it is accessible over a public HTTPS URL.

---

## Prerequisites
- ✅ Phase 5 merged into `main` on GitHub.
- ✅ A GitHub account with the repository pushed.
- ✅ Your `LI_AT` and `JSESSIONID` cookie values ready.

---

## Step 1: Sign Up / Log In to Render

1. Go to [https://render.com](https://render.com).
2. Click **Get Started for Free**.
3. Sign up using your **GitHub** account (recommended — it makes connecting repos easier).
4. Authorize Render to access your GitHub repositories.

---

## Step 2: Create a New Web Service

1. Once logged in, you will land on the **Dashboard**.
2. Click the **New +** button in the top-right corner.
3. From the dropdown, select **Web Service**.

![Render Dashboard New Service](https://render.com/static/dashboard-screenshot.png)

---

## Step 3: Connect Your GitHub Repository

1. Render will ask you to connect a Git repository.
2. Click **Connect account** under GitHub (if not already connected).
3. You will see a list of your repositories. Search for **LinkedIn-Profile-Scrapper**.
4. Click **Connect** next to it.

---

## Step 4: Configure the Web Service

After connecting the repo, Render will show a configuration form. Fill in these fields **exactly**:

| Field              | Value                                      |
|--------------------|--------------------------------------------|
| **Name**           | `linkedin-profile-scraper` (or any name)   |
| **Region**         | Choose the region closest to you           |
| **Branch**         | `main`                                     |
| **Runtime**        | `Docker`                                   |
| **Instance Type**  | `Free`                                     |

> ✅ Since we have a `Dockerfile` in the root of our repo, Render will **automatically detect** it and select `Docker` as the runtime. You do not need to change anything in the build/start commands.

---

## Step 5: Add Environment Variables (Your Cookies)

This is the most critical step. Scroll down to the **Environment Variables** section.

Click **Add Environment Variable** and add the following **two variables**:

### Variable 1
| Key    | Value                                |
|--------|--------------------------------------|
| `LI_AT` | *(paste your full `li_at` cookie value here)* |

### Variable 2
| Key          | Value                                       |
|--------------|---------------------------------------------|
| `JSESSIONID` | *(paste your full `JSESSIONID` cookie value here)* |

> ⚠️ **Important:** Do NOT include the surrounding double quotes `"` when pasting the values into Render. Render stores the raw value, not the quoted string.
>
> For example:
> - ❌ Wrong: `"ajax:6183083160461541381"`
> - ✅ Correct: `ajax:6183083160461541381`

---

## Step 6: Deploy

1. After filling everything in, scroll to the bottom and click **Create Web Service**.
2. Render will now:
   - Pull your code from GitHub.
   - Build the Docker image using your `Dockerfile`.
   - Deploy the container.
3. You will see a live build log. Wait for it to finish. It typically takes **2–4 minutes** for the first build.
4. Once complete, you will see a status badge change to **Live** ✅.

---

## Step 7: Get Your Public HTTPS URL

1. At the top of your Render service page, you will see a URL like:
   ```
   https://linkedin-profile-scraper.onrender.com
   ```
2. Click on it — you should see the health check response:
   ```json
   {
     "status": "success",
     "message": "LinkedIn Profile Scraper API is running!"
   }
   ```

---

## Step 8: Test Your Live API

Open your browser or use any API client (like Postman or Insomnia) and send this request:

```
GET https://linkedin-profile-scraper.onrender.com/api/profile?url=https://www.linkedin.com/in/williamhgates
```

You should receive a structured JSON response with Bill Gates' profile data.

---

## Step 9: Auto-Deploy on Future Pushes (Optional but Recommended)

By default, Render automatically re-deploys your service every time you push a new commit to the `main` branch. You do not need to do anything extra for this — it is already enabled.

---

## Updating Your Cookies (When They Expire)

When the `li_at` cookie expires (after several months), your API will start returning `401` errors. Here is how to fix it:

1. Log into [linkedin.com](https://linkedin.com) in your browser.
2. Open DevTools (`F12`) → **Application** → **Cookies** → `www.linkedin.com`.
3. Copy the new values of `li_at` and `JSESSIONID`.
4. Go to your Render service → **Environment** tab.
5. Update the `LI_AT` and `JSESSIONID` values.
6. Click **Save Changes** — Render will automatically redeploy with the new cookies.

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Build fails | Docker error | Check the Render build logs for the exact error |
| API returns `401` | Cookies expired or wrong | Re-copy your cookies from the browser and update env vars |
| API returns `404` for a profile | Profile is private or doesn't exist | Try with a different public profile URL |
| Service goes to sleep | Free tier spins down after 15 min idle | Upgrade to a paid tier or use a cron job to ping it |

> 💡 **Note on Free Tier Sleep:** Render's free tier spins down a service after 15 minutes of inactivity. The next request after sleep will take ~30 seconds to respond as it wakes up. For always-on availability, consider upgrading to a paid tier ($7/month).

---

## Summary

| Step | Action |
|------|--------|
| 1 | Sign up on Render with GitHub |
| 2 | Create a New Web Service |
| 3 | Connect the `LinkedIn-Profile-Scrapper` GitHub repo |
| 4 | Set Runtime to `Docker`, Branch to `main` |
| 5 | Add `LI_AT` and `JSESSIONID` as Environment Variables |
| 6 | Click Deploy and wait for the build |
| 7 | Copy your public HTTPS URL and test it |
