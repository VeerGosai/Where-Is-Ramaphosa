const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

(async () => {
    try {
        // Fetch the webpage
        const response = await axios.get('https://www.flightaware.com/live/flight/LMG1');
        const html = response.data;

        // Load the HTML into Cheerio
        const $ = cheerio.load(html);

        // Extract the destination data
        const destination = $(
            '#flightPageTourStep1 > div.flightPageSummaryAirports.flightPageAviatorView > div.flightPageSummaryDestination > span.flightPageSummaryAirportCode > span > a'
        ).text();

        // Save the destination to a JSON file
        const data = { destination, lastUpdated: new Date().toISOString() };
        fs.writeFileSync('data.json', JSON.stringify(data, null, 2));

        console.log('Scraping successful:', data);
    } catch (error) {
        console.error('Error during scraping:', error);
        process.exit(1);
    }
})();
