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
const MISTRAL_KEY = process.env.MISTRAL_API_KEY;

let savedToken = process.env.YOUTUBE_TOKEN ? JSON.parse(process.env.YOUTUBE_TOKEN) : null;

function getOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

// ─── Download ─────────────────────────────────────────────────────────────────
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (u) => {
      const mod = u.startsWith('https') ? https : require('http');
      mod.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
        if ([301,302,303].includes(res.statusCode)) return follow(res.headers.location);
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

// ─── Image ────────────────────────────────────────────────────────────────────
async function generateImage(prompt, index) {
  const dest = `/tmp/img_${index}.jpg`;
  const clean = `/tmp/imgc_${index}.jpg`;
  const seed = Math.floor(Math.random() * 99999);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ', cinematic 8K, dramatic lighting')}?width=1920&height=1080&seed=${seed}&model=flux&nologo=true`;
  console.log('Image ' + (index+1) + '...');
  await download(url, dest);
  if (fs.statSync(dest).size < 5000) throw new Error('Image corrompue');
  execSync(`ffmpeg -y -i "${dest}" -vf scale=1920:1080 "${clean}" 2>/dev/null`);
  return clean;
}

// ─── Script ───────────────────────────────────────────────────────────────────
const FALLBACK = {
  title: "Les Secrets que la Science Vient de Révéler",
  description: "Découvrez les vérités cachées sur notre univers. #viral #science",
  blocks: [
    "Et si tout ce que tu croyais savoir était faux ? Une découverte vient de changer absolument tout.",
    "Depuis des décennies, certaines informations sont gardées secrètes. Aujourd'hui on lève enfin le voile.",
    "En 1969, des chercheurs ont découvert quelque chose d'extraordinaire. Personne n'en a parlé pendant 50 ans.",
    "Le cerveau humain traite 11 millions de bits par seconde. On en utilise consciemment que 50. Pourquoi ?",
    "Dans les profondeurs de l'océan à 11 km, vivent des créatures que la science ne comprend toujours pas.",
    "Les grandes entreprises dépensent des milliards pour que tu ne saches pas ça. Voici exactement pourquoi.",
    "En 2019, la NASA a détecté un signal qui se répète toutes les 16 jours venant du bord de notre galaxie.",
    "Des physiciens de Princeton affirment que le temps n'existe pas vraiment. C'est prouvé mathématiquement.",
    "Ce que tu manges chaque jour contient des substances interdites dans 48 pays. Tu n'es pas censé le savoir.",
    "Les milliardaires utilisent une technique mentale précise chaque matin. Elle prend 3 minutes. La voici.",
    "Des documents déclassifiés de la CIA révèlent des expériences sur le cerveau humain entre 1953 et 1973.",
    "La vérité sur le sommeil est stupéfiante. Pendant 8 heures, ton cerveau accomplit quelque chose d'incroyable.",
    "Il existe 7 lieux sur Terre où les lois de la physique semblent ne pas s'appliquer. Les scientifiques sont perplexes.",
    "Une étude de Harvard sur 80 ans a trouvé la vraie clé du bonheur. Ce n'est pas l'argent ni le succès.",
    "Des mathématiciens ont calculé que la probabilité que nous soyons seuls dans l'univers est de 0,00000001%.",
    "Le premier empire mondial a existé il y a 12 000 ans. Il a été effacé de l'histoire officielle intentionnellement.",
    "Ton téléphone écoute tes conversations. Voici la preuve technique et comment t'en protéger immédiatement.",
    "Les scientifiques ont découvert que l'univers a une fréquence. Écouter cette fréquence change ton cerveau.",
    "Ce que tu viens d'apprendre n'est que la surface. La vérité est bien plus profonde et plus troublante encore.",
    "Abonne-toi maintenant pour découvrir chaque semaine une vérité cachée qui va changer ta vision du monde."
  ],
  imagePrompts: Array(20).fill("cinematic space galaxy stars dramatic lighting 8K ultra realistic")
};

async function generateScript() {
  const topics = [
    "Les secrets que la NASA cache sur l'espace profond",
    "Comment les milliardaires ont construit leur fortune - la verite cachee",
    "Les technologies classifiees qui vont changer l'humanite",
    "Ce qui se passe vraiment au fond des oceans",
    "Les civilisations avancees qui ont existe avant l'histoire officielle",
    "Ce que ton cerveau fait pendant que tu dors - les decouvertes incroyables",
    "Pourquoi les genies pensent differemment - les secrets du cerveau",
    "La verite sur l'alimentation industrielle - ce qu'on nous cache",
    "Pourquoi nous ne sommes peut-etre pas seuls dans l'univers",
    "Comment fonctionne vraiment l'argent - le systeme cache",
  ];
  const topic = topics[Math.floor(Math.random() * topics.length)];
  console.log('Sujet: ' + topic);

  const prompt = 'Tu es un createur YouTube viral francais. Ecris un script long format (5-7 minutes) sur: "' + topic + '". 20 blocs minimum. Chaque bloc = 2-3 phrases parlees max 35 mots. Suspense, chiffres reels, transitions accrocheuses. Reponds UNIQUEMENT avec ce JSON sans markdown ni backticks: {"title":"titre max 60 chars","description":"description 150 mots avec hashtags","blocks":["bloc1","bloc2",...20 blocs minimum],"imagePrompts":["english cinematic visual description",...autant que blocs]}';

  // 1. Essayer Mistral
  if (MISTRAL_KEY) {
    try {
      const payload = JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000,
        temperature: 0.8
      });
      const result = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: 'api.mistral.ai',
          path: '/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + MISTRAL_KEY,
            'Content-Length': Buffer.byteLength(payload)
          },
          timeout: 45000
        }, res => {
          let data = '';
          res.on('data', d => data += d);
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (!json.choices) throw new Error('Pas de choices: ' + data.substring(0,100));
              const text = json.choices[0].message.content;
              const s = text.indexOf('{');
              const e = text.lastIndexOf('}');
              if (s === -1) throw new Error('Pas de JSON');
              const parsed = JSON.parse(text.substring(s, e + 1));
              if (!parsed.blocks || parsed.blocks.length < 5) throw new Error('Trop court');
              console.log('Mistral OK: ' + parsed.title + ' (' + parsed.blocks.length + ' blocs)');
              resolve(parsed);
            } catch(e) { reject(e); }
          });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout Mistral')); });
        req.write(payload);
        req.end();
      });
      return result;
    } catch(e) {
      console.log('Mistral echoue: ' + e.message + ' -> Pollinations');
    }
  }

  // 2. Fallback Pollinations
  const seed = Math.floor(Math.random() * 99999);
  const url = 'https://text.pollinations.ai/' + encodeURIComponent(prompt) + '?model=openai&seed=' + seed;
  return new Promise((resolve) => {
    const req = https.get(url, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const s = data.indexOf('{');
          const e = data.lastIndexOf('}');
          if (s === -1) throw new Error('Pas de JSON');
          const parsed = JSON.parse(data.substring(s, e + 1));
          if (!parsed.blocks || parsed.blocks.length < 5) throw new Error('Trop court');
          console.log('Pollinations OK: ' + parsed.title);
          resolve(parsed);
        } catch(err) {
          console.log('Fallback script utilise');
          resolve(FALLBACK);
        }
      });
    });
    req.on('error', () => resolve(FALLBACK));
    req.setTimeout(45000, () => { req.destroy(); resolve(FALLBACK); });
  });
}

// ─── Voix Google TTS ──────────────────────────────────────────────────────────
async function generateVoiceGoogleTTS(text, index) {
  const mp3 = `/tmp/v_${index}.mp3`;
  const wav = `/tmp/v_${index}.wav`;
  const encoded = encodeURIComponent(text.substring(0, 200));
  const url = 'https://translate.google.com/translate_tts?ie=UTF-8&q=' + encoded + '&tl=fr&client=tw-ob&ttsspeed=0.9';
  await new Promise((resolve, reject) => {
    const follow = (u) => {
      const mod = u.startsWith('https') ? https : require('http');
      mod.get(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0' } }, res => {
        if ([301,302,303].includes(res.statusCode)) return follow(res.headers.location);
        const chunks = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          if (buf.length < 500) return reject(new Error('Audio Google vide'));
          fs.writeFileSync(mp3, buf);
          resolve();
        });
        res.on('error', reject);
      }).on('error', reject);
    };
    follow(url);
  });
  execSync(`ffmpeg -y -i "${mp3}" -ar 44100 -ac 1 "${wav}" 2>/dev/null`);
  return wav;
}

// ─── Voix ElevenLabs ──────────────────────────────────────────────────────────
async function generateVoiceElevenLabs(text, index) {
  const mp3 = `/tmp/v_${index}.mp3`;
  const wav = `/tmp/v_${index}.wav`;
  const payload = JSON.stringify({
    text: text.substring(0, 400),
    model_id: 'eleven_multilingual_v2',
    voice_settings: { stability: 0.5, similarity_boost: 0.8 }
  });
  await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.elevenlabs.io',
      path: '/v1/text-to-speech/' + ELEVEN_VOICE,
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
        const buf = Buffer.concat(chunks);
        if (buf.length < 1000) return reject(new Error('Audio ElevenLabs invalide (' + buf.length + ' bytes)'));
        fs.writeFileSync(mp3, buf);
        resolve();
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout ElevenLabs')); });
    req.write(payload);
    req.end();
  });
  execSync(`ffmpeg -y -i "${mp3}" -ar 44100 -ac 1 "${wav}" 2>/dev/null`);
  return wav;
}

// ─── Voix (avec fallback automatique) ────────────────────────────────────────
async function generateVoice(text, index) {
  if (ELEVEN_KEY) {
    try {
      const v = await generateVoiceElevenLabs(text, index);
      console.log('Voix ElevenLabs OK');
      return v;
    } catch(e) {
      console.log('ElevenLabs echoue (' + e.message + ') -> Google TTS');
    }
  }
  const v = await generateVoiceGoogleTTS(text, index);
  console.log('Voix Google TTS OK');
  return v;
}

// ─── Montage vidéo ────────────────────────────────────────────────────────────
async function buildVideo(images, voices, blocks) {
  const segs = [];

  for (let i = 0; i < blocks.length; i++) {
    const img = images[i % images.length];
    const audio = voices[i % voices.length];
    const out = `/tmp/seg_${i}.mp4`;

    // Durée audio
    let dur = 5;
    try {
      const d = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audio}"`).toString().trim());
      if (!isNaN(d)) dur = Math.max(3, d + 0.3);
    } catch(e) {}

    // Texte sécurisé
    const txt = blocks[i]
      .replace(/['"\\:\[\]{}|<>%]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 50);

    // FFmpeg SANS zoompan (trop lent) - juste image statique + texte + audio
    const cmd = [
      'ffmpeg -y',
      `-loop 1 -t ${dur} -i "${img}"`,
      `-i "${audio}"`,
      `-filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,drawbox=x=0:y=880:w=1920:h=200:color=black@0.7:t=fill,drawtext=text='${txt}':fontsize=40:fontcolor=white:x=(w-text_w)/2:y=910:shadowcolor=black:shadowx=2:shadowy=2[v]"`,
      `-map "[v]" -map 1:a`,
      `-c:v libx264 -preset ultrafast -crf 28`,
      `-c:a aac -b:a 96k`,
      `-pix_fmt yuv420p`,
      `-shortest "${out}"`
    ].join(' ');

    try {
      execSync(cmd, { stdio: 'pipe', timeout: 60000 });
      segs.push(out);
      console.log('Seg ' + (i+1) + '/' + blocks.length + ' OK (' + dur.toFixed(1) + 's)');
    } catch(e) {
      console.error('Seg ' + i + ' rate: ' + (e.stderr ? e.stderr.toString().substring(0,80) : e.message));
    }
  }

  if (segs.length === 0) throw new Error('Aucun segment cree');

  const list = '/tmp/list.txt';
  fs.writeFileSync(list, segs.map(s => "file '" + s + "'").join('\n'));
  const final = '/tmp/video.mp4';
  execSync('ffmpeg -y -f concat -safe 0 -i "' + list + '" -c copy -movflags +faststart "' + final + '"', { stdio: 'pipe', timeout: 300000 });
  segs.forEach(s => { try { fs.unlinkSync(s); } catch(e) {} });
  console.log('Video assemblee: ' + segs.length + ' segments');
  return final;
}

