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

// Installer edge-tts
try {
  execSync('pip3 install edge-tts --quiet --break-system-packages 2>/dev/null || pip install edge-tts --quiet 2>/dev/null', { timeout: 30000 });
} catch(e) {}

const VOICES = {
  en: 'en-US-ChristopherNeural',
  fr: 'fr-FR-HenriNeural',
};

const MUSIC_URLS = [
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
];

// ─── LES CALAMITY CREW - VERSION HILARANTE BILINGUE ───────────────────────
const VIDEOS = [
  {
    en: {
      title: 'Kevin Tried To Become A Millionaire In 5 Minutes',
      description: 'The Calamity Crew tries to get rich quick... it goes exactly as you expect 😂 Total chaos guaranteed!\n\n#CalamityCrew #FunnyCartoon #EpicFail #Comedy',
      tags: ['calamity crew','kevin fails','funny cartoon','epic fail','comedy animation','kids funny'],
      thumbnail_text: 'KEVIN TRIED\nTO GET RICH\nIN 5 MINUTES',
      thumbnail_color: 'ff00aa',
      thumbnail_accent: 'ffff00',
    },
    fr: {
      title: 'Kevin a essayé de devenir millionnaire en 5 minutes',
      description: 'Les Calamity Crew tentent de s’enrichir rapidement… ça finit exactement comme on s’y attendait 😂 Chaos total garanti !\n\n#CalamityCrew #DessinAniméDrôle #ÉchecÉpique',
      tags: ['calamity crew','kevin rate tout','dessin animé drôle','échec épique','comédie animation'],
      thumbnail_text: 'KEVIN A ESSAYÉ\nDE DEVENIR RICHE\nEN 5 MINUTES',
      thumbnail_color: 'ff00aa',
      thumbnail_accent: 'ffff00',
    },
    scenes: [
      { en: { text: 'Kevin has a brilliant idea', speech: 'Team! Today we become millionaires! My plan is 3000% guaranteed!' },
        fr: { text: 'Kevin a une idée géniale', speech: 'Équipe ! Aujourd’hui on devient millionnaires ! Mon plan est garanti à 3000% !' },
        pollinations: 'cartoon fat bald man in tight blue suit confident pose hands on hips big smile funny expression vibrant colors' },
      
      { en: { text: 'Lola tries to sing for money', speech: 'I will sing! My voice will make us famous!' },
        fr: { text: 'Lola chante pour gagner de l’argent', speech: 'Je vais chanter ! Ma voix va nous rendre célèbres !' },
        pollinations: 'glamorous cartoon woman huge blonde hair singing with mouth wide open dramatic pose funny face' },
      
      { en: { text: 'Rayan’s invention explodes', speech: 'The Super Money Machine is ready! 3… 2… 1… BOOM!' },
        fr: { text: 'L’invention de Rayan explose', speech: 'La Super Machine à Argent est prête ! 3… 2… 1… BOUM !' },
        pollinations: 'nerdy cartoon teen taped glasses holding smoking broken invention explosion funny shocked face' },
      
      { en: { text: 'Gros Nounours is terrified', speech: 'I just wanted a hug… not this chaos…' },
        fr: { text: 'Gros Nounours a peur', speech: 'Je voulais juste un câlin… pas tout ça…' },
        pollinations: 'huge cartoon bear man crying scared big teary eyes funny expression' },
      
      { en: { text: 'Mimi films everything', speech: 'This is going viral on TikTok! Already 1 million views!' },
        fr: { text: 'Mimi filme tout', speech: 'Ça va devenir viral sur TikTok ! Déjà 1 million de vues !' },
        pollinations: 'cute little girl cartoon evil smile holding phone filming chaos' },
      
      { en: { text: 'The grand finale disaster', speech: 'Why does this always happen to us?!' },
        fr: { text: 'Le grand final catastrophe', speech: 'Pourquoi ça nous arrive toujours à nous ?!' },
        pollinations: 'five cartoon characters covered in paint and mess group chaos funny expressions colorful' },
      
      { en: { text: 'Subscribe for more disasters!', speech: 'If you laughed, smash subscribe! New Calamity Crew episode every week!' },
        fr: { text: 'Abonne-toi pour plus de catastrophes !', speech: 'Si tu as ri, abonne-toi ! Nouvel épisode Calamity Crew chaque semaine !' },
        pollinations: 'calamity crew group waving at camera big subscribe button explosion funny vibrant' }
    ]
  },

  {
    en: {
      title: 'Lola Became a TikTok Influencer… Total Disaster',
      description: 'Lola wants to be a famous influencer. The crew helps… chaos guaranteed 😂',
      tags: ['lola influencer','tiktok fail','funny cartoon','calamity crew'],
      thumbnail_text: 'LOLA THE\nTIKTOK QUEEN',
      thumbnail_color: '00ffcc',
      thumbnail_accent: 'ff00ff',
    },
    fr: {
      title: 'Lola est devenue influenceuse TikTok… Catastrophe',
      description: 'Lola veut devenir célèbre sur TikTok. L’équipe "l’aide"… ça finit mal 😂',
      tags: ['lola influenceuse','échec tiktok','dessin animé drôle'],
      thumbnail_text: 'LOLA LA\nREINE TIKTOK',
      thumbnail_color: '00ffcc',
      thumbnail_accent: 'ff00ff',
    },
    scenes: [
      { en: { text: 'Lola’s big dream', speech: 'From today I am a superstar influencer!' },
        fr: { text: 'Le rêve de Lola', speech: 'À partir d’aujourd’hui je suis une superstar influenceuse !' },
        pollinations: 'glamorous cartoon diva posing with phone sparkles pink background' },
      { en: { text: 'Kevin helps with marketing', speech: 'Trust me, this plan is genius!' },
        fr: { text: 'Kevin aide au marketing', speech: 'Faites-moi confiance, ce plan est génial !' },
        pollinations: 'cartoon bald man in suit giving thumbs up funny' },
      { en: { text: 'Everything goes wrong', speech: 'Why is everything on fire?!' },
        fr: { text: 'Tout part en vrille', speech: 'Pourquoi tout est en feu ?!' },
        pollinations: 'cartoon group in panic fire smoke funny chaos' },
      { en: { text: 'Subscribe!', speech: 'Smash subscribe for more Calamity Crew!' },
        fr: { text: 'Abonnez-vous !', speech: 'Abonnez-vous pour plus d’épisodes Calamity Crew !' },
        pollinations: 'calamity crew group jumping happy subscribe button' }
    ]
  }
];

