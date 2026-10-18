'use strict';
const GAME_VERSION='tutorial-2';
// ECHO: dependency-free Canvas game. Coordinates use a 1000 × 650 logical viewport.
const canvas = document.querySelector('#game'), ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const W=1000,H=650, STEP=1/120;
let state='title', world=0, blend=0, levelIndex=0, level, player, camera=0, clock=0, elapsed=0, lives=5, totalShards=0, completed=0, checkpoint, collected=new Set(), particles=[], keys=new Set(), jumpBuffer=0, coyote=0, switchCooldown=0, flash=0, muted=false, audio, last=0, accumulator=0, toastTimer;
let identity={name:'Guest wanderer',style:{}}, signedIn=false;
const defaults={body:'male',primaryColor:'#e5dce9',secondaryColor:'#4f4b72',skinColor:'#e3b994',hairColor:'#30273c',hair:'short',hat:'none',accessory:'scarf'};
const titles=['The First Light','A Memory of Shadows','The World Between'];
// Progression: walk / hop / stationary switch, then combined skills, then precision.
// Platform format: [x, top, width, world]; 0=both, 1=light, 2=dark.
const levels=[
 {width:2720, tutorial:true, story:'Where light ends, another path begins.', jumpTiming:{coyote:.14,buffer:.18},
  platforms:[[0,560,760,0],[792,560,620,0],[1412,560,460,0],[1872,560,500,0],[2372,560,348,0]],
  shards:[[260,522],[580,522],[1020,522],[1670,522],[2280,522]], hazards:[], checkpoint:[1120,560], portal:[2600,560],
  gates:[{x:1500,y:370,w:18,h:190,world:1},{x:2110,y:370,w:18,h:190,world:0}]},
 {width:2480,story:'Some things can only be seen in the dark.',
  platforms:[[0,560,400,0],[455,515,220,0],[730,480,240,0],[1020,465,190,2],[1265,440,230,0],[1555,405,170,1],[1795,440,170,2],[2030,490,400,0]],
  shards:[[260,522],[560,477],[850,442],[1120,427],[1375,402],[1885,402]],
  hazards:[[1450,420,35,20,0],[2170,470,40,20,0]],checkpoint:[1375,440],portal:[2330,490],
  gates:[{x:865,y:290,w:18,h:190,world:1}]},
 {width:3280,story:'Carry your memories home. Become whole again.',
  platforms:[[0,550,300,0],[385,475,140,1],[615,410,135,2],[845,340,145,1],[1080,415,210,0],[1390,350,140,2],[1630,420,145,1],[1880,355,150,2],[2130,420,210,0],[2450,355,150,1],[2710,420,150,2],[2970,490,280,0]],
  shards:[[210,510],[455,437],[680,372],[915,302],[1460,312],[1950,317],[2520,317]],
  hazards:[[1240,395,30,20,0],[2290,400,30,20,0],[3120,470,40,20,0]],checkpoint:[1140,415],portal:[3180,490],
  gates:[{x:1190,y:225,w:18,h:190,world:1},{x:2220,y:230,w:18,h:190,world:0}]}
];
let tutorialSafe={x:90,y:516,world:0},tutorialFalls=0;
const hazardActive=(h,w=world)=>!h[4]||h[4]===w+1;
const gateClosed=(g,w=world)=>w!==g.world;
const active=(p,w=world)=>p[3]===0||p[3]===w+1;
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function safeRead(){try{return JSON.parse(localStorage.getItem('echo-best')||'null')}catch{return null}}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200)}
function sound(freq=440,duration=.12,type='sine',volume=.06){if(muted)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.5,audio.currentTime+duration);g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration)}catch{}}
function burst(x,y,color,n=20){for(let i=0;i<n;i++)particles.push({x,y,vx:(Math.random()-.5)*170,vy:(Math.random()-.7)*170,life:1,color})}
function focusGame(){canvas.focus({preventScroll:true})}
function screen(html){$('lesson').hidden=true;$('panel').innerHTML=html;$('overlay').hidden=false;keys.clear();jumpBuffer=0;$('touch').hidden=true}
function title(){state='title';$('hud').hidden=true;$('footer').hidden=false;screen(`<span class="eyebrow">TWO WORLDS. ONE FORGOTTEN SOUL.</span><h1 class="hero-title">ECHO</h1><div class="subtitle">THE WORLD BETWEEN LIGHT AND DARKNESS</div><p>Between the light and the dark, a world waits to be remembered.<br>Find the pieces of yourself. Find a way home.</p><button class="primary" data-action="story">BEGIN YOUR JOURNEY <span>→</span></button><button class="secondary" data-action="rankings">THE WANDERERS · LEADERBOARD</button><div class="controls"><span><kbd>A</kbd><kbd>D</kbd> MOVE</span><span><kbd>SPACE</kbd> JUMP</span><span><kbd>E</kbd> SHIFT REALITY</span></div><div class="chapter-dots">01 ─ 02 ─ 03</div>`)}
function story(){state='story';screen(`<span class="eyebrow">A FRACTURE IN THE SILENCE</span><h2>You remember the light.</h2><p>Then the world broke in two.<br>Now, only echoes remain — scattered memories suspended between a golden dawn and an endless night.</p><p>Walk the path. Collect the memory shards. Switch realities to reveal the missing ground beneath your feet.</p><button class="primary" data-action="start">STEP INTO THE LIGHT →</button><div class="controls"><span><kbd>←</kbd><kbd>→</kbd> MOVE</span><span><kbd>W / ↑ / SPACE</kbd> JUMP</span><span><kbd>E / SHIFT</kbd> SWITCH</span></div>`)}
function start(){elapsed=0;lives=5;totalShards=0;completed=0;loadLevel(0)}
function loadLevel(index){levelIndex=index;level=levels[index];tutorialSafe={x:90,y:level.platforms[0][1]-44,world:0};tutorialFalls=0;world=0;blend=0;camera=0;collected=new Set();checkpoint={x:90,y:level.platforms[0][1]-44,active:false};respawn();state='playing';$('overlay').hidden=true;$('hud').hidden=false;$('footer').hidden=true;$('touch').hidden=!matchMedia('(pointer:coarse)').matches;$('lesson').hidden=!level.tutorial;$('lesson').dataset.step='';$('chapter').textContent=`CHAPTER ${['I','II','III'][index]} / III`;$('levelName').textContent=titles[index];toast(level.story);updateHud();focusGame()}
function respawn(){player={x:checkpoint.x,y:checkpoint.y,w:26,h:44,vx:0,vy:0,grounded:false,facing:1};world=0;jumpBuffer=0;coyote=0;keys.clear();flash=.4;if(state==='playing')focusGame()}
function updateHud(){$('shards').textContent=`◇ ${collected.size} / ${level?.shards.length||5}`;$('timer').textContent=formatTime(elapsed);$('lives').textContent=level?.tutorial?'SAFE PRACTICE':'● '.repeat(lives).trim();$('world').innerHTML=`${world?'☾ DARK':'☀ LIGHT'} <kbd>E</kbd>`;updateLesson()}
function updateLesson(){
  if(!level?.tutorial)return;
  let step=0;
  if(player.x>=600)step=1;
  if(player.x>=980)step=2;
  if(player.x>=1518)step=3;
  if(player.x>=1900)step=4;
  if(player.x>=2128)step=5;
  const lessons=[
    ['01 / WALK','Your first steps','Hold D or Right Arrow. This entire first stretch is solid in both worlds. No jumping needed.'],
    ['02 / ONE SMALL HOP','A gentle leap','A tiny gap is ahead. Tap Space, W, or Up while moving. Missing it costs no sparks; try again from the edge.'],
    ['03 / SWITCH WHILE STANDING','The cyan seal','Stop on the solid path. Press E or Shift to enter Darkness and open the cyan seal. No jump needed.'],
    ['03 / DARKNESS','You opened the way','Keep walking. The ground stays solid. Both worlds have something to teach you.'],
    ['04 / RETURN TO LIGHT','The golden seal','Stop here. Press E or Shift to return to Light and open the golden seal. Take your time.'],
    ['05 / HOMEWARD','Follow the portal','Walk to the glowing portal. Your first chapter is almost complete.']
  ];
  if($('lesson').dataset.step===String(step))return;
  $('lesson').dataset.step=String(step);
  const [label,title,text]=lessons[step];
  $('lesson').innerHTML=`<span class="eyebrow">${label}</span><strong>${title}</strong><span>${text}</span>`;
}
function rescueTutorial(){
  tutorialFalls++;
  player={x:tutorialSafe.x,y:tutorialSafe.y,w:26,h:44,vx:0,vy:0,grounded:false,facing:1};
  world=tutorialSafe.world;keys.clear();jumpBuffer=0;coyote=0;flash=.4;focusGame();
  toast('Safe return. No sparks lost. Tap Jump while moving across the small gap.');
  updateHud();
}
function formatTime(s){s=Math.floor(s);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
function shift(){if(state!=='playing'||switchCooldown>0)return;const next=1-world;if((level.gates||[]).some(g=>gateClosed(g,next)&&overlap(player,g))){toast('Step clear of the seal before switching.');return}if(level.platforms.some(p=>active(p,next)&&overlap(player,{x:p[0],y:p[1]+2,w:p[2],h:25}))){toast('There is stone in the other world. Move clear before switching.');return}world=next;switchCooldown=.25;burst(player.x+13,player.y+20,world?'#86e4ef':'#f7d69d',24);sound(world?260:520,.3);updateHud()}
function die(){if(state!=='playing')return;if(level.tutorial){rescueTutorial();return}lives--;sound(110,.4,'triangle');burst(player.x,player.y,'#f498bd',30);if(lives<=0){state='gameover';screen(`<span class="eyebrow">EVEN STARS LOSE THEIR WAY</span><h2>Lost between worlds.</h2><p>Your memories are still here. Take a breath, and follow the light once more.</p><div class="result">${completed} chapters · ${totalShards} shards · ${formatTime(elapsed)}</div><div class="actions"><button class="primary" data-action="retry">RETRY CHAPTER →</button><button data-action="start">NEW JOURNEY</button></div><button class="secondary" data-action="title">RETURN TO TITLE</button>`)}else{respawn();toast(checkpoint.active?'Returned to your memory beacon.':'The light brings you back. Try again.')}updateHud()}
async function submit(){if(!signedIn)return;const r=await askStartNg({type:'startng:score',stats:{levels_completed:completed,completion_time:Math.max(1,Math.ceil(elapsed))}},'startng:scoreSaved');if(r?.ok)toast(`Journey saved${r.result?.rank?' · Rank #'+r.result.rank:''}`);else if(r)toast(r.error||'Score could not be saved.')}
function finishLevel(){completed=levelIndex+1;sound(880,.7);submit();if(completed===3){state='victory';let best=safeRead();const run={time:Math.ceil(elapsed),shards:totalShards};if(!best||run.time<best.time){try{localStorage.setItem('echo-best',JSON.stringify(run))}catch{}}screen(`<span class="eyebrow">THE TWO WORLDS ARE ONE</span><h2>You were the light all along.</h2><p>Every fragment, every shadow, every leap of faith.<br>You have remembered the way home.</p><div class="result">${formatTime(elapsed)} · ${totalShards} / 18 memories · ${lives} sparks remaining</div><p class="note">${signedIn?'Your journey is being saved to start.ng.':'Personal best saved on this browser. Sign in to start.ng to share future runs.'}</p><div class="actions"><button class="primary" data-action="start">WANDER AGAIN →</button><button data-action="rankings">LEADERBOARD</button></div><button class="secondary" data-action="title">RETURN TO TITLE</button>`)}else{state='between';screen(`<span class="eyebrow">CHAPTER ${['I','II'][levelIndex]} COMPLETE</span><h2>A little closer to home.</h2><div class="result">${collected.size} / ${level.shards.length} memories recovered · ${formatTime(elapsed)}</div><p>${levels[completed].story}</p><button class="primary" data-action="next">ENTER CHAPTER ${completed+1} →</button>`)}}
function pause(){if(state==='playing'){state='paused';screen(`<span class="eyebrow">A MOMENT BETWEEN WORLDS</span><h2>The world can wait.</h2><p>Move with A / D or arrow keys. Jump with Space, W or ↑.<br>Switch with E or Shift. R returns to your checkpoint.<br>Ghost outlines reveal platforms in the other reality.</p><div class="actions"><button class="primary" data-action="resume">CONTINUE →</button><button data-action="restart">RESTART CHAPTER</button></div><button class="secondary" data-action="title">RETURN TO TITLE</button>`)}else if(state==='paused')resume()}
function resume(){keys.clear();jumpBuffer=0;state='playing';$('lesson').hidden=!level.tutorial;$('overlay').hidden=true;$('touch').hidden=!matchMedia('(pointer:coarse)').matches;focusGame()}
async function rankings(){const back=state;state='rankings';screen(`<span class="eyebrow">THE WANDERERS</span><h2>Echoes of other journeys.</h2><p id="boardStatus">Listening for distant footsteps…</p><ol id="board"></ol><button class="primary" data-action="title">RETURN TO TITLE</button>`);const r=await askStartNg({type:'startng:leaderboard',limit:10},'startng:leaderboardData');if(state!=='rankings')return;$('boardStatus').textContent=r?.ok?(r.entries.length?'Most chapters, then fastest journey.':'Be the first to leave an echo.'):'Shared rankings become available when hosted on start.ng.';for(const e of r?.entries||[]){const li=document.createElement('li');const a=document.createElement('span'),b=document.createElement('span');a.textContent=`#${e.rank} ${e.name}${e.player_id===identity.id?' (you)':''}`;b.textContent=`${e.stats?.levels_completed||0}/3 · ${formatTime(e.stats?.completion_time||0)}`;li.append(a,b);$('board').append(li)}const best=safeRead();if(best){const li=document.createElement('li');li.textContent=`Your local best: ${formatTime(best.time)} · ${best.shards} shards`;$('board').append(li)}}
$('panel').addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;({story,start,title,resume,rankings,next:()=>loadLevel(levelIndex+1),retry:()=>{lives=5;respawn();resume();updateHud()},restart:()=>{totalShards-=collected.size;loadLevel(levelIndex)}})[action]?.()});
$('pause').onclick=pause;$('world').onclick=shift;$('touchSwitch').onclick=shift;$('mute').onclick=()=>{muted=!muted;$('mute').textContent=muted?'SOUND OFF':'SOUND ON';$('mute').setAttribute('aria-pressed',String(muted));if(!muted)sound()};
const controlKeys=['ArrowLeft','ArrowRight','ArrowUp','Space','KeyA','KeyD','KeyW','KeyE','ShiftLeft','ShiftRight','Escape','KeyR'];
const jumpKeys=['Space','KeyW','ArrowUp'];
// The opening chapter gets extra timing grace; later chapters retain their tuning.
function bufferJump(){jumpBuffer=level?.jumpTiming?.buffer??.14}
canvas.addEventListener('pointerdown',()=>{if(state==='playing')focusGame()});
addEventListener('keydown',e=>{
  if(!controlKeys.includes(e.code))return;
  // Menus keep native keyboard button activation; only Escape controls pause there.
  if(state!=='playing'){
    if(state==='paused'&&e.code==='Escape'){e.preventDefault();if(!e.repeat)resume()}
    return;
  }
  // Gameplay owns its keys even after a HUD button was clicked. In particular,
  // Space must jump rather than scrolling or activating that button again.
  e.preventDefault();
  if(e.repeat)return;
  keys.add(e.code);
  if(jumpKeys.includes(e.code))bufferJump();
  if(['KeyE','ShiftLeft','ShiftRight'].includes(e.code))shift();
  if(e.code==='Escape')pause();
  if(e.code==='KeyR'){respawn();toast('Returned to checkpoint.')}
});
addEventListener('keyup',e=>{
  keys.delete(e.code);
  if(state!=='playing')return;
  if(controlKeys.includes(e.code))e.preventDefault();
  if(jumpKeys.includes(e.code)&&player?.vy< -180)player.vy=-180;
});
for(const b of document.querySelectorAll('[data-key]')){b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);if(b.dataset.key==='Space')bufferJump()});const release=()=>{keys.delete(b.dataset.key);if(b.dataset.key==='Space'&&player?.vy< -180)player.vy=-180};b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release)}
addEventListener('blur',()=>{keys.clear();if(state==='playing')pause()});
function update(dt){clock+=dt;blend+=(world-blend)*Math.min(1,dt*5);flash=Math.max(0,flash-dt);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=140*dt;p.life-=dt}particles=particles.filter(p=>p.life>0);if(state!=='playing')return;elapsed+=dt;switchCooldown=Math.max(0,switchCooldown-dt);jumpBuffer-=dt;coyote=player.grounded?(level.jumpTiming?.coyote??.11):Math.max(0,coyote-dt);const dir=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);player.vx+=(dir*265-player.vx)*Math.min(1,dt*(dir?15:20));if(dir)player.facing=dir;if(jumpBuffer>0&&coyote>0){player.vy=-595;player.grounded=false;coyote=0;jumpBuffer=0;sound(380,.15);burst(player.x+13,player.y+44,'#e4d8fc',7)}player.vy=Math.min(800,player.vy+1150*dt);player.x+=player.vx*dt;player.x=Math.max(0,Math.min(level.width-player.w,player.x));const platforms=level.platforms.filter(p=>active(p));for(const p of platforms){if(overlap(player,{x:p[0],y:p[1],w:p[2],h:25})){if(player.vx>0)player.x=p[0]-player.w;else if(player.vx<0)player.x=p[0]+p[2]}}for(const g of level.gates||[]){if(gateClosed(g)&&overlap(player,g)){if(player.vx>0)player.x=g.x-player.w;else if(player.vx<0)player.x=g.x+g.w;player.vx=0}}const oldY=player.y;player.y+=player.vy*dt;player.grounded=false;for(const p of platforms){if(player.x+player.w>p[0]&&player.x<p[0]+p[2]){if(player.vy>=0&&oldY+player.h<=p[1]+1&&player.y+player.h>=p[1]){player.y=p[1]-player.h;player.vy=0;player.grounded=true}else if(player.vy<0&&oldY>=p[1]+25&&player.y<=p[1]+25){player.y=p[1]+25;player.vy=0}}}for(const h of level.hazards){if(hazardActive(h)&&overlap(player,{x:h[0]+5,y:h[1]+5,w:h[2]-10,h:h[3]-5})){die();return}}if(level.tutorial){
  if(player.y+player.h>605){rescueTutorial();return}
  if(player.grounded){const floor=platforms.find(p=>player.x>=p[0]&&player.x+player.w<=p[0]+p[2]&&Math.abs(player.y+player.h-p[1])<1);if(floor)tutorialSafe={x:Math.max(floor[0]+35,Math.min(player.x,floor[0]+floor[2]-90)),y:floor[1]-44,world}}
}if(player.y>H+100){die();return}level.shards.forEach((s,i)=>{if(!collected.has(i)&&Math.hypot(player.x+13-s[0],player.y+20-s[1])<33){collected.add(i);totalShards++;burst(s[0],s[1],'#ffe0a0');sound(780+collected.size*70,.25);updateHud()}});if(!checkpoint.active&&Math.abs(player.x-level.checkpoint[0])<35&&player.grounded){checkpoint={x:level.checkpoint[0],y:level.checkpoint[1]-44,active:true};burst(checkpoint.x,checkpoint.y,'#88eddf',30);toast('Memory beacon lit · checkpoint saved');sound(660,.4)}if(Math.abs(player.x-level.portal[0])<40&&Math.abs(player.y+44-level.portal[1])<60)finishLevel();camera+=(Math.max(0,Math.min(level.width-W,player.x-W*.36))-camera)*Math.min(1,dt*6);updateHud()}
// Rendering: layered procedural silhouettes, soft glows and subtle moving motes.
function mix(a,b,t){return a.map((v,i)=>Math.round(v+(b[i]-v)*t))}function color(a,b,t=blend){return `rgb(${mix(a,b,t)})`}
function glow(x,y,r,c){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,c);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}
function polygon(points,fill){ctx.fillStyle=fill;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill()}
function background(){const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,color([49,43,78],[10,15,40]));g.addColorStop(.55,color([141,112,143],[35,39,80]));g.addColorStop(1,color([222,175,153],[54,61,94]));ctx.fillStyle=g;ctx.fillRect(0,0,W,H);const sunX=710-camera*.05;glow(sunX,210,250,color([245,204,158],[58,116,166]));ctx.fillStyle=color([251,223,175],[166,221,234]);ctx.beginPath();ctx.arc(sunX,210,65,0,Math.PI*2);ctx.fill();if(blend>.01){ctx.globalAlpha=blend;ctx.fillStyle='#172145';ctx.beginPath();ctx.arc(sunX-23,192,60,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1}for(let layer=0;layer<4;layer++){const base=330+layer*72,offset=camera*(.08+layer*.09);let pts=[[-100,H]];for(let i=-2;i<17;i++){const x=i*110-(offset%110);pts.push([x,base-35-Math.sin(i*1.7+layer*3)*48-Math.cos(i*.6+layer)*35])}pts.push([1100,H]);polygon(pts,color([88-layer*15,77-layer*12,111-layer*12],[29-layer*4,39-layer*5,72-layer*7]))}ctx.globalAlpha=.3;for(let i=0;i<70;i++){let x=(i*157.31-camera*(.1+i%3*.08)+Math.sin(clock*.2+i)*14)%1050;if(x<0)x+=1050;const y=(i*71.73+clock*(2+i%4))%610;ctx.fillStyle=i%3?'#c2d5ed':'#ffe3ac';ctx.beginPath();ctx.arc(x,y,i%3?.9:1.7,0,7);ctx.fill()}ctx.globalAlpha=1;for(let i=0;i<4;i++){const x=i*390-camera*.4-80;polygon([[x,650],[x+35,340+i%2*80],[x+60,335+i%2*80],[x+80,650]],'#18213875');ctx.strokeStyle='#a2b7c320';ctx.strokeRect(x+36,360+i%2*80,25,220)}const fog=ctx.createLinearGradient(0,500,0,650);fog.addColorStop(0,'transparent');fog.addColorStop(1,color([36,35,59],[12,21,43]));ctx.fillStyle=fog;ctx.fillRect(0,500,W,150)}
function platform(p){const [x,y,w,type]=p,visible=active(p);ctx.save();if(!visible){if(levelIndex===0&&state!=='title'&&state!=='story'){ctx.globalAlpha=.5;polygon([[x,y+4],[x+w,y+4],[x+w-7,y+30],[x+w*.7,y+46],[x+w*.52,y+64],[x+w*.33,y+39],[x+8,y+30]],color([58,55,78],[28,38,65]));ctx.globalAlpha=.65}else ctx.globalAlpha=.22;ctx.strokeStyle=type===1?'#ffe0a5':'#8ce7ee';ctx.setLineDash([5,7]);ctx.strokeRect(x,y,w,23);ctx.setLineDash([]);ctx.restore();return}const top=type===1?'#f0ce94':type===2?'#85e2eb':color([192,178,181],[151,173,201]);ctx.shadowColor=top;ctx.shadowBlur=type?14:4;ctx.fillStyle=top;ctx.fillRect(x,y,w,4);ctx.shadowBlur=0;polygon([[x,y+4],[x+w,y+4],[x+w-7,y+30],[x+w*.7,y+46],[x+w*.52,y+64],[x+w*.33,y+39],[x+8,y+30]],color([58,55,78],[28,38,65]));ctx.strokeStyle='#ffffff12';for(let i=10;i<w;i+=30){ctx.beginPath();ctx.moveTo(x+i,y+7);ctx.lineTo(x+i-7,y+23);ctx.lineTo(x+i+9,y+29);ctx.stroke()}ctx.fillStyle=top;ctx.globalAlpha=.35;for(let i=15;i<w;i+=47){ctx.fillRect(x+i,y+24,1,20+i%30)}ctx.restore()}
function shard(x,y){const bob=Math.sin(clock*2.5+x)*5;glow(x,y+bob,35,'#ffdd9850');ctx.save();ctx.translate(x,y+bob);ctx.rotate(Math.sin(clock+x)*.15);polygon([[0,-12],[7,0],[0,12],[-7,0]],'#ffe5ae');polygon([[0,-12],[0,12],[-7,0]],'#c59df0');ctx.restore()}
function portal(x,y){glow(x,y-48,110,'#8ce5e830');ctx.save();ctx.translate(x,y-49);ctx.strokeStyle='#afa1c5';ctx.lineWidth=9;ctx.beginPath();ctx.ellipse(0,0,34,52,0,0,7);ctx.stroke();ctx.shadowBlur=24;ctx.shadowColor='#97eced';ctx.strokeStyle='#b0f6ee';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,29,47,0,0,7);ctx.stroke();for(let i=0;i<16;i++){const a=i/16*Math.PI*2+clock*.35;ctx.fillStyle='#d7f9ec';ctx.fillRect(Math.cos(a)*29,Math.sin(a)*47,2,2)}ctx.restore()}
function drawGate(g){
 const open=!gateClosed(g),tint=g.world?'#85e2eb':'#f0ce94';
 ctx.save();glow(g.x+g.w/2,g.y+g.h/2,75,open?'#9beddb15':g.world?'#85e2eb30':'#f0ce9430');
 ctx.globalAlpha=open?.2:.85;ctx.fillStyle=tint;ctx.shadowColor=tint;ctx.shadowBlur=12;
 ctx.fillRect(g.x,g.y,g.w,g.h);ctx.shadowBlur=0;ctx.strokeStyle=tint;ctx.lineWidth=2;
 ctx.beginPath();ctx.ellipse(g.x+g.w/2,g.y+g.h/2,35,g.h/2,0,0,Math.PI*2);ctx.stroke();
 for(let i=0;i<6;i++){ctx.beginPath();ctx.arc(g.x+g.w/2,g.y+20+i*29,4,0,Math.PI*2);ctx.stroke()}
 ctx.globalAlpha=1;ctx.fillStyle=tint;ctx.textAlign='center';ctx.font='10px Arial';
 ctx.fillText(open?'SEAL OPEN':g.world?'E / SHIFT: DARK':'E / SHIFT: LIGHT',g.x+g.w/2,g.y-17);
 ctx.restore();
}
function character(x,y,scale=1){const s={...defaults,...identity.style};for(const field of ['primaryColor','secondaryColor','skinColor','hairColor'])if(!/^#[0-9a-f]{6}$/i.test(s[field]))s[field]=defaults[field];ctx.save();ctx.translate(x+13,y+22);ctx.scale(scale,scale);const stride=state==='playing'?Math.sin(clock*16)*Math.min(1,Math.abs(player.vx)/200)*4:Math.sin(clock*2)*1;glow(0,0,45,world?'#a3eaf426':'#f8e0ad2b');if(s.accessory==='backpack'){ctx.fillStyle=s.secondaryColor;ctx.fillRect(-15,-5,9,17)}ctx.fillStyle=s.secondaryColor;ctx.fillRect(-8,10,6,12+stride);ctx.fillRect(3,10,6,12-stride);ctx.fillStyle='#242b42';ctx.fillRect(-9,19+stride,8,4);ctx.fillRect(3,19-stride,9,4);ctx.fillStyle=s.primaryColor;if(s.body==='female')polygon([[-8,-6],[8,-6],[12,14],[-12,14]],s.primaryColor);else ctx.fillRect(-10,-6,20,19);ctx.fillStyle=s.skinColor;ctx.fillRect(-14,-4,5,17-stride);ctx.fillRect(9,-4,5,17+stride);ctx.beginPath();ctx.arc(0,-13,10,0,7);ctx.fill();ctx.fillStyle=s.hairColor;if(s.hair!=='bald'){ctx.beginPath();ctx.ellipse(0,-19,s.hair==='afro'?13:10,s.hair==='afro'?11:6,0,0,7);ctx.fill();if(['braids','dreads'].includes(s.hair))for(const a of [-1,1])for(let j=0;j<4;j++){ctx.beginPath();ctx.arc(a*9,-15+j*5,3,0,7);ctx.fill()}if(s.hair==='bun'){ctx.beginPath();ctx.arc(-7,-26,5,0,7);ctx.fill()}if(s.hair==='ponytail'){ctx.save();ctx.rotate(.2);ctx.fillRect(-14,-21,6,20);ctx.restore()}}ctx.fillStyle='#25253e';ctx.fillRect(-5,-14,2,2);ctx.fillRect(4,-14,2,2);if(s.accessory==='glasses'){ctx.strokeStyle='#202233';ctx.strokeRect(-8,-16,7,6);ctx.strokeRect(1,-16,7,6);ctx.fillRect(-1,-14,2,1)}if(s.accessory==='beard'){polygon([[-7,-8],[7,-8],[0,-1]],s.hairColor)}if(s.accessory==='earrings'){ctx.fillStyle='#ffe095';ctx.fillRect(-11,-10,3,5);ctx.fillRect(9,-10,3,5)}if(s.accessory==='scarf'){ctx.fillStyle='#d9bc8e';ctx.fillRect(-9,-5,18,4);ctx.save();ctx.rotate(Math.sin(clock*4)*.1);ctx.fillRect(-18,-4,14,5);ctx.restore()}ctx.fillStyle=s.primaryColor;if(s.hat==='cap'){ctx.fillRect(-10,-26,20,7);ctx.fillRect(-12,-20,26,3)}if(s.hat==='beanie'){ctx.beginPath();ctx.arc(0,-20,11,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(-11,-22,22,4)}if(s.hat==='tophat'){ctx.fillRect(-8,-36,16,16);ctx.fillRect(-13,-22,26,4)}if(s.hat==='crown')polygon([[-11,-21],[-12,-32],[-5,-27],[0,-35],[5,-27],[12,-32],[11,-21]],'#f4d48d');ctx.restore()}
function draw(){ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.clearRect(0,0,W,H);background();ctx.save();ctx.translate(-camera,0);if(level&&state!=='title'&&state!=='story'){for(const p of level.platforms)platform(p);for(const h of level.hazards){if(!hazardActive(h))continue;glow(h[0]+h[2]/2,h[1],40,'#e984ac20');for(let x=h[0];x<h[0]+h[2];x+=12)polygon([[x,h[1]+20],[x+6,h[1]],[x+12,h[1]+20]],'#e99ab9')}level.shards.forEach((s,i)=>{if(!collected.has(i))shard(...s)});const [cx,cy]=level.checkpoint;ctx.strokeStyle=checkpoint.active?'#9beee0':'#b9a9d4';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx,cy-50);ctx.stroke();glow(cx,cy-50,checkpoint.active?45:20,checkpoint.active?'#84f4d166':'#ccb7e533');polygon([[cx,cy-65],[cx+8,cy-51],[cx,cy-38],[cx-8,cy-51]],checkpoint.active?'#b9fbe5':'#d3c5e0');portal(...level.portal);for(const g of level.gates||[])drawGate(g);if(player)character(player.x,player.y);for(const p of particles){ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,3,3)}ctx.globalAlpha=1;if(level.tutorial){ctx.fillStyle='#eadac8';ctx.font='11px Arial';ctx.textAlign='center';ctx.fillText('WALK FIRST - NO JUMP NEEDED',340,635);ctx.fillText('ONE SMALL HOP',775,635);ctx.fillText('SOLID GROUND IN BOTH WORLDS',1740,635)}}else{platform([30,535,240,0]);platform([420,490,155,1]);platform([740,475,210,0]);portal(840,475);shard(495,440);character(148,491);for(let i=0;i<6;i++)shard(1100+i*100,300)}ctx.restore();const vignette=ctx.createRadialGradient(500,300,170,500,300,650);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'#080e2488');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);if(flash>0){ctx.fillStyle=`rgba(220,224,255,${flash*.25})`;ctx.fillRect(0,0,W,H)}}
function resize(){const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr)}addEventListener('resize',resize);resize();
function frame(now){if(!last)last=now;accumulator+=Math.min(.05,(now-last)/1000);last=now;while(accumulator>=STEP){update(STEP);accumulator-=STEP}draw();requestAnimationFrame(frame)}
// start.ng bridge: exact origin, frame source, reply type and request ID must all match.
const START_NG='https://start.ng';let connectPromise,refreshing=false;
function connectFrame(){
  if(!connectPromise)connectPromise=new Promise(resolve=>{
    const el=document.createElement('iframe');
    el.src=START_NG+'/connect';el.hidden=true;el.title='start.ng player connection';
    let settled=false;
    const finish=value=>{
      if(settled)return;
      settled=true;clearTimeout(timer);
      // A temporary outage must not permanently cache a failed connection.
      // The next focus / visibility refresh can create a fresh frame.
      if(!value){el.remove();connectPromise=null}
      resolve(value);
    };
    const timer=setTimeout(()=>finish(null),5000);
    el.onload=()=>finish(el);el.onerror=()=>finish(null);
    document.body.append(el);
  });
  return connectPromise;
}
async function askStartNg(message,replyType,timeoutMs=5000){const el=await connectFrame();if(!el)return null;return new Promise(resolve=>{const requestId=globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2);let finished=false;const done=reply=>{if(finished)return;finished=true;clearTimeout(timer);removeEventListener('message',onMessage);resolve(reply)};const timer=setTimeout(()=>done(null),timeoutMs);function onMessage(e){if(e.origin!==START_NG||e.source!==el.contentWindow)return;if(e.data?.type===replyType&&e.data.requestId===requestId)done(e.data)}addEventListener('message',onMessage);el.contentWindow.postMessage({...message,requestId},START_NG)})}
async function refreshPlayer(){if(refreshing)return;refreshing=true;try{const r=await askStartNg({type:'startng:whoami'},'startng:user');if(r){signedIn=!!r.user;identity=r.user||r.guest||identity;$('identity').textContent=identity.name+(identity.account?' · @'+identity.account:'');$('signin').hidden=signedIn}}finally{refreshing=false}}
$('signin').href=`https://start.ng/?return_to=${encodeURIComponent(location.origin+location.pathname)}`;addEventListener('focus',refreshPlayer);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshPlayer();else{keys.clear();if(state==='playing')pause()}});
title();refreshPlayer();requestAnimationFrame(frame);
