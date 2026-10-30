/* ================= 年度循環：建立新年度、與去年比較 =================
   ISMS 每年要重新評估風險、更新 SoA、做內部稽核與管理審查（9.3）。
   「建立新年度」以去年的專案為基礎複製一份，並保存去年的快照（baseline），
   「與去年比較」列出兩個年度的差異，可匯出 Excel 作為管理審查的輸入資料。 */

const BASE_CTL_FIELDS=["app","status","reason","owner"];
/* 去年快照只保留比較會用到的欄位 */
function snapshotProject(p,label,now){
  const controls={},clauses={};
  for(const [code,v] of Object.entries(p.controls||{})){if(!ANNEX_MAP[code]||!isObj(v))continue;
    const o={};BASE_CTL_FIELDS.forEach(f=>o[f]=v[f]);controls[code]=o}
  for(const [code,v] of Object.entries(p.clauses||{})){if(CLAUSE_MAP[code]&&isObj(v))clauses[code]={status:v.status}}
  return {label:str(label,20)||str(p.period,20)||"去年",name:str(p.name,120),at:now||Date.now(),
    controls,clauses,risks:(p.risks||[]).map(r=>{const o={...r,controls:[...(r.controls||[])]};delete o.reassess;return o}),
    actions:(p.actions||[]).map(a=>({...a,refs:[...(a.refs||[])]})),criteria:p.criteria||null};
}
function sanitizeBaseline(raw){
  if(!isObj(raw)||!isObj(raw.controls))return null;
  const st=v=>{const n=Number(v);return Number.isInteger(n)&&n>=0&&n<=3?n:0};
  const b={label:str(raw.label,20)||"去年",name:str(raw.name,120),at:Number(raw.at)||0,controls:{},clauses:{}};
  for(const [code,v] of Object.entries(raw.controls)){if(!ANNEX_MAP[code]||!isObj(v))continue;
    b.controls[code]={app:["","Y","N"].includes(v.app)?v.app:"",status:st(v.status),reason:str(v.reason,500),owner:str(v.owner,60)}}
  if(isObj(raw.clauses))for(const [code,v] of Object.entries(raw.clauses)){if(CLAUSE_MAP[code]&&isObj(v))b.clauses[code]={status:st(v.status)}}
  const seen=new Set();
  b.risks=Array.isArray(raw.risks)?raw.risks.slice(0,500).map(sanitizeRisk).filter(r=>r&&!seen.has(r.id)&&seen.add(r.id)):[];
  b.risks.forEach(r=>delete r.reassess);
  b.actions=sanitizeActions(raw.actions);
  b.criteria=sanitizeCriteria(raw.criteria);
  return b;
}

/* 版次加一：1.0→2.0、V1.3→V2.0、01→02；無法辨識的保持原樣 */
function bumpVersion(v){
  const s=String(v||"").trim(),m=s.match(/^(\D*?)(\d+)((?:\.\d+)*)$/);
  if(!m)return s;
  const n=String(Number(m[2])+1).padStart(m[2].length,"0");
  return m[1]+n+m[3].replace(/\d+/g,"0");
}
/* 由專案名稱推算新年度：名稱有年份就加一，否則用今年 */
function nextPeriod(p,now){
  const base=String(p&&p.name||"").replace(/^範例｜/,"").slice(0,100);
  const y=(now||new Date()).getFullYear(),m=base.match(/20\d\d/);
  const ny=m?Math.max(Number(m[0])+1,y):y;
  const name=m?base.replace(m[0],String(ny)):`${base||"ISMS"} ${ny}`;
  return {name,period:`${ny} 年度`,prevLabel:str(p&&p.period,20)||`${ny-1} 年度`};
}

