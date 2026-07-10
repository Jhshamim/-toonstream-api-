const axios = require('axios');

async function testReferer(ref, orig) {
  const url = 'https://box-1535-p.vmeas.cloud/hls2/03/02029/5riucmgalq06_n/master.m3u8?t=ZfvA1HAPeCelzx9IpZzxYyP-2qjMvH5q3PV3JcUwj4c=&s=1783605830&e=43200&v=&i=0.4&sp=0&asn=15169';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };
  if (ref) headers['Referer'] = ref;
  if (orig) headers['Origin'] = orig;

  try {
    const res = await axios.get(url, { headers, timeout: 3000 });
    return { ref, orig, status: res.status, success: true, bodyLength: res.data.length };
  } catch (e) {
    return { ref, orig, status: e.response ? e.response.status : 'ERR', success: false };
  }
}

async function main() {
  const exts = [
    'be', 'co', 'la', 'tv', 'me', 'parts', 'space', 'club', 'buzz', 'onl', 'work', 'vet', 'sh', 
    'cz', 'rip', 'best', 'io', 'cc', 'org', 'top', 'pro', 'vip', 'fun', 'link', 'icu', 'today', 
    'world', 'computer', 'paris', 'care', 'network', 'site', 'online', 'store', 'agency', 'center', 
    'digital', 'services', 'tech', 'cloud', 'cafe', 'click', 'city', 'press', 'live', 'studio', 
    'vipc', 'rocks', 'cool', 'expert', 'media', 'website', 'chat', 'team', 'zone', 'host', 'uno', 
    'fit', 'bid', 'ink', 'lol', 'mom', 'pub', 'red', 'run', 'sex', 'tax', 'win', 'xyz', 'com', 
    'net', 'org', 'it', 'ch', 'de', 'at', 'fr', 'es', 'uk', 'eu', 'us', 'ca', 'ru', 'pl', 'nl', 
    'se', 'no', 'dk', 'fi', 'pt', 'gr', 'hu', 'ro', 'bg', 'hr', 'sk', 'si', 'ee', 'lv', 'lt', 
    'is', 'lu', 'ie', 'mt', 'cy', 'il', 'tr'
  ];

  const referers = [];
  exts.forEach(ext => {
    referers.push(`https://streamingcommunity.${ext}/`);
    referers.push(`https://vixcloud.${ext}/`);
    referers.push(`https://vmeas.${ext}/`);
  });

  // Also include general sites
  referers.push('https://toon-stream.site/');
  referers.push('https://animesaturn.tv/');
  referers.push('https://animesaturn.it/');
  referers.push('https://animeunity.to/');
  referers.push('https://animeworld.so/');

  console.log(`Starting massive probe of ${referers.length} referers...`);
  
  // We chunk the requests to avoid hitting limits or socket fatigue
  const chunkSize = 25;
  const successes = [];

  for (let i = 0; i < referers.length; i += chunkSize) {
    const chunk = referers.slice(i, i + chunkSize);
    const promises = chunk.map(ref => {
      let orig = '';
      try {
        const u = new URL(ref);
        orig = u.origin;
      } catch(err) {}
      return testReferer(ref, orig);
    });

    console.log(`Probing batch ${Math.floor(i / chunkSize) + 1}/${Math.ceil(referers.length / chunkSize)}...`);
    const results = await Promise.all(promises);
    results.forEach(r => {
      if (r.success) {
        successes.push(r);
      }
    });
  }

  console.log('Success Count:', successes.length);
  if (successes.length > 0) {
    console.log('SUCCESSFUL REFERERS:');
    successes.forEach(s => {
      console.log(`Referer: ${s.ref} | Origin: ${s.orig} | Status: ${s.status} | BodyLength: ${s.bodyLength}`);
    });
  } else {
    console.log('All candidates returned 403 or error.');
  }
}

main();
