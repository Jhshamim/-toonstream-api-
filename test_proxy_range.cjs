const axios = require('axios');

async function testProxyRange() {
  const segmentUrl = 'http://localhost:3000/api/proxy/stream?url=' + encodeURIComponent('https://lh3.googleusercontent.com/d/1Olz51hmozhN3wjF0qO73SVUpirZ5_hfe=d');
  console.log('Testing proxy Range request on:', segmentUrl);

  try {
    const res = await axios.get(segmentUrl, {
      headers: {
        'Range': 'bytes=0-1000'
      },
      responseType: 'arraybuffer'
    });

    console.log('Status:', res.status);
    console.log('Headers:', res.headers);
    console.log('Body length:', res.data.length);
  } catch (err) {
    console.log('Failed:', err.response ? { status: err.response.status, headers: err.response.headers } : err.message);
  }
}

testProxyRange();
