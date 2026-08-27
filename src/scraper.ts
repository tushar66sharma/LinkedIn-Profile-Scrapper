// ── Rotating User-Agent pool (real Chrome/Firefox strings) ────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
}

function randomDelay(minMs = 1500, maxMs = 4000): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  console.log(`[Scraper] Waiting ${ms}ms before request (anti-bot delay)...`);
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export async function fetchProfileData(username: string): Promise<any> {
  const LI_AT    = process.env.LI_AT;
  const JSESSIONID = process.env.JSESSIONID;

  if (!LI_AT || !JSESSIONID) {
    throw new Error('Missing LinkedIn authentication cookies in environment variables.');
  }

  const liAt      = LI_AT.replace(/^"|"$/g, '');
  const jsession  = JSESSIONID.replace(/^"|"$/g, '');
  const csrfToken = jsession;

  // ── Random delay to mimic human browsing patterns ──────────────────────
  await randomDelay();

  const headers: Record<string, string> = {
    // ── Auth ────────────────────────────────────────────────────────────────
    'Cookie': `li_at=${liAt}; JSESSIONID="${csrfToken}";`,
    'csrf-token': csrfToken,

    // ── Rotated browser fingerprint ─────────────────────────────────────
    'User-Agent': randomUA(),
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

  console.log(`[Scraper] Fetching profile for: ${username}`);

  // ── Primary: Voyager Dash API ──────────────────────────────────────────
  let response: Response;
  try {
    response = await fetchWithRetry(dashUrl, headers);
  } catch (netErr: any) {
    // ── Fallback 1: Scrape public HTML page ───────────────────────────────
    console.warn('[Scraper] Voyager API blocked by network. Trying HTML fallback...');
    try {
      return await scrapePublicPage(username, liAt, csrfToken);
    } catch {
      // ── Fallback 2: Playwright Stealth (real browser) ─────────────────
      console.warn('[Scraper] HTML fetch also blocked. Launching stealth browser...');
      const { stealthFetchProfile } = await import('./stealthScraper');
      return await stealthFetchProfile(username, liAt, csrfToken);
    }
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(`LinkedIn authentication failed (${response.status}). Your cookies may be expired.`);
    }
    if (response.status === 404) {
      throw new Error(`Profile '${username}' was not found. The profile may be private or deleted.`);
    }
    if (response.status === 429) {
      throw new Error('LinkedIn rate limit hit. Please wait a few minutes before trying again.');
    }
    // On any other failure, try the public page fallback
    console.warn(`[Scraper] API returned ${response.status}. Attempting HTML/JSON-LD fallback...`);
    return await scrapePublicPage(username, liAt, csrfToken);
  }

  const data = await response.json();
  console.log(`[Scraper] Successfully fetched via Voyager API for: ${username}`);
  return data;
}

// ── Fallback: Scrape public profile page and extract JSON-LD ─────────────
async function scrapePublicPage(username: string, liAt: string, csrfToken: string): Promise<any> {
  const pageUrl = `https://www.linkedin.com/in/${username}/`;
  console.log(`[Scraper] Fetching public HTML page: ${pageUrl}`);

  const pageRes = await fetch(pageUrl, {
    method: 'GET',
    headers: {
      'Cookie': `li_at=${liAt}; JSESSIONID="${csrfToken}";`,
      'User-Agent': randomUA(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1',
      'Connection': 'keep-alive',
    }
  });

  if (!pageRes.ok) {
    throw new Error(
      `LinkedIn is temporarily blocking requests from this machine. ` +
      `This is a short-term IP/session block — please wait 15–30 minutes and try again. ` +
      `(HTML fallback also returned ${pageRes.status})`
    );
  }

  const html = await pageRes.text();

  // LinkedIn embeds structured data in <script type="application/ld+json"> tags
  const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);

  if (!jsonLdMatches || jsonLdMatches.length === 0) {
    // Check if we were redirected to login
    if (html.includes('authwall') || html.includes('login') || html.includes('sign-in')) {
      throw new Error('LinkedIn redirected to login page. Cookies may be expired or the profile is private.');
    }
    throw new Error(
      `LinkedIn is temporarily blocking requests from this machine. ` +
      `Please wait 15–30 minutes and try again.`
    );
  }

  // Parse all JSON-LD blocks and look for the Person schema
  const jsonLdObjects: any[] = [];
  for (const match of jsonLdMatches) {
    try {
      const json = JSON.parse(match.replace(/<script type="application\/ld\+json">/, '').replace(/<\/script>/, ''));
      jsonLdObjects.push(json);
    } catch { /* skip malformed blocks */ }
  }

  console.log(`[Scraper] HTML fallback succeeded for: ${username} (${jsonLdObjects.length} JSON-LD block(s) found)`);
  // Return in a special wrapper so the mapper knows it's from JSON-LD
  return { __source: 'jsonld', jsonld: jsonLdObjects };
}

// ── Fetch with retry ───────────────────────────────────────────────────────
async function fetchWithRetry(url: string, headers: Record<string, string>, retries = 2): Promise<Response> {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await fetch(url, { method: 'GET', headers });
    } catch (err: any) {
      if (attempt <= retries) {
        const wait = attempt * 2000 + Math.floor(Math.random() * 1000);
        console.warn(`[Scraper] Attempt ${attempt} failed (${err.message}). Retrying in ${wait}ms...`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
  throw new Error('Unreachable');
}
