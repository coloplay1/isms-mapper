/* ISMS 條款對照台：不操作畫面的純邏輯（搜尋、建議重點、匯入檢查、備份判斷）。單元測試只測這一層
   以一般 <script> 載入（非 ES module），讓使用者直接用瀏覽器開啟本機檔案也能運作。
   各檔頂層宣告共用同一個全域範圍，載入順序見 index.html。 */
function projFeatures(p){return (p&&p.features)||[]}
function baseFocus(p){const m={};projFeatures(p).forEach(fid=>{const f=FEATURE_MAP[fid];if(f&&f.codes)f.codes.forEach(c=>(m[c]=m[c]||[]).push(fid))});return m}
// 依業務特性產生建議，再套用使用者自行加入（focusOn）與取消（focusOff）的調整
function focusMap(p){const m=baseFocus(p);if(!p)return m;
  (p.focusOff||[]).forEach(c=>delete m[c]);
  (p.focusOn||[]).forEach(c=>{if(!m[c])m[c]=["manual"]});
  return m}

function naCandidates(p){
  const fs=projFeatures(p);if(!p||(!p.industry&&!fs.length))return {};
  const m={};
  if(!fs.includes("dev")){DEV_ONLY.forEach(c=>m[c]="未勾選「自行開發系統」，若組織確實沒有開發活動，可評估排除");
    if(!fs.includes("vendor"))m["A.8.30"]="未勾選自行開發或委外開發，若沒有委外開發活動，可評估排除"}
  return m;
}
function lawsFor(p){const fs=projFeatures(p);return LAWS.filter(l=>(l.when.f&&fs.includes(l.when.f))||(l.when.i&&l.when.i.includes(p&&p.industry)))}

