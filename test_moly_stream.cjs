const axios = require('axios');

async function testMolyStream() {
  const url = 'https://box-1445-o10.vmeas.cloud/hls2/03/01417/vz1m7a4x988b_,n,l,.urlset/master.m3u8?t=28ksskExfz1XOjsZnN-DHTkd3OdHP8Pi4mUTA6gWmJs=&s=1783613730&e=43200&v=&i=0.4&sp=0&asn=15169';
  console.log('Testing Moly stream URL:', url);

  const referers = [
    '',
    'https://vidmoly.net/',
    'https://vidmoly.net/embed-vz1m7a4x988b.html',
    'https://vixcloud.co/',
    'https://vmeas.cloud/',
    'https://streamingcommunity.paris/',
    'https://streamingcommunity.care/',
    'https://toon-stream.site/'
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
      console.log('Body snippet:', typeof res.data === 'string' ? res.data.substring(0, 150) : 'binary data');
      return;
    } catch (e) {
      console.log(`FAILED with Referer "${ref}": ${e.response ? e.response.status : e.message}`);
    }
  }
}

testMolyStream();
