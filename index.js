const http = require('http');
const https = require('https');
const fs = require('fs');
const { execSync, exec } = require('child_process');
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

// Installer edge-tts au démarrage
try {
  execSync('pip3 install edge-tts --quiet --break-system-packages 2>/dev/null || pip install edge-tts --quiet 2>/dev/null', { timeout: 30000 });
  console.log('edge-tts OK');
} catch(e) { console.log('edge-tts install:', e.message); }

// Voix Microsoft Edge TTS — très naturelles, humaines
const VOICES = {
  en: 'en-US-ChristopherNeural', // homme américain naturel
  fr: 'fr-FR-HenriNeural',       // homme français naturel
};

const VIDEOS = [
  {
    en: { title: 'Universe Secrets Science Is Hiding From You', description: 'The deepest mysteries of the cosmos revealed.', tags: ['universe','space','science','mystery','discovery'] },
    fr: { title: 'Les secrets de l\'univers que la science cache', description: 'Les mystères les plus profonds du cosmos révélés.', tags: ['univers','espace','science','mystere','decouverte'] },
    scenes: [
      { en: { text: 'The universe hides secrets you cannot imagine', speech: 'The universe we observe every night hides absolutely stunning secrets that most people never learn about.' }, fr: { text: "L'univers cache des secrets inimaginables", speech: "L'univers que nous observons chaque nuit cache des secrets absolument stupéfiants que la plupart des gens ignorent." }, pexels: 'galaxy space stars', pollinations: 'deep space galaxy cosmic nebula cinematic' },
      { en: { text: 'Billions of galaxies invisible to the naked eye', speech: 'There are billions of galaxies invisible to the naked eye, each containing billions of stars like our sun.' }, fr: { text: 'Des milliards de galaxies invisibles', speech: "Il existe des milliards de galaxies invisibles à l'oeil nu, chacune contenant des milliards d'étoiles comme notre soleil." }, pexels: 'galaxy milky way', pollinations: 'billions galaxies cosmic web deep universe' },
      { en: { text: 'Dark matter: 85% of the universe is unknown', speech: 'Dark matter makes up 85 percent of the total mass of the universe. Scientists have no idea what it actually is.' }, fr: { text: 'La matiere noire: 85% de l\'univers inconnu', speech: "La matière noire représente 85 pour cent de la masse totale de l'univers. Les scientifiques ne savent pas ce que c'est." }, pexels: 'dark nebula space', pollinations: 'dark matter invisible universe mysterious energy' },
      { en: { text: 'Black holes bigger than entire galaxies', speech: 'Some black holes are so massive they dwarf entire galaxies. Their gravity distorts space and time itself.' }, fr: { text: 'Des trous noirs plus grands que des galaxies', speech: "Certains trous noirs sont si massifs qu'ils dépassent des galaxies entières. Leur gravité déforme l'espace et le temps." }, pexels: 'black hole space', pollinations: 'supermassive black hole event horizon light' },
      { en: { text: 'Time slows down near massive objects', speech: 'Einstein predicted it. Time passes more slowly near very massive objects. GPS satellites must correct for this every single day.' }, fr: { text: 'Le temps ralentit pres des objets massifs', speech: "Einstein l'avait prédit. Le temps passe plus lentement près des objets très massifs. Les satellites GPS corrigent cet effet chaque jour." }, pexels: 'time space physics', pollinations: 'spacetime distortion gravity Einstein warping' },
      { en: { text: 'Unexplained radio signals from deep space', speech: 'Mysterious radio signals arrive regularly from distant galaxies. Their origin remains completely unknown despite decades of research.' }, fr: { text: 'Des signaux radio inexpliques depuis l\'espace', speech: "Des signaux radio mystérieux arrivent régulièrement depuis des galaxies lointaines. Leur origine reste totalement inconnue." }, pexels: 'radio telescope astronomy', pollinations: 'alien signal radio telescope deep space mysterious' },
      { en: { text: 'Our universe might have a twin', speech: 'According to some theories, our universe is just one among an infinite number of parallel universes. You might have a twin out there.' }, fr: { text: 'Notre univers a peut-etre un jumeau', speech: "Selon certaines théories, notre univers ne serait qu'un parmi une infinité d'univers parallèles. Vous avez peut-être un jumeau quelque part." }, pexels: 'parallel universe', pollinations: 'multiverse parallel universes portal dimension' },
      { en: { text: 'Stars you see may already be gone', speech: 'When you look at a star, you see what it looked like millions of years ago. It may have already exploded and vanished.' }, fr: { text: 'Ces etoiles ont peut-etre deja disparu', speech: "Quand vous regardez une étoile, vous voyez ce qu'elle était il y a des millions d'années. Elle a peut-être déjà disparu." }, pexels: 'stars night sky', pollinations: 'ancient starlight time travel light years star' },
      { en: { text: 'Are we truly alone in the universe?', speech: 'With billions of habitable planets in our galaxy alone, the probability of another intelligent civilization is enormous.' }, fr: { text: 'Sommes-nous vraiment seuls dans l\'univers?', speech: "Avec des milliards de planètes habitables dans notre galaxie seule, la probabilité d'une autre civilisation intelligente est immense." }, pexels: 'alien planet space', pollinations: 'alien planet life extraterrestrial civilization' },
      { en: { text: 'Subscribe for more mind-blowing secrets', speech: 'Subscribe now to discover every week the most fascinating secrets of our universe. Thank you so much for watching.' }, fr: { text: 'Abonnez-vous pour plus de mysteres', speech: "Abonnez-vous pour découvrir chaque semaine les secrets les plus fascinants de notre univers. Merci de nous avoir regardés." }, pexels: 'subscribe youtube', pollinations: 'youtube subscribe notification bell channel' },
    ]
  },
  {
    en: { title: 'These Insane Facts Will Leave You Speechless', description: '10 incredible but 100% real facts.', tags: ['amazing facts','incredible','science','mind blowing'] },
    fr: { title: 'Ces faits insolites vont vous laisser sans voix', description: '10 faits incroyables mais 100% réels.', tags: ['faits insolites','incroyable','science','decouverte'] },
    scenes: [
      { en: { text: '10 insane facts that are 100% real', speech: 'These ten facts are absolutely mind blowing. And yet, every single one of them is true and scientifically verified.' }, fr: { text: '10 faits insolites absolument reels', speech: "Ces dix faits sont absolument incroyables. Et pourtant, ils sont tous vrais et vérifiés scientifiquement." }, pexels: 'amazing world facts', pollinations: 'incredible amazing facts world knowledge' },
      { en: { text: 'A snail can sleep for 3 years straight', speech: 'Fact one. A snail can sleep for up to three consecutive years during a drought period to survive.' }, fr: { text: "Un escargot peut dormir 3 ans d'affilee", speech: "Fait numéro un. Un escargot peut dormir jusqu'à trois ans consécutifs pendant une période de sécheresse." }, pexels: 'snail nature macro', pollinations: 'snail sleeping nature macro closeup shell' },
      { en: { text: 'Human DNA is 2 meters long per cell', speech: 'Fact two. If you unrolled the DNA from a single human cell, it would measure two full meters in length.' }, fr: { text: "L'ADN humain fait 2 metres par cellule", speech: "Fait numéro deux. Si on déroulait l'ADN d'une seule cellule humaine, il mesurerait deux mètres de long." }, pexels: 'dna biology science', pollinations: 'DNA double helix human cell biology microscope' },
      { en: { text: 'Bananas are naturally radioactive', speech: 'Fact three. Bananas contain naturally radioactive potassium. But the quantity is completely harmless to humans.' }, fr: { text: 'La banane est naturellement radioactive', speech: "Fait numéro trois. Les bananes contiennent du potassium radioactif naturel. Mais en quantité totalement inoffensive." }, pexels: 'banana fruit yellow', pollinations: 'banana radioactive glow natural potassium fruit' },
      { en: { text: 'More trees on Earth than stars in Milky Way', speech: 'Fact four. There are approximately three trillion trees on Earth. Far more than all the visible stars in our galaxy.' }, fr: { text: "Plus d'arbres que d'etoiles dans la Voie Lactee", speech: "Fait numéro quatre. Il y a environ trois mille milliards d'arbres sur Terre, bien plus que les étoiles visibles." }, pexels: 'forest trees aerial', pollinations: 'forest trees canopy aerial view lush green' },
      { en: { text: 'Flamingos are born completely white', speech: 'Fact five. Flamingos are born white. Their diet of algae and shrimp gradually turns them pink over time.' }, fr: { text: 'Les flamants roses naissent blancs', speech: "Fait numéro cinq. Les flamants roses naissent blancs. C'est leur alimentation à base d'algues qui les rend roses." }, pexels: 'flamingo bird pink', pollinations: 'flamingo pink bird nature wildlife lake' },
      { en: { text: 'Honey never expires. Ever.', speech: 'Fact six. Honey found in three thousand year old Egyptian tombs was still perfectly edible when discovered by archaeologists.' }, fr: { text: 'Le miel ne se perime jamais', speech: "Fait numéro six. Du miel vieux de trois mille ans trouvé dans des tombes égyptiennes était encore parfaitement comestible." }, pexels: 'honey golden jar', pollinations: 'ancient Egyptian honey jar golden preserved' },
      { en: { text: 'Octopuses have 3 hearts and blue blood', speech: 'Fact seven. Octopuses have three hearts and their blood is blue because it contains copper instead of iron.' }, fr: { text: 'Les pieuvres ont 3 coeurs et du sang bleu', speech: "Fait numéro sept. Les pieuvres ont trois coeurs et leur sang est bleu à cause du cuivre qu'il contient." }, pexels: 'octopus ocean sea', pollinations: 'octopus three hearts blue blood ocean deep' },
      { en: { text: 'A day on Venus is longer than its year', speech: 'Fact eight. Venus rotates so slowly that one Venusian day is actually longer than one full Venusian year.' }, fr: { text: 'Un jour sur Venus est plus long qu\'une annee', speech: "Fait numéro huit. Vénus tourne si lentement qu'un jour vénusien est plus long qu'une année complète." }, pexels: 'venus planet solar system', pollinations: 'Venus planet slow rotation solar system' },
      { en: { text: 'Subscribe for weekly mind-blowing facts', speech: 'If you enjoyed these incredible facts, subscribe to discover new ones every single week. See you in the next video.' }, fr: { text: 'Abonnez-vous pour plus de faits insolites', speech: "Si vous avez aimé ces faits incroyables, abonnez-vous pour en découvrir de nouveaux chaque semaine. À très bientôt." }, pexels: 'subscribe notification bell', pollinations: 'youtube subscribe like notification bell red' },
    ]
  },
];

