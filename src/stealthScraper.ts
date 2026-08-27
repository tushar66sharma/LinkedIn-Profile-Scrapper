import { chromium } from 'playwright-extra';
import StealthPlugin from 'playwright-extra-plugin-stealth';

// Register the stealth plugin — patches all fingerprinting APIs
chromium.use(StealthPlugin());

let browserInstance: import('playwright').Browser | null = null;

async function getBrowser(): Promise<import('playwright').Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }
  console.log('[Stealth] Launching Chromium with stealth plugin...');
  browserInstance = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ]
  });
  console.log('[Stealth] Chromium launched.');
  return browserInstance;
}

export async function stealthFetchProfile(username: string, liAt: string, jsessionid: string): Promise<any> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'Asia/Kolkata',
    viewport: { width: 1920, height: 1080 },
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });

  // Inject LinkedIn session cookies into the browser context
  await context.addCookies([
    {
      name: 'li_at',
      value: liAt,
      domain: '.linkedin.com',
      path: '/',
      httpOnly: true,
      secure: true,
    },
    {
      name: 'JSESSIONID',
      value: `"${jsessionid}"`,
      domain: '.linkedin.com',
      path: '/',
      httpOnly: false,
      secure: true,
    }
  ]);

  const page = await context.newPage();

  let interceptedData: any = null;

  // Intercept Voyager API network responses directly from the browser
  await page.route('**/voyager/api/identity/dash/profiles**', async (route) => {
    const response = await route.fetch();
    try {
      const body = await response.json();
      interceptedData = body;
      console.log('[Stealth] Intercepted Voyager API response!');
    } catch {
      // Not JSON, ignore
    }
    await route.fulfill({ response });
  });

  console.log(`[Stealth] Navigating to: https://www.linkedin.com/in/${username}/`);
  try {
    await page.goto(`https://www.linkedin.com/in/${username}/`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });
  } catch (e) {
    console.warn('[Stealth] Page load timeout or error — checking for intercepted data...');
  }

  await context.close();

  if (interceptedData) {
    return interceptedData;
  }

  // Fallback: Extract JSON-LD from the page HTML
  console.log('[Stealth] No intercepted API data — extracting JSON-LD from page HTML...');
  const html = await page.content().catch(() => '');

  const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  if (jsonLdMatches && jsonLdMatches.length > 0) {
    const parsed: any[] = [];
    for (const m of jsonLdMatches) {
      try {
        parsed.push(JSON.parse(m.replace(/<script type="application\/ld\+json">/, '').replace(/<\/script>/, '')));
      } catch { /* skip */ }
    }
    if (parsed.length > 0) {
      return { __source: 'jsonld', jsonld: parsed };
    }
  }

  // Check if we were redirected to the login/authwall page
  const currentUrl = page.url();
  if (currentUrl.includes('authwall') || currentUrl.includes('login')) {
    throw new Error('LinkedIn redirected to login. Cookies may be expired.');
  }

  throw new Error(`Stealth scraper could not extract data for profile "${username}".`);
}

// Graceful shutdown
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
