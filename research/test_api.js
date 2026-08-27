/**
 * Comprehensive test script — Run with: node research/test_api.js
 *
 * Tests:
 *  1. URL extraction
 *  2. Raw Voyager Dash API response (dumps status + raw JSON)
 *  3. Basic mapper output
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const LI_AT    = process.env.LI_AT;
const JSESSIONID = process.env.JSESSIONID;

// ─── 1. Test URL extraction ─────────────────────────────────────────────────
function extractUsername(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('linkedin.com')) return null;
    const parts = u.pathname.split('/').filter(p => p.length > 0);
    if (parts[0] === 'in' && parts.length >= 2) return parts[1];
    return null;
  } catch { return null; }
}

const testUrls = [
  'https://www.linkedin.com/in/williamhgates',
  'https://www.linkedin.com/in/tushar-sharma-599992256/',
  'https://www.linkedin.com/in/tushar-sharma-599992256/?skipRedirect=true',
  'https://linkedin.com/in/someone',
  'https://google.com/in/someone',  // should return null
  'not-a-url',                       // should return null
];

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 1 — URL Extraction');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
testUrls.forEach(url => {
  const result = extractUsername(url);
  const status = result ? '✅' : (url.includes('linkedin.com/in/') ? '❌' : '✅ (correctly null)');
  console.log(`${status} "${url}" → ${result}`);
});

// ─── 2. Test Voyager Dash API ───────────────────────────────────────────────
async function testEndpoint(username) {
  if (!LI_AT || !JSESSIONID) {
    console.error('\n❌ LI_AT or JSESSIONID not set in .env file.');
    process.exit(1);
  }

  const csrfToken = JSESSIONID.replace(/"/g, '');

  const headers = {
    'Cookie': `li_at=${LI_AT}; JSESSIONID="${csrfToken}";`,
    'csrf-token': csrfToken,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'application/vnd.linkedin.normalized+json+2.1',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-RestLi-Protocol-Version': '2.0.0',
    'X-Li-Lang': 'en_US',
    'X-Li-Track': '{"clientVersion":"1.13.12094","mpVersion":"1.13.12094","osName":"web","timezoneOffset":5.5}',
  };

  const endpoints = [
    {
      name: 'Dash API (primary)',
      url: `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${username}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93`,
    },
    {
      name: 'GraphQL (fallback)',
      url: `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(publicIdentifier:${username})&queryId=voyagerIdentityDashProfiles.2e10090751e01a2c1cad1a9ece040958`,
    },
    {
      name: 'Old profileView (should be 410)',
      url: `https://www.linkedin.com/voyager/api/identity/profiles/${username}/profileView`,
    }
  ];

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`TEST 2 — Voyager API Endpoints for: "${username}"`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  for (const endpoint of endpoints) {
    console.log(`\n[${endpoint.name}]`);
    console.log(`URL: ${endpoint.url}`);
    try {
      const res = await fetch(endpoint.url, { method: 'GET', headers });
      console.log(`Status: ${res.status} ${res.statusText}`);
      console.log(`Content-Type: ${res.headers.get('content-type')}`);

      const text = await res.text();

      if (res.ok) {
        try {
          const json = JSON.parse(text);
          const outPath = path.join(__dirname, `sample_${username}_${endpoint.name.replace(/\s+/g,'_')}.json`);
          fs.writeFileSync(outPath, JSON.stringify(json, null, 2));
          console.log(`✅ SUCCESS! Saved to: ${outPath}`);

          // Quick peek at top-level keys
          console.log(`   Top-level keys: ${Object.keys(json).join(', ')}`);
          if (json.elements) console.log(`   elements count: ${json.elements.length}`);
          if (json.included) console.log(`   included count: ${json.included.length}`);
        } catch {
          console.log(`❌ Response was not valid JSON. First 500 chars:`);
          console.log(text.substring(0, 500));
        }
      } else {
        console.log(`❌ FAILED. Response body (first 300 chars):`);
        console.log(text.substring(0, 300));
      }
    } catch (err) {
      console.log(`❌ Network error: ${err.message}`);
    }

    // Small delay between endpoint tests to avoid rate limiting
    await new Promise(r => setTimeout(r, 1500));
  }
}

// ─── Run ────────────────────────────────────────────────────────────────────
const targetUsername = process.argv[2] || 'williamhgates';

(async () => {
  await testEndpoint(targetUsername);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Done. Check research/ folder for saved JSON files.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
})();