function httpsGet(urlStr) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      const chunks = []; res.on('data', d => chunks.push(d)); res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
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

// Edge TTS — voix Microsoft très naturelle
async function getEdgeTTS(text, lang, outPath) {
  try {
    const voice = VOICES[lang];
    const mp3Path = outPath.replace('.mp3', '_raw.mp3');
    execSync(`edge-tts --voice "${voice}" --text "${text.replace(/"/g, "'")}" --write-media "${mp3Path}" 2>/dev/null`, { timeout: 30000 });
    // Convertir en mp3 compatible ffmpeg
    execSync(`ffmpeg -y -i "${mp3Path}" -ar 44100 -ac 2 "${outPath}" 2>/dev/null`, { timeout: 15000 });
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) return true;
  } catch(e) { console.log('EdgeTTS err:', e.message); }
  // Fallback Google TTS
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
    const encoded = encodeURIComponent(prompt + ' cinematic 4k high quality');
    const imgData = await httpsGet(`https://image.pollinations.ai/prompt/${encoded}?width=1280&height=720&nologo=true`);
    if (imgData.length > 5000) { fs.writeFileSync(outPath, imgData); return true; }
  } catch(e) {}
  return false;
}

async function getImage(scene, index) {
  const outPath = `/tmp/img_${index}.jpg`;
  if (index % 2 === 0) {
    if (await downloadPexels(scene.pexels, outPath)) return outPath;
    if (await downloadPollinations(scene.pollinations, outPath)) return outPath;
  } else {
    if (await downloadPollinations(scene.pollinations, outPath)) return outPath;
    if (await downloadPexels(scene.pexels, outPath)) return outPath;
  }
  execSync(`ffmpeg -y -f lavfi -i "color=c=#1a1a2e:size=1280x720:rate=25" -t 1 -frames:v 1 "${outPath}" 2>/dev/null`);
  return outPath;
}

