const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const { execSync } = require('child_process');

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI;
const PORT = process.env.PORT || 8080;

let savedToken = null;

function getFfmpeg() {
  if (fs.existsSync('/usr/bin/ffmpeg')) return '/usr/bin/ffmpeg';
  try { return execSync('which ffmpeg').toString().trim(); } catch(e) {}
  return null;
}

function httpsPost(hostname, path, headers, data) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { resolve(body); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function generateScript() {
  const topics = [
    "Un fait insolite sur les animaux marins",
    "Une histoire vraie bizarre en France",
    "Un mystere scientifique inexplique",
    "Un fait choquant sur l espace",
    "Une coincidence incroyable dans l histoire"
  ];
  const topic = topics[Math.floor(Math.random() * topics.length)];
  const script = "Aujourd hui: " + topic + ". C est fascinant. Restez jusqu a la fin. " + topic + " passionne des millions de personnes.";
  return { topic, script };
}

async function generateAudio(script) {
  const apiKey = process.env.ELEVEN_API_KEY;
  if (!apiKey) return null;
  const data = JSON.stringify({ text: script, model_id: 'eleven_multilingual_v2' });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.elevenlabs.io',
      path: '/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM',
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        fs.writeFileSync('/tmp/audio.mp3', Buffer.concat(chunks));
        resolve('/tmp/audio.mp3');
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function createVideo(audioPath, topic) {
  const ffmpeg = getFfmpeg();
  if (!ffmpeg) return { error: 'FFmpeg non trouve' };
  try {
    const text = topic.replace(/'/g, '').substring(0, 50);
    execSync(
      ffmpeg + " -y -f lavfi -i color=c=0x1a1a2e:size=1280x720:rate=25 -i " + audioPath +
      " -vf \"drawtext=text='" + text + "':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=(h-text_h)/2\" " +
      "-c:v libx264 -c:a aac -shortest -pix_fmt yuv420p /tmp/video.mp4",
      { timeout: 120000 }
    );
    return { path: '/tmp/video.mp4' };
  } catch(e) {
    try {
      execSync(
        ffmpeg + " -y -f lavfi -i color=c=blue:size=1280x720:rate=25 -i " + audioPath +
        " -c:v libx264 -c:a aac -shortest -pix_fmt yuv420p /tmp/video.mp4",
        { timeout: 120000 }
      );
      return { path: '/tmp/video.mp4' };
    } catch(e2) {
      return { error: e2.message.substring(0, 300) };
    }
  }
}

async function uploadToYoutube(title, videoPath) {
  if (!savedToken) return { error: 'Non connecte' };
  const videoData = fs.readFileSync(videoPath);
  const metadata = JSON.stringify({
    snippet: { title: title, description: title + " - Histoire fascinante!", categoryId: '22' },
    status: { privacyStatus: 'public' }
  });
  const boundary = 'boundary123';
  const body = Buffer.concat([
    Buffer.from("--" + boundary + "\r\nContent-Type: application/json\r\n\r\n" + metadata + "\r\n--" + boundary + "\r\nContent-Type: video/mp4\r\n\r\n"),
    videoData,
    Buffer.from("\r\n--" + boundary + "--")
  ]);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'www.googleapis.com',
      path: '/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + savedToken.access_token,
        'Content-Type': 'multipart/related; boundary=' + boundary,
        'Content-Length': body.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve(data); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;

  if (path === '/auth') {
    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=' + CLIENT_ID +
      '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) +
      '&response_type=code&scope=' + encodeURIComponent('https://www.googleapis.com/auth/youtube.upload') +
      '&access_type=offline';
    res.writeHead(302, { Location: authUrl });
    res.end();

  } else if (path === '/callback') {
    const code = parsedUrl.query.code;
    const postData = JSON.stringify({ code: code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' });
    const token = await httpsPost('oauth2.googleapis.com', '/token', { 'Content-Type': 'application/json', 'Content-Length': postData.length }, postData);
    savedToken = token;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>YouTube connecte! <a href="/publish">Publier une video</a></h1>');

  } else if (path === '/debug') {
    const ffmpeg = getFfmpeg();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ffmpeg: ffmpeg, connecte: !!savedToken }));

  } else if (path === '/publish') {
    if (!savedToken) { res.writeHead(200); res.end('Non connecte - <a href="/auth">Se connecter</a>'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.write('<h1>Generation en cours...</h1>');
    try {
      const { topic, script } = await generateScript();
      res.write('<p>Script: ' + topic + '</p>');
      const audioPath = await generateAudio(script);
      res.write('<p>Audio genere</p>');
      const video = await createVideo(audioPath, topic);
      if (video.error) { res.end('<p>Erreur video: ' + video.error + '</p>'); return; }
      res.write('<p>Video creee</p>');
      const result = await uploadToYoutube(topic, video.path);
      res.end('<p>Uploadee! ID: ' + (result.id || JSON.stringify(result).substring(0, 200)) + '</p>');
    } catch(e) {
      res.end('<p>Erreur: ' + e.message + '</p>');
    }

  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>KRAKEN YouTube Bot</h1><ul><li><a href="/auth">1. Connecter YouTube</a></li><li><a href="/publish">2. Publier une video</a></li><li><a href="/debug">3. Debug</a></li></ul>');
  }
});

server.listen(PORT, () => console.log('KRAKEN API sur port ' + PORT));
