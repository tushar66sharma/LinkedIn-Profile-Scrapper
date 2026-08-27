import { chromium, type Browser } from 'playwright';

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) return browserInstance;

  console.log('[Stealth] Launching Chromium...');
  browserInstance = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
    ],
  });
  console.log('[Stealth] Browser ready.');
  return browserInstance;
}

/**
 * Manually patch all fingerprinting APIs that LinkedIn/Akamai check.
 * This is equivalent to puppeteer-extra-plugin-stealth but works with
 * vanilla Playwright (no broken plugin needed).
 */
async function applyStealthPatches(page: import('playwright').Page): Promise<void> {
  await page.addInitScript(() => {
    // 1. Remove navigator.webdriver flag
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // 2. Fake plugin list (empty = headless giveaway)
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const arr: any = [
          { name: 'Chrome PDF Plugin',   filename: 'internal-pdf-viewer',             description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer',   filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client',       filename: 'internal-nacl-plugin',             description: '' },
        ];
        arr.item      = (i: number) => arr[i];
        arr.namedItem = (n: string) => arr.find((p: any) => p.name === n) ?? null;
        arr.refresh   = () => {};
        return arr;
      },
    });

    // 3. Realistic language list
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

    // 4. Inject window.chrome runtime
    (window as any).chrome = {
      runtime:    {},
      app:        {},
      csi:        () => {},
      loadTimes:  () => {},
    };

    // 5. Fix permissions.query for 'notifications'
    const _origQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (params: PermissionDescriptor) =>
      params.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
        : _origQuery(params);

    // 6. Realistic screen/hardware concurrency
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory',        { get: () => 8 });
    Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
  });
}

export async function stealthFetchProfile(
  username: string,
  liAt: string,
  jsessionid: string
): Promise<any> {
  const browser = await getBrowser();

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'Asia/Kolkata',
    viewport: { width: 1920, height: 1080 },
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  });

  // Inject session cookies so LinkedIn sees us as logged in
  await context.addCookies([
    { name: 'li_at',      value: liAt,              domain: '.linkedin.com', path: '/', httpOnly: true,  secure: true },
    { name: 'JSESSIONID', value: `"${jsessionid}"`, domain: '.linkedin.com', path: '/', httpOnly: false, secure: true },
  ]);

  const page = await context.newPage();
  await applyStealthPatches(page);

  let interceptedData: any = null;

  // Intercept the Voyager API response that LinkedIn fetches when the profile page loads
  await page.route('**/voyager/api/identity/dash/profiles**', async (route) => {
    const response = await route.fetch();
    try {
      interceptedData = await response.json();
      console.log('[Stealth] ✅ Intercepted Voyager API response from browser!');
    } catch { /* not JSON */ }
    await route.fulfill({ response });
  });

  console.log(`[Stealth] Navigating to linkedin.com/in/${username}/`);
  try {
    await page.goto(`https://www.linkedin.com/in/${username}/`, {
      waitUntil: 'networkidle',
      timeout: 35000,
    });
  } catch {
    console.warn('[Stealth] Navigation timeout — checking for intercepted data anyway...');
  }

  await context.close();

  if (interceptedData) return interceptedData;

  // Fallback: Parse JSON-LD from the rendered HTML
  const html = await page.content().catch(() => '');
  const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);

  if (jsonLdMatches?.length) {
    const parsed: any[] = [];
    for (const m of jsonLdMatches) {
      try {
        parsed.push(
          JSON.parse(m.replace(/<script type="application\/ld\+json">/, '').replace(/<\/script>/, ''))
        );
      } catch { /* skip malformed */ }
    }
    if (parsed.length) {
      console.log('[Stealth] ✅ Extracted JSON-LD from rendered page.');
      return { __source: 'jsonld', jsonld: parsed };
    }
  }

  const currentUrl = page.url();
  if (currentUrl.includes('authwall') || currentUrl.includes('login')) {
    throw new Error('LinkedIn redirected to login. Cookies may be expired.');
  }

  throw new Error(`Stealth scraper could not extract data for "${username}".`);
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
