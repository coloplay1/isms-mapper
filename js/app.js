/* ISMS 條款對照台：畫面、事件與儲存
   以一般 <script> 載入（非 ES module），讓使用者直接用瀏覽器開啟本機檔案也能運作。
   各檔頂層宣告共用同一個全域範圍，載入順序見 index.html。 */
"use strict";

function toggleFocus(code,silent){
  const p=cur();if(!p)return;const was=!!FM[code];
  const on=new Set(p.focusOn||[]),off=new Set(p.focusOff||[]),base=baseFocus(p);
  if(FM[code]){ if(on.has(code))on.delete(code); else if(base[code])off.add(code); }
  else { if(off.has(code))off.delete(code); else on.add(code); }
  p.focusOn=[...on];p.focusOff=[...off];
  logChange(code,"focus",was,!was);save();refreshFocus();
  if(!silent)undoToast(FM[code]?`已將 ${code} 標為重點`:`已取消 ${code} 的重點標示`,()=>toggleFocus(code,true));
  if($("#drawerHost").innerHTML)openDrawer(code,!!lastList);
  if(tab==="annex")renderAnnexRows();
  else if(tab==="overview")renderOverview();
}
function resetFocus(){const p=cur();if(!p)return;p.focusOn=[];p.focusOff=[];save();refreshFocus();render();toast("已恢復預設建議")}
document.addEventListener("click",e=>{const t=e.target.closest("[data-ftoggle]");if(t){e.preventDefault();e.stopPropagation();toggleFocus(t.dataset.ftoggle)}
  if(e.target.closest("[data-freset]"))resetFocus()},true);
let FM={},NAC={},RBC={};   // 建議重點、可能不適用、控制措施 → 風險編號（render 時更新）
function refreshFocus(){const p=cur();FM=focusMap(p);NAC=naCandidates(p);RBC=risksByControl(p)}
function featureChips(selected,name){
  return FEATURES.map(f=>`<label class="fchip"><input type="checkbox" name="${name}" value="${f.id}" ${selected.includes(f.id)?"checked":""}><span>${esc(f.label)}</span></label>`).join("");
}
function industryOptions(sel){return INDUSTRIES.map(i=>`<option value="${i.id}" ${i.id===sel?"selected":""}>${esc(i.label)}</option>`).join("")}
function wireIndustry(root,selId,name,countId){
  const sel=root.querySelector("#"+selId);
  const upd=()=>{if(!countId)return;const fs=[...root.querySelectorAll(`input[name="${name}"]:checked`)].map(x=>x.value);
    const n=Object.keys(focusMap({features:fs})).length;const el=root.querySelector("#"+countId);if(el)el.textContent=n?`會標示 ${n} 項建議重點`:"不選也可以，之後在「專案管理」修改"};
  sel.addEventListener("change",()=>{const ind=INDUSTRY_MAP[sel.value];root.querySelectorAll(`input[name="${name}"]`).forEach(cb=>cb.checked=ind.features.includes(cb.value));upd()});
  root.querySelectorAll(`input[name="${name}"]`).forEach(cb=>cb.addEventListener("change",upd));upd();
}
const readFeatures=(root,name)=>[...root.querySelectorAll(`input[name="${name}"]:checked`)].map(x=>x.value);


/* ================= STATE & STORAGE ================= */
const KEY = "isms-mapper-v1";
let storeOK = true;
const SAMPLE_DEFS=[
  {id:"sample:intro",ind:"health",stageId:"intro",stage:"導入初期",name:"綠葉聯合診所",industry:"health",features:["pii","health","vendor","onprem"],desc:"剛決定導入 ISMS，正在訂定範圍與政策。大部分控制措施還沒判定適用性，負責人也還沒分派。",
   seed:3,undec:.6,cum:[.72,.95,1,1],owners:["資訊組 黃組長","行政組 吳專員","行政組 吳專員","資訊組 黃組長"],ownerFrom:1,
   na:["A.8.25","A.8.26","A.8.27","A.8.28","A.8.29","A.8.30","A.8.4","A.8.31","A.8.33"],naReason:"診所未自行開發系統，皆採購套裝軟體",
   cl:i=>i<4?1:i===5?2:0,scope:"診所門診與病歷資訊系統",
   risks:[[29,"病歷系統","C",-1,4,5,"",0,0,false,""],[6,"病歷資料庫","A",0,0,0,"",0,0,false,""]]},
  {id:"sample:build",ind:"general",stageId:"build",stage:"建置中",name:"示範科技",industry:"general",features:["cloud","remote","vendor","onprem"],desc:"適用性聲明大致完成，各部門正在落實控制措施，邊做邊整理紀錄與證據。",
   seed:7,undec:.08,cum:[.18,.4,.73,1],owners:["資訊部 王經理","人資部 林專員","總務部 陳課長","研發部 張主任"],ownerFrom:0,
   na:["A.8.30","A.8.4","A.7.12","A.8.28"],naReason:"範圍內無自行開發系統",
   cl:i=>i<12?3:i<20?2:i<23?1:0,scope:"台北總部資訊機房與核心營運系統",
   // [案例編號, 資產, CIA, 擁有者, 可能性, 衝擊, 處理, 殘餘可能性, 殘餘衝擊, 已核准, 處理計畫]
   risks:[[0,"CRM 與 AD 帳號","C",1,4,3,"mitigate",2,3,false,"人資離職單串接資訊部，最後工作日停用帳號"],
     [10,"檔案伺服器與 ERP","IA",0,3,5,"mitigate",2,4,true,"導入離線備份與 EDR，每季還原演練"],
     [23,"ERP 系統","CIA",0,3,4,"mitigate",0,0,false,"廠商遠端連線改經跳板機並全程錄影"],
     [14,"業務筆電","C",0,3,3,"mitigate",1,3,true,"全面啟用 BitLocker 與遠端抹除"],
     [24,"Microsoft 365","CIA",0,2,4,"mitigate",2,2,true,"啟用條件式存取與稽核紀錄"],
     [19,"台北機房","A",2,2,2,"accept",0,0,false,""]]},
  {id:"sample:audit",ind:"mfg",stageId:"audit",stage:"驗證稽核前",name:"北辰精密製造",industry:"mfg",features:["ot","onprem","vendor","remote"],desc:"內部稽核與管理審查已完成，正在補齊最後幾項證據，準備迎接第三方驗證稽核。",
   seed:11,undec:0,cum:[0,.04,.3,1],owners:["資訊處 周處長","人資處 許經理","廠務課 蔡課長","研發處 鄭經理","稽核室 何稽核"],ownerFrom:0,
   na:["A.8.30","A.7.12","A.8.11"],naReason:"經風險評鑑判定不適用",
   cl:i=>i===24?2:3,scope:"台中廠區生產管理系統與總部 IT",criteria:"three",
   doc:{no:"NC-ISMS-D-01",ver:"2.0",date:"2026/10/01",author:"資訊處 周處長",reviewer:"稽核室 何稽核",approver:"總經理 林董",approvedAt:"2026/10/05",status:"已核准"},
   risks:[[10,"生產管理系統與檔案伺服器","IA",0,3,5,"mitigate",1,4,true,"OT 與 IT 網段隔離、離線備份、EDR"],
     [23,"產線設備與 MES","CIA",2,4,4,"mitigate",2,3,true,"設備商遠端維護改用一次性帳號並錄影"],
     [11,"全體員工信箱","CI",1,4,3,"mitigate",2,3,true,"每季社交工程演練與郵件過濾"],
     [0,"AD 與 ERP 帳號","C",1,3,3,"mitigate",1,3,true,"離職流程表單化，每月帳號清查"],
     [33,"廠區防火牆","IA",0,2,4,"mitigate",1,4,true,"規則變更須申請與覆核"],
     [19,"台中廠機房","A",2,2,5,"mitigate",1,5,true,"UPS 擴充與發電機每月測試"],
     [27,"研發測試環境","C",3,3,4,"mitigate",1,4,true,"測試資料去識別化"],
     [16,"報廢設備","C",2,2,2,"accept",0,0,true,""]]}
];
/* ---------- 依產業產生其餘範例：每個產業三家虛構公司，對應三個導入階段 ---------- */
const SAMPLE_STAGES={
  intro:{stage:"導入初期",seed:3,undec:.6,cum:[.72,.95,1,1],ownerFrom:1,cl:i=>i<4?1:i===5?2:0,criteria:"four",
    desc:"剛決定導入 ISMS，正在訂定範圍與政策。大部分控制措施還沒判定適用性，風險評鑑剛開始。",
    risks:[[4,5,"",0,0,false,-1],[0,0,"",0,0,false,0]]},
  build:{stage:"建置中",seed:7,undec:.08,cum:[.18,.4,.73,1],ownerFrom:0,cl:i=>i<12?3:i<20?2:i<23?1:0,criteria:"four",
    desc:"適用性聲明大致完成，各部門正在落實控制措施，風險處理計畫還有幾項待完成。",
    risks:[[4,3,"mitigate",2,3,false],[3,5,"mitigate",2,4,true],[3,4,"mitigate",0,0,false],[3,3,"mitigate",1,3,true],[2,4,"mitigate",2,2,true],[2,2,"accept",0,0,false]]},
  audit:{stage:"驗證稽核前",seed:11,undec:0,cum:[0,.04,.3,1],ownerFrom:0,cl:i=>i===24?2:3,criteria:"three",
    desc:"內部稽核與管理審查已完成，風險都已處理並經擁有者核准，正在準備第三方驗證稽核。",
    risks:[[3,5,"mitigate",1,4,true],[4,4,"mitigate",2,3,true],[4,3,"mitigate",2,3,true],[3,3,"mitigate",1,3,true],[2,4,"mitigate",1,4,true],[2,5,"mitigate",1,5,true],[3,4,"mitigate",1,4,true],[2,2,"accept",0,0,true]]}
};
/* 公司名稱皆為虛構；[導入初期, 建置中, 驗證稽核前]，已有的三家沿用原本的範例 */
const SAMPLE_COMPANIES={
  general:{cos:["晨光商務顧問",null,"遠揚國際貿易"],scope:"總部辦公室與資訊系統",depts:["資訊組","人資部","總務部","業務部","稽核室"]},
  ecom:{cos:["好物選物網","樂購生活電商","星禾購物"],scope:"電商平台、會員資料與訂單作業",depts:["技術部","人資部","營運部","產品開發部","稽核室"]},
  saas:{cos:["雲橋軟體","青嵐雲端服務","數衡科技"],scope:"雲端服務平台與研發環境",depts:["維運部","人資部","行政部","研發部","資安室"]},
  finance:{cos:["長青保險經紀","晴川投資顧問","穩泰融資租賃"],scope:"總公司資訊系統與客戶資料作業",depts:["資訊處","人資處","總務處","業務處","稽核處"]},
  health:{cos:[null,"康寧復健科診所","和光醫院"],scope:"門診、病歷與醫療資訊系統",depts:["資訊室","人事室","總務室","醫務室","品管室"]},
  mfg:{cos:["宏鈞精密模具","鋒群電子",null],scope:"廠區生產管理系統與總部 IT",depts:["資訊課","人資課","廠務課","研發部","稽核室"]},
  gov:{cos:["青松資訊服務","市立示範圖書館","濱海水務"],scope:"受委託維運之資訊系統與機房",depts:["資訊科","人事室","秘書室","系統開發科","政風室"]},
  edu:{cos:["晨曦補習班","啟明實驗高中","示範大學推廣教育部"],scope:"學員資料、線上課程與行政系統",depts:["資訊組","人事室","總務處","教務處","稽核室"]},
  lab:{cos:["澄川環境檢驗","青嶺環境分析","瑞昇檢測科技"],scope:"檢驗室、檢測數據與報告作業系統",depts:["資訊組","人事組","總務組","檢驗部","品保室"]}
};
const SAMPLE_NAMES=["王","林","陳","張","黃"],SAMPLE_TITLES=["主任","專員","組長","經理","稽核"];
/* 依業務特性挑選風險情境：[案例標題, 資產, CIA] */
const SAMPLE_RISK_POOLS={
  pii:[["客戶個資外洩","客戶／會員個資","C"],["郵件誤寄給錯誤的收件人","客戶資料郵件","C"]],
  payment:[["網站被入侵或首頁遭置換","官網與交易系統","CIA"],["網站遭 DDoS 阻斷服務攻擊","線上交易服務","A"]],
  dev:[["程式上線與系統變更","正式系統","IA"],["API 金鑰或密碼被上傳到 GitHub","雲端服務金鑰","C"]],
  cloud:[["導入雲端服務","雲端服務","CIA"],["雲端分享連結設為「任何人可檢視」","雲端文件","C"]],
  remote:[["在家遠距工作","遠端存取環境","C"],["遠端桌面直接開放到網際網路","對外伺服器","CIA"]],
  vendor:[["委外廠商遠端維護系統","委外維護的系統","CIA"],["定期評估供應商資安","主要供應商","CIA"]],
  ci:[["發生資安事件要通報","資安事件通報作業","I"],["法規遵循（資通安全管理法、個資法）","法規遵循","I"]],
  listed:[["發生資安事件要通報","重大資安事件與重大訊息","I"],["員工點擊釣魚郵件","全體員工信箱","CI"]],
  health:[["客戶個資外洩","病歷與病患資料","C"]],
  finance:[["假冒主管或廠商要求變更匯款帳戶","付款作業","I"],["帳號遭暴力破解攻擊","客戶線上帳戶","C"]],
  lab:[["檢測數據遭誤改或刪除","LIMS 與檢測原始數據","I"],["儀器電腦作業系統過舊無法更新","分析儀器電腦","IA"],["檢測報告寄錯客戶","檢測報告","C"],["現場採樣紀錄遺失或補登","現場採樣紀錄","IA"]],
  ot:[["駭客入侵內網並橫向移動","產線與 OT 網路","IA"],["設備送修或廠商到場維修","產線設備","C"]],
  onprem:[["機房漏水或火災","機房","A"],["極端氣候（颱風、豪雨、高溫）影響營運","辦公室與機房","A"],["系統容量不足或硬碟空間爆滿","伺服器儲存空間","A"]],
  base:[["員工離職，帳號未即時停用","各系統帳號","C"],["電腦遭勒索軟體加密","檔案伺服器與核心系統","IA"],["員工點擊釣魚郵件","全體員工信箱","CI"],
    ["筆電遺失或遭竊","行動筆電","C"],["備份還原測試","核心資料備份","A"],["機房停電、UPS 與空調","機房與網路設備","A"]]
};
function genSampleDef(ind,stageId,name){
  const st=SAMPLE_STAGES[stageId],co=SAMPLE_COMPANIES[ind],feats=INDUSTRY_MAP[ind].features;
  const owners=co.depts.map((d,k)=>`${d} ${SAMPLE_NAMES[k]}${SAMPLE_TITLES[k]}`);
  const na=feats.includes("dev")?[]:[...DEV_ONLY,...(feats.includes("vendor")?[]:["A.8.30"])];
  if(!feats.includes("onprem")&&!feats.includes("ot"))na.push("A.7.12");
  const pool=[],seen=new Set();
  [...feats.flatMap(f=>SAMPLE_RISK_POOLS[f]||[]),...SAMPLE_RISK_POOLS.base].forEach(x=>{if(!seen.has(x[0])&&CASES.some(c=>c.t===x[0])){seen.add(x[0]);pool.push(x)}});
  const risks=st.risks.map((r,k)=>{const [title,asset,cia]=pool[k%pool.length];const [l,i,treat,rl,ri,acc,ow]=r;
    return [CASES.findIndex(c=>c.t===title),asset,cia,ow===undefined?k%owners.length:ow,l,i,treat,rl,ri,acc,treat==="mitigate"?"依選定的控制措施落實，並於下次風險評鑑確認成效":""]});
  return {id:`sample:${ind}:${stageId}`,ind,stageId,stage:st.stage,name,industry:ind,features:[...feats],desc:st.desc,seed:st.seed+name.length,undec:st.undec,cum:st.cum,
    owners,ownerFrom:st.ownerFrom,na,naReason:feats.includes("dev")?"經風險評鑑判定不適用":"範圍內沒有自行開發系統",cl:st.cl,scope:co.scope,criteria:st.criteria,risks,
    doc:stageId==="audit"?{no:"ISMS-D-01",ver:"1.0",date:"2026/10/01",author:owners[0],reviewer:owners[4],approver:"總經理",approvedAt:"2026/10/05",status:"已核准"}:undefined};
}
Object.entries(SAMPLE_COMPANIES).forEach(([ind,co])=>["intro","build","audit"].forEach((sid,k)=>{if(co.cos[k])SAMPLE_DEFS.push(genSampleDef(ind,sid,co.cos[k]))}));
const SAMPLE_INDS=Object.keys(SAMPLE_COMPANIES);
const STAGE_ORDER={intro:0,build:1,audit:2};
const samplesOf=ind=>SAMPLE_DEFS.filter(d=>d.ind===ind).sort((a,b)=>STAGE_ORDER[a.stageId]-STAGE_ORDER[b.stageId]);
let sampleInd="general";
const SAMPLES={};
function buildSample(d){
  const p={id:d.id,sample:true,stage:d.stage,name:`範例｜${d.stage}：${d.name}`,org:d.name,scope:d.scope,industry:d.industry,features:[...d.features],created:0,updated:0,controls:{},clauses:{}};
  let seed=d.seed; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280};
  const na=new Set(d.na);
  ANNEX.forEach(c=>{
    if(na.has(c.code)){p.controls[c.code]={app:"N",status:0,owner:"",evidence:"",reason:d.naReason};return}
    if(rnd()<d.undec){p.controls[c.code]={app:"",status:0,owner:"",evidence:"",reason:""};return}
    const r=rnd(); const st=d.cum.findIndex(x=>r<x);
    const ow=d.owners[sampleOwnerIdx(c.code,d.owners)];
    p.controls[c.code]={app:"Y",status:st<0?3:st,owner:st>=d.ownerFrom?ow:"",evidence:st>=2?c.ev.split("、")[0]:"",reason:REASONS_IN[0]};
  });
  CLAUSES.forEach((c,i)=>{const st=d.cl(i);p.clauses[c.code]={status:st,owner:st?"資安小組":"",evidence:st>=2?c.ev:""}});
  // 範例的跨單位控制措施：主責之外填上協辦單位（0 資訊、1 人資、2 總務／行政、4 稽核／資安室）
  {const CO={"A.5.18":[1],"A.5.15":[1],"A.5.16":[1],"A.5.11":[0,2],"A.6.5":[0,2],"A.6.1":[0],"A.6.3":[0],"A.6.4":[4],"A.6.6":[3],
      "A.5.24":[4],"A.5.25":[4],"A.5.26":[4],"A.5.27":[4],"A.5.12":[4],"A.5.14":[3],"A.5.34":[1],"A.5.37":[0,4],
      "A.7.2":[0],"A.7.7":[1],"A.7.9":[0],"A.7.10":[2],"A.7.14":[0],"A.8.10":[2],"A.5.29":[0],"A.5.30":[2],"A.5.19":[0],"A.5.20":[3],"A.8.1":[2],
      ...((d.features||[]).includes("lab")?{"A.8.15":[4],"A.5.33":[3,4],"A.8.3":[3],"A.8.19":[3]}:{})};
    Object.entries(CO).forEach(([code,idx])=>{const v=p.controls[code];if(!v||v.app!=="Y"||!v.owner)return;const co=normCo(idx.map(i=>d.owners[i]).filter(Boolean),v.owner);if(co)v.co=co})}
  // 範例的已驗證項目由稽核或資安單位確認，避免負責人自己確認
  {const aud=d.owners[4]||d.owners[2]||d.owners[0]||"稽核室";
    [...Object.values(p.controls),...Object.values(p.clauses)].forEach(v=>{if(v.status===3){v.verifier=v.owner===aud?(d.owners[0]||"資安小組"):aud;v.verifiedAt="2026-09-15"}})}
  p.criteria=presetCriteria(d.criteria||"four");p.criteriaOk=true;p.identOk=true;p.identBy=d.owners[4]||d.owners[0]||"資安小組";p.identAt="2026-08-01";p.doc=sanitizeDoc(d.doc);
  p.risks=(d.risks||[]).map(([ci,asset,cia,ow,l,i,treat,rl,ri,accepted,plan],k)=>{const c=CASES[ci];
    return {...blankRisk("R-"+String(k+1).padStart(3,"0")),title:c.t,threat:c.s,asset,cia,owner:ow>=0?d.owners[ow]:"",l,i,treat,rl,ri,accepted,plan,
      controls:treat==="mitigate"?c.r.filter(x=>ANNEX_MAP[x]&&!na.has(x)):[]}});
  // 範例的處理計畫期限與狀態：建置中多在進行，驗證稽核前大多完成、留一項逾期示範到期提醒；導入初期尚未排期限
  {const sid=d.stageId||(d.stage==="建置中"?"build":d.stage==="驗證稽核前"?"audit":"intro");
    const demo={build:[["2026-09-30","處理中"],["2026-11-15","處理中"],["2026-12","規劃中"],["2027-03","規劃中"],["2027-06","規劃中"]],
      audit:[["2026-06-30","已完成"],["2026-08-31","已完成"],["2026-10-15","處理中"],["2026-12","處理中"],["2027-03","規劃中"]]}[sid];
    if(demo){let j=0;p.risks.forEach(r=>{if(r.treat&&r.treat!=="accept"){const [due,st]=demo[Math.min(j++,demo.length-1)];r.due=due;r.status=st}})}}
  // 納入理由：被風險引用的寫「依風險評鑑結果」，其餘輪流使用其他理由
  const byC=risksByControl(p);let k=0;
  ANNEX.forEach(c=>{const v=p.controls[c.code];if(v.app==="Y")v.reason=byC[c.code]?RISK_REASON:REASONS_IN[1+(k++%(REASONS_IN.length-1))]});
  p.actions=sampleActions(d);
  if(p.stage!=="導入初期")p.scale={l:[...SCALE_REF.l],i:SCALE_REF.i.map(t=>t.replace("【金額】","10 萬元"))};
  return p;
}
/* 範例的改善事項：建置中有 2 項，驗證稽核前做過內部稽核與管理審查，有 5 項 */
/* 範例的負責人依控制措施性質分給不同部門：0 資訊、1 人資、2 總務／行政、3 研發／業務、4 稽核／資安室
   治理與法遵（含職責區隔 A.5.3）不由資訊單位自己負責，避免球員兼裁判 */
const OWNER_GROUPS=[
  [4,["A.5.1","A.5.2","A.5.3","A.5.4","A.5.5","A.5.6","A.5.8","A.5.31","A.5.32","A.5.34","A.5.35","A.5.36"]],
  [1,["A.5.10","A.5.11"]],
  [2,["A.5.9","A.5.12","A.5.13","A.5.19","A.5.20","A.5.21","A.5.22","A.5.29","A.5.30","A.5.33","A.5.37"]],
  [3,["A.8.25","A.8.26","A.8.27","A.8.28","A.8.29","A.8.30","A.8.31","A.8.32","A.8.33","A.8.4"]]
];
function sampleOwnerIdx(code,owners){
  const th=code.split(".")[1];let k=th==="6"?1:th==="7"?2:0;
  for(const [idx,codes] of OWNER_GROUPS)if(codes.includes(code)){k=idx;break}
  if(!owners[k])k=k===4&&owners[2]?2:k===3&&owners[2]?2:0;
  return k;
}
function sampleActions(d){
  const o=k=>d.owners[k]||d.owners[0]||"",sid=d.stageId||(d.stage==="建置中"?"build":d.stage==="驗證稽核前"?"audit":"intro");
  const A=(n,x)=>({...blankAction("I-"+String(n).padStart(3,"0")),...x});
  if(sid==="build")return [
    A(1,{type:"ofi",source:"資安小組會議",raised:"2026-05-12",title:"備份還原沒有定期測試",action:"每季挑一套系統做還原演練並留紀錄",refs:["A.8.13"],owner:o(0),due:"2026-09-30",status:"處理中"}),
    A(2,{type:"inc",source:"資安事件 2026-04",raised:"2026-04-20",title:"同仁點擊釣魚郵件連結並輸入帳密",correction:"立即重設密碼並檢查登入紀錄",cause:"未啟用多因子驗證，教育訓練未涵蓋釣魚辨識",action:"全員啟用多因子驗證，加入釣魚演練",refs:["A.5.24","A.6.3","A.8.5"],owner:o(0),due:"2026-07-31",status:"已完成",doneAt:"2026-07-15"})];
  if(sid==="audit")return [
    A(1,{type:"nc",source:"2026 內部稽核",raised:"2026-08-18",title:"抽查 5 名離職人員，2 名的 VPN 帳號未於 3 日內停用",correction:"當日停用 2 個帳號並檢查登入紀錄",cause:"離職通知只送人資與主管，沒有通知資訊部",action:"離職單加入資訊部簽核，每月比對人事名單與帳號清單",refs:["A.5.18","A.6.5"],owner:o(0),due:"2026-09-30",status:"已確認有效",doneAt:"2026-09-10",verify:"10 月抽查 6 名離職人員，帳號皆於當日停用"}),
    A(2,{type:"nc",source:"2026 內部稽核",raised:"2026-08-18",title:"委外廠商遠端維護沒有存取紀錄",correction:"暫停該廠商遠端帳號，改為申請制",cause:"合約未要求紀錄，系統未開啟稽核日誌",action:"開啟遠端連線紀錄並每月檢視，合約增訂資安條款",refs:["A.5.20","A.8.15"],owner:o(0),due:"2026-10-15",status:"已完成",doneAt:"2026-10-08"}),
    A(3,{type:"obs",source:"2026 內部稽核",raised:"2026-08-19",title:"資產清冊部分設備缺少擁有者",action:"補齊擁有者並於季度盤點時更新",refs:["A.5.9"],owner:o(2),due:"2026-11-30",status:"處理中"}),
    A(4,{type:"mr",source:"2026 第 1 次管理審查",raised:"2026-09-05",title:"社交工程演練由每年一次改為每季一次",action:"排定季度演練並將結果列入下次管理審查",refs:["A.6.3","9.3"],owner:o(1),due:"2026-12-31",status:"處理中"}),
    A(5,{type:"mr",source:"2026 第 1 次管理審查",raised:"2026-09-05",title:"編列預算更換已停止支援的作業系統",action:"盤點 EOS 設備並提出汰換計畫",refs:["A.8.8"],owner:o(0),due:"2026-08-31",status:"待處理"})];
  return [];
}
function resetSample(id){const d=SAMPLE_DEFS.find(x=>x.id===id);if(d)SAMPLES[id]=buildSample(d)}
SAMPLE_DEFS.forEach(d=>resetSample(d.id));
const isSample=id=>typeof id==="string"&&id.startsWith("sample:");
const OLD_SAMPLE_NAME="範例：示範科技股份有限公司（示範資料）";
function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(raw){const s=JSON.parse(raw);
      if(s&&s.projects){
        // 舊版自動產生的範例改由內建範例提供，不再放在「我的專案」
        Object.values(s.projects).forEach(p=>{if(p.name===OLD_SAMPLE_NAME)delete s.projects[p.id]});
        return {activeId:s.activeId&&s.projects[s.activeId]?s.activeId:null,projects:s.projects};
      }}
  }catch(e){storeOK=false}
  return {activeId:null,projects:{}};
}
let S = load();
let lastSaved = null;
function save(){
  const p = cur(); if(p&&!p.sample) p.updated = Date.now();
  try{localStorage.setItem(KEY,JSON.stringify(S));lastSaved=new Date();storeOK=true}
  catch(e){storeOK=false}
  renderSaved();
}
let saveTimer=null;
function saveSoon(){clearTimeout(saveTimer);saveTimer=setTimeout(save,300)}
/* 已封存（唯讀）的專案：開啟時改用一份工作副本，可以查看、篩選、匯出，修改不會寫回原專案 */
const RO_COPY=Object.create(null);
function cur(){if(isSample(S.activeId))return SAMPLES[S.activeId];const p=S.projects[S.activeId];if(!p)return null;
  if(!p.archived)return p;return RO_COPY[p.id]||(RO_COPY[p.id]=JSON.parse(JSON.stringify(p)))}
function savedCur(){const p=S.projects[S.activeId];return p&&p.archived?p:cur()}   // 匯出用：封存專案一律匯出已儲存的內容
function setArchived(id,on){const p=S.projects[id];if(!p)return;p.archived=!!on;delete RO_COPY[id];save();resetBuilt();render();
  toast(on?`已封存「${p.name}」：之後只能查看與匯出，修改不會儲存`:`已解除封存「${p.name}」，可以繼續編輯`)}
function ctl(code){const p=cur();if(!p)return {app:"",status:0,owner:"",evidence:"",reason:""};return p.controls[code]||(p.controls[code]={app:"",status:0,owner:"",evidence:"",reason:""})}
function cls(code){const p=cur();if(!p)return {status:0,owner:"",evidence:""};return p.clauses[code]||(p.clauses[code]={status:0,owner:"",evidence:""})}
function newProject(name,org,scope,start,industry,features){roadSel=null;
  const p=blankProject(name||"未命名專案",org);p.scope=scope||"";p.industry=industry||"";p.features=features||[];p.people=[];p.risks=[];p.criteria=presetCriteria("four");p.criteriaOk=false;p.doc=sanitizeDoc({});
  if(start==="all")ANNEX.forEach(c=>p.controls[c.code]={app:"Y",status:0,owner:"",evidence:"",reason:""});
  S.projects[p.id]=p;S.activeId=p.id;save();resetBuilt();ensurePersist();return p;
}
/* 預覽範例前開著的專案，結束預覽時回到這裡 */
let previewFrom=null;
function endPreview(){
  const sid=S.activeId;if(!isSample(sid))return;
  copying=false;resetSample(sid);
  const back=previewFrom&&S.projects[previewFrom]?previewFrom:null;previewFrom=null;
  S.activeId=back;save();resetBuilt();tab=back?"overview":"home";render();window.scrollTo(0,0);
  toast(back?`已結束預覽，回到「${S.projects[back].name}」`:"已結束預覽");
}
function openProject(id,toTab){roadSel=null;if(isSample(id)&&!isSample(S.activeId))previewFrom=S.activeId;
  else if(isSample(id)&&isSample(S.activeId)&&id!==S.activeId)resetSample(S.activeId);
  else if(!isSample(id))previewFrom=null;
  copying=false;const sd=SAMPLE_DEFS.find(d=>d.id===id);if(sd)sampleInd=sd.ind;editingId=null;S.activeId=id;pendingDelete=null;save();resetBuilt();tab=toTab||"overview";render();window.scrollTo(0,0)}
let copying=false;
function copySample(name){
  const sp=cur(); if(!sp||!sp.sample)return;
  copying=false;
  const p=JSON.parse(JSON.stringify(sp)); p.id=uid(); delete p.sample; delete p.stage; p.log=[];
  p.name=(typeof name==="string"&&name.trim())||sp.org+"（由範例建立）"; p.created=p.updated=Date.now();
  S.projects[p.id]=p; S.activeId=p.id; save(); resetSample(sp.id); resetBuilt(); render(); toast("已建立專案："+p.name);
}

/* 專案清單列：開啟、重新命名、刪除（首頁與專案頁共用） */
let editingId=null;
function projRows(list,ctx){
  return `<div class="plist" data-plist="${ctx}">${list.map(p=>{
    const st=sampleStats(p), isCur=p.id===S.activeId;
    const meta=editingId===p.id
      ?`<div class="meta" style="display:flex;gap:6px;flex-wrap:wrap;flex:1"><input data-rename-in="${p.id}" value="${esc(p.name)}" aria-label="專案名稱" style="flex:1 1 180px"><button class="btn primary" data-pact="rsave" data-id="${p.id}">儲存</button><button class="btn" data-pact="rcancel">取消</button></div>`
      :`<div class="meta"><b>${esc(p.name)}${p.archived?`<span class="tag" style="margin-left:8px;vertical-align:2px">已封存</span>`:""}</b><small>${p.org?esc(p.org)+"・":""}最後修改 ${fmtDate(p.updated)}・已實施 ${st.impl}%${isCur?"・目前專案":""}</small></div>`;
    const acts=editingId===p.id?"":pendingDelete===p.id
      ?`<span class="saved">刪除後無法復原</span><button class="btn danger" data-pact="del2" data-id="${p.id}">確認刪除</button><button class="btn" data-pact="dcancel">取消</button>`
      :`<button class="btn ${isCur&&ctx==="home"?"primary":""}" data-pact="open" data-id="${p.id}">${isCur?"繼續":"開啟"}</button><button class="btn" data-pact="rename" data-id="${p.id}">重新命名</button><button class="btn" data-pact="del" data-id="${p.id}">刪除</button>`;
    return `<div class="prow ${isCur?"active":""}">${meta}${acts?`<div class="pacts">${acts}</div>`:""}</div>`}).join("")}</div>`;
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-arch]");if(!b||!S.projects[S.activeId])return;setArchived(S.activeId,b.dataset.arch==="1")});
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-pact]"); if(!b)return;
  const a=b.dataset.pact, id=b.dataset.id;
  if(a==="open"){editingId=null;openProject(id);return}
  if(a==="rename"){editingId=id;pendingDelete=null}
  if(a==="rcancel"||a==="dcancel"){editingId=null;pendingDelete=null}
  if(a==="rsave"){const inp=document.querySelector(`[data-rename-in="${id}"]`);const n=inp&&inp.value.trim();
    if(!n){toast("專案名稱不能空白");return}
    S.projects[id].name=n;S.projects[id].updated=Date.now();delete RO_COPY[id];editingId=null;save();toast("已重新命名")}
  if(a==="del"){pendingDelete=id;editingId=null}
  if(a==="del2"){const n=S.projects[id]&&S.projects[id].name;delete S.projects[id];delete RO_COPY[id];pendingDelete=null;if(S.activeId===id)S.activeId=null;save();resetBuilt();toast("已刪除："+n)}
  render();
  if(a==="rename"){const inp=document.querySelector(`[data-rename-in="${id}"]`);if(inp){inp.focus();inp.select()}}
});
document.addEventListener("keydown",e=>{const inp=e.target.closest&&e.target.closest("[data-rename-in]");if(!inp)return;
  if(e.key==="Enter"){e.preventDefault();inp.parentElement.querySelector('[data-pact="rsave"]').click()}
  if(e.key==="Escape"){e.stopPropagation();editingId=null;render()}});

/* ================= HELPERS ================= */
const $=(s,r=document)=>r.querySelector(s);
function lvlColor(v){return `var(--s${v})`}
function toast(msg){const t=document.createElement("div");t.className="toast";t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2200)}
function fmtTime(d){return d.toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}
function fmtDate(ts){return new Date(ts).toLocaleDateString("zh-TW")}
function renderBackupBanner(){
  const b=$("#backupBanner"),p=cur();if(!b)return;
  if(!backupDue(p)){b.hidden=true;return}
  const last=p.lastBackupAt?`上次備份是 ${fmtDate(p.lastBackupAt)}`:"這個專案還沒有備份過";
  b.hidden=false;
  b.innerHTML=`<span class="msg"><b>建議備份</b>：${last}，之後已有 ${p.changesSinceBackup} 筆修改。資料只存在這個瀏覽器，清除瀏覽資料或換電腦就會消失。</span>
    <button class="btn primary" id="bkNow">匯出專案檔</button><button class="btn" id="bkLater">明天再提醒</button>`;
  $("#bkNow").addEventListener("click",exportJSON);
  $("#bkLater").addEventListener("click",()=>{p.backupSnoozeUntil=Date.now()+864e5;save();renderBackupBanner()});
}
/* 向瀏覽器申請持久儲存，降低被自動清除的機率 */
let persistState="unknown";
async function ensurePersist(){
  try{ if(!navigator.storage||!navigator.storage.persist)return;
    persistState=(await navigator.storage.persisted())?"yes":((await navigator.storage.persist())?"yes":"no");
  }catch(e){persistState="unknown"}
}
async function storageInfo(){
  let usage="";try{ if(navigator.storage&&navigator.storage.estimate){const e=await navigator.storage.estimate();usage=`已使用約 ${(e.usage/1024).toFixed(0)} KB`}}catch(e){}
  let local=0;try{local=(localStorage.getItem(KEY)||"").length*2}catch(e){}
  return {usage,local:(local/1024).toFixed(0)};
}
function renderSaved(){
  const p=cur();
  $("#savedAt").classList.toggle("isSample",!!(p&&p.sample));
  $("#savedAt").textContent = p&&p.sample ? "範例：修改不會儲存" : !storeOK ? "無法自動儲存" : !p ? "" : (lastSaved?`已自動儲存 ${fmtTime(lastSaved)}`:"自動儲存已開啟");
  $("#storeBanner").hidden = storeOK;
  renderBackupBanner();
}
function refLabel(code){
  if(ANNEX_MAP[code]) return {code, name:ANNEX_MAP[code].name, kind:"annex"};
  if(CLAUSE_MAP[code]) return {code:"第 "+code+" 條", raw:code, name:CLAUSE_MAP[code].name, kind:"clause"};
  return {code,name:"",kind:"?"};
}
function refStatus(code){
  if(ANNEX_MAP[code]){const c=ctl(code);return c.app==="N"?"na":c.status}
  if(CLAUSE_MAP[code]) return cls(code).status;
  return 0;
}
function refChip(code){
  const r=refLabel(code), st=refStatus(code);
  const dot = st==="na"?`<span class="dot na"></span>`:`<span class="dot" style="background:${lvlColor(st)}"></span>`;
  return `<button class="ref" data-open="${esc(code)}">${dot}<span class="mono">${esc(r.code)}</span>${esc(r.name)}</button>`;
}

