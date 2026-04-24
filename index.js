const http = require('http');
const https = require('https');
const url = require('url');

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI;
const PORT = process.env.PORT || 8080;

let savedToken = null;

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;

  if (path === '/auth') {
    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
      'client_id=' + CLIENT_ID +
      '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) +
      '&response_type=code' +
      '&scope=' + encodeURIComponent('https://www.googleapis.com/auth/youtube.upload') +
      '&access_type=offline';
    res.writeHead(302, { Location: authUrl });
    res.end();
  } else if (path === '/callback') {
    const code = parsedUrl.query.code;
    const postData = JSON.stringify({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code'
    });
    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };
    const tokenReq = https.request(options, (tokenRes) => {
      let data = '';
      tokenRes.on('data', chunk => { data += chunk; });
      tokenRes.on('end', () => {
        savedToken = JSON.parse(data);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>✅ YouTube connecté !</h1>');
      });
    });
    tokenReq.write(postData);
    tokenReq.end();
  } else if (path === '/token') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(savedToken));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>🦑 KRAKEN YouTube API</h1><a href="/auth">👉 Connecter YouTube</a>');
  }
});

server.listen(PORT, () => {
  console.log('KRAKEN API sur port ' + PORT);
});
