const axios = require('axios');

async function testLocalProxy() {
  const masterUrl = 'http://localhost:3000/api/proxy/stream?url=' + encodeURIComponent('https://cdn.turboviplay.com/data3/687f9eb38d6ab/687f9eb38d6ab.m3u8');
  console.log('Testing local proxy for master playlist:', masterUrl);

  try {
    const res = await axios.get(masterUrl, { timeout: 10000 });
    console.log('Master Playlist Status:', res.status);
    console.log('Master Playlist Content-Type:', res.headers['content-type']);
    console.log('Master Playlist Length:', res.data.length);
    console.log('Master Playlist Content Preview:\n', res.data.substring(0, 300));
  } catch (err) {
    console.log('Master Playlist Failed:', err.response ? err.response.status : err.message);
  }

  const segmentUrl = 'http://localhost:3000/api/proxy/stream?url=' + encodeURIComponent('https://lh3.googleusercontent.com/d/1Olz51hmozhN3wjF0qO73SVUpirZ5_hfe=d');
  console.log('\nTesting local proxy for Google Drive segment:', segmentUrl);

  try {
    const res = await axios.get(segmentUrl, { timeout: 10000, responseType: 'arraybuffer' });
    console.log('Segment Status:', res.status);
    console.log('Segment Content-Type:', res.headers['content-type']);
    console.log('Segment Content-Length:', res.headers['content-length']);
    console.log('Segment Body length:', res.data.length);
  } catch (err) {
    console.log('Segment Failed:', err.response ? err.response.status : err.message);
  }
}

testLocalProxy();
