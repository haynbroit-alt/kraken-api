'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');
const url = require('url');
const querystring = require('querystring');

const PORT          = process.env.PORT || 8080;
const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI  = process.env.REDIRECT_URI         || 'https://kraken-api-production.up.railway.app/callback';
const MISTRAL_KEY   = process.env.MISTRAL_KEY          || '48LY8qvyB5zaNvEOrjtKRKuO73kTtM0o';

let token = null;
const TOKEN_FILE = '/tmp/token.json';
if (fs.existsSync(TOKEN_FILE)) {
  try { token = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')); } catch(e) {}
}
let jobRunning = false;
let jobStatus  = null;

const TOPICS = [
  "Les secrets que les riches cachent aux pauvres",
  "Ce que la science dit sur le sommeil profond",
  "Les 5 habitudes des millionnaires avant 30 ans",
  "Comment notre cerveau sabote nos decisions",
  "Les verites cachees sur alimentation moderne",
  "Pourquoi 90 pourcent des gens echouent",
  "Les techniques de manipulation des medias",
  "Ce que les medecins ne vous disent pas",
  "Comment les entreprises controlent attention",
  "Les mysteres que la science ne peut expliquer",
];

async function getScript(topic) {
  return new Promise((resolve) => {
    const prompt = 'Donne 5 phrases courtes (max 8 mots) sur: "' + topic + '". Reponds UNIQUEMENT avec les 5 phrases numerotees 1. 2. 3. 4. 5.';
    const payload = JSON.stringify({
      model: 'mistral-small-latest',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
    });
    const fallback = { title: topic, lines: [topic, topic, topic, topic, topic] };
    const req = https.request({
      hostname: 'api.mistral.ai', path: '/v1/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + MISTRAL_KEY, 'Content-Length': Buffer.byteLength(payload) },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          const text = j.choices[0].message.content;
          const lines = text.split('\n').map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(l => l.length > 2).slice(0, 5);
          while (lines.length < 5) lines.push(topic);
          resolve({ title: topic, lines });
        } catch(e) { resolve(fallback); }
      });
    });
    req.on('error', () => resolve(fallback));
    req.setTimeout(15000, () => { req.destroy(); resolve(fallback); });
    req.write(payload);
    req.end();
  });
}

function makeVideo(lines, outputPath) {
  const colors = ['0x1a1a2e', '0x16213e', '0x0f3460', '0x2d132c', '0x1b1b2f'];
  const segs = [];
  for (let i = 0; i < lines.length; i++) {
    const img = '/tmp/f' + i + '.png';
    const sil = '/tmp/s' + i + '.wav';
    const seg = '/tmp/g' + i + '.mp4';
    const txt = lines[i].replace(/['"\\:]/g, ' ').slice(0, 40);
    execSync('ffmpeg -y -f lavfi -i color=c=' + colors[i % colors.length] + ':size=1280x720:rate=25 -vf "drawtext=fontcolor=white:fontsize=44:x=(w-text_w)/2:y=(h-text_h)/2:text=\'' + txt + '\'" -frames:v 1 ' + img + ' 2>/dev/null', { timeout: 10000 });
    execSync('ffmpeg -y -f lavfi -i aevalsrc=0:c=mono:s=44100 -t 60 ' + sil + ' 2>/dev/null', { timeout: 10000 });
    execSync('ffmpeg -y -loop 1 -i ' + img + ' -i ' + sil + ' -c:v libx264 -tune stillimage -c:a aac -pix_fmt yuv420p -shortest ' + seg + ' 2>/dev/null', { timeout: 30000 });
    segs.push(seg);
    console.log('Segment ' + (i+1) + '/5 OK');
  }
  fs.writeFileSync('/tmp/concat.txt', segs.map(s => "file '" + s + "'").join('\n'));
  execSync('ffmpeg -y -f concat -safe 0 -i /tmp/concat.txt -c copy ' + outputPath + ' 2>/dev/null', { timeout: 60000 });
  console.log('Video OK');
}

async function refreshToken() {
  if (!token || !token.refresh_token) return;
  return new Promise((resolve) => {
    const payload = querystring.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: token.refresh_token, grant_type: 'refresh_token' });
    const req = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { const j = JSON.parse(d); if (j.access_token) { token.access_token = j.access_token; fs.writeFileSync(TOKEN_FILE, JSON.stringify(token)); } } catch(e) {}
        resolve();
      });
    });
    req.on('error', resolve);
    req.write(payload);
    req.end();
  });
}

