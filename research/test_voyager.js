require('dotenv').config();
const fs = require('fs');

const LI_AT = process.env.LI_AT;
const JSESSIONID = process.env.JSESSIONID;

if (!LI_AT || !JSESSIONID) {
  console.error("Error: LI_AT and JSESSIONID must be set in the .env file");
  process.exit(1);
}

// Ensure JSESSIONID is formatted correctly for the csrf-token (needs exact match, sometimes wrapped in quotes in the cookie)
const csrfToken = JSESSIONID.replace(/"/g, '');

const PROFILE_USERNAME = "williamhgates"; // Example profile to test

async function testVoyagerAPI() {
  const url = `https://www.linkedin.com/voyager/api/identity/profiles/${PROFILE_USERNAME}/profileView`;
  
  console.log(`Fetching data for ${PROFILE_USERNAME}...`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cookie': `li_at=${LI_AT}; JSESSIONID="${csrfToken}";`,
        'csrf-token': csrfToken,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'X-RestLi-Protocol-Version': '2.0.0'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    
    // Save to file for analysis
    fs.writeFileSync('research/sample_response.json', JSON.stringify(data, null, 2));
    console.log("Success! Data saved to research/sample_response.json");
    
  } catch (error) {
    console.error("Failed to fetch data:", error.message);
  }
}

testVoyagerAPI();
