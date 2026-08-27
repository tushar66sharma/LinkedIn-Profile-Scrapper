export async function fetchProfileData(username: string): Promise<any> {
  const LI_AT = process.env.LI_AT;
  const JSESSIONID = process.env.JSESSIONID;

  if (!LI_AT || !JSESSIONID) {
    throw new Error("Missing LinkedIn authentication cookies in environment variables.");
  }

  const csrfToken = JSESSIONID.replace(/"/g, '');
  
  // Note: LinkedIn changes endpoints occasionally. This is the standard Voyager profile view endpoint.
  // We use the graphql version or the direct identity version.
  const url = `https://www.linkedin.com/voyager/api/identity/profiles/${username}/profileView`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Cookie': `li_at=${LI_AT}; JSESSIONID="${csrfToken}";`,
      'csrf-token': csrfToken,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'X-RestLi-Protocol-Version': '2.0.0'
    }
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(`LinkedIn authentication failed (${response.status}). Cookies may be expired.`);
    }
    if (response.status === 404) {
      throw new Error(`Profile '${username}' not found on LinkedIn.`);
    }
    throw new Error(`LinkedIn API returned status ${response.status}`);
  }

  const data = await response.json();
  return data;
}
