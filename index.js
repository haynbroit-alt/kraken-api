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

// Installer edge-tts
try {
  execSync('pip3 install edge-tts --quiet --break-system-packages 2>/dev/null || pip install edge-tts --quiet 2>/dev/null', { timeout: 30000 });
} catch(e) {}

const VOICES = {
  en: 'en-US-ChristopherNeural',
  fr: 'fr-FR-HenriNeural',
};

const MUSIC_URLS = [
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
];

// ─── VIDÉOS AVEC TITRES VIRAUX + HOOKS FORTS ─────────────────────────────
const VIDEOS = [
  {
    en: {
      title: 'Scientists Are Hiding This From You (Universe Secrets)',
      description: 'What they never taught you in school. The universe is far stranger than anyone will admit. Watch until the end for the most shocking secret.\n\n#universe #space #mystery #mindblowing #science #facts',
      tags: ['universe secrets','space facts','mind blowing','shocking truth','science revealed','they dont want you to know'],
      thumbnail_text: 'SCIENTISTS\nHID THIS\nFROM YOU',
      thumbnail_color: '0d0d2b',
      thumbnail_accent: 'FF4500',
    },
    fr: {
      title: 'Ce que les scientifiques vous cachent sur l\'univers',
      description: 'Ce qu\'on ne vous a jamais appris à l\'école. L\'univers est bien plus étrange que quiconque ne veut l\'admettre. Restez jusqu\'à la fin pour le secret le plus choquant.\n\n#univers #espace #mystere #incroyable #science #faits',
      tags: ['secrets univers','faits espace','incroyable','verite choquante','science revelee','ce qu ils cachent'],
      thumbnail_text: 'ILS VOUS\nCACHENT\nCECI',
      thumbnail_color: '0d0d2b',
      thumbnail_accent: 'FF4500',
    },
    scenes: [
      {
        en: { text: 'They never wanted you to know this...', speech: 'Stop. Before you scroll away — what you are about to discover will permanently change how you see everything around you. Stay until the end. The last secret is the most shocking.' },
        fr: { text: 'Ils ne voulaient pas que vous sachiez ceci...', speech: 'Attendez. Avant de partir — ce que vous allez découvrir va changer définitivement votre façon de voir le monde. Restez jusqu\'à la fin. Le dernier secret est le plus choquant.' },
        pexels: 'galaxy space stars', pollinations: 'deep space galaxy cosmic nebula cinematic dark'
      },
      {
        en: { text: 'Dark matter: the invisible 85% of everything', speech: 'Dark matter makes up 85 percent of all mass in the universe. We cannot see it, touch it, or detect it directly. Yet without it, galaxies would not exist. Scientists admit they have no idea what it is.' },
        fr: { text: 'La matiere noire: 85% de tout ce qui existe', speech: 'La matière noire représente 85 pour cent de toute la masse de l\'univers. On ne peut pas la voir, la toucher, ni la détecter directement. Pourtant sans elle, les galaxies n\'existeraient pas.' },
        pexels: 'dark nebula space', pollinations: 'dark matter invisible universe mysterious energy glow'
      },
      {
        en: { text: 'Black holes erase time itself', speech: 'Near a black hole, time slows down so dramatically that it virtually stops. An astronaut falling in would appear frozen forever to an outside observer. Time itself breaks down.' },
        fr: { text: 'Les trous noirs effacent le temps lui-meme', speech: 'Près d\'un trou noir, le temps ralentit si dramatiquement qu\'il s\'arrête pratiquement. Un astronaute qui tomberait dedans semblerait figé pour toujours à un observateur extérieur.' },
        pexels: 'black hole space', pollinations: 'black hole time distortion frozen light event horizon'
      },
      {
        en: { text: 'The universe should not exist at all', speech: 'After the Big Bang, matter and antimatter should have annihilated each other completely, leaving nothing. The fact that anything exists at all is a mystery physics cannot explain.' },
        fr: { text: 'L\'univers ne devrait pas exister du tout', speech: 'Après le Big Bang, la matière et l\'antimatière auraient dû s\'annihiler complètement, ne laissant rien. Le fait que quoi que ce soit existe est un mystère que la physique ne peut pas expliquer.' },
        pexels: 'big bang creation universe', pollinations: 'big bang antimatter annihilation mystery universe creation'
      },
      {
        en: { text: 'You are made of dead stars', speech: 'Every single atom in your body was forged inside a dying star billions of years ago. The iron in your blood, the calcium in your bones — all came from stellar explosions across the galaxy.' },
        fr: { text: 'Vous etes fait d\'etoiles mortes', speech: 'Chaque atome de votre corps a été forgé dans une étoile mourante il y a des milliards d\'années. Le fer dans votre sang, le calcium dans vos os — tout vient d\'explosions stellaires.' },
        pexels: 'stardust cosmos human', pollinations: 'stardust atoms human cosmic connection supernova'
      },
      {
        en: { text: 'Space is completely silent — and it screams', speech: 'Sound cannot travel in space. But electromagnetic waves create frequencies that, if converted to sound, produce terrifying screams and roars. NASA has recorded these. They are haunting.' },
        fr: { text: 'L\'espace est silencieux — et il hurle', speech: 'Le son ne peut pas voyager dans l\'espace. Mais les ondes électromagnétiques créent des fréquences qui, converties en son, produisent des hurlements terrifiants. La NASA les a enregistrés.' },
        pexels: 'space silent cosmos', pollinations: 'space electromagnetic waves sound haunting NASA recording'
      },
      {
        en: { text: 'The universe may be a giant hologram', speech: 'Some physicists seriously propose that our three-dimensional universe is actually a holographic projection from a two-dimensional surface. Everything you see may be an illusion.' },
        fr: { text: 'L\'univers est peut-etre un hologramme geant', speech: 'Certains physiciens proposent sérieusement que notre univers tridimensionnel est une projection holographique d\'une surface bidimensionnelle. Tout ce que vous voyez est peut-être une illusion.' },
        pexels: 'hologram projection universe', pollinations: 'holographic universe simulation projection 2D surface illusion'
      },
      {
        en: { text: 'We have only explored 0.0001% of the universe', speech: 'The observable universe stretches 93 billion light-years across. Our most powerful telescopes have examined a fraction of a fraction. What lies beyond is completely unknown.' },
        fr: { text: 'On n\'a explore que 0,0001% de l\'univers', speech: 'L\'univers observable s\'étend sur 93 milliards d\'années-lumière. Nos télescopes les plus puissants n\'en ont examiné qu\'une infime fraction. Ce qui se trouve au-delà est totalement inconnu.' },
        pexels: 'telescope deep space exploration', pollinations: 'telescope deep space unexplored vast unknown cosmos'
      },
      {
        en: { text: 'The most shocking secret: we might be alone', speech: 'Despite billions of potentially habitable planets, after decades of searching, we have found zero evidence of other intelligent life. The silence of the cosmos may be the most terrifying fact of all.' },
        fr: { text: 'Le secret le plus choquant: nous sommes peut-etre seuls', speech: 'Malgré des milliards de planètes potentiellement habitables, après des décennies de recherche, nous n\'avons trouvé aucune preuve d\'une autre vie intelligente. Le silence du cosmos est peut-être le fait le plus terrifiants.' },
        pexels: 'alone universe empty space', pollinations: 'alone universe empty silence terrifying cosmic isolation'
      },
      {
        en: { text: 'SUBSCRIBE — New secrets every week', speech: 'If this blew your mind, subscribe right now. We drop new universe secrets every single week that will make you question everything. Hit the notification bell. You do not want to miss the next one.' },
        fr: { text: 'ABONNEZ-VOUS — Nouveaux secrets chaque semaine', speech: 'Si cela vous a époustouflé, abonnez-vous maintenant. Nous publions de nouveaux secrets chaque semaine qui vous feront tout remettre en question. Activez la cloche. Vous ne voulez pas manquer le prochain.' },
        pexels: 'subscribe youtube notification', pollinations: 'youtube subscribe notification bell subscribe now'
      },
    ]
  },
  {
    en: {
      title: 'Nobody Told You These Facts (They Should Have)',
      description: 'You were never taught these in school. Mind-blowing facts that will change everything you think you know. Watch until the end.\n\n#facts #mindblowing #didyouknow #amazing #shocking',
      tags: ['mind blowing facts','did you know','shocking facts','amazing facts','facts you didnt know','school never taught'],
      thumbnail_text: 'NOBODY\nTOLD YOU\nTHIS',
      thumbnail_color: '1a0a00',
      thumbnail_accent: 'FFD700',
    },
    fr: {
      title: 'Ces faits incroyables qu\'on ne vous a jamais appris',
      description: 'On ne vous les a jamais enseignés à l\'école. Des faits époustouflants qui vont changer tout ce que vous croyez savoir.\n\n#faits #incroyable #saviezvouz #choquant #decouverte',
      tags: ['faits incroyables','saviez vous','faits choquants','faits stupéfiants','ecole ne dit pas','decouverte'],
      thumbnail_text: 'ON NE VOUS\nA JAMAIS\nDIT CECI',
      thumbnail_color: '1a0a00',
      thumbnail_accent: 'FFD700',
    },
    scenes: [
      {
        en: { text: 'These facts will make you question everything', speech: 'Warning. These ten facts are so mind-bending that after watching this, you will never look at the world the same way again. Number seven shocked even scientists.' },
        fr: { text: 'Ces faits vont tout remettre en question', speech: 'Attention. Ces dix faits sont tellement déroutants qu\'après avoir regardé ceci, vous ne verrez plus jamais le monde de la même façon. Le numéro sept a même choqué les scientifiques.' },
        pexels: 'mind blown shocked', pollinations: 'mind blown shocked incredible facts revelation'
      },
      {
        en: { text: 'FACT 1: Cleopatra lived closer to the Moon landing than pyramids', speech: 'Cleopatra lived from 69 to 30 BC. The pyramids were built around 2560 BC. The Moon landing was 1969 AD. She was 2500 years closer to Apollo 11 than to the pyramids. History is not what you think.' },
        fr: { text: 'FAIT 1: Cleopatre etait plus proche de la lune que des pyramides', speech: 'Cléopâtre a vécu de 69 à 30 avant J.C. Les pyramides ont été construites vers 2560 avant J.C. L\'alunissage était en 1969. Elle était 2500 ans plus proche d\'Apollo 11 que des pyramides.' },
        pexels: 'cleopatra egypt ancient', pollinations: 'Cleopatra Egypt moon landing Apollo timeline history'
      },
      {
        en: { text: 'FACT 2: Oxford University is older than the Aztec Empire', speech: 'Oxford University began teaching in 1096. The Aztec Empire was founded in 1428. Oxford is 332 years older. When Aztecs were building Tenochtitlan, Oxford students had already been studying for three centuries.' },
        fr: { text: 'FAIT 2: Oxford est plus vieille que l\'empire azteque', speech: 'Oxford a commencé à enseigner en 1096. L\'empire aztèque a été fondé en 1428. Oxford a 332 ans de plus. Quand les Aztèques construisaient Tenochtitlan, les étudiants d\'Oxford étudiaient depuis trois siècles.' },
        pexels: 'oxford university medieval', pollinations: 'Oxford University ancient medieval Aztec empire comparison'
      },
      {
        en: { text: 'FACT 3: Sharks are older than trees', speech: 'Sharks have patrolled Earth\'s oceans for 450 million years. Trees only evolved 350 million years ago. Sharks swam in a world completely without forests for 100 million years.' },
        fr: { text: 'FAIT 3: Les requins sont plus vieux que les arbres', speech: 'Les requins patrouillent les océans depuis 450 millions d\'années. Les arbres n\'ont évolué qu\'il y a 350 millions d\'années. Les requins ont nagé dans un monde sans forêts pendant 100 millions d\'années.' },
        pexels: 'shark ancient ocean', pollinations: 'ancient shark prehistoric ocean no trees 450 million years'
      },
      {
        en: { text: 'FACT 4: Your body replaces itself completely every 7 years', speech: 'Almost every cell in your body is replaced over seven years. The person you were seven years ago is literally a different physical being. You are constantly rebuilding yourself from scratch.' },
        fr: { text: 'FAIT 4: Votre corps se renouvelle completement tous les 7 ans', speech: 'Presque chaque cellule de votre corps est remplacée en sept ans. La personne que vous étiez il y a sept ans est littéralement un être physique différent. Vous vous reconstruisez constamment.' },
        pexels: 'cell renewal human body', pollinations: 'human body cell renewal replacement 7 years biology'
      },
      {
        en: { text: 'FACT 5: The Great Wall of China cannot be seen from space', speech: 'Despite the popular belief, the Great Wall of China is not visible from space with the naked eye. It is too narrow. Chinese astronaut Yang Liwei confirmed he could not see it from orbit.' },
        fr: { text: 'FAIT 5: La Grande Muraille est invisible depuis l\'espace', speech: 'Contrairement à la croyance populaire, la Grande Muraille de Chine n\'est pas visible depuis l\'espace à l\'oeil nu. Elle est trop étroite. L\'astronaute chinois Yang Liwei a confirmé ne pas pouvoir la voir.' },
        pexels: 'great wall china space', pollinations: 'Great Wall China invisible from space orbit fact myth'
      },
      {
        en: { text: 'FACT 6: There are more trees than stars in the Milky Way', speech: 'The Milky Way contains an estimated 100 to 400 billion stars. Earth has approximately 3 trillion trees. You are 10 times more likely to touch a tree than a star exists in our entire galaxy.' },
        fr: { text: 'FAIT 6: Plus d\'arbres sur Terre que d\'etoiles dans la galaxie', speech: 'La Voie Lactée contient entre 100 et 400 milliards d\'étoiles. La Terre a environ 3 000 milliards d\'arbres. Il y a 10 fois plus d\'arbres que d\'étoiles dans toute notre galaxie.' },
        pexels: 'forest trees aerial vast', pollinations: 'forest trees aerial vast more than stars galaxy'
      },
      {
        en: { text: 'FACT 7: Your brain cannot feel any pain', speech: 'The brain has zero pain receptors. It cannot feel anything. Brain surgery can be performed on a fully conscious, awake patient. Surgeons sometimes ask patients to talk during the operation to monitor brain function.' },
        fr: { text: 'FAIT 7: Votre cerveau ne ressent aucune douleur', speech: 'Le cerveau n\'a aucun récepteur de douleur. Il ne peut rien ressentir. Une chirurgie cérébrale peut être effectuée sur un patient totalement conscient. Les chirurgiens demandent parfois au patient de parler pendant l\'opération.' },
        pexels: 'brain surgery science', pollinations: 'brain surgery conscious awake no pain receptors neurons'
      },
      {
        en: { text: 'FACT 8: A day on Venus lasts longer than its year', speech: 'Venus takes 243 Earth days to rotate once on its axis. But it only takes 225 days to orbit the Sun. So a day on Venus is longer than its year. And it spins backwards.' },
        fr: { text: 'FAIT 8: Un jour sur Venus dure plus qu\'une annee', speech: 'Vénus met 243 jours terrestres pour faire une rotation complète. Mais seulement 225 jours pour orbiter autour du Soleil. Donc un jour vénusien dure plus longtemps qu\'une année. Et elle tourne à l\'envers.' },
        pexels: 'venus planet space', pollinations: 'Venus planet backwards rotation day longer than year'
      },
      {
        en: { text: 'SUBSCRIBE — We post every week', speech: 'Every week we bring you facts so incredible you will need to share them immediately. Subscribe and hit the bell so you never miss a video. See you in the next one.' },
        fr: { text: 'ABONNEZ-VOUS — Une video par semaine', speech: 'Chaque semaine nous vous apportons des faits tellement incroyables que vous devrez les partager immédiatement. Abonnez-vous et activez la cloche pour ne jamais manquer une vidéo.' },
        pexels: 'subscribe bell youtube', pollinations: 'youtube subscribe notification bell subscribe now viral'
      },
    ]
  },
  {
    en: {
      title: 'Ancient Secrets They Don\'t Want You To Find',
      description: 'These ancient mysteries have been buried for thousands of years. What they found changes everything we know about human history.\n\n#ancient #mystery #history #forbidden #archaeology',
      tags: ['ancient mysteries','forbidden history','they dont want you to know','ancient secrets','archaeology shocking','hidden history'],
      thumbnail_text: 'FORBIDDEN\nANCIENT\nSECRETS',
      thumbnail_color: '1a0f00',
      thumbnail_accent: 'C0A000',
    },
    fr: {
      title: 'Ces secrets anciens qu\'on vous interdit de connaitre',
      description: 'Ces mystères anciens ont été enterrés pendant des millénaires. Ce qu\'ils ont trouvé change tout ce que nous savons sur l\'histoire humaine.\n\n#ancien #mystere #histoire #archeologie #interdit',
      tags: ['mysteres anciens','histoire interdite','secrets caches','archeologie choquante','histoire cachee','decouverte ancienne'],
      thumbnail_text: 'SECRETS\nANCIENS\nINTERDITS',
      thumbnail_color: '1a0f00',
      thumbnail_accent: 'C0A000',
    },
    scenes: [
      {
        en: { text: 'What they found underground changes everything', speech: 'Some discoveries are so contradictory to official history that they are quietly buried, ignored, or classified. What you are about to see was never meant to reach the public.' },
        fr: { text: 'Ce qu\'ils ont trouve change tout', speech: 'Certaines découvertes contredisent tellement l\'histoire officielle qu\'elles sont discrètement enterrées, ignorées ou classifiées. Ce que vous allez voir n\'était jamais censé atteindre le public.' },
        pexels: 'ancient ruins underground mystery', pollinations: 'ancient underground discovery forbidden history buried secret'
      },
      {
        en: { text: 'The Pyramids align with Orion\'s Belt perfectly', speech: 'The three pyramids of Giza align precisely with the three stars of Orion\'s Belt, as they appeared in 10500 BC — thousands of years before the pyramids were supposedly built. How?' },
        fr: { text: 'Les pyramides s\'alignent parfaitement avec Orion', speech: 'Les trois pyramides de Gizeh s\'alignent précisément avec les trois étoiles de la ceinture d\'Orion, telles qu\'elles apparaissaient en 10500 avant J.C — des milliers d\'années avant que les pyramides soient censées avoir été construites.' },
        pexels: 'pyramids giza night stars', pollinations: 'pyramids Giza Orion Belt stars alignment 10500 BC night sky'
      },
      {
        en: { text: 'A 2000-year-old computer was found in a shipwreck', speech: 'The Antikythera Mechanism, recovered from a Roman shipwreck in 1901, is a bronze device with 37 gears that accurately predicted astronomical events. It should not exist for that era.' },
        fr: { text: 'Un ordinateur de 2000 ans trouve dans un naufrage', speech: 'Le mécanisme d\'Anticythère, récupéré d\'un naufrage romain en 1901, est un dispositif en bronze avec 37 engrenages qui prédisait avec précision les événements astronomiques. Il ne devrait pas exister pour cette époque.' },
        pexels: 'ancient mechanism gears bronze', pollinations: 'Antikythera mechanism ancient computer bronze gears astronomical'
      },
      {
        en: { text: 'Stone carvings in Egypt show flying machines', speech: 'Temple carvings at Abydos, Egypt, appear to show a helicopter, submarine, and aircraft. Egyptologists call it a coincidence. Others are not so sure.' },
        fr: { text: 'Des sculptures egyptiennes montrent des machines volantes', speech: 'Des sculptures dans le temple d\'Abydos en Égypte semblent montrer un hélicoptère, un sous-marin et un avion. Les égyptologues appellent ça une coïncidence. D\'autres ne sont pas si sûrs.' },
        pexels: 'egypt temple carvings hieroglyphs', pollinations: 'Egypt Abydos temple carvings helicopter submarine ancient technology'
      },
      {
        en: { text: 'An entire city was found beneath the ocean', speech: 'Off the coast of Japan, massive stone structures were discovered near Yonaguni Island. They appear to be a submerged city with roads, arches, and staircases — predating any known civilization.' },
        fr: { text: 'Une ville entiere a ete trouvee sous l\'ocean', speech: 'Au large du Japon, d\'immenses structures en pierre ont été découvertes près de l\'île de Yonaguni. Elles semblent être une ville submergée avec des routes, des arches et des escaliers — antérieure à toute civilisation connue.' },
        pexels: 'underwater ancient ruins ocean', pollinations: 'Yonaguni Japan underwater city submerged ancient civilization'
      },
      {
        en: { text: 'Ancient batteries were found in Baghdad', speech: 'Clay jars from 250 BC, found in Iraq, contain copper cylinders and iron rods. When filled with acidic liquid, they generate electricity. Ancient electric batteries, 2000 years before modern ones.' },
        fr: { text: 'Des batteries antiques trouvees a Bagdad', speech: 'Des jarres en argile datant de 250 avant J.C., trouvées en Irak, contiennent des cylindres de cuivre et des tiges de fer. Remplies de liquide acide, elles génèrent de l\'électricité. Des batteries électriques 2000 ans avant les nôtres.' },
        pexels: 'ancient battery clay pot', pollinations: 'Baghdad battery ancient electricity clay copper rod 250 BC'
      },
      {
        en: { text: 'A 12000-year-old temple predates civilization', speech: 'Göbekli Tepe in Turkey is a massive temple complex built 12000 years ago — 7000 years before Stonehenge, 7500 before the pyramids. It was deliberately buried. Who built it and why remain unknown.' },
        fr: { text: 'Un temple de 12000 ans precede la civilisation', speech: 'Göbekli Tepe en Turquie est un complexe de temples construit il y a 12000 ans — 7000 ans avant Stonehenge, 7500 avant les pyramides. Il a été délibérément enterré. Qui l\'a construit et pourquoi restent inconnus.' },
        pexels: 'gobekli tepe ancient turkey', pollinations: 'Gobekli Tepe ancient temple 12000 years Turkey buried'
      },
      {
        en: { text: 'Ancient maps showed Antarctica before its discovery', speech: 'The Piri Reis map of 1513 accurately shows Antarctica\'s coastline — 300 years before Europeans officially discovered it in 1820. And it shows Antarctica without ice, as it was thousands of years ago.' },
        fr: { text: 'Des cartes anciennes montraient l\'Antarctique avant sa decouverte', speech: 'La carte de Piri Reis de 1513 montre avec précision le littoral de l\'Antarctique — 300 ans avant sa découverte officielle en 1820. Et elle montre l\'Antarctique sans glace, comme il était il y a des milliers d\'années.' },
        pexels: 'ancient map parchment exploration', pollinations: 'Piri Reis map 1513 Antarctica coastline ancient accurate'
      },
      {
        en: { text: 'The truth about ancient history is still hidden', speech: 'These are just a fraction of the anomalies that challenge official history. The more archaeologists dig, the more they find that human civilization is far older and far stranger than textbooks admit.' },
        fr: { text: 'La verite sur l\'histoire ancienne est encore cachee', speech: 'Ce ne sont qu\'une fraction des anomalies qui remettent en question l\'histoire officielle. Plus les archéologues fouillent, plus ils trouvent que la civilisation humaine est bien plus ancienne et étrange que les manuels ne l\'admettent.' },
        pexels: 'archaeology discovery ancient dig', pollinations: 'ancient archaeology discovery hidden truth history forbidden'
      },
      {
        en: { text: 'SUBSCRIBE — The truth continues next week', speech: 'Subscribe right now and turn on notifications. Every week we uncover more of what they buried. The next video will change your understanding of human history forever.' },
        fr: { text: 'ABONNEZ-VOUS — La verite continue la semaine prochaine', speech: 'Abonnez-vous maintenant et activez les notifications. Chaque semaine nous révélons plus de ce qu\'ils ont enterré. La prochaine vidéo changera pour toujours votre compréhension de l\'histoire humaine.' },
        pexels: 'subscribe history', pollinations: 'youtube subscribe ancient history secrets notification bell'
      },
    ]
  },
];