// Utilitaires (copiés de l'original)
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

async function generateThumbnail(vid, lang, bgImagePath) {
  const thumbPath = `/tmp/thumb_${lang}.jpg`;
  const meta = vid[lang];
  const lines = meta.thumbnail_text.split('\n');
  const color = meta.thumbnail_color;
  const accent = meta.thumbnail_accent;

  const lineHeight = 120;
  const startY = Math.floor((720 - lines.length * lineHeight) / 2);
  let drawTexts = '';
  lines.forEach((line, i) => {
    const y = startY + i * lineHeight;
    const safe = line.replace(/'/g, ' ').replace(/"/g, ' ');
    drawTexts += `,drawtext=text='${safe}':fontcolor=black@0.8:fontsize=110:x=(w-text_w)/2+4:y=${y+4}:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf`;
    drawTexts += `,drawtext=text='${safe}':fontcolor=#${accent}:fontsize=110:x=(w-text_w)/2:y=${y}:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf`;
  });

  try {
    if (bgImagePath && fs.existsSync(bgImagePath)) {
      execSync(`ffmpeg -y -i "${bgImagePath}" -vf "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,drawbox=x=0:y=0:w=1280:h=720:color=#${color}@0.65:t=fill${drawTexts}" -frames:v 1 "${thumbPath}" 2>/dev/null`, { timeout: 30000 });
    } else {
      execSync(`ffmpeg -y -f lavfi -i "color=c=#${color}:size=1280x720" -vf "drawbox=x=0:y=0:w=1280:h=720:color=#${color}:t=fill${drawTexts}" -frames:v 1 "${thumbPath}" 2>/dev/null`, { timeout: 30000 });
    }
    return thumbPath;
  } catch(e) {
    console.log('Thumb err:', e.message);
    return null;
  }
}

async function getMusic() {
  const musicPath = '/tmp/music.mp3';
  if (fs.existsSync(musicPath) && fs.statSync(musicPath).size > 100000) return musicPath;
  try {
    const data = await httpsGet(MUSIC_URLS[Math.floor(Math.random() * MUSIC_URLS.length)]);
    if (data.length > 10000) { fs.writeFileSync(musicPath, data); return musicPath; }
  } catch(e) {}
  return null;
}

async function getEdgeTTS(text, lang, outPath) {
  try {
    const rawPath = outPath.replace('.mp3', '_raw.mp3');
    execSync(`edge-tts --voice "${VOICES[lang]}" --text "${text.replace(/"/g, "'").replace(/\n/g, ' ')}" --write-media "${rawPath}" 2>/dev/null`, { timeout: 30000 });
    execSync(`ffmpeg -y -i "${rawPath}" -ar 44100 -ac 2 "${outPath}" 2>/dev/null`, { timeout: 15000 });
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) return true;
  } catch(e) {}
  try {
    const encoded = encodeURIComponent(text.substring(0, 200));
    const data = await httpsGet(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${lang}&client=tw-ob&ttsspeed=0.87`);
    if (data.length > 1000) { fs.writeFileSync(outPath, data); return true; }
  } catch(e) {}
  execSync(`ffmpeg -y -f lavfi -i "aevalsrc=0:c=mono:s=44100" -t 8 "${outPath}" 2>/dev/null`);
  return false;
}

async function downloadPexels(query, outPath) {
  try {
    if (!PEXELS_KEY) return false;
    const res = await new Promise((resolve, reject) => {
      https.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`, { headers: { Authorization: PEXELS_KEY } }, (r) => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(d));
      }).on('error', reject);
    });
    const data = JSON.parse(res);
    if (data.photos && data.photos.length > 0) {
      const photo = data.photos[Math.floor(Math.random() * Math.min(5, data.photos.length))];
      const imgData = await httpsGet(photo.src.large);
      if (imgData.length > 5000) { fs.writeFileSync(outPath, imgData); return true; }
    }
  } catch(e) {}
  return false;
}

