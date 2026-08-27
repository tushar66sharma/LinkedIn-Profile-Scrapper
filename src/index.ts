import 'dotenv/config'; // Make sure to load env vars first
import express, { Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { extractUsername } from './utils';
import { fetchProfileData } from './scraper';
import { mapVoyagerResponse } from './mapper';

const app = express();
const PORT = process.env.PORT || 3000;

// Rate Limiter Setup (Max 30 requests per 15 minutes per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 30, 
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(limiter);

// Serve static frontend files from /public
app.use(express.static(path.join(__dirname, '..', 'public')));

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
    const msg: string = error.message || 'An unexpected error occurred.';
    console.error('[API Error]', msg);

    let httpStatus = 500;
    if (msg.includes('authentication failed'))   httpStatus = 401;
    else if (msg.includes('not found'))          httpStatus = 404;
    else if (msg.includes('rate limit'))         httpStatus = 429;
    else if (msg.includes('temporarily blocking')) httpStatus = 503;

    return res.status(httpStatus).json({
      status: 'error',
      message: msg
    });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
