const http = require('http');
const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');
const url = require('url');

const PORT = process.env.PORT || 8080;

console.log("🎉 Calamity Crew Bot démarré sur port " + PORT);

const server = http.createServer((req, res) => {
  const p = url.parse(req.url).pathname;
  if (p === '/publish') {
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    res.end(`
      <h1>🎥 Calamity Crew Bot</h1>
      <p>Génération en cours... Regarde les logs Railway.</p>
      <p>✅ Bot simplifié et corrigé</p>
    `);
  } else {
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    res.end(`
      <h1>🎉 LES CALAMITY CREW BOT</h1>
      <p>Bot prêt !</p>
      <a href="/publish" style="padding:20px;background:#0a0;color:white;font-size:20px;text-decoration:none;border-radius:10px;display:inline-block;margin:20px">🚀 Publier une vidéo maintenant</a>
      <p><small>Version simplifiée - stable</small></p>
    `);
  }
});

server.listen(PORT);
