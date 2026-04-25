const http = require('http');
const https = require('https');
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const PORT = process.env.PORT;
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI || process.env.REDIRECT_URI;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY;
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';

let savedToken = process.env.YOUTUBE_TOKEN ? JSON.parse(process.env.YOUTUBE_TOKEN) : null;

// ─── OAuth2 ───────────────────────────────────────────────────────────────────
function getOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

// ─── Téléchargement d'image ───────────────────────────────────────────────────
function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        https.get(res.headers.location, res2 => {
          res2.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
      } else {
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }
    }).on('error', reject);
  });
}

// ─── Génération d'image HD via Pollinations ───────────────────────────────────
async function generateImage(prompt, index) {
  const seed = Math.floor(Math.random() * 99999);
  // Prompts cinématiques avec style moderne
  const cinemaPrompt = `${prompt}, cinematic 8K photography, ultra-realistic, dramatic lighting, 
    shallow depth of field, golden hour, professional color grading, hyperdetailed, 
    award-winning photo, vivid colors, epic composition, --ar 16:9`;
  
  const encoded = encodeURIComponent(cinemaPrompt);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1920&height=1080&seed=${seed}&model=flux&nologo=true&enhance=true`;
  const dest = `/tmp/img_${index}.jpg`;
  
  console.log(`🎨 Génération image ${index + 1}...`);
  await downloadImage(url, dest);
  return dest;
}

// ─── Génération script via Pollinations AI (gratuit, sans clé) ───────────────
async function generateScript() {
  const topics = [
    "Les secrets que la NASA cache sur ce qui se passe vraiment dans l'espace profond",
    "Comment les milliardaires ont réellement construit leur fortune — la vérité que personne ne dit",
    "Les 10 technologies classifiées qui existent déjà et vont changer l'humanité",
    "Ce qui se passe vraiment au fond des océans — les scientifiques sont terrifiés",
    "Les civilisations avancées qui ont existé avant l'histoire officielle",
    "Ce que ton cerveau fait pendant que tu dors — les découvertes qui bouleversent la science",
    "Les lieux sur Terre où la réalité semble impossible — explications scientifiques",
    "Pourquoi les génies pensent différemment — les secrets du cerveau des Einstein et Da Vinci",
    "La vérité sur l'alimentation industrielle — ce que les grandes marques te cachent depuis 50 ans",
    "Les expériences scientifiques secrètes qui ont changé l'histoire de l'humanité",
    "Pourquoi nous ne sommes peut-être pas seuls dans l'univers — les preuves s'accumulent",
    "Les prophéties qui se réalisent une à une — coïncidence ou quelque chose de plus grand",
    "Comment fonctionne vraiment l'argent — le système que l'école ne t'apprendra jamais",
    "Les guerres oubliées qui ont changé le cours de l'histoire mondiale",
    "La psychologie des manipulateurs — comment te protéger des gens toxiques",
  ];

  const topic = topics[Math.floor(Math.random() * topics.length)];
  console.log('Sujet: ' + topic);

  const prompt = 'Tu es un créateur YouTube viral français. Ecris un script long format (5-10 minutes) sur: "' + topic + '". STRUCTURE: 20 blocs minimum. Chaque bloc = 2-3 phrases parlées max 35 mots. Suspense entre blocs. Chiffres et faits reels. Reponds UNIQUEMENT avec ce JSON valide sans markdown: {"title":"titre YouTube max 60 caracteres","description":"description 150 mots","blocks":["bloc1","bloc2","bloc3"...],"imagePrompts":["description visuelle cinematique en anglais",...]}. Minimum 20 blocs obligatoire.';

  const encoded = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 99999);
  const url = 'https://text.pollinations.ai/' + encoded + '?model=openai&seed=' + seed;

  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          let clean = data.trim();
          if (clean.startsWith('```')) {
            clean = clean.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          }
          // Trouver le JSON dans la réponse
          const jsonStart = clean.indexOf('{');
          const jsonEnd = clean.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1) {
            clean = clean.substring(jsonStart, jsonEnd + 1);
          }
          const content = JSON.parse(clean);
          if (!content.blocks || content.blocks.length < 3) {
            // Script de secours si Pollinations échoue
            resolve({
              title: "Les Secrets Cachés Que la Science Vient de Révéler",
              description: "Découvrez les vérités cachées sur notre univers.",
              blocks: [
                "Et si tout ce que tu croyais savoir était faux? Les scientifiques viennent de faire une découverte qui change tout.",
                "Depuis des décennies, certaines informations sont gardées secrètes. Aujourd'hui, on lève le voile sur la vérité.",
                "En 1969, des chercheurs ont découvert quelque chose d'extraordinaire. Mais personne n'en a parlé pendant 50 ans.",
                "Le cerveau humain peut traiter 11 millions de bits par seconde. Mais on n'en utilise consciemment que 50.",
                "Dans les profondeurs de l'océan, à 11 kilomètres de profondeur, vivent des créatures que la science ne comprend pas encore.",
                "Les grandes entreprises dépensent des milliards pour que tu ne saches pas ça. Voici pourquoi.",
                "Des études menées sur 50 000 personnes montrent que notre réalité est bien plus étrange qu'on ne le croit.",
                "Mais attends... ce n'est que le début. Ce qui suit va vraiment te surprendre.",
                "En 2019, la NASA a détecté un signal inexpliqué venant du bord de notre galaxie. Il se répète toutes les 16 jours.",
                "Les physiciens quantiques affirment maintenant que le temps n'existe peut-être pas vraiment. Tu es prêt pour ça?",
                "Et là, c'est là que tout bascule. Ce que personne ne te dit c'est que nous sommes peut-être dans une simulation.",
                "Elon Musk, Neil deGrasse Tyson, et des dizaines de Prix Nobel pensent que c'est possible. Vraiment possible.",
                "Les preuves s'accumulent depuis 20 ans. Des patterns mathématiques parfaits dans les lois de la physique.",
                "Mais si c'est une simulation, qui l'a créée? Et surtout... pourquoi? La réponse va te glacer le sang.",
                "Des chercheurs de l'université d'Oxford ont publié un papier en 2023. Ils donnent 50% de chances que ce soit réel.",
                "Ce que tu viens d'apprendre aujourd'hui n'est que la surface. La vérité est bien plus profonde.",
                "La question n'est plus de savoir si c'est possible. La question est: qu'est-ce que tu vas faire avec cette information?",
                "Notre génération est la première à avoir accès à ces vérités. C'est une responsabilité immense.",
                "Si cette vidéo t'a ouvert les yeux, partage-la. Les gens ont le droit de savoir.",
                "Abonne-toi pour ne rien manquer. Chaque semaine, on explore une nouvelle vérité cachée ensemble."
              ],
              imagePrompts: Array(20).fill("cinematic space galaxy stars dramatic lighting 8K ultra realistic")
            });
          } else {
            console.log('Script OK: "' + content.title + '" - ' + content.blocks.length + ' blocs');
            resolve(content);
          }
        } catch (e) {
          reject(new Error('Erreur parsing: ' + data.substring(0, 200)));
        }
      });
    }).on('error', reject);
  });
}


