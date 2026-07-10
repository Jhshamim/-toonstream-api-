const axios = require('axios');
const cheerio = require('cheerio');

async function testEmbeds() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://toon-stream.site/'
  };

  const embeds = [
    { name: 'Moly', url: 'https://toon-stream.site/embed/184b28a3f61b2a7d' },
    { name: 'Turbo', url: 'https://toon-stream.site/embed/c2e447966c6f9d2f' }
  ];

  for (const embed of embeds) {
    console.log(`\n--- Fetching ${embed.name} embed page: ${embed.url} ---`);
    try {
      const res = await axios.get(embed.url, { headers, timeout: 5000 });
      console.log('Status:', res.status);
      const $ = cheerio.load(res.data);
      const iframeSrc = $('.Video iframe, iframe').first().attr('src');
      console.log('Iframe src:', iframeSrc);
      
      // Let's print the entire body text to see what scripts or links are there if there is no iframe
      if (!iframeSrc) {
        console.log('No iframe found! Printing HTML snippet:');
        console.log(res.data.substring(0, 1000));
      }
    } catch (e) {
      console.log('Failed:', e.response ? e.response.status : e.message);
    }
  }
}

testEmbeds();
