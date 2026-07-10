const axios = require('axios');
const cheerio = require('cheerio');

async function testScrape() {
  const query = 'one piece';
  console.log('Searching for:', query);

  try {
    const searchRes = await axios.get(`https://toon-stream.site/s?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(searchRes.data);
    const firstResult = $('article, .item, .post, .result-item, .box-anime').first();
    const link = firstResult.find('a').first().attr('href');
    if (!link) {
      console.log('No search results found.');
      return;
    }

    const animeId = link.split('/').filter(Boolean).pop();
    console.log(`Found anime ID: ${animeId} from link: ${link}`);

    // Fetch season/episode list
    console.log('\nFetching season/episodes...');
    const epsUrl = `https://toon-stream.site/series/${animeId}/season/1`;
    const epsRes = await axios.get(epsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const $eps = cheerio.load(epsRes.data);
    const firstEp = $eps('li article').first();
    const epLink = firstEp.find('a.lnk-blk').attr('href');
    if (!epLink) {
      console.log('No episodes found on season page, checking main page...');
      return;
    }

    const epId = epLink.split('/').filter(Boolean).pop();
    console.log(`Found episode ID: ${epId} from link: ${epLink}`);

    // Fetch streaming options for this episode
    console.log('\nFetching stream options for episode ID:', epId);
    const streamUrl = `https://toon-stream.site/episode/${epId}`;
    const streamRes = await axios.get(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const $stream = cheerio.load(streamRes.data);
    console.log('Video options HTML present:', $stream('.video-options').length > 0);
    
    const servers = [];
    $stream('.video-options .aa-tbs-video li').each((_, liEl) => {
      const aEl = $stream(liEl).find('a');
      const href = aEl.attr('href') || '';
      if (href.startsWith('#')) {
        const optionId = href.substring(1);
        const serverNum = aEl.find('span').first().text().trim();
        const serverName = aEl.find('.server').text().trim() || `Server ${serverNum}`;
        const iframeEl = $stream(`#${optionId} iframe`);
        const embedUrl = iframeEl.attr('src') || iframeEl.attr('data-src') || '';
        
        servers.push({
          name: serverName,
          number: serverNum,
          embedUrl
        });
      }
    });

    console.log('\nExtracted Server List:');
    console.log(JSON.stringify(servers, null, 2));

  } catch (err) {
    console.log('Error:', err.message);
  }
}

testScrape();
