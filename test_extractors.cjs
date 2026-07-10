const axios = require('axios');

function unpack(p) {
  // Simple unpacker mock/implementation just for our local test
  try {
    const fnStr = p.trim();
    if (!fnStr.startsWith('eval(')) return p;
    // Extract the arguments to the function (p,a,c,k,e,d)
    const matches = fnStr.match(/}\((.*)\)\s*$/);
    if (!matches) return p;
    const args = eval(`[${matches[1]}]`);
    const unpacked = (function(p,a,c,k,e,d){
      e = function(c){return (c<a?'':e(parseInt(c/a)))+((c=c%a)>35?String.fromCharCode(c+29):c.toString(36))};
      if(!''.replace(/^/,String)){
        while(c--){d[e(c)]=k[c]||e(c)}
        k=[function(e){return d[e]}];
        e=function(){return'\\w+'};
        c=1;
      };
      while(c--){if(k[c]){p=p.replace(new RegExp('\\b'+e(c)+'\\b','g'),k[c])}}
      return p;
    })(args[0], args[1], args[2], args[3], args[4], args[5]);
    return unpacked;
  } catch(e) {
    return p;
  }
}

async function testExtraction() {
  const urls = [
    { name: 'Moly', url: 'https://vidmoly.net/embed-vz1m7a4x988b.html' },
    { name: 'Turbo', url: 'https://emturbovid.com/t/69575eb54ea8e' }
  ];

  for (const item of urls) {
    console.log(`\n--- Extracting from ${item.name} URL: ${item.url} ---`);
    try {
      const res = await axios.get(item.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://toon-stream.site/'
        },
        timeout: 10000
      });

      const html = res.data;
      console.log('Got HTML, length:', html.length);
      
      let textToSearch = html;
      const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\)\{.*?\}\(.*\)\)/g);
      console.log('Number of packed blocks:', packedMatch ? packedMatch.length : 0);
      
      if (packedMatch) {
        for (const packed of packedMatch) {
          const unpacked = unpack(packed);
          textToSearch += "\n" + unpacked;
        }
      }

      const m3u8Match = textToSearch.match(/https?:\/\/[^\s'"]+\.m3u8[^\s'"]*/);
      if (m3u8Match) {
        console.log('SUCCESS Extracted M3U8:', m3u8Match[0]);
      } else {
        console.log('FAILED to find any M3U8 stream in HTML or packed JS.');
        // Print script blocks or suspicious strings
        const scripts = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi) || [];
        console.log(`Found ${scripts.length} script blocks.`);
        for (let i = 0; i < scripts.length; i++) {
          const block = scripts[i];
          if (block.includes('file') || block.includes('src') || block.includes('player') || block.includes('source')) {
            console.log(`\nScript block ${i} snippet:\n`, block.substring(0, 500));
          }
        }
      }

    } catch (e) {
      console.log('Failed:', e.response ? e.response.status : e.message);
    }
  }
}

testExtraction();
