
const COLORS = ['#8b7cff','#ff5c7a','#3ddc97','#ffb84d','#4fc3f7','#f45b69','#c86dd7','#ffd166','#06d6a0','#ef476f','#118ab2','#e0e0e0'];
const SONGS = [
  {id:1,title:'Ilaw sa Gabi',artist:'Bahaghari',freq:392,art:'#8b7cff',customSrc:null},
  {id:2,title:'Habang May Buhay',artist:'Lunes Club',freq:330,art:'#ff5c7a',customSrc:null},
  {id:3,title:'Ulan sa Kalye',artist:'Tag-ulan',freq:294,art:'#3ddc97',customSrc:null},
  {id:4,title:'Paalam, Kahapon',artist:'Bahaghari',freq:262,art:'#ffb84d',customSrc:null},
  {id:5,title:'Simula Uli',artist:'Silangan',freq:349,art:'#4fc3f7',customSrc:null},
  {id:6,title:'Sa Ilalim ng Buwan',artist:'Tag-ulan',freq:440,art:'#f45b69',customSrc:null},
];
const realPlayer = new Audio();
realPlayer.loop = true;
function songArt(song){  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>
    <defs><linearGradient id='g${song.id}' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='${song.art}'/><stop offset='100%' stop-color='#14161c'/>
    </linearGradient></defs>
    <rect width='300' height='300' fill='url(#g${song.id})'/>
    <circle cx='225' cy='70' r='95' fill='${song.art}' opacity='0.35'/>
    <circle cx='55' cy='245' r='65' fill='#ffffff' opacity='0.10'/>
    <text x='20' y='268' font-family='sans-serif' font-size='20' font-weight='600' fill='white' opacity='0.92'>${song.title}</text>
    <text x='20' y='288' font-family='sans-serif' font-size='13' fill='white' opacity='0.6'>${song.artist}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
const store = k => JSON.parse(localStorage.getItem(k) || 'null');
const save = (k,v) => localStorage.setItem(k, JSON.stringify(v));
let liked = store('mifiall_liked') || [];
let following = store('mifiall_following') || [];
let theme = store('mifiall_theme') || COLORS[0];
let user = store('mifiall_user') || null;
let comments = store('mifiall_comments') || {};
function escapeHtml(s){ return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function addComment(songId, text){
  if(!text.trim()) return;
  if(!comments[songId]) comments[songId]=[];
  comments[songId].push({name:user||'Guest', text:text.trim()});
  save('mifiall_comments', comments);
}
function commentsHTML(song){
  const list = (comments[song.id]||[]).map(c=>`<div class="c-item"><b>${escapeHtml(c.name)}</b>${escapeHtml(c.text)}</div>`).join('') || '<div class="c-empty">Wala pang komento. Ikaw na ang una!</div>';
  return `<div class="c-list">${list}</div>
    <div class="c-input-row">
      <input class="c-input" placeholder="Magkomento...">
      <button class="c-send">Post</button>
    </div>`;
}
function wireComments(box, song){
  box.innerHTML = commentsHTML(song);
  const send = () => { addComment(song.id, box.querySelector('.c-input').value); wireComments(box, song); };
  box.querySelector('.c-send').onclick = send;
  box.querySelector('.c-input').addEventListener('keydown', e => { if(e.key==='Enter') send(); });
}
 
document.documentElement.style.setProperty('--accent', theme);
const sw = document.getElementById('swatches');
document.getElementById('themeBtn').onclick = (e) => { e.stopPropagation(); sw.classList.toggle('open'); };
document.addEventListener('click', (e) => { if(!sw.contains(e.target) && e.target.id!=='themeBtn') sw.classList.remove('open'); });
COLORS.forEach(c=>{
  const d = document.createElement('div');
  d.className = 'swatch' + (c===theme ? ' selected' : '');
  d.style.background = c;
  d.onclick = () => { theme=c; save('mifiall_theme',c); document.documentElement.style.setProperty('--accent',c);
    [...sw.children].forEach(s=>s.classList.remove('selected')); d.classList.add('selected'); toast('Na-apply ang kulay'); };
  sw.appendChild(d);
});
 
function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('show'),1800); }
 
// sign in
const modal = document.getElementById('signInModal');
document.getElementById('signInBtn').onclick = () => { if(!user) modal.classList.add('open'); };
document.getElementById('doSignIn').onclick = () => {
  const v = document.getElementById('nameInput').value.trim();
  if(!v) return;
  user = v; save('mifiall_user', v); modal.classList.remove('open'); refreshUser();
  toast('Na-sign in bilang ' + v);
};
modal.onclick = e => { if(e.target===modal) modal.classList.remove('open'); };
function refreshUser(){
  document.getElementById('signInBtn').style.display = user ? 'none' : 'block';
  document.getElementById('userChip').style.display = user ? 'flex' : 'none';
  document.getElementById('userName').textContent = user || '';
}
refreshUser();
 
// tabs
document.querySelectorAll('nav button').forEach(b=>{
  b.onclick = () => {
    document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('section').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    document.getElementById(b.dataset.tab).classList.add('active');
    render();
  };
});
 
