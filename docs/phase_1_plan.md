# Phase 1: Research & Reverse Engineering Plan

## Objective
The goal of this phase is to establish the methodology for fetching profile data from LinkedIn without using a headless browser, by directly calling the internal Voyager API.

## Tasks to be completed in this phase
1. **Create Environment Setup:**
   - Create a `.env.example` file that outlines the required cookies (`LI_AT` and `JSESSIONID`) needed for authentication. This serves as a template so sensitive credentials aren't committed.

2. **Initialize Project:**
   - Run `npm init -y` to set up `package.json`.
   - Install `dotenv` to load the `.env` variables.
   - Create a `.gitignore` to prevent committing `node_modules` and `.env`.

3. **Develop a Research/Test Script:**
   - Create a simple Node.js script (`research/test_voyager.js`) using native `fetch`.
   - The script will take the cookies from a local `.env` file and make a request to a known LinkedIn Voyager API endpoint for a specific profile (e.g., `williamhgates`).
   - It will save the raw JSON response to a file (`research/sample_response.json`) so we can analyze the schema for Phase 3 (Data Transformation).

## How it works
The `test_voyager.js` script mimics a browser request by including the `Cookie` header (with your actual logged-in session cookies) and the `csrf-token` header. LinkedIn's backend will treat it as a legitimate request from your web browser and return the structured JSON data natively.

## Next Steps (After this phase is merged)
Once this branch is merged to `main`, you will need to:
1. Copy `.env.example` to `.env`.
2. Retrieve your `li_at` and `JSESSIONID` cookies from your browser session (by logging into LinkedIn, opening DevTools -> Application -> Cookies).
3. Run `node research/test_voyager.js` locally to generate the `sample_response.json` for us to analyze in the next phase.
