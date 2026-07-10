const axios = require('axios');

async function testEmbedReferer() {
  const url = 'https://box-1535-p.vmeas.cloud/hls2/03/02029/5riucmgalq06_n/master.m3u8?t=ZfvA1HAPeCelzx9IpZzxYyP-2qjMvH5q3PV3JcUwj4c=&s=1783605830&e=43200&v=&i=0.4&sp=0&asn=15169';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  const candidates = [
    'https://vixcloud.co/embed/5riucmgalq06',
    'https://vixcloud.co/embed/5riucmgalq06_n',
    'https://vmeas.cloud/embed/5riucmgalq06',
    'https://vmeas.cloud/embed/5riucmgalq06_n',
    'https://vmeas.cloud/video/5riucmgalq06',
    'https://vixcloud.co/video/5riucmgalq06',
    'https://streamingcommunity.care/iframe/5riucmgalq06',
    'https://streamingcommunity.co/iframe/5riucmgalq06',
    'https://streamingcommunity.paris/iframe/5riucmgalq06'
  ];

  for (const ref of candidates) {
    try {
      const u = new URL(ref);
      const testHeaders = {
        ...headers,
        'Referer': ref,
        'Origin': u.origin
      };
      const res = await axios.get(url, { headers: testHeaders, timeout: 3000 });
      console.log('SUCCESS with Referer:', ref);
      console.log('Status:', res.status);
      console.log('Body snippet:', res.data.substring(0, 300));
      return;
    } catch (e) {
      console.log(`Failed for Referer ${ref}: ${e.response ? e.response.status : e.message}`);
    }
  }
}

testEmbedReferer();