/* ================= DOWNLOADS ================= */
const dlReady = (window.claude && typeof window.claude.use==="function") ? window.claude.use("downloads").catch(()=>null) : Promise.resolve(null);
async function saveFile(filename, data, mime){
  const dl = await dlReady;
  if(dl){
    try{await dl.save({filename,data});toast("已匯出 "+filename);}
    catch(e){toast(e&&e.code==="declined"?"已取消匯出":"這個檢視中無法匯出檔案");}
    return;
  }
  const blob = data instanceof Blob?data:new Blob([data],{type:mime});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);toast("已匯出 "+filename);
}
/* kind：audit＝稽核用 SoA（精簡 8 欄＋公式統計）；其他＝完整工作底稿 */
function exportExcel(kind){
  refreshFocus();
  if(typeof writeXlsxFile!=="function"){toast("Excel 元件沒有載入，請確認 vendor/write-excel-file.min.js 存在");return}
  const p=savedCur(),audit=kind==="audit";
  writeXlsxFile(audit?buildAuditWorkbook(p):buildWorkbook(p)).toBlob()
    .then(blob=>{if(!p.sample&&!p.archived){p.lastExcelAt=Date.now();save();if(tab==="risks")renderRisks()}return blob})
    .then(blob=>saveFile(`${audit?"SoA_稽核用":"ISMS工作底稿"}_${safeName(p.name)}_${new Date().toISOString().slice(0,10)}.xlsx`,blob,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
    .catch(err=>{console.error(err);toast("Excel 產生失敗："+(err&&err.message||err))});
}
/* 從 Excel（本工具範本、匯出檔，或欄位名稱相近的自訂 SoA／風險表）建立新專案 */
async function importExcelFile(f){
  if(typeof readXlsxFile!=="function"){toast("Excel 讀取元件沒有載入，請確認 vendor/read-excel-file.min.js 存在");return}
  if(f.size>MAX_IMPORT_BYTES){toast("檔案超過 5 MB");return}
  try{
    const sheets=await readXlsxFile(f);
    const {raw,report}=importWorkbook(sheets,{name:f.name.replace(/\.xlsx$/i,"")});
    raw.name=raw.projName||raw.org||raw.name;   // 本工具匯出的檔案保留原專案名稱，其他檔案用組織名稱
    const p=sanitizeProject(raw);
    S.projects[p.id]=p;S.activeId=p.id;save();resetBuilt();tab="overview";render();window.scrollTo(0,0);
    showImportReport(p,report);
  }catch(err){
    // 本工具丟出的錯誤是中文說明；元件丟出的（例如不是 xlsx）改成一般說明
    const msg=err&&/[\u4e00-\u9fff]/.test(err.message)?err.message:"檔案不是有效的 Excel（.xlsx）檔，或已損毀";
    toast("無法匯入："+msg)}
}
function showImportReport(p,rep){
  const n=riskChecks(p).filter(c=>c.sev!=="info").length;
  $("#drawerHost").innerHTML=`<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="匯入結果">
    <button class="btn x" data-close>關閉</button>
    <div class="code">Excel 匯入完成</div><h2>${esc(p.name)}</h2>
    <ul class="kvlist" style="margin-top:14px">
      <li><span>讀取的工作表</span><b>${esc(rep.sheets.join("、")||"—")}</b></li>
      <li><span>控制措施</span><b>${rep.controls} 項</b></li>
      <li><span>風險</span><b>${rep.risks} 項</b></li>${rep.actions?`<li><span>改善事項</span><b>${rep.actions} 項</b></li>`:""}
      <li><span>條款 4–10</span><b>${rep.clauses} 條</b></li>
      <li><span>風險準則</span><b>${rep.criteria?"已匯入":"未找到，使用預設四級"}</b></li>
      <li><span>連動檢查</span><b>${n?n+" 項待確認":"沒有發現不一致"}</b></li>
    </ul>
    <p class="note" style="margin-top:10px">${esc(criteriaText(p))}</p>
    ${(rep.columns||[]).length?`<details class="colmap" ${(rep.columns||[]).some(c=>c.missing.length)?"open":""}><summary>欄位對應（${rep.columns.length} 張表）<span class="note">確認 Excel 的欄位有沒有對到正確的地方</span></summary>
      ${rep.columns.map(c=>`<div class="cmsheet"><b>${esc(c.sheet)}</b><span class="note">當成${esc(c.kind)}讀取</span>
        <ul>${c.mapped.map(x=>`<li><span>${esc(x.from)}</span><span aria-hidden="true">→</span><b>${esc(x.to)}</b></li>`).join("")}</ul>
        ${c.missing.length?`<p class="warnhint">沒找到：${c.missing.map(esc).join("、")}。如果原檔有這些資料，把欄名改成範本上的名稱再匯入一次。</p>`:""}
        ${c.ignored.length?`<p class="note">未使用的欄位：${c.ignored.map(esc).join("、")}</p>`:""}</div>`).join("")}
      <p class="note">欄名不同時，對照<a href="${TPL_BASE}isms-soa-risk-template.xlsx" download>空白範本</a>的欄位名稱修改後重新匯入即可。</p>
    </details>`:""}
    ${rep.warnings.length?`<h3 style="margin-top:16px">注意事項（${rep.warnings.length}）</h3><ul class="cklist">${rep.warnings.map(w=>`<li class="ck warn"><span class="ckmsg">${esc(w)}</span></li>`).join("")}</ul>`:""}
    <div style="display:flex;gap:8px;margin-top:18px;flex-wrap:wrap">${p.risks.length?`<button class="btn primary" id="irRisk">查看風險評鑑</button>`:""}<button class="btn" id="irAnnex">查看附錄 A</button></div>
  </aside>`;
  const host=$("#drawerHost");
  host.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",closeDrawer));
  const go=t=>{host.innerHTML="";tab=t;render();window.scrollTo(0,0)};
  const a=$("#irRisk");if(a)a.addEventListener("click",()=>go("risks"));
  $("#irAnnex").addEventListener("click",()=>go("annex"));
}
/* 範本檔的位置；預覽環境不能存放 Office 檔時，建置時改成網站的完整網址 */
const TPL_BASE="templates/";
function exportJSON(){
  const p=savedCur();
  if(!p.sample){p.lastBackupAt=Date.now();p.changesSinceBackup=0;p.backupSnoozeUntil=0;save();renderBackupBanner()}
  saveFile(`ISMS專案_${safeName(p.name)}.json`,JSON.stringify({app:"isms-mapper",version:1,project:p},null,2),"application/json");
}


/* ================= VIEWS ================= */
let tab="overview";
const filt={theme:"all",status:"all",q:"",lc:""};
let searchQ="";

const NEEDS_PROJECT=new Set(["overview","risks","annex","clauses","audit","improve"]);
let renderedTab=null;
function render(){
  // 換到別的分頁時，關掉還開著的右側詳細頁（例如在寬螢幕點了數字卡或選單）
  if(renderedTab!==null&&tab!==renderedTab&&$("#drawerHost").innerHTML){$("#drawerHost").innerHTML="";drawerTrail=[];drawerCode=null;riskDrawerId=null;lastList=null}
  renderedTab=tab;
  if(!document.getElementById("view-"+tab))tab="overview";   // 已移除的分頁（例如舊版的路線圖）
  if(!cur()&&NEEDS_PROJECT.has(tab))tab="home";
  refreshFocus();refreshOwnerList();personEdit=personDel=null;
  renderProjSel(); renderSaved(); renderSampleBanner();
  const fg=$("#footGuide");if(fg)fg.hidden=tab==="home";
  const fv=$("#footVer");if(fv&&!fv.dataset.v){const m=(document.querySelector('script[src*="js/app.js"]')||{}).src?.match(/[?&]v=([\d.]+)/);if(m){fv.dataset.v=m[1];fv.textContent=`版本 ${m[1]}｜更新紀錄`}}   // 版本號取自載入網址，不另外維護   // 首頁已有使用指南連結，頁尾不重複
  document.querySelectorAll("#tabs button").forEach(b=>{b.setAttribute("aria-selected",b.dataset.tab===tab);
    b.setAttribute("aria-disabled",!cur()&&NEEDS_PROJECT.has(b.dataset.tab))});
  updateNavBadges();
  ["home","overview","search","risks","annex","clauses","audit","improve","docs","projects"].forEach(v=>$("#view-"+v).hidden=v!==tab);
  ({home:renderHome,overview:renderOverview,search:renderSearch,risks:renderRisks,annex:renderAnnex,docs:renderDocs,clauses:renderClauses,audit:renderAudit,improve:renderImprove,projects:renderProjects})[tab]();
}
function renderProjSel(){
  const sel=$("#projSel");
  const mine=Object.values(S.projects).sort((a,b)=>b.updated-a.updated);
  // 第一次來（沒有自己的專案、也沒在預覽範例）時不顯示專案選單，避免一進來就看到「尚未開啟專案」
  const show=mine.length>0||!!cur();sel.hidden=!show;const lb=document.querySelector('label[for="projSel"]');if(lb)lb.hidden=!show;
  sel.innerHTML=(cur()?"":`<option value="" selected>尚未開啟專案</option>`)+
    (mine.length?`<optgroup label="我的專案">${mine.map(p=>`<option value="${p.id}" ${p.id===S.activeId?"selected":""}>${esc(p.name)}</option>`).join("")}</optgroup>`:"")+
    `<optgroup label="範例：${esc(INDUSTRY_MAP[sampleInd].label)}（不會儲存）">${[...samplesOf(sampleInd),...SAMPLE_DEFS.filter(d=>d.id===S.activeId&&d.ind!==sampleInd)].map(d=>`<option value="${d.id}" ${d.id===S.activeId?"selected":""}>${esc(d.stage)}：${esc(d.name)}</option>`).join("")}</optgroup>`;
}
function renderSampleBanner(){
  const p=cur(), b=$("#sampleBanner");
  if(p&&p.archived&&!p.sample&&tab!=="home"){b.hidden=false;
    b.innerHTML=`<span class="msg">「${esc(p.name)}」已封存（唯讀）：可以查看與匯出，修改不會儲存。</span><button class="btn" id="sbUnarch">解除封存</button>`;
    $("#sbUnarch").addEventListener("click",()=>setArchived(p.id,false));return}
  if(!p||!p.sample||tab==="home"){b.hidden=true;return}
  b.hidden=false;
  b.innerHTML=`<span class="msg">正在預覽範例「${esc(p.org)}」（${esc(p.stage)}）。可以隨意操作，修改不會儲存。</span>
    <button class="btn primary" id="sbCopy">以此範例建立我的專案</button><button class="btn" id="sbEnd">結束預覽</button>`;
  if(copying){b.innerHTML=`<span class="msg">為新專案取個名字，範例目前的內容會一起複製過去。</span>
    <input id="sbName" value="${esc(p.org)}（由範例建立）" aria-label="新專案名稱" style="flex:1 1 220px">
    <button class="btn primary" id="sbDo">建立</button><button class="btn" id="sbCancel">取消</button>`;
    const go=()=>copySample($("#sbName").value);
    $("#sbDo").addEventListener("click",go);
    $("#sbName").addEventListener("keydown",e=>{if(e.key==="Enter")go();if(e.key==="Escape"){copying=false;renderSampleBanner()}});
    $("#sbCancel").addEventListener("click",()=>{copying=false;renderSampleBanner()});
    const n=$("#sbName");n.focus();n.select();return}
  $("#sbCopy").addEventListener("click",()=>{copying=true;renderSampleBanner()});
  $("#sbEnd").addEventListener("click",endPreview);
}
function sampleStats(p){
  const vs=ANNEX.map(c=>p.controls[c.code]||{app:""});
  const app=vs.filter(v=>v.app==="Y");
  const t={s0:0,s1:0,s2:0,s3:0,undec:0,na:0};vs.forEach(v=>t[v.app==="N"?"na":v.app===""?"undec":"s"+v.status]++);
  return {t,undec:t.undec,impl:app.length?Math.round(app.filter(v=>v.status>=2).length/app.length*100):0,evid:t.s3};
}
/* 使用指南的網址帶上目前版本號，更新 PDF 後瀏覽器不會沿用舊的快取 */
const GUIDE_URL="docs/user-guide.pdf"+((((document.querySelector('script[src*="js/app.js"]')||{}).src||"").match(/\?v=[\w.]+/)||[""])[0]);
let homePick=null;   // 首頁三選一目前的選項（null＝依有無專案決定）
function renderHome(){
  const mine=Object.values(S.projects).sort((a,b)=>b.updated-a.updated);
  const nDocs=DOCS.filter(d=>d.status!=="planned").length;
  const start=(id,icon,t,d,extra="")=>`<div class="start" ${id?`id="${id}"`:""}><span class="sicon" aria-hidden="true">${icon}</span><div><h3>${t}</h3><p>${d}</p>${extra}</div></div>`;
  // 首頁三選一：先看範例／建立專案／匯入既有資料；沒有專案時預設看範例
  const pick=homePick||(mine.length?"create":"look");
  const PICKS=[["look","▶","先看範例公司怎麼做","選產業，看虛構公司從導入初期到驗證前的樣子"],["create","＋","開始導入我們公司","建立專案，照「下一步建議」逐步完成"],["import","⇪","我已經有 SoA 或風險表","匯入 Excel 或專案檔，自動檢查缺漏"]];
  $("#view-home").innerHTML=`<div class="home2">
    ${mine.length?`<section><div class="secthead"><h3>我的專案</h3><span class="note">${mine.length} 個，依最近修改排序</span></div>${projRows(mine,"home")}</section>`:""}
    <section class="intro">
      <h2>${mine.length?"還想做什麼？":"你想先做什麼？"}</h2>
      <p class="note" style="margin:0">依 ISO/IEC 27001:2022，把日常工作對應到條款、完成風險評鑑與適用性聲明（SoA）。資料只存在這個瀏覽器，不會上傳。</p>
      <div class="pick3" role="tablist" aria-label="開始方式">${PICKS.map(([k,ic,t,d])=>`<button role="tab" id="pk-${k}" data-hpick="${k}" aria-selected="${k===pick}" aria-controls="pp-${k}" class="${k===pick?"on":""}"><span class="pi" aria-hidden="true">${ic}</span><b>${t}</b><small>${d}</small></button>`).join("")}</div>
      <div class="pickpanel">
      <div id="pp-look" role="tabpanel" aria-labelledby="pk-look" ${pick==="look"?"":"hidden"}>
        <p class="note" style="margin:0 0 10px">選擇產業，查看同產業的公司在三個導入階段的樣子。範例中的修改不會儲存，也可以複製成自己的專案。</p>
        <div class="seg indseg" id="indSeg" role="tablist" aria-label="範例產業">${SAMPLE_INDS.map(i=>`<button role="tab" data-sind="${i}" aria-pressed="${i===sampleInd}" aria-selected="${i===sampleInd}">${esc(INDUSTRY_MAP[i].label)}</button>`).join("")}</div>
        <ul class="lgmini" aria-label="進度條圖例">${SEGS.map(x=>`<li><i class="${x.k==="na"?"na":x.k==="undec"?"undec":""}" style="${x.k.startsWith("s")?`background:var(--${x.k})`:""}"></i>${x.label}</li>`).join("")}</ul>
        <div class="samples" id="sampleCards">${samplesOf(sampleInd).map(d=>{const p=SAMPLES[d.id],st=sampleStats(p);return `<article class="scard ${d.id===S.activeId?"active":""}">
          <span class="stage">${esc(d.stage)}</span><h4>${esc(d.name)}</h4><p>${esc(d.desc)}</p>
          ${stackBar(st.t,93)}
          <div class="nums"><span><b>${st.impl}%</b>已實施</span><span><b>${st.undec}</b>未決定</span><span><b>${st.evid}</b>已驗證</span></div>
          <div class="actions" style="display:flex;gap:8px"><button class="btn ${d.id===S.activeId?"":"primary"}" data-home-open="${d.id}">${d.id===S.activeId?"繼續預覽":"預覽"}</button>${d.id===S.activeId?`<button class="btn" data-end-preview>結束預覽</button>`:""}</div>
        </article>`}).join("")}</div>
      </div>
      <div id="pp-create" role="tabpanel" aria-labelledby="pk-create" ${pick==="create"?"":"hidden"}>
      <p class="note" style="margin:0 0 12px">一個專案代表一家公司或一次稽核。建立後會進入總覽，依「下一步建議」逐步完成，修改會自動儲存。</p>
      <form id="homeForm" class="cform">
        <label>專案名稱<input id="hName" required placeholder="例如：2027 年度 ISMS 驗證"></label>
        <label>組織名稱<input id="hOrg" placeholder="選填"></label>
        <label class="wide">驗證範圍<input id="hScope" placeholder="選填，例如：台北總部資訊機房與核心系統"></label>
        <details class="wide fopt"><summary>產業與業務特性<span class="note">選填，用來標示建議優先關注的控制措施</span><span class="fcount" id="hCount"></span></summary>
          <div style="display:grid;gap:10px;margin-top:10px">
            <label style="max-width:320px">產業<select id="hInd">${industryOptions("")}</select></label>
            <div class="fchips">${featureChips([],"hF")}</div>
            <span class="note" style="font-size:12px">選產業會帶入常見特性，可再自行增減。只會標示建議重點，不會替你判定適用性。</span>
          </div></details>
        <fieldset class="wide"><legend>附錄 A 起始狀態</legend>
          <label class="radio"><input type="radio" name="hStart" value="blank" checked><span>全部未決定<small>逐項判定是否適用，適合第一次導入</small></span></label>
          <label class="radio"><input type="radio" name="hStart" value="all"><span>預設全部適用<small>再挑出要排除的項目並寫理由</small></span></label>
        </fieldset>
        <div class="wide actions"><button class="btn primary">建立專案</button></div>
      </form>
      </div>
      <div id="pp-import" role="tabpanel" aria-labelledby="pk-import" ${pick==="import"?"":"hidden"}>
        <p class="note" style="margin:0 0 12px">匯入後會建立新專案，並列出欄位對應與連動檢查結果。欄位名稱不同也能辨識，例如「是否適用」「選擇理由」「實施狀態」。</p>
        <div class="sbtns"><button class="btn primary" id="hXlsx">從 Excel 匯入（SoA、風險評鑑表）</button><button class="btn" id="hImport">匯入專案檔（JSON）</button></div>
        <p class="note" style="margin:12px 0 0">還沒有自己的格式？可下載<a href="${TPL_BASE}isms-soa-risk-template.xlsx" download>空白範本</a>或<a href="${TPL_BASE}isms-soa-risk-example.xlsx" download>填寫範例</a>，填好後再匯入。</p>
      </div>
      </div>
      <p class="guidehint" style="margin:10px 0 0"><span>不確定怎麼用？<a href="${GUIDE_URL}" target="_blank" rel="noopener">看使用指南（PDF，18 頁）</a></span><span class="ghsep" aria-hidden="true">｜</span><span>只需要文件？<a href="#" data-goto="docs">下載 ${nDocs} 份文件範本</a>直接編輯</span></p>
    </section>
  </div>`;
  const v=$("#view-home");
  $("#homeForm").addEventListener("submit",e=>{e.preventDefault();
    const p=newProject($("#hName").value.trim(),$("#hOrg").value.trim(),$("#hScope").value.trim(),v.querySelector('input[name="hStart"]:checked').value,$("#hInd").value,readFeatures(v,"hF"));
    tab="overview";render();window.scrollTo(0,0);toast("已建立專案："+p.name+"，可依總覽的下一步建議開始")});
  $("#hImport").addEventListener("click",()=>$("#importFile").click());
  $("#hXlsx").addEventListener("click",()=>$("#xlsxFile").click());
  v.querySelectorAll("[data-hpick]").forEach(b=>b.addEventListener("click",()=>{homePick=b.dataset.hpick;
    v.querySelectorAll("[data-hpick]").forEach(x=>{const on=x===b;x.classList.toggle("on",on);x.setAttribute("aria-selected",on)});
    ["look","create","import"].forEach(k=>$("#pp-"+k).hidden=k!==homePick);
    if(homePick==="create")$("#hName").focus({preventScroll:true})}));
  wireIndustry(v,"hInd","hF","hCount");
  v.querySelectorAll("[data-home-open]").forEach(b=>b.addEventListener("click",()=>openProject(b.dataset.homeOpen)));
  v.querySelectorAll("[data-end-preview]").forEach(b=>b.addEventListener("click",endPreview));
  $("#indSeg").addEventListener("click",e=>{const b=e.target.closest("[data-sind]");if(!b)return;setSampleInd(b.dataset.sind)});
  // 建立表單選了產業時，範例也切到同一個產業
  $("#hInd").addEventListener("change",e=>{if(SAMPLE_COMPANIES[e.target.value]){setSampleInd(e.target.value,true)}});
}
function setSampleInd(ind,quiet){
  if(!SAMPLE_COMPANIES[ind]||ind===sampleInd)return;
  sampleInd=ind;
  const keep={name:$("#hName").value,org:$("#hOrg").value,scope:$("#hScope").value,ind:$("#hInd").value,f:readFeatures($("#view-home"),"hF"),
    start:($("#view-home").querySelector('input[name="hStart"]:checked')||{}).value,open:$(".fopt")&&$(".fopt").open,y:window.scrollY};
  renderHome();renderProjSel();
  // 保留使用者已經填寫的建立表單內容
  $("#hName").value=keep.name;$("#hOrg").value=keep.org;$("#hScope").value=keep.scope;$("#hInd").value=keep.ind;
  $("#view-home").querySelectorAll('input[name="hF"]').forEach(x=>x.checked=keep.f.includes(x.value));
  const r=$("#view-home").querySelector(`input[name="hStart"][value="${keep.start}"]`);if(r)r.checked=true;
  if(keep.open)$(".fopt").open=true;
  const cb=$("#view-home").querySelector('input[name="hF"]');if(cb)cb.dispatchEvent(new Event("change"));   // 只更新「會標示幾項」的計數
  window.scrollTo(0,keep.y);
  if(quiet)toast("下方範例已切換為「"+INDUSTRY_MAP[ind].label+"」");
}
function counts(){
  const vs=ANNEX.map(c=>ctl(c.code));
  const app=vs.filter(v=>v.app==="Y");
  return {total:93,app:app.length,na:vs.filter(v=>v.app==="N").length,undec:vs.filter(v=>v.app==="").length,
    impl:app.filter(v=>v.status>=2).length,evid:app.filter(v=>v.status===3).length,building:app.filter(v=>v.status===1).length,none:app.filter(v=>v.status===0).length};
}
/* ---------- chart helpers ---------- */
const SEGS=[
  {k:"s3",label:"已驗證",fill:"var(--s3)"},{k:"s2",label:"已實施",fill:"var(--s2)"},
  {k:"s1",label:"部分實施",fill:"var(--s1)"},{k:"s0",label:"未開始",fill:"var(--s0)"},
  {k:"undec",label:"未決定",fill:"var(--surface2)",dash:true},{k:"na",label:"不適用",fill:"url(#hatch)"}
];
function bucket(v){return v.app==="N"?"na":v.app===""?"undec":"s"+v.status}
function tally(list){const t={s0:0,s1:0,s2:0,s3:0,undec:0,na:0};list.forEach(c=>t[bucket(ctl(c.code))]++);return t}
const HATCH=`<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--surface)"/><rect width="3" height="6" fill="var(--na)"/></pattern></defs>`;
function polar(cx,cy,r,deg){const a=(deg-90)*Math.PI/180;return [cx+r*Math.cos(a),cy+r*Math.sin(a)]}
function arc(cx,cy,r0,r1,a0,a1){
  const big=a1-a0>180?1:0;
  const [x0,y0]=polar(cx,cy,r1,a0),[x1,y1]=polar(cx,cy,r1,a1),[x2,y2]=polar(cx,cy,r0,a1),[x3,y3]=polar(cx,cy,r0,a0);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r1} ${r1} 0 ${big} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}A${r0} ${r0} 0 ${big} 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z`;
}
function donut(t,total,centerBig,centerSmall){
  let a=0; const paths=SEGS.filter(s=>t[s.k]>0).map(s=>{
    const span=t[s.k]/total*360; const a0=a,a1=a+span; a=a1;
    const d=span>=359.99?arc(100,100,62,90,0,359.99):arc(100,100,62,90,a0,a1);
    return `<path d="${d}" fill="${s.fill}" stroke="var(--surface)" stroke-width="2" ${s.dash?'stroke-dasharray="3 3" style="stroke:var(--muted)"':""} data-tip="${s.label}：${t[s.k]} 項（${Math.round(t[s.k]/total*100)}%）・點擊查看" data-lseg="${s.k}" data-lscope="all" tabindex="0" role="button" aria-label="${s.label} ${t[s.k]} 項"></path>`}).join("");
  return `<svg viewBox="0 0 200 200" class="donut" role="img" aria-label="附錄 A 狀態分布">${HATCH}${paths}
    <text x="100" y="98" text-anchor="middle" class="big">${centerBig}</text>
    <text x="100" y="120" text-anchor="middle" class="small">${centerSmall}</text></svg>`;
}
function stackBar(t,total,scope){
  const sc=scope?` data-lscope="${esc(scope)}" tabindex="0" role="button"`:"";
  return `<div class="stack ${scope?"live":""}">${SEGS.filter(s=>t[s.k]>0).map(s=>`<span class="${s.k==="na"?"na":s.k==="undec"?"undec":""}" style="flex:${t[s.k]};${s.k.startsWith("s")?`background:var(--${s.k})`:""}" data-tip="${s.label}：${t[s.k]} 項${scope?"・點擊查看":""}"${scope?` data-lseg="${s.k}"`:""}${sc}></span>`).join("")}</div>`;
}
function legendHTML(t){
  return `<ul class="lg">${SEGS.map(s=>`<li ${t&&!t[s.k]?`class="zero"`:`data-lseg="${s.k}" data-lscope="all" tabindex="0" role="button" data-tip="點擊查看「${s.label}」的項目"`}><i class="${s.k==="na"?"na":s.k==="undec"?"undec":""}" style="${s.k.startsWith("s")?`background:var(--${s.k})`:""}"></i>${s.label}<b>${t?t[s.k]:""}</b></li>`).join("")}</ul>`;
}
function pdcaRing(){
  const ph=[["P","規劃"],["D","執行"],["C","檢查"],["A","改善"]];
  let svg="", all=0, done=0;
  ph.forEach(([k,n],i)=>{
    const l=CLAUSES.filter(x=>x.phase===k), d=l.filter(x=>cls(x.code).status>=2).length; all+=l.length; done+=d;
    const a0=i*90+3, a1=i*90+87, ap=a0+(a1-a0)*(d/l.length);
    svg+=`<path d="${arc(140,140,64,84,a0,a1)}" fill="var(--s0)" data-tip="${k} ${n}：${d}/${l.length} 條完成・點擊查看" data-lphase="${k}" tabindex="0" role="button" aria-label="${n} 階段條款"></path>`;
    if(d>0) svg+=`<path d="${arc(140,140,64,84,a0,ap)}" fill="var(--s3)" pointer-events="none"></path>`;
    const [hx,hy]=polar(140,140,74,a1+1.5);
    svg+=`<path d="M0 -6 L6 0 L0 6 Z" transform="translate(${hx.toFixed(1)} ${hy.toFixed(1)}) rotate(${a1+1.5})" fill="var(--muted)" pointer-events="none"></path>`;
    const mid=i*90+45, [lx,ly]=polar(140,140,110,mid), anchor=mid<180?"start":"end";
    svg+=`<text x="${lx.toFixed(1)}" y="${(ly-4).toFixed(1)}" text-anchor="${anchor}" class="ph">${k} ${n}</text>
      <text x="${lx.toFixed(1)}" y="${(ly+13).toFixed(1)}" text-anchor="${anchor}" class="small">${d}/${l.length} 條</text>`;
  });
  return `<svg viewBox="0 0 280 280" class="ring" role="img" aria-label="PDCA 各階段完成度">${svg}
    <text x="140" y="138" text-anchor="middle" class="big">${Math.round(done/all*100)}%</text>
    <text x="140" y="158" text-anchor="middle" class="small">條款 4–10 完成</text></svg>`;
}

function focusPanel(p){
  const fs=projFeatures(p), ind=INDUSTRY_MAP[p.industry||""];
  if(!fs.length&&!p.industry&&!Object.keys(FM).length) return `<div class="panel fpanel"><h3>產業建議重點</h3><p class="note" style="margin:0 0 10px">選擇產業與業務特性後，會在附錄 A 用紫色底線標出建議優先關注的控制措施，並列出相關法規提示。也可以在附錄 A 點 ☆ 自行標示重點。只做標示，不會改變你的判定。</p><button class="btn" data-goto="projects" data-anchor="indBox">設定產業與業務特性</button></div>`;
  const nOn=(p.focusOn||[]).filter(c=>FM[c]).length,nOff=(p.focusOff||[]).length;
  const codes=Object.keys(FM).sort((a,b)=>ANNEX.findIndex(x=>x.code===a)-ANNEX.findIndex(x=>x.code===b));
  const list=codes.map(c=>ANNEX_MAP[c]);const tt=tally(list);
  const pending=list.filter(c=>{const v=ctl(c.code);return v.app===""||(v.app==="Y"&&v.status<2)});
  const laws=lawsFor(p);
  return `<div class="panel fpanel">
    <div class="secthead"><h3>產業建議重點</h3><span class="note">${ind&&ind.id?esc(ind.label)+"・":""}${fs.map(f=>esc(FEATURE_MAP[f].label)).join("、")}</span><button class="btn" data-goto="projects" data-anchor="indBox" style="margin-left:auto">調整產業與特性 →</button></div>
    <div class="fgrid">
      <div>
        ${nOn||nOff?`<div class="note" style="margin:0 0 10px;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center">已自行調整：加入 ${nOn} 項、取消 ${nOff} 項<button class="chip" data-freset>恢復預設建議</button></div>`:""}
        <div class="blab"><span>建議重點 ${codes.length} 項</span><span class="mono">${tt.s2+tt.s3}/${codes.length} 已實施</span></div>
        ${stackBar(tt,codes.length,"focus")}
        <h3 style="margin-top:16px">尚未完成的重點（${pending.length}）</h3>
        ${pending.length?`<div style="display:flex;flex-wrap:wrap;gap:6px">${pending.slice(0,12).map(c=>refChip(c.code)).join("")}${pending.length>12?`<button class="chip" data-goto="annex" data-focusfilter="1">查看全部</button>`:""}</div>`:`<p class="note">建議重點都已實施。</p>`}
        <p class="note" style="margin-top:14px">建議依業務特性產生，只供參考。可在附錄 A 或項目詳情點 ★／☆ 自行加入或取消重點；適用性仍須依風險評鑑結果決定。</p>
      </div>
      <div><h3>相關法規與標準</h3>
        ${laws.length?`<div class="laws">${laws.map(l=>`<div class="law"><h4>${esc(l.name)}<small>${esc(l.kind)}</small></h4><p>${esc(l.note)}</p>
          <ul>${l.todo.map(t=>`<li>${esc(t)}</li>`).join("")}</ul>
          <div class="refs">${l.codes.map(refChip).join("")}<a href="${l.link}" target="_blank" rel="noopener">查看原文 ↗</a></div></div>`).join("")}</div>
          <p class="note" style="margin-top:10px">法規摘要整理於${RULES_DATE}，修法後內容可能變動，請以官方公告為準。</p>`
        :`<p class="note">目前勾選的特性沒有對應的法規提示。</p>`}
      </div>
    </div></div>`;
}
document.addEventListener("click",e=>{const g=e.target.closest("[data-goto]");if(!g)return;if(g.tagName==="A")e.preventDefault();
  if(g.dataset.focusfilter){filt.status="focus";filt.theme="all";delete $("#view-annex").dataset.built}
  if(g.dataset.gofilter){filt.status=g.dataset.gofilter;filt.theme="all";filt.q="";delete $("#view-annex").dataset.built}
  if(g.dataset.openx==="ident")riskView.stage="ident";
  if(g.dataset.actf)actFilter=g.dataset.actf;
  if(g.dataset.riskf){riskView.due=g.dataset.riskf;riskView.stage=null;riskView.cell=null}
  tab=g.dataset.goto;render();window.scrollTo(0,0);
  if(g.dataset.anchor){const a=document.getElementById(g.dataset.anchor);if(a){a.scrollIntoView({block:"start"});flashPanel(a)}}
  if(g.dataset.riskf){const d=document.querySelector("#view-risks .duebar");if(d)d.scrollIntoView({block:"start"})}
  if(g.dataset.openx==="criteria")openCriteriaDrawer()});
/* ---------- 下一步建議（總覽上方）與導入路線圖 ---------- */
let nextAll=false;
/* 跳到頁面中的某個區塊時短暫標亮，並把游標放到第一個要填的欄位，讓人知道要做什麼 */
function flashPanel(el){el.classList.remove("flash");void el.offsetWidth;el.classList.add("flash");setTimeout(()=>el.classList.remove("flash"),2600);
  const f=el.querySelector(".need");if(f)f.focus({preventScroll:true})}
function stepBtn(x,primary,label){return `<button class="btn ${primary?"primary":""}" data-goto="${x.tab}"${x.filter?` data-gofilter="${x.filter}"`:""}${x.open?` data-openx="${x.open}"`:""}${x.anchor?` data-anchor="${x.anchor}"`:""}${x.actf?` data-actf="${x.actf}"`:""}${x.riskf?` data-riskf="${x.riskf}"`:""}>${esc(label||(x.cta||"前往")+" →")}</button>`}
/* 按鈕上顯示要前往的分頁，點之前就知道會離開總覽 */
const TAB_LABEL={home:"首頁",overview:"總覽",search:"案例搜尋",risks:"風險評鑑",annex:"附錄 A",clauses:"條款 4–10",audit:"稽核準備",improve:"改善追蹤",docs:"文件範本",projects:"專案管理"};
let roadSel=null;   // 步驟圖示中選取的步驟（null = 目前步驟）
/* 步驟明細的待辦：依原因分組（例如「未判定適用性」「計畫逾期」），組名對應上方的摘要，讓人看出這些項目就是這一步缺的 */
function stepItemsHTML(items,iattr,more){
  const groups=[];items.forEach(x=>{const key=String(x.note||"待處理").replace(/\s*\d+\s*天$/,"");let g=groups.find(g=>g.key===key);if(!g)groups.push(g={key,hot:false,list:[]});g.list.push(x);g.hot=g.hot||!!x.hot});
  const MAX=6;
  return `<div class="sigroups">${groups.map(g=>`<div class="sigrp${g.hot?" hot":""}"><div class="sigh"><b>${esc(g.key)}</b><span class="note">${g.list.length} 項</span></div>
    <div class="tlinks">${g.list.slice(0,MAX).map(x=>`<button type="button" class="tlink ${x.hot?"bad":"warn"}" ${iattr(x)}>${esc(x.label)}${x.hot&&x.note!==g.key?`<span>${esc(x.note)}</span>`:""}</button>`).join("")}
    ${g.list.length>MAX?`<button type="button" class="simore" data-goto="${more.tab}"${more.filter?` data-gofilter="${more.filter}"`:""}${more.actf?` data-actf="${more.actf}"`:""}${more.riskf?` data-riskf="${more.riskf}"`:""}>還有 ${g.list.length-MAX} 項 →</button>`:""}</div></div>`).join("")}</div>`;
}
function nextCard(p){
  const list=nextSteps(p),road=roadmapSteps(p),done=road.filter(s=>s.done).length,curStep=road.find(s=>s.current);
  const sel=road.find(s=>s.n===roadSel)||curStep||road[road.length-1];
  const shown=nextAll?list:list.slice(0,3);
  const rel=sel.done?[]:list.filter(x=>sel.keys.includes(x.key));
  const it=sel.done?{items:[]}:roadmapItems(p,sel.n),items=it.items,more=it.more;
  const go=more&&items.length?{...sel,tab:more.tab,filter:more.filter,actf:more.actf,riskf:more.riskf}:sel;
  const iattr=x=>x.kind==="risk"?`data-risk="${esc(x.id)}"`:x.kind==="act"?`data-act="${esc(x.id)}"`:`data-open="${esc(x.id)}"`;
  const state=st=>st.done?"已完成":st.current?"目前步驟":"未完成";
  return `<section class="nextcard" aria-label="導入進度與下一步建議">
    <div class="secthead"><h3>導入進度</h3><span class="note">${done}／${road.length} 步完成。圓點下方是該步驟還沒完成的項目數，點圓點可查看明細</span></div>
    <ol class="stepper">${road.map(st=>`<li class="${st.done?"done":""}${st.current?" current":""}${st===sel?" sel":""}">
      <button type="button" data-road="${st.n}" aria-pressed="${st===sel}" aria-label="步驟 ${st.n} ${esc(st.title)}：${state(st)}${st.badge?"，"+esc(st.badge):""}" title="${esc(st.detail)}">
      <span class="sdot" aria-hidden="true">${st.done?"✓":st.n}</span><span class="slab">${esc(st.short)}</span>${st.badge?`<span class="sbadge${st.hot?" hot":""}" aria-hidden="true">${esc(st.badge)}</span>`:""}</button></li>`).join("")}</ol>
    <div class="sdetail" aria-live="polite">
      <div class="sdhead"><b>步驟 ${sel.n}　${esc(sel.title)}</b><span class="mono rcl">${esc(sel.clause)}</span><span class="rstate ${sel.done?"ok":sel.current?"warn":""}">${state(sel)}</span></div>
      <span class="rdetail">${esc(sel.detail)}</span>
      ${rel.length&&!items.length?`<ul class="rnext">${rel.map(x=>`<li>${esc(x.title)}</li>`).join("")}</ul>`:""}
      ${items.length?stepItemsHTML(items,iattr,more):""}
      <div class="sdfoot">${stepBtn(go,!sel.done,(sel.done?"查看":"前往")+(sel.go||TAB_LABEL[go.tab]||"")+" →")}${items.length?`<span class="note">或點上面的項目直接處理</span>`:""}</div>
    </div>
    <div class="secthead" style="margin-top:18px"><h3>下一步建議</h3><span class="note">依專案目前的資料自動產生，處理完會換下一項</span></div>
    ${list.length?`<ol class="nextlist">${shown.map((x,k)=>`<li class="${x.sev}${k===0?" first":""}"><span class="nnum">${k+1}</span>
      <span class="ntext"><b>${esc(x.title)}</b><span>${esc(x.desc)}</span></span>${stepBtn(x,k===0)}</li>`).join("")}</ol>
      ${list.length>3?`<button class="chip" id="nextMore" aria-expanded="${nextAll}">${nextAll?"收合":`查看全部 ${list.length} 項建議`}</button>`:""}`
    :`<p class="note" style="margin:0">目前沒有待辦。記得定期匯出專案檔備份；明年可以在「專案管理」建立新年度。</p>`}
    <details class="ckinfo"><summary>進度怎麼判斷</summary><p class="note" style="margin:6px 0 0">範圍與產業特性已填寫、風險準則已確認、風險都已評估、附錄 A 都已判定且與風險一致、文件狀態改為「已核准」、適用項目都已實施、條款 4–10 都已實施、內部稽核後的改善事項都已結案。順序可以交錯進行；這只是進度提示，是否符合標準仍以稽核判斷為準。</p></details>
  </section>`;
}
document.addEventListener("click",e=>{
  if(e.target.closest("#nextMore")){nextAll=!nextAll;render();return}
  const r=e.target.closest("[data-road]");if(r){roadSel=+r.dataset.road;renderOverview();const b=document.querySelector(`[data-road="${roadSel}"]`);if(b)b.focus()}});
/* ================= 稽核準備 =================
   把同一份資料換成驗證稽核兩個階段的角度。總覽只放一行摘要，完整內容在「稽核準備」分頁。 */
const AUD_GRADE={nc:"可能不符合",obs:"可能列為觀察",ok:"資料齊全",na:"尚無資料"};
function auditSum(s){const n=g=>s.items.filter(x=>x.grade===g).length,nc=n("nc"),ob=n("obs"),na=n("na");
  return nc||ob||na?(nc?`<span class="ag nc">不符合 ${nc}</span>`:"")+(ob?`<span class="ag obs">觀察 ${ob}</span>`:"")+(na?`<span class="ag nd">尚無資料 ${na}</span>`:""):`<span class="ag ok">資料齊全</span>`}
/* 總覽最上方的四張數字卡：做到哪、還沒決定、逾期、稽核會被抓的；點卡片直接前往對應的清單 */
function kpiCards(p,c,pct){
  const now=Date.now(),risks=p.risks||[];
  const due=risks.map(r=>planDue(r,now)).filter(Boolean),late=due.filter(d=>d.state==="late").length,soon=due.filter(d=>d.state==="soon").length;
  const items=auditReadiness(p,now).flatMap(x=>x.items),nc=items.filter(x=>x.grade==="nc").length,obs=items.filter(x=>x.grade==="obs").length;
  const clPct=Math.round(CLAUSES.filter(x=>cls(x.code).status>=2).length/CLAUSES.length*100);
  const done=ANNEX.filter(x=>{const v=ctl(x.code);return v.app==="Y"&&v.status>=2}).length;
  const card=(cls2,attrs,k,v,s)=>`<button class="kpi ${cls2}" ${attrs}><span class="k">${k}</span><span class="v">${v}</span><span class="s">${s}</span></button>`;
  return `<div class="kpis" aria-label="重點數字">
    ${card("hero",c.app?`data-goto="annex" data-gofilter="notimpl" data-tip="列出適用但還沒實施的控制措施"`:`data-goto="annex" data-gofilter="undec"`,"適用項目已實施",c.app?`${pct}<small>%</small>`:"—",c.app?`${done}／${c.app} 項・條款 4–10 ${clPct}%`:"判定適用性後開始計算")}
    ${card(c.undec?"":"good",`data-goto="annex" data-gofilter="undec" data-tip="列出還沒判定適用性的控制措施"`,"未決定適用性",c.undec,c.undec?`共 93 項，已判定 ${93-c.undec} 項`:"93 項都已判定")}
    ${card(late?"bad":risks.length?"good":"",`data-goto="risks" ${late||soon?`data-riskf="${late?"late":"soon"}"`:""} data-tip="風險處理計畫的期限"`,"逾期處理計畫",risks.length?late:"—",risks.length?(soon?`30 天內到期 ${soon} 項`:late?"請更新進度或期限":"沒有逾期"):"還沒有風險")}
    ${card(c.app&&nc?"bad":c.app?"good":"",`data-goto="audit" data-tip="用稽核員的角度檢查"`,"稽核準備",c.app?nc:"—",c.app?(nc?`可能不符合${obs?`・另有觀察 ${obs} 項`:""}`:obs?`可能列為觀察 ${obs} 項`:"沒有明顯缺口"):"判定適用性後檢查")}
  </div>`;
}
function auditBar(p){
  const st=auditReadiness(p);
  return `<div class="panel audbar"><b>稽核準備</b><span class="audsum">${st.map(s=>`<span class="audst">${esc(s.name.split("：")[0])}${auditSum(s)}</span>`).join("")}</span>
    <button class="btn" data-goto="audit">查看稽核準備 →</button></div>`;
}
function renderAudit(){
  const p=cur(),st=auditReadiness(p);
  const card=x=>{const g=x.grade;return `<li class="${g}">
      <div class="audh"><span class="ag ${g}">${g==="ok"?"✓ ":""}${AUD_GRADE[g]}</span><b>${esc(x.title)}</b><span class="mono rcl">${esc(x.clause)}</span></div>
      ${g==="ok"?"":`<div class="audask">稽核員會問：${esc(x.ask)}</div>`}
      ${x.detail.length&&g!=="ok"?`<ul class="auddet">${x.detail.map(d=>`<li>${esc(d)}</li>`).join("")}</ul>`:""}
      <div class="audrule"><b>資料齊全的條件</b>${esc(x.rule)}</div>
      ${x.go?`<div class="audgo">${stepBtn(x.go,false)}</div>`:""}</li>`};
  const spotN0=activeSpot(p)?spotStats(activeSpot(p)).pending:0;
  $("#view-audit").innerHTML=`<h2>稽核準備</h2>
  <div class="seg audseg" role="tablist" aria-label="稽核準備">${[["ready","準備度"],["trace","反向查詢"],["spot","模擬抽查"+(spotN0?`（進行中 ${spotN0}）`:"")]].map(([k,t])=>`<button role="tab" data-audv="${k}" aria-pressed="${auditView===k}">${t}</button>`).join("")}</div>
  ${auditView==="trace"?reverseHTML(p):auditView==="spot"?spotHTML(p):`<p class="lede" style="margin-top:14px">用驗證稽核的角度看同一份資料：第一階段看 ISMS 有沒有建立，第二階段抽樣看有沒有確實執行。標示為依常見稽核做法的參考判斷，實際結果依稽核員與驗證機構而定。</p>
  <div class="audsign"><span><b>送審確認單</b>把下面的判斷結果整理成一頁，加上工具看不到的確認事項與簽名欄，列印後由資安窗口與管理代表簽名留存。</span><button class="btn" id="audPrint">列印送審確認單</button></div>
  <p class="audwarn">「資料齊全」只代表工具裡填的資料沒有缺口。工具看不到證據檔案本身，稽核前請抽查證據位置的檔案確實存在、而且是最新的。</p>
  <div class="audgrid">${st.map(s=>{const shown=s.items.filter(x=>x.grade!=="na"),nd=s.items.filter(x=>x.grade==="na");
    return `<section class="audcol"><div class="audch"><h3>${esc(s.name)}</h3><span class="audsum">${auditSum(s)}</span></div><p class="note" style="margin:0 0 10px">${esc(s.desc)}</p>
      <ul class="audlist">${shown.map(card).join("")}</ul>
      ${nd.length?`<div class="audnd"><b>尚無資料（${nd.length}）</b><span class="note">這些項目要先有資料才查得到</span><ul>${nd.map(x=>`<li><b>${esc(x.title)}</b>：${esc(x.detail[0]||"")}</li>`).join("")}</ul></div>`:""}
    </section>`}).join("")}</div>
`}`;
  if(auditView==="trace"){const i=$("#rvQ");if(i&&rvFocus){i.focus();i.setSelectionRange(i.value.length,i.value.length)}}
  const pb=$("#audPrint");if(pb)pb.addEventListener("click",printSignoff);
}
/* ---------- 送審確認單（列印） ---------- */
function appVersion(){const m=(document.querySelector('script[src*="js/app.js"]')||{}).src?.match(/[?&]v=([\d.]+)/);return m?m[1]:""}
function signoffHTML(p,now){
  const sh=signoffSheet(p,now),d=new Date(now||Date.now()),ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const mark={ok:"✓ 資料齊全",obs:"△ 可能列為觀察",nc:"✕ 可能不符合",na:"－ 尚無資料"};
  const row=r=>`<tr class="g-${r.grade}"><td>${esc(r.title)}</td><td class="cl">${esc(r.clause)}</td><td class="g">${mark[r.grade]}</td><td>${r.grade==="ok"?"":esc(r.detail.join("；"))}</td></tr>`;
  const stage=(id,name)=>`<tr class="st"><th colspan="4">${esc(name)}</th></tr>${sh.rows.filter(r=>r.stage===id).map(row).join("")}`;
  const names=[...new Set(sh.rows.map(r=>r.stage))].map(id=>[id,sh.rows.find(r=>r.stage===id).stageName]);
  const c=sh.count,sp=sh.spot;
  return `<article class="signoff">
    <header><h1>ISMS 驗證稽核送審確認單</h1>
      <table class="meta"><tr><th>組織</th><td>${esc(p.org||"")}</td><th>產生日期</th><td>${ds}</td></tr>
      <tr><th>專案</th><td>${esc(p.name||"")}</td><th>工具版本</th><td>ISMS 條款對照台 ${esc(appVersion())}</td></tr>
      <tr><th>驗證範圍</th><td colspan="3">${esc(p.scope||"（未填寫）")}</td></tr></table></header>
    <h2>一、系統判斷（依工具內資料自動產生）</h2>
    <p class="sum">資料齊全 ${c.ok} 項・可能列為觀察 ${c.obs} 項・可能不符合 ${c.nc} 項・尚無資料 ${c.na} 項</p>${c.nc?`<p class="warnl">建議先處理「可能不符合」的 ${c.nc} 項再送審。</p>`:""}
    <table class="res"><thead><tr><th style="width:25%">項目</th><th style="width:15%">條款</th><th style="width:17%">判斷</th><th>待處理</th></tr></thead>
      <tbody>${names.map(([id,n])=>stage(id,n)).join("")}</tbody></table>
    <p class="fine">模擬抽查：${sp?`最近一次 ${esc(sp.id)}（${esc(sp.date)}）抽查 ${sp.total} 項，確認 ${sp.ok} 項、找不到 ${sp.fail} 項${sp.pending?`、尚未查 ${sp.pending} 項`:""}`:"尚未進行"}</p>
    <h2>二、人工確認（工具無法判斷，請確認後勾選）</h2>
    <table class="man">${sh.manual.map(m=>`<tr><td class="box">☐</td><td>${esc(m.text)}</td><td class="cl">${esc(m.clause)}</td></tr>`).join("")}</table>
    <section class="keep"><h2>三、簽核</h2>
    <table class="sign"><tr><th>確認人（資安窗口）</th><td></td><th>日期</th><td></td></tr><tr><th>核准（管理代表）</th><td></td><th>日期</th><td></td></tr></table>
    <p class="fine">「系統判斷」依常見稽核做法整理，僅代表工具內填寫的資料沒有缺口，不代表驗證結果；實際判定依稽核員與驗證機構而定。</p></section>
  </article>`;
}
function printSignoff(){
  const p=cur();if(!p)return;
  let host=$("#printHost");if(!host){host=document.createElement("div");host.id="printHost";document.body.appendChild(host)}
  host.innerHTML=signoffHTML(p);document.body.classList.add("printing");
  const done=()=>{document.body.classList.remove("printing");host.innerHTML="";window.removeEventListener("afterprint",done)};
  window.addEventListener("afterprint",done);
  try{window.print()}catch(e){done();toast("這個檢視無法列印，請在瀏覽器中開啟")}
}
/* ---------- 反向查詢 ---------- */
let auditView="ready",rvMode="person",rvQ="",rvFocus=false;
const RV_MODES=[["person","人員","例如：資訊處 周處長","訪談前先看這個人負責哪些事、哪些還沒完成"],["asset","資產或系統","例如：ERP、AD 帳號","看到一套系統，回查風險評鑑有沒有涵蓋它"],["evidence","文件或證據","例如：帳號清查紀錄、POL-04","拿到一份紀錄或文件，看它能證明哪些要求"],["event","事件或改善事項","例如：I-002、釣魚","發生過的事件，回查風險評鑑有沒有更新"]];
function reverseHTML(p){
  const m=RV_MODES.find(x=>x[0]===rvMode);
  return `<p class="lede" style="margin-top:14px">稽核員常從現場看到的東西往回追：一個人、一套系統、一份紀錄或一起事件，回頭查它對應到哪些要求、風險評鑑有沒有考慮到。最容易發現「文件寫一套、實際做一套」的落差。</p>
  <div class="panel rv"><div class="rvmodes">${RV_MODES.map(([k,t])=>`<button class="chip" data-rvmode="${k}" aria-pressed="${rvMode===k}">${t}</button>`).join("")}</div>
    <p class="note" style="margin:8px 0">${esc(m[3])}</p>
    <input id="rvQ" type="search" placeholder="${esc(m[2])}" value="${esc(rvQ)}" autocomplete="off" aria-label="${esc(m[1])}">
    <div id="rvRes">${reverseResHTML(p)}</div></div>`;
}
function reverseResHTML(p){
  const r=reverseLookup(p,rvMode,rvQ);
  const lk=x=>`<button class="tlink ${x.state||"na"}" ${x.kind==="risk"?`data-risk="${esc(x.id)}"`:x.kind==="act"?`data-act="${esc(x.id)}"`:`data-open="${esc(x.id)}"`}>${esc(x.label)}${x.note?`<span>${esc(x.note)}</span>`:""}</button>`;
  if(!rvQ.trim())return r.suggest.length?`<div class="rvsug"><span class="note">從專案資料挑一個開始：</span>${r.suggest.map(x=>`<button class="chip" data-rvq="${esc(x.q)}">${esc(x.label)}</button>`).join("")}</div>`:`<p class="note">專案裡還沒有可以查的資料。</p>`;
  return `${r.notes.map(n=>`<p class="rvnote">${esc(n)}</p>`).join("")}
    ${r.groups.map(g=>`<div class="rvgrp"><h4>${esc(g.title)}<span class="note">（${g.items.length}）</span></h4><div class="tlinks">${g.items.map(lk).join("")}</div></div>`).join("")}`;
}
document.addEventListener("click",e=>{
  if(tab!=="audit")return;
  const v=e.target.closest("[data-audv]");if(v){auditView=v.dataset.audv;rvFocus=false;renderAudit();return}
  const m=e.target.closest("[data-rvmode]");if(m){rvMode=m.dataset.rvmode;rvQ="";rvFocus=true;renderAudit();return}
  const q=e.target.closest("[data-rvq]");if(q){rvQ=q.dataset.rvq;rvFocus=false;renderAudit();return}
});
document.addEventListener("input",e=>{if(e.target.id!=="rvQ")return;rvQ=e.target.value;const r=$("#rvRes");if(r)r.innerHTML=reverseResHTML(cur())});
/* ---------- 模擬抽查 ---------- */
let spotN=5,spotRisk=true,spotOpenHist=null;
const SPOT_LABEL={ctl:{ok:"證據已確認",fail:"找不到或已過期",skip:"略過"},risk:{ok:"進度已確認",fail:"未如期執行",skip:"略過"}};
function activeSpot(p){const l=p.spots||[];const s=l[l.length-1];return s&&!s.done?s:null}
/* 抽查提問帶入這項控制措施的常見證據，負責人一看就知道要交什麼 */
function spotRequestText(x){const c=ANNEX_MAP[x.id],v=ctl(x.id);
  const co=coList(v);
  return `【ISMS 稽核前抽查】${v.owner?v.owner+" 您好，":""}請協助提供「${x.id} ${c.name}」最近一次執行的紀錄，例如${spotEvExample(c)}。目前登記的證據位置：${v.evidence||"（未填寫）"}。${co.length?`紀錄若在協辦單位（${co.join("、")}），也請協助轉請提供。`:""}謝謝！`}
function spotItemHTML(x,i){
  const p=cur(),done=!!x.result;
  let head,body;
  if(x.kind==="ctl"){const c=ANNEX_MAP[x.id],v=ctl(x.id);
    head=`<button class="ref" data-open="${x.id}"><span class="mono">${x.id}</span>${esc(c.name)}</button>`;
    body=`<div class="audask">稽核員會問：請出示最近一次執行的紀錄，例如${esc(spotEvExample(c))}。</div>
      <dl class="spotdl"><div><dt>你填的證據位置</dt><dd>${v.evidence?esc(v.evidence):`<span class="muted">（沒有填寫）</span>`}</dd></div>
      <div><dt>負責人</dt><dd>${v.owner?esc(v.owner):`<span class="muted">未指定</span>`}${coList(v).length?`<span class="saved">（協辦：${esc(coList(v).join("、"))}）</span>`:""}</dd></div>
      <div><dt>上次確認</dt><dd>${(x.result==="ok"?x.prev:v.checked)?esc(x.result==="ok"?x.prev:v.checked):`<span class="muted">從未</span>`}</dd></div></dl>`;
  }else{const r=riskById(x.id);
    head=r?`<button class="ref" data-risk="${x.id}"><span class="mono">${x.id}</span>${esc(r.title||"（未命名風險）")}</button>`:`<span class="mono">${x.id}</span>（風險已刪除）`;
    const d=r?planDue(r):null;
    body=`<div class="audask">稽核員會問：這個風險的處理計畫執行到哪裡？請出示進度或完成的紀錄。</div>
      ${r?`<dl class="spotdl"><div><dt>處理計畫</dt><dd>${r.plan?esc(r.plan):`<span class="muted">（沒有填寫）</span>`}</dd></div>
      <div><dt>預計完成</dt><dd>${r.due?esc(r.due):`<span class="muted">未設定</span>`}${dueTag(d)}</dd></div>
      <div><dt>處理狀態</dt><dd>${r.status?esc(r.status):`<span class="muted">未設定</span>`}</dd></div></dl>`:""}`;
  }
  const L=SPOT_LABEL[x.kind];
  return `<li class="spotitem ${x.result||"todo"}"><div class="spoth"><span class="spotn">${i+1}</span>${head}${(x.why||[]).map(w=>`<span class="spotwhy">${esc(w)}</span>`).join("")}</div>
    ${body}
    ${done?`<div class="spotres"><span class="ag ${x.result==="ok"?"ok":x.result==="fail"?"nc":"nd"}">${L[x.result]}</span>${x.act?`<button class="linkbtn" data-act="${x.act}">已建立改善事項 ${x.act} →</button>`:""}<button class="linkbtn" data-spotundo="${i}">改回未確認</button></div>`
      :`<div class="spotbtns"><button class="btn primary" data-spotres="${i}" data-r="ok">✓ ${L.ok}</button><button class="btn" data-spotres="${i}" data-r="fail">✕ ${L.fail}</button><button class="btn" data-spotres="${i}" data-r="skip">${L.skip}</button>${x.kind==="ctl"?`<button class="linkbtn" data-spotcopy="${i}" title="複製一段請負責人提供紀錄的文字">複製請求給負責人</button>`:""}</div>
      <p class="note" style="margin:6px 0 0">${x.kind==="ctl"?"打開證據位置，確認檔案存在、是最新的，而且真的能證明有在執行。":"對照實際進度與紀錄，確認是否照計畫執行。"}${x.kind==="ctl"?"「找不到或已過期」會自動建立一筆觀察事項。":"「未如期執行」會自動建立一筆觀察事項。"}</p>`}
  </li>`;
}
function spotHTML(p){
  const s=activeSpot(p),cand=spotCandidates(p),hist=(p.spots||[]).filter(x=>x.done).slice().reverse();
  const start=cand.ctls.length?`<div class="spotstart"><label>抽查 <select id="spotN">${[3,5,10].map(n=>`<option ${n===spotN?"selected":""}>${n}</option>`).join("")}</select> 項控制措施</label>
      ${cand.risks.length?`<label class="chk"><input type="checkbox" id="spotRisk" ${spotRisk?"checked":""}> 另外抽 ${spotN>=10?"2":"1"} 個高風險，追處理計畫</label>`:""}
      <button class="btn primary" id="spotGo">開始抽查</button><span class="note">可抽 ${cand.ctls.length} 項（已實施或已驗證的控制措施）</span></div>`
    :`<p class="note">還沒有標為「已實施」或「已驗證」的控制措施，落實後就可以抽查。</p>`;
  const st=s?spotStats(s):null;
  return `<section class="panel spot" id="spotPanel"><div class="secthead"><h3>模擬抽查</h3><span class="note">像稽核員一樣抽幾項，實際打開證據確認；結果會記錄下來，可匯出到 Excel 的「抽查紀錄」</span></div>
    ${s?`<div class="spotbar"><b>${esc(s.id)}　${esc(s.date)}</b><span class="note">已確認 ${st.ok}・找不到 ${st.fail}・略過 ${st.skip}・未完成 ${st.pending}</span><button class="btn" id="spotEnd" style="margin-left:auto">${st.pending?"結束抽查":"完成抽查"}</button></div>
      <ol class="spotlist">${s.items.map(spotItemHTML).join("")}</ol>`:start}
    ${hist.length?`<h4 style="margin:18px 0 6px">抽查紀錄</h4><ul class="spothist">${hist.map(h=>{const t=spotStats(h);return `<li><button class="spothh" data-spothist="${h.id}" aria-expanded="${spotOpenHist===h.id}"><b>${esc(h.id)}</b> ${esc(h.date)}　抽 ${t.total} 項：確認 ${t.ok}${t.fail?`・<span class="bad">找不到 ${t.fail}</span>`:""}${t.skip?`・略過 ${t.skip}`:""}${t.pending?`・未完成 ${t.pending}`:""}</button>
      ${spotOpenHist===h.id?`<ul class="spotdet">${h.items.map(x=>{const nm=x.kind==="ctl"?(ANNEX_MAP[x.id]||{}).name:((riskById(x.id)||{}).title||"");return `<li><span class="mono">${x.id}</span> ${esc(nm||"")}　<span class="${x.result==="fail"?"bad":"muted"}">${x.result?SPOT_LABEL[x.kind][x.result]:"未完成"}</span>${x.act?` <button class="linkbtn" data-act="${x.act}">${x.act}</button>`:""}</li>`}).join("")}</ul>`:""}</li>`}).join("")}</ul>`:""}
  </section>`;
}
function spotFail(p,s,x){
  const a={...blankAction(nextActionId(p)),type:"obs",source:"模擬抽查 "+s.id,raised:todayStr(),status:"待處理"};
  if(x.kind==="ctl"){const c=ANNEX_MAP[x.id];a.title=`抽查 ${x.id} ${c.name}：找不到證據或證據已過期`;a.refs=[x.id];a.owner=ctl(x.id).owner||""}
  else{const r=riskById(x.id);a.title=`抽查 ${x.id} ${(r&&r.title)||""}：風險處理計畫未如期執行`;a.refs=r?(r.controls||[]).slice(0,20):[];a.owner=(r&&r.owner)||""}
  p.actions=p.actions||[];p.actions.push(a);return a.id;
}
document.addEventListener("click",e=>{
  const p=cur();if(!p||tab!=="audit")return;
  if(e.target.closest("#spotGo")){const items=pickSpot(p,spotN,{risks:spotRisk});if(!items.length)return;
    p.spots=p.spots||[];p.spots.push({id:nextSpotId(p),date:todayStr(),done:false,items});touchRisk();renderAudit();
    const el=$("#spotPanel");if(el)el.scrollIntoView({block:"start"});return}
  if(e.target.closest("#spotEnd")){const s=activeSpot(p);if(s){s.done=true;touchRisk();renderAudit();toast(`已完成抽查 ${s.id}，紀錄可在 Excel 的「抽查紀錄」查看`)}return}
  const r=e.target.closest("[data-spotres]");if(r){const s=activeSpot(p),x=s&&s.items[+r.dataset.spotres];if(!x)return;
    x.result=r.dataset.r;
    if(x.kind==="ctl"&&x.result==="ok"){x.prev=ctl(x.id).checked||"";setField(x.id,"checked",todayStr(),{silent:true})}
    if(x.result==="fail")x.act=spotFail(p,s,x);
    touchRisk();renderAudit();if(x.act&&x.result==="fail")toast(`已建立觀察事項 ${x.act}，可到改善追蹤指定負責人與期限`);return}
  const u=e.target.closest("[data-spotundo]");if(u){const s=activeSpot(p),x=s&&s.items[+u.dataset.spotundo];if(!x)return;
    if(x.kind==="ctl"&&x.result==="ok")setField(x.id,"checked",x.prev||"",{silent:true});
    if(x.act){const i=p.actions.findIndex(a=>a.id===x.act),a=p.actions[i];if(a&&a.status==="待處理"&&!a.action&&!a.cause)p.actions.splice(i,1);x.act=""}
    x.result="";x.prev="";touchRisk();renderAudit();return}
  const cp=e.target.closest("[data-spotcopy]");if(cp){const s=activeSpot(p),x=s&&s.items[+cp.dataset.spotcopy];if(!x)return;const t=spotRequestText(x);
    const done=()=>toast("已複製，可以貼到 Email 或 Teams 給負責人");
    if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(t).then(done,()=>prompt("複製下面的文字",t));else prompt("複製下面的文字",t);return}
  const h=e.target.closest("[data-spothist]");if(h){spotOpenHist=spotOpenHist===h.dataset.spothist?null:h.dataset.spothist;renderAudit();return}
});
document.addEventListener("change",e=>{
  if(e.target.id==="spotN"){spotN=+e.target.value;renderAudit()}
  if(e.target.id==="spotRisk")spotRisk=e.target.checked});
function renderOverview(){
  const c=counts(), p=cur();
  const pct=c.app?Math.round(c.impl/c.app*100):0;
  const tAll=tally(ANNEX);
  const themeBars=THEMES.map(t=>{const list=ANNEX.filter(x=>x.theme===t.id);const tt=tally(list);const apl=list.length-tt.na-tt.undec;
    return `<div class="brow"><div class="blab"><span>A.${t.id} ${t.name}</span><span class="mono">${apl?`${tt.s2+tt.s3}/${apl}`:tt.undec?`未決定 ${tt.undec}`:`${tt.s2+tt.s3}/${apl}`}</span></div>${stackBar(tt,list.length,"theme:"+t.id)}</div>`}).join("");
  // owners
  const om={};
  const coN={};
  ANNEX.forEach(x=>{const v=ctl(x.code);if(v.app!=="Y")return;const o=v.owner.trim()||"未指派";(om[o]=om[o]||[]).push(x);coList(v).forEach(n=>coN[n]=(coN[n]||0)+1)});
  const owners=Object.entries(om).sort((a,b)=>(a[0]==="未指派")-(b[0]==="未指派")||b[1].length-a[1].length).slice(0,7);
  const omax=Math.max(1,...owners.map(o=>o[1].length));
  const ownerBars=owners.map(([o,list])=>{const tt=tally(list);
    return `<div class="brow"><div class="blab"><span>${esc(o)}</span><span class="mono">${list.length} 項${coN[o]?`<button class="cobtn" data-colist="${esc(o)}" data-tip="列出協辦的控制措施">＋協辦 ${coN[o]}</button>`:""}</span></div><div style="width:${Math.max(8,list.length/omax*100)}%">${stackBar(tt,list.length,"owner:"+o)}</div></div>`}).join("");
  const rows=THEMES.map(t=>{
    const list=ANNEX.filter(x=>x.theme===t.id);
    return `<div class="heat-row"><div class="lab"><span>A.${t.id}　${t.name}（${list.length} 項）</span></div><div class="cells">${
      list.map(x=>{const v=ctl(x.code);const k=v.app==="N"?"na":v.app===""?"undec":"";
        return `<button class="cell ${k} ${x.isNew?"new":""} ${FM[x.code]?"focus":""} ${v.app==="Y"&&v.status===3?"lvl3":""} ${v.app==="Y"?"st"+v.status:""}" style="background:${v.app==="Y"?lvlColor(v.status):""}" data-open="${x.code}" data-tip="${x.code} ${esc(x.name)}｜${v.app==="N"?"不適用":v.app===""?"未決定":STATUS[v.status].label}${FM[x.code]?"｜建議重點":""}" aria-label="${x.code} ${esc(x.name)}">${x.code.split(".")[2]}</button>`}).join("")}</div></div>`}).join("");
  $("#view-overview").innerHTML=`
    <h2>${esc(p.name)}</h2>
    <p class="lede">${p.scope?`驗證範圍：${esc(p.scope)}。`:""}附錄 A 共 93 項控制措施的適用與執行狀況。滑過圖表可看數字，點熱圖方格可查看說明並更新狀態。</p>
    ${kpiCards(p,c,pct)}
    <section class="panel ovstrip" aria-label="整體狀況">
      <div class="osbar"><div class="blab"><span>整體狀態</span><span class="mono">點色塊可查看項目</span></div>${stackBar(tAll,93,"all")}
        <div class="oslg">${SEGS.map(sg=>`<span ${tAll[sg.k]?`data-lseg="${sg.k}" data-lscope="all" role="button" tabindex="0"`:`class="zero"`}><i class="${sg.k==="na"?"na":sg.k==="undec"?"undec":""}" style="${sg.k.startsWith("s")?`background:var(--${sg.k})`:""}"></i>${sg.label} <b>${tAll[sg.k]}</b></span>`).join("")}</div></div>
      <div class="osth"><div class="blab osthh"><span>各主題進度</span><span class="mono">已實施／適用</span></div>${themeBars}</div>
    </section>
    ${nextCard(p)}
    <div class="grid2 ovgrid" style="margin-top:18px">
      <div class="panel">
        <h3>附錄 A 覆蓋熱圖</h3>
        ${rows}
        <div class="legend">
          ${STATUS.map(s=>`<span><i style="background:${lvlColor(s.v)}"></i>${s.label}</span>`).join("")}
          <span><i class="na"></i>不適用</span><span><i class="undec"></i>未決定</span>
          <span><i style="background:var(--seal);border-radius:50%;width:6px;height:6px"></i>2022 新增</span>
          ${Object.keys(FM).length?`<span><i style="background:transparent;box-shadow:inset 0 -3px 0 var(--focus)"></i>產業建議重點</span>`:""}
        </div>
      </div>
      <div style="display:grid;gap:18px;align-content:start">
        <div class="panel"><div class="secthead"><h3>負責人工作量</h3><button class="chip" data-goto="projects" data-anchor="pplPanel" style="margin-left:auto">管理名單</button></div>${ownerBars||`<p class="note">尚未指派負責人。</p>`}</div>
      </div>
    </div>
    ${focusPanel(p)}`;
}
/* tooltip */
(function(){
  const tip=document.createElement("div");tip.className="tip";tip.hidden=true;document.body.appendChild(tip);
  const show=(el,x,y)=>{tip.textContent=el.dataset.tip;tip.hidden=false;
    const w=tip.offsetWidth,h=tip.offsetHeight;let L=x+12,T=y-h-10;
    if(L+w>innerWidth-8)L=x-w-12; if(T<8)T=y+14; tip.style.left=L+"px";tip.style.top=T+"px"};
  document.addEventListener("pointermove",e=>{const el=e.target.closest&&e.target.closest("[data-tip]");if(el)show(el,e.clientX,e.clientY);else tip.hidden=true});
  document.addEventListener("pointerleave",()=>tip.hidden=true);
  document.addEventListener("focusin",e=>{const el=e.target.closest("[data-tip]");if(el){const r=el.getBoundingClientRect();show(el,r.left+r.width/2,r.top)}});
  document.addEventListener("focusout",()=>tip.hidden=true);
})();

const HINTS=["員工離職","勒索軟體","駭客攻擊","廠商遠端維護","筆電遺失","備份","AI 工具","個資外洩","寄錯人","A.8.13"];
function renderSearch(){
  const v=$("#view-search");
  if(!v.dataset.built){
    v.innerHTML=`<h2>案例搜尋</h2><p class="lede">輸入日常工作或發生的狀況，例如「同事離職」「中毒」「廠商要連進來」，系統會比對 ${CASES.length} 個內建案例並列出相關條款。也可以直接輸入條款編號。</p>
      <form class="searchbox" id="sForm"><input id="sInput" type="search" placeholder="描述一個情境或關鍵字…" autocomplete="off"><button class="btn primary">搜尋</button></form>
      <div class="hints">試試：${HINTS.map(h=>`<button class="chip" data-hint="${esc(h)}">${esc(h)}</button>`).join("")}</div>
      <div id="sCustom"></div>
      <div id="sResult"></div>`;
    v.dataset.built="1";
    $("#sForm").addEventListener("submit",e=>{e.preventDefault();searchQ=$("#sInput").value;renderSearchResult()});
    $("#sInput").addEventListener("input",e=>{searchQ=e.target.value;renderSearchResult()});
    v.addEventListener("click",e=>{const h=e.target.closest("[data-hint]");if(h){$("#sInput").value=h.dataset.hint;searchQ=h.dataset.hint;renderSearchResult()}
      const n=e.target.closest("[data-newcase]");if(n){openCaseDrawer(null)}
      const ed=e.target.closest("[data-editcase]");if(ed){openCaseDrawer(ed.dataset.editcase)}
      const lb=e.target.closest("[data-caselib]");if(lb){lb.dataset.caselib==="out"?exportCases():importCases()}});
    if(!searchQ){searchQ="員工離職";$("#sInput").value=searchQ}
  }
  renderSearchResult();
}
function customCases(){const p=cur();if(!p)return [];if(!Array.isArray(p.cases))p.cases=[];return p.cases}
function renderCustomBar(){
  const el=$("#sCustom");if(!el)return;const p=cur(),list=customCases();
  el.innerHTML=`<div class="cbar">${p?`<button class="btn" data-newcase>＋ 新增自訂案例</button>
    ${list.length?`<span class="saved">本專案的自訂案例（${list.length}）：</span>${list.slice(0,12).map(c=>`<button class="chip custom" data-hint="${esc(c.t)}">${esc(c.t)}</button>`).join("")}${list.length>12?`<span class="saved">…</span>`:""}`
      :`<span class="saved">自訂案例是組織自己的情境範本（例如公司特有的系統或流程），搜尋時會一起比對，新增風險時也能挑選；實際的風險評估仍記在風險評鑑。</span>`}`
    :`<span class="saved">開啟或建立專案後，可以新增組織自己的情境案例。</span>`}
    ${p?`<span class="cblib">${list.length?`<button class="btn" data-caselib="out" data-tip="存成案例庫檔案，可匯入其他專案重複使用">匯出案例庫</button>`:""}${p.archived||p.sample?"":`<button class="btn" data-caselib="in" data-tip="從案例庫檔案或其他專案的專案檔加入自訂案例，標題相同的會略過">匯入案例庫</button>`}</span>`:""}</div>`;
}
function exportCases(){
  const p=cur(),list=customCases();if(!p||!list.length)return;
  const name=(p.org||p.name||"專案").replace(/[\\/:*?"<>|]+/g,"_").slice(0,40);
  saveFile(`自訂案例庫_${name}_${list.length}個.json`,JSON.stringify(exportCaseLib(list),null,2),"application/json");
}
function importCases(){
  const p=cur();if(!p||p.archived||p.sample)return;
  const inp=document.createElement("input");inp.type="file";inp.accept=".json,application/json";
  inp.addEventListener("change",()=>{const f=inp.files[0];if(!f)return;
    if(f.size>MAX_IMPORT_BYTES){toast("檔案超過 5 MB");return}
    const rd=new FileReader();
    rd.onload=()=>{let r;
      try{r=mergeCaseLib(p,JSON.parse(rd.result))}catch(err){toast("無法匯入："+(err&&err.message&&/[\u4e00-\u9fff]/.test(err.message)?err.message:"請選擇案例庫或本工具的專案檔"));return}
      if(r.added)touchRisk();renderSearchResult();
      toast(`已加入 ${r.added} 個案例`+(r.dup?`，${r.dup} 個標題重複略過`:"")+(r.bad?`，${r.bad} 個格式不符略過`:"")+(r.full?`，${r.full} 個超過上限 ${CASE_LIB_MAX} 個`:""))};
    rd.readAsText(f)});
  inp.click();
}
function renderSearchResult(){
  renderCustomBar();
  const box=$("#sResult"); const q=searchQ.trim();
  if(!q){box.innerHTML=`<div class="empty">輸入關鍵字開始搜尋。</div>`;return}
  const r=search(q,customCases());
  if(!r.cases.length&&!r.direct.length){box.innerHTML=`<div class="empty">找不到「${esc(q)}」相關的案例。換個說法試試，例如用動作描述「帳號沒關」或設備名稱「防火牆」。${cur()?`<div style="margin-top:10px"><button class="btn" data-newcase>把這個情境新增為自訂案例</button></div>`:""}</div>`;return}
  box.innerHTML=`<div class="grid2">
    <div><h3>相關案例（${r.cases.length}）</h3><div class="cases">${r.cases.map(x=>`
      <article class="case ${x.c.custom?"custom":""}"><h4>${x.c.custom?`<span class="ctag2">自訂</span>`:""}${esc(x.c.t)}</h4>${x.c.s?`<p>${esc(x.c.s)}</p>`:""}
      <div class="refs">${x.c.r.map(refChip).join("")}</div>
      ${x.c.w?`<div class="rec"><b>為什麼</b>${esc(x.c.w)}</div>`:""}
      ${x.c.e?`<div class="rec"><b>應留紀錄</b>${esc(x.c.e)}</div>`:""}
      ${x.hit.length?`<div class="rec saved">符合關鍵字：${x.hit.map(esc).join("、")}</div>`:""}
      ${cur()?`<div class="caseact"><button class="btn" data-newrisk="${x.c.custom?x.c.id:CASES.indexOf(x.c)}">＋ 加入風險登錄表</button>${x.c.custom?`<button class="btn" data-editcase="${x.c.id}">編輯</button>`:""}</div>`:""}
      </article>`).join("")||`<div class="empty">沒有相符案例，可參考右側直接相符的條款。</div>`}</div></div>
    <div style="display:grid;gap:18px;align-content:start">
      ${r.refs.length?`<div class="panel"><h3>建議對應條款</h3><ul class="rank">${r.refs.map(x=>`<li>${refChip(x.code)}<span class="w">${x.pct}%</span></li>`).join("")}</ul><p class="note" style="margin:12px 0 0">依相符案例的關聯程度排序，圓點顏色為本專案目前狀態。</p></div>`:""}
      ${r.direct.length?`<div class="panel"><h3>名稱或編號直接相符</h3><div style="display:flex;flex-wrap:wrap;gap:6px">${r.direct.map(refChip).join("")}</div></div>`:""}
    </div></div>`;
}
function renderAnnex(){
  const v=$("#view-annex");
  if(!v.dataset.built){
    v.innerHTML=`<h2>附錄 A 逐項確認</h2><p class="lede">逐項決定是否適用、填寫理由與執行狀態。內容會自動儲存，可隨時匯出為適用性聲明（SoA）Excel。</p>
      <details class="panel lcwrap" ${lcOpen?"open":""} id="lcWrap"><summary><b>依產品／服務生命週期檢視</b><span class="note">從需求到退休，每個階段該注意哪些控制措施。階段依 ISO/IEC 24748 的生命週期概念整理，與控制措施的對應為本工具歸納，非標準規定；與附錄 A.8.25「安全開發生命週期」最直接相關。點階段可篩選下方清單</span></summary><div id="lcStrip"></div></details>
      <div class="filters">
        <div class="seg" id="themeSeg"><button data-th="all" aria-pressed="true">全部</button>${THEMES.map(t=>`<button data-th="${t.id}" aria-pressed="false">A.${t.id} ${t.name}</button>`).join("")}</div>
        <select id="stFilter" aria-label="狀態篩選"><option value="all">所有狀態</option>${recentApplied().size?`<option value="recent">本次從連動檢查設為適用（${recentApplied().size}）</option>`:""}<option value="undec">未決定適用性</option><option value="notimpl">適用但未實施</option><option value="N">不適用</option>${STATUS.map(s=>`<option value="${s.v}">${s.label}</option>`).join("")}<option value="new">2022 新增</option><option value="noreason">不適用但未填理由</option><option value="noevid">已驗證但未填證據位置</option><option value="noevany">已實施但未填證據位置</option><option value="verissue">已驗證但未記錄確認人或自我確認</option><option value="focus">產業建議重點</option><option value="nacand">可能不適用候選</option><option value="risk">有風險引用</option><option value="riskissue">風險連動待確認</option></select>
        <input id="qFilter" class="grow" type="search" placeholder="篩選編號、名稱或負責人">
        <button class="btn primary" id="xlsBtn" data-tip="正式文件格式，8 欄＋公式統計，可直接提供稽核">匯出稽核用 SoA</button><button class="btn" id="xlsFull" data-tip="含產業建議、關聯風險、風險登錄表、連動檢查等工作資訊">匯出工作底稿</button>
      </div>
      <div class="table-wrap"><table style="min-width:960px"><thead><tr><th>編號</th><th>控制措施</th><th style="width:112px">適用性</th><th style="min-width:220px">納入／排除理由</th><th style="width:136px">執行狀態</th><th style="width:140px">負責人</th><th style="min-width:170px">證據位置</th></tr></thead><tbody id="annexBody"></tbody></table></div>
      <div class="filters" style="margin-top:8px"><span class="count" id="annexCount"></span></div>`;
    v.dataset.built="1";
    $("#themeSeg").addEventListener("click",e=>{const b=e.target.closest("[data-th]");if(!b)return;filt.theme=b.dataset.th;
      $("#themeSeg").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b));renderAnnexRows()});
    $("#stFilter").addEventListener("change",e=>{filt.status=e.target.value;renderAnnexRows()});
    $("#lcWrap").addEventListener("toggle",e=>{lcOpen=e.target.open});
    $("#lcStrip").addEventListener("click",e=>{const b=e.target.closest("[data-lc]");if(!b)return;filt.lc=filt.lc===b.dataset.lc?"":b.dataset.lc;renderAnnexRows()});
    $("#qFilter").addEventListener("input",e=>{filt.q=e.target.value;renderAnnexRows()});
    $("#xlsBtn").addEventListener("click",()=>exportExcel("audit"));$("#xlsFull").addEventListener("click",()=>exportExcel());
    $("#annexBody").addEventListener("change",onAnnexEdit);
    $("#annexBody").addEventListener("input",e=>{if(e.target.matches("input,textarea"))onAnnexEdit(e)});
  }
  const sf=$("#stFilter");if(sf)sf.value=filt.status;
  renderAnnexRows();
}
function annexRow(c){
  const v=ctl(c.code);
  return `<tr data-code="${c.code}" class="${v.app==="N"?"isna":""} ${FM[c.code]?"focus":""}">
    <td class="code keep"><button data-open="${c.code}">${c.code}</button></td>
    <td class="name keep"><button class="fstar ${FM[c.code]?"on":""}" data-ftoggle="${c.code}" aria-pressed="${!!FM[c.code]}" aria-label="${FM[c.code]?"取消重點":"標為重點"}：${c.code}" data-tip="${FM[c.code]?"取消重點標示":"標為重點"}">${FM[c.code]?"★":"☆"}</button><span class="${FM[c.code]?"fname":""}">${esc(c.name)}</span>${c.isNew?'<span class="tag">2022 新增</span>':""}${FM[c.code]?`<span class="ftag" data-tip="${esc(FM[c.code].map(f=>FEATURE_MAP[f].label).join("、"))}">建議重點</span>`:""}${NAC[c.code]&&!v.app?`<span class="ctag" data-tip="${esc(NAC[c.code])}">可能不適用</span>`:""}${RBC[c.code]?`<span class="rtag ${v.app==="N"?"bad":""}" data-tip="${esc(RBC[c.code].map(id=>{const r=riskById(id);return id+" "+(r&&r.title||"")}).join("、"))}${v.app==="N"?"｜被風險引用卻判為不適用":""}">風險 ${RBC[c.code].length}</span>`:""}<div class="saved">${esc(c.desc)}</div></td>
    <td class="keep"><select data-f="app" aria-label="${c.code} 適用性">${APP.map(a=>`<option value="${a.v}" ${a.v===v.app?"selected":""}>${a.label}</option>`).join("")}</select></td>
    <td class="keep"><textarea rows="1" data-f="reason" data-reason="${c.code}" title="${esc(v.reason)}" autocomplete="off" class="${missingReason(v)?"warn":""}" aria-invalid="${missingReason(v)}" placeholder="${v.app==="N"?"選擇排除理由（必填）":"選擇或輸入理由"}" aria-label="${c.code} 理由" ${missingReason(v)?'data-tip="不適用的項目需要排除理由，稽核時會檢查"':""}>${esc(v.reason)}</textarea></td>
    <td><select data-f="status" class="stsel" style="border-left-color:${lvlColor(v.status)}" ${v.app==="N"?"disabled":""} aria-label="${c.code} 狀態">${STATUS.map(s=>`<option value="${s.v}" ${s.v===v.status?"selected":""}>${s.label}</option>`).join("")}</select></td>
    <td><input data-f="owner" data-owner autocomplete="off" value="${esc(v.owner)}" placeholder="選擇或輸入" ${v.app==="N"?"disabled":""} aria-label="${c.code} 負責人"></td>
    <td><input data-f="evidence" title="${esc(v.evidence)}" value="${esc(v.evidence)}" placeholder="${esc(c.ev.split("、")[0])}" ${v.app==="N"?"disabled":""} aria-label="${c.code} 證據"></td></tr>`;
}
let lcOpen=false;   // 附錄 A 的主要工作是逐項判定，生命週期檢視預設收合
function renderLcStrip(){
  const el=$("#lcStrip");if(!el)return;
  const box=(x,k)=>{const vs=x.codes.map(c=>ctl(c)),app=vs.filter(v=>v.app==="Y"),done=app.filter(v=>v.status>=2).length,und=vs.filter(v=>!v.app).length;
    const sel=filt.lc===x.id;
    return `${k?`<span class="lcarr" aria-hidden="true">→</span>`:""}<button class="lcbox ${sel?"sel":""}" data-lc="${x.id}" aria-pressed="${sel}" data-tip="${esc(x.desc)}">
      <span class="lcn"><i>${k+1}</i>${esc(x.name)}</span><span class="lcen">${esc(x.en)}</span>
      <span class="lcbar"><span style="width:${app.length?Math.round(done/app.length*100):0}%"></span></span>
      <span class="lcv">${app.length?`已實施 ${done}／${app.length}`:`${x.codes.length} 項`}${und?`・未判定 ${und}`:""}</span></button>`};
  el.innerHTML=`<div class="lcin"><span class="lcsrc">利害關係者<br>與 ICT 需求</span><span class="lcarr" aria-hidden="true">→</span>${LIFECYCLE.map(box).join("")}</div>
    <div class="lcnote"><span>查證確證未通過時，回到設計開發修正。</span>${filt.lc?`<span>篩選：${esc(LIFECYCLE_MAP[filt.lc].name)}－${esc(LIFECYCLE_MAP[filt.lc].desc)}</span><button class="chip" data-lc="${filt.lc}">清除篩選</button>`:""}</div>`;
}
function renderAnnexRows(){
  renderLcStrip();
  const q=norm(filt.q);
  const list=ANNEX.filter(c=>{const v=ctl(c.code);
    if(filt.theme!=="all"&&c.theme!==filt.theme)return false;
    if(filt.lc&&LIFECYCLE_MAP[filt.lc]&&!LIFECYCLE_MAP[filt.lc].codes.includes(c.code))return false;
    if(filt.status==="undec"&&v.app!=="")return false;
    if(filt.status==="notimpl"&&!(v.app==="Y"&&v.status<2))return false;
    if(filt.status==="N"&&v.app!=="N")return false;
    if(filt.status==="new"&&!c.isNew)return false;
    if(filt.status==="focus"&&!FM[c.code])return false;
    if(filt.status==="noreason"&&!missingReason(v))return false;
    if(filt.status==="noevid"&&!(v.app==="Y"&&v.status===3&&!String(v.evidence||"").trim()))return false;
    if(filt.status==="verissue"&&!(v.app==="Y"&&v.status===3&&(!String(v.verifier||"").trim()||selfVerified(v))))return false;
    if(filt.status==="noevany"&&!(v.app==="Y"&&v.status>=2&&!String(v.evidence||"").trim()))return false;
    if(filt.status==="nacand"&&!NAC[c.code])return false;
    if(filt.status==="recent"&&!recentApplied().has(c.code))return false;
    if(filt.status==="risk"&&!RBC[c.code])return false;
    if(filt.status==="riskissue"&&!(RBC[c.code]&&v.app!=="Y"))return false;
    if(/^\d$/.test(filt.status)&&(v.app!=="Y"||v.status!==+filt.status))return false;
    if(q&&!norm(c.code+" "+c.name+" "+c.desc+" "+v.owner).includes(q))return false;
    return true});
  requestAnimationFrame(()=>document.querySelectorAll("#annexBody textarea[data-reason]").forEach(fitReason));
  const filtered=filt.theme!=="all"||filt.status!=="all"||filt.q||filt.lc;
  $("#annexBody").innerHTML=list.map(annexRow).join("")||`<tr><td colspan="7"><div class="empty tblempty"><p style="margin:0 0 12px">沒有符合篩選條件的控制措施。${filtered&&undecN()&&filt.status!=="undec"?`還有 ${undecN()} 項未決定適用性，可以先判定適用性。`:""}</p>${filtered?`<div class="emptyacts"><button class="btn primary" id="annexClear">清除篩選，顯示全部 93 項</button></div>`:""}</div></td></tr>`;
  const ac=$("#annexClear");if(ac)ac.addEventListener("click",()=>{Object.assign(filt,{theme:"all",status:"all",q:"",lc:""});delete $("#view-annex").dataset.built;render()});
  $("#annexCount").textContent=`顯示 ${list.length} / 93 項`;
}
/* 理由欄自動換行並依內容調整高度，長理由不會被截斷 */
function fitReason(el){el.style.height="auto";const h=el.scrollHeight+2,max=98;el.style.height=Math.min(h,max)+"px";el.style.overflowY=h>max?"auto":"hidden";if(el===pickFor)placePicker()}   /* 最多約 4 行，再多就在欄內捲動，避免版面被撐開 */
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.defaultPrevented&&e.target.matches&&e.target.matches("textarea[data-reason]"))e.preventDefault()});
window.addEventListener("resize",()=>{if(tab==="annex")document.querySelectorAll("#annexBody textarea[data-reason]").forEach(fitReason)});
function onAnnexEdit(e){
  const el=e.target, tr=el.closest("tr[data-code]"); if(!tr||!el.dataset.f)return;
  const code=tr.dataset.code, f=el.dataset.f;
  if(f==="reason"&&/\n/.test(el.value))el.value=el.value.replace(/\s*\n\s*/g," ");   // 理由維持單行文字，只是顯示時換行
  if(!setField(code,f,el.value))return;
  if(f==="app"||f==="status"){const nr=document.createElement("tbody");nr.innerHTML=annexRow(ANNEX_MAP[code]);const row=nr.firstElementChild;tr.replaceWith(row);const ta=row.querySelector("textarea[data-reason]");if(ta)fitReason(ta)}
  else if(f==="reason"){const miss=missingReason(ctl(code));el.classList.toggle("warn",miss);el.setAttribute("aria-invalid",miss);fitReason(el)}
}
/* 條款依 PDCA 分組的完成情形：圓環點各階段可列出該階段的條款 */
function clPdcaHTML(){
  const ph=[["P","規劃","4、5、6 章：範圍、領導、風險與目標"],["D","執行","7、8 章：資源、能力、文件與運作"],["C","檢查","9 章：監督量測、內部稽核、管理審查"],["A","改善","10 章：持續改善與矯正措施"]];
  return `<div class="clring">${pdcaRing()}</div><div><h3 style="margin-top:0">PDCA 循環</h3><p class="note" style="margin:0 0 8px">管理系統條款依規劃、執行、檢查、改善分組。點圓環的階段可列出該階段的條款。</p>
    <ul class="clph">${ph.map(([k,n,d])=>{const l=CLAUSES.filter(x=>x.phase===k),dn=l.filter(x=>cls(x.code).status>=2).length;return `<li><b>${k} ${n}</b><span class="mono">${dn}/${l.length}</span><span class="note">${d}</span></li>`}).join("")}</ul></div>`}
function renderClauses(){
  const groups=[["4","組織前後環境"],["5","領導"],["6","規劃"],["7","支援"],["8","運作"],["9","績效評估"],["10","改善"]];
  $("#view-clauses").innerHTML=`<h2>管理系統條款 4–10</h2><p class="lede">本文條款不能排除，全部都要符合。逐條追蹤執行狀態與證據，驗證稽核時最先檢查的就是這些文件與紀錄。</p>
  <div class="panel clpdca" id="clPdca">${clPdcaHTML()}</div>
  <div class="table-wrap"><table style="min-width:900px;table-layout:fixed"><thead><tr><th style="width:64px">條款</th><th>名稱與說明</th><th style="width:60px">PDCA</th><th style="width:118px">執行狀態</th><th style="width:140px">負責人</th><th style="width:240px">證據位置</th></tr></thead><tbody id="clBody">
  ${groups.map(([ch,n])=>`<tr><td colspan="6" style="background:var(--surface2);font-weight:700;font-size:13px">第 ${ch} 章　${n}</td></tr>`+
    CLAUSES.filter(c=>c.code.split(".")[0]===ch).map(c=>{const v=cls(c.code);return `<tr data-cl="${c.code}">
    <td class="code"><button data-open="${c.code}">${c.code}</button></td>
    <td class="name">${esc(c.name)}<div class="saved" style="white-space:normal">${esc(c.desc)}</div></td>
    <td class="mono">${c.phase}</td>
    <td><select data-f="status" class="stsel" style="border-left-color:${lvlColor(v.status)}" aria-label="${c.code} 狀態">${STATUS.map(s=>`<option value="${s.v}" ${s.v===v.status?"selected":""}>${s.label}</option>`).join("")}</select></td>
    <td><input data-f="owner" data-owner autocomplete="off" value="${esc(v.owner)}" placeholder="選擇或輸入" aria-label="${c.code} 負責人"></td>
    <td><textarea data-f="evidence" class="evta" rows="1" placeholder="${esc(c.ev)}" title="${esc(v.evidence||c.ev)}" aria-label="${c.code} 證據">${esc(v.evidence)}</textarea></td></tr>`}).join("")).join("")}
  </tbody></table></div>`;
  const body=$("#clBody");
  const h=e=>{const el=e.target,tr=el.closest("tr[data-cl]");if(!tr||!el.dataset.f)return;
    if(setField(tr.dataset.cl,el.dataset.f,el.value)&&el.dataset.f==="status"){el.style.borderLeftColor=lvlColor(cls(tr.dataset.cl).status);const pd=$("#clPdca");if(pd)pd.innerHTML=clPdcaHTML()}};
  body.addEventListener("change",h);body.addEventListener("input",e=>{if(e.target.matches("input,textarea"))h(e);if(e.target.matches(".evta")){fitEv(e.target,true);e.target.title=e.target.value||e.target.placeholder}});
  /* 證據位置：平常只顯示一行，點進去展開成多行顯示完整內容，離開後收回 */
  body.addEventListener("focusin",e=>{if(e.target.matches(".evta"))fitEv(e.target,true)});
  body.addEventListener("focusout",e=>{if(e.target.matches(".evta"))fitEv(e.target,false)});
  body.addEventListener("keydown",e=>{if(e.target.matches(".evta")&&e.key==="Enter"&&!e.isComposing){e.preventDefault();e.target.blur()}});
}
function fitEv(el,open){el.style.height="";if(!open){el.scrollTop=0;return}const max=150,h=el.scrollHeight+2;if(h>el.offsetHeight)el.style.height=Math.min(h,max)+"px";el.style.overflowY=h>max?"auto":"hidden"}
let pendingDelete=null;
function renderProjects(){
  const list=Object.values(S.projects).sort((a,b)=>b.updated-a.updated);
  const p=cur();
  const ind=p?`<div class="panel" id="indBox" style="scroll-margin-top:120px"><h3>產業與業務特性</h3>
      <p class="note" style="margin:0 0 10px">用來標示附錄 A 的建議重點與相關法規，只做標示，不會改變判定。</p>
      <label class="lbl">產業<select id="pInd">${industryOptions(p.industry||"")}</select></label>
      <div class="fchips" style="margin-top:10px">${featureChips(projFeatures(p),"pF")}</div>
      <div class="form" style="align-items:center"><button class="btn primary" id="indSave">套用</button><span class="fcount" id="pCount"></span></div>
      ${p.sample?`<p class="note" style="margin:8px 0 0">範例中的調整不會儲存。</p>`:""}
    </div>`:"";
  const store=p&&!p.sample?`<div class="panel" id="storePanel"><h3>備份與儲存狀態</h3>
    <ul class="kvlist">
      <li><span>上次匯出專案檔</span><b>${p.lastBackupAt?fmtDate(p.lastBackupAt)+" "+fmtTime(new Date(p.lastBackupAt)):"從未"}</b></li>
      <li><span>之後的修改筆數</span><b>${p.changesSinceBackup||0}</b></li>
      <li><span>瀏覽器持久儲存</span><b id="persistVal">檢查中</b></li>
      <li><span>本工具資料大小</span><b id="usageVal">檢查中</b></li>
    </ul>
    <p class="note" style="margin:10px 0 0">修改超過 ${BACKUP_CHANGES} 筆或距上次備份超過 ${BACKUP_DAYS} 天時，頁面上方會提醒備份。清除瀏覽資料會刪除本工具的資料，請定期匯出專案檔。</p>
  </div>`:"";
  $("#view-projects").innerHTML=`<h2>專案管理</h2><p class="lede">切換與設定專案、建立新年度、匯出與備份。資料自動儲存在這個瀏覽器，換電腦或清除瀏覽資料前請先匯出專案檔。</p>
  <div class="grid2 pgrid"><div class="pcol">
    <div class="panel"><div class="secthead"><h3>我的專案</h3><button class="btn" id="pNew" style="margin-left:auto">＋ 新專案</button><button class="btn" id="jsonIn">匯入專案檔</button><button class="btn" id="xlsxIn">從 Excel 匯入</button></div>
      ${list.length?projRows(list,"projects"):`<div class="pempty">還沒有自己的專案。可以建立新專案，或匯入之前匯出的專案檔、填好的 SoA／風險評鑑 Excel。</div>`}
    </div>
    ${!p?"":p.sample?`<div class="panel"><h3>目前專案：${esc(p.name)}</h3><p class="note">這是範例專案，不能重新命名或匯出專案檔。想保留內容，請先複製成自己的專案。</p>
      <div class="form"><button class="btn primary" id="pCopy">以此範例建立我的專案</button><button class="btn" id="xls2">匯出稽核用 SoA</button><button class="btn" id="xlsFull2">匯出工作底稿</button></div></div>`:
    `<div class="panel"><h3>目前專案</h3>
      <div class="pform">
        <label class="lbl">專案名稱<span class="form" style="margin:0"><input id="renameIn" value="${esc(p.name)}" ${p.archived?"disabled":""}><button class="btn" id="renameBtn" ${p.archived?"disabled":""}>重新命名</button></span></label>
        <label class="lbl">驗證範圍<span class="form" style="margin:0"><input id="scopeIn" ${p.archived?"disabled":""} value="${esc(p.scope||"")}" placeholder="例如：總部資訊系統與客服中心"><button class="btn" id="scopeBtn" ${p.archived?"disabled":""}>更新範圍</button></span></label>
      </div>
      <div class="form"><button class="btn primary" id="xls2">匯出稽核用 SoA</button><button class="btn" id="xlsFull2">匯出工作底稿</button><button class="btn" id="jsonOut">匯出專案檔（JSON）</button>${p.archived?"":`<button class="btn" data-arch="1" data-tip="年度結束、驗證完成後封存，保留當時的完整狀態">封存為唯讀</button>`}</div>
      <p class="note" style="margin:10px 0 0"><b>稽核用 SoA</b>：正式文件格式（主題、編號、名稱、適用性、理由代碼、執行狀態、實施方式／排除理由、證據位置），統計用公式計算，可直接提供稽核。<b>工作底稿</b>：另含產業建議、關聯風險、風險登錄表、風險評鑑準則、連動檢查、改善追蹤、條款 4–10 檢核、統計摘要與修改紀錄，供內部追蹤。專案檔可在其他電腦匯入繼續編輯。</p>
    </div>`}
  </div>
  <div class="pcol">
    ${p?cycleBox(p):""}
    ${store}
  </div></div>
  ${p&&compareOpen?comparePanel(p):""}
  ${p?`<div class="grid2e">${ind}${docPanel(p)}</div>`:""}
  ${p?peoplePanel(p):""}
  ${p?`<div class="panel" style="margin-top:18px"><div class="secthead"><h3>最近修改</h3><span class="note">共 ${(p.log||[]).length} 筆，顯示最近 30 筆。完整紀錄會一併匯出到 Excel。</span></div>
    ${historyHTML((p.log||[]).slice(-30).reverse(),true)}</div>`:""}`;
  const v=$("#view-projects");
  const on=(id,fn)=>{const el=$("#"+id);if(el)el.addEventListener("click",fn)};
  on("pNew",()=>goNew());
  on("xlsxIn",()=>$("#xlsxFile").click());
  const dp=$("#docForm");if(dp)dp.addEventListener("input",e=>{const k=e.target.dataset.doc;if(!k)return;const p=cur();
    p.doc=sanitizeDoc({...(p.doc||{}),[k]:e.target.value});if(!p.sample){p.changesSinceBackup=(p.changesSinceBackup||0)+1}saveSoon();
    const d=p.doc,need=docNeedKeys(d);dp.querySelectorAll("[data-doc]").forEach(el=>el.classList.toggle("need",need.includes(el.dataset.doc)));
    const h=$("#docHint");if(h){h.textContent=docHint(d);h.classList.toggle("ok",!need.length)}
    const sv=$("#docSaved");if(sv&&!p.sample)sv.textContent="已自動儲存 "+new Date().toTimeString().slice(0,5)});
  if($("#storePanel")){ensurePersist().then(()=>{const el=$("#persistVal");if(el)el.textContent={yes:"已啟用",no:"未啟用（瀏覽器未同意）",unknown:"此瀏覽器不支援"}[persistState]});
    storageInfo().then(i=>{const el=$("#usageVal");if(el)el.textContent=`約 ${i.local} KB（瀏覽器上限通常約 5 MB）`})}
  if($("#indBox")){wireIndustry(v,"pInd","pF","pCount");
    on("indSave",()=>{const p=cur();p.industry=$("#pInd").value;p.features=readFeatures(v,"pF");save();resetBuilt();refreshFocus();toast("已套用：建議重點 "+Object.keys(FM).length+" 項")})}
  on("pCopy",()=>{copying=true;tab="overview";render();window.scrollTo(0,0)});
  on("renameBtn",()=>{const n=$("#renameIn").value.trim();if(n){cur().name=n;save();render();toast("已重新命名")}});
  on("scopeBtn",()=>{cur().scope=$("#scopeIn").value.trim();save();toast("已更新驗證範圍")});
  on("xls2",()=>exportExcel("audit"));on("xlsFull2",()=>exportExcel());
  on("cyNew",openRolloverDrawer);
  on("cyCmp",()=>{compareOpen=!compareOpen;renderProjects();if(compareOpen){const el=$("#cmpPanel");if(el)el.scrollIntoView({block:"start"})}});
  on("cmpClose",()=>{compareOpen=false;renderProjects()});
  on("cmpXls",exportComparison);
  const cs=$("#cmpBase");if(cs)cs.addEventListener("change",()=>{cmpBase=cs.value;renderProjects();$("#cmpBase").focus()});
  on("jsonOut",exportJSON);
  on("jsonIn",()=>$("#importFile").click());
}
/* ---------- 年度循環 ---------- */
let compareOpen=false,cmpBase="baseline";
function compareBases(p){
  const out=[];
  if(p.baseline)out.push({id:"baseline",label:`${p.baseline.label}（建立新年度時保存）`,base:p.baseline});
  Object.values(S.projects).filter(x=>x.id!==p.id).sort((a,b)=>b.updated-a.updated)
    .forEach(x=>out.push({id:x.id,label:`${x.name}${x.period?"｜"+x.period:""}`,base:{...x,label:x.period||x.name}}));
  return out;
}
function cycleBox(p){
  const can=compareBases(p).length>0;
  return `<div class="panel" id="cycBox" style="display:grid;gap:8px">
    <h3 style="margin:0">年度循環</h3>
    ${p.period||p.baseline?`<p class="note" style="margin:0">${p.period?"本專案："+esc(p.period):""}${p.period&&p.baseline?"｜":""}${p.baseline?`比較基準：${esc(p.baseline.label)}（${fmtDate(p.baseline.at)} 保存）`:""}</p>`:""}
    <p class="note" style="margin:0">每年重新評估風險、更新 SoA、準備管理審查時，可以從這個專案建立新年度，再和去年比較差異。</p>
    <div class="form" style="margin-top:0"><button class="btn" id="cyNew">建立新年度</button><button class="btn" id="cyCmp" ${can?"":`disabled data-tip="需要去年的快照或另一個專案"`} aria-expanded="${compareOpen}">${compareOpen?"收合比較":"與去年比較"}</button></div>
  </div>`;
}
function openRolloverDrawer(){
  const p=cur();if(!p)return;
  const np=nextPeriod(p,new Date());
  const nRisk=(p.risks||[]).filter(r=>inherentScore(r)).length;
  const nVer=Object.values(p.controls||{}).filter(v=>v.status===3).length+Object.values(p.clauses||{}).filter(v=>v.status===3).length;
  const nAct=(p.actions||[]).filter(a=>a.status!==ACTION_CLOSED).length;
  const d=sanitizeDoc(p.doc);
  const host=$("#drawerHost");
  host.innerHTML=`<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="建立新年度">
    <button class="btn x" data-close>關閉</button>
    <div class="code">條款 6.1、9.3</div><h2>建立新年度</h2>
    <p class="lede">以「${esc(p.name)}」為基礎複製一份新專案，原專案保持不變。新專案會保存去年的快照，之後可以直接比較兩年的差異。</p>
    <dl>
      <div><dt>新專案名稱</dt><dd><input id="roName" value="${esc(np.name)}" maxlength="120"></dd></div>
      <div><dt>新年度標示</dt><dd><input id="roPer" value="${esc(np.period)}" maxlength="20"></dd></div>
      <div><dt>去年標示</dt><dd><input id="roPrev" value="${esc(np.prevLabel)}" maxlength="20"></dd></div>
    </dl>
    <h3>會自動處理</h3>
    <ul class="rolist">
      <li>保留適用性、納入或排除理由、實施方式、負責人與風險內容</li>
      <li>${nVer?`<b>${nVer}</b> 項「已驗證」改為「已實施」，`:"「已驗證」改為「已實施」，"}提醒今年重新收集證據</li>
      <li>${nRisk?`<b>${nRisk}</b> 項風險`:"風險"}保留去年分數作為起點，標示「待重新評估」；擁有者核准需重新取得</li>
      <li>文件版次 ${esc(d.ver||"（未填）")} → ${esc(bumpVersion(d.ver)||"（未填）")}，日期與核准日期清空，狀態改回「草案」</li>
      <li>${nAct?`<b>${nAct}</b> 項`:""}未結案的改善事項帶入新年度繼續追蹤，已確認有效的留在去年的紀錄</li>
      <li>修改紀錄從新年度開始重新記錄</li>
      <li>去年的專案會封存為唯讀，保留當時的完整狀態；需要修正時可在專案管理解除封存</li>
    </ul>
    <div style="display:flex;gap:8px;margin-top:18px"><button class="btn primary" id="roGo">建立</button><button class="btn" data-close>取消</button></div>
  </aside>`;
  host.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",closeDrawer));
  $("#roGo").addEventListener("click",()=>{
    const {project:np2,summary:sm}=rolloverProject(p,{name:$("#roName").value.trim()||np.name,period:$("#roPer").value.trim(),prevLabel:$("#roPrev").value.trim()});
    if(S.projects[p.id]){S.projects[p.id].archived=true;delete RO_COPY[p.id]}   // 去年的專案封存為唯讀，避免誤改
    S.projects[np2.id]=np2;S.activeId=np2.id;copying=false;cmpBase="baseline";compareOpen=false;
    $("#drawerHost").innerHTML="";save();resetBuilt();tab="overview";render();window.scrollTo(0,0);ensurePersist();
    toast(`已建立「${np2.name}」：${sm.downgraded+sm.clauses} 項改回已實施、${sm.reassess} 項風險待重新評估${sm.carried?`、${sm.carried} 項改善事項帶入`:""}`);
  });
  $("#roName").focus();
}
function currentBase(p){
  const list=compareBases(p);
  return list.find(x=>x.id===cmpBase)||list[0]||null;
}
function cmpTable(head,rows,empty){
  return rows.length?`<div class="table-wrap"><table class="cmptable"><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,k)=>`<td${k===0?' class="code"':""}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`:`<p class="note">${empty}</p>`;
}
function comparePanel(p){
  const list=compareBases(p),b=currentBase(p);if(!b)return "";
  const d=compareProjects(b.base,p),ps=d.planStats;
  const sign=n=>n>0?`<span class="up">+${n}</span>`:n<0?`<span class="down">${n}</span>`:`<span class="saved">0</span>`;
  const code=c=>`<button class="ref mono" data-open="${c}">${c}</button>`;
  const rid=r=>(p.risks||[]).some(x=>x.id===r)?`<button class="ref mono" data-risk="${r}">${r}</button>`:`<span class="mono">${r}</span>`;
  const ca=id=>(p.actions||[]).some(x=>x.id===id)?`<button class="ref mono" data-act="${id}">${id}</button>`:`<span class="mono">${id}</span>`;
  const blk=(title,n,body)=>`<details class="cmpblk" ${n&&n<=12?"open":""}><summary><b>${title}</b><span class="count">${n} 項</span></summary>${body}</details>`;
  const res={"已完成":"ok","進行中":"","逾期未完成":"warn","狀態未填":"","風險已移除":""};
  const st=[...d.statusUp.map(x=>[code(x.code),esc(x.name),x.from,x.to,`<span class="up">進步</span>`]),
    ...d.statusDown.map(x=>[code(x.code),esc(x.name),x.from,x.to,x.from==="已驗證"&&x.to==="已實施"?`<span class="saved">待重新驗證</span>`:`<span class="down">退步</span>`])];
  const rk=[...d.added.map(r=>[rid(r.id),"新增",esc(r.title),"—",lvlBadge(inherentScore(r))]),
    ...d.removed.map(r=>[rid(r.id),"移除",esc(r.title),lvlBadge(inherentScore(r)),"—"]),
    ...d.changed.map(x=>[rid(x.id),x.dir==="up"?`<span class="down">分數上升</span>`:`<span class="up">分數下降</span>`,esc(x.title),lvlBadge(x.from)+(x.rFrom!==x.rTo?`<div class="saved">殘餘 ${x.rFrom||"—"}</div>`:""),lvlBadge(x.to)+(x.rFrom!==x.rTo?`<div class="saved">殘餘 ${x.rTo||"—"}</div>`:"")])];
  return `<div class="panel" style="margin-top:18px" id="cmpPanel">
    <div class="secthead"><h3>年度比較</h3><span class="note">管理審查（9.3.2）的輸入資料：前次決議處理情形、風險評鑑結果與處理計畫狀態</span></div>
    <div class="filters">
      <label class="cmpsel">比較基準<select id="cmpBase">${list.map(x=>`<option value="${esc(x.id)}" ${x.id===b.id?"selected":""}>${esc(x.label)}</option>`).join("")}</select></label>
      <button class="btn primary" id="cmpXls" style="margin-left:auto">匯出比較 Excel</button><button class="btn" id="cmpClose">收合</button>
    </div>
    ${d.criteriaChanged?`<p class="warnhint">兩個年度的風險準則不同，等級統計以本期準則計算。</p>`:""}
    <div class="table-wrap cmpsum"><table class="cmptable sum"><thead><tr><th>項目</th><th>${esc(d.base.label)}</th><th>${esc(d.cur.label)}</th><th>增減</th></tr></thead><tbody>
      ${d.summary.map(r=>`<tr><td>${esc(r.label)}</td><td class="num">${r.from}</td><td class="num">${r.to}</td><td class="num">${sign(r.diff)}</td></tr>`).join("")}

    </tbody></table></div>
    <p class="cmpplan"><b>去年處理計畫</b>共 ${ps.total} 項：完成 ${ps.done}、進行中 ${ps.open}、<span class="${ps.overdue?"down":""}">逾期 ${ps.overdue}</span>${ps.unknown?`、狀態未填 ${ps.unknown}`:""}、風險已移除 ${ps.removed}</p>
    ${blk("前次改善事項處理情形",d.prevActions.length,cmpTable(["編號","類型","事項","負責人","結果"],d.prevActions.map(x=>[ca(x.id),esc(ACTION_TYPE_MAP[x.type].label),esc(x.title),esc(x.owner),`<span class="rstate ${{"已結案":"ok","逾期未完成":"warn"}[x.result]||""}">${esc(x.result)}</span>`]),"比較基準沒有改善事項。可在「改善追蹤」分頁登錄稽核發現與管理審查決議。"))}
    ${blk("適用性變更",d.appChanges.length,cmpTable(["編號","控制措施",d.base.label,d.cur.label,"本期理由"],d.appChanges.map(x=>[code(x.code),esc(x.name),x.from,x.to,esc(x.reason)||`<span class="warnhint" style="display:inline">未填理由</span>`]),"適用性沒有變更。"))}
    ${blk("實施狀態變化",st.length,cmpTable(["編號","控制措施",d.base.label,d.cur.label,"變化"],st,"實施狀態沒有變化。"))}
    ${blk("風險變更",rk.length,cmpTable(["編號","類型","風險",d.base.label,d.cur.label],rk,"風險沒有增刪，分數也沒有變動。"))}
    ${blk("去年處理計畫追蹤",d.plans.length,cmpTable(["編號","風險","處理計畫","預計完成","結果"],d.plans.map(x=>[rid(x.id),esc(x.title),esc(x.plan),esc(x.due),`<span class="rstate ${res[x.result]}">${x.result}</span>`]),"去年沒有需要處理的風險。"))}
    <p class="note" style="margin-top:12px">Excel 包含比較摘要、前次改善事項、適用性變更、實施狀態變化、風險變更與處理計畫追蹤，可附在管理審查會議紀錄。內外部議題變化、利害關係者回饋等其他輸入請另行準備。</p>
  </div>`;
}
function exportComparison(){
  if(typeof writeXlsxFile!=="function"){toast("Excel 元件沒有載入，請確認 vendor/write-excel-file.min.js 存在");return}
  const p=cur(),b=currentBase(p);if(!b)return;
  writeXlsxFile(buildComparisonWorkbook(p,b.base)).toBlob()
    .then(blob=>saveFile(`年度比較_${safeName(p.name)}_${new Date().toISOString().slice(0,10)}.xlsx`,blob,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
    .catch(err=>{console.error(err);toast("Excel 產生失敗："+(err&&err.message||err))});
}
function goNew(){homePick="create";tab="home";render();const n=$("#hName");if(n){n.focus({preventScroll:true});$("#pk-create").scrollIntoView({block:"start"})}}
function resetBuilt(){["annex"].forEach(v=>delete $("#view-"+v).dataset.built)}
$("#xlsxFile").addEventListener("change",e=>{const f=e.target.files[0];e.target.value="";if(f)importExcelFile(f)});
/* 核准要填的欄位：狀態不是「已核准」時，標出還沒填的核准人、核准日期與狀態 */
const DOC_NEED=["approver","approvedAt","status"];
function docNeedKeys(d){return d.status==="已核准"?[]:DOC_NEED.filter(k=>k==="status"||!String(d[k]||"").trim())}
function docHint(d){const n=docNeedKeys(d);if(!n.length)return "已核准，核准資訊會印在匯出的 Excel 表頭。";
  const f=n.filter(k=>k!=="status").map(k=>({approver:"核准人",approvedAt:"核准日期"})[k]);
  return `要完成核准：${f.length?`填寫${f.join("、")}，並`:""}把狀態改為「已核准」。`}
function docPanel(p){
  const d=sanitizeDoc(p.doc),need=docNeedKeys(d);
  return `<div class="panel" id="docctl" style="margin-top:18px;scroll-margin-top:120px"><div class="secthead"><h3>文件管制資訊</h3><span class="note">會印在匯出 Excel 每個工作表的表頭（條款 7.5）。正式送審前請填寫並完成簽核。</span><span class="saved" id="docSaved" style="margin-left:auto">${p.sample?"範例不會儲存":"輸入後自動儲存"}</span></div>
    <p class="dochint ${need.length?"":"ok"}" id="docHint">${esc(docHint(d))}</p>
    <div id="docForm" class="docgrid">
      ${DOC_FIELDS.map(([k,l])=>`<label>${l}<input data-doc="${k}" value="${esc(d[k])}" ${k==="date"||k==="approvedAt"?'placeholder="例如 2026/10/25"':""} class="${need.includes(k)?"need":""}"></label>`).join("")}
      <label>狀態<select data-doc="status" class="${need.includes("status")?"need":""}">${DOC_STATUS.map(x=>`<option ${x===d.status?"selected":""}>${x}</option>`).join("")}</select></label>
    </div>${p.sample?`<p class="note" style="margin:8px 0 0">範例中的修改不會儲存。</p>`:""}</div>`;
}
$("#importFile").addEventListener("change",e=>{
  const f=e.target.files[0];e.target.value="";if(!f)return;
  if(f.size>MAX_IMPORT_BYTES){toast("檔案超過 5 MB，不像是本工具匯出的專案檔");return}
  const rd=new FileReader();
  rd.onload=()=>{try{
      const d=JSON.parse(rd.result);
      if(isObj(d)&&d.app&&d.app!=="isms-mapper")throw new Error("不是本工具的檔案");
      const p=sanitizeProject(isObj(d)&&d.project?d.project:d);
      S.projects[p.id]=p;S.activeId=p.id;save();resetBuilt();tab="overview";render();toast("已匯入："+p.name)}
    catch(err){toast("檔案格式不正確，請選擇本工具匯出的專案檔")}};
  rd.readAsText(f);
});



/* ================= 變更、復原與修改紀錄 ================= */
const TEXT_FIELDS=new Set(["reason","impl","owner","evidence"]);
function fmtStamp(t){return new Date(t).toLocaleString("zh-TW",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false})}
function logChange(code,f,from,to){
  const p=cur();if(!p||from===to)return;
  if(!p.sample){p.changesSinceBackup=(p.changesSinceBackup||0)+1;if(p.changesSinceBackup%5===0)renderBackupBanner()}
  p.log=p.log||[];const last=p.log[p.log.length-1],now=Date.now();
  // 連續輸入文字時合併成一筆
  if(last&&last.c===code&&last.f===f&&TEXT_FIELDS.has(f)&&now-last.t<60000){last.to=to;last.t=now;if(last.from===last.to)p.log.pop();return}
  p.log.push({t:now,c:code,f,from,to});
  if(p.log.length>3000)p.log.splice(0,p.log.length-3000);
}
function setField(code,f,val,opts={}){
  const isA=!!ANNEX_MAP[code];const v=isA?ctl(code):cls(code);
  if(f==="status")val=+val;
  const from=v[f];if(from===val)return false;
  v[f]=val;logChange(code,f,from,val);saveSoon();
  if(!opts.silent&&(f==="app"||f==="status"))
    undoToast(`${code} ${FIELD_LABEL[f]}：${fmtVal(f,from)} → ${fmtVal(f,val)}`,()=>{setField(code,f,from,{silent:true});rerenderAfterUndo(code)});
  return true;
}
let undoEl=null,undoTimer=null;
function undoToast(msg,fn,extra){
  if(undoEl)undoEl.remove();clearTimeout(undoTimer);
  const t=document.createElement("div");t.className="toast utoast";t.setAttribute("role","status");
  t.innerHTML=`<span></span>${extra?`<button type="button" class="ux"></button>`:""}<button type="button" class="uu">復原</button>`;t.firstChild.textContent=msg;
  t.querySelector(".uu").addEventListener("click",()=>{clearTimeout(undoTimer);t.remove();undoEl=null;fn();toast("已復原")});
  if(extra){const x=t.querySelector(".ux");x.textContent=extra.label;x.addEventListener("click",()=>{clearTimeout(undoTimer);t.remove();undoEl=null;extra.fn()})}
  document.body.appendChild(t);undoEl=t;
  undoTimer=setTimeout(()=>{t.remove();if(undoEl===t)undoEl=null},extra?10000:6000);
}
function rerenderAfterUndo(code){
  const host=$("#drawerHost");
  if(host.innerHTML){ if(host.querySelector("#dStatus"))openDrawer(code,!!lastList); else if(lastList)openList(lastList); }
  if(tab==="annex")renderAnnexRows();else if(tab==="clauses")renderClauses();else if(tab==="overview")renderOverview();
}
function historyHTML(entries,withCode){
  if(!entries.length)return `<p class="note">還沒有修改紀錄。</p>`;
  return `<ol class="hist">${entries.map(e=>`<li><time>${fmtStamp(e.t)}</time>${withCode?`<button class="hcode mono" data-open="${e.c}">${ANNEX_MAP[e.c]?e.c:"第 "+e.c+" 條"}</button>`:""}<span>${esc(FIELD_LABEL[e.f]||e.f)}：<s>${esc(fmtVal(e.f,e.from))}</s> → <b>${esc(fmtVal(e.f,e.to))}</b></span></li>`).join("")}</ol>`;
}


/* ================= 負責人名單 ================= */
function people(p){
  if(!p)return [];
  if(!Array.isArray(p.people)){ // 舊專案：從已填的負責人整理出名單
    const set=new Set();Object.values(p.controls||{}).concat(Object.values(p.clauses||{})).forEach(v=>{const o=String(v.owner||"").trim();if(o)set.add(o)});
    p.people=[...set];
  }
  return p.people;
}
function refreshOwnerList(){const dl=$("#ownerList");if(dl)dl.innerHTML=people(cur()).map(n=>`<option value="${esc(n)}"></option>`).join("")}
function addPerson(name,quiet){
  const p=cur();name=String(name||"").trim();if(!p||!name)return false;
  const ps=people(p);if(ps.includes(name))return false;
  ps.push(name);save();refreshOwnerList();
  if(!quiet)toast(`已將「${name}」加入負責人名單`);
  return true;
}
function assignedTo(name){
  const out=[];
  ANNEX.forEach(c=>{const v=ctl(c.code);if(v.owner.trim()===name)out.push(c.code)});
  CLAUSES.forEach(c=>{const v=cls(c.code);if(String(v.owner).trim()===name)out.push(c.code)});
  return out;
}
function renamePerson(oldN,newN){
  const p=cur();newN=String(newN||"").trim();if(!p||!newN||newN===oldN)return;
  assignedTo(oldN).forEach(code=>setField(code,"owner",newN,{silent:true}));
  [...ANNEX.map(c=>c.code),...CLAUSES.map(c=>c.code)].forEach(code=>{const v=ANNEX_MAP[code]?ctl(code):cls(code),l=coList(v);if(l.includes(oldN))setField(code,"co",normCo(l.map(x=>x===oldN?newN:x),v.owner),{silent:true})});
  const ps=people(p);p.people=ps.includes(newN)?ps.filter(n=>n!==oldN):ps.map(n=>n===oldN?newN:n);
  save();refreshOwnerList();toast(`已將「${oldN}」改為「${newN}」`);
}
function removePerson(name){
  const p=cur();if(!p)return;
  const codes=assignedTo(name);codes.forEach(code=>setField(code,"owner","",{silent:true}));
  [...ANNEX.map(c=>c.code),...CLAUSES.map(c=>c.code)].forEach(code=>{const v=ANNEX_MAP[code]?ctl(code):cls(code),l=coList(v);if(l.includes(name))setField(code,"co",normCo(l.filter(x=>x!==name),v.owner),{silent:true})});
  p.people=people(p).filter(n=>n!==name);save();refreshOwnerList();
  toast(codes.length?`已刪除「${name}」，${codes.length} 項改為未指派`:`已刪除「${name}」`);
}
// 在任何負責人欄位輸入完成後，新名字自動加入名單
document.addEventListener("change",e=>{const el=e.target;if(el.matches&&el.matches("[data-owner]"))addPerson(el.value)});
let personEdit=null,personDel=null;
function peoplePanel(p){
  const ps=people(p);
  const rows=ps.map(n=>{const k=assignedTo(n).length;
    if(personEdit===n)return `<li><input id="pplRename" value="${esc(n)}" aria-label="新名稱" style="flex:1 1 160px"><button class="btn primary" data-ppl="rsave" data-name="${esc(n)}">儲存</button><button class="btn" data-ppl="cancel">取消</button></li>`;
    if(personDel===n)return `<li><span class="pn">${esc(n)}</span><span class="saved">${k?`${k} 項會改為未指派`:"沒有指派任何項目"}</span><button class="btn danger" data-ppl="del2" data-name="${esc(n)}">確認刪除</button><button class="btn" data-ppl="cancel">取消</button></li>`;
    return `<li><span class="pn">${esc(n)}</span><button class="chip" data-ppl="show" data-name="${esc(n)}" ${k?"":"disabled"}>${k} 項</button><span class="pacts"><button class="btn" data-ppl="rename" data-name="${esc(n)}">重新命名</button><button class="btn" data-ppl="del" data-name="${esc(n)}">刪除</button></span></li>`}).join("");
  return `<div class="panel" style="margin-top:18px" id="pplPanel"><div class="secthead"><h3>負責人名單</h3><span class="note">在附錄 A、條款與詳情中輸入負責人時可直接選用。改名會同步更新所有已指派的項目。</span></div>
    ${ps.length?`<ul class="ppl">${rows}</ul>`:`<p class="note">名單是空的。新增後，負責人欄位就能直接選擇。</p>`}
    <form class="form" id="pplAdd"><input id="pplNew" placeholder="例如：資訊部 王經理" aria-label="新增負責人" style="flex:1 1 200px"><button class="btn primary">新增負責人</button></form></div>`;
}
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-ppl]");if(!b)return;
  const a=b.dataset.ppl,n=b.dataset.name;
  if(a==="rename"){personEdit=n;personDel=null}
  if(a==="del"){personDel=n;personEdit=null}
  if(a==="cancel"){personEdit=personDel=null}
  if(a==="rsave"){const v=$("#pplRename").value.trim();if(!v){toast("名稱不能空白");return}renamePerson(n,v);personEdit=null}
  if(a==="del2"){removePerson(n);personDel=null}
  if(a==="show"){openList({scope:"owner:"+n});return}
  renderProjects();
  if(a==="rename"){const i=$("#pplRename");if(i){i.focus();i.select()}}
});
document.addEventListener("submit",e=>{if(e.target.id!=="pplAdd")return;e.preventDefault();
  const v=$("#pplNew").value.trim();if(!v)return;
  if(!addPerson(v,true)){toast(`「${v}」已在名單中`);return}
  toast(`已新增「${v}」`);renderProjects();const i=$("#pplNew");if(i)i.focus()});
