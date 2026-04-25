const http = require('http');
const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const { google } = require('googleapis');

const PORT = process.env.PORT || 8080;
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI || process.env.REDIRECT_URI;
const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY;
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';

let savedToken = process.env.YOUTUBE_TOKEN ? JSON.parse(process.env.YOUTUBE_TOKEN) : null;

function getOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (u) => {
      const mod = u.startsWith('https') ? https : require('http');
      mod.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
        if ([301, 302, 303].includes(res.statusCode)) return follow(res.headers.location);
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
        const chunks = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => { fs.writeFileSync(dest, Buffer.concat(chunks)); resolve(dest); });
        res.on('error', reject);
      }).on('error', reject);
    };
    follow(url);
  });
}

async function generateImage(prompt, index) {
  const dest = `/tmp/img_${index}.jpg`;
  const clean = `/tmp/imgc_${index}.jpg`;
  const seed = Math.floor(Math.random() * 99999);
  const full = prompt + ', cinematic 8K, dramatic lighting, ultra-realistic';
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(full)}?width=1920&height=1080&seed=${seed}&model=flux&nologo=true`;
  console.log(`Image ${index + 1}...`);
  await download(url, dest);
  if (fs.statSync(dest).size < 5000) throw new Error('Image trop petite');
  execSync(`ffmpeg -y -i "${dest}" -vf scale=1920:1080 "${clean}" 2>/dev/null`);
  return clean;
}

const FALLBACK = {
  title: "Les Secrets que la Science Vient de Révéler",
  description: "Découvrez les vérités cachées. #viral #science #découverte",
  blocks: [
    "Et si tout ce que tu croyais savoir était faux ? Les scientifiques viennent de faire une découverte qui change tout.",
    "Depuis des décennies, certaines informations sont gardées secrètes. Aujourd'hui on lève enfin le voile.",
    "En 1969, des chercheurs ont découvert quelque chose d'extraordinaire. Personne n'en a parlé pendant 50 ans.",
    "Le cerveau humain traite 11 millions de bits par seconde. On en utilise consciemment que 50. Pourquoi ?",
    "Dans les profondeurs de l'océan, à 11 km de profondeur, vivent des créatures que la science ne comprend pas.",
    "Les grandes entreprises dépensent des milliards pour que tu ne saches pas ça. Voici pourquoi.",
    "En 2019, la NASA a détecté un signal répétitif toutes les 16 jours venant du bord de notre galaxie.",
    "Abonne-toi pour découvrir chaque semaine une nouvelle vérité cachée sur notre monde."
  ],
  imagePrompts: Array(8).fill("cinematic space galaxy stars dramatic lighting 8K ultra realistic")
};

async function generateScript() {
  const topics = [
    "Les secrets que la NASA cache sur l'espace profond",
    "Comment les milliardaires ont construit leur fortune",
    "Les technologies classifiées qui vont changer l'humanité",
    "Ce qui se passe vraiment au fond des océans",
    "Les civilisations avancées avant l'histoire officielle",
    "Ce que ton cerveau fait pendant que tu dors",
    "Pourquoi les génies pensent différemment",
    "La vérité sur l'alimentation industrielle",
    "Pourquoi nous ne sommes peut-être pas seuls dans l'univers",
    "Comment fonctionne vraiment l'argent - le système caché",
  ];
  const topic = topics[Math.floor(Math.random() * topics.length)];
  console.log('Sujet: ' + topic);

  const prompt = `Tu es un createur YouTube viral francais. Ecris un script sur: "${topic}". 8 blocs. Chaque bloc = 2 phrases max 30 mots. Captivant et mysterieux. Reponds UNIQUEMENT avec ce JSON sans markdown: {"title":"titre max 60 chars","description":"description 100 mots","blocks":["bloc1","bloc2","bloc3","bloc4","bloc5","bloc6","bloc7","bloc8"],"imagePrompts":["english visual 1","english visual 2","english visual 3","english visual 4","english visual 5","english visual 6","english visual 7","english visual 8"]}`;

  const seed = Math.floor(Math.random() * 99999);
  const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai&seed=${seed}`;

  return new Promise((resolve) => {
    const req = https.get(url, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const s = data.indexOf('{');
          const e = data.lastIndexOf('}');
          if (s === -1) throw new Error('No JSON');
          const parsed = JSON.parse(data.substring(s, e + 1));
          if (!parsed.blocks || parsed.blocks.length < 3) throw new Error('Too short');
          console.log('Script: ' + parsed.title);
          resolve(parsed);
        } catch (err) {
          console.log('Fallback script');
          resolve(FALLBACK);
        }
      });
    });
    req.on('error', () => resolve(FALLBACK));
    req.setTimeout(30000, () => { req.destroy(); resolve(FALLBACK); });
  });
}

