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
  const seen=new Set();
  p.risks=Array.isArray(raw.risks)?raw.risks.slice(0,500).map(sanitizeRisk).filter(r=>r&&!seen.has(r.id)&&seen.add(r.id)):[];
  p.riskAccept=riskAccept(raw);
  p.lastBackupAt=Date.now();p.changesSinceBackup=0;
  return p;
}

function missingReason(v){return v.app==="N"&&!String(v.reason||"").trim()}

const splitReasons=v=>String(v||"").split(/[；;]/).map(x=>x.trim()).filter(Boolean);

/* ================= 風險評鑑（6.1.2）與風險處理（6.1.3） =================
   風險分數 = 可能性 × 衝擊（各 1–5 級）。分數小於等於「可接受水準」的風險可以接受，
   高於的要處理，處理後的殘餘風險仍高於水準時，需要風險擁有者核准（6.1.3 f）。
   風險選定的控制措施會連動到 SoA：被風險引用的控制措施不應判為不適用。 */
const LIKELIHOOD=["","幾乎不會","不太可能","可能","很可能","幾乎確定"];
const IMPACT=["","輕微","小","中等","嚴重","災難性"];
const RISK_LEVELS=[{id:"low",label:"低",min:1,max:4},{id:"mid",label:"中",min:5,max:9},{id:"high",label:"高",min:10,max:14},{id:"crit",label:"極高",min:15,max:25}];
const ACCEPT_OPTIONS=[4,9];
const TREATMENTS=[{v:"",label:"未決定"},{v:"mitigate",label:"降低"},{v:"accept",label:"接受"},{v:"transfer",label:"移轉"},{v:"avoid",label:"避免"}];
const TREAT_HINT={mitigate:"採取控制措施降低可能性或衝擊",accept:"在可接受水準內，或經核准承擔",transfer:"以保險、契約或委外分擔",avoid:"停止或改變造成風險的活動"};
const RISK_REASON=REASONS_IN[0];
function riskScore(l,i){l=Number(l);i=Number(i);return Number.isInteger(l)&&Number.isInteger(i)&&l>=1&&l<=5&&i>=1&&i<=5?l*i:0}
function riskLevel(score){return RISK_LEVELS.find(x=>score>=x.min&&score<=x.max)||null}
function riskAccept(p){const n=p?Number(p.riskAccept):NaN;return ACCEPT_OPTIONS.includes(n)?n:ACCEPT_OPTIONS[0]}
function inherentScore(r){return riskScore(r.l,r.i)}
function residualScore(r){return riskScore(r.rl,r.ri)}
/* 判斷是否還要追的風險：決定採用的分數是殘餘（有評估時）或固有 */
function effectiveScore(r){return residualScore(r)||inherentScore(r)}
function blankRisk(id){return {id,title:"",asset:"",threat:"",cia:"",owner:"",l:0,i:0,treat:"",controls:[],plan:"",due:"",rl:0,ri:0,accepted:false}}
function nextRiskId(p){
  const n=Math.max(0,...((p&&p.risks)||[]).map(r=>Number(String(r.id).replace(/^R-/,""))||0));
  return "R-"+String(n+1).padStart(3,"0");
}
/* 控制措施 → 引用它的風險編號 */
function risksByControl(p){
  const m={};((p&&p.risks)||[]).forEach(r=>(r.controls||[]).forEach(c=>{(m[c]=m[c]||[]).includes(r.id)||m[c].push(r.id)}));
  return m;
}
/* 連動檢查：回傳 {sev:"err"|"warn"|"info", kind, rid?, code?, msg} 陣列。只提出問題，不自動修改。 */
function riskChecks(p){
  const out=[];if(!p)return out;
  const acc=riskAccept(p), risks=p.risks||[];
  const app=code=>((p.controls||{})[code]||{}).app||"";
  for(const r of risks){
    const tag=`${r.id}${r.title?"「"+r.title+"」":""}`;
    const s=inherentScore(r), rs=residualScore(r);
    if(!String(r.owner||"").trim())out.push({sev:"warn",kind:"noOwner",rid:r.id,msg:`${tag} 尚未指定風險擁有者`});
    if(!s){out.push({sev:"warn",kind:"noScore",rid:r.id,msg:`${tag} 尚未評估可能性與衝擊`});continue}
    if(!r.treat){if(s>acc)out.push({sev:"warn",kind:"noTreat",rid:r.id,msg:`${tag} 高於可接受水準，尚未決定處理方式`});}
    else if(r.treat==="mitigate"){
      if(!(r.controls||[]).length)out.push({sev:"warn",kind:"noControl",rid:r.id,msg:`${tag} 選擇降低風險，但沒有選定控制措施`});
      else if(!rs)out.push({sev:"warn",kind:"noResidual",rid:r.id,msg:`${tag} 尚未評估處理後的殘餘風險`});
    }
    const eff=r.treat==="accept"?s:rs;
    if(r.treat&&r.treat!=="avoid"&&eff>acc&&!r.accepted)out.push({sev:"warn",kind:"needApproval",rid:r.id,msg:`${tag} ${r.treat==="accept"?"":"殘餘"}風險 ${eff} 分高於可接受水準 ${acc} 分，需風險擁有者核准`});
    for(const c of r.controls||[]){
      if(app(c)==="N")out.push({sev:"err",kind:"conflict",rid:r.id,code:c,msg:`${r.id} 以 ${c} 處理風險，但 SoA 判為不適用`});
      else if(app(c)==="")out.push({sev:"warn",kind:"undecided",rid:r.id,code:c,msg:`${r.id} 以 ${c} 處理風險，SoA 尚未判定適用性`});
    }
  }
  const byC=risksByControl(p);
  for(const [code,v] of Object.entries(p.controls||{})){
    if(v.app==="Y"&&String(v.reason||"").includes(RISK_REASON)&&!byC[code])
      out.push({sev:"info",kind:"orphan",code,msg:`${code} 的納入理由是風險評鑑結果，但沒有任何風險引用它`});
  }
  const rank={err:0,warn:1,info:2};
  return out.sort((a,b)=>rank[a.sev]-rank[b.sev]);
}
function sanitizeRisk(raw){
  if(!isObj(raw))return null;
  const id=/^R-\d{1,4}$/.test(raw.id)?raw.id:null; if(!id)return null;
  const lv=v=>{const n=Number(v);return Number.isInteger(n)&&n>=0&&n<=5?n:0};
  const r=blankRisk(id);
  r.title=str(raw.title,120);r.asset=str(raw.asset,120);r.threat=str(raw.threat,500);r.owner=str(raw.owner,60);r.plan=str(raw.plan,500);
  r.cia=[..."CIA"].filter(x=>String(raw.cia||"").includes(x)).join("");
  r.l=lv(raw.l);r.i=lv(raw.i);r.rl=lv(raw.rl);r.ri=lv(raw.ri);
  r.treat=TREATMENTS.some(t=>t.v===raw.treat)?raw.treat:"";
  r.controls=Array.isArray(raw.controls)?[...new Set(raw.controls.filter(c=>ANNEX_MAP[c]))]:[];
  r.due=/^\d{4}-\d{2}-\d{2}$/.test(raw.due)?raw.due:"";
  r.accepted=raw.accepted===true;
  return r;
}
