const axios = require('axios');

async function testTurbo() {
  const url = 'https://cdn.turboviplay.com/data3/687f9eb38d6ab/687f9eb38d6ab.m3u8';
  console.log('Testing URL:', url);

  const referers = [
    '',
    'https://toon-stream.site/',
    'https://cdn.turboviplay.com/',
    'https://turboviplay.com/',
    'https://streamingcommunity.paris/'
  ];

  for (const ref of referers) {
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      };
      if (ref) {
        headers['Referer'] = ref;
        headers['Origin'] = new URL(ref).origin;
      }

      const res = await axios.get(url, { headers, timeout: 5000 });
      console.log(`SUCCESS with Referer "${ref}":`);
      console.log('Status:', res.status);
      console.log('Content-Type:', res.headers['content-type']);
      console.log('Body length:', res.data.length);
      console.log('Body snippet:\n', typeof res.data === 'string' ? res.data.substring(0, 500) : 'Stream data');
      return;
    } catch (e) {
      console.log(`FAILED with Referer "${ref}": ${e.response ? e.response.status : e.message}`);
    }
  }
}

testTurbo();