/* 建立新年度：回傳新專案（不修改原專案）與處理摘要 */
function rolloverProject(prev,opts={}){
  const now=opts.now||Date.now();
  const src=JSON.parse(JSON.stringify(prev));delete src.baseline;
  const p=sanitizeProject(src);
  const sum={downgraded:0,clauses:0,reassess:0,approvals:0,carried:0};
  p.id=uid();p.name=str(opts.name,120)||p.name;p.period=str(opts.period,20);
  p.created=p.updated=now;p.log=[];p.identOk=false;delete p.identBy;delete p.identAt;p.archived=false;
  delete p.lastBackupAt;p.changesSinceBackup=0;
  // 已驗證代表「去年」查過證據，今年要重新收集，所以降為已實施
  for(const v of Object.values(p.controls))if(v.status===3){v.status=2;sum.downgraded++;delete v.verifier;delete v.verifiedAt}
  for(const v of Object.values(p.clauses))if(v.status===3){v.status=2;sum.clauses++;delete v.verifier;delete v.verifiedAt}
  // 風險保留去年的分數作為起點，標示待重新評估；擁有者核准每年重新取得
  for(const r of p.risks){if(inherentScore(r)){r.reassess=true;sum.reassess++}if(r.accepted){r.accepted=false;sum.approvals++}}
  // 未結案的改善事項帶入新年度；已確認有效的留在去年快照
  const prevLabel=str(opts.prevLabel,20)||str(prev.period,20)||"去年";
  p.actions=p.actions.filter(a=>a.status!==ACTION_CLOSED);
  p.actions.forEach(a=>{if(!a.carried)a.carried=prevLabel});sum.carried=p.actions.length;
  // 抽查紀錄留在去年的專案；最近確認日期保留，超過一年會被列為需要重新確認
  p.spots=[];
  const d=sanitizeDoc(p.doc);
  p.doc={...d,ver:bumpVersion(d.ver),date:"",approvedAt:"",status:"草案"};
  p.baseline=snapshotProject(prev,opts.prevLabel,now);
  return {project:p,summary:sum};
}

/* ---------- 年度比較 ---------- */
const RISK_DONE="已完成";
function compareProjects(base,cur){
  const bc=base.controls||{},cc=cur.controls||{};
  const g=(m,code)=>m[code]||{app:"",status:0,reason:""};
  const appLabel=v=>(APP.find(a=>a.v===v)||APP[0]).label;
  const lv=s=>s?`${s}（${riskLevel(s,cur).label}）`:"未評估";
  const appChanges=[],statusUp=[],statusDown=[];
  for(const c of ANNEX){const b=g(bc,c.code),k=g(cc,c.code);
    if((b.app||"")!==(k.app||""))appChanges.push({code:c.code,name:c.name,from:appLabel(b.app||""),to:appLabel(k.app||""),reason:k.reason||""});
    else if(k.app==="Y"&&b.status!==k.status)(k.status>b.status?statusUp:statusDown).push({code:c.code,name:c.name,from:STATUS[b.status].label,to:STATUS[k.status].label});
  }
  const bm=new Map((base.risks||[]).map(r=>[r.id,r])),cm=new Map((cur.risks||[]).map(r=>[r.id,r]));
  const added=[...cm.values()].filter(r=>!bm.has(r.id));
  const removed=[...bm.values()].filter(r=>!cm.has(r.id));
  const changed=[];
  for(const r of cm.values()){const b=bm.get(r.id);if(!b)continue;
    const [f,t,rf,rt]=[inherentScore(b),inherentScore(r),residualScore(b),residualScore(r)];
    if(f!==t||rf!==rt)changed.push({id:r.id,title:r.title,from:f,to:t,rFrom:rf,rTo:rt,dir:t>f?"up":t<f?"down":rt>rf?"up":"down"})}
  // 去年需要處理的風險（降低、移轉、避免）：看目前專案的處理狀態，風險已刪除則看去年的狀態
  const today=new Date().toISOString().slice(0,10);
  const plans=(base.risks||[]).filter(r=>r.treat&&r.treat!=="accept").map(b=>{const r=cm.get(b.id),st=(r||b).status||"";
    const done=st===RISK_DONE,over=!done&&b.due&&b.due.padEnd(10,"-31")<today;
    return {id:b.id,title:b.title,treat:b.treat,plan:b.plan,due:b.due,baseStatus:b.status||"",curStatus:r?(r.status||""):"",
      result:!r?"風險已移除":done?"已完成":over?"逾期未完成":st?"進行中":"狀態未填"}});
  // 前次改善事項（管理審查決議、矯正措施）的處理情形：9.3.2 a
  const ca=new Map(((cur.actions)||[]).map(a=>[a.id,a]));
  const prevActions=((base.actions)||[]).map(b=>{const a=ca.get(b.id)||b,over=actionOverdue(a);
    return {id:b.id,type:b.type,title:b.title,owner:a.owner,due:a.due,baseStatus:b.status,curStatus:ca.has(b.id)?a.status:"",
      result:a.status===ACTION_CLOSED?"已結案":a.status==="已完成"?"已完成待確認":over?"逾期未完成":a.status}});
  const count=(p,fn)=>Object.values(p.controls||{}).filter(fn).length;
  const levels=riskCriteria(cur).levels;
  const byLv=(p,l)=>(p.risks||[]).filter(r=>{const s=inherentScore(r);return s&&s>=l.min&&s<=l.max}).length;
  const issues=p=>riskChecks({...p,criteria:p.criteria||cur.criteria}).filter(c=>c.sev!=="info").length;
  const rows=[
    ["適用的控制措施",count(base,v=>v.app==="Y"),count(cur,v=>v.app==="Y")],
    ["不適用的控制措施",count(base,v=>v.app==="N"),count(cur,v=>v.app==="N")],
    ["已實施或已驗證",count(base,v=>v.app==="Y"&&v.status>=2),count(cur,v=>v.app==="Y"&&v.status>=2)],
    ["已驗證",count(base,v=>v.app==="Y"&&v.status===3),count(cur,v=>v.app==="Y"&&v.status===3)],
    ["已登錄風險",(base.risks||[]).length,(cur.risks||[]).length],
    ...levels.map(l=>[`固有風險「${l.label}」`,byLv(base,l),byLv(cur,l)]),
    ["風險與 SoA 待確認事項",issues(base),issues(cur)],
    ["改善事項（未結案）",(base.actions||[]).filter(a=>a.status!==ACTION_CLOSED).length,(cur.actions||[]).filter(a=>a.status!==ACTION_CLOSED).length]
  ].map(([label,from,to])=>({label,from,to,diff:to-from}));
  const pc=k=>plans.filter(x=>x.result===k).length;
  return {
    base:{label:base.label||str(base.period,20)||"比較基準",name:base.name||""},
    cur:{label:str(cur.period,20)||"本期",name:cur.name||""},
    summary:rows,prevActions,appChanges,statusUp,statusDown,added,removed,changed,plans,
    planStats:{total:plans.length,done:pc("已完成"),open:pc("進行中"),overdue:pc("逾期未完成"),unknown:pc("狀態未填"),removed:pc("風險已移除")},
    criteriaChanged:!!base.criteria&&criteriaText(base)!==criteriaText(cur),
    lv
  };
}

