const axios = require('axios');

async function testSubPlaylist() {
  const url = 'https://g250.turbosplayer.com/file/b7037a31-8247-4668-956e-9ff77e0b0025/master.m3u8';
  console.log('Testing sub-playlist URL:', url);

  const referers = [
    '',
    'https://toon-stream.site/',
    'https://cdn.turboviplay.com/',
    'https://turboviplay.com/',
    'https://turbosplayer.com/',
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
      console.log('Body snippet:\n', typeof res.data === 'string' ? res.data.substring(0, 300) : 'Stream data');
      return;
    } catch (e) {
      console.log(`FAILED with Referer "${ref}": ${e.response ? e.response.status : e.message}`);
    }
  }
}

testSubPlaylist();
