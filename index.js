const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const { execSync } = require('child_process');

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI;
const PORT = process.env.PORT || 8080;

let savedToken = null;

function getFfmpeg() {
  if (fs.existsSync('/usr/bin/ffmpeg')) return '/usr/bin/ffmpeg';
  try { return execSync('which ffmpeg').toString().trim(); } catch(e) {}
  return null;
}

function httpsPost(hostname, path, headers, data) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { resolve(body); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function generateScript() {
  const topics = [
    "Un fait insolite sur les animaux marins",
    "Une histoire vraie bizarre en France",
    "Un mystere scientifique inexplique",
    "Un fait choquant sur l espace",
    "Une coincidence incroyable dans l histoire"
  ];
  const topic = topics[Math.floor(Math.random() * topics.length)];
  return { topic };
}

async function createVideo(topic) {
  const ffmpeg = getFfmpeg();
  if (!ffmpeg) return { error: 'FFmpeg non trouve' };
  try {
    execSync(
      ffmpeg + " -y -f lavfi -i color=c=blue:size=1280x720:rate=25 -f lavfi -i anullsrc=r=44100:cl=stereo -t 10 -c:v libx264 -c:a aac -pix_fmt yuv420p /tmp/video.mp4",
      { timeout: 60000 }
    );
    return { path: '/tmp/video.mp4' };
  } catch(e) {
    return { error: e.message.substring(0, 300) };
  }
}

async function uploadToYoutube(title, videoPath) {
  if (!savedToken) return { error: 'Non connecte' };
  const videoData = fs.readFileSync(videoPath);
  const metadata = JSON.stringify({
    snippet: { title: title, description: title + " - Histoire fascinante!", categoryId: '22' },
    status: { privacyStatus: 'public' }
  });
  const