/* 比較結果的 Excel：摘要、適用性變更、實施狀態、風險變更、處理計畫追蹤 */
function buildComparisonWorkbook(cur,base,opts={}){
  const now=opts.now||new Date(),d=compareProjects(base,cur);
  const {H,V,W,table,T,top}=sheetKit(cur);
  const head=title=>[...top(title),[T(`比較基準：${d.base.label}${d.base.name?"（"+d.base.name+"）":""}｜本期：${d.cur.label}（${d.cur.name}）｜產生時間：${now.toLocaleString("zh-TW",{hour12:false})}`)],[]];
  const sign=n=>n>0?"+"+n:String(n);
  const ps=d.planStats;
  const sum=[...head("年度比較摘要（管理審查輸入）"),
    ...table(["項目",d.base.label,d.cur.label,"增減"],d.summary.map(r=>[r.label,r.from,r.to,sign(r.diff)])),[],
    ...table(["變更項目","筆數","明細工作表"],[
      ["適用性變更的控制措施",d.appChanges.length,"適用性變更"],
      ["實施狀態進步",d.statusUp.length,"實施狀態變化"],["實施狀態退步（含待重新驗證）",d.statusDown.length,"實施狀態變化"],
      ["新增風險",d.added.length,"風險變更"],["移除風險",d.removed.length,"風險變更"],["分數變動的風險",d.changed.length,"風險變更"],
      [`去年處理計畫（共 ${ps.total} 項）`,`完成 ${ps.done}／進行中 ${ps.open}／逾期 ${ps.overdue}／狀態未填 ${ps.unknown}／移除 ${ps.removed}`,"處理計畫追蹤"],
      [`前次改善事項（共 ${d.prevActions.length} 項）`,["已結案","已完成待確認","逾期未完成"].map(k=>`${k} ${d.prevActions.filter(x=>x.result===k).length}`).join("／"),"前次改善事項"]]),[],
    [H("對應管理審查輸入（9.3.2）")],
    [T("a) 前次管理審查決議的處理情形：前次改善事項（含稽核發現與矯正措施）")],
    [T("f) 風險評鑑結果與風險處理計畫狀態：風險變更、處理計畫追蹤")],
    [T("d) 資訊安全績效（監督與量測結果）：實施狀態變化、本表摘要")],
    [T("d) 不符合與矯正措施、稽核結果：前次改善事項；本期明細見工作底稿 Excel 的「改善追蹤」工作表")],
    [T("其他輸入請另行準備：b) 內外部議題變化、c) 利害關係者需求與期望變化、d) 監督量測結果與目標達成情形、e) 利害關係者回饋、g) 持續改善機會")],
    ...(d.criteriaChanged?[[],[T(`注意：風險準則已變更（${d.base.label}：${criteriaText(base)}；${d.cur.label}：${criteriaText(cur)}），等級統計以本期準則計算。`)]]:[])];
  const appData=[...head("適用性變更"),...table(["控制措施編號","控制措施",d.base.label,d.cur.label,"本期納入或排除理由"],d.appChanges.map(x=>[x.code,x.name,x.from,x.to,x.reason]))];
  const stData=[...head("控制措施實施狀態變化（本期適用者）"),
    ...table(["控制措施編號","控制措施",d.base.label,d.cur.label,"變化"],[...d.statusUp.map(x=>[x.code,x.name,x.from,x.to,"進步"]),...d.statusDown.map(x=>[x.code,x.name,x.from,x.to,x.from==="已驗證"&&x.to==="已實施"?"待重新驗證":"退步"])]),
    [],[T("建立新年度時，去年「已驗證」的控制措施會改為「已實施」，重新收集證據後再改回「已驗證」。")]];
  const rkRows=[
    ...d.added.map(r=>["新增",r.id,r.title,"",d.lv(inherentScore(r)),"",d.lv(residualScore(r))]),
    ...d.removed.map(r=>["移除",r.id,r.title,d.lv(inherentScore(r)),"",d.lv(residualScore(r)),""]),
    ...d.changed.map(x=>[x.dir==="up"?"分數上升":"分數下降",x.id,x.title,d.lv(x.from),d.lv(x.to),d.lv(x.rFrom),d.lv(x.rTo)])];
  const rkData=[...head("風險變更"),...table(["類型","風險編號","風險描述",`${d.base.label} 固有`,`${d.cur.label} 固有`,`${d.base.label} 殘餘`,`${d.cur.label} 殘餘`],rkRows)];
  const plData=[...head("去年風險處理計畫追蹤"),
    ...table(["風險編號","風險描述","處理方式","處理計畫","預計完成",`${d.base.label} 狀態`,"目前狀態","結果"],
      d.plans.map(x=>[x.id,x.title,TREAT_EXPORT[x.treat]||"",x.plan,x.due,x.baseStatus,x.curStatus,x.result]))];
  const paData=[...head("前次改善事項處理情形（管理審查決議、稽核發現、矯正措施）"),
    ...table(["編號","類型","事項","負責人","預計完成",`${d.base.label} 狀態`,"目前狀態","結果"],
      d.prevActions.map(x=>[x.id,(ACTION_TYPE_MAP[x.type]||{}).label||"",x.title,x.owner,x.due,x.baseStatus,x.curStatus,x.result])),
    [],[T("建立新年度時，未結案的事項會帶入新年度繼續追蹤；「目前狀態」空白表示該事項已在去年結案。")]];
  return [
    {sheet:"比較摘要",data:sum,columns:W([34,24,14,14])},
    {sheet:"前次改善事項",data:paData,columns:W([9,14,36,14,11,12,12,13]),stickyRowsCount:7},
    {sheet:"適用性變更",data:appData,columns:W([12,28,10,10,40]),stickyRowsCount:7},
    {sheet:"實施狀態變化",data:stData,columns:W([12,28,10,10,12]),stickyRowsCount:7},
    {sheet:"風險變更",data:rkData,columns:W([10,10,30,14,14,14,14]),stickyRowsCount:7},
    {sheet:"處理計畫追蹤",data:plData,columns:W([10,28,9,30,11,10,10,12]),stickyRowsCount:7}
  ];
}