// ─── Upload YouTube ───────────────────────────────────────────────────────────
async function uploadYouTube(videoPath, title, description) {
  const auth = getOAuth2Client();
  auth.setCredentials(savedToken);
  const yt = google.youtube({ version: 'v3', auth });
  const res = await yt.videos.insert({
    part: 'snippet,status',
    requestBody: {
      snippet: {
        title: title,
        description: description || (title + '\n\n#viral #decouverte #science #France'),
        tags: ['viral', 'science', 'decouverte', 'France', 'incroyable', 'verite'],
        categoryId: '28',
        defaultLanguage: 'fr'
      },
      status: { privacyStatus: 'public' }
    },
    media: { body: fs.createReadStream(videoPath) }
  });
  return res.data;
}

// ─── Pipeline principal ───────────────────────────────────────────────────────
async function run() {
  console.log('=== KRAKEN START ===');

  // 1. Script (20 blocs pour 5-7 minutes)
  const script = await generateScript();
  const blocks = script.blocks.slice(0, 20);
  const prompts = (script.imagePrompts || []).slice(0, 20);
  console.log(blocks.length + ' blocs pour la video');

  // 2. Images (max 8 images reutilisees pour les 20 blocs)
  console.log('Generation images...');
  const nbImages = Math.min(8, blocks.length);
  const imgResults = await Promise.all(
    Array.from({length: nbImages}, (_, i) =>
      generateImage(prompts[i] || 'cinematic landscape dramatic 8K', i)
        .catch(e => { console.error('img ' + i + ':', e.message); return null; })
    )
  );
  const images = imgResults.filter(Boolean);
  if (images.length === 0) throw new Error('Aucune image generee');
  console.log(images.length + ' images OK');

  // 3. Voix en PARALLELE (5 a la fois)
  console.log('Generation voix en parallele...');
  const voiceResults = [];
  const BATCH = 5;
  for (let b = 0; b < blocks.length; b += BATCH) {
    const batch = blocks.slice(b, b + BATCH);
    const results = await Promise.all(
      batch.map((txt, j) => generateVoice(txt, b + j).catch(e => {
        console.error('Voix ' + (b+j) + ' ratee: ' + e.message);
        return null;
      }))
    );
    voiceResults.push(...results);
    console.log('Batch voix ' + Math.min(b+BATCH, blocks.length) + '/' + blocks.length + ' OK');
  }
  const voices = voiceResults.filter(Boolean);
  if (voices.length === 0) throw new Error('Aucune voix generee');
  console.log(voices.length + ' voix OK');

  // 4. Montage
  console.log('Montage...');
  const videoPath = await buildVideo(images, voices, blocks.slice(0, voices.length));

  // 5. Upload
  console.log('Upload YouTube...');
  const result = await uploadYouTube(videoPath, script.title, script.description);
  console.log('PUBLIE: https://youtube.com/watch?v=' + result.id);

  [videoPath, ...images, ...voices].forEach(f => { try { fs.unlinkSync(f); } catch(e) {} });
  return result;
}

