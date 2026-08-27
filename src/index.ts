import 'dotenv/config'; // Make sure to load env vars first
import express, { Request, Response } from 'express';
import cors from 'cors';
import { extractUsername } from './utils';
import { fetchProfileData } from './scraper';
import { mapVoyagerResponse } from './mapper';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'success',
    message: 'LinkedIn Profile Scraper API is running!',
  });
});

// Profile Scraping Endpoint
app.get('/api/profile', async (req: Request, res: Response) => {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Please provide a valid LinkedIn URL as a query parameter (?url=...)' });
  }

  const username = extractUsername(url);
  
  if (!username) {
    return res.status(400).json({ error: 'Invalid LinkedIn URL format. Could not extract profile username.' });
  }

  try {
    // 1. Fetch raw data from Voyager API
    const rawData = await fetchProfileData(username);
    
    // 2. Map and clean the data
    const cleanedData = mapVoyagerResponse(rawData);
    
    // 3. Return structured JSON
    return res.json({
      status: 'success',
      data: cleanedData
    });
  } catch (error: any) {
    console.error("API Error:", error.message);
    const status = error.message.includes('authentication') ? 401 : (error.message.includes('not found') ? 404 : 500);
    return res.status(status).json({
      status: 'error',
      message: error.message || 'An unexpected error occurred while fetching profile data.'
    });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
