const axios = require('axios');

async function testLh3WithHeaders() {
  const url = 'https://lh3.googleusercontent.com/d/1Olz51hmozhN3wjF0qO73SVUpirZ5_hfe=d';
  console.log('Testing LH3 URL with Referer/Origin headers...');

  const configs = [
    { name: 'No referer/origin', r: '', o: '' },
    { name: 'With turboviplay referer/origin', r: 'https://cdn.turboviplay.com/', o: 'https://cdn.turboviplay.com' },
    { name: 'With toon-stream referer/origin', r: 'https://toon-stream.site/', o: 'https://toon-stream.site' }
  ];

  for (const config of configs) {
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      };
      if (config.r) headers['Referer'] = config.r;
      if (config.o) headers['Origin'] = config.o;

      const res = await axios.get(url, { headers, timeout: 5000, responseType: 'arraybuffer' });
      console.log(`Config [${config.name}]: SUCCESS (Status: ${res.status}, Content-Type: ${res.headers['content-type']}, Content-Length: ${res.headers['content-length']})`);
    } catch (e) {
      console.log(`Config [${config.name}]: FAILED (Status: ${e.response ? e.response.status : 'ERR'}, Message: ${e.message})`);
    }
  }
}

testLh3WithHeaders();