// ─── Serveur HTTP ─────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:' + PORT);
  const p = url.pathname;

  if (p === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!DOCTYPE html><html><head><meta charset="utf-8"><title>KRAKEN</title><style>body{font-family:sans-serif;background:#0a0a0a;color:#fff;padding:40px;text-align:center}h1{font-size:2.5em;color:#ff6b35}.btn{display:inline-block;margin:10px;padding:15px 30px;background:#ff6b35;color:#fff;text-decoration:none;border-radius:8px;font-size:1.1em;font-weight:bold}.s{margin-top:20px;padding:15px;background:#1a1a1a;border-radius:8px}</style></head><body><h1>KRAKEN</h1><p style="color:#aaa">Bot YouTube Automatique - Videos 5-7 minutes</p><div class="s"><p>YouTube: <strong style="color:' + (savedToken ? '#4ade80' : '#f87171') + '">' + (savedToken ? 'Connecte' : 'Non connecte') + '</strong></p><p style="color:#aaa;font-size:0.9em">Mistral: ' + (MISTRAL_KEY ? 'OK' : 'Non configure') + ' | ElevenLabs: ' + (ELEVEN_KEY ? 'OK' : 'Non configure') + '</p></div><br><a class="btn" href="/auth">Connecter YouTube</a><a class="btn" href="/publish">Generer et Publier</a><a class="btn" href="/status">Statut</a></body></html>');

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
    res.end('<html><body style="font-family:sans-serif;background:#0a0a0a;color:#fff;padding:40px;text-align:center"><h1>YouTube connecte!</h1><p style="color:#aaa">Copie dans Railway YOUTUBE_TOKEN:</p><textarea style="width:90%;height:120px;background:#1a1a1a;color:#4ade80;padding:10px;border:1px solid #333;border-radius:8px">' + JSON.stringify(tokens) + '</textarea><br><br><a href="/publish" style="padding:15px 30px;background:#ff6b35;color:#fff;text-decoration:none;border-radius:8px">Generer une video</a></body></html>');

  } else if (p === '/publish') {
    if (!savedToken) { res.writeHead(302, { Location: '/auth' }); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.write('<html><head><meta charset="utf-8"><title>Generation...</title><style>body{font-family:sans-serif;background:#0a0a0a;color:#fff;padding:40px}h1{color:#ff6b35}</style></head><body><h1>Generation video 5-7 minutes...</h1><p style="color:#aaa">Patiente 10-15 minutes. Ne ferme pas cette page.</p>');
    try {
      const result = await run();
      res.end('<h2 style="color:#4ade80">Video publiee!</h2><a href="https://youtube.com/watch?v=' + result.id + '" target="_blank" style="padding:15px 30px;background:#ff6b35;color:#fff;text-decoration:none;border-radius:8px">Voir sur YouTube</a><br><br><a href="/publish" style="color:#aaa">Generer une autre</a></body></html>');
    } catch(e) {
      res.end('<h2 style="color:#f87171">Erreur: ' + e.message + '</h2><a href="/" style="color:#ff6b35">Retour</a></body></html>');
    }

  } else if (p === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      connecte: !!savedToken,
      tokenExpiry: savedToken && savedToken.expiry_date ? new Date(savedToken.expiry_date).toISOString() : null,
      ffmpeg: (function() { try { execSync('which ffmpeg'); return 'OK'; } catch(e) { return 'ABSENT'; } })(),
      mistral: !!MISTRAL_KEY,
      elevenlabs: !!ELEVEN_KEY
    }));

  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, function() {
  console.log('KRAKEN port ' + PORT);
  console.log('YouTube: ' + (savedToken ? 'OK' : 'Non connecte'));
  console.log('Mistral: ' + (MISTRAL_KEY ? 'OK' : 'Non configure'));
  console.log('ElevenLabs: ' + (ELEVEN_KEY ? 'OK' : 'Non configure'));
  try { execSync('which ffmpeg'); console.log('FFmpeg: OK'); } catch(e) { console.log('FFmpeg: ABSENT'); }
});
