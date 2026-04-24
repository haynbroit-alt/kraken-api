const http = require('http');
const https = require('https');
const url = require('url');

const CLIENT_KEY = 'awd6vps5eb7yi1je';
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI;
const PORT = process.env.PORT || 3000;

let savedToken = null;

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;

  if (path === '/auth') {
    const authUrl = 'https://www.tiktok.com/v2/auth/authorize/?client_key=' + CLIENT_KEY + '&response_type=code&scope=user.info.basic,video.publish,video.upload&redirect_uri=' + encodeURIComponent(REDIRECT_URI) + '&state=kraken123';
    res.writeHead(302, { Location: authUrl });
    res.end();
  } else if (path === '/callback') {
    const code = parsedUrl.query.code;
    const postData = 'client_key=' + CLIENT_KEY + '&client_secret=' + CLIENT_SECRET + '&code=' + code + '&grant_type=authorization_code&redirect_uri=' + encodeURIComponent(REDIRECT_URI);
    const options = {
      hostname: 'open.tiktokapis.com',
      path: '/v2/oauth/token/',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    };
    const tokenReq = https.request(options, (tokenRes) => {
      let data = '';
      tokenRes.on('data', (chunk) => { data += chunk; });
      tokenRes.on('end', () => {
        savedToken = JSON.parse(data);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>✅ TikTok connecté !</h1><p>open_id: ' + savedToken.open_id + '</p>');
      });
    });
    tokenReq.write(postData);
    tokenReq.end();
  } else if (path === '/token') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(savedToken));
  } else {
    res.writeHead(200);
    res.end('🦜 KRAKEN API en ligne !');
  }
});

server.listen(PORT, () => {
  console.log('KRAKEN API sur port ' + PORT);
});