/* ================= 改善追蹤（9.2、9.3、10.1、10.2） =================
   稽核發現、管理審查決議、資安事件檢討與改善機會都登錄為「改善事項」，
   追蹤負責人、期限與狀態；不符合事項需原因分析與有效性確認（10.2）。
   建立新年度時未結案的事項會帶入新年度，年度比較列出前次事項的處理情形（9.3.2 a）。 */
const ACTION_TYPES=[
  // ca：適用 10.2 矯正措施（只有不符合事項）；cause：顯示原因分析欄；corr：顯示立即處置欄；need：說明表「需要填」
  {v:"nc",label:"不符合事項",clause:"10.2",hint:"稽核或自行發現未符合要求，須原因分析與矯正措施",ca:true,cause:true,corr:true,need:"立即處置、原因分析、矯正措施、有效性確認"},
  {v:"obs",label:"觀察事項",clause:"9.2",hint:"稽核提出、尚未構成不符合但可能演變成問題，屬於預防與改善（10.1）",cause:true,need:"處理措施；建議填原因分析"},
  {v:"mr",label:"管理審查決議",clause:"9.3",hint:"管理審查會議決定要執行的事項",need:"處理措施、完成日期"},
  {v:"inc",label:"資安事件檢討",clause:"A.5.27",hint:"從事件學到的教訓與預防措施；若事件顯示未符合要求，改登為不符合事項",cause:true,corr:true,need:"立即處置、處理措施；建議填原因分析"},
  {v:"ofi",label:"改善機會",clause:"10.1",hint:"可以讓 ISMS 更適切、充分或有效的改善",need:"處理措施、完成日期"}
];
const ACTION_TYPE_MAP=Object.assign(Object.create(null),Object.fromEntries(ACTION_TYPES.map(t=>[t.v,t])));   // 無原型：「__proto__」「toString」等鍵查不到
const ACTION_STATUS=["待處理","處理中","已完成","已確認有效"];
const ACTION_CLOSED="已確認有效";
const dateOK=v=>/^\d{4}-\d{2}(-\d{2})?$/.test(v)?v:"";
function blankAction(id){return {id,type:"nc",source:"",raised:"",title:"",cause:"",correction:"",action:"",refs:[],owner:"",due:"",status:"待處理",doneAt:"",verify:"",carried:""}}
function sanitizeAction(raw){
  if(!isObj(raw)||!/^I-\d{1,4}$/.test(raw.id))return null;
  const a=blankAction(raw.id);
  a.type=ACTION_TYPE_MAP[raw.type]?raw.type:"nc";
  a.source=str(raw.source,120);a.title=str(raw.title,300);a.cause=str(raw.cause,500);a.correction=str(raw.correction,500);
  a.action=str(raw.action,500);a.owner=str(raw.owner,60);a.verify=str(raw.verify,500);a.carried=str(raw.carried,20);
  a.refs=Array.isArray(raw.refs)?[...new Set(raw.refs.filter(c=>ANNEX_MAP[c]||CLAUSE_MAP[c]))].slice(0,20):[];
  a.raised=dateOK(raw.raised);a.due=dateOK(raw.due);a.doneAt=dateOK(raw.doneAt);
  a.status=ACTION_STATUS.includes(raw.status)?raw.status:"待處理";
  return a;
}
function sanitizeActions(list){const seen=new Set();
  return Array.isArray(list)?list.slice(0,500).map(sanitizeAction).filter(a=>a&&!seen.has(a.id)&&seen.add(a.id)):[]}
