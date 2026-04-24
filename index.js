const http = require('http');
const https = require('https');
const url = require('url');
const { execSync } = require('child_process');
const fs = require('fs');

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI;
const PORT = process.env.PORT || 8080;

let savedToken = null;

function httpsPost(hostname, path, headers, data) {
  return new Promise((resolve, reject) => {
    const options = { hostname, path, method: 'POST', headers };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function generateScript() {
  const topics = [
    "Un fait insolite sur les animaux marins",
    "Une histoire vraie bizarre qui s'est passée en France",
    "Un mystère scientifique inexpliqué",
    "Un fait choquant sur l'espace",
    "Une coïncidence incroyable dans l'histoire"
  ];
  const topic = topics[Math.floor(Math.random() * topics.length)];
  return `Aujourd'hui nous allons parler de: ${topic}. C'est une histoire fascinante qui va vous surprendre. Restez jusqu'à la fin pour découvrir le secret. ${topic} est l'un des sujets les plus mystérieux de notre époque. Les scientifiques eux-mêmes n'arrivent pas à l'expliquer. Voilà pourquoi ce sujet passionne des millions de personnes dans le monde entier.`;
}

async function generateAudio(script) {
  const apiKey = process.env.ELEVEN_API_KEY;
  if (!apiKey) return null;
  const data = JSON.strin