async function uploadYouTube(videoPath, title) {
  await refreshToken();
  return new Promise((resolve, reject) => {
    const meta = JSON.stringify({ snippet: { title: title.slice(0, 100), description: title, categoryId: '22' }, status: { privacyStatus: 'public' } });
    const b = 'kraken_b';
    const vd = fs.readFileSync(videoPath);
    const hdr = Buffer.from('--' + b + '\r\nContent-Type: application/json\r\n\r\n' + meta + '\r\n--' + b + '\r\nContent-Type: video/mp4\r\n\r\n');
    const ftr = Buffer.from('\r\n--' + b + '--');
    const body = Buffer.concat([hdr, vd, ftr]);
    const req = https.request({ hostname: 'www.googleapis.com', path: '/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status', method: 'POST', headers: { Authorization: 'Bearer ' + token.access_token, 'Content-Type': 'multipart/related; boundary="' + b + '"', 'Content-Length': body.length } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function runPipeline() {
  if (jobRunning) return;
  jobRunning = true;
  try {
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    jobStatus = { status: 'pending', message: '📝 Script: "' + topic + '"...' };
    const script = await getScript(topic);
    jobStatus.message = '🎬 Creation video...';
    makeVideo(script.lines, '/tmp/final.mp4');
    jobStatus.message = '📤 Upload YouTube...';
    const result = await uploadYouTube('/tmp/final.mp4', script.title);
    if (result.id) {
      jobStatus = { status: 'done', message: 'OK', url: 'https://youtube.com/watch?v=' + result.id, title: script.title };
      console.log('YouTube OK: ' + result.id);
    } else {
      throw new Error(JSON.stringify(result).slice(0, 200));
    }
  } catch(e) {
    console.error('Pipeline: ' + e.message);
    jobStatus = { status: 'error', message: e.message };
  } finally {
    jobRunning = false;
  }
}

http.createServer(async (req, res) => {
  const p = url.parse(req.url).pathname;

  if (p === '/auth') {
    const u = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=' + CLIENT_ID + '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) + '&response_type=code&scope=' + encodeURIComponent('https://www.googleapis.com/auth/youtube.upload') + '&access_type=offline&prompt=consent';
    res.writeHead(302, { Location: u }); return res.end();
  }

  if (p === '/callback') {
    const code = url.parse(req.url, true).query.code;
    const payload = querystring.stringify({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' });
    const r = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) } }, tr => {
      let d = ''; tr.on('data', c => d += c);
      tr.on('end', () => { token = JSON.parse(d); fs.writeFileSync(TOKEN_FILE, JSON.stringify(token)); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<h2>YouTube connecte!</h2><a href="/publish">Publier</a>'); });
    });
    r.write(payload); return r.end();
  }

  if (p === '/publish') {
    if (!token) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end('<h2>Non connecte</h2><a href="/auth">Connecter YouTube</a>'); }
    if (!jobRunning) { jobStatus = { status: 'pending', message: 'Demarrage...' }; runPipeline(); }
    const box = !jobStatus ? '<p>Demarrage...</p>'
      : jobStatus.status === 'done' ? '<p style="color:#00ff88;font-size:1.4em">OK: ' + jobStatus.title + '</p><p><a href="' + jobStatus.url + '" target="_blank">Voir sur YouTube</a></p>'
      : jobStatus.status === 'error' ? '<p style="color:#ff4444">' + jobStatus.message + '</p><a href="/publish">Reessayer</a>'
      : '<p>' + jobStatus.message + '</p><p style="color:#888">Rafraichissement auto...</p>';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="8"><title>Kraken</title><style>body{font-family:sans-serif;background:#0a0a0f;color:#e8e0d0;text-align:center;padding:40px}h1{color:#ff6b35}.box{margin:30px auto;padding:20px;background:#1a1a2e;border-radius:10px;max-width:500px}a{color:#ff6b35}</style></head><body><h1>KRAKEN BOT</h1><div class="box">' + box + '</div><p><a href="/">Accueil</a> | <a href="/status">Statut</a></p></body></html>');
  }

  if (p === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ connecte: !!token, jobRunning, jobStatus }));
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Kraken</title><style>body{font-family:sans-serif;background:#0a0a0f;color:#e8e0d0;text-align:center;padding:60px}h1{color:#ff6b35;font-size:3em}a{display:block;margin:12px auto;width:260px;padding:14px;background:#1a1a2e;border:2px solid #ff6b35;border-radius:10px;color:#e8e0d0;text-decoration:none}a:hover{background:#ff6b35;color:#000}</style></head><body><h1>KRAKEN BOT</h1><p style="color:' + (token?'#00ff88':'#ff4444') + '">' + (token?'YouTube connecte':'YouTube non connecte') + '</p><a href="/auth">Connecter YouTube</a><a href="/publish">Publier une video</a><a href="/status">Statut</a></body></html>');

}).listen(PORT, () => console.log('Kraken port ' + PORT));

setInterval(() => {
  https.get('https://kraken-api-production.up.railway.app/status', r => console.log('Ping: ' + r.statusCode)).on('error', e => console.log('Ping err: ' + e.message));
}, 8 * 60 * 1000);