document.addEventListener("keydown",e=>{if(e.target.id==="pplRename"){
  if(e.key==="Enter"){e.preventDefault();document.querySelector('[data-ppl="rsave"]').click()}
  if(e.key==="Escape"){e.stopPropagation();personEdit=null;renderProjects()}}});


/* 下拉選單：負責人（單選）與納入／排除理由（可複選）。點進欄位顯示完整選項，打字時才過濾 */
const picker=document.createElement("div");picker.className="opick";picker.hidden=true;picker.setAttribute("role","listbox");document.body.appendChild(picker);
let pickFor=null,pickIdx=-1,pickItems=[],pickKind="";
const SEP="；";
function customReasons(){const p=cur();if(!p)return [];if(!Array.isArray(p.reasons))p.reasons=[];return p.reasons}
function placePicker(){if(!pickFor)return;const r=pickFor.getBoundingClientRect();
  const w=Math.max(r.width,pickKind==="reason"?320:220),left=Math.min(r.left,innerWidth-w-8);
  picker.style.width=Math.min(w,innerWidth-16)+"px";picker.style.left=Math.max(8,left)+"px";
  const below=innerHeight-r.bottom;picker.style.maxHeight=Math.max(160,Math.min(340,(below>220?below:r.top)-16))+"px";
  if(below>220||below>r.top){picker.style.top=(r.bottom+4)+"px";picker.style.bottom=""}else{picker.style.top="";picker.style.bottom=(innerHeight-r.top+4)+"px"}}
