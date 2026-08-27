# Phase 2: Backend Architecture & Setup Plan

## Objective
The goal of this phase is to set up a robust, scalable backend environment using Node.js, Express, and TypeScript. This will serve as the foundation for the API we will build in the next phase.

## Tasks to be completed in this phase
1. **Initialize TypeScript & Express Environment:**
   - Install core production dependencies: `express`, `cors`.
   - Install development dependencies: `typescript`, `@types/node`, `@types/express`, and `ts-node-dev` (for hot reloading during development).
   - Generate a `tsconfig.json` to configure TypeScript compilation (targeting modern ES and Node standards).

2. **Setup Basic Server Boilerplate:**
   - Create a `src/` directory to hold all application code.
   - Create `src/index.ts` to initialize an Express web server.
   - Configure basic middleware: `cors()` for cross-origin requests, `express.json()` for parsing JSON payloads, and basic error handling.
   - Create a simple health-check endpoint (`GET /`) to ensure the server is running.

3. **Update NPM Scripts:**
   - Modify `package.json` to include:
     - `"dev": "ts-node-dev --respawn --transpile-only src/index.ts"` (for local development).
     - `"build": "tsc"` (for compiling TypeScript to JavaScript for production deployment).
     - `"start": "node dist/index.js"` (for running the production build).

## How it works
By using TypeScript, we get strict typing, which is crucial when we deal with the massive, unstructured JSON coming from the Voyager API in Phase 3. Express provides a very lightweight framework to expose our scraping logic over HTTPS. `ts-node-dev` allows us to test our code without manually recompiling it every time we make a change.

## Next Steps (After this phase is merged)
Once this branch is merged to `main`, you can run `npm run dev` locally. You should see a message saying "Server is running on port 3000". If you visit `http://localhost:3000` in your browser, you will see a health check message. Then we will proceed to Phase 3 where the actual core scraping logic will be integrated into the server.
