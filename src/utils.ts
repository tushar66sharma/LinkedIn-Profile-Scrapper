export function extractUsername(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // LinkedIn URLs usually look like: https://www.linkedin.com/in/username/ or https://linkedin.com/in/username
    if (!urlObj.hostname.includes('linkedin.com')) {
      return null;
    }
    const paths = urlObj.pathname.split('/').filter(p => p.length > 0);
    if (paths[0] === 'in' && paths.length >= 2) {
      return paths[1];
    }
    return null;
  } catch (error) {
    return null;
  }
}
