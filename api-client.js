/* ============================================================
   SOS WALLETS — Backend API Client
   ------------------------------------------------------------
   Connects the frontend to the backend server. Handles:
   - User auth (register / login / forgot / reset) with JWT
   - Data sync (wallet data, address book, templates, etc.)
   - Email delivery via the server (no EmailJS/Web3Forms needed)
   - Transaction log sync

   The backend URL is auto-detected or configurable by the user
   in Settings. Falls back to client-only mode if no backend.
   ============================================================ */

var BACKEND_API = (function(){

  // Try to auto-detect the backend URL. If the frontend is served by the
  // backend itself (same origin), use ''. Otherwise, let the user set it.
  var baseUrl = '';

  function detectBackendUrl(){
    // If we're on a custom port that's NOT a static host, assume same origin
    // Check localStorage for a manually set backend URL first
    var stored = localStorage.getItem('nw_backend_url');
    if(stored){ baseUrl = stored; return; }
    // Default: same origin as the page (backend serves frontend too)
    baseUrl = '';
  }

  function getBaseUrl(){
    if(!baseUrl) detectBackendUrl();
    return baseUrl;
  }

  function setBaseUrl(url){
    baseUrl = url || '';
    if(url) localStorage.setItem('nw_backend_url', url);
    else localStorage.removeItem('nw_backend_url');
  }

  function getToken(){
    return localStorage.getItem('nw_backend_token') || '';
  }
  function setToken(t){
    if(t) localStorage.setItem('nw_backend_token', t);
    else localStorage.removeItem('nw_backend_token');
  }

  function authHeaders(){
    var t = getToken();
    return t ? { 'Content-Type':'application/json', 'Authorization':'Bearer '+t }
             : { 'Content-Type':'application/json' };
  }

  async function request(method, path, body){
    var url = getBaseUrl() + path;
    var opts = { method: method, headers: authHeaders() };
    if(body) opts.body = JSON.stringify(body);
    try{
      var r = await fetch(url, opts);
      var data = await r.json().catch(()=>({}));
      if(r.status === 401){ setToken(''); }
      return data;
    }catch(e){
      return { ok:false, error:'Network error: '+e.message };
    }
  }

  /* ---------- Auth ---------- */
  async function register(name, email, password){
    var r = await request('POST','/api/auth/register',{name,email,password});
    if(r.ok && r.token) setToken(r.token);
    return r;
  }

  async function login(email, password){
    var r = await request('POST','/api/auth/login',{email,password});
    if(r.ok && r.token) setToken(r.token);
    return r;
  }

  async function me(){
    return request('GET','/api/auth/me');
  }

  async function forgotPassword(email){
    return request('POST','/api/auth/forgot',{email});
  }

  async function resetPassword(emailOrToken, newPassword){
    // If it looks like a hex token, send as token; else as email
    if(/^[a-f0-9]{32,}$/.test(emailOrToken)){
      return request('POST','/api/auth/reset',{token:emailOrToken, newPassword});
    }
    return request('POST','/api/auth/reset',{email:emailOrToken, newPassword});
  }

  function logout(){
    setToken('');
  }

  function isLoggedIn(){
    return !!getToken();
  }

  /* ---------- Data Sync ---------- */
  async function getData(key){
    return request('GET','/api/data/'+encodeURIComponent(key));
  }
  async function saveData(key, value){
    return request('PUT','/api/data/'+encodeURIComponent(key), {value});
  }
  async function getAllData(){
    return request('GET','/api/data');
  }
  async function bulkSaveData(dataObj){
    return request('POST','/api/data/bulk', {data:dataObj});
  }

  /* ---------- Transaction Log ---------- */
  async function saveTx(tx){
    return request('POST','/api/tx', tx);
  }
  async function getTxLog(){
    return request('GET','/api/tx');
  }

  /* ---------- Email ---------- */
  async function sendEmail(to, subject, text, html){
    return request('POST','/api/email/send', {to, subject, text, html});
  }
  async function sendTestEmail(to){
    return request('POST','/api/email/test', {to});
  }
  async function getEmailLog(){
    return request('GET','/api/email/log');
  }

  /* ---------- Health ---------- */
  async function checkHealth(){
    return request('GET','/api/health');
  }

  return {
    detectBackendUrl, getBaseUrl, setBaseUrl,
    getToken, setToken, isLoggedIn, logout,
    register, login, me, forgotPassword, resetPassword,
    getData, saveData, getAllData, bulkSaveData,
    saveTx, getTxLog,
    sendEmail, sendTestEmail, getEmailLog,
    checkHealth
  };
})();
