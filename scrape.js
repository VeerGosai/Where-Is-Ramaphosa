const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({
        headless: true, // Set to false for debugging
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    try {
        // Set a realistic User-Agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

        // Navigate to the target URL
        await page.goto('https://www.flightaware.com/live/flight/LMG1', {
            waitUntil: 'networkidle2',
        });

        // Scrape the destination
        const destination = await page.$eval('.destinationCity', el => el.textContent.trim());

        const data = { destination, lastUpdated: new Date().toISOString() };
        fs.writeFileSync('data.json', JSON.stringify(data, null, 2));

        console.log('Scraping successful:', data);
    } catch (error) {
        console.error('Error during scraping:', error.message);
    } finally {
        await browser.close();
    }
})();
