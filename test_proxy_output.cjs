const axios = require('axios');

async function simulateProxy() {
  const targetUrl = 'https://cdn.turboviplay.com/data3/687f9eb38d6ab/687f9eb38d6ab.m3u8';
  console.log('Simulating master playlist proxy for:', targetUrl);

  try {
    const res = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const content = res.data;
    const lines = content.split('\n');
    const rewrittenLines = lines.map((line) => {
      let trimmedLine = line.trim();
      if (!trimmedLine) return line;

      if (trimmedLine.startsWith('#')) {
        trimmedLine = trimmedLine.replace(/URI="([^"]+)"/g, (match, p1) => {
          const absoluteUrl = new URL(p1, targetUrl).toString();
          return `URI="/api/proxy/stream?url=${encodeURIComponent(absoluteUrl)}"`;
        });
        trimmedLine = trimmedLine.replace(/URI=([^,\s"]+)/g, (match, p1) => {
          const absoluteUrl = new URL(p1, targetUrl).toString();
          return `URI="/api/proxy/stream?url=${encodeURIComponent(absoluteUrl)}"`;
        });
        trimmedLine = trimmedLine.replace(/(https?:\/\/[^\s,"]+)/g, (match) => {
          const absoluteUrl = new URL(match, targetUrl).toString();
          return `/api/proxy/stream?url=${encodeURIComponent(absoluteUrl)}`;
        });
        return trimmedLine;
      }

      try {
        const absoluteUrl = new URL(trimmedLine, targetUrl).toString();
        return `/api/proxy/stream?url=${encodeURIComponent(absoluteUrl)}`;
      } catch (e) {
        return line;
      }
    });

    console.log('--- REWRITTEN MASTER PLAYLIST ---');
    console.log(rewrittenLines.join('\n'));

    // Let's test proxying one of the sub-playlists
    const subPlaylistUrl = 'https://g250.turbosplayer.com/file/b7037a31-8247-4668-956e-9ff77e0b0025/master.m3u8';
    console.log('\nSimulating sub playlist proxy for:', subPlaylistUrl);
    
    const subRes = await axios.get(subPlaylistUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const subContent = subRes.data;
    const subLines = subContent.split('\n');
    const rewrittenSubLines = subLines.map((line) => {
      let trimmedLine = line.trim();
      if (!trimmedLine) return line;

      if (trimmedLine.startsWith('#')) {
        trimmedLine = trimmedLine.replace(/URI="([^"]+)"/g, (match, p1) => {
          const absoluteUrl = new URL(p1, subPlaylistUrl).toString();
          return `URI="/api/proxy/stream?url=${encodeURIComponent(absoluteUrl)}"`;
        });
        trimmedLine = trimmedLine.replace(/URI=([^,\s"]+)/g, (match, p1) => {
          const absoluteUrl = new URL(p1, subPlaylistUrl).toString();
          return `URI="/api/proxy/stream?url=${encodeURIComponent(absoluteUrl)}"`;
        });
        trimmedLine = trimmedLine.replace(/(https?:\/\/[^\s,"]+)/g, (match) => {
          const absoluteUrl = new URL(match, subPlaylistUrl).toString();
          return `/api/proxy/stream?url=${encodeURIComponent(absoluteUrl)}`;
        });
        return trimmedLine;
      }

      try {
        const absoluteUrl = new URL(trimmedLine, subPlaylistUrl).toString();
        return `/api/proxy/stream?url=${encodeURIComponent(absoluteUrl)}`;
      } catch (e) {
        return line;
      }
    });

    console.log('--- REWRITTEN SUB PLAYLIST (First 15 lines) ---');
    console.log(rewrittenSubLines.slice(0, 20).join('\n'));

  } catch (err) {
    console.log('ERROR:', err.message);
  }
}

simulateProxy();