// ─── UTILITAIRES ───────────────────────────────────────────────────────────
function httpsGet(urlStr) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(urlStr);
      https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return httpsGet(res.headers.location).then(resolve).catch(reject);
        }
        const chunks = []; res.on('data', d => chunks.push(d)); res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    } catch(e) { reject(e); }
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

// ─── MINIATURE VIRALE ──────────────────────────────────────────────────────
async function generateThumbnail(vid, lang, bgImagePath) {
  const thumbPath = `/tmp/thumb_${lang}.jpg`;
  const meta = vid[lang];
  const lines = meta.thumbnail_text.split('\n');
  const color = meta.thumbnail_color;
  const accent = meta.thumbnail_accent;

  // Texte ffmpeg pour chaque ligne
  const lineHeight = 120;
  const startY = Math.floor((720 - lines.length * lineHeight) / 2);
  let drawTexts = '';
  lines.forEach((line, i) => {
    const y = startY + i * lineHeight;
    const safe = line.replace(/'/g, ' ').replace(/"/g, ' ');
    // Ombre
    drawTexts += `,drawtext=text='${safe}':fontcolor=black@0.8:fontsize=110:x=(w-text_w)/2+4:y=${y+4}:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf`;
    // Texte principal
    drawTexts += `,drawtext=text='${safe}':fontcolor=#${accent}:fontsize=110:x=(w-text_w)/2:y=${y}:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf`;
  });

  try {
    if (bgImagePath && fs.existsSync(bgImagePath)) {
      // Miniature avec image de fond + overlay sombre + texte
      execSync(`ffmpeg -y -i "${bgImagePath}" \
        -vf "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,\
drawbox=x=0:y=0:w=1280:h=720:color=#${color}@0.65:t=fill${drawTexts}" \
        -frames:v 1 "${thumbPath}" 2>/dev/null`, { timeout: 30000 });
    } else {
      // Miniature fond coloré + texte
      execSync(`ffmpeg -y -f lavfi -i "color=c=#${color}:size=1280x720" \
        -vf "drawbox=x=0:y=0:w=1280:h=720:color=#${color}:t=fill${drawTexts}" \
        -frames:v 1 "${thumbPath}" 2>/dev/null`, { timeout: 30000 });
    }
    return thumbPath;
  } catch(e) {
    console.log('Thumb err:', e.message);
    return null;
  }
}

// ─── MUSIQUE ───────────────────────────────────────────────────────────────
async function getMusic() {
  const musicPath = '/tmp/music.mp3';
  if (fs.existsSync(musicPath) && fs.statSync(musicPath).size > 100000) return musicPath;
  try {
    const data = await httpsGet(MUSIC_URLS[Math.floor(Math.random() * MUSIC_URLS.length)]);
    if (data.length > 10000) { fs.writeFileSync(musicPath, data); return musicPath; }
  } catch(e) {}
  return null;
}

// ─── TTS EDGE ──────────────────────────────────────────────────────────────
async function getEdgeTTS(text, lang, outPath) {
  try {
    const rawPath = outPath.replace('.mp3', '_raw.mp3');
    execSync(`edge-tts --voice "${VOICES[lang]}" --text "${text.replace(/"/g, "'").replace(/\n/g, ' ')}" --write-media "${rawPath}" 2>/dev/null`, { timeout: 30000 });
    execSync(`ffmpeg -y -i "${rawPath}" -ar 44100 -ac 2 "${outPath}" 2>/dev/null`, { timeout: 15000 });
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) return true;
  } catch(e) {}
  try {
    const encoded = encodeURIComponent(text.substring(0, 200));
    const data = await httpsGet(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${lang}&client=tw-ob&ttsspeed=0.87`);
    if (data.length > 1000) { fs.writeFileSync(outPath, data); return true; }
  } catch(e) {}
  execSync(`ffmpeg -y -f lavfi -i "aevalsrc=0:c=mono:s=44100" -t 8 "${outPath}" 2>/dev/null`);
  return false;
}

// ─── IMAGES ────────────────────────────────────────────────────────────────
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
    const imgData = await httpsGet(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ' cinematic 4k')}?width=1280&height=720&nologo=true`);
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

// ─── SCÈNE ─────────────────────────────────────────────────────────────────
async function createSceneClip(scene, index, lang) {
  const d = scene[lang];
  console.log(`  [${lang.toUpperCase()}] Scene ${index + 1}: ${d.text.substring(0, 38)}...`);
  const imgPath = await getImage(scene, index);
  const audioPath = `/tmp/audio_${lang}_${index}.mp3`;
  await getEdgeTTS(d.speech, lang, audioPath);

  let audioDur = 8;
  try {
    const probe = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}" 2>/dev/null`).toString().trim();
    const v = parseFloat(probe); if (!isNaN(v) && v > 1) audioDur = v + 1.5;
  } catch(e) {}

  const clipPath = `/tmp/clip_${lang}_${index}.mp4`;
  const textSafe = d.text.replace(/['":\\[\]]/g, ' ').substring(0, 52);

  execSync(`ffmpeg -y -loop 1 -i "${imgPath}" -i "${audioPath}" -t ${Math.ceil(audioDur)} \
    -vf "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,\
drawbox=x=0:y=570:w=1280:h=150:color=black@0.85:t=fill,\
drawtext=text='${textSafe}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=608:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" \
    -c:v libx264 -c:a aac -pix_fmt yuv420p -r 25 -shortest "${clipPath}" 2>&1`, { timeout: 120000 });

  return clipPath;
}

// ─── CONSTRUIRE VIDÉO ──────────────────────────────────────────────────────
async function buildVideo(vid, lang) {
  const clips = [];
  let firstImgPath = null;
  for (let i = 0; i < vid.scenes.length; i++) {
    const imgPath = `/tmp/img_${i}.jpg`;
    clips.push(await createSceneClip(vid.scenes[i], i, lang));
    if (i === 1 && fs.existsSync(imgPath)) firstImgPath = imgPath;
  }

  const concatFile = `/tmp/concat_${lang}.txt`;
  fs.writeFileSync(concatFile, clips.map(p => `file '${p}'`).join('\n'));
  const rawPath = `/tmp/raw_${lang}.mp4`;
  execSync(`ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c:v libx264 -c:a aac -pix_fmt yuv420p "${rawPath}" 2>&1`, { timeout: 300000 });

  // Musique de fond
  const outPath = `/tmp/final_${lang}.mp4`;
  const musicPath = await getMusic();
  if (musicPath) {
    try {
      execSync(`ffmpeg -y -i "${rawPath}" -stream_loop -1 -i "${musicPath}" \
        -filter_complex "[1:a]volume=0.10[m];[0:a][m]amix=inputs=2:duration=first[aout]" \
        -map 0:v -map "[aout]" -c:v copy -c:a aac -shortest "${outPath}" 2>&1`, { timeout: 120000 });
    } catch(e) { fs.copyFileSync(rawPath, outPath); }
  } else { fs.copyFileSync(rawPath, outPath); }

  // Miniature
  const thumbPath = await generateThumbnail(vid, lang, firstImgPath);

  return { videoPath: outPath, thumbPath };
}

// ─── UPLOAD YOUTUBE ────────────────────────────────────────────────────────
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

// Upload miniature
async function uploadThumbnail(videoId, thumbPath) {
  try {
    if (!thumbPath || !fs.existsSync(thumbPath)) return;
    const thumbData = fs.readFileSync(thumbPath);
    await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'www.googleapis.com',
        path: `/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`,
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token.access_token}`, 'Content-Type': 'image/jpeg', 'Content-Length': thumbData.length }
      }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
      req.on('error', reject); req.write(thumbData); req.end();
    });
    console.log('Thumb uploaded for', videoId);
  } catch(e) { console.log('Thumb upload err:', e.message); }
}

// ─── PUBLICATION AUTO ──────────────────────────────────────────────────────
async function autoPublish() {
  if (!token) return;
  console.log('Auto: publication...');
  try {
    await refreshToken();
    const vid = VIDEOS[publishCount % VIDEOS.length];
    publishCount++;
    const en = await buildVideo(vid, 'en');
    const fr = await buildVideo(vid, 'fr');
    const r1 = await uploadYouTube(vid.en, en.videoPath);
    const r2 = await uploadYouTube(vid.fr, fr.videoPath);
    if (r1.id) await uploadThumbnail(r1.id, en.thumbPath);
    if (r2.id) await uploadThumbnail(r2.id, fr.thumbPath);
    lastPublished = new Date().toISOString();
    console.log(`Auto OK: EN=${r1.id} FR=${r2.id}`);
  } catch(e) { console.log('Auto err:', e.message); }
}

// ─── SERVEUR ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const p = url.parse(req.url).pathname;
  const q = url.parse(req.url, true).query;

  if (p === '/auth') {
    res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube&access_type=offline&prompt=consent` });
    res.end();
  }
  else if (p === '/callback') {
    const body = `code=${q.code}&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&grant_type=authorization_code`;
    token = await httpsPost('oauth2.googleapis.com', '/token', { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }, body);
    fs.writeFileSync('/tmp/token.json', JSON.stringify(token));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>YouTube connecte!</h1><a href="/">Accueil</a>');
  }
  else if (p === '/publish') {
    if (!token) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<a href="/auth">Connecter YouTube</a>'); return; }
    await refreshToken();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const vid = VIDEOS[Math.floor(Math.random() * VIDEOS.length)];
    res.write(`<h1>Generation...</h1><p>EN: ${vid.en.title}</p><p>FR: ${vid.fr.title}</p><p>Hook + musique + miniature... patience 7-10 min</p>`);
    try {
      res.write('<p>Video EN en cours...</p>');
      const en = await buildVideo(vid, 'en');
      res.write('<p>Video FR en cours...</p>');
      const fr = await buildVideo(vid, 'fr');
      res.write('<p>Upload EN...</p>');
      const r1 = await uploadYouTube(vid.en, en.videoPath);
      res.write('<p>Upload FR...</p>');
      const r2 = await uploadYouTube(vid.fr, fr.videoPath);
      if (r1.id) { res.write('<p>Miniature EN...</p>'); await uploadThumbnail(r1.id, en.thumbPath); }
      if (r2.id) { res.write('<p>Miniature FR...</p>'); await uploadThumbnail(r2.id, fr.thumbPath); }
      lastPublished = new Date().toISOString();
      publishCount++;
      res.end(`<h2>2 videos publiees avec miniatures!</h2>
        <p>EN: ${r1.id ? `<a href="https://youtube.com/watch?v=${r1.id}">Voir EN</a>` : JSON.stringify(r1).substring(0,100)}</p>
        <p>FR: ${r2.id ? `<a href="https://youtube.com/watch?v=${r2.id}">Voir FR</a>` : JSON.stringify(r2).substring(0,100)}</p>
        <br><a href="/">Accueil</a>`);
    } catch(e) { res.end(`<p>Erreur: ${e.message.substring(0,300)}</p><a href="/publish">Reessayer</a>`); }
  }
  else if (p === '/auto-on') {
    autoMode = true;
    if (autoInterval) clearInterval(autoInterval);
    autoInterval = setInterval(autoPublish, 24 * 60 * 60 * 1000);
    autoPublish();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>Auto active! 2 videos/24h</h1><a href="/">Accueil</a>');
  }
  else if (p === '/auto-off') {
    autoMode = false;
    if (autoInterval) { clearInterval(autoInterval); autoInterval = null; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>Auto desactive</h1><a href="/">Accueil</a>');
  }
  else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html><body style="font-family:Arial;padding:20px;background:#111;color:#fff;max-width:500px;margin:auto">
      <h1>KRAKEN YouTube Bot</h1>
      <p>Voix: Microsoft Edge TTS (naturelle)</p>
      <p>Musique: fond automatique</p>
      <p>Miniatures: generees automatiquement</p>
      <p>Titres: optimises algorithme YouTube</p>
      <p>Hooks: 3 premieres secondes accrocheuses</p>
      <hr style="border-color:#333">
      <p>YouTube: <b>${token ? '✅ Connecte' : '❌ Non connecte'}</b></p>
      <p>Mode auto: <b>${autoMode ? '✅ Actif (2 videos/24h)' : '❌ Inactif'}</b></p>
      <p>Videos publiees: <b>${publishCount * 2}</b></p>
      ${lastPublished ? `<p>Derniere pub: ${new Date(lastPublished).toLocaleString('fr-FR')}</p>` : ''}
      <hr style="border-color:#333">
      <a href="/auth" style="display:block;margin:8px 0;padding:14px;background:#333;color:#fff;text-decoration:none;border-radius:8px;text-align:center">🔗 Connecter YouTube</a>
      <a href="/publish" style="display:block;margin:8px 0;padding:14px;background:#c00;color:#fff;text-decoration:none;border-radius:8px;text-align:center">🚀 Publier EN + FR maintenant</a>
      <a href="/auto-on" style="display:block;margin:8px 0;padding:14px;background:#060;color:#fff;text-decoration:none;border-radius:8px;text-align:center">🤖 Mode auto (2 videos/24h)</a>
      <a href="/auto-off" style="display:block;margin:8px 0;padding:14px;background:#444;color:#fff;text-decoration:none;border-radius:8px;text-align:center">⏹ Arreter auto</a>
      </body></html>`);
  }
});

server.listen(PORT, () => console.log('KRAKEN VIRAL OK port ' + PORT));
