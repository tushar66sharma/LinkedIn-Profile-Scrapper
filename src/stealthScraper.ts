import { chromium, type Browser, type BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// ── Session state file path ────────────────────────────────────────────────
const SESSION_PATH = path.join(process.cwd(), '.linkedin_session.json');

let browser: Browser | null = null;
let context: BrowserContext | null = null;

// ── Stealth patches applied on every new page ─────────────────────────────
async function applyStealthPatches(page: import('playwright').Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

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

    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

    (window as any).chrome = { runtime: {}, app: {}, csi: () => {}, loadTimes: () => {} };

    const _origQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (params: PermissionDescriptor) =>
      params.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
        : _origQuery(params);
  });
}

async function getBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) return browser;
  console.log('[Session] Launching Chromium...');
  browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage', '--no-first-run',
    ],
  });
  return browser;
}

// ── Login via real credentials and save session to file ───────────────────
async function loginAndSaveSession(): Promise<BrowserContext> {
  const email    = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'LINKEDIN_EMAIL and LINKEDIN_PASSWORD must be set in your .env file for auto-login mode.'
    );
  }

  const b = await getBrowser();
  const ctx = await b.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'Asia/Kolkata',
    viewport: { width: 1920, height: 1080 },
  });

  const page = await ctx.newPage();
  await applyStealthPatches(page);

  console.log('[Session] Navigating to LinkedIn login page...');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

  // Fill in credentials
  await page.fill('#username', email);
  await page.fill('#password', password);

  // Random delay before clicking sign in (mimics human typing pause)
  await page.waitForTimeout(800 + Math.random() * 700);

  await page.click('[data-litms-control-urn="login-submit"]');

  // Wait for redirect to the feed (successful login)
  try {
    await page.waitForURL('**/feed/**', { timeout: 20000 });
    console.log('[Session] ✅ Login successful!');
  } catch {
    // Check if it's a checkpoint / CAPTCHA page
    const url = page.url();
    if (url.includes('checkpoint') || url.includes('challenge')) {
      await page.close();
      await ctx.close();
      throw new Error(
        'LinkedIn is showing a security checkpoint/CAPTCHA. ' +
        'Please log in manually in a browser once to clear it, then try again.'
      );
    }
    throw new Error(`Login failed — redirected to: ${url}`);
  }

  // Save the full browser state (cookies + localStorage) to a file
  const storageState = await ctx.storageState();
  fs.writeFileSync(SESSION_PATH, JSON.stringify(storageState, null, 2));
  console.log(`[Session] Session saved to: ${SESSION_PATH}`);

  await page.close();
  return ctx;
}

// ── Get or create a valid browser context ─────────────────────────────────
export async function getSessionContext(): Promise<BrowserContext> {
  if (context) return context;

  const b = await getBrowser();

  // Load saved session if it exists
  if (fs.existsSync(SESSION_PATH)) {
    console.log('[Session] Loading saved session from file...');
    context = await b.newContext({
      storageState: SESSION_PATH,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'Asia/Kolkata',
      viewport: { width: 1920, height: 1080 },
    });

    // Quick validation: check if session is still alive
    const page = await context.newPage();
    await applyStealthPatches(page);
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    const url = page.url();
    await page.close();

    if (url.includes('authwall') || url.includes('login') || url.includes('checkpoint')) {
      console.warn('[Session] Saved session is expired — re-logging in...');
      fs.unlinkSync(SESSION_PATH);
      await context.close();
      context = null;
      context = await loginAndSaveSession();
    } else {
      console.log('[Session] ✅ Saved session is valid and active.');
    }
  } else {
    // No session file — must log in fresh
    console.log('[Session] No saved session found — performing fresh login...');
    context = await loginAndSaveSession();
  }

  return context!;
}

// ── Main stealth fetch function ────────────────────────────────────────────
export async function stealthFetchProfile(username: string): Promise<any> {
  const ctx = await getSessionContext();
  const page = await ctx.newPage();
  await applyStealthPatches(page);

  let interceptedData: any = null;

  // Intercept the Voyager API call LinkedIn makes when loading a profile page
  await page.route('**/voyager/api/identity/dash/profiles**', async (route) => {
    const response = await route.fetch();
    try {
      interceptedData = await response.json();
      console.log('[Stealth] ✅ Intercepted Voyager API response!');
    } catch { /* not JSON */ }
    await route.fulfill({ response });
  });

  console.log(`[Stealth] Navigating to profile: ${username}`);
  try {
    await page.goto(`https://www.linkedin.com/in/${username}/`, {
      waitUntil: 'networkidle',
      timeout: 35000,
    });
  } catch {
    console.warn('[Stealth] Page load timeout — checking for intercepted data...');
  }

  await page.close();

  if (interceptedData) return interceptedData;

  // Fallback: Extract JSON-LD from the rendered page HTML
  const html = await page.content().catch(() => '');
  const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  if (jsonLdMatches?.length) {
    const parsed: any[] = [];
    for (const m of jsonLdMatches) {
      try {
        parsed.push(JSON.parse(m.replace(/<script type="application\/ld\+json">/, '').replace(/<\/script>/, '')));
      } catch { /* skip */ }
    }
    if (parsed.length) {
      console.log('[Stealth] ✅ Extracted JSON-LD from rendered page.');
      return { __source: 'jsonld', jsonld: parsed };
    }
  }

  throw new Error(`Could not extract data for profile "${username}". The profile may be private.`);
}

// ── Invalidate session (called if we detect a 401 or authwall) ────────────
export function invalidateSession(): void {
  if (fs.existsSync(SESSION_PATH)) {
    fs.unlinkSync(SESSION_PATH);
    console.log('[Session] Session file deleted — will re-login on next request.');
  }
  context = null;
}

export async function closeBrowser(): Promise<void> {
  if (browser) { await browser.close(); browser = null; context = null; }
}
