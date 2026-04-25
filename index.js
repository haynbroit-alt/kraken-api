const http = require('http');
const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');
const url = require('url');

const PORT = process.env.PORT || 8080;
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI;

let token = null;
if (fs.existsSync('/tmp/token.json')) {
  token = JSON.parse(fs.readFileSync('/tmp/token.json'));
}

const VIDEOS = [
  { title: 'Une découverte qui change tout', script: 'Des scientifiques viennent de faire une découverte extraordinaire. Ce que vous allez entendre va changer votre façon de voir le monde. Restez jusqu\'à la fin, vous ne serez pas déçu.', color: '1a1a2e' },
  { title: 'Ce secret existe depuis des siècles', script: 'Il existe un secret que les puissants ont caché pendant des siècles. Une vérité enterrée, oubliée, mais aujourd\'hui révélée. Voici ce qu\'on ne voulait pas que vous sachiez.', color: '16213e' },
  { title: 'Le mystère que la science ne peut pas expliquer', script: 'Certains phénomènes défient toute logique. Des événements que les plus grands scientifiques au monde n\'arrivent pas à expliquer. Ce mystère en fait partie.', color: '0f3460' },
  { title: 'La vérité sur l\'univers', script: 'L\'univers cache des secrets que vous n\'imaginez même pas. Des faits stupéfiants sur l\'espace, le temps, et notre place dans le cosmos. Préparez-vous à être bouleversé.', color: '533483' },
  { title: 'Ce fait va te laisser sans voix', script: 'Il y a des faits si incroyables qu\'on refuse d\'y croire au premier abord. Pourtant, ils sont réels, documentés, et absolument fascinants. En voici un qui va vous marquer.', color: '2b2d42' },
  { title: 'L\'histoire qu\'on vous a cachée', script: 'Les livres d\'histoire ne vous ont pas tout dit. Des événements majeurs ont été effacés, modifiés, ou simplement ignorés. Il est temps de connaître la vérité.', color: '1b1b2f' },
];

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function refreshToken() {
  if (!token || !token.refresh_token) return false;
  try {
    const body = `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&refresh_token=${token.refresh_token}&grant_type=refresh_token`;
    const result = await httpsPost('oauth2.googleapis.com', '/token', { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }, body);
    if (result.access_token) {
      token.access_token = result.access_token;
      fs.writeFileSync('/tmp/token.json', JSON.stringify(token));
      return true;
    }
  } catch (e) { console.log('Refresh error:', e.message); }
  return false;
}

async function generateVideo(vid) {
  // 1. Télécharger l'audio TTS via Google (gratuit, sans clé)
  const text = encodeURIComponent(vid.script);
  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${text}&tl=fr&client=tw-ob`;
  
  execSync(`curl -s -A "Mozilla/5.0" "${ttsUrl}" -o /tmp/audio.mp3`, { timeout: 30000 });
  console.log('Audio TTS téléchargé');

  // 2. Créer la vidéo avec FFmpeg : fond coloré + texte + audio
  const color = vid.color;
  const titleSafe = vid.title.replace(/'/g, "\\'").replace(/"/g, '\\"');
  
  // Calculer la durée de l'audio
  let duration = 30;
  try {
    const probe = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 /tmp/audio.mp3 2>/dev/null`).toString().trim();
    duration = Math.ceil(parseFloat(probe)) + 2;
    if (isNaN(duration) || duration < 10) duration = 30;
  } catch (e) { duration = 30; }
  console.log(`Durée vidéo: ${duration}s`);

  // 3. Assembler la vidéo
  const ffmpegCmd = `ffmpeg -y \
    -f lavfi -i "color=c=#${color}:size=1280x720:rate=25" \
    -i /tmp/audio.mp3 \
    -t ${duration} \
    -vf "drawtext=text='${titleSafe}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.5:boxborderw=20,drawtext=text='Fait Insolite':fontcolor=#aaaaaa:fontsize=28:x=(w-text_w)/2:y=h-100" \
    -c:v libx264 -c:a aac -pix_fmt yuv420p -shortest \
    /tmp/video.mp4 2>&1`;

  execSync(ffmpegCmd, { timeout: 120000 });
  console.log('Vidéo générée');
  return duration;
}

async function uploadYouTube(vid) {
  const videoData = fs.readFileSync('/tmp/video.mp4');
  const meta = JSON.stringify({
    snippet: {
      title: vid.title,
      description: `${vid.script}\n\n#FaitInsolite #Mystère #Découverte`,
      tags: ['fait insolite', 'mystère', 'découverte', 'science', 'univers'],
      categoryId: '27'
    },
    status: { privacyStatus: 'public' }
  });

  const boundary = 'boundary_kraken_2026';
  const bodyParts = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
    `--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`,
  ];
  
  const bodyStart = Buffer.from(bodyParts.join(''));
  const bodyEnd = Buffer.from(`\r\n--${boundary}--`);
  const fullBody = Buffer.concat([bodyStart, videoData, bodyEnd]);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'www.googleapis.com',
      path: '/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': fullBody.length,
      }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({ error: data }); }
      });
    });
    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const p = url.parse(req.url).pathname;

  if (p === '/auth') {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload&access_type=offline&prompt=consent`;
    res.writeHead(302, { Location: authUrl });
    res.end();
  }

  else if (p === '/callback') {
    const code = url.parse(req.url, true).query.code;
    const body = `code=${code}&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&grant_type=authorization_code`;
    const result = await httpsPost('oauth2.googleapis.com', '/token', { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }, body);
    token = result;
    fs.writeFileSync('/tmp/token.json', JSON.stringify(token));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>✅ YouTube connecté !</h1><a href="/publish">Publier une vidéo</a>');
  }

  else if (p === '/publish') {
    if (!token) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<a href="/auth">🔗 Connecter YouTube</a>');
      return;
    }

    // Rafraîchir le token si nécessaire
    await refreshToken();

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

    const vid = VIDEOS[Math.floor(Math.random() * VIDEOS.length)];
    res.write(`<h1>🎬 Génération en cours...</h1><p>📝 Sujet : <b>${vid.title}</b></p>`);

    try {
      res.write('<p>🎙️ Génération de la voix IA...</p>');
      await generateVideo(vid);
      res.write('<p>✅ Vidéo créée avec voix + texte + fond</p>');
      res.write('<p>📤 Upload sur YouTube...</p>');

      const result = await uploadYouTube(vid);

      if (result.id) {
        res.end(`<p>🎉 <b>Publié !</b> <a href="https://youtube.com/watch?v=${result.id}" target="_blank">Voir la vidéo ▶</a></p><br><a href="/publish">Publier une autre</a>`);
      } else {
        const errMsg = JSON.stringify(result).substring(0, 300);
        res.end(`<p>❌ Erreur upload : ${errMsg}</p><br><a href="/publish">Réessayer</a>`);
      }
    } catch (e) {
      res.end(`<p>❌ Erreur : ${e.message.substring(0, 200)}</p><br><a href="/publish">Réessayer</a>`);
    }
  }

  else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <h1>🎬 KRAKEN YouTube Bot</h1>
      <p>${token ? '✅ YouTube connecté' : '⚠️ YouTube non connecté'}</p>
      <ul>
        <li><a href="/auth">🔗 Connecter YouTube</a></li>
        <li><a href="/publish">🚀 Publier une vidéo</a></li>
      </ul>
    `);
  }
});

server.listen(PORT, () => console.log('KRAKEN OK port ' + PORT));
