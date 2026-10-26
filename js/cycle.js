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
    controls,clauses,risks:(p.risks||[]).map(r=>{const o={...r,controls:[...(r.controls||[])]};delete o.reassess;return o}),criteria:p.criteria||null};
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
  const sum={downgraded:0,clauses:0,reassess:0,approvals:0};
  p.id=uid();p.name=str(opts.name,120)||p.name;p.period=str(opts.period,20);
  p.created=p.updated=now;p.log=[];
  delete p.lastBackupAt;p.changesSinceBackup=0;
  // 已驗證代表「去年」查過證據，今年要重新收集，所以降為已實施
  for(const v of Object.values(p.controls))if(v.status===3){v.status=2;sum.downgraded++}
  for(const v of Object.values(p.clauses))if(v.status===3){v.status=2;sum.clauses++}
  // 風險保留去年的分數作為起點，標示待重新評估；擁有者核准每年重新取得
  for(const r of p.risks){if(inherentScore(r)){r.reassess=true;sum.reassess++}if(r.accepted){r.accepted=false;sum.approvals++}}
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
    ["風險與 SoA 待確認事項",issues(base),issues(cur)]
  ].map(([label,from,to])=>({label,from,to,diff:to-from}));
  const pc=k=>plans.filter(x=>x.result===k).length;
  return {
    base:{label:base.label||str(base.period,20)||"比較基準",name:base.name||""},
    cur:{label:str(cur.period,20)||"本期",name:cur.name||""},
    summary:rows,appChanges,statusUp,statusDown,added,removed,changed,plans,
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
      [`去年處理計畫（共 ${ps.total} 項）`,`完成 ${ps.done}／進行中 ${ps.open}／逾期 ${ps.overdue}／狀態未填 ${ps.unknown}／移除 ${ps.removed}`,"處理計畫追蹤"]]),[],
    [H("對應管理審查輸入（9.3.2）")],
    [T("f) 風險評鑑結果與風險處理計畫狀態：風險變更、處理計畫追蹤")],
    [T("d) 資訊安全績效（監督與量測結果）：實施狀態變化、本表摘要")],
    [T("其他輸入請另行準備：a) 前次管理審查決議的處理情形、b) 內外部議題變化、c) 利害關係者需求與期望變化、d) 不符合與矯正措施、稽核結果、目標達成情形、e) 利害關係者回饋、g) 持續改進機會")],
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
  return [
    {sheet:"比較摘要",data:sum,columns:W([34,24,14,14])},
    {sheet:"適用性變更",data:appData,columns:W([12,28,10,10,40]),stickyRowsCount:7},
    {sheet:"實施狀態變化",data:stData,columns:W([12,28,10,10,12]),stickyRowsCount:7},
    {sheet:"風險變更",data:rkData,columns:W([10,10,30,14,14,14,14]),stickyRowsCount:7},
    {sheet:"處理計畫追蹤",data:plData,columns:W([10,28,9,30,11,10,10,12]),stickyRowsCount:7}
  ];
}