function ownerItems(el,q){
  const ps=people(cur()),cur0=el.value.trim(),items=[];
  (q?ps.filter(n=>n.toLowerCase().includes(q)):ps).forEach(n=>items.push({v:n,label:n,on:n===cur0}));
  if(q&&!ps.some(n=>n.toLowerCase()===q))items.push({v:el.value.trim(),label:`＋ 新增「${el.value.trim()}」`,add:true});
  if(cur0)items.push({v:"",label:"清除負責人",clear:true});
  return items;
}
function reasonItems(el,q){
  const code=el.dataset.reason,v=ctl(code),chosen=splitReasons(el.value),items=[];
  const has=x=>chosen.includes(x),match=x=>!q||x.toLowerCase().includes(q);
  const group=(title,list,extra={})=>{const l=list.filter(match);if(!l.length)return;items.push({head:title});l.forEach(x=>items.push({v:x,label:x,on:has(x),...extra}))};
  if(v.app!=="N")group("納入理由",REASONS_IN);
  if(v.app!=="Y"){
    const sug=NAC[code]?[code==="A.8.30"?"組織沒有委外開發活動":"組織沒有自行開發系統或程式"]:[];
    if(sug.length)group("依業務特性的建議",sug);
    group("排除理由",REASONS_OUT);
  }
  group("我的常用理由",customReasons(),{custom:true});
  const known=new Set([...REASONS_IN,...REASONS_OUT,...customReasons()]);
  const last=chosen[chosen.length-1];
  if(q&&last&&!known.has(last))items.push({v:last,label:`＋ 存為常用理由「${last}」`,save:true});
  if(chosen.length)items.push({v:"",label:"清除理由",clear:true});
  return items;
}
function showPicker(el,filterText){
  pickFor=el;pickKind=el.matches("[data-reason]")?"reason":"owner";
  let q=(filterText||"").trim();
  if(pickKind==="reason"){const parts=splitReasons(filterText);q=parts.length?parts[parts.length-1]:"";if(!filterText)q=""}
  q=q.toLowerCase();
  pickItems=pickKind==="reason"?reasonItems(el,q):ownerItems(el,q);
  if(pickIdx<0||pickIdx>=pickItems.length||pickItems[pickIdx].head)pickIdx=pickItems.findIndex(i=>i.on);
  picker.innerHTML=pickItems.length?pickItems.map((it,i)=>it.head?`<div class="oh">${esc(it.head)}</div>`:
    `<div class="oi ${it.on?"on":""} ${it.clear?"clr":""} ${it.add||it.save?"add":""} ${i===pickIdx?"hl":""}" role="option" aria-selected="${!!it.on}" data-i="${i}">
      <span class="pck">${pickKind==="reason"&&!it.clear&&!it.save?(it.on?"☑":"☐"):(it.on?"✓":"")}</span><span class="ol">${esc(it.label)}</span>${it.custom?`<button class="odel" data-odel="${esc(it.v)}" aria-label="從常用理由移除" title="從常用理由移除">×</button>`:""}</div>`).join("")
    :`<div class="oempty">${pickKind==="owner"?"名單是空的，直接輸入名字即可新增":"沒有符合的理由，直接輸入即可"}</div>`;
  if(pickKind==="reason")picker.insertAdjacentHTML("afterbegin",`<div class="ohint">可複選，選取的理由會以「；」分隔</div>`);
  picker.hidden=false;placePicker();
  const hl=picker.querySelector(".hl");if(hl)hl.scrollIntoView({block:"nearest"});
}
function hidePicker(){picker.hidden=true;pickFor=null;pickIdx=-1}
function commitValue(el,val){el.value=val;el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}))}
function pickAt(i){
  const it=pickItems[i],el=pickFor;if(!it||it.head||!el)return;
  if(pickKind==="owner"){commitValue(el,it.v);hidePicker();return}
  if(it.clear){commitValue(el,"");showPicker(el,"");return}
  let chosen=splitReasons(el.value);
  const known=new Set([...REASONS_IN,...REASONS_OUT,...customReasons()]);
  if(it.save){const list=customReasons();if(!list.includes(it.v)){list.push(it.v);save()}toast(`已存為常用理由`);commitValue(el,chosen.join(SEP));pickIdx=i;showPicker(el,"");return}
  // 打字到一半的文字若不是已知理由，選取選項時以選項取代
  const last=chosen[chosen.length-1];if(last&&!known.has(last)&&last!==it.v&&it.v.toLowerCase().includes(last.toLowerCase()))chosen.pop();
  chosen=chosen.includes(it.v)?chosen.filter(x=>x!==it.v):[...chosen,it.v];
  commitValue(el,chosen.join(SEP));pickIdx=i;showPicker(el,"");
}
picker.addEventListener("mousedown",e=>e.preventDefault());
picker.addEventListener("click",e=>{
  const d=e.target.closest("[data-odel]");
  if(d){e.stopPropagation();const p=cur();p.reasons=customReasons().filter(x=>x!==d.dataset.odel);save();toast("已從常用理由移除");if(pickFor)showPicker(pickFor,"");return}
  const o=e.target.closest("[data-i]");if(o)pickAt(+o.dataset.i)});
