const http = require('http');
const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');
const url = require('url');

const PORT = process.env.PORT || 8080;
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI;
const PEXELS_KEY = process.env.PEXELS_API_KEY;

let token = null;
if (fs.existsSync('/tmp/token.json')) {
  try { token = JSON.parse(fs.readFileSync('/tmp/token.json')); } catch(e) {}
}

let autoMode = false;
let autoInterval = null;
let lastPublished = null;
let publishCount = 0;

try {
  execSync('pip3 install edge-tts --quiet --break-system-packages 2>/dev/null || pip install edge-tts --quiet 2>/dev/null', { timeout: 30000 });
} catch(e) {}

const VOICES = {
  en: 'en-US-ChristopherNeural',
  fr: 'fr-FR-HenriNeural',
};

const MUSIC_URLS = [
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
];

const VIDEOS = [
  {
    en: {
      title: 'Kevin Tried To Become A Millionaire In 5 Minutes',
      description: 'The Calamity Crew tries to get rich quick... total chaos 😂',
      tags: ['calamity crew','funny cartoon'],
      thumbnail_text: 'KEVIN TRIED TO GET RICH',
      thumbnail_color: 'ff00aa',
      thumbnail_accent: 'ffff00',
    },
    fr: {
      title: 'Kevin a essayé de devenir millionnaire en 5 minutes',
      description: 'Les Calamity Crew tentent de s’enrichir… chaos total 😂',
      tags: ['calamity crew','dessin animé drôle'],
      thumbnail_text: 'KEVIN A ESSAYÉ DE DEVENIR RICHE',
      thumbnail_color: 'ff00aa',
      thumbnail_accent: 'ffff00',
    },
    scenes: [
      { en: { text: 'Kevin idea', speech: 'Team! Today we become millionnaires!' },
        fr: { text: 'Idée de Kevin', speech: 'Équipe ! Aujourd’hui on devient millionnaires !' },
        pollinations: 'cartoon fat bald man in blue suit confident pose' },
      { en: { text: 'Lola sings', speech: 'I will sing for fame!' },
        fr: { text: 'Lola chante', speech: 'Je vais chanter pour la gloire !' },
        pollinations: 'glamorous cartoon woman singing' },
      { en: { text: 'Explosion', speech: 'BOOM!' },
        fr: { text: 'Explosion', speech: 'BOUM !' },
        pollinations: 'cartoon explosion funny characters' },
      { en: { text: 'Subscribe', speech: 'Subscribe for more chaos!' },
        fr: { text: 'Abonnez-vous', speech: 'Abonnez-vous pour plus de chaos !' },
        pollinations: 'cartoon group waving subscribe button' }
    ]
  }
];

function httpsGet(urlStr) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(urlStr);
      https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return httpsGet(res.headers.location).then(resolve).catch(reject);
        }
        const chunks = []; res.on('data', d => chunks.push(d)); res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    } catch(e) { reject(e); }
  });
}

function httpsPost(hostname, pth, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path: pth, method: 'POST', headers }, (res) => {
      let data = ''; res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    req.on('error', reject); if (body) req.write(body); req.end();
  });
}

async function refreshToken() {
  if (!token || !token.refresh_token) return;
  try {
    const body = `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&refresh_token=${token.refresh_token}&grant_type=refresh_token`;
    const result = await httpsPost('oauth2.googleapis.com', '/token', { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }, body);
    if (result.access_token) { token.access_token = result.access_token; fs.writeFileSync('/tmp/token.json', JSON.stringify(token)); }
  } catch(e) {}
}

async function generateThumbnail(vid, lang) {
  const thumbPath = `/tmp/thumb_${lang}.jpg`;
  try {
    execSync(`ffmpeg -y -f lavfi -i "color=c=#ff00aa:size=1280x720" -vf "drawtext=text='CALAMITY CREW':fontcolor=white:fontsize=80:x=(w-text_w)/2:y=300" -frames:v 1 "${thumbPath}" 2>/dev/null`, { timeout: 10000 });
    return thumbPath;
  } catch(e) { return null; }
}

