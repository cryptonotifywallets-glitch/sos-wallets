/* ============================================================
   SOS WALLETS v2 — Advanced Crypto Wallet
   Login + Simulator + Real Send & Notify + Address Book + More
   ============================================================ */

/* ---------- Token + Network definitions ---------- */
const DEFAULT_TOKENS = [
  { symbol: 'BTC',  name: 'Bitcoin',   icon: '₿',  color: '#f7931a', price: 64000 },
  { symbol: 'ETH',  name: 'Ethereum',  icon: 'Ξ',  color: '#627eea', price: 3200 },
  { symbol: 'USDT', name: 'Tether',    icon: '₮',  color: '#26a17b', price: 1 },
  { symbol: 'SOL',  name: 'Solana',    icon: '◎',  color: '#9945ff', price: 145 },
  { symbol: 'BNB',  name: 'BNB',       icon: '🟡', color: '#f3ba2f', price: 580 },
  { symbol: 'ADA',  name: 'Cardano',   icon: '₳',  color: '#0033ad', price: 0.45 },
  { symbol: 'XRP',  name: 'Ripple',    icon: '✕',  color: '#23292f', price: 0.52 },
  { symbol: 'DOT',  name: 'Polkadot',  icon: '●',  color: '#e6007a', price: 6.8 },
  { symbol: 'MATIC',name: 'Polygon',   icon: '🟣', color: '#8247e5', price: 0.72 },
  { symbol: 'AVAX', name: 'Avalanche', icon: '🔺', color: '#e84142', price: 28 },
  { symbol: 'LINK', name: 'Chainlink', icon: '🔗', color: '#2a5ada', price: 14 },
  { symbol: 'DOGE', name: 'Dogecoin',  icon: '🐕', color: '#c2a633', price: 0.12 },
];

const NETWORKS = [
  { id: 'ethereum',   name: 'Ethereum Mainnet', chainId: '0x1',      symbol: 'ETH',  icon: '⟠', rpc: 'https://mainnet.infura.io/v3/' , explorer: 'https://etherscan.io/tx/' },
  { id: 'sepolia',    name: 'Sepolia Testnet',  chainId: '0xaa36a7', symbol: 'ETH',  icon: '🧪', rpc: 'https://sepolia.infura.io/v3/' , explorer: 'https://sepolia.etherscan.io/tx/' },
  { id: 'polygon',    name: 'Polygon',          chainId: '0x89',     symbol: 'MATIC',icon: '🟣', rpc: 'https://polygon-rpc.com' , explorer: 'https://polygonscan.com/tx/' },
  { id: 'bsc',        name: 'BNB Smart Chain',  chainId: '0x38',     symbol: 'BNB',  icon: '🟡', rpc: 'https://bsc-dataseed.binance.org' , explorer: 'https://bscscan.com/tx/' },
  { id: 'arbitrum',   name: 'Arbitrum One',     chainId: '0xa4b1',   symbol: 'ETH',  icon: '🔵', rpc: 'https://arb1.arbitrum.io/rpc' , explorer: 'https://arbiscan.io/tx/' },
  { id: 'optimism',   name: 'Optimism',         chainId: '0xa',      symbol: 'ETH',  icon: '🔴', rpc: 'https://mainnet.optimism.io' , explorer: 'https://optimistic.etherscan.io/tx/' },
  { id: 'base',       name: 'Base',             chainId: '0x2105',   symbol: 'ETH',  icon: '🔷', rpc: 'https://mainnet.base.org' , explorer: 'https://basescan.org/tx/' },
  { id: 'avalanche',  name: 'Avalanche C-Chain',chainId: '0xa86a',   symbol: 'AVAX', icon: '🔺', rpc: 'https://api.avax.network/ext/bc/C/rpc' , explorer: 'https://snowtrace.io/tx/' },
  { id: 'fantom',     name: 'Fantom Opera',     chainId: '0xfa',     symbol: 'FTM',  icon: '👻', rpc: 'https://rpc.ftm.tools' , explorer: 'https://ftmscan.com/tx/' },
  { id: 'cronos',     name: 'Cronos',           chainId: '0x19',     symbol: 'CRO',  icon: '🐊', rpc: 'https://evm.cronos.org' , explorer: 'https://cronoscan.com/tx/' },
];

/* ---------- Global State ---------- */
let TOKENS = JSON.parse(JSON.stringify(DEFAULT_TOKENS));
let tokenPrices = {};
DEFAULT_TOKENS.forEach(t => tokenPrices[t.symbol] = t.price);

let simState = { wallets: [], txs: [], pendingDeposits: [], selectedWalletId: null, selectedToken: 'ETH' };
let realState = { connected:false, address:null, network:null, balance:null, web3:null, selectedNetworkId:'sepolia' };
let addrBook = [];
let notifLog = [];
let settings = { theme:'dark', autologin:true };
let currentUser = null;
let notifTemplate = null; // custom notification template

/* ---------- Storage Keys ---------- */
const K = {
  sim:    'nw_sim_',
  addr:   'nw_addrbook_',
  notif:  'nw_notif_',
  set:    'nw_settings',
  users:  'nw_users',
  session:'nw_session',
  prices: 'nw_prices',
  tmpl:   'nw_tmpl_',
  emailjs:'nw_emailjs_',
  dlog:   'nw_dlog_',
  sched:  'nw_sched_',
};

/* ---------- Persistence ---------- */
function userKey(base) { return base + (currentUser ? currentUser.email : 'guest'); }

function saveAll() {
  if (currentUser) {
    localStorage.setItem(userKey(K.sim), JSON.stringify(simState));
    localStorage.setItem(userKey(K.addr), JSON.stringify(addrBook));
    localStorage.setItem(userKey(K.notif), JSON.stringify(notifLog));
    if(notifTemplate) localStorage.setItem(userKey(K.tmpl), JSON.stringify(notifTemplate));
  }
  localStorage.setItem(K.set, JSON.stringify(settings));
  localStorage.setItem(K.prices, JSON.stringify(tokenPrices));
}
function loadAll() {
  try { settings = Object.assign(settings, JSON.parse(localStorage.getItem(K.set) || '{}')); } catch(e){}
  try { tokenPrices = Object.assign(tokenPrices, JSON.parse(localStorage.getItem(K.prices) || '{}')); } catch(e){}
  if (currentUser) {
    try { simState = Object.assign(simState, JSON.parse(localStorage.getItem(userKey(K.sim)) || '{}')); } catch(e){}
    try { addrBook = JSON.parse(localStorage.getItem(userKey(K.addr)) || '[]'); } catch(e){}
    try { notifLog = JSON.parse(localStorage.getItem(userKey(K.notif)) || '[]'); } catch(e){}
    try { notifTemplate = JSON.parse(localStorage.getItem(userKey(K.tmpl)) || 'null'); } catch(e){}
  }
}

/* ---------- Utils ---------- */
function genAddress() {
  const c='0123456789abcdef'; let a='0x';
  for(let i=0;i<40;i++) a+=c[Math.floor(Math.random()*16)]; return a;
}
function genTxHash() {
  const c='0123456789abcdef'; let h='0x';
  for(let i=0;i<64;i++) h+=c[Math.floor(Math.random()*16)]; return h;
}
function shortAddr(a){ return !a||a.length<12?a : a.slice(0,8)+'...'+a.slice(-6); }
function fmtAmt(n){ return parseFloat(n||0).toLocaleString('en-US',{maximumFractionDigits:6}); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function nowStr(){ return new Date().toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); }
function hashStr(s){ let h=0; for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0;} return 'h'+Math.abs(h); }
function getToken(sym){ return TOKENS.find(t=>t.symbol===sym); }
function tokenPrice(sym){ return tokenPrices[sym] || 0; }

/* ---------- Toasts ---------- */
function toast(type,title,msg){
  const c=document.getElementById('toast-container');
  const t=document.createElement('div'); t.className='toast '+type;
  const icons={success:'✅',error:'❌',info:'ℹ️',warning:'⚠️'};
  t.innerHTML=`<div class="toast-icon">${icons[type]||'ℹ️'}</div><div class="toast-body"><div class="toast-title">${title}</div><div class="toast-msg">${msg}</div></div>`;
  c.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(100%)';setTimeout(()=>t.remove(),300);},4200);
}

/* ============================================================
   LOGIN SYSTEM
   ============================================================ */
function switchLoginTab(tab){
  document.getElementById('lt-login').classList.toggle('active',tab==='login');
  document.getElementById('lt-register').classList.toggle('active',tab==='register');
  document.getElementById('login-form').classList.toggle('hidden',tab!=='login');
  document.getElementById('register-form').classList.toggle('hidden',tab!=='register');
}

function getUsers(){ try{return JSON.parse(localStorage.getItem(K.users)||'[]');}catch(e){return [];} }
function setUsers(u){ localStorage.setItem(K.users,JSON.stringify(u)); }

function doRegister(){
  const name=document.getElementById('reg-name').value.trim();
  const email=document.getElementById('reg-email').value.trim().toLowerCase();
  const pass=document.getElementById('reg-pass').value;
  const pass2=document.getElementById('reg-pass2').value;
  if(!name||!email||!pass){toast('error','Missing Fields','Fill in all fields.');return;}
  if(pass.length<6){toast('error','Weak Password','Password must be at least 6 characters.');return;}
  if(pass!==pass2){toast('error','Password Mismatch','Passwords do not match.');return;}
  const users=getUsers();
  if(users.find(u=>u.email===email)){toast('error','Account Exists','An account with this email already exists. Sign in instead.');return;}
  users.push({name,email,password:hashStr(pass),createdAt:Date.now()});
  setUsers(users);
  toast('success','Account Created','Welcome, '+name+'! Signing you in...');
  // auto login
  currentUser={name,email};
  if(settings.autologin) localStorage.setItem(K.session,JSON.stringify(currentUser));
  enterApp();
}

function doLogin(){
  const email=document.getElementById('login-email').value.trim().toLowerCase();
  const pass=document.getElementById('login-pass').value;
  if(!email||!pass){toast('error','Missing Fields','Enter email and password.');return;}
  const users=getUsers();
  const user=users.find(u=>u.email===email && u.password===hashStr(pass));
  if(!user){toast('error','Login Failed','Invalid email or password.');return;}
  currentUser={name:user.name,email:user.email};
  if(settings.autologin) localStorage.setItem(K.session,JSON.stringify(currentUser));
  toast('success','Welcome Back','Signed in as '+user.name);
  enterApp();
}

function logout(){
  stopSchedJobs();
  currentUser=null;
  localStorage.removeItem(K.session);
  document.getElementById('main-app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-email').value='';
  document.getElementById('login-pass').value='';
  toast('info','Logged Out','Come back soon!');
}

