const http=require('http'),https=require('https'),url=require('url'),fs=require('fs'),{execSync}=require('child_process');
const CLIENT_ID=process.env.YOUTUBE_CLIENT_ID,CLIENT_SECRET=process.env.YOUTUBE_CLIENT_SECRET,REDIRECT_URI=process.env.YOUTUBE_REDIRECT_URI,ELEVEN=process.env.ELEVEN_API_KEY,PORT=process.env.PORT||8080;
let token=null;

function post(h,p,hd,d){
  return new Promise((ok,ko)=>{
    const r=https.request({hostname:h,path:p,method:'POST',headers:hd},(res)=>{
      let b='';
      res.on('data',c=>b+=c);
      res.on('end',()=>{try{ok(JSON.parse(b))}catch(e){ok(b)}});
    });
    r.on('error',ko);r.write(d);r.end();
  });
}

async function refreshToken(){
  if(!token||!token.refresh_token)return;
  const d=JSON.stringify({client_id:CLIENT_ID,client_secret:CLIENT_SECRET,refresh_token:token.refresh_token,grant_type:'refresh_token'});
  const t=await post('oauth2.googleapis.com','/token',{'Content-Type':'application/json','Content-Length':Buffer.byteLength(d)},d);
  if(t.access_token){token.access_token=t.access_token;fs.writeFileSync('/tmp/token.json',JSON.stringify(token));}
}

async function audio(text){
  if(!ELEVEN)return null;
  const d=JSON.stringify({text,model_id:'eleven_multilingual_v2',output_format:'mp3_44100_128'});
  return new Promise((ok,ko)=>{
    const r=https.request({
      hostname:'api.elevenlabs.io',
      path:'/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM',
      method:'POST',
      headers:{'xi-api-key':ELEVEN,'Content-Type':'application/json','Content-Length':Buffer.byteLength(d)}
    },(res)=>{
      const c=[];
      res.on('data',x=>c.push(x));
      res.on('end',()=>{
        const buf=Buffer.concat(c);
        console.log('Audio size:'+buf.length+' status:'+res.statusCode);
        fs.writeFileSync('/tmp/a.mp3',buf);
        ok('/tmp/a.mp3');
      });
    });
    r.on('error',ko);r.write(d);r.end();
  });
}

function video(audioPath){
  const ff='/usr/bin/ffmpeg';
  try{
    const size=fs.statSync(audioPath).size;
    console.log('MP3 size:'+size);
    if(size<1000){throw new Error('MP3 trop petit');}
    execSync(ff+' -y -i '+audioPath+' -vn -acodec pcm_s16le -ar 44100 -ac 2 /tmp/a.wav 2>&1',{timeout:30000});
    const wavSize=fs.statSync('/tmp/a.wav').size;
    console.log('WAV size:'+wavSize);
    execSync(ff+' -y -f lavfi -i color=c=0x1a1a2e:size=1280x720:rate=25 -i /tmp/a.wav -map 0:v -map 1:a -c:v libx264 -c:a aac -b:a 128k -shortest -pix_fmt yuv420p /tmp/v.mp4 2>&1',{timeout:120000});
    return '/tmp/v.mp4';
  }catch(e){
    console.log('Video err:'+e.message);
    execSync(ff+' -y -f lavfi -i color=c=0x1a1a2e:size=1280x720:rate=25 -f lavfi -i sine=frequency=440:duration=3 -c:v libx264 -c:a aac -t 30 -pix_fmt yuv420p /tmp/v.mp4 2>&1',{timeout:60000});
    return '/tmp/v.mp4';
  }
}

async function upload(title,vpath){
  if(!token)return {error:'non connecte'};
  await refreshToken();
  const vid=fs.readFileSync(vpath);
  const meta=JSON.stringify({snippet:{title,description:title+' - Histoire fascinante!',categoryId:'22',tags:['insolite','mystere']},status:{privacyStatus:'public'}});
  const bnd='bnd123';
  const body=Buffer.concat([Buffer.from('--'+bnd+'\r\nContent-Type: application/json\r\n\r\n'+meta+'\r\n--'+bnd+'\r\nContent-Type: video/mp4\r\n\r\n'),vid,Buffer.from('\r\n--'+bnd+'--')]);
  return post('www.googleapis.com','/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart',{'Authorization':'Bearer '+token.access_token,'Content-Type':'multipart/related; boundary='+bnd,'Content-Length':body.length},body);
}