async function generateVoice(text, index) {
  const mp3 = `/tmp/v_${index}.mp3`;
  const wav = `/tmp/v_${index}.wav`;
  const payload = JSON.stringify({
    text: text.substring(0, 400),
    model_id: 'eleven_multilingual_v2',
    voice_settings: { stability: 0.5, similarity_boost: 0.8 }
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${ELEVEN_VOICE}`,
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVEN_KEY,
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 30000
    }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        try {
          fs.writeFileSync(mp3, Buffer.concat(chunks));
          execSync(`ffmpeg -y -i "${mp3}" -ar 44100 -ac 1 "${wav}" 2>/dev/null`);
          resolve(wav);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(payload);
    req.end();
  });
}

async function buildVideo(images, voices, blocks) {
  const segs = [];
  for (let i = 0; i < blocks.length; i++) {
    const img = images[i] || images[0];
    const audio = voices[i] || voices[0];
    const out = `/tmp/seg_${i}.mp4`;
    let dur = 5;
    try {
      dur = Math.max(3, parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audio}"`).toString().trim()) + 0.2);
    } catch (e) {}
    const txt = blocks[i].replace(/['"\\:\[\]{}|<>]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 55);
    const frames = Math.ceil(dur * 25);
    const cmd = `ffmpeg -y -loop 1 -t ${dur} -i "${img}" -i "${audio}" -filter_complex "[0:v]scale=1920:1080,zoompan=z='min(zoom+0.0004,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1920x1080:fps=25,drawbox=x=0:y=900:w=iw:h=180:color=black@0.65:t=fill,drawtext=text='${txt}':fontsize=42:fontcolor=white:x=(w-text_w)/2:y=935:shadowcolor=black@0.9:shadowx=2:shadowy=2[v]" -map "[v]" -map 1:a -c:v libx264 -preset ultrafast -crf 24 -c:a aac -b:a 96k -pix_fmt yuv420p -shortest "${out}"`;
    try {
      execSync(cmd, { stdio: 'pipe', timeout: 90000 });
      segs.push(out);
      console.log(`Seg ${i + 1} OK`);
    } catch (e) {
      console.error(`Seg ${i} raté`);
    }
  }
  if (segs.length === 0) throw new Error('Aucun segment');
  const list = '/tmp/list.txt';
  fs.writeFileSync(list, segs.map(s => `file '${s}'`).join('\n'));
  const final = '/tmp/video.mp4';
  execSync(`ffmpeg -y -f concat -safe 0 -i "${list}" -c copy -movflags +faststart "${final}"`, { stdio: 'pipe', timeout: 180000 });
  segs.forEach(s => { try { fs.unlinkSync(s); } catch (e) {} });
  return final;
}

async function uploadYouTube(videoPath, title, description) {
  const auth = getOAuth2Client();
  auth.setCredentials(savedToken);
  const yt = google.youtube({ version: 'v3', auth });
  const res = await yt.videos.insert({
    part: 'snippet,status',
    requestBody: {
      snippet: {
        title,
        description: description || `${title}\n\n#viral #découverte #science #France`,
        tags: ['viral', 'science', 'découverte', 'France', 'incroyable'],
        categoryId: '28',
        defaultLanguage: 'fr'
      },
      status: { privacyStatus: 'public' }
    },
    media: { body: fs.createReadStream(videoPath) }
  });
  return res.data;
}

