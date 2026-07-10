const axios = require('axios');

async function testIPHeaders() {
  const url = 'https://box-1535-p.vmeas.cloud/hls2/03/02029/5riucmgalq06_n/master.m3u8?t=ZfvA1HAPeCelzx9IpZzxYyP-2qjMvH5q3PV3JcUwj4c=&s=1783605830&e=43200&v=&i=0.4&sp=0&asn=15169';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  const ipScenarios = [
    { 'X-Forwarded-For': '127.0.0.1' },
    { 'CF-Connecting-IP': '8.8.8.8' },
    { 'X-Forwarded-For': '8.8.8.8' },
    { 'X-Real-IP': '8.8.8.8' },
    { 'True-Client-IP': '8.8.8.8' },
    // Google's public DNS or general IPs
    { 'X-Forwarded-For': '1.1.1.1', 'CF-Connecting-IP': '1.1.1.1' }
  ];

  for (const scenario of ipScenarios) {
    try {
      const mergedHeaders = { ...headers, ...scenario };
      const res = await axios.get(url, { headers: mergedHeaders, timeout: 3000 });
      console.log('SUCCESS with headers:', scenario);
      console.log('Status:', res.status);
      console.log('Body snippet:', res.data.substring(0, 200));
      return;
    } catch (e) {
      console.log(`Failed for headers ${JSON.stringify(scenario)}: ${e.response ? e.response.status : e.message}`);
    }
  }
}

testIPHeaders();
