const http = require('http');
const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');
const url = require('url');

const PORT = process.env.PORT || 8080;

console.log("🎉 Calamity Crew Bot démarré !");

const VIDEOS = [
  {
    title: "Kevin a essayé de devenir millionnaire en 5 minutes",
    description: "Les Calamity Crew tentent de s'enrichir... ça finit en catastrophe totale 😂",
    scenes: [
      { text: "Kevin : Aujourd'hui on devient riches !", prompt: "fat bald man in tight blue suit confident pose big smile cartoon gumball style" },
      { text: "Lola chante faux", prompt: "glamorous woman huge blonde hair singing mouth open dramatic funny cartoon" },
      { text: "Rayan invente une machine", prompt: "nerdy teen taped glasses crazy smoking invention explosion cartoon" },
      { text: "Explosion !!", prompt: "big cartoon explosion smoke characters flying chaotic funny" },
      { text: "Gros Nounours pleure", prompt: "huge cute bear man crying scared big teary eyes cartoon" },
      { text: "Mimi filme tout", prompt: "little girl holding phone filming chaos evil smile cartoon" },
      { text: "Fin", prompt: "group of 5 cartoon characters waving happy colorful subscribe button" }
    ]
  }
];

// ====================== SERVEUR SIMPLE ======================
const server = http.createServer(async (req, res) => {
  const path = url.parse(req.url).pathname;

  if (path === "/publish") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <h1>🎥 Calamity Crew Bot</h1>
      <p>Génération en cours... Regarde les logs Railway.</p>
      <p><strong>Version simplifiée chargée</strong></p>
    `);
    console.log("🚀 Lancement de la génération d'une vidéo Calamity Crew...");
  } else {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <h1>🎉 Calamity Crew Bot</h1>
      <p>Bot actif et simplifié</p>
      <a href="/publish" style="padding:20px; background:#0a0; color:white; text-decoration:none; border-radius:10px; font-size:18px;">Publier une vidéo maintenant</a>
    `);
  }
});

server.listen(PORT, () => {
  console.log(`✅ Calamity Crew Bot démarré sur port ${PORT}`);
});