const PICKABLE="[data-owner],[data-reason]";
document.addEventListener("focusin",e=>{const el=e.target;if(el.matches&&el.matches(PICKABLE)&&!el.disabled){pickIdx=-1;showPicker(el,"")}});
document.addEventListener("click",e=>{const el=e.target;if(el.matches&&el.matches(PICKABLE)&&!el.disabled&&picker.hidden)showPicker(el,"")});
document.addEventListener("input",e=>{if(e.target===pickFor&&e.isTrusted){pickIdx=-1;showPicker(pickFor,pickFor.value)}});
document.addEventListener("focusout",e=>{if(e.target===pickFor)setTimeout(()=>{if(document.activeElement!==pickFor)hidePicker()},120)});
document.addEventListener("keydown",e=>{
  if(!pickFor||e.target!==pickFor||picker.hidden){if(pickFor&&e.target===pickFor&&e.key==="ArrowDown"){showPicker(pickFor,"");e.preventDefault()}return}
  const sel=pickItems.map((it,i)=>it.head?-1:i).filter(i=>i>=0);
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();if(!sel.length)return;
    let k=sel.indexOf(pickIdx);k=k<0?(e.key==="ArrowDown"?0:sel.length-1):(k+(e.key==="ArrowDown"?1:-1)+sel.length)%sel.length;pickIdx=sel[k];
    picker.querySelectorAll(".oi").forEach(o=>o.classList.toggle("hl",+o.dataset.i===pickIdx));
    const hl=picker.querySelector(".hl");if(hl)hl.scrollIntoView({block:"nearest"})}
  else if(e.key==="Enter"&&pickIdx>=0){e.preventDefault();pickAt(pickIdx)}
  else if(e.key==="Escape"){e.preventDefault();e.stopPropagation();hidePicker()}
},true);
window.addEventListener("scroll",()=>{if(pickFor)placePicker()},true);
window.addEventListener("resize",()=>{if(pickFor)placePicker()});

/* ================= 圖表點擊清單 ================= */
let lastList=null;
const SEG_LABEL=Object.fromEntries(SEGS.map(s=>[s.k,s.label]));
const SEG_FILTER={s0:"0",s1:"1",s2:"2",s3:"3",undec:"undec",na:"N"};
function listItems(scope,seg){
  let base=ANNEX, title="全部控制措施", f={theme:"all",status:SEG_FILTER[seg]||"all",q:""};
  if(scope.startsWith("theme:")){const t=THEMES.find(x=>x.id===scope.slice(6));base=ANNEX.filter(c=>c.theme===t.id);title=`A.${t.id} ${t.name}`;f.theme=t.id}
  else if(scope.startsWith("owner:")){const o=scope.slice(6);base=ANNEX.filter(c=>{const v=ctl(c.code);return v.app==="Y"&&(v.owner.trim()||"未指派")===o});title=o;f=o==="未指派"?null:{...f,q:o}}
  else if(scope==="focus"){base=ANNEX.filter(c=>FM[c.code]);title="產業建議重點";f=null}
  const items=seg?base.filter(c=>bucket(ctl(c.code))===seg):base;
  return {items,title:title+(seg?`・${SEG_LABEL[seg]}`:""),filter:f};
}
const undecN=()=>ANNEX.filter(c=>!ctl(c.code).app).length;
function emptyListMsg(seg){
  const n=undecN(),lab=seg?`「${SEG_LABEL[seg]}」的`:"";
  return `目前沒有${lab}控制措施。`+(n&&seg!=="undec"?`<br>還有 ${n} 項未決定適用性，判定為適用並更新執行狀態後，這裡就會列出。`:"");
}
function openList(spec){
  lastList=spec;
  let items,title,filter,seg=spec.seg,isClause=false;const isCo=!!spec.co;
  if(isCo){items=ANNEX.filter(c=>{const v=ctl(c.code);return v.app==="Y"&&coList(v).includes(spec.co)});title=spec.co+"・協辦的控制措施";filter=null}
  else if(spec.phase){const names={P:"規劃 Plan",D:"執行 Do",C:"檢查 Check",A:"改善 Act"};
    items=CLAUSES.filter(c=>c.phase===spec.phase);title="PDCA・"+names[spec.phase];filter=null;isClause=true}
  else ({items,title,filter}=listItems(spec.scope,seg));
  const row=c=>{const v=isClause?cls(c.code):ctl(c.code);const b=isClause?"s"+v.status:bucket(v);
    const lab=isClause?STATUS[v.status].label:(SEG_LABEL[b]);
    return `<button class="lrow ${(spec.seen||[]).includes(c.code)?"seen":""}" data-lopen="${c.code}"><span class="dot ${b==="na"?"na":b==="undec"?"undec":""}" style="${b.startsWith("s")?`background:var(--${b})`:""}"></span>
      <span class="mono">${isClause?"第 "+c.code+" 條":c.code}</span><span class="ln ${FM[c.code]?"fname":""}">${esc(c.name)}</span>
      <span class="lmeta">${isCo?"主責："+esc(v.owner||"未指定"):esc(v.owner||"")}${v.owner||isCo?"・":""}${lab}</span></button>`};
  const host=$("#drawerHost");
  host.innerHTML=`<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <button class="btn x" data-close>關閉</button>
    <div class="code">${isClause?"管理系統條款":"附錄 A"}・${items.length} 項</div>
    <h2>${esc(title)}</h2>
    ${isClause?"":`<p class="note">${isCo?"這個單位協助執行、但不是主責的控制措施。":""}點任一項可查看詳情並更新狀態。</p>`}
    ${spec.from&&!items.some(c=>c.code===spec.from)?`<p class="lgone" hidden>剛才查看的 <span class="mono">${esc(spec.from)}</span> 狀態已更新，不在這個清單了。</p>`:""}
    ${items.length?`<div class="llist">${items.map(row).join("")}</div>`:`<div class="empty">${emptyListMsg(seg)}</div>`}
    <div class="form" style="margin-top:16px">
      ${filter&&items.length?`<button class="btn primary" id="lGo">在附錄 A 中篩選這些項目</button>`:""}
      ${!items.length&&!isClause&&undecN()?`<button class="btn primary" id="lGoUndec">前往附錄 A 判定適用性 →</button>`:""}
      ${isClause?`<button class="btn primary" id="lGoCl">前往條款 4–10</button>`:""}
    </div></aside>`;
  host.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>{lastList=null;closeDrawer()}));
  host.querySelectorAll("[data-lopen]").forEach(b=>b.addEventListener("click",()=>{const a=host.querySelector("aside.drawer");
    spec.from=b.dataset.lopen;spec.scroll=a?a.scrollTop:0;spec.seen=[...new Set([...(spec.seen||[]),b.dataset.lopen])];openDrawer(b.dataset.lopen,true)}));

  const go=$("#lGo");if(go)go.addEventListener("click",()=>{Object.assign(filt,filter);lastList=null;$("#drawerHost").innerHTML="";delete $("#view-annex").dataset.built;tab="annex";render();window.scrollTo(0,0)});
  const gu=$("#lGoUndec");if(gu)gu.addEventListener("click",()=>{Object.assign(filt,{theme:"all",status:"undec",q:""});lastList=null;$("#drawerHost").innerHTML="";delete $("#view-annex").dataset.built;tab="annex";render();window.scrollTo(0,0)});
  const gc=$("#lGoCl");if(gc)gc.addEventListener("click",()=>{lastList=null;$("#drawerHost").innerHTML="";tab="clauses";render();window.scrollTo(0,0)});
  host.querySelector(".x").focus({preventScroll:true});
  // 從詳細頁返回：回到原本的捲動位置，標出剛才看的那一項
  if(spec.from){const a=host.querySelector("aside.drawer"),r=host.querySelector(`[data-lopen="${CSS.escape(spec.from)}"]`);
    if(a)a.scrollTop=spec.scroll||0;
    if(r){r.classList.add("lcur");if(a){const ar=a.getBoundingClientRect(),rr=r.getBoundingClientRect();if(rr.top<ar.top+60||rr.bottom>ar.bottom-20)r.scrollIntoView({block:"center"})}flashPanel(r)}
    else{const gone=host.querySelector(".lgone");if(gone)gone.hidden=false}}
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-colist]");if(b){e.preventDefault();e.stopPropagation();openList({co:b.dataset.colist})}},true);
function chartHit(e){
  const el=e.target.closest&&e.target.closest("[data-lseg],[data-lphase]");if(!el||!el.closest("#view-overview,#view-clauses"))return false;
  if(el.dataset.lphase)openList({phase:el.dataset.lphase});else openList({scope:el.dataset.lscope||"all",seg:el.dataset.lseg});
  return true;
}
document.addEventListener("click",e=>{chartHit(e)});
document.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&chartHit(e))e.preventDefault()});

/* ================= DRAWER ================= */
/* 開啟詳情時，在畫面上標出被點的方格或按鈕（浮在遮罩之上、側欄之下），讓人知道看的是哪一項 */
function markPicked(code){
  document.querySelectorAll(".picked").forEach(el=>el.classList.remove("picked"));
  const view=document.getElementById("view-"+tab);if(!view)return;
  view.querySelectorAll(`[data-open="${CSS.escape(code)}"]`).forEach(el=>el.classList.add("picked"));
}
/* 從詳細頁點到另一項（例如相關案例的「也對應到」）時記下來處，讓使用者可以返回；重新整理同一項時保留 */
let drawerTrail=[],drawerCode=null,riskDrawerId=null;
/* 目前開著的詳細頁（控制措施／條款或風險），跳到另一項前記下來，返回時恢復展開的案例與捲動位置 */
function drawerHere(){const d=document.querySelector("#drawerHost .drawer");if(!d)return null;
  if($("#dStatus")&&drawerCode)return {kind:"ctl",id:drawerCode,open:[...d.querySelectorAll('[data-casetoggle][aria-expanded="true"]')].map(b=>b.dataset.casetoggle),scroll:d.scrollTop};
  if($("#rTitle")&&riskDrawerId)return {kind:"risk",id:riskDrawerId,open:[],scroll:d.scrollTop};
  return null}
function pushTrail(){const h=drawerHere();if(!h)return false;drawerTrail.push(h);if(drawerTrail.length>10)drawerTrail.shift();return true}
function trailBackHTML(){if(!drawerTrail.length)return "";const p=drawerTrail[drawerTrail.length-1];
  const name=p.kind==="risk"?((riskById(p.id)||{}).title||""):((ANNEX_MAP[p.id]||CLAUSE_MAP[p.id]||{}).name||"");
  return `<button class="btn" id="dTrail" style="margin-bottom:10px">← 返回 ${esc(p.id)} ${esc(name)}</button>`}
function trailBack(){const p=drawerTrail.pop();if(!p)return;
  if(p.kind==="risk")openRiskDrawer(p.id,true);else openDrawer(p.id,!!lastList,true);
  const host=$("#drawerHost");
  p.open.forEach(i=>{const b=host.querySelector(`[data-casetoggle="${i}"]`),body=$("#rc"+i);if(b&&body){body.hidden=false;b.setAttribute("aria-expanded","true")}});
  const d=host.querySelector(".drawer");if(d)d.scrollTop=p.scroll}
document.addEventListener("click",e=>{if(e.target.closest("#dTrail")){e.preventDefault();trailBack()}});
function openDrawer(code,fromList,trail){
  if(!fromList)lastList=null;
  if(!trail&&(code!==drawerCode||!$("#drawerHost").innerHTML))drawerTrail=[];
  drawerCode=code;riskDrawerId=null;
  const isA=!!ANNEX_MAP[code]; const c=isA?ANNEX_MAP[code]:CLAUSE_MAP[code]; if(!c)return;
  const v=isA?ctl(code):cls(code);
  const rel=[...CASES,...customCases()].filter(x=>x.r.includes(code));
  markPicked(code);
  const host=$("#drawerHost");
  host.innerHTML=`<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="${esc(c.name)}">
    <button class="btn x" data-close>關閉</button>
    ${drawerTrail.length?trailBackHTML():lastList?`<button class="btn" id="dBack" style="margin-bottom:10px">← 返回清單</button>`:""}
    <div class="code">${isA?code:"第 "+code+" 條"}${isA&&c.isNew?' <span class="tag">2022 新增</span>':""}</div>
    <h2>${esc(c.name)}</h2>
    <p class="lede" style="margin-bottom:6px">${esc(c.desc)}</p>
    <p class="note"><b>常見證據：</b>${esc(c.ev)}</p>
    ${isA?`<div style="margin:10px 0"><button class="btn" data-ftoggle="${code}" style="${FM[code]?"border-color:var(--focus);color:var(--focus)":""}">${FM[code]?"★ 取消重點標示":"☆ 標為重點"}</button></div>`:""}
    ${isA&&!FM[code]&&(cur()&&(cur().focusOff||[]).includes(code))?`<p class="note">這一項原本是系統建議的重點，已被你取消。</p>`:""}
    ${isA&&FM[code]?`<div class="why"><b>建議重點</b>：依目前專案的設定<ul>${FM[code].map(f=>`<li>${esc(FEATURE_MAP[f].label)}：${esc(FEATURE_MAP[f].why)}</li>`).join("")}</ul></div>`:""}
    ${isA&&NAC[code]?`<div class="why" style="background:var(--surface2)"><b style="color:var(--muted)">可能不適用</b>：${esc(NAC[code])}。是否排除仍須依風險評鑑決定。</div>`:""}
    ${isA?riskLinkHTML(code,v):""}
    ${isA?`<div id="dTrace">${traceHTML(traceChain(cur(),"ctl",code))}</div>`:""}
    <dl>
      ${isA?`<div><dt>適用性</dt><dd><select id="dApp">${APP.map(a=>`<option value="${a.v}" ${a.v===v.app?"selected":""}>${a.label}</option>`).join("")}</select></dd></div>
      <div><dt>納入／排除理由</dt><dd><input id="dReason" data-reason="${code}" autocomplete="off" placeholder="選擇或輸入理由，可複選" value="${esc(v.reason)}" class="${missingReason(v)?"warn":""}" aria-describedby="dReasonHint"><small id="dReasonHint" class="warnhint" ${missingReason(v)?"":"hidden"}>不適用的項目需要填寫排除理由，SoA 稽核時會檢查。</small></dd></div>
      <div><dt>實施方式</dt><dd><textarea id="dImpl" rows="2" placeholder="如何落實，例如依哪份程序、由誰執行">${esc(v.impl||"")}</textarea><button type="button" class="linkbtn pmlink" data-cprompt="${code}">AI 提示詞：撰寫實施方式與證據清單</button></dd></div>`:""}
      <div><dt>執行狀態</dt><dd><select id="dStatus">${STATUS.map(s=>`<option value="${s.v}" ${s.v===v.status?"selected":""}>${s.label}</option>`).join("")}</select></dd></div>
      <div><dt>負責人</dt><dd><input id="dOwner" data-owner autocomplete="off" value="${esc(v.owner)}" placeholder="從名單選擇或輸入新名字"></dd></div>
      <div><dt>協辦單位</dt><dd><input id="dCo" autocomplete="off" list="ownerList" value="${esc(v.co||"")}" placeholder="跨單位執行時填寫，多個用「、」分隔，例如：人資處、總務課"></dd></div>
      <div id="dVerRow" ${v.status===3?"":"hidden"}><dt>確認人／確認日期</dt><dd><div class="r2x"><input id="dVer" data-owner autocomplete="off" value="${esc(v.verifier||"")}" placeholder="確認證據的人，最好不是負責人" aria-label="確認人"><input id="dVerAt" value="${esc(v.verifiedAt||"")}" placeholder="例如 2026-10-30" aria-label="確認日期"></div><small id="dVerHint" class="saved"></small></dd></div>
      <div><dt>證據位置</dt><dd><input id="dEv" value="${esc(v.evidence)}" placeholder="例如：\\\\fileserver\\ISMS\\${esc(code)}"></dd></div>
    </dl>
    ${relatedDocsHTML(code)}
    <h3>修改紀錄</h3>
    <div id="dHist">${historyHTML(((cur()&&cur().log)||[]).filter(e=>e.c===code).slice(-10).reverse(),false)}</div>
    <h3 style="margin-top:18px">相關案例（${rel.length}）</h3>
    <div class="relcases">${rel.map((x,i)=>{const b=caseBrief(x,code);return `<div class="relc"><button class="relh" data-casetoggle="${i}" aria-expanded="false" aria-controls="rc${i}"><span class="chev" aria-hidden="true">▸</span>${b.custom?`<span class="ctag2">自訂</span>`:""}${esc(b.t)}</button>
      <div class="relbody" id="rc${i}" hidden>${b.s?`<p>${esc(b.s)}</p>`:""}${b.w?`<div class="rec"><b>為什麼</b>${esc(b.w)}</div>`:""}${b.e?`<div class="rec"><b>應留紀錄</b>${esc(b.e)}</div>`:""}
        ${b.others.length?`<div class="rec"><b>也對應到</b><div class="refs">${b.others.map(refChip).join("")}</div></div>`:""}
        <button class="linkbtn" data-casego="${esc(b.t)}">在案例搜尋中查看 →</button></div></div>`}).join("")||`<p class="note">目前沒有內建案例對應到這一項。</p>`}</div>
  </aside>`;
  const FIELDS={dApp:"app",dReason:"reason",dImpl:"impl",dStatus:"status",dOwner:"owner",dEv:"evidence",dVer:"verifier",dVerAt:"verifiedAt",dCo:"co"};
  /* 已驗證時記錄確認人與日期；確認人和負責人相同時提醒，稽核會視為自我確認 */
  const syncVer=()=>{const row=$("#dVerRow");if(!row)return;row.hidden=v.status!==3;
    if(v.status===3&&!v.verifiedAt){v.verifiedAt=todayStr();const d=$("#dVerAt");if(d)d.value=v.verifiedAt;saveSoon()}
    const h=$("#dVerHint");if(h){const self=selfVerified(v);h.textContent=!String(v.verifier||"").trim()?"沒有記錄確認人時，稽核準備會列為觀察":self?"確認人與負責人相同，稽核會視為自我確認，建議由其他人確認":"";h.classList.toggle("warn",self)}};
  const refreshHist=()=>{const h=$("#dHist");if(h)h.innerHTML=historyHTML(((cur()&&cur().log)||[]).filter(e=>e.c===code).slice(-10).reverse(),false)};
  const syncWarn=()=>{const r=$("#dReason");if(!r)return;const miss=missingReason(v);r.classList.toggle("warn",miss);$("#dReasonHint").hidden=!miss};
  Object.entries(FIELDS).forEach(([id,f])=>{const el=$("#"+id);if(!el)return;
    const fn=()=>{if(f==="co"){const n=normCo(el.value,v.owner);el.value=n;coList({co:n}).forEach(x=>addPerson(x,true))}
      if(setField(code,f,f==="verifier"?el.value.trim():f==="co"?normCo(el.value,v.owner):el.value)){syncWarn();syncVer();refreshHist();const t=$("#dTrace");if(t)t.innerHTML=traceHTML(traceChain(cur(),"ctl",code))}};
    el.addEventListener(el.tagName==="SELECT"||id==="dCo"?"change":"input",fn)});
  syncVer();
  host.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>{lastList=null;closeDrawer()}));
  const back=$("#dBack");if(back)back.addEventListener("click",()=>{renderOverviewQuiet();openList(lastList)});
  host.querySelectorAll("[data-casetoggle]").forEach(b=>b.addEventListener("click",()=>{const body=$("#rc"+b.dataset.casetoggle);const open=body.hidden;body.hidden=!open;b.setAttribute("aria-expanded",String(open))}));
  host.querySelectorAll("[data-casego]").forEach(b=>b.addEventListener("click",()=>{closeDrawer();searchQ=b.dataset.casego;tab="search";
    const si=$("#sInput"); if(si) si.value=searchQ; render(); if($("#sInput")) $("#sInput").value=searchQ;}));
  host.querySelector(".x").focus();
}
/* 追蹤鏈：稽核員從這一項往下追的路線，斷掉的地方標紅；點連結開啟相關的風險、控制措施或改善事項（可返回） */
const traceOpen={ctl:true,risk:false};   // 控制措施的鏈短，預設展開；風險頁欄位多，預設收合只看摘要
const TRACE_ST={ok:"✓",warn:"待補強",bad:"斷掉",idle:""};
function traceHTML(ch){
  const open=traceOpen[ch&&ch.kind];
  if(!ch)return "";
  const sum=ch.broken?`<span class="ag nc">斷在「${esc(ch.broken)}」</span>`:ch.warn?`<span class="ag obs">${ch.warn} 處待補強</span>`:`<span class="ag ok">✓ 完整</span>`;
  const lk=l=>`<button class="tlink ${l.state}" ${l.kind==="risk"?`data-risk="${esc(l.id)}"`:l.kind==="act"?`data-act="${esc(l.id)}"`:`data-open="${esc(l.id)}"`}>${esc(l.label)}${l.note?`<span>${esc(l.note)}</span>`:""}</button>`;
  return `<details class="trace" data-kind="${ch.kind}" ${open?"open":""}><summary><b>追蹤鏈</b><span class="note">稽核員會這樣往下追</span>${sum}</summary>
    <ol class="tchain">${ch.nodes.map(n=>`<li class="${n.state}"><span class="tdot" aria-hidden="true"></span><div class="tbody">
      <div class="th"><b>${esc(n.label)}</b>${n.clause?`<span class="mono rcl">${esc(n.clause)}</span>`:""}${TRACE_ST[n.state]?`<span class="tst">${TRACE_ST[n.state]}</span>`:""}</div>
      <div class="tt">${esc(n.text)}</div>${n.links&&n.links.length?`<div class="tlinks">${n.links.map(lk).join("")}</div>`:""}</div></li>`).join("")}</ol></details>`;
}
document.addEventListener("click",e=>{const s=e.target.closest(".trace>summary");if(s)traceOpen[s.parentElement.dataset.kind]=!s.parentElement.open});
function riskLinkHTML(code,v){
  const ids=RBC[code]||[];
  if(!ids.length)return String(v.reason||"").includes(RISK_REASON)?`<div class="why" style="background:var(--surface2)"><b style="color:var(--muted)">風險評鑑</b>：納入理由是風險評鑑結果，但目前沒有風險引用這一項。可到「風險評鑑」把它加進對應的風險。</div>`:"";
  return `<div class="why rlink ${v.app==="N"?"bad":""}"><b>處理以下風險</b>${v.app==="N"?"（但目前判為不適用，請確認）":v.app===""?"（SoA 尚未判定）":""}
    <div class="rel" style="margin-top:6px">${ids.map(id=>{const r=riskById(id);return `<button data-risk="${id}"><span class="mono">${id}</span> ${esc(r&&r.title||"")} ${r?lvlBadge(inherentScore(r)):""}</button>`}).join("")}</div>
    ${v.app===""?`<button class="btn" data-apply="${code}" style="margin-top:8px">設為適用，理由填「${RISK_REASON}」</button>`:""}</div>`;
}
function renderOverviewQuiet(){if(tab==="overview")renderOverview()}
function closeDrawer(){$("#drawerHost").innerHTML="";drawerTrail=[];drawerCode=null;riskDrawerId=null;if(tab!=="search")render();else renderSearchResult()}
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("#drawerHost").innerHTML)closeDrawer()});
document.addEventListener("click",e=>{const o=e.target.closest("[data-open]");if(!o)return;e.preventDefault();
  if(o.closest(".drawer")&&o.dataset.open!==drawerCode&&pushTrail())openDrawer(o.dataset.open,!!lastList,true);
  else openDrawer(o.dataset.open)});

