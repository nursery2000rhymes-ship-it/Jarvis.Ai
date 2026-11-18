(() => {
const $ = id => document.getElementById(id);
const log = $('log'), input = $('userInput'), reactor = $('talkBtn');
const cfg = window.JARVIS_CONFIG || {};
let recognition = null, listening = false, busy = false;
let voices = [];
const addMessage = (who, text) => {
  const article = document.createElement('article'); article.className = `message ${who}`;
  const b = document.createElement('b'); b.textContent = who === 'user' ? 'YOU' : 'J.A.R.V.I.S.';
  const p = document.createElement('p'); p.textContent = text;
  article.append(b,p); log.append(article); log.scrollTop = log.scrollHeight;
};
const setStatus = (s) => $('voiceStatus').textContent = s;
const lang = () => $('language').value === 'auto' ? 'en-IN' : $('language').value;
function loadVoices(){
  voices = speechSynthesis.getVoices();
  const select = $('voiceSelect'), old = select.value;
  select.innerHTML = '<option value="">System default</option>';
  voices.forEach((v,i) => { const o=document.createElement('option');o.value=String(i);o.textContent=`${v.name} (${v.lang})`;select.append(o); });
  if(old) select.value=old;
}
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function speak(text, useHindi = false){
  if(!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const selected = $('voiceSelect').value;
  const chosen = selected !== '' ? voices[Number(selected)] : voices.find(v => v.lang === (useHindi?'hi-IN':'en-IN')) || voices.find(v => v.lang.startsWith(useHindi?'hi':'en'));
  if(chosen){u.voice=chosen;u.lang=chosen.lang;} else u.lang=useHindi?'hi-IN':'en-IN';
  u.rate=Number($('rate').value);u.pitch=Number($('pitch').value);
  speechSynthesis.speak(u);
}
function localCommand(raw){
  const s=raw.toLowerCase().trim();
  if(/^(hello|hi|hey)\b/.test(s)) return 'Hello. All systems are operational. How may I assist you?';
  if(s.includes('time')) return `The current time is ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}.`;
  if(s.includes('date') || s.includes('today')) return `Today is ${new Date().toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'})}.`;
  const sites=[['youtube','https://youtube.com'],['google','https://google.com'],['whatsapp','https://wa.me'],['maps','https://maps.google.com'],['gmail','https://mail.google.com']];
  for(const [name,url] of sites) if(s.includes(`open ${name}`) || s===name){window.open(url,'_blank','noopener');return `Opening ${name}.`;}
  if(s.startsWith('search ')){const q=raw.slice(7).trim();window.open('https://www.google.com/search?q='+encodeURIComponent(q),'_blank','noopener');return `Searching the web for ${q}.`;}
  return null;
}
async function askAI(message){
  const endpoint=cfg.API_ENDPOINT;
  if(!endpoint || endpoint.includes('YOUR-WORKER-NAME')) return 'My local systems are ready, but the AI connection is not configured yet. Add your Cloudflare Worker URL in config.js. I can still tell the time, date, open supported apps and search the web.';
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,language:lang()})});
  if(!response.ok) throw new Error(`AI service returned ${response.status}`);
  const data=await response.json();return data.reply || 'I could not form a response.';
}
async function send(text){
  const message=(text||'').trim();if(!message||busy)return;
  busy=true;addMessage('user',message);input.value='';$('systemStatus').textContent='PROCESSING';
  try{
    const local=localCommand(message);
    const reply=local || await askAI(message);
    addMessage('assistant',reply);speak(reply, $('language').value==='hi-IN' || /[\u0900-\u097F]/.test(reply));
  }catch(e){const msg=`I cannot reach the AI service right now. ${e.message}. Local commands remain available.`;addMessage('assistant',msg);speak(msg);}
  finally{busy=false;$('systemStatus').textContent='ONLINE';}
}
$('chatForm').addEventListener('submit',e=>{e.preventDefault();send(input.value);});
$('clearBtn').addEventListener('click',()=>{log.replaceChildren();addMessage('assistant','Communication log cleared. Standing by.');});
$('stopBtn').addEventListener('click',()=>{if(recognition)recognition.stop();speechSynthesis.cancel();listening=false;reactor.classList.remove('listening');setStatus('STANDBY');$('prompt').textContent='◈ VOICE LINK STANDBY ◈';});
function startListening(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){addMessage('assistant','Speech recognition is not supported by this browser. Try Chrome on Android and enable Google Speech Services.');return;}
  if(listening){recognition.stop();return;}
  recognition=new SR();recognition.lang=lang();recognition.interimResults=false;recognition.maxAlternatives=1;
  recognition.onstart=()=>{listening=true;reactor.classList.add('listening');setStatus('LISTENING');$('prompt').textContent='◈ LISTENING — SPEAK NOW ◈';};
  recognition.onresult=e=>{const heard=e.results[0][0].transcript;send(heard);};
  recognition.onerror=e=>{addMessage('assistant',`Voice input issue: ${e.error}. Check microphone permission and speech services.`);};
  recognition.onend=()=>{listening=false;reactor.classList.remove('listening');setStatus('STANDBY');$('prompt').textContent='◈ TAP THE ARC REACTOR TO SPEAK ◈';};
  recognition.start();
}
reactor.addEventListener('click',startListening);$('listenBtn').addEventListener('click',startListening);
$('clock').textContent=new Date().toLocaleTimeString();setInterval(()=>{$('clock').textContent=new Date().toLocaleTimeString();},1000);
$('year').textContent=new Date().getFullYear();$('network').textContent=navigator.onLine?'NETWORK ONLINE':'NETWORK OFFLINE';
window.addEventListener('online',()=>$('network').textContent='NETWORK ONLINE');window.addEventListener('offline',()=>$('network').textContent='NETWORK OFFLINE');
if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