async function createSceneClip(scene, index, lang) {
  const sceneData = scene[lang];
  console.log(`  [${lang.toUpperCase()}] Scene ${index + 1}: ${sceneData.text.substring(0, 40)}...`);

  const imgPath = await getImage(scene, index);
  const audioPath = `/tmp/audio_${lang}_${index}.mp3`;
  await getEdgeTTS(sceneData.speech, lang, audioPath);

  let audioDur = 8;
  try {
    const probe = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}" 2>/dev/null`).toString().trim();
    const d = parseFloat(probe); if (!isNaN(d) && d > 1) audioDur = d + 1.5;
  } catch(e) {}

  const clipPath = `/tmp/clip_${lang}_${index}.mp4`;
  const textSafe = sceneData.text.replace(/['":\\[\]]/g, ' ').substring(0, 55);

  execSync(`ffmpeg -y -loop 1 -i "${imgPath}" -i "${audioPath}" -t ${Math.ceil(audioDur)} \
    -vf "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,\
drawbox=x=0:y=570:w=1280:h=150:color=black@0.85:t=fill,\
drawtext=text='${textSafe}':fontcolor=white:fontsize=38:x=(w-text_w)/2:y=605" \
    -c:v libx264 -c:a aac -pix_fmt yuv420p -r 25 -shortest "${clipPath}" 2>&1`, { timeout: 120000 });

  return clipPath;
}

async function buildVideo(vid, lang) {
  const clips = [];
  for (let i = 0; i < vid.scenes.length; i++) {
    clips.push(await createSceneClip(vid.scenes[i], i, lang));
  }
  const concatFile = `/tmp/concat_${lang}.txt`;
  fs.writeFileSync(concatFile, clips.map(p => `file '${p}'`).join('\n'));
  const outPath = `/tmp/final_${lang}.mp4`;
  execSync(`ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c:v libx264 -c:a aac -pix_fmt yuv420p "${outPath}" 2>&1`, { timeout: 300000 });
  return outPath;
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

const server = http.createServer(async (req, res) => {
  const p = url.parse(req.url).pathname;
  const q = url.parse(req.url, true).query;

  if (p === '/auth') {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload&access_type=offline&prompt=consent`;
    res.writeHead(302, { Location: authUrl }); res.end();
  }

  else if (p === '/callback') {
    const body = `code=${q.code}&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&grant_type=authorization_code`;
    token = await httpsPost('oauth2.googleapis.com', '/token', { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }, body);
    fs.writeFileSync('/tmp/token.json', JSON.stringify(token));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>YouTube connecte!</h1><a href="/publish">Publier maintenant</a>');
  }

  else if (p === '/publish') {
    if (!token) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<a href="/auth">Connecter YouTube</a>'); return; }
    await refreshToken();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const vid = VIDEOS[Math.floor(Math.random() * VIDEOS.length)];
    res.write(`<h1>Generation...</h1><p>EN: ${vid.en.title}</p><p>FR: ${vid.fr.title}</p><p>Voix: Microsoft Edge TTS (naturelle)</p><p>Patience 5-8 min...</p>`);
    try {
      res.write('<p>Video anglaise...</p>');
      const enPath = await buildVideo(vid, 'en');
      res.write('<p>Video francaise...</p>');
      const frPath = await buildVideo(vid, 'fr');
      res.write('<p>Upload EN...</p>');
      const r1 = await uploadYouTube(vid.en, enPath);
      res.write('<p>Upload FR...</p>');
      const r2 = await uploadYouTube(vid.fr, frPath);
      res.end(`<h2>2 videos publiees!</h2>
        <p>EN: ${r1.id ? `<a href="https://youtube.com/watch?v=${r1.id}">Voir video EN</a>` : 'Erreur: ' + JSON.stringify(r1).substring(0, 100)}</p>
        <p>FR: ${r2.id ? `<a href="https://youtube.com/watch?v=${r2.id}">Voir video FR</a>` : 'Erreur: ' + JSON.stringify(r2).substring(0, 100)}</p>
        <br><a href="/publish">Publier une autre paire</a>`);
    } catch(e) {
      res.end(`<p>Erreur: ${e.message.substring(0, 300)}</p><a href="/publish">Reessayer</a>`);
    }
  }

  else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h1>KRAKEN YouTube Bot</h1>
      <p>Voix: Microsoft Edge TTS - naturelle et humaine</p>
      <p>${token ? 'YouTube connecte' : 'Non connecte'}</p>
      <ul>
        <li><a href="/auth">Connecter YouTube</a></li>
        <li><a href="/publish">Publier EN + FR (1 clic)</a></li>
      </ul>`);
  }
});

server.listen(PORT, () => console.log('KRAKEN Edge TTS OK port ' + PORT));