// audio: uploaded file plays for real; otherwise a short original synthesized melody per track
let actx=null, osc=null, gain=null, current=null, playing=false, startAt=0, DURATION=20;
let toneState = {timer:null, idx:0, song:null};
function ensureCtx(){ if(!actx) actx = new (window.AudioContext||window.webkitAudioContext)(); if(actx.state==='suspended') actx.resume(); }
function stopTone(){ clearTimeout(toneState.timer); toneState.timer=null; if(osc){ try{osc.stop()}catch(e){} osc=null; } }
function noteSeq(base){ return [base, base*9/8, base*5/4, base*3/2, base*5/4, base*9/8, base, base*3/4]; }
function scheduleNote(song){
  if(!playing || current!==song) return;
  const notes = noteSeq(song.freq);
  osc = actx.createOscillator(); gain = actx.createGain();
  osc.type='triangle'; osc.frequency.value = notes[toneState.idx % notes.length];
  gain.gain.setValueAtTime(0.0001, actx.currentTime);
  gain.gain.linearRampToValueAtTime(0.07, actx.currentTime+0.02);
  gain.gain.linearRampToValueAtTime(0.0001, actx.currentTime+0.34);
  osc.connect(gain).connect(actx.destination);
  osc.start(); osc.stop(actx.currentTime+0.38);
  toneState.idx++;
  toneState.timer = setTimeout(() => scheduleNote(song), 360);
}
function playTrack(song){
  stopTone(); realPlayer.pause();
  current = song; playing = true;
  document.getElementById('pTitle').textContent = song.title;
  document.getElementById('pArtist').textContent = song.artist;
  document.getElementById('pArt').style.background = `url('${songArt(song)}') center/cover`;
  document.getElementById('pPlay').textContent = '⏸';
  if(song.customSrc){
    realPlayer.src = song.customSrc;
    realPlayer.currentTime = 0;
    realPlayer.play();
  } else {
    ensureCtx();
    if(actx.state === 'suspended') actx.resume();
    toneState = {timer:null, idx:0, song};
    startAt = actx.currentTime;
    scheduleNote(song);
    requestAnimationFrame(tick);
  }
}
function togglePlay(){
  if(!current) return;
  if(current.customSrc){
    if(playing){ realPlayer.pause(); playing=false; document.getElementById('pPlay').textContent='▶'; }
    else { realPlayer.play(); playing=true; document.getElementById('pPlay').textContent='⏸'; }
  } else {
    if(playing){ playing=false; clearTimeout(toneState.timer); actx.suspend(); document.getElementById('pPlay').textContent='▶'; }
    else { playing=true; actx.resume(); document.getElementById('pPlay').textContent='⏸'; scheduleNote(current); requestAnimationFrame(tick); }
  }
}
document.getElementById('pPlay').onclick = () => { if(current) togglePlay(); };
realPlayer.addEventListener('timeupdate', () => {
  if(!current || !current.customSrc || !realPlayer.duration) return;
  const pct = (realPlayer.currentTime/realPlayer.duration)*100;
  document.getElementById('progFill').style.width = pct+'%';
  const s = Math.floor(realPlayer.currentTime);
  document.getElementById('pTime').textContent = Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
});
function tick(){
  if(!current || current.customSrc || !playing) return;
  const elapsed = (actx.currentTime - startAt) % DURATION;
  const pct = (elapsed/DURATION)*100;
  document.getElementById('progFill').style.width = pct+'%';
  const s = Math.floor(elapsed);
  document.getElementById('pTime').textContent = '0:'+String(s).padStart(2,'0');
  requestAnimationFrame(tick);
}
function uploadSong(song){
  const inp = document.createElement('input');
  inp.type='file'; inp.accept='audio/*';
  inp.onchange = () => {
    const f = inp.files[0]; if(!f) return;
    song.customSrc = URL.createObjectURL(f);
    toast('Naidagdag ang tunog sa "'+song.title+'"');
    if(current && current.id===song.id) playTrack(song);
    render();
  };
  inp.click();
}
 
