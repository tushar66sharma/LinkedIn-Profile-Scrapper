export async function fetchProfileData(username: string): Promise<any> {
  const LI_AT = process.env.LI_AT;
  const JSESSIONID = process.env.JSESSIONID;

  if (!LI_AT || !JSESSIONID) {
    throw new Error("Missing LinkedIn authentication cookies in environment variables.");
  }

  const csrfToken = JSESSIONID.replace(/"/g, '');

  const commonHeaders: Record<string, string> = {
    'Cookie': `li_at=${LI_AT}; JSESSIONID="${csrfToken}";`,
    'csrf-token': csrfToken,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'application/vnd.linkedin.normalized+json+2.1',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-RestLi-Protocol-Version': '2.0.0',
    'X-Li-Lang': 'en_US',
    'X-Li-Track': '{"clientVersion":"1.13.12094","mpVersion":"1.13.12094","osName":"web","timezoneOffset":5.5,"timezone":"Asia/Kolkata","deviceFormFactor":"DESKTOP","mpName":"voyager-web","displayDensity":1,"displayWidth":1920,"displayHeight":1080}',
  };

  // ── Primary: Dash API (current, works as of 2024-25) ──────────────────────
  const dashUrl = `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${username}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93`;

  let response = await fetch(dashUrl, { method: 'GET', headers: commonHeaders });

  // ── Fallback: GraphQL endpoint ────────────────────────────────────────────
  if (!response.ok && response.status === 410) {
    console.warn(`Primary endpoint returned 410. Trying GraphQL fallback for '${username}'...`);
    const gqlUrl = `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(publicIdentifier:${username})&queryId=voyagerIdentityDashProfiles.2e10090751e01a2c1cad1a9ece040958`;
    response = await fetch(gqlUrl, { method: 'GET', headers: commonHeaders });
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(`LinkedIn authentication failed (${response.status}). Cookies may be expired.`);
    }
    if (response.status === 404) {
      throw new Error(`Profile '${username}' not found on LinkedIn.`);
    }
    if (response.status === 429) {
      throw new Error('LinkedIn rate limit hit. Please wait a few minutes before trying again.');
    }
    throw new Error(`LinkedIn API returned status ${response.status}`);
  }

  const data = await response.json();
  return data;
}