function uid(){return "p"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function blankProject(name,org){
  const now = Date.now();
  return {id:uid(),name,org:org||"",created:now,updated:now,controls:{},clauses:{}};
}

const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

/* 備份提醒：資料只存在瀏覽器，清除瀏覽資料就會消失 */
const BACKUP_DAYS=7, BACKUP_CHANGES=30;
function backupDue(p){
  if(!p||p.sample)return false;
  const n=p.changesSinceBackup||0; if(n===0)return false;
  if(p.backupSnoozeUntil&&Date.now()<p.backupSnoozeUntil)return false;
  if(!p.lastBackupAt)return n>=10;
  return n>=BACKUP_CHANGES||(Date.now()-p.lastBackupAt)>BACKUP_DAYS*864e5;
}

function safeName(s){return s.replace(/[\\/:*?"<>|（）()]/g,"").replace(/\s+/g,"_").slice(0,40)||"專案"}

/* ================= SEARCH ================= */
function norm(s){return String(s).toLowerCase().replace(/\s+/g," ").trim()}
function expand(q){
  const nq=norm(q); const terms=new Set(nq.split(/[\s,，、;；/]+/).filter(Boolean));
  SYN.forEach(g=>{if(g.some(w=>nq.includes(norm(w)))) g.forEach(w=>terms.add(norm(w)))});
  return {nq,terms:[...terms]};
}
function search(q){
  const {nq,terms}=expand(q); if(!nq) return {cases:[],refs:[],direct:[]};
  const scored=CASES.map(c=>{
    let sc=0; const hit=new Set();
    c.k.forEach(k=>{const nk=norm(k);
      if(nq.includes(nk)){sc+=4;hit.add(k)}
      else if(terms.some(t=>t===nk||(t.length>=2&&nk.includes(t))||(nk.length>=2&&t.includes(nk)))){sc+=2;hit.add(k)}});
    const hay=norm(c.t+" "+c.s);
    terms.forEach(t=>{if(t.length>=2&&hay.includes(t))sc+=1});
    return {c,sc,hit:[...hit]};
  }).filter(x=>x.sc>0).sort((a,b)=>b.sc-a.sc);
  const w={};
  scored.forEach((x,i)=>x.c.r.forEach((code,j)=>{w[code]=(w[code]||0)+x.sc*(j===0?1.5:1)/(1+i*0.15)}));
  const refs=Object.entries(w).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const max=refs.length?refs[0][1]:1;
  // direct match on control code or name
  const codeQ=nq.replace(/^a\.?/,"");
  const direct=[...ANNEX.filter(c=>c.code.toLowerCase()==="a."+codeQ||c.code.toLowerCase()===nq||terms.some(t=>t.length>=2&&norm(c.name).includes(t))),
    ...CLAUSES.filter(c=>c.code===codeQ||terms.some(t=>t.length>=2&&norm(c.name).includes(t)))].slice(0,8).map(c=>c.code);
  return {cases:scored.slice(0,12),refs:refs.map(([code,v])=>({code,pct:Math.round(v/max*100)})),direct};
}

/* 匯入專案檔：限制大小、檢查結構、只保留已知欄位並轉成字串，避免格式錯誤或惡意內容寫進資料 */
const MAX_IMPORT_BYTES=5*1024*1024;
const str=(v,max=500)=>typeof v==="string"?v.slice(0,max):(typeof v==="number"&&isFinite(v)?String(v):"");
const isObj=o=>o!==null&&typeof o==="object"&&!Array.isArray(o);
const CODE_OK=new Set([...ANNEX.map(c=>c.code),...CLAUSES.map(c=>c.code)]);
function sanitizeProject(raw){
  if(!isObj(raw)||!isObj(raw.controls))throw new Error("缺少 controls");
  const p=blankProject(str(raw.name,120)||"匯入專案",str(raw.org,120));
  p.scope=str(raw.scope,300);
  p.industry=INDUSTRY_MAP[raw.industry]?raw.industry:"";
  p.features=Array.isArray(raw.features)?raw.features.filter(x=>FEATURE_MAP[x]&&x!=="manual"):[];
  p.focusOn=Array.isArray(raw.focusOn)?raw.focusOn.filter(c=>ANNEX_MAP[c]):[];
  p.focusOff=Array.isArray(raw.focusOff)?raw.focusOff.filter(c=>ANNEX_MAP[c]):[];
  p.people=Array.isArray(raw.people)?[...new Set(raw.people.map(x=>str(x,60).trim()).filter(Boolean))].slice(0,500):[];
  p.reasons=Array.isArray(raw.reasons)?[...new Set(raw.reasons.map(x=>str(x,200).trim()).filter(Boolean))].slice(0,200):[];
  const st=v=>{const n=Number(v);return Number.isInteger(n)&&n>=0&&n<=3?n:0};
  for(const [code,v] of Object.entries(raw.controls)){ if(!ANNEX_MAP[code]||!isObj(v))continue;
    p.controls[code]={app:["","Y","N"].includes(v.app)?v.app:"",status:st(v.status),owner:str(v.owner,60),evidence:str(v.evidence,300),reason:str(v.reason,500)} }
  if(isObj(raw.clauses))for(const [code,v] of Object.entries(raw.clauses)){ if(!CLAUSE_MAP[code]||!isObj(v))continue;
    p.clauses[code]={status:st(v.status),owner:str(v.owner,60),evidence:str(v.evidence,300)} }
  p.log=Array.isArray(raw.log)?raw.log.filter(e=>isObj(e)&&CODE_OK.has(e.c)&&FIELD_LABEL[e.f]).slice(-3000)
    .map(e=>({t:Number(e.t)||0,c:e.c,f:e.f,from:typeof e.from==="number"||typeof e.from==="boolean"?e.from:str(e.from,500),to:typeof e.to==="number"||typeof e.to==="boolean"?e.to:str(e.to,500)})):[];
  p.lastBackupAt=Date.now();p.changesSinceBackup=0;
  return p;
}

function missingReason(v){return v.app==="N"&&!String(v.reason||"").trim()}

const splitReasons=v=>String(v||"").split(/[；;]/).map(x=>x.trim()).filter(Boolean);