// actions
function toggleLike(id){
  liked = liked.includes(id) ? liked.filter(x=>x!==id) : [...liked, id];
  save('mifiall_liked', liked); render();
}
function toggleFollow(artist){
  following = following.includes(artist) ? following.filter(x=>x!==artist) : [...following, artist];
  save('mifiall_following', following); render();
}
function shareSong(song){
  const text = `${song.title} — ${song.artist} sa Mifiall`;
  if(navigator.share){ navigator.share({title:song.title, text}).catch(()=>{}); }
  else { navigator.clipboard.writeText(text).then(()=>toast('Nakopya para i-share')); }
}
function downloadSong(song){
  if(song.customSrc){
    const a = document.createElement('a');
    a.href = song.customSrc; a.download = song.title.replace(/\s+/g,'_');
    a.click(); toast('Dina-download...'); return;
  }
  // no uploaded file yet — generates a short placeholder tone as a stand-in
  ensureCtx();
  const rate = 44100, dur = 2, len = rate*dur;
  const buf = actx.createBuffer(1, len, rate);
  const data = buf.getChannelData(0);
  for(let i=0;i<len;i++) data[i] = Math.sin(2*Math.PI*song.freq*i/rate) * 0.2;
  const wav = bufferToWav(buf);
  const blob = new Blob([wav], {type:'audio/wav'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = song.title.replace(/\s+/g,'_')+'.wav'; a.click();
  toast('Dina-download... (sample lang)');
}
function bufferToWav(buf){
  const numCh=1, sr=buf.sampleRate, samples=buf.getChannelData(0);
  const bytesPerSample=2, blockAlign=numCh*bytesPerSample;
  const dataSize=samples.length*bytesPerSample;
  const bufferArr = new ArrayBuffer(44+dataSize); const view = new DataView(bufferArr);
  const wStr=(o,s)=>{for(let i=0;i<s.length;i++) view.setUint8(o+i, s.charCodeAt(i));};
  wStr(0,'RIFF'); view.setUint32(4,36+dataSize,true); wStr(8,'WAVE'); wStr(12,'fmt ');
  view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,numCh,true);
  view.setUint32(24,sr,true); view.setUint32(28,sr*blockAlign,true); view.setUint16(32,blockAlign,true);
  view.setUint16(34,16,true); wStr(36,'data'); view.setUint32(40,dataSize,true);
  let off=44; for(let i=0;i<samples.length;i++,off+=2){ let s=Math.max(-1,Math.min(1,samples[i])); view.setInt16(off, s<0?s*0x8000:s*0x7FFF, true); }
  return bufferArr;
}
 
function trackRow(song){
  const isLiked = liked.includes(song.id);
  const isFollowing = following.includes(song.artist);
  const wrap = document.createElement('div'); wrap.className='track-wrap';
  const row = document.createElement('div'); row.className='track';
  row.innerHTML = `
    <button class="play-pill" title="Play">▶</button>
    <div class="art-sm" style="background-image:url('${songArt(song)}')"></div>
    <div class="t-info">
      <div class="t-title">${song.title}</div>
      <div class="t-artist">${song.artist} <button class="follow-btn ${isFollowing?'following':''}">${isFollowing?'Sinusundan':'Follow'}</button></div>
    </div>
    <div class="t-actions">
      <button class="icon-btn upload ${song.customSrc?'has-audio':''}" title="Maglagay ng sariling audio">${song.customSrc?'🎵':'📁'}</button>
      <button class="icon-btn like ${isLiked?'liked':''}" title="Like">${isLiked?'♥':'♡'}</button>
      <button class="icon-btn comment-btn" title="Comment">💬</button>
      <button class="icon-btn share" title="Share">⤴</button>
      <button class="icon-btn dl" title="Download">⬇</button>
    </div>`;
  row.querySelector('.play-pill').onclick = () => playTrack(song);
  row.querySelector('.follow-btn').onclick = () => toggleFollow(song.artist);
  row.querySelector('.upload').onclick = () => uploadSong(song);
  row.querySelector('.like').onclick = () => toggleLike(song.id);
  row.querySelector('.share').onclick = () => shareSong(song);
  row.querySelector('.dl').onclick = () => downloadSong(song);
  const commentsBox = document.createElement('div'); commentsBox.className='comments-box';
  wireComments(commentsBox, song);
  row.querySelector('.comment-btn').onclick = () => {
    commentsBox.style.display = commentsBox.style.display==='block' ? 'none' : 'block';
  };
  wrap.appendChild(row); wrap.appendChild(commentsBox);
  return wrap;
}
 
function render(){
  const q = (document.getElementById('searchInput').value || '').trim().toLowerCase();
  const home = document.getElementById('homeList'); home.innerHTML='';
  const matches = q ? SONGS.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)) : SONGS;
  matches.forEach(s => home.appendChild(trackRow(s)));
  document.getElementById('noResults').style.display = (q && matches.length===0) ? 'block' : 'none';
  document.getElementById('webSearchBtn').style.display = q ? 'flex' : 'none';
  document.getElementById('webSearchBtn').onclick = () => window.open('https://www.google.com/search?q=' + encodeURIComponent(q + ' music'), '_blank');
 
  const likedWrap = document.getElementById('likedList'); likedWrap.innerHTML='';
  const likedSongs = SONGS.filter(s=>liked.includes(s.id));
  likedSongs.forEach(s => likedWrap.appendChild(trackRow(s)));
  document.getElementById('emptyLiked').style.display = likedSongs.length ? 'none':'block';
 
  const followWrap = document.getElementById('followList'); followWrap.innerHTML='';
  following.forEach(artist=>{
    const div = document.createElement('div'); div.className='track';
    div.innerHTML = `<div class="art-sm" style="background:var(--accent)"></div>
      <div class="t-info"><div class="t-title">${artist}</div><div class="t-artist">Sinusundan mo</div></div>
      <button class="follow-btn following">Sinusundan</button>`;
    div.querySelector('.follow-btn').onclick = () => toggleFollow(artist);
    followWrap.appendChild(div);
  });
  document.getElementById('emptyFollow').style.display = following.length ? 'none':'block';
}
render();
document.getElementById('searchInput').addEventListener('input', render);
