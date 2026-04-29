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
    en: { title: 'Kevin Tried To Become A Millionaire In 5 Minutes', description: 'Chaos with the Calamity Crew 😂', tags: ['calamity crew'], thumbnail_text: 'KEVIN TRIED\nTO GET RICH', thumbnail_color: 'ff00aa', thumbnail_accent: 'ffff00' },
    fr: { title: 'Kevin a essayé de devenir millionnaire en 5 minutes', description: 'Les Calamity Crew en pleine catastrophe 😂', tags: ['calamity crew'], thumbnail_text: 'KEVIN A ESSAYÉ\nDE DEVENIR RICHE', thumbnail_color: 'ff00aa', thumbnail_accent: 'ffff00' },
    scenes: [
      { en: { text: 'Kevin a une idée', speech: 'Aujourd’hui on devient millionnaires ! Plan garanti 3000% !' },
        fr: { text: 'Kevin a une idée', speech: 'Aujourd’hui on devient millionnaires ! Plan garanti 3000% !' },
        pollinations: 'cartoon fat bald man in tight blue suit confident pose big smile vibrant gumball style' },
      { en: { text: 'Lola chante', speech: 'Je vais chanter et on va être célèbres !' },
        fr: { text: 'Lola chante', speech: 'Je vais chanter et on va être célèbres !' },
        pollinations: 'glamorous cartoon woman huge hair singing mouth open funny dramatic pose' },
      { en: { text: 'Rayan invente', speech: 'Ma machine à argent est prête ! 3 2 1...' },
        fr: { text: 'Rayan invente', speech: 'Ma machine à argent est prête ! 3 2 1...' },
        pollinations: 'nerdy teen taped glasses crazy invention smoking explosion funny' },
      { en: { text: 'Explosion !', speech: 'BOUUUM !' },
        fr: { text: 'Explosion !', speech: 'BOUUUM !' },
        pollinations: 'big cartoon explosion smoke characters flying chaotic funny' },
      { en: { text: 'Gros Nounours', speech: 'Je voulais juste un câlin...' },
        fr: { text: 'Gros Nounours', speech: 'Je voulais juste un câlin...' },
        pollinations: 'huge cartoon bear crying scared big eyes' },
      { en: { text: 'Mimi filme', speech: 'Ça va faire des millions de vues !' },
        fr: { text: 'Mimi filme', speech: 'Ça va faire des millions de vues !' },
        pollinations: 'cute little girl holding phone filming chaos evil smile' },
      { en: { text: 'Fin', speech: 'Abonne-toi pour plus de chaos !' },
        fr: { text: 'Fin', speech: 'Abonne-toi pour plus de chaos !' },
        pollinations: 'calamity crew group waving happy colorful subscribe button' }
    ]
  }
];

// === Le reste du code (utilitaires + serveur) ===
function httpsGet(urlStr) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(urlStr);
      https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return httpsGet(res.headers.location).then(resolve).catch(reject);
        const chunks = []; res.on('data', d => chunks.push(d)); res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    } catch(e) { reject(e); }
  });
}

async function downloadPollinations(prompt, outPath) {
  try {
    const imgData = await httpsGet(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1280&height=720&nologo=true`);
    if (imgData.length > 5000) { fs.writeFileSync(outPath, imgData); return true; }
  } catch(e) {}
  return false;
}

async function getImage(scene, index) {
  const outPath = `/tmp/img_${index}.jpg`;
  if (await downloadPollinations(scene.pollinations, outPath)) return outPath;
  execSync(`ffmpeg -y -f lavfi -i "color=c=#1a1a2e:size=1280x720" -t 1 "${outPath}"`, { timeout: 10000 });
  return outPath;
}

async function getEdgeTTS(text, lang, outPath) {
  try {
    const rawPath = outPath.replace('.mp3', '_raw.mp3');
    execSync(`edge-tts --voice "\( {VOICES[lang]}" --text " \){text.replace(/"/g, "'")}" --write-media "${rawPath}"`, { timeout: 30000 });
    execSync(`ffmpeg -y -i "\( {rawPath}" -ar 44100 -ac 2 " \){outPath}"`, { timeout: 15000 });
    return true;
  } catch(e) { return false; }
}

async function createSceneClip(scene, index, lang) {
  const d = scene[lang];
  const imgPath = await getImage(scene, index);
  const audioPath = `/tmp/audio_\( {lang}_ \){index}.mp3`;
  await getEdgeTTS(d.speech, lang, audioPath);

  const clipPath = `/tmp/clip_\( {lang}_ \){index}.mp4`;
  const textSafe = d.text.replace(/['":\\[\]]/g, ' ').substring(0, 60);

  execSync(`ffmpeg -y -loop 1 -i "\( {imgPath}" -i " \){audioPath}" -t 8 \
    -vf "scale=1280:720,crop=1280:720,drawbox=x=0:y=570:w=1280:h=150:color=black@0.8,drawtext=text='${textSafe}':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=600" \
    -c:v libx264 -c:a aac "${clipPath}"`, { timeout: 60000 });
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
  execSync(`ffmpeg -y -f concat -safe 0 -i "\( {concatFile}" -c:v libx264 -c:a aac " \){outPath}"`, { timeout: 120000 });
  return outPath;
}

const server = http.createServer(async (req, res) => {
  const p = url.parse(req.url).pathname;

  if (p === '/publish') {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end('<h1>🎥 Calamity Crew Bot - Génération en cours...</h1><p>Regarde les logs Railway</p>');
    try {
      const vid = VIDEOS[0];
      await buildVideo(vid, 'fr');
      res.end('<h2>✅ Vidéo générée ! Vérifie les logs.</h2>');
    } catch(e) {
      res.end('<h2>Erreur: ' + e.message + '</h2>');
    }
  } else {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(`
      <h1>🎉 Calamity Crew Bot</h1>
      <p>✅ Bot démarré correctement</p>
      <a href="/publish" style="padding:15px;background:#0a0;color:white;text-decoration:none;border-radius:10px">🚀 Publier une vidéo maintenant</a>
    `);
  }
});

server.listen(PORT, () => console.log(`🎥 Calamity Crew Bot démarré sur port ${PORT}`));
