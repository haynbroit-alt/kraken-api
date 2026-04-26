'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const { execSync, exec } = require('child_process');
const url = require('url');
const path = require('path');
const querystring = require('querystring');

// ─── CONFIG ───────────────────────────────────────────────
const PORT         = process.env.PORT || 8080;
const CLIENT_ID    = process.env.GOOGLE_CLIENT_ID    || '';
const CLIENT_SECRET= process.env.GOOGLE_CLIENT_SECRET|| '';
const REDIRECT_URI = process.env.REDIRECT_URI        || `https://kraken-api-production.up.railway.app/callback`;
const ELEVEN_KEY   = process.env.ELEVEN_KEY          || '';
const MISTRAL_KEY  = process.env.MISTRAL_KEY         || '48LY8qvyB5zaNvEOrjtKRKuO73kTtM0o';

// ─── STATE ────────────────────────────────────────────────
let token = null;
const TOKEN_FILE = '/tmp/token.json';
if (fs.existsSync(TOKEN_FILE)) {
  try { token = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')); } catch(e) {}
}

// jobStatus: { status: 'pending'|'done'|'error', message, videoId, url }
let jobStatus = null;
let jobRunning = false;

// ─── TOPICS ───────────────────────────────────────────────
const TOPICS = [
  "Les secrets que les riches cachent aux pauvres",
  "Ce que la science dit sur le sommeil profond",
  "Les 5 habitudes des millionnaires avant 30 ans",
  "Comment notre cerveau sabote nos décisions financières",
  "Les vérités cachées sur l'alimentation moderne",
  "Pourquoi 90% des gens échouent dans leurs objectifs",
  "Les techniques de manipulation utilisées par les médias",
  "Ce que les médecins ne vous disent pas sur votre santé",
  "Comment les grandes entreprises contrôlent notre attention",
  "Les mystères de l'univers que la science ne peut expliquer",
];

// ─── SCRIPT GENERATION (Mistral → Pollinations → Fallback) ─
function fallbackScript(topic) {
  return {
    title: topic,
    description: `Découvrez les vérités cachées sur : ${topic}`,
    blocks: [
      `Introduction : ${topic} est un sujet qui fascine des millions de personnes.`,
      `Première révélation : les recherches montrent que notre perception habituelle est souvent erronée.`,
      `Deuxième révélation : les personnes qui réussissent appliquent des principes méconnus du grand public.`,
      `Abonnez-vous pour recevoir chaque jour des vérités que peu osent vous dire.`,
      `Merci de votre attention — votre transformation commence maintenant.`,
    ],
  };
}

async function generateScriptMistral(topic) {
  return new Promise((resolve, reject) => {
    const prompt = `Tu es un créateur de contenu YouTube viral. Génère un script pour une vidéo de 5 minutes sur le sujet : "${topic}".

Le script doit avoir EXACTEMENT 20 blocs de texte narratif (environ 30 mots chacun), un titre accrocheur et une description YouTube.

Réponds UNIQUEMENT en JSON valide, sans commentaires, sans markdown, dans ce format exact :
{"title":"...","description":"...","blocks":["bloc1","bloc2",...,"bloc20"]}`;

    const payload = JSON.stringify({
      model: 'mistral-small-latest',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.8,
    });

    const req = https.request({
      hostname: 'api.mistral.ai',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_KEY}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const text = json.choices[0].message.content;
          const start = text.indexOf('{');
          const end = text.lastIndexOf('}');
          const parsed = JSON.parse(text.substring(start, end + 1));
          if (!parsed.blocks || parsed.blocks.length < 3) throw new Error('Trop court');
          while (parsed.blocks.length < 5) parsed.blocks.push(parsed.blocks[parsed.blocks.length - 1]);
          parsed.blocks = parsed.blocks.slice(0, 5);
          console.log(`Script Mistral OK: ${parsed.blocks.length} blocs`);
          resolve(parsed);
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout Mistral')); });
    req.write(payload);
    req.end();
  });
}

async function generateScriptPollinations(topic) {
  return new Promise((resolve, reject) => {
    const prompt = encodeURIComponent(
      `Génère un script YouTube 5 minutes sur "${topic}". Réponds UNIQUEMENT en JSON: {"title":"...","description":"...","blocks":["...x20 blocs de 30 mots chacun..."]}`
    );
    const req = https.get(`https://text.pollinations.ai/${prompt}`, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const s = data.indexOf('{');
          const e = data.lastIndexOf('}');
          const parsed = JSON.parse(data.substring(s, e + 1));
          if (!parsed.blocks || parsed.blocks.length < 3) throw new Error('Trop court');
          while (parsed.blocks.length < 5) parsed.blocks.push(parsed.blocks[parsed.blocks.length - 1]);
          parsed.blocks = parsed.blocks.slice(0, 5);
          console.log(`Script Pollinations OK: ${parsed.blocks.length} blocs`);
          resolve(parsed);
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout Pollinations')); });
  });
}

async function generateScript(topic) {
  try { return await generateScriptMistral(topic); } catch(e) {
    console.log('Mistral échoué, Pollinations...');
    try { return await generateScriptPollinations(topic); } catch(e2) {
      console.log('Pollinations échoué, fallback...');
      return fallbackScript(topic);
    }
  }
}

// ─── IMAGE GENERATION (100% FFmpeg local, zero réseau) ────
const COLORS = ['1a1a2e','16213e','0f3460','1b1b2f','2d132c','1a0a2e','0d1b2a','1c2541','2e4057','3b1f2b'];

async function generateImage(prompt, index) {
  const imgPath = `/tmp/img_${index}.jpg`;
  const color = COLORS[index % COLORS.length];
  const text = prompt.slice(0, 50).replace(/[\'"\\:]/g, ' ');
  try {
    execSync(
      `ffmpeg -y -f lavfi -i color=c=0x${color}:size=1280x720:rate=1 -vf "drawtext=text='${text}':fontcolor=white:fontsize=32:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.5:boxborderw=8" -frames:v 1 "${imgPath}" 2>/dev/null`,
      { timeout: 15000 }
    );
    console.log(`Image ${index} FFmpeg OK`);
    return imgPath;
  } catch(e) {
    execSync(`ffmpeg -y -f lavfi -i color=c=black:size=1280x720:rate=1 -frames:v 1 "${imgPath}" 2>/dev/null`);
    console.log(`Image ${index} fond noir OK`);
    return imgPath;
  }
}
// ─── VOICE GENERATION (ElevenLabs → Google TTS) ───────────
async function generateVoiceElevenLabs(text, index) {
  return new Promise((resolve, reject) => {
    const mp3 = `/tmp/voice_${index}.mp3`;
    const wav = `/tmp/voice_${index}.wav`;
    const payload = JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.8 },
    });
    const req = https.request({
      hostname: 'api.elevenlabs.io',
      path: '/v1/text-to-speech/pNInz6obpgDQGcFmaJgB',
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          const buf = Buffer.concat(chunks);
          if (buf.length < 1000) throw new Error('ElevenLabs réponse invalide');
          fs.writeFileSync(mp3, buf);
          execSync(`ffmpeg -y -i "${mp3}" -ar 44100 -ac 1 "${wav}" 2>/dev/null`);
          resolve(wav);
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout ElevenLabs')); });
    req.write(payload);
    req.end();
  });
}

async function generateVoiceGoogle(text, index) {
  return new Promise((resolve, reject) => {
    const wav = `/tmp/voice_${index}.wav`;
    const safeText = encodeURIComponent(text.slice(0, 200));
    const reqUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${safeText}&tl=fr&client=tw-ob`;
    const mp3 = `/tmp/gtts_${index}.mp3`;
    const file = fs.createWriteStream(mp3);
    https.get(reqUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        try {
          execSync(`ffmpeg -y -i "${mp3}" -ar 44100 -ac 1 "${wav}" 2>/dev/null`);
          resolve(wav);
        } catch(e) { reject(e); }
      });
    }).on('error', reject);
    setTimeout(() => reject(new Error('Timeout Google TTS')), 20000);
  });
}

async function generateVoiceSilence(text, index) {
  // Fallback ultime : génère un silence de la durée estimée du texte
  const wav = `/tmp/voice_${index}.wav`;
  const words = text.split(' ').length;
  const duration = Math.max(3, Math.round(words / 2.5)); // ~2.5 mots/sec
  execSync(`ffmpeg -y -f lavfi -i aevalsrc=0:c=mono:s=44100 -t ${duration} "${wav}" 2>/dev/null`);
  console.log(`Voix ${index} silence OK (${duration}s)`);
  return wav;
}

async function generateVoice(text, index) {
  // 1. ElevenLabs
  if (ELEVEN_KEY) {
    try { return await generateVoiceElevenLabs(text, index); }
    catch(e) { console.log(`ElevenLabs échoué bloc ${index}: ${e.message}`); }
  }
  // 2. Google TTS
  try { return await generateVoiceGoogle(text, index); }
  catch(e) { console.log(`Google TTS échoué bloc ${index}: ${e.message}`); }
  // 3. Silence FFmpeg — jamais d'échec
  return await generateVoiceSilence(text, index);
}

// ─── VIDEO ASSEMBLY ───────────────────────────────────────
function buildVideo(segments, outputPath) {
  // Crée un fichier concat pour les segments
  const concatFile = '/tmp/concat.txt';
  const lines = segments.map(s => `file '${s}'\n`).join('');
  fs.writeFileSync(concatFile, lines);
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c:v libx264 -c:a aac -pix_fmt yuv420p "${outputPath}" 2>/dev/null`,
    { timeout: 300000 }
  );
}

function buildSegment(imgPath, voicePath, index) {
  const out = `/tmp/seg_${index}.mp4`;
  execSync(
    `ffmpeg -y -loop 1 -i "${imgPath}" -i "${voicePath}" \
     -c:v libx264 -tune stillimage -c:a aac -b:a 128k \
     -pix_fmt yuv420p -shortest "${out}" 2>/dev/null`,
    { timeout: 60000 }
  );
  return out;
}

// ─── YOUTUBE UPLOAD ───────────────────────────────────────
async function refreshToken() {
  if (!token || !token.refresh_token) return;
  return new Promise((resolve, reject) => {
    const payload = querystring.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token',
    });
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (j.access_token) {
            token.access_token = j.access_token;
            fs.writeFileSync(TOKEN_FILE, JSON.stringify(token));
          }
          resolve();
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function uploadYouTube(videoPath, title, description) {
  await refreshToken();
  return new Promise((resolve, reject) => {
    const meta = JSON.stringify({
      snippet: { title: title.slice(0, 100), description, tags: ['découverte', 'viral', 'vérité', 'secrets'], categoryId: '22' },
      status: { privacyStatus: 'public' },
    });
    const boundary = 'boundary_kraken_xyz';
    const videoData = fs.readFileSync(videoPath);
    const header = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--`);
    const body = Buffer.concat([header, videoData, footer]);

    const req = https.request({
      hostname: 'www.googleapis.com',
      path: '/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
        'Content-Length': body.length,
      },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          resolve(j);
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── MAIN PIPELINE (tourne en arrière-plan) ───────────────
async function runPipeline() {
  if (jobRunning) return;
  jobRunning = true;
  jobStatus = { status: 'pending', message: '🎬 Choix du sujet...' };

  try {
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    console.log(`Sujet: ${topic}`);
    jobStatus.message = `📝 Génération du script : "${topic}"...`;

    // 1. Script
    const script = await generateScript(topic);
    console.log(`Script OK: ${script.blocks.length} blocs`);
    jobStatus.message = `🖼️ Génération des images (${script.blocks.length} scènes)...`;

    // 2. Images en parallèle (5 à la fois)
    const images = [];
    const IMG_BATCH = 5;
    for (let b = 0; b < script.blocks.length; b += IMG_BATCH) {
      const batch = script.blocks.slice(b, b + IMG_BATCH);
      const results = await Promise.all(
        batch.map((txt, j) => generateImage(txt, b + j).catch(e => {
          console.log(`Image ${b+j} échouée: ${e.message}`);
          return null;
        }))
      );
      images.push(...results);
      jobStatus.message = `🖼️ Images: ${Math.min(b + IMG_BATCH, script.blocks.length)}/${script.blocks.length}...`;
    }

    // 3. Voix en parallèle (5 à la fois)
    jobStatus.message = `🎙️ Génération des voix (${script.blocks.length} blocs)...`;
    const voices = [];
    const VOI_BATCH = 5;
    for (let b = 0; b < script.blocks.length; b += VOI_BATCH) {
      const batch = script.blocks.slice(b, b + VOI_BATCH);
      const results = await Promise.all(
        batch.map((txt, j) => generateVoice(txt, b + j).catch(e => {
          console.log(`Voix ${b+j} échouée: ${e.message}`);
          return null;
        }))
      );
      voices.push(...results);
      jobStatus.message = `🎙️ Voix: ${Math.min(b + VOI_BATCH, script.blocks.length)}/${script.blocks.length}...`;
    }

    // 4. Assemblage segments
    jobStatus.message = `⚙️ Assemblage de la vidéo...`;
    const segments = [];
    for (let i = 0; i < script.blocks.length; i++) {
      const img = images[i];
      const vox = voices[i];
      if (!img || !vox) { console.log(`Segment ${i} ignoré (img ou voix manquante)`); continue; }
      try {
        const seg = buildSegment(img, vox, i);
        segments.push(seg);
        console.log(`Segment ${i + 1}/${script.blocks.length} OK`);
      } catch(e) {
        console.log(`Segment ${i} erreur: ${e.message}`);
      }
    }

    if (segments.length < 1) throw new Error(`Trop peu de segments: ${segments.length}`);

    const videoPath = '/tmp/final_video.mp4';
    buildVideo(segments, videoPath);
    const duration = execSync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${videoPath}"`).toString().trim();
    console.log(`Vidéo finale: ${duration}s, ${(fs.statSync(videoPath).size / 1024 / 1024).toFixed(1)}MB`);

    // 5. Upload YouTube
    jobStatus.message = `📤 Upload YouTube en cours...`;
    const result = await uploadYouTube(videoPath, script.title, script.description);

    if (result.id) {
      jobStatus = {
        status: 'done',
        message: `✅ Vidéo publiée !`,
        videoId: result.id,
        url: `https://youtube.com/watch?v=${result.id}`,
        title: script.title,
        duration: `${Math.round(parseFloat(duration))}s`,
        segments: segments.length,
      };
      console.log(`YouTube OK: ${result.id}`);
    } else {
      throw new Error(`YouTube erreur: ${JSON.stringify(result).slice(0, 200)}`);
    }

  } catch(e) {
    console.error(`Pipeline erreur: ${e.message}`);
    jobStatus = { status: 'error', message: `❌ Erreur: ${e.message}` };
  } finally {
    jobRunning = false;
  }
}

// ─── HTTP SERVER ──────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const p = parsed.pathname;

  // ── Auth Google ──
  if (p === '/auth') {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code&scope=${encodeURIComponent('https://www.googleapis.com/auth/youtube.upload')}` +
      `&access_type=offline&prompt=consent`;
    res.writeHead(302, { Location: authUrl });
    return res.end();
  }

  // ── Callback OAuth ──
  if (p === '/callback') {
    const code = parsed.query.code;
    const payload = querystring.stringify({
      code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI, grant_type: 'authorization_code',
    });
    const tokenReq = https.request({
      hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) },
    }, tokenRes => {
      let d = '';
      tokenRes.on('data', c => d += c);
      tokenRes.on('end', () => {
        token = JSON.parse(d);
        fs.writeFileSync(TOKEN_FILE, JSON.stringify(token));
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h2>✅ YouTube connecté !</h2><p><a href="/publish">🚀 Publier une vidéo</a></p>`);
      });
    });
    tokenReq.write(payload);
    return tokenReq.end();
  }

  // ── Publish (réponse IMMÉDIATE + pipeline en arrière-plan) ──
  if (p === '/publish') {
    if (!token) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`<h2>⚠️ Non connecté</h2><p><a href="/auth">Connecter YouTube</a></p>`);
    }

    // Lance le pipeline en arrière-plan si pas déjà en cours
    if (!jobRunning) {
      jobStatus = { status: 'pending', message: '🚀 Démarrage...' };
      runPipeline(); // pas de await — on répond immédiatement
    }

    // Réponse immédiate avec page qui se rafraîchit
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<!DOCTYPE html><html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="10">
  <title>Kraken Bot</title>
  <style>
    body { font-family: sans-serif; background: #0a0a0f; color: #e8e0d0; text-align: center; padding: 40px; }
    h1 { color: #ff6b35; }
    .status { font-size: 1.3em; margin: 30px; padding: 20px; background: #1a1a2e; border-radius: 10px; }
    a { color: #ff6b35; }
    .done { color: #00ff88; font-size: 1.5em; }
    .error { color: #ff4444; }
  </style>
</head>
<body>
  <h1>🦑 KRAKEN BOT</h1>
  <div class="status">
    ${jobStatus
      ? jobStatus.status === 'done'
        ? `<p class="done">✅ ${jobStatus.title}</p>
           <p>Durée: ${jobStatus.duration} | Segments: ${jobStatus.segments}</p>
           <p><a href="${jobStatus.url}" target="_blank">▶️ Voir sur YouTube</a></p>`
        : jobStatus.status === 'error'
        ? `<p class="error">${jobStatus.message}</p><p><a href="/publish">🔄 Réessayer</a></p>`
        : `<p>⏳ ${jobStatus.message}</p><p style="color:#888;font-size:0.9em">La page se rafraîchit automatiquement toutes les 10 secondes...</p>`
      : '<p>Aucun job en cours.</p>'
    }
  </div>
  <p><a href="/">🏠 Accueil</a> | <a href="/status">📊 Statut JSON</a> | <a href="/auto">⏰ Mode auto</a></p>
</body></html>`);
  }

  // ── Status JSON ──
  if (p === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ connecte: !!token, jobRunning, jobStatus }));
  }

  // ── Auto (1 vidéo toutes les 24h) ──
  if (p === '/auto') {
    if (!token) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`<h2>⚠️ Connecte YouTube d'abord</h2><a href="/auth">Se connecter</a>`);
    }
    setInterval(() => { if (!jobRunning) runPipeline(); }, 24 * 60 * 60 * 1000);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<h2>✅ Mode auto activé !</h2><p>1 vidéo publiée toutes les 24h.</p><a href="/publish">Publier maintenant</a>`);
  }

  // ── Accueil ──
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!DOCTYPE html><html>
<head><meta charset="utf-8"><title>Kraken Bot</title>
<style>
  body { font-family: sans-serif; background: #0a0a0f; color: #e8e0d0; text-align: center; padding: 60px; }
  h1 { color: #ff6b35; font-size: 3em; margin-bottom: 10px; }
  a { display: block; margin: 15px auto; width: 280px; padding: 15px; background: #1a1a2e;
      border: 2px solid #ff6b35; border-radius: 10px; color: #e8e0d0; text-decoration: none; font-size: 1.1em; }
  a:hover { background: #ff6b35; color: #000; }
  .status { color: ${token ? '#00ff88' : '#ff4444'}; margin-bottom: 20px; }
</style></head>
<body>
  <h1>🦑 KRAKEN BOT</h1>
  <p class="status">${token ? '✅ YouTube connecté' : '⚠️ YouTube non connecté'}</p>
  <a href="/auth">🔑 1. Connecter YouTube</a>
  <a href="/publish">🚀 2. Publier une vidéo</a>
  <a href="/auto">⏰ 3. Mode automatique (24h)</a>
  <a href="/status">📊 Statut</a>
</body></html>`);
});

// AUTO-PING toutes les 8 minutes pour garder Railway eveille
setInterval(() => {
  https.get('https://kraken-api-production.up.railway.app/status', res => {
    console.log('Ping OK: ' + res.statusCode);
  }).on('error', e => console.log('Ping erreur: ' + e.message));
}, 8 * 60 * 1000);

server.listen(PORT, () => console.log(`🦑 KRAKEN API demarré sur port ${PORT}`));