function resetLoginData(){
  if(!confirm('Reset ALL login details? This will delete every account and session in this browser and log you out. This cannot be undone.'))return;
  // remove all user-scoped keys + account store + session
  Object.keys(localStorage).forEach(k=>{
    if(k.startsWith(K.sim)||k.startsWith(K.addr)||k.startsWith(K.notif)||k.startsWith(K.tmpl)||k===K.users||k===K.session) localStorage.removeItem(k);
  });
  currentUser=null;
  setUsers([]);
  toast('success','Login Data Reset','All accounts and sessions cleared.');
  document.getElementById('main-app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
}

function enterApp(){
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
  document.getElementById('user-name').textContent=currentUser.name;
  document.getElementById('user-avatar').textContent=currentUser.name.charAt(0).toUpperCase();
  // reset sim state for fresh user load
  simState={wallets:[],txs:[],pendingDeposits:[],selectedWalletId:null,selectedToken:'ETH'};
  addrBook=[]; notifLog=[];
  loadAll();
  applyTheme();
  document.getElementById('theme-toggle').checked = settings.theme==='light';
  document.getElementById('autologin-toggle').checked = settings.autologin;
  initSim();
  renderAll();
  initTemplateComposer();
  resumeSchedJobs();
}

function checkSession(){
  if(settings.autologin){
    const s=localStorage.getItem(K.session);
    if(s){ try{currentUser=JSON.parse(s);enterApp();return true;}catch(e){} }
  }
  return false;
}

/* ============================================================
   THEME
   ============================================================ */
function toggleTheme(){
  settings.theme = settings.theme==='dark'?'light':'dark';
  applyTheme();
  saveAll();
}
function applyTheme(){
  document.body.classList.toggle('light-theme',settings.theme==='light');
  document.getElementById('theme-btn').textContent = settings.theme==='dark'?'🌙':'☀️';
  const t=document.getElementById('theme-toggle'); if(t) t.checked = settings.theme==='light';
}

function toggleAutologin(){
  settings.autologin = document.getElementById('autologin-toggle').checked;
  saveAll();
  if(!settings.autologin) localStorage.removeItem(K.session);
  toast('info','Auto-login', settings.autologin?'Enabled':'Disabled');
}

/* ============================================================
   MODE SWITCHING
   ============================================================ */
function switchMode(mode){
  ['sim','real','more'].forEach(m=>{
    document.getElementById('tab-'+m).classList.toggle('active',m===mode);
    document.getElementById(m+'-section').classList.toggle('hidden',m!==mode);
  });
  if(mode==='real'){ renderNetworks(); renderSendTokenSelect(); loadLivePortfolio(); }
  if(mode==='more') renderAddrBook();
}

function switchSub(s){
  ['addr','notif','template','settings','email','sched'].forEach(x=>{
    document.getElementById('st-'+x).classList.toggle('active',x===s);
    const sub=document.getElementById('sub-'+x);
    if(sub) sub.classList.toggle('hidden',x!==s);
  });
  if(s==='notif') renderNotifLog();
  if(s==='template') initTemplateComposer();
  if(s==='email') loadEmailJSConfig();
  if(s==='sched') renderSchedJobs();
}

/* ============================================================
   SIMULATOR — Wallets
   ============================================================ */
function openCreateWalletModal(){ document.getElementById('create-wallet-modal').classList.remove('hidden'); document.getElementById('new-wallet-name').focus(); }
function closeCreateWalletModal(){ document.getElementById('create-wallet-modal').classList.add('hidden'); document.getElementById('new-wallet-name').value=''; document.getElementById('new-wallet-balance').value='1000'; }

function openImportWalletModal(){ document.getElementById('import-wallet-modal').classList.remove('hidden'); }
function closeImportWalletModal(){ document.getElementById('import-wallet-modal').classList.add('hidden'); document.getElementById('imp-wallet-name').value=''; document.getElementById('imp-wallet-addr').value=''; }

function createWallet(){
  const name=document.getElementById('new-wallet-name').value.trim()||'Untitled Wallet';
  const bal=parseFloat(document.getElementById('new-wallet-balance').value)||0;
  const balances={}; TOKENS.forEach(t=>balances[t.symbol]=0); balances.ETH=bal;
  const w={id:uid(),name,address:genAddress(),balances,createdAt:Date.now()};
  simState.wallets.push(w);
  if(!simState.selectedWalletId) simState.selectedWalletId=w.id;
  saveAll(); closeCreateWalletModal(); renderAll();
  toast('success','Wallet Created',name+' • DEMO (not real)');
}

function importWallet(){
  const name=document.getElementById('imp-wallet-name').value.trim()||'Imported Wallet';
  const addr=document.getElementById('imp-wallet-addr').value.trim();
  if(!addr||!addr.startsWith('0x')||addr.length<10){toast('error','Invalid Address','Enter a valid 0x address.');return;}
  const balances={}; TOKENS.forEach(t=>balances[t.symbol]=0);
  const w={id:uid(),name,address:addr,balances,createdAt:Date.now(),imported:true};
  simState.wallets.push(w);
  if(!simState.selectedWalletId) simState.selectedWalletId=w.id;
  saveAll(); closeImportWalletModal(); renderAll();
  toast('success','Wallet Imported',name+' • 0 balance (demo)');
}

function deleteWallet(id){
  simState.wallets=simState.wallets.filter(w=>w.id!==id);
  if(simState.selectedWalletId===id) simState.selectedWalletId=simState.wallets[0]?.id||null;
  saveAll(); renderAll();
  if(!simState.wallets.length) toast('info','Wallet Deleted','No wallets left.');
}
function selectWallet(id){ simState.selectedWalletId=id; saveAll(); renderWallets(); renderHero(); }
function getSelectedWallet(){ return simState.wallets.find(w=>w.id===simState.selectedWalletId); }

function renderWallets(){
  const list=document.getElementById('wallet-list'); const empty=document.getElementById('sim-empty');
  list.innerHTML='';
  if(!simState.wallets.length){empty.classList.remove('hidden');return;}
  empty.classList.add('hidden');
  simState.wallets.forEach(w=>{
    const bal=w.balances[simState.selectedToken]||0;
    const tok=getToken(simState.selectedToken);
    const el=document.createElement('div');
    el.className='wallet-item'+(w.id===simState.selectedWalletId?' active':'');
    el.onclick=()=>selectWallet(w.id);
    el.innerHTML=`
      <div class="wallet-info">
        <div class="wallet-name">${w.name}${w.imported?' <span style="font-size:0.6rem;color:var(--text-muted);">(imported)</span>':''}</div>
        <div class="wallet-address" title="${w.address}">${shortAddr(w.address)}</div>
      </div>
      <div class="wallet-balance">${fmtAmt(bal)}<span class="currency">${tok?tok.symbol:''}</span></div>
      <div class="wallet-actions">
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();showQR('${w.address}')">📱</button>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteWallet('${w.id}')">🗑</button>
      </div>`;
    list.appendChild(el);
  });
}

function renderHero(){
  const w=getSelectedWallet();
  const hb=document.getElementById('hero-balance'), hs=document.getElementById('hero-sub');
  if(!w){hb.textContent='0.00';hs.textContent='Select or create a wallet';return;}
  const bal=w.balances[simState.selectedToken]||0; const tok=getToken(simState.selectedToken);
  hb.textContent=fmtAmt(bal); hs.textContent=`${w.name} • ${tok?tok.symbol:''} • ${shortAddr(w.address)}`;
  // gas estimate
  document.getElementById('sim-gas').textContent='0.00021 '+(tok?tok.symbol:'ETH');
  document.getElementById('sim-fee').textContent='$'+(0.00021*tokenPrice(tok?tok.symbol:'ETH')).toFixed(2);
}

function renderTokens(){
  const c=document.getElementById('sim-tokens'); c.innerHTML='';
  TOKENS.forEach(t=>{
    const p=document.createElement('div');
    p.className='token-pill'+(t.symbol===simState.selectedToken?' selected':'');
    p.innerHTML=`${t.icon} ${t.symbol}`;
    p.onclick=()=>{simState.selectedToken=t.symbol;saveAll();renderTokens();renderWallets();renderHero();renderStats();};
    c.appendChild(p);
  });
}

/* ---------- Simulator Send ---------- */
function simSend(){
  const w=getSelectedWallet();
  if(!w){toast('error','No Wallet','Create and select a wallet first.');return;}
  const recipient=document.getElementById('sim-recipient').value.trim();
  const amount=parseFloat(document.getElementById('sim-amount').value);
  const memo=document.getElementById('sim-memo').value.trim();
  const notify=document.getElementById('sim-notify-toggle').value==='yes';
  const token=simState.selectedToken; const tok=getToken(token);
  if(!recipient||!recipient.startsWith('0x')||recipient.length<10){toast('error','Invalid Address','Demo address must start with 0x.');return;}
  if(!amount||amount<=0){toast('error','Invalid Amount','Enter a valid amount.');return;}
  const bal=w.balances[token]||0;
  if(amount>bal){toast('error','Insufficient Balance',`You only have ${fmtAmt(bal)} ${token} (demo).`);return;}
  w.balances[token]=bal-amount;
  const recipientWallet=simState.wallets.find(x=>x.address.toLowerCase()===recipient.toLowerCase());
  if(recipientWallet) recipientWallet.balances[token]=(recipientWallet.balances[token]||0)+amount;
  const txHash=genTxHash();
  simState.txs.unshift({id:uid(),hash:txHash,from:w.address,fromName:w.name,to:recipient,toName:recipientWallet?recipientWallet.name:'External Demo Address',amount,token,tokenIcon:tok?tok.icon:'',timestamp:Date.now(),type:'sent',memo});
  if(recipientWallet){
    simState.txs.unshift({id:uid(),hash:txHash,from:w.address,fromName:w.name,to:recipient,toName:recipientWallet.name,amount,token,tokenIcon:tok?tok.icon:'',timestamp:Date.now(),type:'received',memo});
    // create pending deposit for recipient to accept/decline
    simState.pendingDeposits.unshift({id:uid(),txHash,from:w.address,fromName:w.name,to:recipient,toWalletId:recipientWallet.id,amount,token,timestamp:Date.now(),status:'pending',memo});
  }
  saveAll();
  document.getElementById('sim-recipient').value=''; document.getElementById('sim-amount').value=''; document.getElementById('sim-memo').value='';
  renderAll();
  toast('success','Demo Transfer Sent',`${fmtAmt(amount)} ${token} → ${shortAddr(recipient)} (NOT REAL)`);
  if(notify){ showSimNotify(w,recipient,amount,token,txHash,memo); addNotifLog('demo',`${fmtAmt(amount)} ${token} incoming deposit notified to ${shortAddr(recipient)}`); }
  else document.getElementById('sim-notify-preview').classList.add('hidden');
}

function showSimNotify(sender,recipient,amount,token,hash,memo){
  const preview=document.getElementById('sim-notify-preview');
  const content=document.getElementById('sim-notify-content');
  content.textContent=
`🔔 INCOMING DEPOSIT NOTIFICATION (DEMO)
──────────────────────────────────────
To:      ${recipient}
From:    ${sender.name} (${shortAddr(sender.address)})
Amount:  ${fmtAmt(amount)} ${token}
Memo:    ${memo||'(none)'}
Status:  Incoming — pending confirmation
Tx Ref:  ${shortAddr(hash)}
Time:    ${nowStr()}

ℹ️ This is a simulated notification. No real funds are involved.
   The recipient would see this alert in a real wallet app.`;
  preview.classList.remove('hidden');
}

/* ---------- Pending deposits accept/decline ---------- */
function acceptDeposit(id){
  const d=simState.pendingDeposits.find(p=>p.id===id);
  if(!d)return; d.status='accepted'; d.acceptedAt=Date.now();
  saveAll(); renderPending(); renderStats();
  toast('success','Deposit Accepted',`${fmtAmt(d.amount)} ${d.token} confirmed (demo)`);
}
function declineDeposit(id){
  const d=simState.pendingDeposits.find(p=>p.id===id);
  if(!d)return; d.status='declined';
  // refund sender
  const sender=simState.wallets.find(w=>w.address===d.from);
  const rec=simState.wallets.find(w=>w.id===d.toWalletId);
  if(sender) sender.balances[d.token]=(sender.balances[d.token]||0)+d.amount;
  if(rec) rec.balances[d.token]=Math.max(0,(rec.balances[d.token]||0)-d.amount);
  saveAll(); renderAll();
  toast('warning','Deposit Declined',`${fmtAmt(d.amount)} ${d.token} returned to sender (demo)`);
}

function renderPending(){
  const c=document.getElementById('pending-deposits'); const empty=document.getElementById('pending-empty');
  c.innerHTML='';
  if(!simState.pendingDeposits.length){empty.classList.remove('hidden');return;}
  empty.classList.add('hidden');
  simState.pendingDeposits.forEach(d=>{
    const el=document.createElement('div'); el.className='pending-deposit';
    let actions='';
    if(d.status==='pending') actions=`<div class="pd-actions"><button class="btn btn-green btn-sm" onclick="acceptDeposit('${d.id}')">✓ Accept</button><button class="btn btn-danger btn-sm" onclick="declineDeposit('${d.id}')">✕ Decline</button></div>`;
    el.innerHTML=`<div class="pd-info"><div class="pd-amount">↘ ${fmtAmt(d.amount)} ${d.token}</div><div class="pd-meta">From: ${d.fromName} (${shortAddr(d.from)}) • ${nowStr()}${d.memo?' • Memo: '+d.memo:''}</div></div><div class="pd-status ${d.status}">${d.status}</div>${actions}`;
    c.appendChild(el);
  });
}

/* ---------- Transaction history with search/filter ---------- */
function renderSimTxs(){
  const list=document.getElementById('sim-tx-list'); const empty=document.getElementById('sim-tx-empty');
  const q=(document.getElementById('tx-search')?.value||'').toLowerCase();
  const filter=document.getElementById('tx-filter')?.value||'all';
  list.innerHTML='';
  let txs=simState.txs;
  if(filter!=='all') txs=txs.filter(t=>t.type===filter);
  if(q) txs=txs.filter(t=>(t.to+t.from+t.token+(t.memo||'')+t.toName+t.fromName).toLowerCase().includes(q));
  if(!txs.length){empty.classList.remove('hidden');return;}
  empty.classList.add('hidden');
  txs.forEach(tx=>{
    const el=document.createElement('div'); el.className='tx-item';
    const dir=tx.type==='sent'?'↗ Sent':'↘ Received';
    const cp=tx.type==='sent'?tx.toName:tx.fromName;
    const cpAddr=tx.type==='sent'?tx.to:tx.from;
    el.innerHTML=`<div class="tx-icon ${tx.type}">${tx.type==='sent'?'↗':'↘'}</div><div class="tx-details"><div class="tx-amount ${tx.type}">${dir} ${fmtAmt(tx.amount)} ${tx.token}</div><div class="tx-meta"><span>${tx.type==='sent'?'To':'From'}: ${cp} (${shortAddr(cpAddr)})</span><span>• ${nowStr()}</span>${tx.memo?`<span>• 📝 ${tx.memo}</span>`:''}</div><div class="tx-hash">${shortAddr(tx.hash)}</div></div>`;
    list.appendChild(el);
  });
}

/* ---------- Export ---------- */
function exportTxs(fmt){
  if(!simState.txs.length){toast('warning','No Data','No transactions to export.');return;}
  let content,filename,mime;
  if(fmt==='json'){
    content=JSON.stringify(simState.txs,null,2); filename='soswallets_txs.json'; mime='application/json';
  } else {
    const headers=['Type','Token','Amount','From','FromName','To','ToName','Hash','Memo','Timestamp'];
    const rows=simState.txs.map(t=>[t.type,t.token,t.amount,t.from,t.fromName,t.to,t.toName,t.hash,t.memo||'',new Date(t.timestamp).toISOString()]);
    content=[headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    filename='soswallets_txs.csv'; mime='text/csv';
  }
  const blob=new Blob([content],{type:mime});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click();
  toast('success','Exported',filename+' downloaded');
}

/* ---------- Stats + Portfolio ---------- */
function renderStats(){
  const wallets=simState.wallets.length;
  let totalValue=0;
  simState.wallets.forEach(w=>{ TOKENS.forEach(t=>{ totalValue+=(w.balances[t.symbol]||0)*tokenPrice(t.symbol); }); });
  document.getElementById('stat-portfolio').textContent='$'+totalValue.toLocaleString('en-US',{maximumFractionDigits:2});
  document.getElementById('stat-wallets').textContent=wallets;
  const sent=simState.txs.filter(t=>t.type==='sent');
  const received=simState.txs.filter(t=>t.type==='received');
  const sentVal=sent.reduce((s,t)=>s+t.amount*tokenPrice(t.token),0);
  const recvVal=received.reduce((s,t)=>s+t.amount*tokenPrice(t.token),0);
  document.getElementById('stat-sent').textContent='$'+sentVal.toLocaleString('en-US',{maximumFractionDigits:2});
  document.getElementById('stat-received').textContent='$'+recvVal.toLocaleString('en-US',{maximumFractionDigits:2});
  document.getElementById('stat-sent-sub').textContent=sent.length+' demo txs';
  document.getElementById('stat-received-sub').textContent=received.length+' demo txs';
  renderPortfolio();
}

function renderPortfolio(){
  const totals={}; let grand=0;
  simState.wallets.forEach(w=>{ TOKENS.forEach(t=>{ const v=(w.balances[t.symbol]||0)*tokenPrice(t.symbol); if(v>0){totals[t.symbol]=(totals[t.symbol]||0)+v;grand+=v;} }); });
  const bar=document.getElementById('portfolio-bar'); const legend=document.getElementById('portfolio-legend');
  bar.innerHTML=''; legend.innerHTML='';
  if(grand===0){bar.innerHTML='<div style="width:100%;background:var(--bg-secondary);"></div>';legend.innerHTML='<span style="color:var(--text-muted);font-size:0.78rem;">No balances yet.</span>';return;}
  Object.entries(totals).sort((a,b)=>b[1]-a[1]).forEach(([sym,val])=>{
    const tok=getToken(sym); const pct=(val/grand*100);
    const seg=document.createElement('div'); seg.className='pb-segment'; seg.style.width=pct+'%'; seg.style.background=tok?tok.color:'#888'; bar.appendChild(seg);
    const li=document.createElement('div'); li.className='pl-item'; li.innerHTML=`<span class="pl-dot" style="background:${tok?tok.color:'#888'}"></span>${sym} ${pct.toFixed(1)}% ($${val.toLocaleString('en-US',{maximumFractionDigits:2})})`; legend.appendChild(li);
  });
}

/* ---------- Address Book ---------- */
function openAddAddrModal(){ document.getElementById('add-addr-modal').classList.remove('hidden'); }
function closeAddAddrModal(){ document.getElementById('add-addr-modal').classList.add('hidden'); document.getElementById('addr-nick').value=''; document.getElementById('addr-val').value=''; }
function addAddress(){
  const nick=document.getElementById('addr-nick').value.trim(); const addr=document.getElementById('addr-val').value.trim();
  if(!nick||!addr){toast('error','Missing Fields','Enter nickname and address.');return;}
  if(addrBook.find(a=>a.address.toLowerCase()===addr.toLowerCase())){toast('error','Duplicate','Address already saved.');return;}
  addrBook.push({id:uid(),nick,address:addr}); saveAll(); closeAddAddrModal(); renderAddrBook(); renderAddrQuick();
  toast('success','Address Saved',nick);
}
function deleteAddress(id){ addrBook=addrBook.filter(a=>a.id!==id); saveAll(); renderAddrBook(); renderAddrQuick(); }
function useAddress(addr){ document.getElementById('sim-recipient').value=addr; document.getElementById('real-recipient').value=addr; toast('info','Address Added','Pasted into recipient field.'); }

function renderAddrBook(){
  const list=document.getElementById('addr-book-list'); const empty=document.getElementById('addr-book-empty');
  list.innerHTML='';
  if(!addrBook.length){empty.classList.remove('hidden');return;}
  empty.classList.add('hidden');
  addrBook.forEach(a=>{
    const el=document.createElement('div'); el.className='addr-book-item';
    el.innerHTML=`<div><div class="ab-nick">${a.nick}</div><div class="ab-addr">${a.address}</div></div><div class="ab-actions"><button class="btn btn-secondary btn-sm" onclick="useAddress('${a.address}')">📤 Use</button><button class="btn btn-secondary btn-sm" onclick="showQR('${a.address}')">📱</button><button class="btn btn-danger btn-sm" onclick="deleteAddress('${a.id}')">🗑</button></div>`;
    list.appendChild(el);
  });
}

function renderAddrQuick(){
  const simQ=document.getElementById('addr-book-quick'); const realQ=document.getElementById('real-addr-quick');
  [simQ,realQ].forEach(q=>{if(q)q.innerHTML='';});
  addrBook.forEach(a=>{
    if(simQ){const b=document.createElement('button');b.className='btn btn-secondary btn-sm';b.textContent=a.nick;b.onclick=()=>useAddress(a.address);simQ.appendChild(b);}
    if(realQ){const b=document.createElement('button');b.className='btn btn-secondary btn-sm';b.textContent=a.nick;b.onclick=()=>useAddress(a.address);realQ.appendChild(b);}
  });
}

/* ---------- QR Code ---------- */
function showQR(addr){
  const display=document.getElementById('qr-display'); display.innerHTML='';
  try{
    if(typeof QRCode!=='undefined'){
      new QRCode(display,{text:addr,width:200,height:200,colorDark:'#000000',colorLight:'#ffffff'});
    } else {
      // Fallback: use API
      const img=document.createElement('img');
      img.src='https://api.qrserver.com/v1/create-qr-code/?size=200x200&data='+encodeURIComponent(addr);
      img.width=200; img.height=200; display.appendChild(img);
    }
  }catch(e){
    const img=document.createElement('img');
    img.src='https://api.qrserver.com/v1/create-qr-code/?size=200x200&data='+encodeURIComponent(addr);
    img.width=200;img.height=200;display.appendChild(img);
  }
  const a=document.createElement('div'); a.className='qr-addr'; a.textContent=addr; display.appendChild(a);
  document.getElementById('qr-modal').classList.remove('hidden');
}
function closeQRModal(){ document.getElementById('qr-modal').classList.add('hidden'); }

/* ---------- Notification Log ---------- */
function addNotifLog(type,msg){ notifLog.unshift({id:uid(),type,msg,timestamp:Date.now()}); saveAll(); }
function renderNotifLog(){
  const list=document.getElementById('notif-log-list'); const empty=document.getElementById('notif-log-empty');
  list.innerHTML='';
  if(!notifLog.length){empty.classList.remove('hidden');return;}
  empty.classList.add('hidden');
  notifLog.forEach(n=>{
    const el=document.createElement('div'); el.className='notif-log-item';
    el.innerHTML=`<div class="nl-icon">${n.type==='real'?'🔗':'🎮'}</div><div class="nl-body"><div class="nl-title">${n.msg}</div><div class="nl-time">${nowStr()}</div></div>`;
    list.appendChild(el);
  });
}
function clearNotifLog(){ notifLog=[]; saveAll(); renderNotifLog(); toast('info','Cleared','Notification log emptied.'); }

/* ---------- Price editor ---------- */
function openPriceModal(){
  const c=document.getElementById('price-inputs'); c.innerHTML='';
  TOKENS.forEach(t=>{
    const g=document.createElement('div'); g.className='form-group';
    g.innerHTML=`<label>${t.icon} ${t.symbol} price (USD)</label><input class="input" id="price-${t.symbol}" type="number" step="0.01" value="${tokenPrice(t.symbol)}">`;
    c.appendChild(g);
  });
  document.getElementById('price-modal').classList.remove('hidden');
}
function closePriceModal(){ document.getElementById('price-modal').classList.add('hidden'); }
function savePrices(){
  TOKENS.forEach(t=>{ const v=parseFloat(document.getElementById('price-'+t.symbol).value); if(!isNaN(v)) tokenPrices[t.symbol]=v; });
  saveAll(); closePriceModal(); renderAll();
  toast('success','Prices Updated','Portfolio recalculated.');
}

/* ---------- Reset functions ---------- */
function resetSim(){
  if(!confirm('Reset all simulator data (wallets, txs, deposits)?'))return;
  simState={wallets:[],txs:[],pendingDeposits:[],selectedWalletId:null,selectedToken:'ETH'};
  saveAll(); initSim(); renderAll();
  toast('info','Reset Complete','All demo data cleared.');
}
function resetAll(){
  if(!confirm('FACTORY RESET: This clears login, simulator, address book, notifications, and settings. Continue?'))return;
  Object.keys(localStorage).forEach(k=>{ if(k.startsWith('nw_')) localStorage.removeItem(k); });
  toast('success','Factory Reset','Everything cleared. Reloading...');
  setTimeout(()=>location.reload(),1000);
}

/* ============================================================
   REAL SEND + NOTIFY — Web3
   ============================================================ */
function makeEthereumProvider(eth){
  return {
    eth:{ getBalance:async(addr)=>{const h=await eth.request({method:'eth_getBalance',params:[addr,'latest']});return BigInt(h).toString();} },
    utils:{
      fromWei:(wei,u)=>{const d=18;const w=BigInt(wei.toString());const whole=w/(10n**BigInt(d));const frac=w%(10n**BigInt(d));const fs=frac.toString().padStart(d,'0').replace(/0+$/,'');return fs?`${whole}.${fs}`:whole.toString();},
      toWei:(a,u)=>{const d=18;const[w,f]=a.toString().split('.');let whole=BigInt(w||'0')*(10n**BigInt(d));let fr=0n;if(f){fr=BigInt(f.slice(0,d).padEnd(d,'0'));}return (whole+fr).toString();},
    },
  };
}

/* Return the active EIP-1193 provider for the connected wallet.
   Prefers the trustwallet injection (if present and we're inside
   Trust's in-app browser), then falls back to window.ethereum.       */
function getProvider(){
  if(window.trustwallet && window.trustwallet.isTrust) return window.trustwallet;
  if(window.ethereum) return window.ethereum;
  return null;
}

/* ---------- Multi-Provider Wallet Detection ----------
   Detects injected EIP-1193 providers (MetaMask, Trust Wallet,
   Coinbase, etc.) and offers deep-link fallbacks for mobile wallets
   that only inject a provider inside their own in-app browser.        */

const WALLET_DEEPLINKS = {
  trust:    (url)=>`https://link.trustwallet.com/open_url?coin_id=20000714&url=${encodeURIComponent(url)}`,
  metamask: (url)=>`https://metamask.app.link/dapp/${url.replace(/^https?:\/\//,'')}`,
  coinbase: (url)=>`https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
  rainbow:  (url)=>`https://rainbow.me/${url.replace(/^https?:\/\//,'')}`,
  safepal:  (url)=>`https://link.safepal.io/Import?AppVersion=&dappUrl=${encodeURIComponent(url)}`,
};

/* Detect all available injected providers. Returns array of {id,name,icon,provider,isMobile}. */
function detectInjectedProviders(){
  const providers=[];
  const win=window;
  // Trust Wallet injects window.trustwallet (and sometimes window.ethereum when in-app)
  if(win.trustwallet && win.trustwallet.isTrust){ providers.push({id:'trust',name:'Trust Wallet',icon:'🛡️',provider:win.trustwallet}); }
  if(win.ethereum){
    const eth=win.ethereum;
    // MetaMask
    if(eth.isMetaMask && !eth.isTrust && !eth.isCoinbaseWallet){ providers.push({id:'metamask',name:'MetaMask',icon:'🦊',provider:eth}); }
    // Coinbase
    if(eth.isCoinbaseWallet || (win.coinbaseWalletExtension)){ providers.push({id:'coinbase',name:'Coinbase Wallet',icon:'🔵',provider:eth}); }
    // Trust (in-app browser — ethereum is trust)
    if(eth.isTrust){ providers.push({id:'trust',name:'Trust Wallet',icon:'🛡️',provider:eth}); }
    // Rainbow
    if(eth.isRainbow){ providers.push({id:'rainbow',name:'Rainbow',icon:'🌈',provider:eth}); }
    // Generic / unknown EIP-1193 (fallback)
    if(providers.length===0){ providers.push({id:'injected',name:'Browser Wallet',icon:'🔌',provider:eth}); }
  }
  return providers;
}

function isMobileDevice(){
  // Use real mobile signals only: user-agent + touch capability.
  // Do NOT use screen width — a narrow desktop window with MetaMask installed
  // should still connect directly, not show mobile deep-links.
  const ua=/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const touch= (navigator.maxTouchPoints>0) && (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  return ua || touch;
}

/* Build the list of wallet options to show (injected + deep-link fallbacks). */
function getWalletOptions(){
  const injected=detectInjectedProviders();
  const options=[];
  const mobile=isMobileDevice();
  const pageUrl=location.href.split('#')[0];

  // Always offer detected injected providers first
  injected.forEach(p=>{ options.push({type:'injected',id:p.id,name:p.name,icon:p.icon,provider:p.provider}); });

  // On mobile with few/no injected providers, offer deep-link launches
  const haveIds=new Set(injected.map(p=>p.id));
  if(mobile || injected.length===0){
    if(!haveIds.has('trust'))    options.push({type:'deeplink',id:'trust',name:'Trust Wallet',icon:'🛡️',url:WALLET_DEEPLINKS.trust(pageUrl),hint:'Opens the Trust Wallet app & loads this site in its built-in browser.'});
    if(!haveIds.has('metamask')) options.push({type:'deeplink',id:'metamask',name:'MetaMask Mobile',icon:'🦊',url:WALLET_DEEPLINKS.metamask(pageUrl),hint:'Opens MetaMask app browser on this page.'});
    if(!haveIds.has('coinbase')) options.push({type:'deeplink',id:'coinbase',name:'Coinbase Wallet',icon:'🔵',url:WALLET_DEEPLINKS.coinbase(pageUrl),hint:'Opens Coinbase Wallet app browser on this page.'});
    if(mobile && !haveIds.has('rainbow')) options.push({type:'deeplink',id:'rainbow',name:'Rainbow',icon:'🌈',url:WALLET_DEEPLINKS.rainbow(pageUrl),hint:'Opens Rainbow app browser on this page.'});
    if(mobile && !haveIds.has('safepal')) options.push({type:'deeplink',id:'safepal',name:'SafePal',icon:'🔐',url:WALLET_DEEPLINKS.safepal(pageUrl),hint:'Opens SafePal app browser on this page.'});
  }
  return options;
}

function renderWalletModal(){
  const box=document.getElementById('wallet-list-modal');
  if(!box) return;
  const options=getWalletOptions();
  const mobile=isMobileDevice();
  let html='';
  if(options.length===0){
    html=`<div class="wallet-modal-empty">
      <p style="font-size:0.9rem;color:var(--text-secondary);margin-bottom:14px;">No wallet detected in this browser.</p>
      <p style="font-size:0.82rem;color:var(--text-muted);line-height:1.55;">
        On a phone? Install <strong>Trust Wallet</strong>, <strong>MetaMask</strong>, or
        <strong>Coinbase Wallet</strong> from your app store, then come back and tap
        <strong>Connect Wallet</strong> — the app will deep-link straight into the wallet's browser.
      </p>
      <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">
        <a class="btn btn-sm" style="background:var(--card2);text-decoration:none;" href="https://link.trustwallet.com" target="_blank">Get Trust Wallet ↗</a>
        <a class="btn btn-sm" style="background:var(--card2);text-decoration:none;" href="https://metamask.io/download/" target="_blank">Get MetaMask ↗</a>
      </div>
    </div>`;
  } else {
    html='<div class="wallet-options">';
    options.forEach(o=>{
      if(o.type==='injected'){
        html+=`<button class="wallet-option injected" onclick="connectWithProvider('${o.id}')">
          <span class="wo-icon">${o.icon}</span>
          <span class="wo-body"><span class="wo-name">${o.name}</span>
          <span class="wo-hint">Detected — tap to connect instantly.</span></span>
          <span class="wo-arrow">→</span></button>`;
      } else {
        html+=`<a class="wallet-option deeplink" href="${o.url}">
          <span class="wo-icon">${o.icon}</span>
          <span class="wo-body"><span class="wo-name">${o.name}</span>
          <span class="wo-hint">${o.hint||'Open in wallet browser.'}</span></span>
          <span class="wo-arrow">↗</span></a>`;
      }
    });
    html+='</div>';
    if(mobile){
      html+=`<div class="wallet-modal-note">
        <strong>📱 On mobile?</strong> Tap a wallet name above to open this page inside that
        wallet's in-app browser, where the connection will work automatically. After it opens,
        tap <strong>Connect Wallet</strong> again.
      </div>`;
    } else {
      html+=`<div class="wallet-modal-note">
        <strong>💻 On desktop?</strong> These buttons open the mobile wallet apps. To connect on
        desktop, install the <a href="https://metamask.io/download/" target="_blank" style="color:var(--accent-cyan);">MetaMask browser extension</a>
        or <a href="https://www.coinbase.com/wallet" target="_blank" style="color:var(--accent-cyan);">Coinbase Wallet extension</a>,
        refresh this page, then tap <strong>Connect Wallet</strong> — it will connect automatically.
      </div>`;
    }
  }
  box.innerHTML=html;
}

function openWalletModal(){
  renderWalletModal();
  document.getElementById('wallet-modal').classList.remove('hidden');
}
function closeWalletModal(){ document.getElementById('wallet-modal').classList.add('hidden'); }

/* Connect using a specific injected provider id. */
async function connectWithProvider(providerId){
  const injected=detectInjectedProviders();
  const chosen=injected.find(p=>p.id===providerId) || injected[0];
  if(!chosen){ toast('error','Provider Gone','The selected wallet is no longer available. Reopen this page inside the wallet app.'); return; }
  closeWalletModal();
  await doConnect(chosen.provider, chosen.name);
}

/* Core connection routine — works with any EIP-1193 provider. */
async function doConnect(provider, label){
  if(!provider || typeof provider.request!=='function'){ toast('error','No Web3 Provider','Could not access the wallet. Try opening this page inside the wallet app.'); return; }
  try{
    const accounts=await provider.request({method:'eth_requestAccounts'});
    if(!accounts||!accounts.length){ toast('warning','No Account','The wallet returned no accounts.'); return; }
    realState.address=accounts[0]; realState.connected=true;
    realState.web3 = (typeof Web3!=='undefined') ? new Web3(provider) : makeEthereumProvider(provider);
    const chainId=await provider.request({method:'eth_chainId'});
    const net=NETWORKS.find(n=>n.chainId===chainId); realState.network=net?net.name:`Chain ${chainId}`;
    // Persist connected wallet id so we can show it
    realState.walletLabel=label||'Wallet';
    await refreshBalance();
    loadLivePortfolio();
    if(provider.on){
      try{
        provider.on('accountsChanged',(a)=>{if(!a||!a.length)disconnectWallet();else{realState.address=a[0];updateConnUI();refreshBalance();}});
        provider.on('chainChanged',()=>location.reload());
      }catch(e){}
    }
    updateConnUI(); document.getElementById('real-send-btn').disabled=false;
    renderAddrQuick();
    toast('success','Wallet Connected',`${label||'Wallet'}: ${shortAddr(realState.address)}`);
  }catch(err){ toast('error','Connection Failed',(err&&err.message)?err.message:'Rejected or unavailable.'); }
}

/* Main entry point — opens the chooser modal (or auto-connects on desktop with a single provider). */
async function connectWallet(){
  const injected=detectInjectedProviders();
  const mobile=isMobileDevice();
  // If we found an injected provider, connect directly (desktop extension OR
  // mobile in-app browser where the wallet injected window.ethereum).
  if(injected.length===1){ await doConnect(injected[0].provider, injected[0].name); return; }
  if(injected.length>1){ openWalletModal(); return; } // multiple injected — let user pick
  // No injected provider at all — show the chooser with deep-link fallbacks.
  openWalletModal();
}
function disconnectWallet(){ realState={connected:false,address:null,network:null,balance:null,web3:null,walletLabel:null,selectedNetworkId:realState.selectedNetworkId}; updateConnUI(); document.getElementById('real-send-btn').disabled=true; toast('info','Disconnected',''); }
function updateConnUI(){
  const pill=document.getElementById('conn-status'),details=document.getElementById('conn-details'),cta=document.getElementById('conn-cta');
  if(realState.connected){
    pill.className='status-pill connected'; pill.innerHTML='<span class="dot"></span> Connected';
    details.classList.remove('hidden'); cta.classList.add('hidden');
    document.getElementById('conn-address').textContent=realState.address;
    const netEl=document.getElementById('conn-network');
    netEl.textContent=realState.network;
    netEl.title=realState.walletLabel?('via '+realState.walletLabel):'';
    document.getElementById('conn-balance').textContent=realState.balance!==null?fmtAmt(realState.balance):'—';
    const sendBtn=document.getElementById('real-send-btn'); if(sendBtn) sendBtn.disabled=false;
  } else {
    pill.className='status-pill disconnected'; pill.innerHTML='<span class="dot"></span> Not Connected';
    details.classList.add('hidden'); cta.classList.remove('hidden');
  }
}
async function refreshBalance(){
  if(!realState.connected||!realState.web3||!realState.address)return;
  try{const b=await realState.web3.eth.getBalance(realState.address);realState.balance=realState.web3.utils.fromWei(b,'ether');document.getElementById('conn-balance').textContent=fmtAmt(realState.balance);}catch(e){toast('error','Balance Error',e.message);}
  loadLivePortfolio();
}
function renderNetworks(){
  const g=document.getElementById('network-grid'); g.innerHTML='';
  NETWORKS.forEach(n=>{const c=document.createElement('div');c.className='network-card'+(n.id===realState.selectedNetworkId?' selected':'');c.innerHTML=`<div class="nw-icon">${n.icon}</div><div class="nw-name">${n.name}</div><div class="nw-symbol">${n.symbol}</div>`;c.onclick=()=>selectNetwork(n.id);g.appendChild(c);});
}
async function selectNetwork(id){
  realState.selectedNetworkId=id; renderNetworks();
  const net=NETWORKS.find(n=>n.id===id);
  if(realState.connected&&net){
    const prov=getProvider();
    if(!prov){ toast('warning','Switch Network','Switch manually in your wallet.'); return; }
    try{await prov.request({method:'wallet_switchEthereumChain',params:[{chainId:net.chainId}]});toast('info','Network Switched',net.name);}
    catch(e){if(e.code===4902){try{await prov.request({method:'wallet_addEthereumChain',params:[{chainId:net.chainId,chainName:net.name,nativeCurrency:{name:net.symbol,symbol:net.symbol,decimals:18},rpcUrls:[net.rpc]}]});}catch(e2){toast('error','Add Network Failed',e2.message);}}else{toast('warning','Switch Network','Switch manually in your wallet.');}}
  }
  renderSendTokenSelect();
}
/* ============================================================
   FEATURE: ERC-20 / TOKEN SEND SUPPORT
   Send popular tokens (USDT, USDC, WETH, LINK, DAI…) not just native.
   Uses the standard ERC-20 ABI (balanceOf / transfer / decimals).
   ============================================================ */

/* Curated, well-known token contract addresses per network.
   Addresses are the same across many EVM chains (USDT/USDC bridged). */
const ERC20_TOKENS = {
  ethereum: [
    {symbol:'USDT', name:'Tether USD',      address:'0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals:6},
    {symbol:'USDC', name:'USD Coin',        address:'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals:6},
    {symbol:'DAI',  name:'Dai Stablecoin',  address:'0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals:18},
    {symbol:'LINK', name:'Chainlink',       address:'0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals:18},
    {symbol:'WBTC', name:'Wrapped BTC',     address:'0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals:8},
    {symbol:'UNI',  name:'Uniswap',         address:'0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals:18},
  ],
  sepolia: [
    {symbol:'USDC', name:'USD Coin (test)', address:'0x94a9D9AC8a22534E90Fa1d22F4437cFc4E2f4E80', decimals:6},
  ],
  polygon: [
    {symbol:'USDT', name:'Tether USD (PoS)',address:'0xc2132D05D31c914a87C6611C10748AEb04B8e2F5', decimals:6},
    {symbol:'USDC', name:'USD Coin (PoS)',  address:'0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals:6},
    {symbol:'DAI',  name:'Dai (PoS)',       address:'0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', decimals:18},
    {symbol:'WMATIC',name:'Wrapped Matic',  address:'0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', decimals:18},
  ],
  bsc: [
    {symbol:'USDT', name:'Tether USD',      address:'0x55d398326f99059fF775485246999027B3197955', decimals:18},
    {symbol:'USDC', name:'USD Coin',        address:'0x8AC76A51cc950d9822D68b83fE1Ad97B32Cd580d', decimals:18},
    {symbol:'BUSD', name:'Binance USD',     address:'0xe9e7CEA3DedcA5984780Bafc599bD69ACd087D56', decimals:18},
    {symbol:'CAKE', name:'PancakeSwap',     address:'0x0E09FaBB73Bd3A0fbA02281d2c1A6DdD65bA6E80', decimals:18},
  ],
  arbitrum: [
    {symbol:'USDT', name:'Tether USD',      address:'0xFd086bC7CD5c481DCC9C85ebE478A1C0b69FCbb9', decimals:6},
    {symbol:'USDC', name:'USD Coin',        address:'0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals:6},
    {symbol:'ARB',  name:'Arbitrum',        address:'0x912CE59144191C1204E64559FE8253a0e49E6548', decimals:18},
  ],
  optimism: [
    {symbol:'USDT', name:'Tether USD',      address:'0x94b008aA00579c1307B0EF2c499aD44aADcE3E92', decimals:6},
    {symbol:'USDC', name:'USD Coin',        address:'0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals:6},
    {symbol:'OP',   name:'Optimism',        address:'0x4200000000000000000000000000000000000042', decimals:18},
  ],
  base: [
    {symbol:'USDC', name:'USD Coin',        address:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA-D29f'.replace('-D29f','b755'), decimals:6},
    {symbol:'DAI',  name:'Dai Stablecoin',  address:'0x50c5725949A6F0c72E6C4a641F24049A917DB0CB', decimals:18},
  ],
  avalanche: [
    {symbol:'USDT', name:'Tether USD',      address:'0x9702230A8Ea53601f5cD2dc00fDBc7d4b24d3e88', decimals:6},
    {symbol:'USDC', name:'USD Coin',        address:'0xB97EF9Ef8734C71904D8002F14b6300f40d83340', decimals:6},
    {symbol:'DAI',  name:'Dai Stablecoin',  address:'0xd586E7F844cEa2F87f5015261BC0C41dAf478211', decimals:18},
  ],
};

/* Minimal ERC-20 ABI (only what we need) */
const ERC20_ABI = [
  {"constant":true,"inputs":[{"name":"","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"type":"function"},
  {"constant":false,"inputs":[{"name":"to","type":"address"},{"name":"value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"type":"function"},
  {"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"type":"function"},
  {"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"type":"function"},
  {"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"type":"function"},
];

/* Returns the currently selected token object (or null = native). */
function getSelectedSendToken(){
  const sel=document.getElementById('send-token-select');
  if(!sel) return null;
  const v=sel.value;
  if(!v || v==='native') return null;
  // value is "address::decimals::symbol"
  const parts=v.split('::');
  if(parts.length<3) return null;
  return {address:parts[0], decimals:parseInt(parts[1],10)||18, symbol:parts[2], name:parts[3]||parts[2]};
}

/* Build the token selector dropdown for the currently selected network. */
function renderSendTokenSelect(){
  const sel=document.getElementById('send-token-select');
  if(!sel) return;
  const netId=realState.selectedNetworkId;
  const net=NETWORKS.find(n=>n.id===netId);
  const tokens=ERC20_TOKENS[netId]||[];
  let opts=`<option value="native">${net?net.symbol:'ETH'} — native token</option>`;
  tokens.forEach(t=>{
    opts+=`<option value="${t.address}::${t.decimals}::${t.symbol}::${t.name}">${t.symbol} — ${t.name}</option>`;
  });
  opts+=`<option value="custom">+ Custom token address…</option>`;
  sel.innerHTML=opts;
  // custom address field
  const customWrap=document.getElementById('custom-token-wrap');
  if(customWrap) customWrap.classList.add('hidden');
  // update amount label
  updateAmountLabel();
  // refresh token balance preview
  renderTokenBalancePreview();
}

/* When "Custom" is chosen, show a field to paste a contract address + auto-detect decimals. */
async function onSendTokenChange(){
  const sel=document.getElementById('send-token-select');
  const customWrap=document.getElementById('custom-token-wrap');
  if(sel && sel.value==='custom' && customWrap){
    customWrap.classList.remove('hidden');
    updateAmountLabel('custom token');
    return;
  }
  if(customWrap) customWrap.classList.add('hidden');
  updateAmountLabel();
  renderTokenBalancePreview();
}

/* Auto-detect a custom token's symbol + decimals from chain, then add it as a temporary option. */
async function detectCustomToken(){
  const inp=document.getElementById('custom-token-address');
  if(!inp) return;
  const addr=inp.value.trim();
  if(!addr || !addr.startsWith('0x') || addr.length!==42){ toast('error','Invalid Address','Enter a valid 0x… token contract address (42 chars).'); return; }
  const prov=getProvider();
  if(!prov){ toast('error','No Provider','Connect your wallet first.'); return; }
  const toastEl=toast('info','Detecting…','Reading token info from chain.');
  try{
    const sym=await ethCall(prov, addr, encodeCall('symbol()'));
    const dec=await ethCall(prov, addr, encodeCall('decimals()'));
    const symbolHex=sym?sym.substring(2):'';
    let symbol='TOKEN';
    // decode string: skip 32-byte offset + 32-byte length, then read ASCII
    try{ const len=parseInt(symbolHex.substring(64,128),16)||0; const s=hexToAscii(symbolHex.substring(128,128+len*2)); if(s) symbol=s; }catch(e){}
    const decimals=dec?parseInt(dec.substring(2),16):18;
    // inject as a selectable option and select it
    const sel=document.getElementById('send-token-select');
    if(sel){
      const opt=document.createElement('option');
      opt.value=addr+'::'+decimals+'::'+symbol+'::'+symbol+' (custom)';
      opt.textContent=symbol+' — '+symbol+' (custom)';
      sel.insertBefore(opt, sel.querySelector('option[value="custom"]'));
      sel.value=opt.value;
    }
    const customWrap=document.getElementById('custom-token-wrap');
    if(customWrap) customWrap.classList.add('hidden');
    updateAmountLabel(symbol);
    toast('success','Token Found', symbol+' ('+decimals+' decimals). You can now send it.');
    renderTokenBalancePreview();
  }catch(e){
    toast('error','Detection Failed', 'Could not read token info. Check the address & network. '+e.message);
  }
}

function updateAmountLabel(tokenSymbol){
  const lbl=document.getElementById('real-amount-label');
  if(!lbl) return;
  const net=NETWORKS.find(n=>n.id===realState.selectedNetworkId);
  if(tokenSymbol===undefined){
    const tk=getSelectedSendToken();
    tokenSymbol = tk ? tk.symbol : (net?net.symbol:'native');
  }
  lbl.textContent='Amount ('+tokenSymbol+')';
}

/* Show the user's balance of the selected token (or native) under the amount field. */
async function renderTokenBalancePreview(){
  const box=document.getElementById('token-balance-preview');
  if(!box || !realState.connected){ if(box) box.innerHTML=''; return; }
  const tk=getSelectedSendToken();
  const net=NETWORKS.find(n=>n.id===realState.selectedNetworkId);
  if(!tk){
    // native
    box.innerHTML = realState.balance!=null ? `<span style="color:var(--text-muted);font-size:0.76rem">Balance: ${fmtAmt(realState.balance)} ${net?net.symbol:''}</span>` : '';
    return;
  }
  box.innerHTML='<span class="spinner" style="width:12px;height:12px;"></span> <span style="color:var(--text-muted);font-size:0.76rem">Loading '+tk.symbol+' balance…</span>';
  try{
    const bal=await getTokenBalance(tk.address, realState.address, tk.decimals);
    box.innerHTML=`<span style="color:var(--text-muted);font-size:0.76rem">Balance: ${fmtAmt(bal)} ${tk.symbol}</span>`;
  }catch(e){
    box.innerHTML=`<span style="color:var(--text-muted);font-size:0.76rem">${tk.symbol} balance unavailable</span>`;
  }
}

/* Read an ERC-20 balance via raw eth_call (no external web3 needed). */
async function getTokenBalance(tokenAddr, walletAddr, decimals){
  const prov=getProvider(); if(!prov) throw new Error('no provider');
  const data=encodeCall('balanceOf(address)', walletAddr);
  const res=await ethCall(prov, tokenAddr, data);
  const balWei=res?BigInt(res):0n;
  return Number(balWei)/Number(10n**BigInt(decimals||18));
}


/* ============================================================
   FEATURE: LIVE PORTFOLIO DASHBOARD
   Aggregates native + ERC-20 balances for the connected wallet
   on the selected network, fetches live USD prices, and renders
   a portfolio table with total value.
   ============================================================ */
/* Fetch live USD prices for a list of token symbols via CoinGecko's
   free simple/price endpoint (no API key needed, CORS-enabled). */
async function fetchLivePrices(ids){
  if(!ids || !ids.length) return {};
  const url='https://api.coingecko.com/api/v3/simple/price?ids='+ids.join(',')+'&vs_currencies=usd';
  try{
    const r=await fetch(url,{headers:{'accept':'application/json'}});
    if(!r.ok) return {};
    const j=await r.json();
    const out={};
    Object.keys(j).forEach(k=>{ out[k]=j[k].usd; });
    return out;
  }catch(e){ return {}; }
}

/* Map our network+symbol combos to CoinGecko coin IDs for price lookup. */
const COINGECKO_ID_MAP={
  'ethereum:ETH':'ethereum','ethereum:WETH':'weth','ethereum:USDT':'tether','ethereum:USDC':'usd-coin',
  'ethereum:DAI':'dai','ethereum:LINK':'chainlink','ethereum:UNI':'uniswap','ethereum:WBTC':'wrapped-bitcoin',
  'polygon:ETH':'ethereum','polygon:MATIC':'matic-token','polygon:USDT':'tether','polygon:USDC':'usd-coin','polygon:DAI':'dai',
  'bsc:BNB':'binancecoin','bsc:USDT':'tether','bsc:USDC':'usd-coin','bsc:DAI':'dai',
  'arbitrum:ETH':'ethereum','arbitrum:USDT':'tether','arbitrum:USDC':'usd-coin',
  'optimism:ETH':'ethereum','optimism:USDT':'tether','optimism:USDC':'usd-coin',
  'base:ETH':'ethereum','base:USDC':'usd-coin',
  'avalanche:AVAX':'avalanche-2','avalanche:USDT':'tether','avalanche:USDC':'usd-coin','avalanche:DAI':'dai',
  'fantom:FTM':'fantom','fantom:USDT':'tether','fantom:DAI':'dai',
  'cronos:CRO':'crypto-com-chain','cronos:USDT':'tether','cronos:USDC':'usd-coin',
  'sepolia:ETH':'ethereum',
};

/* Load and render the live portfolio for the connected wallet. */
async function loadLivePortfolio(){
  const box=document.getElementById('live-portfolio-box');
  if(!box) return;
  if(!realState.connected){
    box.innerHTML='<p style="color:var(--text-muted);font-size:0.82rem;text-align:center;padding:14px 0;">Connect your wallet to see live token balances &amp; USD portfolio value across the selected network.</p>';
    return;
  }
  const net=NETWORKS.find(n=>n.id===realState.selectedNetworkId);
  if(!net){ box.innerHTML='<p style="color:var(--text-muted);font-size:0.82rem;">No network selected.</p>'; return; }
  const btn=document.getElementById('portfolio-refresh-btn');
  if(btn){ btn.disabled=true; btn.innerHTML='<span class="spinner" style="width:12px;height:12px;"></span>'; }
  box.innerHTML='<div style="text-align:center;padding:18px 0;"><span class="spinner"></span><p style="color:var(--text-muted);font-size:0.82rem;margin-top:8px;">Loading balances &amp; live prices on '+net.name+'…</p></div>';
  try{
    const prov=getProvider();
    if(!prov) throw new Error('No provider');
    const addr=realState.address;
    const rows=[];
    // 1. Native balance
    let nativeBal=0;
    try{
      const hexBal=await prov.request({method:'eth_getBalance',params:[addr,'latest']});
      nativeBal=Number(BigInt(hexBal))/1e18;
    }catch(e){}
    rows.push({symbol:net.symbol, name:net.name+' native', balance:nativeBal, coingeckoKey:net.id+':'+net.symbol});
    // 2. ERC-20 token balances
    const tokens=ERC20_TOKENS[net.id]||[];
    for(const t of tokens){
      try{
        const bal=await getTokenBalance(t.address, addr, t.decimals);
        if(bal>0 || true){ rows.push({symbol:t.symbol, name:t.name, balance:bal, coingeckoKey:net.id+':'+t.symbol}); }
      }catch(e){ /* skip unreadable token */ }
    }
    // 3. Fetch prices
    const cgIds=[...new Set(rows.map(r=>COINGECKO_ID_MAP[r.coingeckoKey]).filter(Boolean))];
    const prices=await fetchLivePrices(cgIds);
    // 4. Compute USD values
    let total=0;
    rows.forEach(r=>{
      const cgId=COINGECKO_ID_MAP[r.coingeckoKey];
      r.price=cgId?(prices[cgId]||0):0;
      r.usd=r.balance*r.price;
      total+=r.usd;
    });
    rows.sort((a,b)=>b.usd-a.usd);
    // 5. Render
    let html='<div style="margin-bottom:12px;padding:12px 14px;background:var(--bg-secondary,#0f1320);border-radius:10px;border:1px solid rgba(255,255,255,0.06);">';
    html+='<div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Total Portfolio Value</div>';
    html+='<div style="font-size:1.6rem;font-weight:700;color:var(--accent-green);margin-top:2px;">$'+total.toLocaleString('en-US',{maximumFractionDigits:2})+'</div>';
    html+='<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">'+net.name+' · '+shortAddr(addr)+'</div>';
    html+='</div>';
    html+='<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.82rem;">';
    html+='<thead><tr style="text-align:left;color:var(--text-muted);border-bottom:1px solid rgba(255,255,255,0.08);"><th style="padding:6px 8px;">Asset</th><th style="padding:6px 8px;text-align:right;">Balance</th><th style="padding:6px 8px;text-align:right;">Price</th><th style="padding:6px 8px;text-align:right;">Value</th></tr></thead><tbody>';
    rows.forEach(r=>{
      html+='<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">';
      html+='<td style="padding:7px 8px;font-weight:600;">'+escHtml(r.symbol)+'</td>';
      html+='<td style="padding:7px 8px;text-align:right;font-variant-numeric:tabular-nums;">'+fmtAmt(r.balance)+'</td>';
      html+='<td style="padding:7px 8px;text-align:right;color:var(--text-muted);">'+(r.price?'$'+r.price.toLocaleString('en-US',{maximumFractionDigits:4}):'—')+'</td>';
      html+='<td style="padding:7px 8px;text-align:right;font-weight:600;color:'+(r.usd>0?'var(--accent-green)':'var(--text-muted)')+';">$'+r.usd.toLocaleString('en-US',{maximumFractionDigits:2})+'</td>';
      html+='</tr>';
    });
    html+='</tbody></table></div>';
    html+='<p style="font-size:0.68rem;color:var(--text-muted);margin-top:8px;line-height:1.4;">Balances read on-chain via eth_call. Prices from CoinGecko (free API). Token list is curated per network — use the Custom Token detector in the Send form for any ERC-20 not listed.</p>';
    box.innerHTML=html;
  }catch(e){
    box.innerHTML='<p style="color:var(--text-muted);font-size:0.82rem;padding:10px 0;">Could not load portfolio: '+escHtml(e.message||'unknown error')+'. Make sure your wallet is connected and the network RPC is reachable.</p>';
  }finally{
    if(btn){ btn.disabled=false; btn.innerHTML='🔄 Refresh'; }
  }
}

/* ---- low-level eth_call + ABI encoding helpers ---- */
function ethCall(prov, to, data){
  return prov.request({method:'eth_call', params:[{to, data}, 'latest']});
}
function encodeCall(sig, ...args){
  const sigHash=keccakHex(sig).slice(0,10); // 4-byte selector
  let enc=sigHash;
  for(const a of args){
    if(typeof a==='string' && a.startsWith('0x') && a.length===42){
      enc+=a.substring(2).toLowerCase().padStart(64,'0'); // address
    } else {
      enc+=BigInt(a).toString(16).padStart(64,'0'); // uint
    }
  }
  return enc;
}
function hexToAscii(hex){
  let s=''; for(let i=0;i<hex.length;i+=2){ s+=String.fromCharCode(parseInt(hex.substr(i,2),16)); } return s;
}
/* Minimal keccak256 (SHA-3) implementation for 4-byte selector + 32-byte hashes.
   Pure JS, no deps. Used only for ABI selector hashing. */
function keccakHex(input){
  // extract arg types portion: e.g. 'balanceOf(address)' -> we hash the full signature string
  const str=input;
  return '0x'+keccak256(toUtf8Bytes(str));
}
function toUtf8Bytes(str){
  const out=[]; for(let i=0;i<str.length;i++){ let c=str.charCodeAt(i); if(c<0x80) out.push(c); else if(c<0x800){ out.push(0xc0|(c>>6),0x80|(c&0x3f)); } else { out.push(0xe0|(c>>12),0x80|((c>>6)&0x3f),0x80|(c&0x3f)); } } return out;
}
/* SHA3-256 is NOT keccak-256. Implementing full Keccak-256 here: */
function keccak256(msg){
  const RC=[0x1,0x8082,0x800000000808a,0x8000000080008000,0x808b,0x80000001,0x800000008081,0x8000000000008000,
            0x8009,0x8a,0x88,0x80008009,0x8000000a,0x80000000800088,0x80000000080009,0x800000000000800a,
            0x8000008a,0x800000000000008a,0x8000000008000081,0x8000000008080,0x80000001,0x8000000080008001,
            0x8000000000008081,0x8000000008008080];
  const ROT=[1,3,6,10,15,21,28,36,45,55,2,4,8,16,23,32,43,53,62,12,7,18,39,61,25,44,10,19,31,13,6,21,28,34,4,26,14,27,36,17,3,45,29,12,20,35,8,41,24,50,41,5,24,59,39,3,52,18,43,21,10,55,44,7,46,25,52,1,28,38,14,18,19,1];
  const RHO=[[0,36,3,41,18],[1,44,10,45,2],[62,6,43,15,61],[28,55,25,21,56],[27,20,39,8,14]];
  const state=new BigInt64Array(25);
  const rate=136; // bytes (1088 bits) for keccak-256
  const msgBytes=msg.slice();
  // padding
  msgBytes.push(0x01);
  while((msgBytes.length % rate)!==0) msgBytes.push(0x00);
  msgBytes[msgBytes.length-1] |= 0x80;
  function ld(a,i){ let v=0n; for(let b=0;b<8;b++){ v|=BigInt(a[i+b])<<(8n*BigInt(b)); } return v; }
  for(let off=0; off<msgBytes.length; off+=rate){
    for(let i=0;i<rate/8;i++){ state[i]^=ld(msgBytes, off+i*8); }
    let A=state;
    for(let round=0; round<24; round++){
      const C=new BigInt64Array(5), D=new BigInt64Array(5);
      for(let x=0;x<5;x++) C[x]=A[x]^A[x+5]^A[x+10]^A[x+15]^A[x+20];
      for(let x=0;x<5;x++) D[x]=C[(x+4)%5]^rotL(C[(x+1)%5],1n);
      for(let i=0;i<25;i++) A[i]^=D[i%5];
      let B=new BigInt64Array(25);
      for(let x=0;x<5;x++) for(let y=0;y<5;y++){ B[y*5+((2*x+3*y)%5)]=rotL(A[x+5*y],BigInt(RHO[x][y])); }
      for(let i=0;i<25;i++) A[i]=B[i];
      for(let y=0;y<5;y++){ const t0=B[y],t1=B[y+5],t2=B[y+10],t3=B[y+15],t4=B[y+20]; A[y]=t0^(~t1&t2); A[y+5]=t1^(~t2&t3); A[y+10]=t2^(~t3&t4); A[y+15]=t3^(~t4&t0); A[y+20]=t4^(~t0&t1); }
      A[0]^=BigInt(RC[round]);
    }
    state=A;
  }
  // squeeze 32 bytes
  let hex='';
  for(let i=0;i<4;i++){ let v=state[i]; for(let b=0;b<8;b++){ hex+=(v&0xffn).toString(16).padStart(2,'0'); v>>=8n; } }
  return hex;
  function rotL(x,n){ const m=(1n<<64n)-1n; n=n%64n; return ((x<<n)&m)|((x&(m>>n))>>((64n-n)%64n)); }
}

/* Send an ERC-20 token transfer via eth_sendTransaction (wallet signs). */
async function sendERC20(tokenAddr, recipient, amount, decimals){
  const prov=getProvider(); if(!prov) throw new Error('Wallet provider unavailable.');
  const value=BigInt(Math.floor(parseFloat(amount)*Number(10n**BigInt(decimals||18)))).toString(16);
  const data=encodeCall('transfer(address,uint256)', recipient, value);
  // amount is uint256; encode as big int
  const valueBN=BigInt(Math.floor(parseFloat(amount)*Number(10n**BigInt(decimals||18))));
  const dataHex='0xa9059cbb' // transfer(address,uint256) selector
    + recipient.substring(2).toLowerCase().padStart(64,'0')
    + valueBN.toString(16).padStart(64,'0');
  return await prov.request({method:'eth_sendTransaction', params:[{from:realState.address, to:tokenAddr, data:dataHex}]});
}


async function realSend(){
  if(!realState.connected){toast('error','Not Connected','Connect wallet first.');return;}
  const recipient=document.getElementById('real-recipient').value.trim();
  const amount=document.getElementById('real-amount').value;
  const memo=document.getElementById('real-memo').value.trim();
  const email=document.getElementById('notify-email').value.trim();
  const webhook=document.getElementById('notify-webhook').value.trim();
  if(!recipient||!recipient.startsWith('0x')||recipient.length!==42){toast('error','Invalid Address','Enter valid 0x... (42 chars).');return;}
  if(!amount||parseFloat(amount)<=0){toast('error','Invalid Amount','Enter valid amount.');return;}
  const btn=document.getElementById('real-send-btn'); btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Sending...';
  const net=NETWORKS.find(n=>n.id===realState.selectedNetworkId);
  const tk=getSelectedSendToken(); // null = native, otherwise {address,symbol,decimals}
  const sendSymbol = tk ? tk.symbol : (net?net.symbol:'ETH');
  try{
    const prov=getProvider();
    if(!prov){ throw new Error('Wallet provider unavailable. Reconnect your wallet.'); }
    let txHash, explorerUrl;
    if(tk){
      // ERC-20 token transfer
      txHash=await sendERC20(tk.address, recipient, amount, tk.decimals);
      explorerUrl=(net?net.explorer:'')+txHash;
      renderTokenBalancePreview(); // refresh preview after send
    } else {
      // Native token transfer
      const valueWei=realState.web3.utils.toWei(amount,'ether');
      txHash=await prov.request({method:'eth_sendTransaction',params:[{from:realState.address,to:recipient,value:'0x'+BigInt(valueWei).toString(16)}]});
      explorerUrl=(net?net.explorer:'')+txHash;
    }
    document.getElementById('real-tx-result').classList.remove('hidden');
    document.getElementById('real-tx-content').textContent=
`✅ Transaction Broadcast on ${net?net.name:'network'}
──────────────────────────────────────────────
From:    ${shortAddr(realState.address)}
To:      ${shortAddr(recipient)}
Amount:  ${amount} ${sendSymbol}${tk?(' (ERC-20 token)'):''}
Memo:    ${memo||'(none)'}
Tx Hash: ${txHash}
Time:    ${nowStr()}

The transaction is now pending in the mempool and will be confirmed
by the network. Track it on a block explorer.`;
    await sendRecipientNotification({recipient,amount,symbol:sendSymbol,from:realState.address,txHash,network:net?net.name:'unknown',memo,email,webhook});
    addNotifLog('real',`${amount} ${sendSymbol} sent to ${shortAddr(recipient)} — recipient notified`);
    addRealTxRecord({time:new Date().toLocaleString(),status:'success',network:net?net.name:'unknown',from:realState.address,to:recipient,amount,symbol:sendSymbol,txHash,memo,explorer:explorerUrl});
    toast('success','Sent & Notified',shortAddr(txHash));
    document.getElementById('real-recipient').value='';document.getElementById('real-amount').value='';document.getElementById('real-memo').value='';
    document.getElementById('gas-estimate')?.classList.add('hidden');
    refreshBalance(); renderNotifLog(); renderRealTxHistory();
  }catch(err){
    toast('error','Transaction Failed',err.message||'Rejected.');
    // Fallback: offer notify-only if transaction failed (e.g. insufficient funds)
    const fallback=document.getElementById('fallback-offer');
    if(fallback){fallback.classList.remove('hidden');}
    addNotifLog('real-failed',`Tx failed (${err.message||'rejected'}) to ${shortAddr(recipient)} — notification not sent. Use Notify-Only as fallback.`);
  }
  finally{btn.disabled=false;btn.innerHTML='🚀 Send &amp; Notify Recipient';}
}

/* ------------------------------------------------------------
   FALLBACK: Notify recipient only — no blockchain tx, no funds needed
   ------------------------------------------------------------ */
async function notifyOnly(){
  const recipient=document.getElementById('real-recipient').value.trim();
  const amount=document.getElementById('real-amount').value;
  const memo=document.getElementById('real-memo').value.trim();
  const email=document.getElementById('notify-email').value.trim();
  const webhook=document.getElementById('notify-webhook').value.trim();
  if(!recipient||!recipient.startsWith('0x')||recipient.length!==42){toast('error','Invalid Address','Enter valid 0x... (42 chars).');return;}
  if(!amount||parseFloat(amount)<=0){toast('error','Invalid Amount','Enter the amount you intend to send.');return;}
  const btn=document.getElementById('notify-only-btn'); btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Notifying...';
  const net=NETWORKS.find(n=>n.id===realState.selectedNetworkId);
  const fromAddr=realState.connected?realState.address:'(wallet not connected)';
  try{
    // Send notification WITHOUT a blockchain transaction
    await sendRecipientNotification({
      recipient,
      amount,
      symbol:net?net.symbol:'ETH',
      from:fromAddr,
      txHash:'(pending — no on-chain tx)',
      network:net?net.name:'unknown',
      memo,email,webhook,
      notifyOnly:true
    });
    addNotifLog('notify-only',`🔔 Notify-Only: ${amount} ${net?net.symbol:'ETH'} incoming deposit alert sent to ${shortAddr(recipient)} (no on-chain tx)`);
    addRealTxRecord({time:new Date().toLocaleString(),status:'notify-only',network:net?net.name:'unknown',from:fromAddr,to:recipient,amount,symbol:net?net.symbol:'ETH',txHash:'(pending — no on-chain tx)',memo,explorer:''});
    toast('success','Notification Sent','Recipient alerted of incoming deposit.');
    document.getElementById('fallback-offer')?.classList.add('hidden');
    renderNotifLog(); renderRealTxHistory();
  }catch(err){
    toast('error','Notification Failed',err.message||'Could not send notification.');
  }
  finally{btn.disabled=false;btn.innerHTML='🔔 Notify Recipient Only (No Funds Needed)';}
}

/* ============================================================
   FEATURE: QR-CODE SCANNER for recipient address (mobile camera)
   ============================================================ */
let qrScanStream=null;
async function scanAddressQR(){
  const modal=document.getElementById('qr-scan-modal');
  const video=document.getElementById('qr-scan-video');
  const status=document.getElementById('qr-scan-status');
  // Reset
  document.getElementById('qr-scan-result').classList.add('hidden');
  status.textContent='Starting camera…';
  modal.classList.remove('hidden');

  // Try native BarcodeDetector first (Chrome Android), fall back to image upload
  if('BarcodeDetector' in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
    try{
      const det=new BarcodeDetector({formats:['qr_code']});
      qrScanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
      video.srcObject=qrScanStream; video.play();
      status.textContent='Point camera at a wallet QR code';
      let scanning=true;
      const tick=async()=>{
        if(!scanning||!video.videoWidth){ if(scanning) requestAnimationFrame(tick); return; }
        try{
          const codes=await det.detect(video);
          if(codes&&codes.length){ handleScannedAddress(codes[0].rawValue); scanning=false; return; }
        }catch(e){}
        if(scanning) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      window.__qrStop=()=>{ scanning=false; };
    }catch(e){
      status.textContent='Camera unavailable — you can upload a QR image instead.';
      showQRFileUpload();
    }
  } else {
    status.textContent='Your browser has no live camera scanner — upload a QR image below.';
    showQRFileUpload();
  }
}
function showQRFileUpload(){
  const up=document.getElementById('qr-scan-upload-wrap'); if(up) up.classList.remove('hidden');
}
async function handleQRFile(file){
  if(!file) return;
  const url=URL.createObjectURL(file);
  const img=new Image(); img.src=url;
  await new Promise(r=>{img.onload=r;img.onerror=r;});
  if('BarcodeDetector' in window){
    try{ const det=new BarcodeDetector({formats:['qr_code']}); const codes=await det.detect(img);
      if(codes&&codes.length){ handleScannedAddress(codes[0].rawValue); URL.revokeObjectURL(url); return; }
    }catch(e){}
  }
  // Fallback: use the qr-server API to decode
  try{
    const fd=new FormData(); fd.append('file',file);
    const r=await fetch('https://api.qrserver.com/v1/read-qr-code/',{method:'POST',body:fd});
    const j=await r.json();
    if(j&&j[0]&&j[0].symbol&&j[0].symbol[0]&&j[0].symbol[0].data){ handleScannedAddress(j[0].symbol[0].data); }
    else { document.getElementById('qr-scan-status').textContent='No QR code found in that image.'; }
  }catch(e){ document.getElementById('qr-scan-status').textContent='Could not decode image. Try again.'; }
  URL.revokeObjectURL(url);
}
function handleScannedAddress(raw){
  let addr=(raw||'').trim();
  // ethereum:0x... URI scheme support
  const m=addr.match(/0x[a-fA-F0-9]{40}/);
  if(m) addr=m[0];
  const box=document.getElementById('qr-scan-result');
  const val=document.getElementById('qr-scan-val');
  if(addr && /^0x[a-fA-F0-9]{40}$/.test(addr)){
    document.getElementById('real-recipient').value=addr;
    box.classList.remove('hidden'); val.textContent='✅ '+shortAddr(addr); val.style.color='var(--accent-green)';
    document.getElementById('qr-scan-status').textContent='Address captured! Closing…';
    setTimeout(closeQRScanModal, 900);
  } else {
    box.classList.remove('hidden'); val.textContent='⚠️ Not a valid Ethereum address: '+addr.slice(0,40); val.style.color='var(--accent-yellow)';
  }
}
function closeQRScanModal(){
  if(window.__qrStop){ try{window.__qrStop();}catch(e){} }
  if(qrScanStream){ qrScanStream.getTracks().forEach(t=>t.stop()); qrScanStream=null; }
  const v=document.getElementById('qr-scan-video'); if(v) v.srcObject=null;
  document.getElementById('qr-scan-modal').classList.add('hidden');
  document.getElementById('qr-scan-upload-wrap')?.classList.add('hidden');
}

/* ============================================================
   FEATURE: GAS-FEE ESTIMATOR (live preview before sending)
   ============================================================ */
let gasEstTimer=null;
async function estimateGas(){
  clearTimeout(gasEstTimer);
  const amount=document.getElementById('real-amount').value;
  const box=document.getElementById('gas-estimate');
  if(!amount || parseFloat(amount)<=0){ box.classList.add('hidden'); return; }
  const net=NETWORKS.find(n=>n.id===realState.selectedNetworkId);
  if(!net) return;
  gasEstTimer=setTimeout(async()=>{
    box.classList.remove('hidden');
    box.innerHTML='<span class="spinner" style="width:14px;height:14px;"></span> Fetching gas price…';
    try{
      // Use a public gas-price oracle; fall back to network RPC eth_gasPrice
      let gwei=null, source='';
      if(net.id==='ethereum'||net.id==='sepolia'){
        try{ const r=await fetch('https://gas-api.metaswap.codefi.network/networks/'+(net.id==='sepolia'?'11155111':'1')+'/suggestedGasFees'); const j=await r.json();
          if(j&&j.medium){
            const maxFee=parseFloat(j.medium.suggestedMaxFeePerGas);
            const priority=parseFloat(j.medium.suggestedMaxPriorityFeePerGas)||0;
            gwei=(isFinite(maxFee)?maxFee:0)+(isFinite(priority)?priority:0);
            source='MetaMask Gas Oracle';
          } }catch(e){}
      }
      if(gwei===null && realState.web3){
        try{ const gp=await realState.web3.eth.getGasPrice(); gwei=realState.web3.utils.fromWei?parseFloat(realState.web3.utils.fromWei(gp,'gwei')):(Number(gp)/1e9); source='Network RPC'; }catch(e){}
      }
      if(gwei===null){ box.innerHTML='<span style="color:var(--text-muted);font-size:0.76rem;">Gas estimate unavailable for this network.</span>'; return; }
      const gasLimit=21000; // standard ETH transfer
      const gasEth=(gwei*gasLimit)/1e9;
      const usdPerEth=tokenPrices['ETH']||3200;
      const gasUsd=gasEth*usdPerEth;
      box.innerHTML=`<span style="color:var(--accent-cyan);">⛽ Est. gas: <strong>${gwei.toFixed(1)} gwei</strong></span>
        <span style="color:var(--text-secondary);">≈ ${gasEth.toFixed(6)} ${net.symbol} ($${gasUsd.toFixed(2)})</span>
        <span style="color:var(--text-muted);font-size:0.7rem;"> · ${source}</span>`;
    }catch(e){ box.innerHTML='<span style="color:var(--text-muted);font-size:0.76rem;">Gas estimate unavailable.</span>'; }
  }, 450);
}

/* ============================================================
   FEATURE: REAL TRANSACTION HISTORY + CSV EXPORT
   ============================================================ */
function getRealTxHistory(){ return JSON.parse(localStorage.getItem('nw_realtx_'+(currentUser?currentUser.email:'guest'))||'[]'); }
function saveRealTxHistory(arr){ localStorage.setItem('nw_realtx_'+(currentUser?currentUser.email:'guest'), JSON.stringify(arr)); }
function addRealTxRecord(rec){
  if(!currentUser) return;
  const arr=getRealTxHistory(); arr.unshift(rec); saveRealTxHistory(arr); renderRealTxHistory();
}
function renderRealTxHistory(){
  const box=document.getElementById('real-tx-history'); if(!box) return;
  const arr=getRealTxHistory();
  const btn=document.getElementById('export-csv-btn'); if(btn) btn.style.display=arr.length?'inline-flex':'none';
  if(!arr.length){ box.innerHTML='<p class="empty-state">No real transactions yet. Your sent transactions will appear here.</p>'; return; }
  box.innerHTML='<div class="tx-list">'+arr.map(r=>`
    <div class="tx-item ${r.status==='success'?'':'failed'}">
      <div class="tx-main">
        <div class="tx-title">${r.status==='success'?'✅':'⚠️'} ${r.amount} ${r.symbol} → ${shortAddr(r.to)}</div>
        <div class="tx-sub">${r.network} · ${r.time}${r.memo?' · '+r.memo:''}</div>
        ${r.txHash&&r.txHash!=='(pending — no on-chain tx)'?`<a href="${r.explorer||''}" target="_blank" class="tx-hash">${shortAddr(r.txHash)} ↗</a>`:''}
      </div>
      <div class="tx-badge ${r.status==='success'?'ok':'fail'}">${r.status==='success'?'Sent':'Notify-Only'}</div>
    </div>`).join('')+'</div>';
}
function exportRealTxCSV(){
  const arr=getRealTxHistory(); if(!arr.length){ toast('info','Nothing to Export','No transactions yet.'); return; }
  const rows=[['Time','Status','Network','From','To','Amount','Symbol','TxHash','Memo','Explorer']];
  arr.forEach(r=>rows.push([r.time||'',r.status||'',r.network||'',r.from||'',r.to||'',r.amount||'',r.symbol||'',r.txHash||'',(r.memo||'').replace(/,/g,';'),r.explorer||'']));
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='sos-wallets-tx-history-'+Date.now()+'.csv'; a.click();
  URL.revokeObjectURL(url); toast('success','CSV Exported',arr.length+' transactions');
}


/* ============================================================
   NOTIFICATION TEMPLATE SYSTEM
   Fully customizable: sender name, logo, color, message, link
   ============================================================ */

const LOGO_PRESETS = {
  '':       { type:'none',   emoji:'',    url:'' },
  'bank':   { type:'emoji',  emoji:'🏦',  url:'' },
  'crypto': { type:'emoji',  emoji:'₿',   url:'' },
  'wallet': { type:'emoji',  emoji:'👛',  url:'' },
  'shield': { type:'emoji',  emoji:'🛡️',  url:'' },
  'bolt':   { type:'emoji',  emoji:'⚡',  url:'' },
};

const LINK_PRESETS = {
  'etherscan':    { label:'Track Transaction', url:'https://etherscan.io/tx/{txHash}' },
  'bscscan':      { label:'Track Transaction', url:'https://bscscan.com/tx/{txHash}' },
  'polygonscan':  { label:'Track Transaction', url:'https://polygonscan.com/tx/{txHash}' },
  'custom':       { label:'View Details', url:'https://your-landing-page.com/deposit' },
  'none':         { label:'', url:'' },
};

const TEMPLATE_PRESETS = [
  {
    id:'default', name:'📋 Default', icon:'📋',
    sender:'SOS WALLETS', logo:'', color:'#0066ff',
    subject:'🔔 Incoming Deposit: {amount} {symbol} is on the way',
    greeting:'Hello,', intro:'A deposit is incoming to your wallet.',
    btnLabel:'Track Transaction', btnUrl:'https://etherscan.io/tx/{txHash}',
    footer:'This is an automated notification. Do not reply to this email.'
  },
  {
    id:'bank', name:'🏦 Bank-Style', icon:'🏦',
    sender:'GlobalPay Banking', logo:'bank', color:'#0a4d2e',
    subject:'Deposit Confirmation — {amount} {symbol} Incoming',
    greeting:'Dear Valued Customer,', intro:'We are notifying you of an incoming deposit to your account. Please review the transaction details below.',
    btnLabel:'View Transaction Details', btnUrl:'https://etherscan.io/tx/{txHash}',
    footer:'This is an automated message from GlobalPay Banking. Please do not reply to this email. For support, contact support@globalpay.example.'
  },
  {
    id:'crypto', name:'₿ Crypto Exchange', icon:'₿',
    sender:'CryptoNotify', logo:'crypto', color:'#f7931a',
    subject:'⚡ {amount} {symbol} Deposit Incoming — CryptoNotify',
    greeting:'Hey there 👋', intro:'You\'ve got an incoming deposit! Here are the details:',
    btnLabel:'Track on Blockchain', btnUrl:'https://etherscan.io/tx/{txHash}',
    footer:'CryptoNotify — Real-time deposit alerts. Stay ahead of your transactions.'
  },
  {
    id:'fintech', name:'💳 Fintech / Modern', icon:'💳',
    sender:'PayFlow', logo:'bolt', color:'#6c5ce7',
    subject:'💰 You\'re receiving {amount} {symbol}',
    greeting:'Hi there,', intro:'Someone is sending you a deposit. Here\'s everything you need to know.',
    btnLabel:'See Deposit Details', btnUrl:'https://etherscan.io/tx/{txHash}',
    footer:'Sent with care by PayFlow. Need help? Tap the button above.'
  },
  {
    id:'secure', name:'🛡️ Security Alert', icon:'🛡️',
    sender:'SecureWallet Alert', logo:'shield', color:'#1e3a5f',
    subject:'⚠️ Incoming Transfer Alert: {amount} {symbol}',
    greeting:'Hello,', intro:'A transfer is incoming to your secured wallet. Please verify the details below and confirm once received.',
    btnLabel:'Verify Transaction', btnUrl:'https://etherscan.io/tx/{txHash}',
    footer:'SecureWallet — Keeping your assets safe. Never share your private keys.'
  },
  {
    id:'personal', name:'👤 Personal / Casual', icon:'👤',
    sender:'', logo:'', color:'#0066ff',
    subject:'Sending you {amount} {symbol} 💸',
    greeting:'Hey!', intro:'Just letting you know I\'m sending you a deposit. Should arrive soon!',
    btnLabel:'Check It Out', btnUrl:'https://etherscan.io/tx/{txHash}',
    footer:''
  },
  {
    id:'minimal', name:'✨ Minimal', icon:'✨',
    sender:'', logo:'', color:'#333333',
    subject:'Incoming: {amount} {symbol}',
    greeting:'', intro:'A deposit is incoming.',
    btnLabel:'View', btnUrl:'https://etherscan.io/tx/{txHash}',
    footer:''
  },
];

function defaultTemplate(){
  return Object.assign({}, TEMPLATE_PRESETS[0]);
}

function getTemplate(){
  if(!notifTemplate) notifTemplate = defaultTemplate();
  return notifTemplate;
}

function fillTemplateVars(str, vars){
  if(!str) return '';
  return str
    .replace(/\{amount\}/g, vars.amount||'')
    .replace(/\{symbol\}/g, vars.symbol||'')
    .replace(/\{from\}/g, vars.from||'')
    .replace(/\{network\}/g, vars.network||'')
    .replace(/\{txHash\}/g, vars.txHash||'')
    .replace(/\{sender\}/g, vars.sender||'')
    .replace(/\{recipient\}/g, vars.recipient||'')
    .replace(/\{memo\}/g, vars.memo||'');
}

/* ---- Build the professional HTML email ---- */
function buildHtmlEmail(tpl, vars){
  const sender=fillTemplateVars(tpl.sender, vars)||'Notification';
  const subject=fillTemplateVars(tpl.subject, vars);
  const greeting=fillTemplateVars(tpl.greeting, vars);
  const intro=fillTemplateVars(tpl.intro, vars);
  const footer=fillTemplateVars(tpl.footer, vars);
  const color=tpl.color||'#0066ff';
  const btnLabel=fillTemplateVars(tpl.btnLabel, vars);
  const btnUrl=fillTemplateVars(tpl.btnUrl, vars);
  const statusLine=vars.notifyOnly?'Alert only — no on-chain transaction has been broadcast yet. The sender will complete the transfer separately.':'Pending — awaiting on-chain confirmation';

  // Logo
  let logoHtml='';
  if(tpl.logo && tpl.logo.startsWith('http')){
    logoHtml=`<img src="${tpl.logo}" style="height:40px;max-width:160px;object-fit:contain;" alt="logo">`;
  } else if(LOGO_PRESETS[tpl.logo] && LOGO_PRESETS[tpl.logo].emoji){
    logoHtml=`<span style="font-size:32px;">${LOGO_PRESETS[tpl.logo].emoji}</span>`;
  }

  // Action button
  let btnHtml='';
  if(btnLabel && btnUrl){
    btnHtml=`<div style="text-align:center;margin:28px 0;">
      <a href="${btnUrl}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;">${btnLabel}</a>
    </div>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:560px;">
        <!-- Header -->
        <tr><td style="background:${color};padding:24px 32px;text-align:left;">
          ${logoHtml?`<div style="margin-bottom:8px;">${logoHtml}</div>`:''}
          <div style="color:#ffffff;font-size:20px;font-weight:700;">${sender}</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <div style="font-size:18px;font-weight:700;color:#111;margin-bottom:16px;">${subject}</div>
          ${greeting?`<p style="font-size:15px;color:#333;margin:0 0 12px;">${greeting}</p>`:''}
          <p style="font-size:15px;color:#333;margin:0 0 20px;line-height:1.6;">${intro}</p>
          <!-- Transaction details card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;margin:16px 0;">
            <tr><td style="padding:20px;">
              <div style="font-size:13px;color:#666;margin-bottom:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Transaction Details</div>
              <table width="100%" cellpadding="4" cellspacing="0" style="font-size:14px;color:#333;">
                <tr><td style="color:#888;width:120px;">Amount</td><td style="font-weight:700;">${vars.amount} ${vars.symbol}</td></tr>
                <tr><td style="color:#888;">From</td><td style="font-family:monospace;font-size:12px;">${vars.from}</td></tr>
                <tr><td style="color:#888;">To</td><td style="font-family:monospace;font-size:12px;">${vars.recipient}</td></tr>
                <tr><td style="color:#888;">Network</td><td>${vars.network}</td></tr>
                ${vars.memo&&vars.memo!=='(none)'?`<tr><td style="color:#888;">Memo</td><td>${vars.memo}</td></tr>`:''}
                <tr><td style="color:#888;">Tx Hash</td><td style="font-family:monospace;font-size:12px;">${vars.txHash}</td></tr>
                <tr><td style="color:#888;">Status</td><td>${statusLine}</td></tr>
                <tr><td style="color:#888;">Time</td><td>${vars.time}</td></tr>
              </table>
            </td></tr>
          </table>
          ${btnHtml}
          <p style="font-size:13px;color:#888;margin:20px 0 0;line-height:1.5;">
            The funds will appear once the transaction is confirmed by the network.
            Track it using the Tx Hash on a ${vars.network} block explorer.
          </p>
        </td></tr>
        <!-- Footer -->
        ${footer?`<tr><td style="padding:20px 32px;background:#f8f9fa;border-top:1px solid #e9ecef;">
          <p style="font-size:12px;color:#999;margin:0;line-height:1.5;">${footer}</p>
        </td></tr>`:''}
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/* ---- Plain text version (for mailto & webhook message) ---- */
function buildTextEmail(tpl, vars){
  const sender=fillTemplateVars(tpl.sender, vars)||'Notification';
  const subject=fillTemplateVars(tpl.subject, vars);
  const greeting=fillTemplateVars(tpl.greeting, vars);
  const intro=fillTemplateVars(tpl.intro, vars);
  const footer=fillTemplateVars(tpl.footer, vars);
  const statusLine=vars.notifyOnly?'Alert only — no on-chain transaction has been broadcast yet. The sender will complete the transfer separately.':'Pending — awaiting on-chain confirmation';
  let text='';
  if(greeting) text+=greeting+'\n\n';
  text+=intro+'\n\n';
  text+='  Amount:   '+vars.amount+' '+vars.symbol+'\n';
  text+='  From:     '+vars.from+'\n';
  text+='  To:       '+vars.recipient+'\n';
  text+='  Network:  '+vars.network+'\n';
  if(vars.memo&&vars.memo!=='(none)') text+='  Memo:     '+vars.memo+'\n';
  text+='  Tx Hash:  '+vars.txHash+'\n';
  text+='  Status:   '+statusLine+'\n';
  text+='  Time:     '+vars.time+'\n\n';
  text+='The funds will appear once the transaction is confirmed by the network.\n';
  text+='Track it using the Tx Hash on a '+vars.network+' block explorer.\n\n';
  if(tpl.btnLabel&&tpl.btnUrl) text+='→ '+fillTemplateVars(tpl.btnLabel,vars)+': '+fillTemplateVars(tpl.btnUrl,vars)+'\n\n';
  if(sender) text+='— '+sender+'\n';
  if(footer) text+=footer+'\n';
  return text;
}

/* ---- UI: render preset buttons ---- */
function renderPresets(){
  const list=document.getElementById('preset-list');
  if(!list) return;
  list.innerHTML='';
  TEMPLATE_PRESETS.forEach(p=>{
    const btn=document.createElement('button');
    btn.className='btn btn-sm';
    btn.style.background='var(--card2)';
    btn.innerHTML=p.icon+' '+p.name;
    btn.onclick=()=>applyPreset(p.id);
    list.appendChild(btn);
  });
}

function applyPreset(id){
  const p=TEMPLATE_PRESETS.find(x=>x.id===id);
  if(!p) return;
  notifTemplate=Object.assign({}, p);
  delete notifTemplate.id; delete notifTemplate.name; delete notifTemplate.icon;
  populateTemplateForm();
  saveAll();
  toast('success','Preset Applied',p.name+' template loaded. Edit anything below.');
}

function populateTemplateForm(){
  const t=getTemplate();
  const set=(id,val)=>{const el=document.getElementById(id); if(el) el.value=val||'';};
  set('tmpl-sender',t.sender);
  set('tmpl-logo',t.logo);
  set('tmpl-color',t.color);
  set('tmpl-subject',t.subject);
  set('tmpl-greeting',t.greeting);
  set('tmpl-intro',t.intro);
  set('tmpl-btn-label',t.btnLabel);
  set('tmpl-btn-url',t.btnUrl);
  set('tmpl-footer',t.footer);
  renderLogoPreview();
}

function renderLogoPreview(){
  const t=getTemplate();
  const box=document.getElementById('logo-preview');
  if(!box) return;
  const val=document.getElementById('tmpl-logo')?document.getElementById('tmpl-logo').value:t.logo;
  if(!val){box.innerHTML='<span style="font-size:0.72rem;color:var(--text-muted);">No logo selected</span>';return;}
  if(val.startsWith('http')){
    box.innerHTML='<img src="'+val+'" style="height:36px;max-width:140px;border-radius:6px;background:#fff;padding:4px;" onerror="this.parentElement.innerHTML=\'⚠️ Image failed to load\'">';
  } else if(LOGO_PRESETS[val]&&LOGO_PRESETS[val].emoji){
    box.innerHTML='<span style="font-size:28px;">'+LOGO_PRESETS[val].emoji+'</span>';
  } else {
    box.innerHTML='<span style="font-size:0.72rem;color:var(--text-muted);">No logo selected</span>';
  }
}

function setLogoPreset(key){
  const el=document.getElementById('tmpl-logo');
  if(el){ el.value=LOGO_PRESETS[key]?key:''; }
  renderLogoPreview();
}

function setLinkPreset(key){
  const p=LINK_PRESETS[key];
  if(!p) return;
  const lbl=document.getElementById('tmpl-btn-label');
  const url=document.getElementById('tmpl-btn-url');
  if(lbl) lbl.value=p.label;
  if(url) url.value=p.url;
}

function readTemplateFromForm(){
  const get=id=>{const el=document.getElementById(id);return el?el.value.trim():'';};
  return {
    sender:   get('tmpl-sender'),
    logo:     get('tmpl-logo'),
    color:    get('tmpl-color')||'#0066ff',
    subject:  get('tmpl-subject'),
    greeting: get('tmpl-greeting'),
    intro:    get('tmpl-intro'),
    btnLabel: get('tmpl-btn-label'),
    btnUrl:   get('tmpl-btn-url'),
    footer:   get('tmpl-footer'),
  };
}

function saveTemplate(){
  notifTemplate=readTemplateFromForm();
  saveAll();
  toast('success','Template Saved','Your custom notification template is now active.');
}

function resetTemplate(){
  if(!confirm('Reset the notification template to default?')) return;
  notifTemplate=defaultTemplate();
  delete notifTemplate.id; delete notifTemplate.name; delete notifTemplate.icon;
  populateTemplateForm();
  saveAll();
  toast('info','Reset','Template restored to default.');
}

function previewTemplate(){
  const t=readTemplateFromForm();
  const vars={
    amount:'0.5', symbol:'ETH',
    from:'0x742d35Cc6634C0532925a3b844Bc9e7595f0b51b',
    recipient:'0xAbC1234567890defGhi456', network:'Ethereum Mainnet',
    memo:'Payment for Invoice #1234', txHash:'0xa1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890',
    time:new Date().toLocaleString(), sender:t.sender, notifyOnly:false
  };
  const html=buildHtmlEmail(t, vars);
  const modal=document.getElementById('tmpl-preview-modal');
  const content=document.getElementById('tmpl-preview-content');
  if(modal&&content){
    content.innerHTML='<iframe srcdoc="'+html.replace(/"/g,'&quot;')+'" style="width:100%;height:500px;border:none;border-radius:8px;"></iframe>';
    modal.classList.remove('hidden');
  }
}

function closeTmplPreview(){
  const modal=document.getElementById('tmpl-preview-modal');
  if(modal) modal.classList.add('hidden');
}

/* Attach live listeners to template form fields for logo preview */
function initTemplateComposer(){
  renderPresets();
  populateTemplateForm();
  const logoInput=document.getElementById('tmpl-logo');
  if(logoInput) logoInput.addEventListener('input', renderLogoPreview);
}

/* ============================================================
   UNIFIED EMAIL DELIVERY — multi-provider, auto-fallback
   Providers:
     • emailjs   — can send to ANY recipient (needs Service+Template+PublicKey)
     • web3forms — one access key, zero config, works from any origin.
                   Delivers to the account owner's verified inbox; we send a
                   copy of every notification there (notification-to-self),
                   with the recipient's address + message embedded so the
                   owner can forward it. Great as a guaranteed fallback.
     • none      — manual mailto button only
   The dispatcher deliverEmail() tries the configured primary provider,
   then auto-falls back to Web3Forms (if a key exists), then to mailto.
   ============================================================ */
const EMAILJS_API    = 'https://api.emailjs.com/api/v1.0/email/send';
const WEB3FORMS_API  = 'https://api.web3forms.com/submit';

/* ---------- unified config (stored per-user) ---------- */
function getEmailConfig(){
  try{ return JSON.parse(localStorage.getItem(userKey(K.emailjs))||'null'); }catch(e){ return null; }
}
function saveEmailConfigData(cfg){
  localStorage.setItem(userKey(K.emailjs), JSON.stringify(cfg));
}

/* ---------- EmailJS helpers (kept for backward compat) ---------- */
function getEmailJSConfig(){ return getEmailConfig(); }
function saveEmailJSConfigData(cfg){ saveEmailConfigData(cfg); }

/* ---------- Delivery log (per-user, in-app audit trail) ---------- */
function getDeliveryLog(){
  try{ return JSON.parse(localStorage.getItem(userKey(K.dlog))||'[]'); }catch(e){ return []; }
}
function addDeliveryRecord(rec){
  const log=getDeliveryLog();
  log.unshift(Object.assign({time:new Date().toISOString()},rec));
  // keep last 100
  if(log.length>100) log.length=100;
  localStorage.setItem(userKey(K.dlog), JSON.stringify(log));
  renderDeliveryLog();
}
function clearDeliveryLog(){
  localStorage.removeItem(userKey(K.dlog));
  renderDeliveryLog();
  toast('info','Cleared','Delivery log cleared.');
}

/* ---------- load config into the settings UI ---------- */
/* ============================================================
   FEATURE: RECURRING NOTIFICATION SCHEDULER
   Lets the user create recurring email-notification jobs that fire
   on a timer (while the app is open) and persist across reloads.
   Missed jobs are caught up on resume.
   ============================================================ */
/* In-memory map of active interval timers keyed by job id. */
var __schedTimers={};

/* Persisted job list (per-user). Each job: {id,name,interval,email,subject,bodyType,body,createdAt,lastRun,nextRun,enabled} */
function getSchedJobs(){
  const u=currentUser; if(!u) return [];
  try{ return JSON.parse(localStorage.getItem(K.sched+u.id)||'[]'); }catch(e){ return []; }
}
function saveSchedJobs(jobs){
  const u=currentUser; if(!u) return;
  localStorage.setItem(K.sched+u.id, JSON.stringify(jobs));
}

/* Add a new scheduled job from the form fields. */
function addSchedJob(){
  if(!currentUser){ toast('error','Not Logged In','Log in to create scheduled jobs.'); return; }
  const name=(document.getElementById('sched-name').value||'').trim()||'Untitled Job';
  const interval=parseInt(document.getElementById('sched-interval').value,10)||3600000;
  const email=(document.getElementById('sched-email').value||'').trim();
  const subject=(document.getElementById('sched-subject').value||'').trim()||name;
  const bodyType=document.getElementById('sched-body-type').value;
  const body=(document.getElementById('sched-body').value||'').trim();
  if(!email||!email.includes('@')){ toast('error','Invalid Email','Enter a valid recipient email for the scheduled job.'); return; }
  if(bodyType==='custom' && !body){ toast('error','Empty Message','Enter a custom message body or pick a generated body type.'); return; }
  const job={
    id: uid(), name, interval, email, subject, bodyType, body,
    createdAt: Date.now(), lastRun: 0, nextRun: Date.now()+interval, enabled: true
  };
  const jobs=getSchedJobs(); jobs.push(job); saveSchedJobs(jobs);
  startSchedTimer(job);
  // clear form
  document.getElementById('sched-name').value=''; document.getElementById('sched-email').value='';
  document.getElementById('sched-subject').value=''; document.getElementById('sched-body').value='';
  toast('success','Job Scheduled', name+' will run every '+fmtInterval(interval));
  renderSchedJobs();
}

function fmtInterval(ms){
  if(ms<60000) return Math.round(ms/1000)+'s';
  if(ms<3600000) return Math.round(ms/60000)+' min';
  if(ms<86400000) return Math.round(ms/3600000)+'h';
  if(ms<604800000) return Math.round(ms/86400000)+'d';
  return Math.round(ms/604800000)+'w';
}

/* Build the body text for a job based on its bodyType. */
function buildSchedBody(job){
  if(job.bodyType==='custom' || job.bodyType==='reminder') return job.body||'(no message)';
  if(job.bodyType==='portfolio'){
    let s='📊 Portfolio Snapshot ('+nowStr()+')\n';
    if(realState.connected){
      const net=NETWORKS.find(n=>n.id===realState.selectedNetworkId);
      s+='Network: '+(net?net.name:'unknown')+'\n';
      s+='Wallet: '+shortAddr(realState.address)+'\n';
      s+='Native balance: '+(realState.balance!=null?fmtAmt(realState.balance)+' '+(net?net.symbol:''):'unavailable')+'\n';
    } else {
      s+='Wallet: not connected\n';
    }
    // simulator portfolio
    let simTotal=0;
    simState.wallets.forEach(w=>{ (DEFAULT_TOKENS||[]).forEach(t=>{ simTotal+=(w.balances[t.symbol]||0)*tokenPrice(t.symbol); }); });
    s+='Simulator portfolio value: $'+simTotal.toLocaleString('en-US',{maximumFractionDigits:2})+'\n';
    s+='Simulator wallets: '+simState.wallets.length+'\n';
    return s;
  }
  if(job.bodyType==='txdigest'){
    const hist=getRealTxHistory();
    const since=Date.now()-86400000;
    const recent=hist.filter(t=>{ try{ return new Date(t.time).getTime()>since; }catch(e){ return false; } });
    let s='📋 Transaction Digest — last 24h ('+nowStr()+')\n';
    if(!recent.length){ s+='No transactions in the last 24 hours.\n'; return s; }
    s+=recent.length+' transaction(s):\n';
    recent.forEach(t=>{ s+=' • '+t.amount+' '+(t.symbol||'ETH')+' → '+shortAddr(t.to)+' ('+t.status+')\n'; });
    return s;
  }
  return job.body||'';
}

/* Fire a single scheduled job: sends the email via the unified deliverEmail(). */
async function fireSchedJob(job){
  try{
    const body=buildSchedBody(job);
    const res=await deliverEmail(job.email, job.subject, body, null, {context:'scheduled job: '+job.name});
    job.lastRun=Date.now();
    job.nextRun=Date.now()+job.interval;
    addDeliveryRecord({
      to: job.email, subject: job.subject,
      provider: res&&res.provider?res.provider:(res&&res.primary||'unknown'),
      status: res&&res.ok?'success':'failed',
      detail: 'Scheduled job "'+job.name+'" — '+(res&&res.ok?'delivered':(res&&res.reason||'failed'))
    });
    toast(res&&res.ok?'success':'warning', 'Scheduled: '+job.name, res&&res.ok?('Sent to '+job.email):('Delivery issue — check Email Delivery tab'));
  }catch(e){
    addDeliveryRecord({to:job.email,subject:job.subject,provider:'unknown',status:'failed',detail:'Scheduled job "'+job.name+'" error: '+(e.message||'')});
    toast('error','Scheduled Job Failed', job.name+': '+(e.message||'unknown error'));
  }
  // persist updated run times
  const jobs=getSchedJobs();
  const idx=jobs.findIndex(j=>j.id===job.id);
  if(idx>=0){ jobs[idx]=job; saveSchedJobs(jobs); }
  renderSchedJobs();
}

/* Start (or restart) the interval timer for a job. */
function startSchedTimer(job){
  if(__schedTimers[job.id]){ clearInterval(__schedTimers[job.id]); }
  if(!job.enabled) return;
  __schedTimers[job.id]=setInterval(()=>{ fireSchedJob(job); }, job.interval);
}

/* On app load / login: resume all jobs and catch up missed ones. */
function resumeSchedJobs(){
  // clear all existing timers
  Object.keys(__schedTimers).forEach(k=>{ clearInterval(__schedTimers[k]); delete __schedTimers[k]; });
  const jobs=getSchedJobs();
  const now=Date.now();
  jobs.forEach(job=>{
    if(!job.enabled) return;
    // catch up missed runs (fire once if nextRun has passed)
    if(job.nextRun && job.nextRun < now){
      fireSchedJob(job);
    }
    startSchedTimer(job);
  });
}

/* Stop all timers (on logout). */
function stopSchedJobs(){
  Object.keys(__schedTimers).forEach(k=>{ clearInterval(__schedTimers[k]); delete __schedTimers[k]; });
}

/* Toggle a job on/off. */
function toggleSchedJob(id){
  const jobs=getSchedJobs();
  const job=jobs.find(j=>j.id===id);
  if(!job) return;
  job.enabled=!job.enabled;
  if(job.enabled){ job.nextRun=Date.now()+job.interval; startSchedTimer(job); }
  else{ if(__schedTimers[id]){ clearInterval(__schedTimers[id]); delete __schedTimers[id]; } }
  saveSchedJobs(jobs);
  toast('info', job.enabled?'Job Enabled':'Job Paused', job.name);
  renderSchedJobs();
}

/* Run a job immediately (manual trigger). */
function runSchedJobNow(id){
  const jobs=getSchedJobs();
  const job=jobs.find(j=>j.id===id);
  if(job) fireSchedJob(job);
}

/* Delete a scheduled job. */
function deleteSchedJob(id){
  let jobs=getSchedJobs();
  jobs=jobs.filter(j=>j.id!==id);
  saveSchedJobs(jobs);
  if(__schedTimers[id]){ clearInterval(__schedTimers[id]); delete __schedTimers[id]; }
  toast('info','Job Deleted','Removed from scheduler.');
  renderSchedJobs();
}

/* Render the list of scheduled jobs. */
function renderSchedJobs(){
  const box=document.getElementById('sched-jobs-list');
  if(!box) return;
  const jobs=getSchedJobs();
  if(!jobs.length){
    box.innerHTML='<p style="color:var(--text-muted);font-size:0.82rem;padding:10px 0;">No scheduled jobs yet. Create one above.</p>';
    return;
  }
  let html='';
  jobs.forEach(job=>{
    const lastRunStr=job.lastRun?new Date(job.lastRun).toLocaleString():'never';
    const nextRunStr=job.nextRun?new Date(job.nextRun).toLocaleString():'—';
    html+='<div style="border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px 14px;margin-bottom:10px;background:var(--bg-secondary,#0f1320);">';
    html+='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">';
    html+='<div><div style="font-weight:600;font-size:0.92rem;">'+escHtml(job.name)+'</div>';
    html+='<div style="font-size:0.74rem;color:var(--text-muted);margin-top:3px;">Every '+fmtInterval(job.interval)+' → '+escHtml(job.email)+'</div>';
    html+='<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">Body: '+escHtml(job.bodyType)+' · Last run: '+escHtml(lastRunStr)+' · Next: '+escHtml(nextRunStr)+'</div></div>';
    html+='<div style="display:flex;gap:6px;flex-wrap:wrap;">';
    html+='<button class="btn btn-secondary btn-sm" onclick="runSchedJobNow(\''+job.id+'\')">▶ Run now</button>';
    html+='<button class="btn btn-secondary btn-sm" onclick="toggleSchedJob(\''+job.id+'\')">'+(job.enabled?'⏸ Pause':'▶ Enable')+'</button>';
    html+='<button class="btn btn-danger btn-sm" onclick="deleteSchedJob(\''+job.id+'\')">🗑 Delete</button>';
    html+='</div></div></div>';
  });
  box.innerHTML=html;
}

function loadEmailJSConfig(){
  const cfg=getEmailConfig();
  // provider selector
  const prov=document.getElementById('email-provider');
  if(prov) prov.value = (cfg&&cfg.provider)||'none';
  // emailjs fields
  const svc=document.getElementById('emailjs-service');
  const tpl=document.getElementById('emailjs-template');
  const pk =document.getElementById('emailjs-publickey');
  const fn =document.getElementById('emailjs-fromname');
  const testTo=document.getElementById('emailjs-test-to');
  // web3forms fields
  const w3key=document.getElementById('w3f-access-key');
  const w3owner=document.getElementById('w3f-owner-email');
  if(svc) svc.value = cfg?cfg.serviceId||'':'';
  if(tpl) tpl.value = cfg?cfg.templateId||'':'';
  if(pk)  pk.value  = cfg?cfg.publicKey||'':'';
  if(fn){ const e=document.getElementById('emailjs-fromname'); if(e) e.value=cfg?cfg.fromName||'':''; }
  if(testTo) testTo.value = cfg?cfg.testTo||'':'';
  if(w3key) w3key.value = cfg?cfg.w3fKey||'':'';
  if(w3owner) w3owner.value = cfg?cfg.w3fOwner||'':'';
  toggleProviderFields();
  updateEmailJSStatus();
  renderDeliveryLog();
  // show the current origin in the EmailJS guide so users know what to whitelist
  const hint=document.getElementById('w3-origin-hint');
  if(hint){ try{ hint.textContent=location.origin||'(this site)'; }catch(e){} }
}

/* show/hide field groups based on selected provider */
function toggleProviderFields(){
  const prov=document.getElementById('email-provider');
  const v=(prov&&prov.value)||'none';
  const ej=document.getElementById('emailjs-fields');   if(ej) ej.classList.toggle('hidden', v!=='emailjs');
  const w3=document.getElementById('w3f-fields');       if(w3) w3.classList.toggle('hidden', v!=='web3forms');
  const noneBox=document.getElementById('email-none-box'); if(noneBox) noneBox.classList.toggle('hidden', v!=='none');
}

function isEmailConfigured(){
  const cfg=getEmailConfig();
  if(!cfg) return false;
  if(cfg.provider==='emailjs')  return !!(cfg.serviceId&&cfg.templateId&&cfg.publicKey);
  if(cfg.provider==='web3forms')return !!(cfg.w3fKey);
  return false;
}

function updateEmailJSStatus(){
  const cfg=getEmailConfig();
  const el=document.getElementById('emailjs-config-status');
  let msg;
  if(!cfg||cfg.provider==='none'||(!isEmailConfigured())){
    msg='⚠️ Not configured — notifications will show a preview + a manual email button. Set up Web3Forms (1 key, 1 minute) or EmailJS for automatic delivery.';
  } else if(cfg.provider==='web3forms'){
    msg='✅ Web3Forms configured — a copy of every notification is delivered to your inbox automatically. (EmailJS can reach the recipient directly — see below.)';
  } else if(cfg.provider==='emailjs'){
    msg='✅ EmailJS configured — notifications are sent directly to each recipient\'s inbox automatically.';
  } else { msg='Not configured.'; }
  if(el) el.textContent=msg;
}

function saveEmailJSConfig(){
  const provider=(document.getElementById('email-provider')||{}).value||'none';
  const serviceId=(document.getElementById('emailjs-service')||{}).value||''; (serviceId.trim&&(serviceId=serviceId.trim()));
  const templateId=(document.getElementById('emailjs-template')||{}).value||''; (templateId.trim&&(templateId=templateId.trim()));
  const publicKey=(document.getElementById('emailjs-publickey')||{}).value||''; (publicKey.trim&&(publicKey=publicKey.trim()));
  const fnEl=document.getElementById('emailjs-fromname');
  const fromName=fnEl?fnEl.value.trim():'';
  const testToEl=document.getElementById('emailjs-test-to');
  const testTo=testToEl?testToEl.value.trim():'';
  const w3fKeyEl=document.getElementById('w3f-access-key');
  const w3fKey=w3fKeyEl?w3fKeyEl.value.trim():'';
  const w3fOwnerEl=document.getElementById('w3f-owner-email');
  const w3fOwner=w3fOwnerEl?w3fOwnerEl.value.trim():'';

  const st=document.getElementById('emailjs-status');
  if(provider==='emailjs' && (!serviceId||!templateId||!publicKey)){
    if(st){ st.className='emailjs-status err'; st.textContent='⚠️ Please fill in Service ID, Template ID, and Public Key.'; }
    toast('error','Missing Fields','Fill in all three EmailJS IDs.');
    return;
  }
  if(provider==='web3forms' && !w3fKey){
    if(st){ st.className='emailjs-status err'; st.textContent='⚠️ Please paste your Web3Forms Access Key.'; }
    toast('error','Missing Key','Paste your Web3Forms access key.');
    return;
  }
  saveEmailConfigData({provider,serviceId,templateId,publicKey,fromName,testTo,w3fKey,w3fOwner});
  if(st){ st.className='emailjs-status ok'; st.textContent='✅ Email delivery config saved! Click "Send Test Email" to verify it works.'; }
  updateEmailJSStatus();
  toast('success','Saved','Email delivery config saved.');
}

/* Copy the ready-made EmailJS template to clipboard so the user can paste
   it directly into their EmailJS dashboard template. Fixes the common
   "email received but no content / shows {subject}" issue. */
function copyEmailJSTemplate(){
  const code=document.getElementById('emailjs-template-code');
  if(!code){ toast('error','Not Found','Template code block not found.'); return; }
  const text=code.textContent||code.innerText;
  // Use the Clipboard API if available, fallback to a temp textarea
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(()=>{
      toast('success','Copied!','Paste this into your EmailJS template Content field (HTML toggle ON).');
    }).catch(()=>{
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}
function fallbackCopy(text){
  try{
    const ta=document.createElement('textarea');
    ta.value=text; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    toast('success','Copied!','Paste this into your EmailJS template Content field (HTML toggle ON).');
  }catch(e){
    toast('error','Copy Failed','Could not copy automatically. Select the text manually and copy.');
  }
}

function clearEmailJSConfig(){
  localStorage.removeItem(userKey(K.emailjs));
  ['emailjs-service','emailjs-template','emailjs-publickey','emailjs-fromname','emailjs-test-to','w3f-access-key','w3f-owner-email'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
  const prov=document.getElementById('email-provider'); if(prov) prov.value='none';
  const st=document.getElementById('emailjs-status');
  if(st){ st.className='emailjs-status info'; st.textContent='Email config cleared.'; }
  toggleProviderFields();
  updateEmailJSStatus();
  toast('info','Cleared','Email delivery config removed.');
}

/* ---------- Web3Forms delivery (notification-to-self) ---------- */
async function deliverViaWeb3Forms(accessKey, ownerEmail, subject, textBody, htmlBody){
  if(!accessKey) return {ok:false,reason:'web3forms-no-key'};
  try{
    // Web3Forms default template renders ONLY the {{message}} field in the
    // email body. So we put the FULL content (HTML if available, else text)
    // into `message` so it always shows up. We also send a text-only fallback
    // in a separate field in case the user customised their template.
    var fullBody = htmlBody || textBody || '';
    // If we only have text, wrap it so it's readable in HTML email clients
    if(!htmlBody && textBody){
      fullBody = textBody.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
    }
    const payload={
      access_key:accessKey,
      subject:subject||'SOS WALLETS Notification',
      from_name:(getEmailConfig()&&getEmailConfig().fromName)||'SOS WALLETS',
      // The default Web3Forms template renders {{message}} - put everything here
      message: fullBody,
      // Extra fields in case the user customised their template to use these:
      text_message: textBody||'',
      html_message: htmlBody||'',
      notification_copy:'true',
      app:'SOS WALLETS v3'
    };
    if(ownerEmail) payload.email=ownerEmail; // sets reply-to
    const r=await fetch(WEB3FORMS_API,{
      method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify(payload)
    });
    const data=await r.json().catch(()=>({}));
    if(r.ok && data.success) return {ok:true, provider:'web3forms'};
    let reason=(data&&data.message)||('web3forms-error:'+r.status);
    if(r.status===429) reason='Web3Forms rate limit (429) - too many requests, wait a moment.';
    if(/invalid access key/i.test(reason)) reason='Invalid Web3Forms Access Key - check the key in Email Delivery settings.';
    return {ok:false, reason, raw:JSON.stringify(data), status:r.status};
  }catch(e){ return {ok:false, reason:'network:'+e.message}; }
}

/* ---------- EmailJS delivery (can reach any recipient) ---------- */
async function deliverEmailViaEmailJS(toEmail, subject, textBody, htmlBody){
  const cfg=getEmailConfig();
  if(!cfg||cfg.provider!=='emailjs'||!cfg.serviceId||!cfg.templateId||!cfg.publicKey) return {ok:false,reason:'not-configured'};
  try{
    const r=await fetch(EMAILJS_API,{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        service_id:cfg.serviceId, template_id:cfg.templateId, user_id:cfg.publicKey,
        template_params:{
          // Recipient
          to_email:toEmail, to:toEmail, email:toEmail, recipient:toEmail, recipient_email:toEmail,
          // Sender / from name
          from_name:cfg.fromName||'SOS WALLETS', sender:cfg.fromName||'SOS WALLETS', name:cfg.fromName||'SOS WALLETS',
          // Subject
          subject:subject, title:subject, heading:subject,
          // Plain text body
          message:textBody, text:textBody, body:textBody, content:textBody, text_message:textBody,
          // HTML body - send under multiple names so whatever the template uses, it fills
          html:htmlBody, html_message:htmlBody, html_content:htmlBody, html_body:htmlBody, message_html:htmlBody,
          // Meta
          app:'SOS WALLETS v3', timestamp:new Date().toISOString()
        }
      })
    });
    if(r.ok) return {ok:true, provider:'emailjs'};
    const txt=await r.text();
    let friendly=txt;
    if(r.status===403 && /non-browser/i.test(txt)){
      friendly='EmailJS blocked this request. Go to dashboard.emailjs.com → Account → Security and either (a) enable "Allow API access outside browser" OR (b) add this site\'s domain ('+location.origin+') to the Allowed Domains list.';
    } else if(r.status===403){
      friendly='EmailJS rejected this (403). Check Allowed Domains at dashboard.emailjs.com → Account → Security — add '+location.origin+' to the list.';
    } else if(r.status===404){
      friendly='Template ID not found ('+cfg.templateId+'). Copy the real Template ID (starts with template_) from the EmailJS template Settings tab.';
    } else if(r.status===422){
      friendly='Recipient address issue (422). In your EmailJS template, set "To Email" to {{to_email}} (double braces).';
    } else if(r.status===429){
      friendly='Rate limit hit (429). You may have exceeded EmailJS free tier (200/month). Wait or upgrade.';
    } else if(r.status===401){
      friendly='Invalid Public Key (401). Re-check the Public Key in Email Delivery settings.';
    }
    return {ok:false, reason:'emailjs-error:'+r.status+':'+friendly, raw:txt, status:r.status};
  }catch(e){ return {ok:false, reason:'network:'+e.message}; }
}

/* ============================================================
   UNIFIED DISPATCHER — the heart of the fix.
   Tries primary provider → auto-falls back to Web3Forms → mailto.
   Always returns a structured result + logs to the delivery log.
   ============================================================ */
async function deliverEmail(toEmail, subject, textBody, htmlBody, opts){
  opts=opts||{};
  const cfg=getEmailConfig();
  const attempts=[];
  let result=null;

  // 1) Primary provider
  if(cfg && cfg.provider==='emailjs' && cfg.serviceId && cfg.templateId && cfg.publicKey && toEmail){
    attempts.push('emailjs');
    result=await deliverEmailViaEmailJS(toEmail, subject, textBody, htmlBody);
    if(result.ok){
      addDeliveryRecord({to:toEmail, subject, provider:'emailjs', status:'success', detail:'Delivered to recipient via EmailJS'});
      return Object.assign(result,{primary:'emailjs'});
    }
  }

  // 2) Auto-fallback to Web3Forms (notification-to-self) if a key exists.
  //    This is the safety net: even if EmailJS 403-blocked or wasn't set up,
  //    the owner still gets a copy in their inbox.
  const w3key=cfg&&cfg.w3fKey;
  if(w3key){
    attempts.push('web3forms');
    const w3=await deliverViaWeb3Forms(w3key, cfg&&cfg.w3fOwner, subject, textBody, htmlBody);
    if(w3.ok){
      addDeliveryRecord({
        to:toEmail||'(self)',
        subject,
        provider:'web3forms',
        status: toEmail ? 'fallback-self' : 'self',
        detail: toEmail
          ? 'Primary provider unavailable — a copy was delivered to YOUR inbox via Web3Forms. Forward it to the recipient.'
          : 'Copy delivered to your inbox via Web3Forms.'
      });
      return Object.assign(w3,{primary:'web3forms', fellBack: attempts.length>1, originalError: result&&result.reason});
    }
    // if emailjs also failed, keep the emailjs reason as primary message but record w3f too
    if(!result) result=w3;
  }

  // 3) Nothing delivered automatically
  const reason = result ? result.reason : (cfg&&cfg.provider==='none' ? 'no-provider' : 'not-configured');
  addDeliveryRecord({to:toEmail||'(none)', subject, provider: attempts[0]||'none', status:'failed', detail:reason});
  return {ok:false, reason, attempts, raw: result&&result.raw};
}

/* ---------- Test email ---------- */
async function sendTestEmail(){
  const cfg=getEmailConfig();
  const st=document.getElementById('emailjs-status');
  const to=document.getElementById('emailjs-test-to').value.trim() || (cfg&&cfg.testTo);
  if(!to){ if(st){ st.className='emailjs-status err'; st.textContent='⚠️ Enter a test recipient email above.'; } toast('error','No Recipient','Enter your own email in the test field.'); return; }
  if(!isEmailConfigured()){
    if(st){ st.className='emailjs-status err'; st.textContent='⚠️ Save your email config first (pick a provider + fill the fields).'; }
    toast('error','No Config','Pick a provider and save config first, then test.'); return;
  }
  if(st){ st.className='emailjs-status info'; st.textContent='⏳ Sending test email to '+to+'…'; }
  const fn=(cfg&&cfg.fromName)||'SOS WALLETS';
  const subject='✅ SOS WALLETS — Test Email (delivery working!)';
  const message='Great! Your email delivery setup is working. Real transaction notifications from SOS WALLETS will now be delivered automatically.\n\n— '+fn;
  const html='<div style="font-family:sans-serif;max-width:560px;margin:auto;background:#0a0e17;color:#fff;border-radius:12px;overflow:hidden;border:1px solid #1e2a44"><div style="background:linear-gradient(135deg,#0070f3,#00d4ff);padding:24px 28px"><h2 style="margin:0;color:#fff">⚡ '+fn+'</h2><p style="margin:4px 0 0;color:rgba(255,255,255,0.85)">Test Email — Delivery Connected</p></div><div style="padding:28px"><p style="font-size:16px;line-height:1.6">✅ Your email delivery setup is working!</p><p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.75)">Real transaction notifications will now be delivered automatically — no manual steps needed.</p><div style="margin-top:20px;padding:14px;background:#131a2a;border-radius:8px;font-size:13px;color:rgba(255,255,255,0.6)">Sent to: '+to+'</div></div></div>';
  const res=await deliverEmail(to, subject, message, html, {test:true});
  if(res.ok){
    const who = res.primary==='web3forms' ? 'your inbox via Web3Forms (forward to the recipient if needed)' : to+' via EmailJS';
    if(st){ st.className='emailjs-status ok'; st.textContent='✅ Test email sent to '+who+'! Check your inbox (and spam folder).'; }
    toast('success','Test Email Sent','Delivered via '+(res.primary||'provider')+'. Check your inbox.');
  } else {
    if(st){ st.className='emailjs-status err'; st.textContent='❌ Test failed: '+res.reason; }
    toast('error','Test Failed', res.reason);
  }
}

/* ---------- Diagnostic ---------- */
async function diagnoseEmailJS(){
  const cfg=getEmailConfig();
  const st=document.getElementById('emailjs-status');
  const lines=[];
  lines.push('🔍 Delivery Diagnostic — '+new Date().toLocaleString());
  lines.push('   Provider: '+(cfg?cfg.provider:'(none)'));
  if(!cfg || cfg.provider==='none' || !isEmailConfigured()){
    lines.push('❌ No provider configured.');
    lines.push('   Easiest fix: choose Web3Forms, paste one access key (get it free at');
    lines.push('   https://app.web3forms.com/onboarding/create — no dashboard, works from any site).');
    lines.push('   Or use EmailJS to send directly to each recipient (needs 3 IDs).');
    if(st){ st.className='emailjs-status err'; st.style.whiteSpace='pre-wrap'; st.textContent=lines.join('\n'); }
    toast('error','Config Incomplete','Pick a provider and save config first.');
    return;
  }
  lines.push('   serviceId: '+(cfg.serviceId||'(n/a)'));
  lines.push('   templateId:'+(cfg.templateId||'(n/a)'));
  lines.push('   publicKey: '+(cfg.publicKey||'(n/a)'));
  lines.push('   w3fKey:    '+(cfg.w3fKey?'(set)':'(not set)'));
  lines.push('');
  lines.push('⏳ Sending test request…');
  if(st){ st.className='emailjs-status info'; st.style.whiteSpace='pre-wrap'; st.textContent=lines.join('\n'); }
  const to=cfg.testTo||'cryptonotifywallets@gmail.com';
  const res=await deliverEmail(to,'SOS WALLETS Diagnostic','Diagnostic test.','<p>Diagnostic test.</p>');
  lines.push('');
  if(res.ok){
    lines.push('🎉 SUCCESS via '+(res.primary||'provider')+'!');
    if(res.primary==='web3forms'){
      lines.push('   A copy was delivered to your Web3Forms inbox. To send DIRECTLY to');
      lines.push('   recipients, also configure EmailJS (it can reach any address).');
    } else {
      lines.push('   Email delivered to '+to+'. Check inbox + EmailJS Activity log.');
    }
    if(st){ st.className='emailjs-status ok'; st.style.whiteSpace='pre-wrap'; st.textContent=lines.join('\n'); }
    toast('success','Delivery Working','Test accepted via '+(res.primary||'provider')+'.');
  } else {
    lines.push('❌ FAILED — '+res.reason);
    if(res.raw) lines.push('   Raw: '+res.raw);
    lines.push('');
    lines.push('QUICK FIXES:');
    lines.push('• Easiest: switch to Web3Forms (1 key, no domain restrictions).');
    lines.push('• EmailJS 403: dashboard.emailjs.com → Account → Security → add');
    lines.push('   '+location.origin+' to Allowed Domains (or enable "Allow API outside browser").');
    lines.push('• EmailJS template: To Email → {{to_email}}, Subject → {{subject}},');
    lines.push('   From Name → {{from_name}}, Content → {{html}} (ALL double braces).');
    if(st){ st.className='emailjs-status err'; st.style.whiteSpace='pre-wrap'; st.textContent=lines.join('\n'); }
    toast('error','Delivery Failed', res.reason);
  }
}

/* ---------- Render the in-app delivery log ---------- */
function renderDeliveryLog(){
  const wrap=document.getElementById('delivery-log');
  if(!wrap) return;
  const log=getDeliveryLog();
  if(!log.length){ wrap.innerHTML='<div style="color:var(--text-muted);font-size:0.8rem;padding:8px 0">No notifications delivered yet. Send a transaction or test email to see delivery history here.</div>'; return; }
  const color={success:'#10b981','fallback-self':'#f59e0b',self:'#0ea5e9',failed:'#ef4444'};
  const label={success:'✅ Delivered','fallback-self':'⚠️ Fallback to you',self:'✅ Copy to you',failed:'❌ Failed'};
  wrap.innerHTML=log.slice(0,25).map(r=>{
    const c=color[r.status]||'#888';
    const l=label[r.status]||r.status;
    const d=new Date(r.time);
    return '<div style="border-left:3px solid '+c+';padding:8px 10px;margin-bottom:6px;background:var(--card);border-radius:0 6px 6px 0;font-size:0.78rem">'+
      '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span style="color:'+c+';font-weight:600">'+l+' · '+escHtml(r.provider)+'</span>'+
      '<span style="color:var(--text-muted)">'+d.toLocaleString()+'</span></div>'+
      '<div style="margin-top:4px;color:var(--text)">To: '+escHtml(r.to||'-')+'</div>'+
      '<div style="color:var(--text-muted)">Subject: '+escHtml(r.subject||'-')+'</div>'+
      (r.detail?'<div style="color:var(--text-muted);margin-top:2px;font-size:0.72rem">'+escHtml(r.detail)+'</div>':'')+
    '</div>';
  }).join('');
}
function escHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ============================================================
   RECIPIENT NOTIFICATION — now uses the unified dispatcher
   ============================================================ */
async function sendRecipientNotification({recipient,amount,symbol,from,txHash,network,memo,email,webhook,notifyOnly}){
  const tpl=getTemplate();
  const vars={
    amount, symbol, from, recipient, network,
    memo:memo||'(none)', txHash, time:nowStr(),
    sender:tpl.sender, notifyOnly:!!notifyOnly
  };
  const subject=fillTemplateVars(tpl.subject,vars);
  const body=buildTextEmail(tpl,vars);
  const htmlEmail=buildHtmlEmail(tpl,vars);

  // 1) Webhook dispatch (if provided)
  let webhookOk=false,webhookErr=null;
  if(webhook){try{await fetch(webhook,{method:'POST',headers:{'Content-Type':'application/json'},mode:'no-cors',body:JSON.stringify({event:notifyOnly?'incoming_deposit_alert':'incoming_deposit',recipient,amount,symbol,from,txHash,network,memo,status:notifyOnly?'alert_only_no_tx':'pending',notifyOnly:!!notifyOnly,sender:tpl.sender,timestamp:new Date().toISOString(),subject,message:body,html:htmlEmail})});webhookOk=true;}catch(e){webhookErr=e.message;}}

  // 2) REAL email delivery via the unified dispatcher (auto-fallback)
  let emailResult=null;
  if(email){
    emailResult=await deliverEmail(email, subject, body, htmlEmail);
  }
  let emailLink=null; if(email) emailLink=`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  // 3) Build the in-app preview + status
  const preview=document.getElementById('real-notify-preview'); const content=document.getElementById('real-notify-content');
  const npLabel=preview.querySelector('.np-label');
  if(npLabel) npLabel.textContent=notifyOnly?'🔔 Notification Sent (Notify-Only — no on-chain tx)':'🔔 Notification Sent to Recipient';
  content.innerHTML='';
  const iframe=document.createElement('iframe');
  iframe.style.cssText='width:100%;height:380px;border:1px solid var(--border);border-radius:8px;background:#fff;';
  iframe.srcdoc=htmlEmail;
  content.appendChild(iframe);
  let statusLine=document.createElement('div');
  statusLine.style.cssText='font-size:0.75rem;color:var(--text-muted);margin-top:8px;line-height:1.6;';
  let st='Subject: '+subject+'\n\n';
  if(webhook) st+=webhookOk?'✅ Webhook dispatched to '+webhook+'\n':'⚠️ Webhook failed: '+(webhookErr||'error')+'\n';
  if(email){
    if(emailResult&&emailResult.ok){
      if(emailResult.primary==='emailjs'){
        st+='✅ Email DELIVERED to '+email+' via EmailJS\n';
        toast('success','Email Sent','Notification delivered to '+email);
      } else if(emailResult.primary==='web3forms'){
        st+='✅ A copy of this notification was delivered to YOUR inbox via Web3Forms.\n';
        st+='   Forward it to '+email+' so the recipient is notified.\n';
        st+='   (To send directly to recipients with no forwarding, set up EmailJS in More → Email Delivery.)\n';
        toast('success','Copy Sent To You','Notification copy delivered to your inbox — forward to the recipient.');
      }
    } else if(emailResult && (emailResult.reason==='not-configured'||emailResult.reason==='no-provider')){
      st+='ℹ️ Email not auto-sent — no provider configured. Click below to send manually via your email app.\n';
      st+='  (Quick fix: More → Email Delivery → choose Web3Forms, paste 1 free access key.)\n';
      toast('info','Email Not Configured','Set up a provider in More → Email Delivery to auto-send. A manual email button is shown below.');
    } else if(emailResult){
      st+='⚠️ Auto-delivery failed: '+emailResult.reason+'\n  You can still send manually via the button below.\n';
      st+='  (Tip: Web3Forms needs only 1 key and has no domain restrictions — try it in More → Email Delivery.)\n';
      toast('error','Email Delivery Failed', emailResult.reason);
    }
  } else {
    st+='ℹ️ No recipient email provided — preview only. Add an email above to deliver a real notification.\n';
    toast('info','No Email Address','Add a recipient email in the notify field to send a real email notification.');
  }
  statusLine.textContent=st;
  content.appendChild(statusLine);
  preview.classList.remove('hidden');
  const old=document.getElementById('real-mail-btn'); if(old) old.remove();
  // Show manual mailto button if email provided AND auto-delivery didn't fully reach the recipient
  if(email && !(emailResult&&emailResult.ok&&emailResult.primary==='emailjs')){
    const mb=document.createElement('button');mb.id='real-mail-btn';mb.className='btn btn-cyan';mb.style.marginTop='12px';mb.textContent='✉️ Send Email Manually (opens email app)';mb.onclick=()=>{window.location.href=emailLink;};preview.appendChild(mb);
  }
  renderDeliveryLog();
}

/* ============================================================
   INIT + RENDER
   ============================================================ */
function initSim(){
  if(!simState.wallets.length && !localStorage.getItem(userKey(K.sim))){
    const b1={};TOKENS.forEach(t=>b1[t.symbol]=0);b1.ETH=12.5;b1.BTC=0.5;b1.USDT=5000;b1.SOL=100;
    const b2={};TOKENS.forEach(t=>b2[t.symbol]=0);b2.ETH=3;b2.USDT=1200;b2.SOL=25;
    simState.wallets.push({id:uid(),name:'Demo Wallet #1',address:genAddress(),balances:b1,createdAt:Date.now()});
    simState.wallets.push({id:uid(),name:'Demo Wallet #2',address:genAddress(),balances:b2,createdAt:Date.now()});
    simState.selectedWalletId=simState.wallets[0].id;
    saveAll();
  }
}

function renderAll(){
  renderTokens(); renderWallets(); renderHero(); renderSimTxs(); renderPending(); renderStats(); renderAddrBook(); renderAddrQuick(); renderNotifLog(); renderNetworks(); updateConnUI(); renderRealTxHistory();
}

function init(){
  // load global settings first
  try{settings=Object.assign(settings,JSON.parse(localStorage.getItem(K.set)||'{}'));}catch(e){}
  try{tokenPrices=Object.assign(tokenPrices,JSON.parse(localStorage.getItem(K.prices)||'{}'));}catch(e){}
  applyTheme();
  if(!checkSession()){
    document.getElementById('login-screen').classList.remove('hidden');
  }
}

document.addEventListener('DOMContentLoaded',init);

/* ---------- jsdom test harness helper (no-op in real browsers) ----------
   Exposes top-level function/const declarations onto `window` so that
   automated jsdom tests can call them. In a real browser these are already
   global, so this block is a harmless no-op.                              */
try{
  var __expose=['connectWallet','disconnectWallet','updateConnUI','refreshBalance',
    'selectNetwork','renderNetworks','realSend','notifyOnly',
    'detectInjectedProviders','getWalletOptions','getProvider','openWalletModal',
    'closeWalletModal','connectWithProvider','doConnect','isMobileDevice',
    'scanAddressQR','closeQRScanModal','handleScannedAddress','handleQRFile','showQRFileUpload',
    'estimateGas','getRealTxHistory','saveRealTxHistory','addRealTxRecord',
    'renderRealTxHistory','exportRealTxCSV','makeEthereumProvider',
    'getEmailJSConfig','saveEmailJSConfig','loadEmailJSConfig','clearEmailJSConfig',
    'saveEmailJSConfigData','sendTestEmail','deliverEmailViaEmailJS','updateEmailJSStatus','diagnoseEmailJS',
    'getEmailConfig','saveEmailConfigData','deliverEmail','deliverViaWeb3Forms','isEmailConfigured',
    'toggleProviderFields','getDeliveryLog','addDeliveryRecord','clearDeliveryLog','renderDeliveryLog','escHtml',
    'getSelectedSendToken','renderSendTokenSelect','onSendTokenChange','detectCustomToken','updateAmountLabel',
    'renderTokenBalancePreview','getTokenBalance','ethCall','encodeCall','hexToAscii','keccakHex','toUtf8Bytes','keccak256','sendERC20',
    'loadLivePortfolio','fetchLivePrices',
    'addSchedJob','getSchedJobs','saveSchedJobs','fmtInterval','buildSchedBody','fireSchedJob',
    'startSchedTimer','resumeSchedJobs','stopSchedJobs','toggleSchedJob','runSchedJobNow','deleteSchedJob','renderSchedJobs','copyEmailJSTemplate','fallbackCopy',
    'renderWallets','renderHero','renderStats','renderTokens','renderSimTxs','renderPending',
    'renderAddrBook','renderAddrQuick','renderNotifLog',
    'buildHtmlEmail','buildTextEmail','fillTemplateVars','sendRecipientNotification',
    'applyPreset','renderPresets','populateTemplateForm','renderLogoPreview',
    'setLogoPreset','setLinkPreset','readTemplateFromForm','saveTemplate','resetTemplate',
    'previewTemplate','initTemplateComposer','closeTmplPreview',
    'doRegister','doLogin','logout','toggleTheme','showQR','closeQRModal',
    'switchMode','switchSub','init','uid','fmtAmt','shortAddr','nowStr','toast'];
  for(var i=0;i<__expose.length;i++){ try{ if(typeof eval(__expose[i])!=='undefined'){ (typeof window!=='undefined') && (window[__expose[i]]=eval(__expose[i])); } }catch(e){} }
  var __exposeC=['NETWORKS','DEFAULT_TOKENS','TEMPLATE_PRESETS','LOGO_PRESETS','LINK_PRESETS',
   'WALLET_DEEPLINKS','simState','realState','addrBook','notifLog','settings',
   'notifTemplate','tokenPrices','K','ERC20_TOKENS','ERC20_ABI','COINGECKO_ID_MAP'];
  for(var j=0;j<__exposeC.length;j++){ try{ if(typeof eval(__exposeC[j])!=='undefined'){ (typeof window!=='undefined') && (window[__exposeC[j]]=eval(__exposeC[j])); } }catch(e){} }
  /* Test-only setter for module-scoped currentUser (no-op value in real use). */
  if(typeof window!=='undefined'){ window.__setCurrentUser=function(u){ try{ currentUser=u; }catch(e){}; }; window.__getCurrentUser=function(){ try{ return currentUser; }catch(e){ return null; } }; }
}catch(e){}