/* ================= 風險評鑑與處理 ================= */
const riskView={mode:"in",cell:null,stage:null,due:null};   // due：處理計畫期限篩選 late／soon／nodue
/* 風險管理流程圖：對應 ISO/IEC 27005 的流程，每一步顯示進度，點一下篩選卡在這一步的風險 */
/* 點流程圖的步驟：說明這一步做什麼、工具裡對應哪些欄位，以及可以直接做的動作 */
const RF_INFO={
  ctx:{what:"決定風險管理的範圍與規則：驗證範圍、內外部議題，以及風險準則（可能性、衝擊的定義與可接受水準）。",acts:[]},
  ident:{what:"找出可能影響機密性、完整性、可用性的事件：涉及哪些資產、有什麼威脅與脆弱性，並指定風險擁有者。",acts:[["new","新增風險"]]},
  anal:{what:"評估每個風險發生的可能性與衝擊，風險分數＝可能性 × 衝擊。可參考準則裡各級的定義與過去的事件。",acts:[["criteria","查看可能性與衝擊定義"]]},
  eval:{what:"把風險分數與準則比較，決定哪些須處理、哪些需擁有者核准、哪些可接受，排出處理的優先順序。",acts:[]},
  treat:{what:"選擇處理方式（降低、移轉、避免、接受），選定控制措施並寫處理計畫與期限。選定的控制措施在 SoA 必須是適用。",acts:[["goto:annex","前往附錄 A"]]},
  accept:{what:"評估處理後的殘餘風險；仍屬需核准等級的，由風險擁有者核准接受（6.1.3 f）。",acts:[]},
  consult:{what:"風險評鑑的每一步都要與風險擁有者、管理階層及相關人員溝通：評估結果、處理計畫與殘餘風險由誰決定、如何告知（7.4 溝通）。工具無法判斷溝通是否做到，請以會議紀錄或核准紀錄佐證。",acts:[]},
  record:{what:"保存風險評鑑與處理的文件化資訊（6.1.2、6.1.3、8.2、8.3），並向管理階層報告。匯出的工作底稿 Excel 含風險登錄表、風險評鑑準則與連動檢查，文件狀態改為「已核准」後即可作為紀錄。",acts:[["xls","匯出工作底稿 Excel"],["goto:projects","文件管制資訊"]]},
  monitor:{what:"定期與重大變更時重新評估，追蹤處理計畫是否如期完成。每年可在專案管理建立新年度。",acts:[["goto:projects","前往年度循環"]]}
};
/* 依尚未涵蓋的業務特性與 CIA 面向，從常見情境挑出可一鍵加入的風險 */
function identSuggestions(p){
  const rs=(p&&p.risks)||[],has=t=>rs.some(r=>r.title===t),out=[],seen=new Set();
  const push=(x,why)=>{if(seen.has(x[0])||has(x[0])||!CASES.some(c=>c.t===x[0]))return;seen.add(x[0]);out.push({title:x[0],asset:x[1],cia:x[2],why})};
  for(const fid of identMissFeatures(p))(SAMPLE_RISK_POOLS[fid]||[]).forEach(x=>push(x,FEATURE_MAP[fid].label));
  for(const [k,t] of [["C","機密性"],["I","完整性"],["A","可用性"]])
    if(!rs.some(r=>String(r.cia||"").includes(k)))SAMPLE_RISK_POOLS.base.filter(x=>x[2].includes(k)).slice(0,2).forEach(x=>push(x,t));
  return out.slice(0,8);
}
function identMissFeatures(p){
  const rs=(p&&p.risks)||[];
  return projFeatures(p).filter(fid=>{const f=FEATURE_MAP[fid];if(!f||!f.codes)return false;const pool=(SAMPLE_RISK_POOLS[fid]||[]).map(x=>x[0]);
    return !rs.some(r=>pool.includes(r.title)||(r.controls||[]).some(c=>f.codes.includes(c)))});
}
function addSuggestedRisk(s){
  const c=CASES.find(x=>x.t===s.title);if(!c)return null;
  return newRisk({title:c.t,threat:c.s,controls:c.r.filter(x=>ANNEX_MAP[x]),asset:s.asset,cia:s.cia});
}
/* 建立全景：直接在這裡填驗證範圍、確認風險準則，不必切換分頁 */
let ctxScopeEdit=false;   // 已有驗證範圍時預設只顯示文字，按「修改」才變成輸入框
function ctxEditHTML(p){
  if(!p)return "";const scopeOk=!!String(p.scope||"").trim(),critOk=p.criteriaOk!==false;
  return `<div class="idcov ctxedit">
    <div class="ctxrow"><span class="ctxk">${scopeOk?'<span class="ok">✓</span>':'<span class="miss">✗</span>'} 驗證範圍</span>
      ${scopeOk&&!ctxScopeEdit?`<span class="ctxv">${esc(p.scope)}</span><button class="btn" data-rfact="scopeedit">修改</button>`:
      `<input id="rfScope" value="${esc(p.scope||"")}" placeholder="例如：台北總部資訊機房與核心系統" aria-label="驗證範圍"><button class="btn primary" data-rfact="scope">儲存</button>`}</div>
    <div class="ctxrow"><span class="ctxk">${critOk?'<span class="ok">✓</span>':'<span class="miss">✗</span>'} 風險準則</span>
      <span class="ctxv">${esc(criteriaText(p))}${critOk?"":`<br><span class="miss">目前是預設值，請確認符合組織可接受的風險程度</span>`}</span>
      ${critOk?"":`<button class="btn primary" data-rfact="criteria">確認準則</button>`}</div>
    <p class="note">內外部議題（4.1，含氣候變遷判斷）與利害關係者（4.2）請在「條款 4–10」追蹤，並可用文件範本記錄。</p>
  </div>`;
}
/* 風險識別的涵蓋情形：只提供線索，是否完整由使用者確認 */
function identCoverageHTML(p){
  const rs=(p&&p.risks)||[];if(!rs.length)return "";
  const cia=[["C","機密性"],["I","完整性"],["A","可用性"]].map(([k,t])=>[t,rs.some(r=>String(r.cia||"").includes(k))]);
  const assets=new Set(rs.map(r=>String(r.asset||"").trim()).filter(Boolean)).size;
  const miss=identMissFeatures(p),sug=identSuggestions(p);
  return `<div class="idcov"><b>涵蓋情形</b>
    <span>${rs.length} 項風險・${assets} 種資產</span>
    <span>${cia.map(([t,ok])=>`<span class="${ok?"ok":"miss"}">${ok?"✓":"✗"} ${t}</span>`).join(" ")}</span>
    ${miss.length?`<span class="miss">尚未看到對應風險的業務特性：${miss.map(f=>esc(FEATURE_MAP[f].label)).join("、")}</span>`:""}
    ${sug.length?`<div class="idsug"><span class="note">建議補充（點一下加入，之後再評分與修改）：</span>
      ${sug.map((s,i)=>`<button class="chip" data-rfadd="${i}" data-tip="${esc("對應："+s.why)}">＋ ${esc(s.title)}</button>`).join("")}
      ${sug.length>1?`<button class="btn" data-rfadd="all">全部加入（${sug.length}）</button>`:""}</div>`:""}
    <p class="note">稽核會確認風險清單涵蓋驗證範圍內的主要資產與流程，實務上通常有數十項，只有幾項很難說明已完整識別。確認範圍內的人員、資訊、系統、實體環境與委外廠商都檢視過後再按確認。</p>
    <div class="identok">${p.identOk?"":`<input id="rfIdentBy" data-owner autocomplete="off" placeholder="確認人，例如資安小組召集人" aria-label="確認人" value="${esc(p.identBy||"")}">`}<button class="btn ${p.identOk?"":"primary"}" data-rfact="identok">${p.identOk?"取消確認":"確認風險識別完成"}</button>${p.identOk?` <span class="rstate ok">已確認涵蓋範圍${p.identBy?`（${esc(p.identBy)}${p.identAt?"，"+esc(p.identAt):""}）`:"（沒有記錄確認人）"}</span>`:""}</div>
  </div>`;
}
function rfInfoHTML(x){
  if(!x)return "";
  const info=RF_INFO[x.id]||{what:"",acts:[]},n=x.pending.length;
  const btn=([k,t])=>k==="xls"?`<button class="btn" data-rfact="xls">${t}</button>`:k==="new"?`<button class="btn" data-rfact="new">${t}</button>`:k==="criteria"?`<button class="btn" data-rfact="criteria">${t}</button>`:`<button class="btn" data-goto="${k.slice(5)}">${t}</button>`;
  return `<div class="rfinfo"><div class="rfih"><b>${esc(x.name)}</b><span class="mono rcl">${esc(x.clause)}</span>
      <span class="rstate ${x.done?"ok":n&&!x.info?"warn":""}">${x.neutral?"說明":x.done?"✓ 已完成":n?`${n} 項${esc(x.note)}`:"尚未完成"}</span><button class="chip rfclose" style="margin-left:auto">收合</button></div>
    <p>${esc(info.what)}</p>
    ${x.wait?`<p class="note" style="margin:-4px 0 8px">前面的步驟還沒完成（例如還有風險未評分，或風險識別尚未確認），完成後這一步才會打勾。</p>`:""}
    ${x.id==="ident"?identCoverageHTML(cur()):x.id==="ctx"?ctxEditHTML(cur()):""}
    <div class="rfiact">${n?`<span class="note">下方清單已篩選出這 ${n} 項。</span>`:x.neutral||x.wait||x.id==="record"||x.id==="ctx"?"":`<span class="note">這一步目前沒有待處理的風險。</span>`}${info.acts.map(btn).join("")}</div></div>`;
}
function riskFlowHTML(p){
  const st=riskStages(p),g=id=>st.find(x=>x.id===id);
  const box=x=>{const n=x.pending.length,cls=(x.neutral?"neutral":x.done?"done":x.idle?"idle":n&&!x.info?"todo":"")+(x.next?" next":"");const sel=riskView.stage===x.id;
    return `<button class="rfbox ${cls} ${sel?"sel":""}" data-rstage="${x.id}" aria-pressed="${sel}" aria-expanded="${sel}">
      <span class="rfn">${esc(x.name)}${x.done?` <span class="rfok" aria-label="已完成">✓</span>`:""}${x.next?` <span class="rfnext">下一步</span>`:""}</span><span class="rfen">${esc(x.en)}</span><span class="rfv">${esc(x.value)}</span></button>`};
  const arr=`<span class="rfarr" aria-hidden="true">→</span>`;
  const done=st.filter(x=>!x.side&&x.done).length,total=st.filter(x=>!x.side).length;
  return `<div class="rflow" aria-label="風險管理流程">
    <div class="rfhead"><b>風險管理流程</b><span class="note">ISO/IEC 27005、ISO 31000｜${done}／${total} 步完成。點任一步驟可看說明與該做的事；紅色表示有風險卡在這一步</span></div>
    <div class="rfrow">${box(g("ctx"))}${arr}
      <div class="rfgroup"><span class="rfglab">風險評鑑（Risk assessment，6.1.2）</span><div class="rfgin">${box(g("ident"))}${arr}${box(g("anal"))}${arr}${box(g("eval"))}</div></div>${arr}
      <div class="rfgroup"><span class="rfglab">風險處理（Risk treatment，6.1.3）</span><div class="rfgin">${box(g("treat"))}${arr}${box(g("accept"))}</div></div>
    </div>
    <div class="rfbands">${box(g("consult"))}${box(g("record"))}${box(g("monitor"))}</div>
    ${riskView.stage?rfInfoHTML(st.find(x=>x.id===riskView.stage)):`<p class="rfloop">溝通與諮詢、記錄與報告、監督與審查貫穿每一個步驟；每年與重大變更時重新評估，結果回到風險識別。</p>`}
  </div>`;
}
function risks(){const p=cur();if(!p)return [];if(!Array.isArray(p.risks))p.risks=[];return p.risks}
function riskById(id){return risks().find(r=>r.id===id)}
function lvlBadge(score){
  if(!score)return `<span class="rk rk-none">未評估</span>`;
  const l=riskLevel(score,cur());return `<span class="rk rk-${l.id}">${score} ${esc(l.label)}</span>`;
}
/* 「進度」是使用者填的處理狀態；「檢查」是風險與 SoA 連動檢查的結果，兩者分開顯示 */
function riskProgress(r){
  if(!inherentScore(r))return `<span class="muted">待評估</span>`;
  if(r.treat==="accept")return r.accepted?`<span class="rstate ok">已核准接受</span>`:`<span class="muted">接受</span>`;
  if(!r.treat)return `<span class="muted">—</span>`;
  return (r.status==="已完成"?`<span class="rstate ok">已完成</span>`:r.status?esc(r.status):`<span class="muted">未設定</span>`)+dueTag(planDue(r));
}
/* 處理計畫期限的小標籤：逾期紅色、即將到期黃色，其餘不顯示 */
function dueTag(d){
  if(!d)return "";
  if(d.state==="late")return `<span class="duetag late" data-tip="已超過預計完成日 ${-d.days} 天">逾期 ${-d.days} 天</span>`;
  if(d.state==="soon")return `<span class="duetag soon" data-tip="${PLAN_SOON_DAYS} 天內到期">${d.days?`剩 ${d.days} 天`:"今天到期"}</span>`;
  if(d.state==="nodue")return `<span class="duetag none">未設期限</span>`;
  return "";
}
const DUE_FILTER={late:"處理計畫逾期",soon:`處理計畫 ${PLAN_SOON_DAYS} 天內到期`,nodue:"處理計畫未設期限"};
function riskState(r,checks){
  if(r.reassess)return `<span class="rstate warn">待重新評估</span>`;
  const mine=checks.filter(c=>c.rid===r.id&&c.sev!=="info");
  if(!inherentScore(r))return `<span class="muted">—</span>`;
  const tag=r.id+(r.title?"「"+r.title+"」":"");
  const tip=mine.map(c=>c.msg.replace(tag,"").trim()).join("；");
  return mine.length?`<button class="rstate warn rchk" data-risk="${r.id}" data-tip="${esc(tip)}">待確認 ${mine.length}</button>`:`<span class="rstate ok">✓ 無問題</span>`;
}
function touchRisk(){const p=cur();if(!p)return;p.updated=Date.now();
  if(!p.sample){p.changesSinceBackup=(p.changesSinceBackup||0)+1;if(p.changesSinceBackup%5===0)renderBackupBanner()}
  saveSoon()}