// ─── Génération voix ElevenLabs ───────────────────────────────────────────────
async function generateVoice(text, index) {
  const dest = `/tmp/voice_${index}.mp3`;
  const payload = JSON.stringify({
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: { stability: 0.4, similarity_boost: 0.85, style: 0.3, use_speaker_boost: true }
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
      }
    }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        fs.writeFileSync(dest, Buffer.concat(chunks));
        resolve(dest);
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ─── Création vidéo spectaculaire avec FFmpeg ─────────────────────────────────
async function buildCinematicVideo(images, voices, blocks, title) {
  const outputPath = '/tmp/final_video.mp4';
  const concatList = '/tmp/concat.txt';
  const segmentPaths = [];

  console.log('🎬 Construction des segments vidéo cinématiques...');

  for (let i = 0; i < blocks.length; i++) {
    const img = images[i] || images[images.length - 1];
    const voice = voices[i] || voices[voices.length - 1];
    const text = blocks[i];
    const segOut = `/tmp/seg_${i}.mp4`;

    // Obtenir durée de l'audio
    let audioDuration = 4;
    try {
      const dur = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${voice}"`).toString().trim();
      audioDuration = parseFloat(dur) + 0.5;
    } catch (e) {}

    // Texte stylisé avec fond semi-transparent
    const safeText = text.replace(/'/g, "\\'").replace(/:/g, "\\:").replace(/\[/g, "\\[").replace(/\]/g, "\\]");

    // Effet Ken Burns (zoom progressif) + texte animé
    const zoomDirection = i % 2 === 0 ? 1.003 : 0.997; // zoom in / zoom out alternés
    const panX = i % 3 === 0 ? '0' : i % 3 === 1 ? 'iw*0.02*on/25' : '-iw*0.02*on/25';

    const ffmpegCmd = [
      'ffmpeg -y',
      `-loop 1 -i "${img}"`,
      `-i "${voice}"`,
      `-filter_complex "`,
      // Zoom Ken Burns fluide
      `[0:v]scale=2160:1215,`,
      `zoompan=z='min(zoom+0.0008,1.4)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${Math.ceil(audioDuration * 25)}:s=1920x1080:fps=25,`,
      // Ajout d'une légère vignette (assombrit les bords)
      `vignette=PI/5,`,
      // Fade in/out de la vidéo
      `fade=t=in:st=0:d=0.4,fade=t=out:st=${audioDuration - 0.4}:d=0.4[video];`,
      // Fond texte : rectangle noir semi-transparent en bas
      `[video]drawbox=x=0:y=ih*0.72:w=iw:h=ih*0.28:color=black@0.55:t=fill,`,
      // Texte principal : blanc, gras, centré en bas
      `drawtext=text='${safeText}':`,
      `fontsize=52:fontcolor=white:`,
      `font='DejaVu Sans Bold':`,
      `x=(w-text_w)/2:y=h*0.76:`,
      `shadowcolor=black@0.8:shadowx=2:shadowy=2:`,
      `alpha='if(lt(t,0.3),t/0.3,if(gt(t,${audioDuration - 0.3}),(${audioDuration}-t)/0.3,1))'[outv]`,
      `"`,
      `-map "[outv]" -map 1:a`,
      `-c:v libx264 -preset fast -crf 18`,
      `-c:a aac -b:a 192k`,
      `-pix_fmt yuv420p`,
      `-t ${audioDuration}`,
      `"${segOut}"`
    ].join(' ');

    try {
      execSync(ffmpegCmd, { stdio: 'pipe' });
      segmentPaths.push(segOut);
      console.log(`✅ Segment ${i + 1}/${blocks.length} créé (${audioDuration.toFixed(1)}s)`);
    } catch (e) {
      console.error(`❌ Erreur segment ${i}: ${e.message}`);
    }
  }

  if (segmentPaths.length === 0) throw new Error('Aucun segment créé');

  // Concaténation avec transitions
  const concatContent = segmentPaths.map(p => `file '${p}'`).join('\n');
  fs.writeFileSync(concatList, concatContent);

  // Ajout musique de fond épique (loopée)
  const musicUrl = 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/WFMU/Broke_For_Free/Directionless_EP/Broke_For_Free_-_01_-_Night_Owl.mp3';
  const musicPath = '/tmp/music.mp3';
  
  let hasMusicFile = false;
  if (fs.existsSync(musicPath)) {
    hasMusicFile = true;
  } else {
    try {
      await downloadImage(musicUrl, musicPath);
      hasMusicFile = true;
      console.log('🎵 Musique téléchargée');
    } catch (e) {
      console.log('⚠️ Musique non disponible, vidéo sans fond musical');
    }
  }

  // Assemblage final
  console.log('🎞️ Assemblage final...');
  
  let finalCmd;
  if (hasMusicFile) {
    finalCmd = [
      'ffmpeg -y',
      `-f concat -safe 0 -i "${concatList}"`,
      `-stream_loop -1 -i "${musicPath}"`,
      `-filter_complex "`,
      `[0:a]volume=1.0[voice];`,
      `[1:a]volume=0.12,afade=t=in:st=0:d=1,afade=t=out:st=999:d=2[music];`,
      `[voice][music]amix=inputs=2:duration=first[aout]`,
      `"`,
      `-map 0:v -map "[aout]"`,
      `-c:v libx264 -preset fast -crf 17`,
      `-c:a aac -b:a 192k`,
      `-pix_fmt yuv420p`,
      `-movflags +faststart`,
      `"${outputPath}"`
    ].join(' ');
  } else {
    finalCmd = [
      'ffmpeg -y',
      `-f concat -safe 0 -i "${concatList}"`,
      `-c:v libx264 -preset fast -crf 17`,
      `-c:a aac -b:a 192k`,
      `-pix_fmt yuv420p`,
      `-movflags +faststart`,
      `"${outputPath}"`
    ].join(' ');
  }

  execSync(finalCmd, { stdio: 'pipe' });
  
  // Nettoyage segments
  segmentPaths.forEach(p => { try { fs.unlinkSync(p); } catch (e) {} });
  
  console.log('✅ Vidéo cinématique assemblée !');
  return outputPath;
}

// ─── Upload YouTube ───────────────────────────────────────────────────────────
async function uploadToYouTube(videoPath, title, description) {
  const auth = getOAuth2Client();
  auth.setCredentials(savedToken);

  const youtube = google.youtube({ version: 'v3', auth });

  const res = await youtube.videos.insert({
    part: 'snippet,status',
    requestBody: {
      snippet: {
        title: title,
        description: description || `🔥 ${title}\n\n✨ Découvrez les secrets les mieux gardés.\n#viral #incroyable #découverte #science #vérité`,
        tags: ['viral', 'incroyable', 'science', 'découverte', 'France', 'vérité', 'secrets', 'documentaire'],
        categoryId: '28',
        defaultLanguage: 'fr'
      },
      status: { privacyStatus: 'public' }
    },
    media: {
      body: fs.createReadStream(videoPath)
    }
  });

  return res.data;
}

// ─── Génération complète ──────────────────────────────────────────────────────
async function generateAndPublish() {
  console.log('\n🚀 ===== DÉMARRAGE GÉNÉRATION VIDÉO CINÉMATIQUE =====\n');

  // 1. Script
  console.log('📝 Génération du script...');
  const script = await generateScript();
  const { title, blocks, imagePrompts, description } = script;
  console.log(`✅ Titre: "${title}"`);
  console.log(`✅ ${blocks.length} blocs, ${imagePrompts.length} prompts images`);

  // 2. Images en parallèle
  console.log('\n🎨 Génération des images cinématiques...');
  const imagePromises = imagePrompts.slice(0, blocks.length).map((prompt, i) =>
    generateImage(prompt, i).catch(e => {
      console.error(`❌ Image ${i} échouée:`, e.message);
      return null;
    })
  );
  const images = (await Promise.all(imagePromises)).filter(Boolean);
  console.log(`✅ ${images.length} images générées`);

  // 3. Voix séquentielles (API ElevenLabs rate limit)
  console.log('\n🎤 Génération des voix...');
  const voices = [];
  for (let i = 0; i < blocks.length; i++) {
    try {
      const v = await generateVoice(blocks[i], i);
      voices.push(v);
      console.log(`✅ Voix ${i + 1}/${blocks.length}`);
    } catch (e) {
      console.error(`❌ Voix ${i}:`, e.message);
    }
  }

  if (voices.length === 0) throw new Error('Aucune voix générée');
  if (images.length === 0) throw new Error('Aucune image générée');

  // 4. Montage vidéo cinématique
  console.log('\n🎬 Montage cinématique...');
  const videoPath = await buildCinematicVideo(images, voices, blocks, title);

  // 5. Upload YouTube
  console.log('\n📤 Upload sur YouTube...');
  const result = await uploadToYouTube(videoPath, title, description);
  console.log(`\n🎉 VIDÉO PUBLIÉE: https://youtube.com/watch?v=${result.id}`);

  // Nettoyage
  try { fs.unlinkSync(videoPath); } catch (e) {}
  images.forEach(p => { try { fs.unlinkSync(p); } catch (e) {} });
  voices.forEach(p => { try { fs.unlinkSync(p); } catch (e) {} });

  return result;
}

// ─── Serveur HTTP ─────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path_ = url.pathname;

  if (path_ === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>🦑 KRAKEN – Bot YouTube Cinématique</title>
        <meta charset="utf-8">
        <style>
          body { font-family: sans-serif; background: #0a0a0a; color: #fff; padding: 40px; text-align: center; }
          h1 { font-size: 2.5em; color: #ff6b35; }
          .btn { display: inline-block; margin: 10px; padding: 15px 30px; background: #ff6b35; 
                 color: #fff; text-decoration: none; border-radius: 8px; font-size: 1.1em; font-weight: bold; }
          .btn:hover { background: #e55a25; }
          .status { margin-top: 20px; padding: 15px; background: #1a1a1a; border-radius: 8px; }
        </style>
      </head>
      <body>
        <h1>🦑 KRAKEN</h1>
        <p style="color:#aaa">Bot YouTube – Vidéos Cinématiques Automatiques</p>
        <div class="status">
          <p>Statut YouTube: <strong style="color:${savedToken ? '#4ade80' : '#f87171'}">${savedToken ? '✅ Connecté' : '❌ Non connecté'}</strong></p>
        </div>
        <br>
        <a class="btn" href="/auth">🔗 Connecter YouTube</a>
        <a class="btn" href="/publish">🎬 Générer & Publier</a>
        <a class="btn" href="/status">📊 Statut</a>
      </body>
      </html>
    `);

  } else if (path_ === '/auth') {
    const auth = getOAuth2Client();
    const authUrl = auth.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/youtube.upload'],
      prompt: 'consent'
    });
    res.writeHead(302, { Location: authUrl });
    res.end();

  } else if (path_ === '/oauth2callback' || path_ === '/callback') {
    const code = url.searchParams.get('code');
    if (!code) { res.writeHead(400); res.end('Code manquant'); return; }
    
    const auth = getOAuth2Client();
    const { tokens } = await auth.getToken(code);
    savedToken = tokens;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <html><body style="font-family:sans-serif;background:#0a0a0a;color:#fff;padding:40px;text-align:center">
      <h1>✅ YouTube connecté !</h1>
      <p style="color:#4ade80">Token enregistré en mémoire.</p>
      <p style="color:#aaa">Ajoute ce token dans Railway Variables → YOUTUBE_TOKEN :</p>
      <textarea style="width:90%;height:100px;background:#1a1a1a;color:#fff;padding:10px;border:1px solid #333;border-radius:8px">${JSON.stringify(tokens)}</textarea>
      <br><br>
      <a href="/publish" style="padding:15px 30px;background:#ff6b35;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">🎬 Générer une vidéo maintenant</a>
      </body></html>
    `);

  } else if (path_ === '/publish') {
    if (!savedToken) {
      res.writeHead(302, { Location: '/auth' });
      res.end();
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.write(`
      <html><head><meta charset="utf-8"><title>Génération en cours...</title>
      <style>body{font-family:sans-serif;background:#0a0a0a;color:#fff;padding:40px}
      h1{color:#ff6b35}.log{background:#1a1a1a;padding:20px;border-radius:8px;
      font-family:monospace;white-space:pre-wrap;line-height:1.6}</style></head>
      <body><h1>🎬 Génération de ta vidéo cinématique...</h1>
      <div class="log" id="log">Démarrage...\n</div>
      <script>setTimeout(()=>location.reload(),120000)</script>
    `);

    try {
      const result = await generateAndPublish();
      res.end(`
        <h2 style="color:#4ade80">🎉 Vidéo publiée avec succès !</h2>
        <p>Titre: <strong>${result.snippet?.title || 'Vidéo'}</strong></p>
        <a href="https://youtube.com/watch?v=${result.id}" target="_blank" 
           style="padding:15px 30px;background:#ff6b35;color:#fff;text-decoration:none;border-radius:8px">
          ▶️ Voir sur YouTube
        </a>
        <br><br>
        <a href="/publish" style="color:#aaa">🔄 Générer une autre vidéo</a>
        </body></html>
      `);
    } catch (e) {
      res.end(`<h2 style="color:#f87171">❌ Erreur: ${e.message}</h2>
        <a href="/" style="color:#ff6b35">← Retour</a></body></html>`);
    }

  } else if (path_ === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      connecte: !!savedToken,
      tokenExpiry: savedToken?.expiry_date ? new Date(savedToken.expiry_date).toISOString() : null,
      ffmpeg: (() => { try { execSync('which ffmpeg'); return '✅ Installé'; } catch (e) { return '❌ Absent'; } })()
    }));

  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n🦑 KRAKEN démarré sur le port ${PORT}`);
  console.log(`YouTube: ${savedToken ? '✅ Connecté' : '❌ Non connecté'}`);
  try { execSync('which ffmpeg'); console.log('FFmpeg: ✅ Installé'); }
  catch (e) { console.log('FFmpeg: ❌ Non installé'); }
});
