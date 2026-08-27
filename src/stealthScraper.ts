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
  await page.goto('https://www.linkedin.com/login', {
    waitUntil: 'networkidle',
    timeout: 45000,
  });

  // Dismiss cookie consent banner if it appears (EU/India region)
  try {
    const cookieBtn = page.locator('button[action-type="ACCEPT"]').first();
    await cookieBtn.waitFor({ timeout: 3000 });
    await cookieBtn.click();
    console.log('[Session] Dismissed cookie consent banner.');
    await page.waitForTimeout(500);
  } catch { /* no cookie banner — that's fine */ }

  // Try multiple selector patterns LinkedIn uses across regions/A-B tests
  const emailSelectors = ['#username', 'input[name="session_key"]', 'input[autocomplete="username"]'];
  let emailFilled = false;
  for (const sel of emailSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 8000 });
      // Type like a human — character by character with small delays
      await page.click(sel);
      await page.type(sel, email, { delay: 60 + Math.random() * 60 });
      emailFilled = true;
      console.log(`[Session] Filled email using selector: ${sel}`);
      break;
    } catch { /* try next */ }
  }

  if (!emailFilled) {
    // Save a debug screenshot so we can see what page loaded
    await page.screenshot({ path: 'research/login_debug.png', fullPage: true });
    await page.close(); await ctx.close();
    throw new Error(
      'Could not find the LinkedIn email input field. A debug screenshot was saved to research/login_debug.png. ' +
      'LinkedIn may be showing a CAPTCHA or checkpoint — please log in manually from your browser once to clear it.'
    );
  }

  // Fill password
  const passSelectors = ['#password', 'input[name="session_password"]', 'input[type="password"]'];
  for (const sel of passSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 5000 });
      await page.click(sel);
      await page.type(sel, password, { delay: 50 + Math.random() * 70 });
      break;
    } catch { /* try next */ }
  }

  // Human-like pause before submit
  await page.waitForTimeout(1000 + Math.random() * 800);

  // Click the sign-in button
  const submitSelectors = [
    '[data-litms-control-urn="login-submit"]',
    'button[type="submit"]',
    '.login__form_action_container button',
  ];
  for (const sel of submitSelectors) {
    try {
      await page.click(sel, { timeout: 5000 });
      break;
    } catch { /* try next */ }
  }

  // Wait for feed — confirms successful login
  try {
    await page.waitForURL('**/feed/**', { timeout: 25000 });
    console.log('[Session] ✅ Login successful!');
  } catch {
    const url = page.url();
    await page.screenshot({ path: 'research/login_debug.png', fullPage: true });
    await page.close(); await ctx.close();
    if (url.includes('checkpoint') || url.includes('challenge')) {
      throw new Error(
        'LinkedIn is showing a security checkpoint/CAPTCHA. ' +
        'Please log in manually in your browser once to clear it, then restart the server. ' +
        'A debug screenshot was saved to research/login_debug.png'
      );
    }
    throw new Error(
      `Login failed — unexpected redirect to: ${url}. ` +
      `Check research/login_debug.png for a screenshot of the current page.`
    );
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