async function getMusic() { return null; }

async function getEdgeTTS(text, lang, outPath) {
  try {
    const rawPath = outPath.replace('.mp3', '_raw.mp3');
    execSync(`edge-tts --voice "${VOICES[lang]}" --text "${text.replace(/"/g, "'")}" --write-media "${rawPath}" 2>/dev/null`, { timeout: 30000 });
    execSync(`ffmpeg -y -i "${rawPath}" -ar 44100 -ac 2 "${outPath}" 2>/dev/null`, { timeout: 15000 });
    return true;
  } catch(e) { 
    execSync(`ffmpeg -y -f lavfi -i "aevalsrc=0" -t 5 "${outPath}" 2>/dev/null`);
    return false; 
  }
}

async function downloadPollinations(prompt, outPath) {
  try {
    const imgData = await httpsGet(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1280&height=720&nologo=true`);
    if (imgData.length > 5000) { fs.writeFileSync(outPath, imgData); return true; }
  } catch(e) {}
  execSync(`ffmpeg -y -f lavfi -i "color=c=#1a1a2e:size=1280x720" -t 1 "${outPath}" 2>/dev/null`);
  return true;
}

async function getImage(scene, index) {
  const outPath = `/tmp/img_${index}.jpg`;
  await downloadPollinations(scene.pollinations, outPath);
  return outPath;
}

async function createSceneClip(scene, index, lang) {
  const d = scene[lang];
  const imgPath = await getImage(scene, index);
  const audioPath = `/tmp/audio_${lang}_${index}.mp3`;
  await getEdgeTTS(d.speech, lang, audioPath);

  const clipPath = `/tmp/clip_${lang}_${index}.mp4`;
  const textSafe = d.text.replace(/['":\]/g, ' ');

  execSync(`ffmpeg -y -loop 1 -i "${imgPath}" -i "${audioPath}" -t 8     -vf "scale=1280:720,drawbox=x=0:y=570:w=1280:h=150:color=black@0.85:t=fill,drawtext=text='${textSafe}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=600"     -c:v libx264 -c:a aac -pix_fmt yuv420p "${clipPath}" 2>/dev/null`, { timeout: 60000 });

  return clipPath;
}

async function buildVideo(vid, lang) {
  const clips = [];
  for (let i = 0; i < vid.scenes.length; i++) {
    clips.push(await createSceneClip(vid.scenes[i], i, lang));
  }

  const concatFile = `/tmp/concat_${lang}.txt`;
  fs.writeFileSync(concatFile, clips.map(p => `file '${p}'`).join('\n'));
  const rawPath = `/tmp/raw_${lang}.mp4`;
  execSync(`ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c:v libx264 -c:a aac "${rawPath}" 2>/dev/null`, { timeout: 120000 });

  const outPath = `/tmp/final_${lang}.mp4`;
  fs.copyFileSync(rawPath, outPath);

  const thumbPath = await generateThumbnail(vid, lang);
  return { videoPath: outPath, thumbPath };
}

async function uploadYouTube(meta, videoPath) {
  console.log('Upload skipped in simplified version');
  return { id: 'demo-' + Date.now() };
}

async function autoPublish() {}

const server = http.createServer(async (req, res) => {
  const p = url.parse(req.url).pathname;

  if (p === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h1>🎉 Calamity Crew Bot - OK</h1>
      <p>Bot chargé avec ${VIDEOS.length} épisode(s)</p>
      <a href="/publish">🚀 Publier une vidéo maintenant</a>`);
    return;
  }

  if (p === '/publish') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.write('<h1>Génération en cours... (version simplifiée)</h1>');
    try {
      const vid = VIDEOS[0];
      const en = await buildVideo(vid, 'en');
      res.end('<h2>✅ Vidéo Calamity Crew générée avec succès ! (version test)</h2><p>Le bot fonctionne.</p>');
    } catch(e) {
      res.end('<p>Erreur: ' + e.message + '</p>');
    }
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`🎥 Calamity Crew Bot démarré sur port ${PORT}`);
  console.log('Accédez à http://localhost:' + PORT);
});
