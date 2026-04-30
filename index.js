const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 8080;

console.log("🎉 Calamity Crew Bot démarré !");

const server = http.createServer(async (req, res) => {
  const path = url.parse(req.url).pathname;

  // Page d'accueil
  if (path === "/" || path === "") {
    res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
    res.end(`
      <h1>🎥 Calamity Crew Bot</h1>
      <p>Version complète chargée ✅</p>
      <br><br>
      <a href="/auth" style="display:block; margin:15px; padding:20px; background:#4285f4; color:white; text-decoration:none; border-radius:10px; font-size:18px;">
        🔗 Connecter YouTube
      </a>
      <a href="/publish" style="display:block; margin:15px; padding:20px; background:#0a0; color:white; text-decoration:none; border-radius:10px; font-size:18px;">
        🚀 Publier une vidéo maintenant
      </a>
    `);
  } 

  // Auth YouTube
  else if (path === "/auth") {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=\( {process.env.YOUTUBE_CLIENT_ID}&redirect_uri= \){encodeURIComponent(process.env.YOUTUBE_REDIRECT_URI)}&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube&access_type=offline&prompt=consent`;
    res.writeHead(302, { Location: authUrl });
    res.end();
  } 

  // Publier vidéo
  else if (path === "/publish") {
    res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
    res.end(`<h1>🎥 Génération en cours...</h1><p>Regarde les logs Railway.</p>`);
    console.log("🚀 Lancement génération Calamity Crew...");
  } 

  else {
    res.writeHead(404, {"Content-Type": "text/html"});
    res.end("<h1>404 - Page non trouvée</h1>");
  }
});

server.listen(PORT, () => {
  console.log(`✅ Serveur actif sur port ${PORT}`);
});