async function downloadPollinations(prompt, outPath) {
  try {
    const imgData = await httpsGet(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ' cinematic 4k')}?width=1280&height=720&nologo=true`);
    if (imgData.length > 5000) { fs.writeFileSync(outPath, imgData); return true; }
  } catch(e) {}
  return false;
}

async function getImage(scene, index) {
  const outPath = `/tmp/img_${index}.jpg`;
  if (index % 2 === 0) {
    if (await downloadPexels(scene.pexels || 'cartoon funny', outPath)) return outPath;
    if (await downloadPollinations(scene.pollinations, outPath)) return outPath;
  } else {
    if (await downloadPollinations(scene.pollinations, outPath)) return outPath;
    if (await downloadPexels(scene.pexels || 'cartoon funny', outPath)) return outPath;
  }
  execSync(`ffmpeg -y -f lavfi -i "color=c=#1a1a2e:size=1280x720:rate=25" -t 1 -frames:v 1 "${outPath}" 2>/dev/null`);
  return outPath;
}

async function createSceneClip(scene, index, lang) {
  const d = scene[lang];
  console.log(`  [${lang.toUpperCase()}] Scene ${index + 1}: ${d.text.substring(0, 38)}...`);
  const imgPath = await getImage(scene, index);
  const audioPath = `/tmp/audio_${lang}_${index}.mp3`;
  await getEdgeTTS(d.speech, lang, audioPath);

  let audioDur = 8;
  try {
    const probe = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}" 2>/dev/null`).toString().trim();
    const v = parseFloat(probe); if (!isNaN(v) && v > 1) audioDur = v + 1.5;
  } catch(e) {}

  const clipPath = `/tmp/clip_${lang}_${index}.mp4`;
  const textSafe = d.text.replace(/['":\\[\]]/g, ' ').substring(0, 52);

  execSync(`ffmpeg -y -loop 1 -i "${imgPath}" -i "${audioPath}" -t ${Math.ceil(audioDur)} -vf "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,drawbox=x=0:y=570:w=1280:h=150:color=black@0.85:t=fill,drawtext=text='${textSafe}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=608:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" -c:v libx264 -c:a aac -pix_fmt yuv420p -r 25 -shortest "${clipPath}" 2>&1`, { timeout: 120000 });

  return clipPath;
}

async function buildVideo(vid, lang) {
  const clips = [];
  let firstImgPath = null;
  for (let i = 0; i < vid.scenes.length; i++) {
    clips.push(await createSceneClip(vid.scenes[i], i, lang));
    if (i === 1) firstImgPath = `/tmp/img_${i}.jpg`;
  }

  const concatFile = `/tmp/concat_${lang}.txt`;
  fs.writeFileSync(concatFile, clips.map(p => `file '${p}'`).join('\n'));
  const rawPath = `/tmp/raw_${lang}.mp4`;
  execSync(`ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c:v libx264 -c:a aac -pix_fmt yuv420p "${rawPath}" 2>&1`, { timeout: 300000 });

  const outPath = `/tmp/final_${lang}.mp4`;
  const musicPath = await getMusic();
  if (musicPath) {
    try {
      execSync(`ffmpeg -y -i "${rawPath}" -stream_loop -1 -i "${musicPath}" -filter_complex "[1:a]volume=0.10[m];[0:a][m]amix=inputs=2:duration=first[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -shortest "${outPath}" 2>&1`, { timeout: 120000 });
    } catch(e) { fs.copyFileSync(rawPath, outPath); }
  } else { fs.copyFileSync(rawPath, outPath); }

  const thumbPath = await generateThumbnail(vid, lang, firstImgPath);
  return { videoPath: outPath, thumbPath };
}

async function uploadYouTube(meta, videoPath) {
  const videoData = fs.readFileSync(videoPath);
  const metaJson = JSON.stringify({
    snippet: { title: meta.title, description: meta.description, tags: meta.tags, categoryId: '27' },
    status: { privacyStatus: 'public' }
  });
  const bnd = 'kraken_bnd';
  const bodyStart = Buffer.from(`--${bnd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n--${bnd}\r\nContent-Type: video/mp4\r\n\r\n`);
  const bodyEnd = Buffer.from(`\r\n--${bnd}--`);
  const fullBody = Buffer.concat([bodyStart, videoData, bodyEnd]);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'www.googleapis.com',
      path: '/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token.access_token}`, 'Content-Type': `multipart/related; boundary=${bnd}`, 'Content-Length': fullBody.length }
    }, (res) => {
      let data = ''; res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject); req.write(fullBody); req.end();
  });
}