function newRisk(init){
  const p=cur();if(!p)return null;
  const r=Object.assign(blankRisk(nextRiskId(p)),init||{});
  risks().push(r);touchRisk();return r;
}
function deleteRisk(id){
  const list=risks(),i=list.findIndex(r=>r.id===id);if(i<0)return;
  const [r]=list.splice(i,1);touchRisk();$("#drawerHost").innerHTML="";render();
  undoToast(`已刪除 ${r.id}${r.title?" "+r.title:""}`,()=>{list.splice(i,0,r);touchRisk();render()});
}
/* 新增風險：先從案例挑一個情境（帶入描述、威脅與建議的控制措施），或建立空白風險 */
const PICK_HINTS=["離職","勒索","釣魚","遠端","備份","停電","廠商","個資","筆電","密碼","雲端","漏洞"];
function openRiskPicker(){
  if(!cur())return;
  const host=$("#drawerHost");let q="";
  const has=t=>risks().some(r=>r.title===t);
  const keyOf=c=>c.id&&/^C-/.test(c.id)?c.id:String(CASES.indexOf(c));
  const item=c=>`<li><div class="pkbody"><b>${esc(c.t)}</b>${c.id&&/^C-/.test(c.id)?`<span class="ctag">自訂</span>`:""}${has(c.t)?`<span class="ctag">已登錄</span>`:""}
      <span class="saved">${esc(c.s)}</span>
      <span class="pkcodes">${c.r.filter(x=>ANNEX_MAP[x]).slice(0,4).map(x=>`<span class="mono">${x}</span>`).join(" ")}</span></div>
    <button class="btn" data-pick="${esc(keyOf(c))}">建立</button></li>`;
  const list=()=>{
    const custom=customCases();
    if(!q.trim())return custom.length?`<h3 style="margin:14px 0 6px">組織的自訂案例</h3><ul class="pklist">${custom.map(item).join("")}</ul>`:
      `<p class="note" style="margin-top:14px">輸入關鍵字，或點上面的常見情境。共有 ${CASES.length} 個內建案例可以挑選。</p>`;
    const r=search(q,custom).cases.map(x=>x.c);
    return r.length?`<ul class="pklist" style="margin-top:12px">${r.slice(0,8).map(item).join("")}</ul>`:`<p class="note" style="margin-top:14px">找不到相符的案例。可以換個說法，或建立空白風險自己填寫。</p>`;
  };
  host.innerHTML=`<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="新增風險">
    <button class="btn x" data-close>關閉</button>
    <div class="code">條款 6.1.2</div><h2>新增風險</h2>
    <p class="lede">從常見情境挑一個當起點，會帶入描述、威脅與建議的控制措施，之後再依公司情況修改與評分。</p>
    <label class="lbl">搜尋情境<input id="pkQ" autocomplete="off" placeholder="例如：同事離職、廠商遠端連線、勒索軟體"></label>
    <div class="hints" style="margin:8px 0 0">${PICK_HINTS.map(h=>`<button class="chip" data-pkh="${h}">${h}</button>`).join("")}</div>
    <div id="pkList">${list()}</div>
    <div class="pkblank"><span class="note">沒有合適的情境？</span><button class="btn" id="pkBlank">建立空白風險</button></div>
  </aside>`;
  const upd=()=>{$("#pkList").innerHTML=list()};
  $("#pkQ").addEventListener("input",e=>{q=e.target.value;upd()});
  host.querySelectorAll("[data-pkh]").forEach(b=>b.addEventListener("click",()=>{q=b.dataset.pkh;$("#pkQ").value=q;upd();$("#pkQ").focus()}));
  host.querySelector("aside").addEventListener("click",e=>{const b=e.target.closest("[data-pick]");if(!b)return;riskFromCase(b.dataset.pick)});
  $("#pkBlank").addEventListener("click",()=>{const r=newRisk();host.innerHTML="";renderRisks();openRiskDrawer(r.id)});
  host.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",closeDrawer));
  $("#pkQ").focus();
}
function riskFromCase(idx){
  const c=/^C-/.test(idx)?customCases().find(x=>x.id===idx):CASES[+idx];if(!c||!cur())return;
  const r=newRisk({title:c.t,threat:c.s,controls:c.r.filter(x=>ANNEX_MAP[x])});
  Object.defineProperty(r,"fromCase",{value:true,enumerable:false});   // 只在這次開啟時提示，不存檔
  tab="risks";render();window.scrollTo(0,0);openRiskDrawer(r.id);
  toast(`已建立 ${r.id}，請評估可能性與衝擊`);
}
/* 本次從連動檢查設為適用的控制措施：還要補負責人、執行狀態與證據，在連動檢查下方提醒，並可在附錄 A 篩出來 */
const RECENT={pid:null,set:new Set()};
function recentApplied(){const p=cur();const id=p&&(p.id||S.activeId);if(RECENT.pid!==id){RECENT.pid=id;RECENT.set=new Set()}return RECENT.set}
function recentPending(){return [...recentApplied()].filter(c=>{const v=ctl(c);return v.app==="Y"&&((v.status||0)<2||!String(v.owner||"").trim())})}
const NEED_TXT="還需要補：負責人、執行狀態、證據位置";
function gotoRecent(){Object.assign(filt,{theme:"all",status:"recent",q:"",lc:""});$("#drawerHost").innerHTML="";delete $("#view-annex").dataset.built;tab="annex";render();window.scrollTo(0,0)}
/* 一次把所有風險引用、但 SoA 尚未判定的控制措施設為適用（可復原） */
function applyAllRiskToSoA(){
  const codes=[...new Set(riskChecks(cur()).filter(c=>c.kind==="undecided").map(c=>c.code))];if(!codes.length)return;
  const before=codes.map(c=>({c,reason:ctl(c).reason}));
  codes.forEach(code=>{const v=ctl(code);setField(code,"app","Y",{silent:true});
    if(!splitReasons(v.reason).includes(RISK_REASON))setField(code,"reason",[...splitReasons(v.reason),RISK_REASON].join(SEP),{silent:true})});
  codes.forEach(c=>recentApplied().add(c));
  undoToast(`${codes.length} 項已設為適用（依風險評鑑結果）。${NEED_TXT}`,()=>{before.forEach(({c,reason})=>{setField(c,"reason",reason,{silent:true});setField(c,"app","",{silent:true});recentApplied().delete(c)});render()},
    {label:"前往附錄 A",fn:gotoRecent});
  render();
}
/* 把風險引用、但 SoA 尚未判定的控制措施設為適用，並補上納入理由（使用者按下才執行） */
function applyRiskToSoA(code){
  const v=ctl(code);if(v.app!=="")return;
  setField(code,"app","Y",{silent:true});
  if(!splitReasons(v.reason).includes(RISK_REASON))setField(code,"reason",[...splitReasons(v.reason),RISK_REASON].join(SEP),{silent:true});
  recentApplied().add(code);
  undoToast(`${code} 已設為適用（依風險評鑑結果）。${NEED_TXT}`,()=>{setField(code,"reason","",{silent:true});setField(code,"app","",{silent:true});recentApplied().delete(code);render()},
    {label:`開啟 ${code}`,fn:()=>openDrawer(code)});
  render();
}
function riskMatrix(mode){
  const pick=mode==="res"?(r=>[r.rl,r.ri]):(r=>[r.l,r.i]);
  const cnt={};risks().forEach(r=>{const [l,i]=pick(r);if(riskScore(l,i))cnt[l+"-"+i]=(cnt[l+"-"+i]||0)+1});
  const p=cur();let cells="";
  for(let i=5;i>=1;i--){
    cells+=`<div class="mx-y" title="${IMPACT[i]}">${i}</div>`;
    for(let l=1;l<=5;l++){const s=l*i,lv=riskLevel(s,p),n=cnt[l+"-"+i]||0,sel=riskView.cell===l+"-"+i;
      cells+=`<button class="mx rk-${lv.id} ${lv.policy==="accept"?"acc":""} ${sel?"sel":""}" data-mx="${l}-${i}" ${n?"":"disabled"} aria-label="可能性 ${l}、衝擊 ${i}，${n} 項" data-tip="可能性 ${l} ${LIKELIHOOD[l]} × 衝擊 ${i} ${IMPACT[i]} = ${s} 分（${esc(lv.label)}・${POLICIES.find(x=>x.v===lv.policy).label}）${n?"｜"+n+" 項":""}">${n||""}</button>`}
  }
  cells+=`<div></div>`+[1,2,3,4,5].map(l=>`<div class="mx-x" title="${LIKELIHOOD[l]}">${l}</div>`).join("");
  return `<div class="mxwrap"><div class="mx-ylab">衝擊</div><div class="matrix">${cells}</div><div class="mx-xlab">可能性</div></div>`;
}
function checkRow(c){
  const act=c.kind==="undecided"?`<button class="btn" data-apply="${c.code}">設為適用</button>`:
    c.kind==="conflict"||c.kind==="orphan"?`<button class="btn" data-open="${c.code}">查看 ${c.code}</button>`:"";
  const open=c.rid?`<button class="btn" data-risk="${c.rid}">開啟 ${c.rid}</button>`:"";
  return `<li class="ck ${c.sev}"><span class="ckmsg">${esc(c.msg)}</span><span class="ckact">${act}${c.kind!=="orphan"?open:""}</span></li>`;
}
let showAllChecks=false;
function renderRisks(){
  const p=cur(),list=risks(),checks=riskChecks(p);
  const issues=checks.filter(c=>c.sev!=="info"),info=checks.filter(c=>c.sev==="info");
  const pickScore=riskView.mode==="res"?residualScore:inherentScore;
  const stg=riskView.stage?riskStages(p).find(x=>x.id===riskView.stage):null;
  const dueOf=r=>(planDue(r)||{}).state,dueN=k=>list.filter(r=>dueOf(r)===k).length;
  const shown=riskView.cell?list.filter(r=>{const [l,i]=riskView.mode==="res"?[r.rl,r.ri]:[r.l,r.i];return l+"-"+i===riskView.cell}):riskView.due?list.filter(r=>dueOf(r)===riskView.due):stg&&stg.pending.length?list.filter(r=>stg.pending.includes(r.id)):list;
  const dueChips=["late","soon","nodue"].filter(k=>dueN(k)||riskView.due===k);
  const ck=showAllChecks?issues:issues.slice(0,6);
  $("#view-risks").innerHTML=`<h2>風險評鑑與處理</h2>
  <p class="lede">依條款 6.1.2 識別與評估風險，依 6.1.3 決定處理方式並選定控制措施。風險選定的控制措施會連到附錄 A，作為適用性聲明（SoA）納入理由的依據；這裡只提出不一致的地方，不會自動改變判定。</p>
  <div class="filters">
    <button class="btn primary" id="rNew">＋ 新增風險</button>
    <span class="saved critline">風險準則：${esc(criteriaText(p))}</span><button class="btn" id="rCrit">調整準則</button>
    <button class="btn" id="rXls" style="margin-left:auto" data-tip="含風險登錄表、風險評鑑準則與連動檢查">匯出工作底稿 Excel</button>
  </div>
  ${riskFlowHTML(p)}
  <div class="grid2">
    <div class="panel"><div class="secthead"><h3>風險矩陣</h3>
      <div class="seg" id="mxSeg" style="margin-left:auto"><button data-mode="in" aria-pressed="${riskView.mode==="in"}">固有風險</button><button data-mode="res" aria-pressed="${riskView.mode==="res"}">殘餘風險</button></div></div>
      ${riskMatrix(riskView.mode)}
      <p class="note" style="margin:10px 0 0">粗框內為可接受的等級。點有數字的格子可篩選下方清單。</p></div>
    <div class="panel"><div class="secthead"><h3>連動檢查</h3>${(()=>{const u=[...new Set(issues.filter(c=>c.kind==="undecided").map(c=>c.code))];return u.length>1?`<button class="btn" id="ckApplyAll" style="margin-left:auto">全部設為適用（${u.length} 項）</button>`:""})()}</div>
      ${issues.length?`<ul class="cklist">${ck.map(checkRow).join("")}</ul>${issues.length>6?`<button class="chip" id="ckMore" style="margin-top:8px">${showAllChecks?"收合":"顯示全部 "+issues.length+" 項"}</button>`:""}`:
        `<p class="note">${list.length?"風險評鑑與 SoA 沒有發現不一致。":"新增風險後，這裡會檢查風險評鑑與 SoA 是否一致。"}</p>`}
      ${(()=>{const rp=recentPending();return rp.length?`<div class="ckrecent"><span>本次已設為適用 ${rp.length} 項（${rp.slice(0,4).map(esc).join("、")}${rp.length>4?"…":""}），待補負責人與執行狀態</span><button class="btn" data-goto="annex" data-gofilter="recent">前往附錄 A →</button></div>`:""})()}
      ${info.length?`<details class="ckinfo"><summary>${info.length} 項控制措施的理由寫「依風險評鑑結果」，但沒有風險引用</summary><ul class="cklist">${info.map(checkRow).join("")}</ul></details>`:""}
    </div>
  </div>
  ${list.some(r=>r.reassess)?`<p class="note reassess">${list.filter(r=>r.reassess).length} 項風險沿用 ${p.baseline?esc(p.baseline.label):"去年"}的評估，待重新評估。打開風險確認可能性與衝擊後，按「已重新評估」。</p>`:""}
  ${dueChips.length&&!riskView.cell?`<div class="filters duebar" style="margin-top:18px"><span class="count">${riskView.due?`篩選：${DUE_FILTER[riskView.due]}（${shown.length} 項）`:"處理計畫期限"}</span>${dueChips.map(k=>`<button class="chip dchip ${k}" data-duef="${k}" aria-pressed="${riskView.due===k}">${({late:"逾期",soon:PLAN_SOON_DAYS+" 天內到期",nodue:"未設期限"})[k]} ${dueN(k)}</button>`).join("")}${riskView.due?`<button class="chip" id="dueClear">清除篩選</button>`:""}</div>`:""}
  ${stg&&stg.pending.length&&!riskView.cell&&!riskView.due?`<div class="filters" style="margin-top:18px"><span class="count">流程篩選：${esc(stg.name)}－${esc(stg.note)}（${shown.length} 項）</span><button class="chip" id="rsClear">清除篩選</button></div>`:""}
  ${riskView.cell?`<div class="filters" style="margin-top:18px"><span class="count">篩選：${riskView.mode==="res"?"殘餘":"固有"}風險 可能性 ${riskView.cell.split("-")[0]} × 衝擊 ${riskView.cell.split("-")[1]}（${shown.length} 項）</span><button class="chip" id="mxClear">清除篩選</button></div>`:""}
  <div class="table-wrap" style="margin-top:${riskView.cell||riskView.due||dueChips.length||(stg&&stg.pending.length)?8:18}px"><table class="rtable"><thead><tr><th style="width:70px">編號</th><th>風險</th><th style="width:120px">風險擁有者</th><th style="width:84px">固有</th><th style="width:70px">處理方式</th><th>控制措施</th><th style="width:84px">殘餘</th><th style="width:96px">進度</th><th style="width:96px">檢查<span class="saved" style="display:block;font-weight:400">與 SoA 連動</span></th></tr></thead><tbody>
  ${shown.map(r=>`<tr>
    <td class="code"><button data-risk="${r.id}">${r.id}</button></td>
    <td class="name"><button class="rtitle" data-risk="${r.id}">${esc(r.title||"（未命名風險）")}</button>${r.asset?`<div class="saved">${esc(r.asset)}${r.cia?"｜"+[...r.cia].map(x=>({C:"機密性",I:"完整性",A:"可用性"})[x]).join("、"):""}</div>`:""}</td>
    <td>${esc(r.owner)||`<span class="muted">未指定</span>`}</td>
    <td>${lvlBadge(inherentScore(r))}</td>
    <td>${r.treat?esc(TREATMENTS.find(t=>t.v===r.treat).label):`<span class="muted">未決定</span>`}</td>
    <td><div class="rcodes">${(r.controls||[]).slice(0,3).map(c=>{const a=ctl(c).app;return `<button class="rc ${a==="N"?"bad":a===""?"undec":""}" data-open="${c}" data-tip="${c} ${esc(ANNEX_MAP[c].name)}｜SoA：${APP.find(x=>x.v===a).label}">${c}</button>`}).join("")}${(r.controls||[]).length>3?`<span class="saved" data-tip="${esc(r.controls.slice(3).join("、"))}">+${r.controls.length-3}</span>`:""}</div></td>
    <td>${lvlBadge(residualScore(r))}</td>
    <td>${riskProgress(r)}</td>
    <td>${riskState(r,checks)}</td></tr>`).join("")||`<tr><td colspan="9"><div class="empty tblempty">${list.length?(riskView.due?"沒有符合的風險。":"這一格沒有風險。"):`<p style="margin:0 0 12px">還沒有風險。可以從案例挑一個情境建立，或先到案例搜尋看看有哪些常見風險。</p><div class="emptyacts"><button class="btn primary" id="rNew2">＋ 新增風險</button><button class="btn" id="rToSearch">前往案例搜尋 →</button></div>`}</div></td></tr>`}
  </tbody></table></div>`;
  const on=(id,fn)=>{const el=$("#"+id);if(el)el.addEventListener("click",fn)};
  on("rNew",openRiskPicker);
  on("rNew2",openRiskPicker);
  on("rToSearch",()=>{tab="search";render();window.scrollTo(0,0);const si=$("#sInput");if(si)si.focus()});
  on("rXls",()=>exportExcel());
  on("ckMore",()=>{showAllChecks=!showAllChecks;renderRisks()});
  on("ckApplyAll",applyAllRiskToSoA);
  on("mxClear",()=>{riskView.cell=null;renderRisks()});
  on("dueClear",()=>{riskView.due=null;renderRisks()});
  $("#view-risks").querySelectorAll("[data-duef]").forEach(b=>b.addEventListener("click",()=>{riskView.due=riskView.due===b.dataset.duef?null:b.dataset.duef;riskView.cell=null;riskView.stage=null;renderRisks()}));
  $("#view-risks").querySelectorAll("#rsClear,.rfclose").forEach(b=>b.addEventListener("click",()=>{riskView.stage=null;renderRisks()}));
  const rsc=$("#rfScope");if(rsc)rsc.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();$("#view-risks").querySelector('[data-rfact="scope"]').click()}
    else if(e.key==="Escape"&&ctxScopeEdit){ctxScopeEdit=false;const y=window.scrollY;renderRisks();window.scrollTo(0,y)}});
  $("#view-risks").querySelectorAll("[data-rfadd]").forEach(b=>b.addEventListener("click",()=>{
    const sug=identSuggestions(cur()),k=b.dataset.rfadd,list=k==="all"?sug:[sug[+k]].filter(Boolean);
    const added=list.map(addSuggestedRisk).filter(Boolean);if(!added.length)return;
    const y=window.scrollY;renderRisks();window.scrollTo(0,y);
    toast(added.length>1?`已加入 ${added.length} 項風險（${added[0].id}–${added[added.length-1].id}），請指定擁有者並評分`:`已加入 ${added[0].id}「${added[0].title}」，請指定擁有者並評分`)}));
  $("#view-risks").querySelectorAll("[data-rfact]").forEach(b=>b.addEventListener("click",()=>{const a=b.dataset.rfact;if(a==="scopeedit"){ctxScopeEdit=true;const y=window.scrollY;renderRisks();window.scrollTo(0,y);const i=$("#rfScope");if(i){i.focus({preventScroll:true});i.select()}return}
    if(a==="scope"){const p=cur(),v=$("#rfScope").value.trim();p.scope=v;ctxScopeEdit=false;touchRisk();const y=window.scrollY;renderRisks();window.scrollTo(0,y);toast(v?"已更新驗證範圍":"已清除驗證範圍");return}if(a==="identok"){const p=cur();p.identOk=!p.identOk;
      if(p.identOk){const by=(($("#rfIdentBy")||{}).value||"").trim();if(by)p.identBy=by;else delete p.identBy;p.identAt=todayStr()}else{delete p.identBy;delete p.identAt}
      touchRisk();const y=window.scrollY;renderRisks();window.scrollTo(0,y);toast(p.identOk?"已確認風險識別完成":"已取消確認");return}if(a==="new")openRiskPicker();else if(a==="xls")exportExcel();else openCriteriaDrawer()}));
  $("#view-risks").querySelectorAll("[data-rstage]").forEach(b=>b.addEventListener("click",()=>{const id=b.dataset.rstage,y=window.scrollY;riskView.stage=riskView.stage===id?null:id;riskView.cell=null;riskView.due=null;renderRisks();
    // 不捲動頁面：說明框就在流程圖下方，清單的篩選結果往下看即可
    window.scrollTo(0,y);const nb=document.querySelector(`[data-rstage="${id}"]`);if(nb)nb.focus({preventScroll:true})}));
  on("rCrit",openCriteriaDrawer);
  $("#mxSeg").addEventListener("click",e=>{const b=e.target.closest("[data-mode]");if(!b)return;riskView.mode=b.dataset.mode;riskView.cell=null;renderRisks()});
  $("#view-risks").querySelectorAll("[data-mx]").forEach(b=>b.addEventListener("click",()=>{riskView.cell=riskView.cell===b.dataset.mx?null:b.dataset.mx;riskView.stage=null;riskView.due=null;renderRisks()}));
}
document.addEventListener("click",e=>{
  const a=e.target.closest("[data-apply]");if(a){e.preventDefault();applyRiskToSoA(a.dataset.apply);return}
  const r=e.target.closest("[data-risk]");if(r){e.preventDefault();
    if(r.closest(".drawer")&&r.dataset.risk!==riskDrawerId&&pushTrail())openRiskDrawer(r.dataset.risk,true);else openRiskDrawer(r.dataset.risk);return}
  const n=e.target.closest("[data-newrisk]");if(n){e.preventDefault();riskFromCase(n.dataset.newrisk)}
});
function levelSelect(id,val,labels){
  return `<select id="${id}">${[0,1,2,3,4,5].map(n=>`<option value="${n}" ${n===+val?"selected":""}>${n?n+"　"+labels[n]:"未評估"}</option>`).join("")}</select>`;
}
function openRiskDrawer(id,trail){
  const r=riskById(id);if(!r)return;
  const host=$("#drawerHost");
  if(!trail&&(id!==riskDrawerId||!host.innerHTML))drawerTrail=[];
  riskDrawerId=id;drawerCode=null;
  host.innerHTML=`<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="${esc(r.id)} 風險">
    <button class="btn x" data-close>關閉</button>
    ${trailBackHTML()}
    <div class="code">${r.id}　風險登錄</div>
    <div id="rCkTop"></div>
    <div id="rTrace"></div>
    <h3 class="rstep"><span>1</span>識別</h3>
    <dl>
      <div><dt>風險描述</dt><dd><input id="rTitle" value="${esc(r.title)}" placeholder="例如：離職員工帳號未停用，資料遭不當存取"><div class="saved" style="margin-top:4px;white-space:normal">寫成「可能發生」的事件；已發生的事件請登錄在改善追蹤，並作為評估可能性的依據。</div></dd></div>
      <div><dt>相關資產</dt><dd><input id="rAsset" value="${esc(r.asset)}" placeholder="例如：CRM 系統、AD 帳號"></dd></div>
      <div><dt>風險擁有者</dt><dd><input id="rOwner" data-owner autocomplete="off" value="${esc(r.owner)}" placeholder="對這個風險負責、核准處理方式的人"></dd></div>
    </dl>
    <details class="rmore" ${r.threat||r.vuln||r.existing||r.cia?"open":""}><summary>更多細節<span class="saved">威脅、脆弱性、現有控制、影響（選填，風險評鑑表會用到）</span></summary>
    ${r.fromCase?`<p class="note" style="margin:6px 0 0">「威脅」帶入的是案例的情境範例，請改寫成貴公司可能遇到的情況。</p>`:""}
    <dl>
      <div><dt>威脅</dt><dd><textarea id="rThreat" rows="2" placeholder="可能發生什麼事，例如：離職人員不當存取">${esc(r.threat)}</textarea></dd></div>
      <div><dt>脆弱性</dt><dd><textarea id="rVuln" rows="2" placeholder="為什麼會發生，例如：離職帳號未即時停用">${esc(r.vuln||"")}</textarea></dd></div>
      <div><dt>現有控制</dt><dd><input id="rExist" value="${esc(r.existing||"")}" placeholder="目前已有的措施，例如：到職／離職流程"></dd></div>
      <div><dt>影響</dt><dd class="ciabox">${[["C","機密性"],["I","完整性"],["A","可用性"]].map(([k,l])=>`<label><input type="checkbox" data-cia="${k}" ${r.cia.includes(k)?"checked":""}> ${l}</label>`).join("")}</dd></div>
    </dl></details>
    <h3 class="rstep"><span>2</span>評估（6.1.2）</h3>
    ${r.reassess?`<div class="reabox" id="rReBox"><span>沿用 ${cur().baseline?esc(cur().baseline.label):"去年"}的評估，請依今年情況確認可能性與衝擊。</span><button class="btn" id="rRe">已重新評估</button></div>`:""}
    <div class="r2"><label>可能性${levelSelect("rL",r.l,LIKELIHOOD)}</label><label>衝擊${levelSelect("rI",r.i,IMPACT)}</label><div class="rscore" id="rS"></div></div>
    <h3 class="rstep" style="margin-top:16px"><span>3</span>處理（6.1.3）</h3>
    <p class="note" id="rTreatWait" style="margin:4px 0 0">先評估可能性與衝擊，再決定處理方式。</p>
    <div id="rTreatSec">
    <dl>
      <div><dt>處理方式</dt><dd><select id="rTreat">${TREATMENTS.map(t=>`<option value="${t.v}" ${t.v===r.treat?"selected":""}>${t.label}${TREAT_HINT[t.v]?"："+TREAT_HINT[t.v]:""}</option>`).join("")}</select><div class="saved" id="rTreatHint" style="margin-top:4px"></div></dd></div>
      <div data-show="mitigate"><dt>選定的控制措施</dt><dd id="rCtl"></dd></div>
      <div data-show="mitigate transfer avoid"><dt>處理計畫</dt><dd><textarea id="rPlan" rows="2" placeholder="要做什麼、需要哪些資源">${esc(r.plan)}</textarea></dd></div>
      <div class="r2x" data-show="mitigate transfer avoid"><div><dt>預計完成</dt><dd><input id="rDue" value="${esc(r.due)}" placeholder="例如 2026-12-31 或 2026-12"><div class="saved" id="rDueHint" style="margin-top:4px"></div></dd></div>
        <div><dt>處理狀態</dt><dd><select id="rStat">${RISK_STATUS.map(x=>`<option value="${x}" ${x===(r.status||"")?"selected":""}>${x||"未設定"}</option>`).join("")}</select></dd></div></div>
    </dl>
    <div data-show="mitigate transfer"><h3>處理後的殘餘風險</h3>
    <div class="r2"><label>可能性${levelSelect("rRL",r.rl,LIKELIHOOD)}</label><label>衝擊${levelSelect("rRI",r.ri,IMPACT)}</label><div class="rscore" id="rRS"></div></div></div>
    <label class="rappr" id="rApprRow"><input type="checkbox" id="rAcc2" ${r.accepted?"checked":""}> <span id="rApprText">風險擁有者已核准處理計畫與殘餘風險</span></label>
    </div>
    <div id="rChecks"></div>
    <div style="margin-top:18px;display:flex;gap:8px"><button class="btn danger" id="rDel">刪除這個風險</button></div>
  </aside>`;
  const applied={};   // 這次在詳細頁設為適用的控制措施 → 原本的理由（供復原）
  const refresh=()=>{
    const s=inherentScore(r),rs=residualScore(r),pl=x=>POLICIES.find(y=>y.v===policyOf(x,cur())).label;
    const df=(k,n)=>{const t=((cur().scale||{})[k]||[])[n-1];return n&&t?`${k==="l"?"可能性":"衝擊"} ${n}：${esc(t)}`:""};
    $("#rS").innerHTML=lvlBadge(s)+(s?`<span class="saved">${pl(s)}</span>`:"")+[df("l",r.l),df("i",r.i)].filter(Boolean).map(t=>`<div class="saved sdef">${t}</div>`).join("");
    $("#rRS").innerHTML=lvlBadge(rs)+(rs?`<span class="saved">${pl(rs)}</span>`:"");
    // 依目前的分數與處理方式，只顯示需要填的欄位
    $("#rTreatWait").hidden=!!s;$("#rTreatSec").hidden=!s;
    host.querySelectorAll("[data-show]").forEach(el=>el.hidden=!el.dataset.show.split(" ").includes(r.treat));
    const eff=r.treat==="accept"?s:rs;
    const needAppr=!!r.treat&&r.treat!=="avoid"&&!!eff&&policyOf(eff,cur())==="approve";
    $("#rApprRow").hidden=!(needAppr||r.accepted);
    $("#rApprText").textContent=r.treat==="accept"?"風險擁有者已核准接受此風險":"風險擁有者已核准處理計畫與殘餘風險";
    {const d=planDue(r),h=$("#rDueHint"),bad=r.due&&!/^\d{4}-\d{2}(-\d{2})?$/.test(r.due);
      h.className="saved"+(d&&d.state==="late"?" dlate":d&&d.state==="soon"?" dsoon":"");
      h.textContent=bad?"格式請寫成 2026-12-31 或 2026-12":!d?"":d.state==="late"?`已超過 ${-d.days} 天，請更新進度或調整期限並記錄原因`:d.state==="soon"?(d.days?`還有 ${d.days} 天到期`:"今天到期"):d.state==="nodue"?"建議寫上預計完成日，方便追蹤":`還有 ${d.days} 天`}
    $("#rTreatHint").textContent=!s?"":r.treat?"":`目前 ${s} 分屬「${riskLevel(s,cur()).label}」：${pl(s)}`;
    $("#rTrace").innerHTML=traceHTML(traceChain(cur(),"risk",r.id));
    const cks=riskChecks(cur()).filter(c=>c.rid===r.id);
    const und=cks.filter(c=>c.kind==="undecided").length,nw=cks.filter(c=>c.sev!=="info").length;
    /* 背景的連動檢查會被詳細頁遮住，所以在頂端摘要這個風險的檢查結果，點一下跳到清單 */
    $("#rCkTop").innerHTML=nw?`<button class="ckjump ${cks.some(c=>c.sev==="err")?"err":""}" data-ckjump>連動檢查：${nw} 項待確認<span aria-hidden="true">↓</span></button>`:"";
    const done=Object.keys(applied).filter(c=>ctl(c).app==="Y"&&(r.controls||[]).includes(c));
    $("#rChecks").innerHTML=cks.length||done.length?`<h3 class="ckh">連動檢查</h3>${und>1?`<div style="display:flex;justify-content:flex-end;margin-top:6px"><button class="btn primary" data-dapplyall>全部設為適用（${und}）</button></div>`:""}
      <ul class="cklist" style="margin-top:${und>1?8:6}px">${cks.map(c=>`<li class="ck ${c.sev}"><span class="ckmsg">${esc(c.msg.replace(r.id+(r.title?"「"+r.title+"」":""),"").trim()||c.msg)}</span><span class="ckact">${c.kind==="undecided"?`<button class="btn" data-dapply="${c.code}">設為適用</button>`:""}</span></li>`).join("")}
      ${done.map(c=>`<li class="ck ok"><span class="ckmsg">✓ ${c} ${esc(ANNEX_MAP[c].name)} 已設為適用</span><span class="ckact"><button class="btn" data-dundo="${c}">復原</button></span></li>`).join("")}</ul>`:"";
  };
  const renderCtl=(q="")=>{
    const sel=r.controls||[];
    const sugg=search([r.title,r.threat,r.asset].join(" ")).refs.map(x=>x.code).filter(c=>ANNEX_MAP[c]&&!sel.includes(c)).slice(0,6);
    const nq=norm(q);
    const hits=nq?ANNEX.filter(c=>!sel.includes(c.code)&&norm(c.code+" "+c.name).includes(nq.replace(/^a(?=\d)/,"a."))).slice(0,6).map(c=>c.code):[];
    const addBtn=c=>`<button class="chip" data-addc="${c}">＋ ${c} ${esc(ANNEX_MAP[c].name)}</button>`;
    $("#rCtl").innerHTML=`<div class="rsel">${sel.map(c=>{const a=ctl(c).app;return `<span class="rpick ${a==="N"?"bad":""}"><button class="ref" data-open="${c}"><span class="mono">${c}</span>${esc(ANNEX_MAP[c].name)}</button><span class="saved">${a==="N"?"SoA 不適用":a===""?"SoA 未判定":""}</span><button class="rx" data-rmc="${c}" aria-label="移除 ${c}">×</button></span>`}).join("")||`<span class="saved">尚未選定</span>`}</div>
      ${sugg.length?`<div class="saved" style="margin:8px 0 4px">依描述建議：</div><div class="hints" style="margin:0">${sugg.map(addBtn).join("")}</div>`:""}
      <input id="rcQ" placeholder="輸入編號或名稱加入其他控制措施" value="${esc(q)}" style="width:100%;margin-top:8px" autocomplete="off">
      ${hits.length?`<div class="hints" style="margin:6px 0 0">${hits.map(addBtn).join("")}</div>`:""}`;
    const qi=$("#rcQ");qi.addEventListener("input",()=>{const pos=qi.selectionStart;renderCtl(qi.value);const n=$("#rcQ");n.focus();n.setSelectionRange(pos,pos)});
  };
  // 詳細頁開著時，背景的風險表與矩陣同步更新
  let bgPending=false;
  const bg=()=>{if(bgPending||tab!=="risks")return;bgPending=true;requestAnimationFrame(()=>{bgPending=false;renderRisks()})};
  const set=(f,v)=>{if(r[f]===v)return;r[f]=v;touchRisk();refresh();bg()};
  [["rTitle","title"],["rAsset","asset"],["rThreat","threat"],["rVuln","vuln"],["rExist","existing"],["rOwner","owner"],["rPlan","plan"],["rDue","due"]].forEach(([id,f])=>$("#"+id).addEventListener("input",e=>set(f,e.target.value)));
  const reDone=()=>{if(!r.reassess)return;delete r.reassess;touchRisk();const b=$("#rReBox");if(b)b.remove()};
  [["rL","l"],["rI","i"],["rRL","rl"],["rRI","ri"]].forEach(([id,f])=>$("#"+id).addEventListener("change",e=>{set(f,Number(e.target.value));if(f==="l"||f==="i")reDone()}));
  const rb=$("#rRe");if(rb)rb.addEventListener("click",reDone);
  $("#rTreat").addEventListener("change",e=>set("treat",e.target.value));
  $("#rStat").addEventListener("change",e=>set("status",e.target.value));
  $("#rAcc2").addEventListener("change",e=>set("accepted",e.target.checked));
  host.querySelectorAll("[data-cia]").forEach(b=>b.addEventListener("change",()=>set("cia",[...host.querySelectorAll("[data-cia]:checked")].map(x=>x.dataset.cia).join(""))));
  $("#rTitle").addEventListener("change",()=>renderCtl($("#rcQ")?$("#rcQ").value:""));
  $("#rThreat").addEventListener("change",()=>renderCtl($("#rcQ")?$("#rcQ").value:""));
  $("#rCtl").addEventListener("click",e=>{
    const a=e.target.closest("[data-addc]"),x=e.target.closest("[data-rmc]");
    if(a){r.controls=[...(r.controls||[]),a.dataset.addc];touchRisk();renderCtl("");refresh()}
    if(x){r.controls=r.controls.filter(c=>c!==x.dataset.rmc);touchRisk();renderCtl($("#rcQ").value);refresh()}
  });
  $("#rDel").addEventListener("click",()=>deleteRisk(r.id));
  /* 連動檢查：在詳細頁直接設為適用，設好的項目留在清單上並可復原 */
  const applyOne=code=>{const v=ctl(code);if(v.app!=="")return false;applied[code]=v.reason;recentApplied().add(code);setField(code,"app","Y",{silent:true});
    if(!splitReasons(v.reason).includes(RISK_REASON))setField(code,"reason",[...splitReasons(v.reason),RISK_REASON].join(SEP),{silent:true});return true};
  const afterApply=()=>{renderCtl($("#rcQ")?$("#rcQ").value:"");refresh();if(tab==="risks")renderRisks();else render()};
  $("#rCkTop").addEventListener("click",e=>{if(e.target.closest("[data-ckjump]"))$("#rChecks").scrollIntoView({behavior:"smooth",block:"start"})});
  $("#rChecks").addEventListener("click",e=>{
    const one=e.target.closest("[data-dapply]"),all=e.target.closest("[data-dapplyall]"),un=e.target.closest("[data-dundo]");
    if(one){if(applyOne(one.dataset.dapply))toast(`${one.dataset.dapply} 已設為適用（依風險評鑑結果）。${NEED_TXT}`);afterApply()}
    if(all){const codes=[...new Set(riskChecks(cur()).filter(c=>c.rid===r.id&&c.kind==="undecided").map(c=>c.code))];const n=codes.filter(applyOne).length;if(n)toast(`${n} 項已設為適用（依風險評鑑結果）。${NEED_TXT}`);afterApply()}
    if(un){const c=un.dataset.dundo;setField(c,"reason",applied[c]||"",{silent:true});setField(c,"app","",{silent:true});delete applied[c];recentApplied().delete(c);toast(`${c} 已復原為未判定`);afterApply()}
  });
  host.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",closeDrawer));
  renderCtl();refresh();
  if(!r.title)$("#rTitle").focus();else host.querySelector(".x").focus();
}

