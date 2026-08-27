export async function fetchProfileData(username: string): Promise<any> {
  const LI_AT    = process.env.LI_AT;
  const JSESSIONID = process.env.JSESSIONID;

  if (!LI_AT || !JSESSIONID) {
    throw new Error('Missing LinkedIn authentication cookies in environment variables.');
  }

  // dotenv strips outer quotes, but guard against both cases
  const liAt     = LI_AT.replace(/^"|"$/g, '');
  const jsession = JSESSIONID.replace(/^"|"$/g, '');
  const csrfToken = jsession; // JSESSIONID value IS the csrf token

  const headers: Record<string, string> = {
    // ── Auth ────────────────────────────────────────────────────────────────
    'Cookie': `li_at=${liAt}; JSESSIONID="${csrfToken}";`,
    'csrf-token': csrfToken,

    // ── Browser Fingerprint ──────────────────────────────────────────────
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'application/vnd.linkedin.normalized+json+2.1',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': `https://www.linkedin.com/in/${username}/`,
    'Origin': 'https://www.linkedin.com',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'Connection': 'keep-alive',

    // ── LinkedIn-specific ────────────────────────────────────────────────
    'X-RestLi-Protocol-Version': '2.0.0',
    'X-Li-Lang': 'en_US',
    'X-Li-Track': JSON.stringify({
      clientVersion: '1.13.12094',
      mpVersion: '1.13.12094',
      osName: 'web',
      timezoneOffset: 5.5,
      timezone: 'Asia/Kolkata',
      deviceFormFactor: 'DESKTOP',
      mpName: 'voyager-web',
      displayDensity: 1,
      displayWidth: 1920,
      displayHeight: 1080
    }),
    'X-Li-Page-Instance': 'urn:li:page:d_flagship3_profile_view_base;' + randomId(),
  };

  const dashUrl = `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${username}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93`;

  console.log(`[Scraper] Fetching profile: ${username}`);

  const response = await fetchWithRetry(dashUrl, headers);

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(`LinkedIn authentication failed (${response.status}). Your cookies may be expired. Please update LI_AT and JSESSIONID.`);
    }
    if (response.status === 404) {
      throw new Error(`Profile '${username}' was not found on LinkedIn. The profile may be private or deleted.`);
    }
    if (response.status === 429) {
      throw new Error('LinkedIn rate limit hit. Please wait a few minutes before sending another request.');
    }
    if (response.status === 410) {
      throw new Error('The LinkedIn API endpoint returned 410 Gone. The API may have changed — please report this issue.');
    }
    const body = await response.text();
    console.error(`[Scraper] Unexpected response ${response.status}:`, body.slice(0, 300));
    throw new Error(`LinkedIn API returned an unexpected status: ${response.status}`);
  }

  const data = await response.json();
  console.log(`[Scraper] Successfully fetched data for: ${username}`);
  return data;
}

// ── Fetch with retry (up to 2 retries on network failure) ─────────────────
async function fetchWithRetry(url: string, headers: Record<string, string>, retries = 2): Promise<Response> {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const res = await fetch(url, { method: 'GET', headers });
      return res;
    } catch (err: any) {
      if (attempt <= retries) {
        console.warn(`[Scraper] Attempt ${attempt} failed (${err.message}). Retrying in ${attempt * 2}s...`);
        await sleep(attempt * 2000);
      } else {
        throw new Error(
          `LinkedIn is temporarily blocking requests from this machine. ` +
          `This is a temporary IP/session block, not a code error. ` +
          `Please wait 15–30 minutes and try again. (${err.message})`
        );
      }
    }
  }
  throw new Error('Unreachable');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomId(): string {
  return Math.random().toString(36).substring(2, 15);
}