function nextActionId(p){
  const n=Math.max(0,...((p&&p.actions)||[]).map(a=>Number(String(a.id).slice(2))||0));
  return "I-"+String(n+1).padStart(3,"0");
}
const todayStr=now=>new Date(now||Date.now()).toISOString().slice(0,10);
/* 期限只填到月份時，以該月最後一天計 */
const dueEnd=d=>d.length===7?d+"-31":d;
/* 風險處理計畫的期限：只看要執行計畫的處理方式（降低、移轉、避免），已完成或接受的不提醒。
   state：late 逾期、soon 30 天內到期、ok、nodue 尚未設定；回傳 null 表示不需要期限。只寫月份的算到月底 */
const PLAN_SOON_DAYS=30;
function planDue(r,now){
  if(!r||!["mitigate","transfer","avoid"].includes(r.treat)||r.status===RISK_DONE)return null;
  if(!/^\d{4}-\d{2}(-\d{2})?$/.test(r.due||""))return {state:"nodue"};
  const [y,m,d]=r.due.split("-").map(Number),end=d?Date.UTC(y,m-1,d):Date.UTC(y,m,0);
  const days=Math.round((end-Date.parse(todayStr(now)+"T00:00:00Z"))/864e5);
  return {state:days<0?"late":days<=PLAN_SOON_DAYS?"soon":"ok",days};
}
function actionOverdue(a,now){return !!a.due&&!["已完成",ACTION_CLOSED].includes(a.status)&&dueEnd(a.due)<todayStr(now)}
/* 需要注意的地方：逾期、不符合未做原因分析、完成後未確認有效性 */
function actionChecks(p,now){
  const out=[];
  for(const a of (p&&p.actions)||[]){const tag=`${a.id}${a.title?"「"+a.title+"」":""}`,t=ACTION_TYPE_MAP[a.type];
    if(a.status===ACTION_CLOSED)continue;
    if(!a.owner.trim())out.push({sev:"warn",kind:"noOwner",aid:a.id,msg:`${tag} 尚未指定負責人`});
    if(!a.due)out.push({sev:"warn",kind:"noDue",aid:a.id,msg:`${tag} 尚未設定預計完成日`});
    if(actionOverdue(a,now))out.push({sev:"err",kind:"overdue",aid:a.id,msg:`${tag} 已超過預計完成日 ${a.due}`});
    if(a.type==="nc"&&a.status!=="待處理"&&!a.cause.trim())out.push({sev:"warn",kind:"noCause",aid:a.id,msg:`${tag} 為不符合事項，尚未填寫原因分析（10.2 b）`});
    if(a.status==="已完成"&&t.ca)out.push({sev:"info",kind:"verify",aid:a.id,msg:`${tag} 已完成，待確認措施有效後結案（10.2 d）`});
  }
  const rank={err:0,warn:1,info:2};return out.sort((x,y)=>rank[x.sev]-rank[y.sev]);
}
function actionStats(p,now){
  const list=(p&&p.actions)||[];
  return {total:list.length,open:list.filter(a=>a.status!==ACTION_CLOSED).length,overdue:list.filter(a=>actionOverdue(a,now)).length,
    toVerify:list.filter(a=>a.status==="已完成").length,closed:list.filter(a=>a.status===ACTION_CLOSED).length};
}

