const http = require('http');
const https = require('https');
const url = require('url');
const { execSync } = require('child_process');
const fs = require('fs');

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI;
const PORT = process.env.PORT || 8080;

let savedToken = null;

function httpsPost(hostname, path, headers, data) {
  return new Promise((resolve, reject) => {
    const options = { hostname, path, method: 'POST', headers };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function generateScript() {
  const topics = [
    "Un fait insolite sur les animaux marins",
    "Une histoire vraie bizarre qui s'est passée en France",
    "Un mystère scientifique inexpliqué",
    "Un fait choquant sur l'espace",
    "Une coïncidence incroyable dans l'histoire"
  ];
  const topic = topics[Math.floor(Math.random() * topics.length)];
  return `Aujourd'hui nous allons parler de: ${topic}. C'est une histoire fascinante qui va vous surprendre. Restez jusqu'à la fin pour découvrir le secret. ${topic} est l'un des sujets les plus mystérieux de notre époque. Les scientifiques eux-mêmes n'arrivent pas à l'expliquer. Voilà pourquoi ce sujet passionne des millions de personnes dans le monde entier.`;
}

async function generateAudio(script) {
  const apiKey = process.env.ELEVEN_API_KEY;
  if (!apiKey) return null;
  const data = JSON.stringify({ text: script, model_id: 'eleven_multilingual_v2' });
  const options = {
    hostname: 'api.elevenlabs.io',
    path: '/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM',
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        fs.writeFileSync('/tmp/audio.mp3', buffer);
        resolve('/tmp/audio.mp3');
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function uploadToYoutube(title, description) {
  if (!savedToken) return { error: 'Non connecté - va sur /auth' };
  const metadata = JSON.stringify({
    snippet: { title, description, categoryId: '22' },
    status: { privacyStatus: 'public' }
  });
  const response = await httpsPost(
    'www.googleapis.com',
    '/upload/youtube/v3/videos?part=snippet,status&uploadType=resumable',
    {
      'Authorization': 'Bearer ' + savedToken.access_token,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': 'video/mp4',
      'Content-Length': metadata.length
    },
    metadata
  );
  return response;
}

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
      code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI, grant_type: 'authorization_code'
    });
    const token = await httpsPost('oauth2.googleapis.com', '/token',
      { 'Content-Type': 'application/json', 'Content-Length': postData.length }, postData);
    savedToken = token;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>✅ YouTube connecté ! Va sur /generate pour créer une vidéo</h1>');

  } else if (path === '/generate') {
    const script = await generateScript();
    const audioPath = await generateAudio(script);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ script, audio: audioPath ? 'généré' : 'clé ElevenLabs manquante' }));

  } else if (path === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ connecte: !!savedToken, token: savedToken ? 'OK' : 'Non connecté' }));

  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>🦑 KRAKEN YouTube Bot</h1><ul><li><a href="/auth">1. Connecter YouTube</a></li><li><a href="/generate">2. Générer une vidéo</a></li><li><a href="/status">3. Statut</a></li></ul>');
  }
});

server.listen(PORT, () => {
  console.log('KRAKEN API sur port ' + PORT);
});
