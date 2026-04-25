const http=require('http'),https=require('https'),url=require('url'),fs=require('fs'),{execSync}=require('child_process');
const CLIENT_ID=process.env.YOUTUBE_CLIENT_ID,CLIENT_SECRET=process.env.YOUTUBE_CLIENT_SECRET,REDIRECT_URI=process.env.YOUTUBE_REDIRECT_URI,ELEVEN=process.env.ELEVEN_API_KEY,PORT=process.env.PORT||8080;
let token=null;
function post(h,p,hd,d){return new Promise((ok,ko)=>{const r=https.request({hostname:h,path:p,method:'POST',headers:hd},(res)=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>{try{ok(JSON.parse(b))}catch(e){ok(b)}})});r.on('error',ko);r.write(d);r.end()})}
async function audio(text){
if(!ELEVEN)return null;
const d=JSON.stringify({text,model_id:'eleven_multilingual_v2'});
return new Promise((ok,ko)=>{
const r=https.request({hostname:'api.elevenlabs.io',path:'/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM',method:'POST',headers:{'xi-api-key':ELEVEN,'Content-Type':'application/json','Content-Length':Buffer.byteLength(d),'Accept':'audio/mpeg'}},(res)=>{
const c=[];res.on('data',x=>c.push(x));res.on('end',()=>{fs.writeFileSync('/tmp/a.mp3',Buffer.concat(c));ok('/tmp/a.mp3')});
});r.on('error',ko);r.write(d);r.end();
});}
async function video(audioPath){
const ff='/usr/bin/ffmpeg';
if(audioPath&&fs.existsSync(audioPath)){
try{
execSync(ff+' -y -i /tmp/a.mp3 -ar 44100 -ac 2 /tmp/a.wav',{timeout:30000});
execSync(ff+' -y -f lavfi -i color=c=0x1a1a2e:size=1280x720:rate=25 -i /tmp/a.wav -c:v libx264 -c:a aac -b:a 192k -shortest -pix_fmt yuv420p /tmp/v.mp4',{timeout:120000});
return '/tmp/v.mp4';
}catch(e){console.log('err:'+e.message);}
}
execSync(ff+' -y -f lavfi -i color=c=blue:size=1280x720:rate=25 -f lavfi -i anullsrc=r=44100:cl=stereo -t 30 -c:v libx264 -c:a aac -pix_fmt yuv420p /tmp/v.mp4',{timeout:60000});
return '/tmp/v.mp4';
}
async function upload(title,vpath){
if(!token)return {error:'non connecte'};
const vid=fs.readFileSync(vpath),meta=JSON.stringify({snippet:{title,description:title+' - Decouvrez cette histoire fascinante!',categoryId:'22',tags:['insolite','mystere','histoire']},status:{privacyStatus:'public'}});
const bnd='bnd123',body=Buffer.concat([Buffer.from('--'+bnd+'\r\nContent-Type: application/json\r\n\r\n'+meta+'\r\n--'+bnd+'\r\nContent-Type: video/mp4\r\n\r\n'),vid,Buffer.from('\r\n--'+bnd+'--')]);
return post('www.googleapis.com','/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart',{'Authorization':'Bearer '+token.access_token,'Content-Type':'multipart/related; boundary='+bnd,'Content-Length':body.length},body);
}
const topics=['Un fait insolite sur les animaux marins','Une histoire vraie bizarre en France','Un mystere scientifique inexplique','Un fait choquant sur l espace','Une coincidence incroyable dans l histoire'];
const server=http.createServer(async(req,res)=>{
const p=url.parse(req.url,true).pathname;
if(p==='/auth'){res.writeHead(302,{Location:'https://accounts.google.com/o/oauth2/v2/auth?client_id='+CLIENT_ID+'&redirect_uri='+encodeURIComponent(REDIRECT_URI)+'&response_type=code&scope='+encodeURIComponent('https://www.googleapis.com/auth/youtube.upload')+'&access_type=offline&prompt=consent'});res.end();}
else if(p==='/callback'){const code=url.parse(req.url,true).query.code,d=JSON.stringify({code,client_id:CLIENT_ID,client_secret:CLIENT_SECRET,redirect_uri:REDIRECT_URI,grant_type:'authorization_code'});token=await post('oauth2.googleapis.com','/token',{'Content-Type':'application/json','Content-Length':Buffer.byteLength(d)},d);fs.writeFileSync('/tmp/token.json',JSON.stringify(token));res.writeHead(200);res.end('<h1>Connecte!</h1><a href="/publish">Publier</a>');}
else if(p==='/publish'){
if(!token){
if(fs.existsSync('/tmp/token.json')){token=JSON.parse(fs.readFileSync('/tmp/token.json'));}
else{res.writeHead(200);res.end('<a href="/auth">Se connecter</a>');return;}
}
res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
const topic=topics[Math.floor(Math.random()*topics.length)];
const script='Aujourd hui nous allons parler de: '+topic+'. C est une decouverte fascinante qui va vous surprendre. '+topic+' est l un des sujets les plus mysterieux de notre epoque. Les scientifiques eux-memes n arrivent pas a l expliquer. Voila pourquoi ce sujet passionne des millions de personnes dans le monde entier.';
res.write('<h1>Generation...</h1><p>Sujet: '+topic+'</p>');
try{
const ap=await audio(script);
res.write('<p>Audio: '+(ap?'OK':'sans voix')+'</p>');
const vp=await video(ap);
res.write('<p>Video OK</p>');
const r=await upload(topic,vp);
res.end('<p>YouTube ID: '+(r.id||JSON.stringify(r).substring(0,200))+'</p>');
}catch(e){res.end('<p>Erreur: '+e.message+'</p>');}
}
else{res.writeHead(200);res.end('<h1>KRAKEN Bot</h1><a href="/auth">Connecter YouTube</a> | <a href="/publish">Publier</a>');}
});
server.listen(PORT,()=>console.log('OK '+PORT));