async function run() {
  console.log('=== START ===');
  const script = await generateScript();
  const blocks = script.blocks.slice(0, 8);
  const prompts = (script.imagePrompts || []).slice(0, 8);

  const imgResults = await Promise.all(
    blocks.map((_, i) => generateImage(prompts[i] || 'cinematic landscape dramatic 8K', i).catch(e => { console.error('img ' + i + ':', e.message); return null; }))
  );
  const images = imgResults.filter(Boolean);
  if (images.length === 0) throw new Error('Aucune image');

  const voices = [];
  for (let i = 0; i < blocks.length; i++) {
    try { voices.push(await generateVoice(blocks[i], i)); console.log(`Voix ${i + 1} OK`); }
    catch (e) { console.error(`Voix ${i}:`, e.message); }
  }
  if (voices.length === 0) throw new Error('Aucune voix');

  const videoPath = await buildVideo(images, voices, blocks.slice(0, voices.length));
  const result = await uploadYouTube(videoPath, script.title, script.description);
  console.log('PUBLIE: https://youtube.com/watch?v=' + result.id);
  [videoPath, ...images, ...voices].forEach(f => { try { fs.unlinkSync(f); } catch (e) {} });
  return result;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  if (p === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>KRAKEN</title>
<style>body{font-family:sans-serif;background:#0a0a0a;color:#fff;padding:40px;text-align:center}
h1{font-size:2.5em;color:#ff6b35}.btn{display:inline-block;margin:10px;padding:15px 30px;background:#ff6b35;color:#fff;text-decoration:none;border-radius:8px;font-size:1.1em;font-weight:bold}
.s{margin-top:20px;padding:15px;background:#1a1a1a;border-radius:8px}</style></head>
<body><h1>🦑 KRAKEN</h1><p style="color:#aaa">Bot YouTube Automatique</p>
<div class="s"><p>YouTube: <strong style="color:${savedToken ? '#4ade80' : '#f87171'}">${savedToken ? '✅ Connecté' : '❌ Non connecté'}</strong></p></div><br>
<a class="btn" href="/auth">🔗 Connecter YouTube</a>
<a class="btn" href="/publish">🎬 Générer & Publier</a>
<a class="btn" href="/status">📊 Statut</a></body></html>`);

  } else if (p === '/auth') {
    const auth = getOAuth2Client();
    res.writeHead(302, { Location: auth.generateAuthUrl({ access_type: 'offline', scope: ['https://www.googleapis.com/auth/youtube.upload'], prompt: 'consent' }) });
    res.end();

  } else if (p === '/oauth2callback' || p === '/callback') {
    const code = url.searchParams.get('code');
    if (!code) { res.writeHead(400); res.end('Code manquant'); return; }
    const auth = getOAuth2Client();
    const { tokens } = await auth.getToken(code);
    savedToken = tokens;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<html><body style="font-family:sans-serif;background:#0a0a0a;color:#fff;padding:40px;text-align:center">
<h1>✅ Connecté !</h1><p style="color:#aaa">Copie dans Railway → YOUTUBE_TOKEN :</p>
<textarea style="width:90%;height:120px;background:#1a1a1a;color:#4ade80;padding:10px;border:1px solid #333;border-radius:8px">${JSON.stringify(tokens)}</textarea>
<br><br><a href="/publish" style="padding:15px 30px;background:#ff6b35;color:#fff;text-decoration:none;border-radius:8px">🎬 Générer</a></body></html>`);

  } else if (p === '/publish') {
    if (!savedToken) { res.writeHead(302, { Location: '/auth' }); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.write(`<html><head><meta charset="utf-8"><title>Génération...</title>
<style>body{font-family:sans-serif;background:#0a0a0a;color:#fff;padding:40px}h1{color:#ff6b35}</style></head>
<body><h1>🎬 Génération en cours...</h1><p style="color:#aaa">Patiente 5-10 minutes.</p>`);
    try {
      const result = await run();
      res.end(`<h2 style="color:#4ade80">🎉 Publiée !</h2>
<a href="https://youtube.com/watch?v=${result.id}" target="_blank" style="padding:15px 30px;background:#ff6b35;color:#fff;text-decoration:none;border-radius:8px">▶️ Voir sur YouTube</a>
<br><br><a href="/publish" style="color:#aaa">🔄 Encore une</a></body></html>`);
    } catch (e) {
      res.end(`<h2 style="color:#f87171">❌ ${e.message}</h2><a href="/" style="color:#ff6b35">← Retour</a></body></html>`);
    }

  } else if (p === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ connecte: !!savedToken, tokenExpiry: savedToken?.expiry_date ? new Date(savedToken.expiry_date).toISOString() : null, ffmpeg: (() => { try { execSync('which ffmpeg'); return 'OK'; } catch (e) { return 'ABSENT'; } })() }));

  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`KRAKEN port ${PORT}`);
  console.log(`YouTube: ${savedToken ? 'OK' : 'Non connecte'}`);
  try { execSync('which ffmpeg'); console.log('FFmpeg: OK'); } catch (e) { console.log('FFmpeg: ABSENT'); }
});