/* ================= 模擬抽查 =================
   像稽核員一樣從「已實施／已驗證」的控制措施抽樣，請使用者實際打開證據確認；
   另外抽 1～2 個高風險，追處理計畫的執行。結果存成抽查紀錄，可作為內部稽核或稽核前自我檢查的證據。
   抽樣偏重：被高風險引用、2022 新增、從未確認或超過一年未確認、標為已驗證的項目。 */
const SPOT_STALE_DAYS=365;
const SPOT_RESULTS=["","ok","fail","skip"];
const dateOnly=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||"")?d:"";
function evidenceAge(v,now){const d=dateOnly(v&&v.checked);if(!d)return null;
  return Math.floor((Date.parse(todayStr(now)+"T00:00:00Z")-Date.parse(d+"T00:00:00Z"))/864e5)}
function spotCandidates(p,now){
  if(!p)return {ctls:[],risks:[]};
  const risks=p.risks||[],pol=s=>policyOf(s,p);
  const hot=new Set();risks.forEach(r=>{const s=inherentScore(r);if(s&&pol(s)!=="accept")(r.controls||[]).forEach(c=>hot.add(c))});
  const ctls=ANNEX.map(c=>({c,v:(p.controls||{})[c.code]})).filter(x=>x.v&&x.v.app==="Y"&&x.v.status>=2).map(({c,v})=>{
    const why=[],age=evidenceAge(v,now);let w=1;
    if(hot.has(c.code)){w+=2;why.push("高風險引用")}
    if(c.isNew){w+=1;why.push("2022 新增")}
    if(age===null){w+=2;why.push("從未確認")}else if(age>SPOT_STALE_DAYS){w+=2;why.push("超過一年未確認")}
    if(v.status===3){w+=1;why.push("標為已驗證")}
    return {kind:"ctl",id:c.code,w,why}});
  const rk=risks.filter(r=>{const s=inherentScore(r);return s&&pol(s)!=="accept"&&r.treat}).map(r=>({kind:"risk",id:r.id,w:inherentScore(r),why:["高風險"]}));
  return {ctls,risks:rk};
}
/* 依權重不重複抽樣；rnd 可指定，方便測試 */
function weightedPick(list,n,rnd){const pool=list.slice(),out=[];
  while(out.length<n&&pool.length){const tot=pool.reduce((a,x)=>a+x.w,0);let t=rnd()*tot,i=0;
    for(;i<pool.length-1;i++){t-=pool[i].w;if(t<0)break}out.push(pool.splice(i,1)[0])}
  return out}