/* 風險準則設定：預設組合或自訂 2–4 個等級 */
function openCriteriaDrawer(){
  const p=cur();let lv=riskCriteria(p).levels.map(l=>({label:l.label,max:l.max,policy:l.policy}));
  const sc=JSON.parse(JSON.stringify(sanitizeScale(p.scale)||{l:["","","","",""],i:["","","","",""]}));
  const host=$("#drawerHost");
  const draw=()=>{
    const c=sanitizeCriteria({levels:lv});
    const err=c?"":lv.length<2||lv.length>4?"等級需為 2–4 個":lv.some(l=>!l.label.trim())?"每個等級都要有名稱":"分數上限需由小到大，最後一級為 25";
    host.innerHTML=`<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="風險準則">
      <button class="btn x" data-close>關閉</button>
      <div class="code">條款 6.1.2 a</div><h2>風險評鑑準則</h2>
      <p class="lede">風險分數 = 可能性 × 衝擊（1–25）。設定每個等級的分數上限與處理原則，連動檢查會依此判斷是否需要處理或核准。準則應經管理階層核准。</p>
      ${p.criteriaOk?"":`<p class="warnhint" style="margin:0 0 10px">目前是新專案帶入的預設準則。確認符合組織可接受的風險程度（必要時調整）後按「確認並套用」，路線圖才會標為完成。</p>`}
      <label style="display:grid;gap:4px;font-size:13px;color:var(--muted)">套用預設組合<select id="cPreset"><option value="">（自訂）</option>${Object.entries(CRITERIA_PRESETS).map(([k,x])=>`<option value="${k}">${x.label}</option>`).join("")}</select></label>
      <table class="crit"><thead><tr><th>等級名稱</th><th>分數範圍</th><th>處理原則</th><th></th></tr></thead><tbody>
      ${lv.map((l,k)=>`<tr><td><input data-k="${k}" data-f="label" value="${esc(l.label)}" maxlength="10"></td>
        <td class="mono">${k?(Number(lv[k-1].max)+1):1}–${k===lv.length-1?`25`:`<input data-k="${k}" data-f="max" type="number" min="1" max="24" value="${l.max}" style="width:64px">`}</td>
        <td><select data-k="${k}" data-f="policy">${POLICIES.map(x=>`<option value="${x.v}" ${x.v===l.policy?"selected":""}>${x.short}</option>`).join("")}</select></td>
        <td>${lv.length>2?`<button class="btn" data-del="${k}" aria-label="刪除此等級">刪除</button>`:""}</td></tr>`).join("")}
      </tbody></table>
      ${lv.length<4?`<button class="btn" id="cAdd">＋ 增加等級</button>`:""}
      <p class="${err?"warnhint":"note"}" style="margin-top:12px">${err||"預覽："+esc(criteriaText({criteria:c}))}</p>
      <h3 style="margin-top:18px">可能性與衝擊的定義</h3>
      <p class="note" style="margin:0 0 8px">寫下每一級代表什麼，不同的人評分才會一致。建議用組織自己的頻率、金額與中斷時間；衝擊可同時考量財務、營運、法規、商譽，取最嚴重的一項。</p>
      <table class="crit scale"><thead><tr><th>等級</th><th>可能性</th><th>衝擊</th></tr></thead><tbody>
      ${[1,2,3,4,5].map(n=>`<tr><td class="mono">${n}</td>
        <td><label class="sclab">${LIKELIHOOD[n]}<textarea rows="2" data-sc="l" data-n="${n-1}" placeholder="${esc(SCALE_REF.l[n-1])}">${esc(sc.l[n-1])}</textarea></label></td>
        <td><label class="sclab">${IMPACT[n]}<textarea rows="2" data-sc="i" data-n="${n-1}" placeholder="${esc(SCALE_REF.i[n-1])}">${esc(sc.i[n-1])}</textarea></label></td></tr>`).join("")}
      </tbody></table>
      <button class="btn" id="cRef" style="margin-top:8px">填入參考定義</button><span class="note" style="margin-left:8px">只填空白的欄位，填入後請改成組織的數字</span>
      <div style="display:flex;gap:8px;margin-top:14px"><button class="btn primary" id="cSave" ${c?"":"disabled"}>${p.criteriaOk?"套用":"確認並套用"}</button><button class="btn" data-close>取消</button></div>
    </aside>`;
    host.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",closeDrawer));
    $("#cPreset").addEventListener("change",e=>{if(e.target.value){lv=presetCriteria(e.target.value).levels;draw()}});
    host.querySelectorAll("[data-sc]").forEach(el=>el.addEventListener("input",()=>{sc[el.dataset.sc][+el.dataset.n]=el.value}));
    $("#cRef").addEventListener("click",()=>{["l","i"].forEach(k=>sc[k]=sc[k].map((v,n)=>v.trim()?v:SCALE_REF[k][n]));draw()});
    host.querySelectorAll("tbody [data-f]").forEach(el=>el.addEventListener("change",()=>{const l=lv[+el.dataset.k];
      l[el.dataset.f]=el.dataset.f==="max"?Number(el.value):el.value;if(el.dataset.f!=="label")draw()}));
    host.querySelectorAll("tbody [data-f=label]").forEach(el=>el.addEventListener("input",()=>{lv[+el.dataset.k].label=el.value}));
    host.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click",()=>{lv.splice(+b.dataset.del,1);lv[lv.length-1].max=25;draw()}));
    const add=$("#cAdd");if(add)add.addEventListener("click",()=>{const last=lv[lv.length-1],prev=lv.length>1?lv[lv.length-2].max:0;
      last.max=Math.min(24,Math.max(prev+1,Math.round((prev+25)/2)));lv.push({label:"新等級",max:25,policy:"treat"});draw()});
    $("#cSave").addEventListener("click",()=>{const c=sanitizeCriteria({levels:lv});if(!c)return;p.criteria=c;p.criteriaOk=true;const s2=sanitizeScale(sc);if(s2)p.scale=s2;else delete p.scale;touchRisk();closeDrawer();toast("已套用風險準則："+criteriaText(p))});
  };
  draw();
}
/* ================= 改善追蹤 ================= */
let actFilter="open",howtoOpen=null;   /* null＝依專案決定：還沒有改善事項時展開說明，有事項後預設收合，讓清單直接出現在畫面上 */
function actions(){const p=cur();if(!p)return [];if(!Array.isArray(p.actions))p.actions=[];return p.actions}
function actionById(id){return actions().find(a=>a.id===id)}
function actStatusBadge(a){
  if(actionOverdue(a))return `<span class="rstate warn">${esc(a.status)}・逾期</span>`;
  return `<span class="astate s${ACTION_STATUS.indexOf(a.status)}">${esc(a.status)}</span>`;
}
function newAction(init){
  const p=cur();if(!p)return null;
  const a=Object.assign(blankAction(nextActionId(p)),{raised:todayStr()},init||{});
  actions().push(a);touchRisk();return a;
}
function deleteAction(id){
  const list=actions(),i=list.findIndex(a=>a.id===id);if(i<0)return;
  const [a]=list.splice(i,1);touchRisk();$("#drawerHost").innerHTML="";render();
  undoToast(`已刪除 ${a.id}${a.title?" "+a.title:""}`,()=>{list.splice(i,0,a);touchRisk();render()});
}
const IMPROVE_FLOW=[
  ["發現","內部稽核（9.2）、管理審查（9.3）、資安事件、日常監督量測，找出不符合、觀察事項與改善機會"],
  ["登錄","每一項記下來源、負責人與預計完成日，關聯到相關條款或控制措施"],
  ["處理","不符合事項先立即處置，再分析根本原因，決定矯正措施，避免再發生（10.2）"],
  ["確認","措施完成後，確認是否真的有效（例如抽查、再稽核），有效才結案"],
  ["循環","建立新年度時未結案事項自動帶入；年度比較列出前次事項處理情形，作為下次管理審查的輸入（9.3.2 a）"]
];
function renderImprove(){
  const p=cur(),list=actions(),st=actionStats(p),checks=actionChecks(p);
  const shown=list.filter(a=>actFilter==="all"||(actFilter==="open"&&a.status!==ACTION_CLOSED)||(actFilter==="late"&&actionOverdue(a))||(actFilter==="verify"&&a.status==="已完成"))
    .slice().sort((x,y)=>(x.status===ACTION_CLOSED)-(y.status===ACTION_CLOSED)||(x.due||"9999").localeCompare(y.due||"9999"));
  const issues=checks.filter(c=>c.sev!=="info");
  $("#view-improve").innerHTML=`<h2>改善追蹤</h2>
  <p class="lede">登錄內部稽核發現、管理審查決議、資安事件檢討與改善機會，追蹤到確認有效為止。這是 PDCA 的「Act」：讓問題不只被發現，也被解決，並留下持續改善（10.1）的證據。</p>
  <details class="panel howto" id="aHow" ${(howtoOpen??!list.length)?"open":""}><summary><b>這個分頁怎麼用</b><span class="note">從發現問題到結案的流程，以及和條款的對應</span></summary>
    <ol class="flow">${IMPROVE_FLOW.map(([t,d],k)=>`<li><span class="fstep">${k+1}</span><b>${t}</b><span>${d}</span></li>`).join("")}</ol>
    <div class="table-wrap" style="margin-top:12px"><table class="cmptable"><thead><tr><th style="width:130px">類型</th><th style="width:80px">條款</th><th>什麼時候用</th><th style="width:150px">需要填</th></tr></thead><tbody>
      ${ACTION_TYPES.map(t=>`<tr><td>${t.label}</td><td class="code"><button class="ref mono" data-open="${t.clause}">${t.clause}</button></td><td>${esc(t.hint)}</td><td>${esc(t.need)}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="note" style="margin:10px 0 0">稽核時常被問：「去年稽核的缺失改善了嗎？」「怎麼知道矯正措施有效？」這裡的紀錄與匯出 Excel 的「改善追蹤」工作表可以直接回答。表單範本可在「文件範本」分頁下載矯正措施單與管理審查紀錄。</p>
  </details>
  <div class="filters">
    <button class="btn primary" id="aNew">＋ 新增改善事項</button>
    <div class="seg" id="aSeg">${[["open","未結案"],["late","逾期"],["verify","待確認有效"],["all","全部"]].map(([k,t])=>`<button data-af="${k}" aria-pressed="${actFilter===k}">${t}</button>`).join("")}</div>
    <button class="btn" id="aXls" style="margin-left:auto" data-tip="含改善追蹤工作表">匯出工作底稿 Excel</button>
  </div>
  <div class="stats">
    <div class="stat"><b>${st.open}</b><span>未結案</span></div>
    <div class="stat"><b class="${st.overdue?"down":""}">${st.overdue}</b><span>逾期</span></div>
    <div class="stat"><b>${st.toVerify}</b><span>已完成待確認</span></div>
    <div class="stat"><b>${st.closed}</b><span>已確認有效</span></div>
  </div>
  ${issues.length?`<div class="panel" style="margin-bottom:18px"><h3>需要注意</h3><ul class="cklist">${issues.slice(0,8).map(c=>`<li class="ck ${c.sev}"><span class="ckmsg">${esc(c.msg)}</span><span class="ckact"><button class="btn" data-act="${c.aid}">開啟</button></span></li>`).join("")}</ul>${issues.length>8?`<p class="note">另有 ${issues.length-8} 項</p>`:""}</div>`:""}
  <div class="table-wrap"><table class="rtable"><thead><tr><th style="width:70px">編號</th><th>事項</th><th style="width:120px">類型</th><th style="width:120px">負責人</th><th style="width:100px">預計完成</th><th style="width:130px">狀態</th></tr></thead><tbody>
  ${shown.map(a=>`<tr>
    <td class="code"><button data-act="${a.id}">${a.id}</button></td>
    <td class="name"><button class="rtitle" data-act="${a.id}">${esc(a.title||"（未填寫）")}</button><div class="saved">${[a.source,a.carried?"沿用自 "+a.carried:"",(a.refs||[]).join("、")].filter(Boolean).map(esc).join("｜")}</div></td>
    <td>${esc(ACTION_TYPE_MAP[a.type].label)}</td>
    <td>${esc(a.owner)||`<span class="saved">未指定</span>`}</td>
    <td class="mono">${esc(a.due)||`<span class="saved">—</span>`}</td>
    <td>${actStatusBadge(a)}</td></tr>`).join("")||`<tr><td colspan="6"><div class="empty">${list.length?"這個篩選沒有項目。":"還沒有改善事項。內部稽核、管理審查或資安事件之後，把要處理的事項登錄在這裡。"}</div></td></tr>`}
  </tbody></table></div>`;
  const on=(id,fn)=>{const el=$("#"+id);if(el)el.addEventListener("click",fn)};
  on("aNew",()=>{const a=newAction();renderImprove();openActionDrawer(a.id)});
  on("aXls",()=>exportExcel());
  $("#aHow summary").addEventListener("click",()=>{howtoOpen=!$("#aHow").open});   /* 只記住使用者自己點的展開／收合 */
  $("#aSeg").addEventListener("click",e=>{const b=e.target.closest("[data-af]");if(!b)return;actFilter=b.dataset.af;renderImprove()});
}
document.addEventListener("click",e=>{const a=e.target.closest("[data-act]");if(a){e.preventDefault();
  if(a.closest(".drawer")&&pushTrail())openActionDrawer(a.dataset.act,true);else openActionDrawer(a.dataset.act)}});
function openActionDrawer(id,trail){
  const a=actionById(id);if(!a)return;
  const host=$("#drawerHost");
  if(!trail)drawerTrail=[];
  drawerCode=null;riskDrawerId=null;
  const draw=()=>{
    const t=ACTION_TYPE_MAP[a.type];
    host.innerHTML=`<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="${esc(a.id)} 改善事項">
    <button class="btn x" data-close>關閉</button>
    ${trailBackHTML()}
    <div class="code">${a.id}　改善事項${a.carried?`<span class="saved">　沿用自 ${esc(a.carried)}</span>`:""}</div>
    <dl>
      <div><dt>類型</dt><dd><select id="aType">${ACTION_TYPES.map(x=>`<option value="${x.v}" ${x.v===a.type?"selected":""}>${x.label}（${x.clause}）</option>`).join("")}</select><div class="saved" style="margin-top:4px">${esc(t.hint)}</div></dd></div>
      <div><dt>事項描述</dt><dd><textarea id="aTitle" rows="2" placeholder="例如：抽查 5 名離職人員，2 名的 VPN 帳號未於 3 日內停用">${esc(a.title)}</textarea></dd></div>
      <div class="r2x"><div><dt>來源</dt><dd><input id="aSrc" value="${esc(a.source)}" placeholder="例如：2026 內部稽核"></dd></div>
        <div><dt>提出日期</dt><dd><input id="aRaised" value="${esc(a.raised)}" placeholder="2026-03-15"></dd></div></div>
      <div><dt>關聯條款或控制措施</dt><dd><input id="aRefs" value="${esc((a.refs||[]).join("、"))}" placeholder="例如：A.5.18、9.2"><div class="saved" id="aRefsOk" style="margin-top:4px"></div></dd></div>
    </dl>
    <h3>${t.ca?"矯正措施（10.2）":"處理"}</h3>
    <dl>
      ${t.corr?`<div><dt>立即處置</dt><dd><textarea id="aCorr" rows="2" placeholder="先把問題本身處理掉，例如：立即停用 2 個帳號">${esc(a.correction)}</textarea></dd></div>`:""}
      ${t.cause?`<div><dt>原因分析${t.ca?"":"（建議填）"}</dt><dd><textarea id="aCause" rows="2" placeholder="為什麼會發生，例如：人資離職通知未包含資訊部">${esc(a.cause)}</textarea></dd></div>`:""}
      <div><dt>${t.ca?"矯正措施":"處理措施"}</dt><dd><textarea id="aAct" rows="2" placeholder="${t.ca?"消除原因、避免再發生，例如：離職流程加入資訊部簽核，每月帳號清查":t.v==="inc"?"預防再發生，例如：全員啟用多因子驗證":"要做什麼"}">${esc(a.action)}</textarea></dd></div>
      <div class="r2x"><div><dt>負責人</dt><dd><input id="aOwner" data-owner list="ownerList" autocomplete="off" value="${esc(a.owner)}"></dd></div>
        <div><dt>預計完成</dt><dd><input id="aDue" value="${esc(a.due)}" placeholder="2026-06-30 或 2026-06"></dd></div></div>
      <div class="r2x"><div><dt>狀態</dt><dd><select id="aStat">${ACTION_STATUS.map(x=>`<option ${x===a.status?"selected":""}>${x}</option>`).join("")}</select></dd></div>
        <div><dt>完成日期</dt><dd><input id="aDone" value="${esc(a.doneAt)}" placeholder="2026-05-20"></dd></div></div>
      <div><dt>${t.ca?"有效性確認（10.2 d）":"結果確認（選填）"}</dt><dd><textarea id="aVerify" rows="2" placeholder="怎麼確認有效，例如：6 月抽查 10 名離職人員，帳號皆於當日停用">${esc(a.verify)}</textarea></dd></div>
    </dl>
    <div id="aChecks"></div>
    <div style="margin-top:18px;display:flex;gap:8px"><button class="btn danger" id="aDel">刪除這個事項</button></div>
    </aside>`;
    const refresh=()=>{const cks=actionChecks({actions:[a]});
      $("#aChecks").innerHTML=cks.length?`<ul class="cklist" style="margin-top:6px">${cks.map(c=>`<li class="ck ${c.sev}"><span class="ckmsg">${esc(c.msg.replace(a.id+(a.title?"「"+a.title+"」":""),"").trim())}</span></li>`).join("")}</ul>`:"";
      const raw=$("#aRefs").value.trim(),codes=parseRefCodes(raw);$("#aRefsOk").textContent=raw?(codes.length?"辨識為："+codes.join("、"):"沒有辨識到條款或控制措施編號"):""};
    const set=(f,v)=>{if(a[f]===v)return;a[f]=v;touchRisk();refresh()};
    const dt=v=>dueFrom(v)||"";
    [["aTitle","title"],["aSrc","source"],["aCorr","correction"],["aCause","cause"],["aAct","action"],["aOwner","owner"],["aVerify","verify"]]
      .forEach(([id,f])=>{const el=$("#"+id);if(el)el.addEventListener("input",()=>set(f,el.value))});
    [["aRaised","raised"],["aDue","due"],["aDone","doneAt"]].forEach(([id,f])=>$("#"+id).addEventListener("change",e=>{const v=dt(e.target.value);e.target.value=v||e.target.value;set(f,v)}));
    $("#aRefs").addEventListener("input",e=>set("refs",parseRefCodes(e.target.value)));
    $("#aType").addEventListener("change",e=>{set("type",e.target.value);draw()});
    $("#aStat").addEventListener("change",e=>{set("status",e.target.value);if(["已完成",ACTION_CLOSED].includes(a.status)&&!a.doneAt){a.doneAt=todayStr();$("#aDone").value=a.doneAt;touchRisk()}refresh()});
    $("#aDel").addEventListener("click",()=>deleteAction(a.id));
    host.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",closeDrawer));
    refresh();
  };
  draw();
  if(!a.title)$("#aTitle").focus();else host.querySelector(".x").focus();
}

/* ================= 文件範本 ================= */
const docHref=d=>TPL_BASE+d.file;
const docDl=d=>`${d.id} ${d.name}.${d.fmt}`;
function docLink(d,label){return d.status==="planned"?`<span class="saved">規劃中</span>`:`<a class="dl" href="${docHref(d)}" download="${esc(docDl(d))}">${label||(d.fmt==="docx"?"Word":"Excel")}</a>`}
let docFilter="all";
function renderDocs(){
  const ready=DOCS.filter(d=>d.status!=="planned"),planned=DOCS.length-ready.length;
  const p=cur(),need=d=>docNeed(p,d);
  const show=d=>docFilter==="all"||(docFilter==="req"&&d.mandatory)||(docFilter==="mine"&&p&&["req","need"].includes(need(d).level))||docFilter===d.layer;
  const cnt=k=>p?ready.filter(d=>need(d).level===k).length:0;
  const needLine=d=>{const n=need(d);if(!n)return "";
    const rs=n.risks.slice(0,2).map(r=>`<button class="ref" data-risk="${esc(r.id)}" data-tip="${esc(r.title)}"><span class="mono">${esc(r.id)}</span> ${esc(r.title)}</button>`).join("")+(n.risks.length>2?`<span class="note">等 ${n.risks.length} 項</span>`:"");
    return `<div class="dneed ${n.level}"><span class="dnlab">建立依據</span><span>${esc(n.why)}${n.risks.length?"；風險評鑑引用：":""}</span>${rs}</div>`};
  const refs=d=>[...d.clauses,...d.controls].map(c=>`<button class="rc" data-open="${c}" data-tip="${c} ${esc((CLAUSE_MAP[c]||ANNEX_MAP[c]||{}).name||"")}">${c}</button>`).join("");
  $("#view-docs").innerHTML=`<h2>ISMS 文件範本</h2>
  <p class="lede">依五層架構整理的通用範本，涵蓋條款 4–10 要求保存的文件化資訊；黃色【】是要依組織修改的地方。範本自行撰寫、不含標準原文，以 <a href="https://github.com/coloplay1/isms-mapper/blob/main/templates/LICENSE.md" target="_blank" rel="noopener">CC BY 4.0</a> 釋出。</p>
  <div class="dways"><span><b>⬇ 下載空白範本</b>直接編輯使用</span><span><b>✎ 自動帶入</b>公司名稱與專案資料填進 Word</span><span><b>✦ AI 提示詞</b>交給你自己的 AI 服務撰寫草稿</span><span class="note">每份文件按「產生文件」，或用「下載全部」一次處理；資料不會送出</span></div>
  <div class="filters">
    <button class="btn primary" id="docKit">⬇ 下載全部（ZIP）</button>
    <div class="seg" id="docSeg">${[["all","全部"],...(p?[["mine","本專案需要"]]:[]),["req","標準要求的文件"],...DOC_LAYERS.map(l=>[l.id,l.id+" "+l.name])].map(([k,t])=>`<button data-df="${k}" aria-pressed="${docFilter===k}">${t}</button>`).join("")}</div>
    <span class="count">已提供 ${ready.length} 份${planned?`，規劃中 ${planned} 份`:""}</span>
  </div>
  ${p?`<div class="callout dsum"><b>依「${esc(p.name)}」判斷</b>：本專案需要 <b>${cnt("req")+cnt("need")}</b> 份（標準要求 ${cnt("req")}、依適用的控制措施 ${cnt("need")}）${cnt("undec")?`；${cnt("undec")} 份要等附錄 A 判定後才知道`:""}${cnt("none")?`；${cnt("none")} 份對應的控制措施都不適用，可能不需要`:""}${cnt("opt")?`；${cnt("opt")} 份為選用`:""}。每份範本下方會說明建立依據，改了附錄 A 或風險，判斷會跟著更新。</div>`:""}
  ${docFilter==="all"||docFilter==="req"?`<div class="panel" style="margin-bottom:18px"><div class="secthead"><h3>條款 4–10 要求保存的文件化資訊</h3><span class="note">驗證稽核一定會查的文件。點條款編號可查看說明。</span></div>
    <div class="table-wrap" style="border:0"><table class="dreq"><thead><tr><th style="width:70px">條款</th><th>要求保存的內容</th><th>對應範本</th></tr></thead><tbody>
    ${DOC_REQUIREMENTS.map(r=>`<tr><td class="code"><button data-open="${r.code}">${r.code}</button></td><td>${esc(r.req)}</td><td><div class="dchips">${r.docs.map(id=>{const d=DOC_MAP[id];return `<a class="dchip" href="${docHref(d)}" data-dgen="${d.id}" data-tip="${esc(d.name)}：下載範本、產生文件或 AI 提示詞"><span class="mono">${d.id}</span> ${esc(d.name)}</a>`}).join("")}</div></td></tr>`).join("")}
    </tbody></table></div></div>`:""}
  ${DOC_LAYERS.map(l=>{const list=DOCS.filter(d=>d.layer===l.id&&show(d));if(!list.length)return "";
    return `<section class="dlayer"><div class="secthead"><h3>${l.id}　${esc(l.name)}</h3><span class="note">${esc(l.desc)}</span></div>
    <div class="dlist">${list.map(d=>`<article class="ditem ${d.status==="planned"?"planned":""}">
      <div class="dhead"><span class="mono">${d.id}</span><b>${esc(d.name)}</b>${p?`<span class="dtag ${need(d).level}">${need(d).label}</span>`:d.mandatory?`<span class="dtag">標準要求</span>`:""}${d.tool?`<span class="dtag tool">可匯入工具檢查</span>`:""}<span class="dfmt">${d.fmt==="docx"?"Word":"Excel"}</span></div>
      <p>${esc(d.desc)}</p>${needLine(d)}
      <div class="dfoot"><div class="rcodes">${refs(d)}</div><div class="dbtns">${d.status!=="planned"?`<button class="dl ghost" data-dgen="${d.id}" data-tip="填入公司資料下載 Word，或產生給 AI 的提示詞">產生文件</button>`:""}${d.example?`<a class="dl ghost" href="${TPL_BASE+d.example}" download="${esc(d.id+" "+d.name+"_填寫範例."+d.fmt)}">填寫範例</a>`:""}${docLink(d,d.status==="planned"?"":"下載")}</div></div>
    </article>`).join("")}</div></section>`}).join("")}
  <p class="note" style="margin-top:18px">範本以虛構公司「北辰精密製造」撰寫填寫範例；正式使用前請依組織實際情況修改，並經權責主管核准。法規內容整理於 ${RULES_DATE}，請以主管機關公告為準。</p>`;
  $("#docSeg").addEventListener("click",e=>{const b=e.target.closest("[data-df]");if(!b)return;docFilter=b.dataset.df;renderDocs()});
  $("#docKit").addEventListener("click",openDocKit);
  $("#view-docs").querySelectorAll("[data-dgen]").forEach(b=>b.addEventListener("click",e=>{e.preventDefault();openDocGen(b.dataset.dgen)}));
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-cprompt]");if(b){e.preventDefault();openPrompt({kind:"ctl",id:b.dataset.cprompt})}});
/* 下載填好本專案資料的 Word 範本：在瀏覽器中讀取範本、替換、打包，資料不會送出 */
async function downloadFilledDoc(d,btn,proj){
  const p=proj||cur();if(!p||!d)return;
  if(location.protocol==="file:"){toast("從本機檔案開啟時無法讀取範本，請改用網站版");return}
  if(typeof DecompressionStream==="undefined"){toast("這個瀏覽器不支援，請改用最新版 Chrome、Edge、Firefox 或 Safari");return}
  const old=btn&&btn.textContent;if(btn){btn.disabled=true;btn.textContent="產生中…"}
  try{
    const res=await fetch(docHref(d),{cache:"no-cache"});if(!res.ok)throw new Error("讀取範本失敗");
    const {bytes,replaced}=await fillDocx(await res.arrayBuffer(),p,d);
    const who=safeName(p.org||p.name||"本專案").slice(0,30);
    await saveFile(`${d.id} ${d.name}_${who}.docx`,new Blob([bytes],{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}),"application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    if(!p.org)setTimeout(()=>toast("沒有填組織名稱，【公司名稱】維持原樣"),2400);
  }catch(e){toast("無法產生："+(e&&e.message||"請稍後再試"))}
  finally{if(btn){btn.disabled=false;btn.textContent=old}}
}
/* 產生文件：固定的輸入欄位（有專案時預先帶入），可下載填好的 Word 或複製 AI 提示詞；沒有專案也能用 */
const DOCGEN={org:"",scope:"",industry:"",notes:""};
function openDocGen(id){
  const d=DOC_MAP[id];if(!d)return;const p=cur();
  const v=p?{org:p.org||"",scope:p.scope||"",industry:p.industry||"",notes:DOCGEN[id+":notes"]||""}:{org:DOCGEN.org,scope:DOCGEN.scope,industry:DOCGEN.industry,notes:DOCGEN[id+":notes"]||""};
  const host=$("#drawerHost");
  host.innerHTML=`<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="產生文件">
    <button class="btn x" data-close>關閉</button>
    <div class="code">${esc(d.id)}・產生文件</div><h2>${esc(d.name)}</h2>
    <p class="note">${p?`已帶入專案「${esc(p.name)}」的基本資料，並會附上相關控制措施與風險；這裡的修改只用在這份文件，不會改到專案。`:`沒有開啟專案也可以使用：填入基本資料後產生。開啟或建立專案，還能自動附上相關的控制措施與風險。`}</p>
    <div class="dgform">
      <div class="dgreset"><button type="button" class="linkbtn" id="gReset">${p?"重置為專案資料":"清除填寫內容"}</button></div>
      <label>組織名稱<input id="gOrg" value="${esc(v.org)}" placeholder="例如：晨光科技股份有限公司" autocomplete="organization"></label>
      <label>驗證範圍<input id="gScope" value="${esc(v.scope)}" placeholder="例如：台北總部資訊機房與核心營運系統"></label>
      <label>產業<select id="gInd">${INDUSTRIES.map(x=>`<option value="${x.id}" ${x.id===v.industry?"selected":""}>${esc(x.label)}</option>`).join("")}</select></label>
      <label>補充說明（選填）<textarea id="gNotes" rows="4" placeholder="目前的做法、使用的系統或公司規定，例如：帳號由 AD 管理、每季由主管複審權限、離職當天停用">${esc(v.notes)}</textarea></label>
    </div>
    <div class="dgact">
      ${d.fmt==="docx"?`<div><b>下載 Word</b><span class="note">範本的【公司名稱】換成上面的組織名稱，文末附上本次資料供撰寫參考</span><div class="dgprev" id="gPrev"></div><div class="form"><button class="btn primary" id="gWord">下載填好的 Word</button><a class="btn" href="${docHref(d)}" download="${esc(docDl(d))}">下載空白範本</a></div></div>`:
        `<div><b>下載 Excel 範本</b><span class="note">表單與紀錄範本直接下載使用${d.example?"；也有虛構公司的填寫範例":""}</span><div class="form"><a class="btn primary" href="${docHref(d)}" download="${esc(docDl(d))}">下載空白範本</a>${d.example?`<a class="btn" href="${TPL_BASE+d.example}" download="${esc(d.id+" "+d.name+"_填寫範例."+d.fmt)}">下載填寫範例</a>`:""}</div></div>`}
      <div><b>AI 提示詞</b><span class="note">貼到你自己使用的 AI 服務（ChatGPT、Claude、Copilot 等）產生草稿</span>
        <label class="pmanon"><input type="checkbox" id="pmAnon" ${promptAnon?"checked":""}> 去識別化：公司名稱改成「本公司」，負責人只保留單位</label>
        <textarea id="pmText" class="pmtext" readonly rows="10"></textarea>
        <div class="form" style="margin-top:8px"><button class="btn" id="pmCopy">複製提示詞</button><span class="saved" id="pmLen"></span></div></div>
    </div>
    <p class="note" style="margin-top:10px"><b>工具不會把任何資料送出。</b>貼到 AI 服務前請確認公司規定；AI 產生的內容要經權責人員審閱後才能發行。</p>
  </aside>`;
  const proj=()=>docInputProject(p,{org:$("#gOrg").value,scope:$("#gScope").value,industry:$("#gInd").value,notes:$("#gNotes").value});
  let phN=null;
  let prevOpen=false;
  const prev=()=>{const el=$("#gPrev");if(!el)return;const od=el.querySelector("details");if(od)prevOpen=od.open;const q=proj(),c=docContext(q,d),org=q.org;
    const ph=phN===null?"計算中…":phN?`共 ${phN} 處`:"範本中沒有";
    const tb=(h,rows)=>rows.length?`<table class="dgtb"><thead><tr>${h.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.slice(0,8).map(r=>`<tr>${r.map(x=>`<td>${esc(x||"—")}</td>`).join("")}</tr>`).join("")}</tbody></table>${rows.length>8?`<p class="note">另有 ${rows.length-8} 項</p>`:""}`:"";
    el.innerHTML=`<div class="dgline ${org?"":"warn"}"><b>【公司名稱】</b>${ph}${org?` → ${esc(org)}`:"，沒有填組織名稱，會維持【公司名稱】"}</div>
      <details ${prevOpen?"open":""}><summary>文末附錄會放：基本資料${c.controls.length?`、${c.controls.length} 項控制措施`:""}${c.clauses.length?`、${c.clauses.length} 條條款`:""}${c.risks.length?`、${c.risks.length} 項風險`:""}${q.notes?"、補充說明":""}</summary>
      ${tb(["項目","內容"],[["組織",org||"（未填）"],["驗證範圍",q.scope||"（未填）"],["產業與業務特性",[c.industry,...c.features].filter(Boolean).join("、")||"（未選）"],...(q.notes?[["補充說明",q.notes]]:[])])}
      ${tb(["編號","名稱","適用性／狀態","負責人"],c.controls.map(v=>[v.code,v.name,[v.app,v.status].filter(Boolean).join("・"),v.owner]))}
      ${tb(["條款","名稱","狀態"],c.clauses.map(v=>[v.code,v.name,v.status]))}
      ${tb(["編號","風險","固有","殘餘"],c.risks.map(r=>[r.id,r.title,r.inherent,r.residual]))}</details>`};
  if(d.fmt==="docx"&&typeof DecompressionStream!=="undefined"&&location.protocol!=="file:")fetch(docHref(d)).then(r=>r.arrayBuffer()).then(b=>countPlaceholder(b,"【公司名稱】")).then(n=>{phN=n;prev()}).catch(()=>{phN=0;prev()});
  const ta=$("#pmText"),fill=()=>{ta.value=docPrompt(proj(),d,{anon:promptAnon,notes:$("#gNotes").value});$("#pmLen").textContent=`約 ${ta.value.length} 字`;prev()};
  const keep=()=>{if(!p){DOCGEN.org=$("#gOrg").value;DOCGEN.scope=$("#gScope").value;DOCGEN.industry=$("#gInd").value}DOCGEN[id+":notes"]=$("#gNotes").value};
  ["gOrg","gScope","gInd","gNotes"].forEach(k=>$("#"+k).addEventListener("input",()=>{keep();fill()}));
  $("#pmAnon").addEventListener("change",e=>{promptAnon=e.target.checked;fill()});
  $("#gReset").addEventListener("click",()=>{$("#gOrg").value=p?p.org||"":"";$("#gScope").value=p?p.scope||"":"";$("#gInd").value=p?p.industry||"":"";$("#gNotes").value="";keep();fill();$("#gOrg").focus();toast(p?"已重置為專案資料":"已清除填寫內容")});
  $("#pmCopy").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(ta.value);toast("已複製提示詞")}catch(e){ta.focus();ta.select();toast("請按 Ctrl+C 複製選取的文字")}});
  const gw=$("#gWord");if(gw)gw.addEventListener("click",e=>downloadFilledDoc(d,e.currentTarget,proj()));
  host.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",closeDrawer));
  fill();$("#gOrg").focus();
}
/* 下載全部：空白範本包，或把所有 Word 範本帶入資料後一次打包 */
function openDocKit(){
  const p=cur(),v=p?{org:p.org||"",scope:p.scope||"",industry:p.industry||""}:{org:DOCGEN.org,scope:DOCGEN.scope,industry:DOCGEN.industry};
  const nW=DOCS.filter(d=>d.fmt==="docx"&&d.status!=="planned").length,nAll=DOCS.filter(d=>d.status!=="planned").length;
  const host=$("#drawerHost");
  host.innerHTML=`<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="下載全部範本">
    <button class="btn x" data-close>關閉</button>
    <div class="code">文件範本・下載全部</div><h2>ISMS 文件範本包</h2>
    <div class="dgact">
      <div><b>空白範本包</b><span class="note">${nAll} 份範本原樣打包，依五層架構分資料夾</span><div class="form"><a class="btn" href="${TPL_BASE}isms-document-kit.zip" download="ISMS文件範本包.zip">下載空白範本包</a></div></div>
      <div><b>帶入資料後打包</b><span class="note">${nW} 份 Word 範本的【公司名稱】換成下面的組織名稱，每份文末附上相關資料${p?"（含本專案的控制措施與風險）":""}；Excel 範本原樣附上</span>
        <div class="dgform">
          <div class="dgreset"><button type="button" class="linkbtn" id="kReset">${p?"重置為專案資料":"清除填寫內容"}</button></div>
          <label>組織名稱<input id="kOrg" value="${esc(v.org)}" placeholder="例如：晨光科技股份有限公司"></label>
          <label>驗證範圍<input id="kScope" value="${esc(v.scope)}" placeholder="例如：台北總部資訊機房與核心營運系統"></label>
          <label>產業<select id="kInd">${INDUSTRIES.map(x=>`<option value="${x.id}" ${x.id===v.industry?"selected":""}>${esc(x.label)}</option>`).join("")}</select></label>
        </div>
        <div class="form"><button class="btn primary" id="kGo">下載帶入資料的範本包</button></div></div>
    </div>
    <p class="note" style="margin-top:10px">全部在瀏覽器裡完成，資料不會送出。要 AI 提示詞時，請在個別文件按「產生文件」。</p>
  </aside>`;
  host.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",closeDrawer));
  $("#kGo").addEventListener("click",async e=>{
    const btn=e.currentTarget,old=btn.textContent,org=$("#kOrg").value.trim();
    if(!org){toast("請先填組織名稱");$("#kOrg").focus();return}
    if(!p){DOCGEN.org=org;DOCGEN.scope=$("#kScope").value;DOCGEN.industry=$("#kInd").value}
    if(location.protocol==="file:"){toast("從本機檔案開啟時無法讀取範本，請改用網站版");return}
    if(typeof DecompressionStream==="undefined"){toast("這個瀏覽器不支援，請改用最新版 Chrome、Edge、Firefox 或 Safari");return}
    btn.disabled=true;btn.textContent="產生中…";
    try{const res=await fetch(TPL_BASE+"isms-document-kit.zip",{cache:"no-cache"});if(!res.ok)throw new Error("讀取範本包失敗");
      const {bytes,filled}=await fillKit(await res.arrayBuffer(),docInputProject(p,{org,scope:$("#kScope").value,industry:$("#kInd").value}));
      await saveFile(`ISMS文件範本包_${safeName(org).slice(0,30)}.zip`,new Blob([bytes],{type:"application/zip"}),"application/zip");
      setTimeout(()=>toast(`已帶入 ${filled} 份 Word 範本`),2300);
    }catch(err){toast("無法產生："+(err&&err.message||"請稍後再試"))}
    finally{btn.disabled=false;btn.textContent=old}});
  $("#kReset").addEventListener("click",()=>{$("#kOrg").value=p?p.org||"":"";$("#kScope").value=p?p.scope||"":"";$("#kInd").value=p?p.industry||"":"";if(!p){DOCGEN.org=DOCGEN.scope=DOCGEN.industry=""}$("#kOrg").focus();toast(p?"已重置為專案資料":"已清除填寫內容")});
  $("#kOrg").focus();
}
/* AI 提示詞：預覽、可去識別化，按鈕複製；工具本身不呼叫任何 AI 服務 */
let promptAnon=false;
function openPrompt(spec){
  const p=cur();if(!p)return;
  const build=()=>spec.kind==="doc"?docPrompt(p,DOC_MAP[spec.id],{anon:promptAnon}):controlPrompt(p,spec.id,{anon:promptAnon});
  const title=spec.kind==="doc"?`${spec.id} ${DOC_MAP[spec.id].name}`:`${spec.id} ${(ANNEX_MAP[spec.id]||{}).name||""} 的實施說明`;
  const host=$("#drawerHost");
  host.innerHTML=`<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="AI 提示詞">
    <button class="btn x" data-close>關閉</button>
    <div class="code">AI 提示詞</div><h2>${esc(title)}</h2>
    <p class="note">工具已把這個專案的相關資料整理成提示詞。複製後貼到你自己使用的 AI 服務（例如 ChatGPT、Claude、Copilot），產生草稿後再依實際情況修改。<b>工具本身不會把任何資料送出。</b></p>
    <label class="pmanon"><input type="checkbox" id="pmAnon" ${promptAnon?"checked":""}> 去識別化：公司名稱改成「本公司」，負責人只保留單位</label>
    <textarea id="pmText" class="pmtext" readonly rows="18"></textarea>
    <div class="form" style="margin-top:12px"><button class="btn primary" id="pmCopy">複製提示詞</button><span class="saved" id="pmLen"></span></div>
    <p class="note" style="margin-top:10px">貼上前請確認公司規定是否允許把這些內容提供給外部 AI 服務；AI 產生的內容要經過權責人員審閱後才能發行。</p>
  </aside>`;
  const ta=$("#pmText"),fill=()=>{ta.value=build();$("#pmLen").textContent=`約 ${ta.value.length} 字`};fill();
  $("#pmAnon").addEventListener("change",e=>{promptAnon=e.target.checked;fill()});
  $("#pmCopy").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(ta.value);toast("已複製提示詞")}catch(e){ta.focus();ta.select();toast("請按 Ctrl+C 複製選取的文字")}});
  host.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",closeDrawer));
  host.querySelector(".x").focus();
}
/* 控制措施或條款詳細頁中的相關文件 */
function relatedDocsHTML(code){
  const list=DOCS.filter(d=>d.clauses.includes(code)||d.controls.includes(code));
  const req=DOC_REQUIREMENTS.find(r=>r.code===code);
  if(!list.length&&!req)return "";
  return `<h3 style="margin-top:18px">相關文件範本</h3>
    ${req?`<p class="note" style="margin:0 0 8px"><b>本條款要求保存：</b>${esc(req.req)}</p>`:""}
    <div class="rel">${list.map(d=>d.status==="planned"?`<span class="drel planned"><span class="mono">${d.id}</span> ${esc(d.name)}（規劃中）</span>`:
      `<a class="drel" href="${docHref(d)}" download="${esc(docDl(d))}"><span class="mono">${d.id}</span> ${esc(d.name)} <span class="saved">${d.fmt==="docx"?"Word":"Excel"}</span></a>`).join("")}</div>`;
}
/* ================= 深淺色切換 =================
   第一次跟隨系統設定；按下後記住選擇（只存在這個瀏覽器，存取失敗時仍可切換） */
const THEME_KEY="isms-mapper-theme";
const sysDark=()=>matchMedia("(prefers-color-scheme: dark)").matches;
function currentTheme(){const t=document.documentElement.dataset.theme;return t||(sysDark()?"dark":"light")}
function applyTheme(t){
  if(t)document.documentElement.dataset.theme=t;else delete document.documentElement.dataset.theme;
  const dark=currentTheme()==="dark",b=$("#themeBtn");
  if(b){b.innerHTML=`<span aria-hidden="true">${dark?"☀":"☾"}</span><span class="tlabel">${dark?"淺色":"深色"}</span>`;
    b.setAttribute("aria-label",dark?"切換為淺色模式":"切換為深色模式");b.setAttribute("aria-pressed",String(dark))}
  const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",dark?"#16211f":"#0e5a6b");
}
(function(){let t=null;try{t=localStorage.getItem(THEME_KEY)}catch(e){}
  applyTheme(t==="dark"||t==="light"?t:null);
  $("#themeBtn").addEventListener("click",()=>{const n=currentTheme()==="dark"?"light":"dark";applyTheme(n);try{localStorage.setItem(THEME_KEY,n)}catch(e){}});
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{if(!document.documentElement.dataset.theme)applyTheme(null)});
})();
/* 自訂案例的新增與編輯 */
function openCaseDrawer(id){
  const p=cur();if(!p)return;
  const old=id?customCases().find(c=>c.id===id):null;
  const draft=old?{...old,k:old.k.join("、"),r:old.r.join("、")}:{t:searchQ.trim()&&!search(searchQ,customCases()).cases.length?searchQ.trim():"",s:"",k:"",r:"",w:"",e:""};
  const host=$("#drawerHost");
  host.innerHTML=`<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="自訂案例">
    <button class="btn x" data-close>關閉</button>
    <div class="code">${old?old.id+"　":""}自訂案例</div><h2>${old?"編輯自訂案例":"新增自訂案例"}</h2>
    <p class="note">只存在這個專案，匯出專案檔時會一起帶走。</p>
    <dl>
      <div><dt>情境標題（必填）</dt><dd><input id="cT" maxlength="80" value="${esc(draft.t)}" placeholder="例如：產線電腦插入來路不明的 USB"></dd></div>
      <div><dt>情境描述</dt><dd><textarea id="cS" rows="2" maxlength="300" placeholder="發生了什麼事">${esc(draft.s)}</textarea></dd></div>
      <div><dt>搜尋關鍵字</dt><dd><input id="cK" value="${esc(draft.k)}" placeholder="以「、」分隔，例如：產線、USB、病毒"></dd></div>
      <div><dt>對應條款與控制措施（必填）</dt><dd><input id="cR" value="${esc(draft.r)}" placeholder="例如：A.8.7、A.7.10、6.1.2"><div id="cRchk" class="saved" style="margin-top:4px"></div><div id="cSugg"></div></dd></div>
      <div><dt>為什麼對應這些條款</dt><dd><textarea id="cW" rows="2" maxlength="300">${esc(draft.w)}</textarea></dd></div>
      <div><dt>應留紀錄</dt><dd><input id="cE" maxlength="300" value="${esc(draft.e)}" placeholder="例如：媒體使用申請、端點管控報表"></dd></div>
    </dl>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="cSave">${old?"儲存":"新增"}</button><button class="btn" data-close>取消</button>${old?`<button class="btn danger" id="cDel" style="margin-left:auto">刪除</button>`:""}</div>
  </aside>`;
  const chk=()=>{const codes=parseRefCodes($("#cR").value);
    $("#cRchk").innerHTML=codes.length?"已辨識："+codes.map(c=>`<span class="mono">${c}</span> ${esc((ANNEX_MAP[c]||CLAUSE_MAP[c]).name)}`).join("、"):"尚未辨識到有效的編號";
    const sug=search([$("#cT").value,$("#cS").value,$("#cK").value].join(" ")).refs.map(x=>x.code).filter(c=>!codes.includes(c)).slice(0,6);
    $("#cSugg").innerHTML=sug.length?`<div class="saved" style="margin:6px 0 4px">依描述建議：</div><div class="hints" style="margin:0">${sug.map(c=>`<button class="chip" data-addref="${c}">＋ ${c} ${esc((ANNEX_MAP[c]||CLAUSE_MAP[c]).name)}</button>`).join("")}</div>`:"";
    $("#cSave").disabled=!$("#cT").value.trim()||!codes.length};
  ["cT","cS","cK","cR"].forEach(i=>$("#"+i).addEventListener("input",chk));
  $("#cSugg").addEventListener("click",e=>{const b=e.target.closest("[data-addref]");if(!b)return;const v=$("#cR").value.trim();$("#cR").value=(v?v+"、":"")+b.dataset.addref;chk()});
  host.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>{host.innerHTML="";renderSearchResult()}));
  $("#cSave").addEventListener("click",()=>{
    const c=sanitizeCase({id:old?old.id:nextCaseId(p),t:$("#cT").value,s:$("#cS").value,k:splitKeywords($("#cK").value),r:parseRefCodes($("#cR").value),w:$("#cW").value,e:$("#cE").value});
    if(!c||!c.r.length)return;
    if(!c.k.length)c.k=[c.t];
    const list=customCases(),i=list.findIndex(x=>x.id===c.id);if(i>=0)list[i]=c;else list.push(c);
    touchRisk();host.innerHTML="";searchQ=c.k[0];const si=$("#sInput");if(si)si.value=searchQ;renderSearchResult();toast(old?"已更新自訂案例":"已新增自訂案例："+c.t)});
  const del=$("#cDel");if(del)del.addEventListener("click",()=>{const list=customCases(),i=list.findIndex(x=>x.id===old.id);if(i<0)return;
    list.splice(i,1);touchRisk();host.innerHTML="";renderSearchResult();
    undoToast("已刪除自訂案例："+old.t,()=>{list.splice(i,0,old);touchRisk();renderSearchResult()})});
  chk();$("#cT").focus();
}
/* ================= INIT ================= */
$("#tabs").addEventListener("click",e=>{const b=e.target.closest("[data-tab]");if(!b)return;
  if(!cur()&&NEEDS_PROJECT.has(b.dataset.tab)){toast("請先建立專案，或從首頁開啟一個範例");return}
  // 換分頁時關掉右側詳細頁（寬螢幕沒有遮罩，詳細頁不會擋住選單）
  if($("#drawerHost").innerHTML){$("#drawerHost").innerHTML="";drawerTrail=[];drawerCode=null;riskDrawerId=null;lastList=null}
  tab=b.dataset.tab;render();window.scrollTo(0,0)});
$("#projSel").addEventListener("change",e=>{if(e.target.value)openProject(e.target.value,tab==="home"?"overview":tab)});
$("#newBtn").addEventListener("click",goNew);
tab="home";
try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){storeOK=false}
render();

/* 側欄的待辦數字：逾期的風險處理計畫、稽核準備可能不符合、逾期的改善事項 */
function updateNavBadges(){
  const p=cur(),now=Date.now();
  const set=(k,n,why,soft)=>{const el=document.querySelector(`[data-badge="${k}"]`);if(!el)return;el.hidden=!n;el.textContent=n?String(n):"";el.classList.toggle("soft",!!soft);
    const b=el.closest("button");if(b)b.setAttribute("aria-label",b.querySelector(".tl").textContent+(n?`，${n} ${why}`:""))};
  if(!p){["risks","annex","clauses","audit","improve"].forEach(k=>set(k,0));return}
  // 附錄 A：未決定適用性＋適用但還沒實施；條款 4–10：還沒實施的條款
  set("annex",ANNEX.filter(c=>{const v=(p.controls||{})[c.code]||{};return !v.app||(v.app==="Y"&&(v.status||0)<2)}).length,"項待判定或待實施",true);
  set("clauses",CLAUSES.filter(c=>(((p.clauses||{})[c.code]||{}).status||0)<2).length,"條待實施",true);
  set("risks",(p.risks||[]).filter(r=>{const d=planDue(r,now);return d&&d.state==="late"}).length,"項處理計畫逾期");
  // 還沒有適用的控制措施時，稽核準備幾乎每項都會是可能不符合，不顯示數字以免干擾
  const hasApp=ANNEX.some(c=>((p.controls||{})[c.code]||{}).app==="Y");
  set("audit",hasApp?auditReadiness(p,now).flatMap(x=>x.items).filter(x=>x.grade==="nc").length:0,"項可能不符合");
  set("improve",(p.actions||[]).filter(x=>actionOverdue(x,now)).length,"項改善事項逾期");
}
/* 圖示窄欄：手動收合（記在這台瀏覽器），或在筆電寬度打開右側詳細頁時暫時收合 */
(function(){const host=$("#drawerHost"),tog=$("#sideTog"),B=document.body;if(!host||!tog)return;
  const KEYC="isms-side-collapsed",mqTmp=matchMedia("(min-width:961px) and (max-width:1599px)"),mqDesk=matchMedia("(min-width:961px)");
  let collapsed=false;try{collapsed=localStorage.getItem(KEYC)==="1"}catch(e){}
  // 記下展開時標誌列的高度，收合時沿用，圖示才不會往上移
  const sb=document.querySelector(".sbrand");const keepH=()=>{if(sb&&!B.classList.contains("rail"))B.style.setProperty("--sbrand-h",sb.offsetHeight+"px")};keepH();
  const upd=()=>{keepH();const drawer=!!host.querySelector(".drawer"),tmp=drawer&&!collapsed&&mqTmp.matches;
    B.classList.toggle("drawer-open",drawer);B.classList.toggle("side-collapsed",collapsed);
    B.classList.toggle("rail-tmp",tmp);const rail=mqDesk.matches&&(collapsed||tmp);B.classList.toggle("rail",rail);
    tog.setAttribute("aria-expanded",String(!collapsed));const t=collapsed?"展開選單":"收合選單";tog.setAttribute("aria-label",t);tog.querySelector(".stl").textContent=t;if(collapsed)tog.dataset.tip=t;else delete tog.dataset.tip;
    // 窄欄只剩圖示時，滑過顯示名稱
    document.querySelectorAll("#tabs button[data-tab]").forEach(b=>{if(rail)b.dataset.tip=b.querySelector(".tl").textContent;else delete b.dataset.tip});
    dock()};
  // 超寬螢幕：內容右邊還放得下詳細頁時，詳細頁直接接在內容右側（不加暗色遮罩，內容仍可操作），視線不用橫跨整個螢幕
  const main=document.querySelector("main"),DW=460,GAP=20;
  const dock=()=>{const drawer=!!host.querySelector(".drawer");let ok=false,left=0;
    if(drawer&&mqDesk.matches&&main){const r=main.getBoundingClientRect(),pr=parseFloat(getComputedStyle(main).paddingRight)||0;
      left=Math.round(r.right-pr+GAP);ok=innerWidth-left>=DW+12}
    B.classList.toggle("dock",ok);if(ok)B.style.setProperty("--dock-l",left+"px");else B.style.removeProperty("--dock-l")};
  addEventListener("resize",dock);
  // 收合／展開有 0.2 秒的動畫，動畫結束後再算一次版面，避免詳細頁停在舊位置蓋住內容
  B.addEventListener("transitionend",e=>{if(e.target===B&&e.propertyName==="padding-left")dock()});
  tog.addEventListener("click",()=>{const tp=document.querySelector(".tip");if(tp)tp.hidden=true;collapsed=!collapsed;try{localStorage.setItem(KEYC,collapsed?"1":"0")}catch(e){}upd()});
  new MutationObserver(upd).observe(host,{childList:true});
  (mqTmp.addEventListener?mqTmp.addEventListener("change",upd):mqTmp.addListener(upd));
  upd();
})();
/* 平板與手機：上方列的選單鈕開關側欄 */
(function(){const btn=$("#menuBtn"),scrim=$("#sideScrim");if(!btn)return;
  const setOpen=o=>{document.body.classList.toggle("sideopen",o);btn.setAttribute("aria-expanded",o);scrim.hidden=!o;if(o){const sel=$("#tabs [aria-selected=\"true\"]");if(sel)sel.focus({preventScroll:true})}};
  btn.addEventListener("click",()=>setOpen(!document.body.classList.contains("sideopen")));
  scrim.addEventListener("click",()=>setOpen(false));
  $("#tabs").addEventListener("click",e=>{if(e.target.closest("[data-tab]"))setOpen(false)});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&document.body.classList.contains("sideopen")){setOpen(false);btn.focus()}});
})();
/* 分頁列：還能往右捲時右側淡出，捲到底就取消 */
(function(){const t=document.getElementById("tabs");if(!t)return;
  const upd=()=>t.classList.toggle("atend",t.scrollLeft+t.clientWidth>=t.scrollWidth-4);
  t.addEventListener("scroll",upd,{passive:true});window.addEventListener("resize",upd);upd();
  // 目前分頁在畫面外時捲進來
  t.addEventListener("click",()=>setTimeout(()=>{const b=t.querySelector('[aria-selected="true"]');if(b)b.scrollIntoView({block:"nearest",inline:"nearest"});upd()},0));
})();
document.addEventListener("input",e=>{const el=e.target;if(el.matches&&el.matches("[data-reason],input[data-f=evidence]"))el.title=el.value});