const topics=['Un fait insolite sur les animaux marins','Une histoire vraie bizarre en France','Un mystere scientifique inexplique','Un fait choquant sur l espace','Une coincidence incroyable dans l histoire','Un secret cache dans l histoire','Une decouverte qui change tout','Un phenomene naturel inexplique'];

function getScript(topic){
  return 'Aujourd hui nous allons parler de '+topic+'. C est une decouverte fascinante qui va vous surprendre. '+topic+' est l un des sujets les plus mysterieux de notre epoque. Les scientifiques eux-memes n arrivent pas a l expliquer. Restez avec nous jusqu a la fin pour decouvrir tous les secrets.';
}

const server=http.createServer(async(req,res)=>{
  const p=url.parse(req.url,true).pathname;

  if(p==='/auth'){
    res.writeHead(302,{Location:'https://accounts.google.com/o/oauth2/v2/auth?client_id='+CLIENT_ID+'&redirect_uri='+encodeURIComponent(REDIRECT_URI)+'&response_type=code&scope='+encodeURIComponent('https://www.googleapis.com/auth/youtube.upload')+'&access_type=offline&prompt=consent'});
    res.end();
  }

  else if(p==='/callback'){
    const code=url.parse(req.url,true).query.code;
    const d=JSON.stringify({code,client_id:CLIENT_ID,client_secret:CLIENT_SECRET,redirect_uri:REDIRECT_URI,grant_type:'authorization_code'});
    token=await post('oauth2.googleapis.com','/token',{'Content-Type':'application/json','Content-Length':Buffer.byteLength(d)},d);
    fs.writeFileSync('/tmp/token.json',JSON.stringify(token));
    res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
    res.end('<h1>Connecte!</h1><a href="/publish">Publier une video</a>');
  }

  else if(p==='/publish'){
    if(!token){
      if(fs.existsSync('/tmp/token.json')){token=JSON.parse(fs.readFileSync('/tmp/token.json'));}
      else{res.writeHead(200);res.end('<a href="/auth">Se connecter</a>');return;}
    }
    res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
    const topic=topics[Math.floor(Math.random()*topics.length)];
    res.write('<h1>Generation...</h1><p>'+topic+'</p>');
    try{
      const ap=await audio(getScript(topic));
      res.write('<p>Audio OK</p>');
      const vp=video(ap);
      res.write('<p>Video OK</p>');
      const r=await upload(topic,vp);
      res.end('<p>YouTube: '+(r.id?'<a href="https://youtube.com/watch?v='+r.id+'">'+r.id+'</a>':JSON.stringify(r).substring(0,200))+'</p>');
    }catch(e){res.end('<p>Erreur: '+e.message+'</p>');}
  }

  else if(p==='/auto'){
    if(!token&&fs.existsSync('/tmp/token.json'))token=JSON.parse(fs.readFileSync('/tmp/token.json'));
    res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
    res.end('<h1>Auto active! 1 video/24h</h1>');
    setInterval(async()=>{
      try{
        const topic=topics[Math.floor(Math.random()*topics.length)];
        const ap=await audio(getScript(topic));
        const vp=video(ap);
        const r=await upload(topic,vp);
        console.log('Auto publie: '+topic+' ID:'+(r.id||'erreur'));
      }catch(e){console.log('Auto err:'+e.message);}
    },24*60*60*1000);
  }

  else{
    res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
    res.end('<h1>KRAKEN Bot</h1><ul><li><a href="/auth">1. Connecter YouTube</a></li><li><a href="/publish">2. Publier une video</a></li><li><a href="/auto">3. Auto 24h</a></li></ul>');
  }
});

server.listen(PORT,()=>console.log('KRAKEN OK port '+PORT));
