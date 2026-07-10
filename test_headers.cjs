const axios = require('axios');

async function testBrowserHeaders() {
  const url = 'https://box-1535-p.vmeas.cloud/hls2/03/02029/5riucmgalq06_n/master.m3u8?t=ZfvA1HAPeCelzx9IpZzxYyP-2qjMvH5q3PV3JcUwj4c=&s=1783605830&e=43200&v=&i=0.4&sp=0&asn=15169';
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site'
  };

  const referers = [
    'https://streamingcommunity.paris/',
    'https://streamingcommunity.care/',
    'https://streamingcommunity.co/',
    'https://vixcloud.co/',
    'https://vmeas.cloud/'
  ];

  for (const ref of referers) {
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
      console.log(`Failed with Referer ${ref}: ${e.response ? e.response.status : e.message}`);
    }
  }
}

testBrowserHeaders();