async function uploadThumbnail(videoId, thumbPath) {
  try {
    if (!thumbPath || !fs.existsSync(thumbPath)) return;
    const thumbData = fs.readFileSync(thumbPath);
    await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'www.googleapis.com',
        path: `/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`,
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token.access_token}`, 'Content-Type': 'image/jpeg', 'Content-Length': thumbData.length }
      }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
      req.on('error', reject); req.write(thumbData); req.end();
    });
    console.log('Thumb uploaded for', videoId);
  } catch(e) { console.log('Thumb upload err:', e.message); }
}

async function autoPublish() {
  if (!token) return;
  console.log('Auto: publication...');
  try {
    await refreshToken();
    const vid = VIDEOS[publishCount % VIDEOS.length];
    publishCount++;
    const en = await buildVideo(vid, 'en');
    const fr = await buildVideo(vid, 'fr');
    const r1 = await uploadYouTube(vid.en, en.videoPath);
    const r2 = await uploadYouTube(vid.fr, fr.videoPath);
    if (r1.id) await uploadThumbnail(r1.id, en.thumbPath);
    if (r2.id) await uploadThumbnail(r2.id, fr.thumbPath);
    lastPublished = new Date().toISOString();
    console.log(`Auto OK: EN=${r1.id} FR=${r2.id}`);
  } catch(e) { console.log('Auto err:', e.message); }
}

// Serveur
const server = http.createServer(async (req, res) => {
  const p = url.parse(req.url).pathname;
  const q = url.parse(req.url, true).query;

  if (p === '/auth') {
    res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube&access_type=offline&prompt=consent` });
    res.end();
  }
  else if (p === '/callback') {
    const body = `code=${q.code}&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&grant_type=authorization_code`;
    token = await httpsPost('oauth2.googleapis.com', '/token', { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }, body);
    fs.writeFileSync('/tmp/token.json', JSON.stringify(token));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>YouTube connecté !</h1><a href="/">Accueil</a>');
  }
  else if (p === '/publish') {
    if (!token) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<a href="/auth">Connecter YouTube</a>'); return; }
    await refreshToken();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const vid = VIDEOS[Math.floor(Math.random() * VIDEOS.length)];
    res.write(`<h1>Génération en cours...</h1><p>EN: ${vid.en.title}</p><p>FR: ${vid.fr.title}</p>`);
    try {
      const en = await buildVideo(vid, 'en');
      const fr = await buildVideo(vid, 'fr');
      const r1 = await uploadYouTube(vid.en, en.videoPath);
      const r2 = await uploadYouTube(vid.fr, fr.videoPath);
      if (r1.id) await uploadThumbnail(r1.id, en.thumbPath);
      if (r2.id) await uploadThumbnail(r2.id, fr.thumbPath);
      lastPublished = new Date().toISOString();
      publishCount++;
      res.end(`<h2>✅ 2 vidéos publiées !</h2><a href="/">Accueil</a>`);
    } catch(e) { res.end(`<p>Erreur: ${e.message}</p><a href="/publish">Réessayer</a>`); }
  }
  else if (p === '/auto-on') {
    autoMode = true;
    if (autoInterval) clearInterval(autoInterval);
    autoInterval = setInterval(autoPublish, 24 * 60 * 60 * 1000);
    autoPublish();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>Mode Auto activé !</h1><a href="/">Accueil</a>');
  }
  else if (p === '/auto-off') {
    autoMode = false;
    if (autoInterval) { clearInterval(autoInterval); autoInterval = null; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>Mode Auto désactivé</h1><a href="/">Accueil</a>');
  }
  else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html><body style="font-family:Arial;padding:20px;background:#111;color:#fff;max-width:600px;margin:auto">
      <h1>🎉 LES CALAMITY CREW Bot</h1>
      <p>Dessin animé hilarant prêt à tourner !</p>
      <p>YouTube: <b>${token ? '✅ Connecté' : '❌ Non connecté'}</b></p>
      <hr>
      <a href="/auth" style="display:block;margin:10px;padding:15px;background:#333;color:white;text-align:center;border-radius:8px">🔗 Connecter YouTube</a>
      <a href="/publish" style="display:block;margin:10px;padding:15px;background:#c00;color:white;text-align:center;border-radius:8px">🚀 Publier une vidéo maintenant</a>
      <a href="/auto-on" style="display:block;margin:10px;padding:15px;background:#060;color:white;text-align:center;border-radius:8px">🤖 Activer Mode Auto</a>
    </body></html>`);
  }
});

server.listen(PORT, () => console.log('🎉 Calamity Crew Bot démarré sur port ' + PORT));