function pickSpot(p,n,opts={}){
  const rnd=opts.rnd||Math.random,{ctls,risks}=spotCandidates(p,opts.now);
  const nr=opts.risks===false?0:Math.min(risks.length,n>=10?2:1);
  return [...weightedPick(ctls,n,rnd),...weightedPick(risks,nr,rnd)].map(x=>({kind:x.kind,id:x.id,why:x.why,result:"",note:"",act:"",prev:""}));
}
function sanitizeSpotItem(raw){
  if(!isObj(raw)||!["ctl","risk"].includes(raw.kind))return null;
  if(raw.kind==="ctl"?!ANNEX_MAP[raw.id]:!/^R-\d{1,4}$/.test(raw.id))return null;
  return {kind:raw.kind,id:raw.id,why:Array.isArray(raw.why)?raw.why.map(x=>str(x,20)).filter(Boolean).slice(0,5):[],
    result:SPOT_RESULTS.includes(raw.result)?raw.result:"",note:str(raw.note,300),act:/^I-\d{1,4}$/.test(raw.act)?raw.act:"",prev:dateOnly(raw.prev)};
}
function sanitizeSpot(raw){
  if(!isObj(raw)||!/^S-\d{1,4}$/.test(raw.id))return null;
  const items=Array.isArray(raw.items)?raw.items.slice(0,30).map(sanitizeSpotItem).filter(Boolean):[];
  return {id:raw.id,date:dateOnly(raw.date),done:raw.done===true,items};
}
function sanitizeSpots(list){const seen=new Set();
  return Array.isArray(list)?list.slice(-50).map(sanitizeSpot).filter(s=>s&&!seen.has(s.id)&&seen.add(s.id)):[]}
function nextSpotId(p){const n=Math.max(0,...((p&&p.spots)||[]).map(s=>Number(String(s.id).slice(2))||0));return "S-"+String(n+1).padStart(3,"0")}
function spotStats(s){const it=(s&&s.items)||[],n=r=>it.filter(x=>x.result===r).length;
  return {total:it.length,ok:n("ok"),fail:n("fail"),skip:n("skip"),pending:n("")}}

/* ================= 風險評鑑的合理性檢查 =================
   工具無法判斷分數對不對，但可以找出稽核員會追問的矛盾：發生過相關事件卻評很低、沒有評分依據、
   所有風險分數都一樣、所有風險都由同一人擁有。只提出疑點，不代表一定錯。 */
function riskSanity(p){
  const out=[];if(!p)return out;
  const risks=(p.risks||[]).filter(r=>inherentScore(r));
  const incs=(p.actions||[]).filter(a=>a.type==="inc");
  risks.forEach(r=>{
    const rel=incs.filter(a=>(a.refs||[]).some(c=>(r.controls||[]).includes(c)));
    if(rel.length&&r.l<=2)out.push({kind:"incLow",rid:r.id,msg:`曾發生相關的資安事件（${rel.map(a=>a.id).join("、")}），可能性卻評為 ${r.l}「${LIKELIHOOD[r.l]}」`});
    if(!String(r.threat||"").trim()&&!String(r.vuln||"").trim())out.push({kind:"noBasis",rid:r.id,msg:"沒有寫威脅或脆弱性，難以說明評分的依據"});
  });
  if(risks.length>=4&&new Set(risks.map(r=>r.l+"-"+r.i)).size===1)
    out.push({kind:"uniform",msg:`${risks.length} 項風險的可能性與衝擊都相同，可能沒有依準則逐項判斷`});
  const owners=risks.map(r=>String(r.owner||"").trim());
  if(risks.length>=5&&owners.every(Boolean)&&new Set(owners).size===1)
    out.push({kind:"oneOwner",msg:`${risks.length} 項風險的擁有者都是「${owners[0]}」；風險擁有者應是對該風險有權責、能核准處理方式的人`});
  return out;
}
