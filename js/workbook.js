/* ISMS 條款對照台：Excel 匯出與匯入（純邏輯，不操作畫面）
   buildWorkbook() 產生工作表資料，交給 write-excel-file 寫檔；範本也是用同一個函式產生，
   所以範本、匯出檔與匯入解析的欄位名稱永遠一致。
   importWorkbook() 依「欄位名稱」而不是欄位位置辨識資料，也能讀其他公司自訂的 SoA／風險表格式。
   以一般 <script> 載入，頂層宣告與其他檔共用全域範圍。 */

/* ---------- 文件管制資訊（7.5） ---------- */
const DOC_FIELDS=[["no","文件編號"],["ver","版次"],["date","日期"],["author","編製"],["reviewer","審查"],["approver","核准"],["approvedAt","核准日期"]];
const DOC_STATUS=["草案","已核准"];
function sanitizeDoc(raw){
  const d={};DOC_FIELDS.forEach(([k])=>d[k]=isObj(raw)?str(raw[k],60).trim():"");
  d.status=isObj(raw)&&DOC_STATUS.includes(raw.status)?raw.status:"草案";
  return d;
}
function docLine(p){
  const d=sanitizeDoc(p&&p.doc),b="＿＿＿";
  return [["文件編號",d.no],["版次",d.ver],["日期",d.date],["狀態",d.status],["編製",d.author],["審查",d.reviewer],["核准",d.approver+(d.approvedAt?"（"+d.approvedAt+"）":"")]]
    .map(([k,v])=>`${k}：${v||b}`).join("｜");
}
function parseDocLine(text){
  const d={},s=String(text||"");if(!s.includes("文件編號"))return null;
  s.split("｜").forEach(part=>{const m=part.match(/^\s*([^：:]+)[：:]\s*(.*)$/);if(!m)return;
    const v=m[2].replace(/^＿+$/,"").trim();
    const f=DOC_FIELDS.find(([,l])=>l===m[1].trim());
    if(f)d[f[0]]=v;
    if(m[1].trim()==="狀態"&&DOC_STATUS.includes(v))d.status=v;
    if(m[1].trim()==="核准"){const a=v.match(/^(.*?)（(.+)）$/);if(a){d.approver=a[1];d.approvedAt=a[2]}}
  });
  return sanitizeDoc(d);
}

/* ---------- 共用 ---------- */
function fmtVal(f,v){
  if(f==="app")return (APP.find(a=>a.v===v)||{label:v}).label;
  if(f==="status")return STATUS[v]?STATUS[v].label:String(v);
  if(f==="focus")return v?"重點":"非重點";
  return v===""||v==null?"（空白）":String(v);
}
function reasonCodes(text){
  const rs=splitReasons(text);
  return Object.entries(REASON_CODES).filter(([,t])=>rs.includes(t)).map(([k])=>k).join("、");
}
/* 「A.5.16／18；A.8.2」「A.5.18 存取權限」這類寫法都拆成編號 */
function parseControlCodes(text){
  const out=[];
  String(text||"").split(/[、，,；;\s\n]+/).forEach(part=>{
    const m=part.match(/^A\.(\d)\.(\d+)((?:[／\/]\d+)*)/);if(!m)return;
    out.push(`A.${m[1]}.${m[2]}`);
    m[3].split(/[／\/]/).slice(1).forEach(n=>out.push(`A.${m[1]}.${n}`));
  });
  return [...new Set(out)];
}
const CIA_LABEL={C:"機密性",I:"完整性",A:"可用性"};
const TREAT_EXPORT={mitigate:"降低",accept:"接受",transfer:"移轉",avoid:"避免"};

/* ---------- 匯出 ---------- */
/* 回傳 write-excel-file 的工作表陣列：[{sheet, data, columns, stickyRowsCount}] */
/* 工作表共用的儲存格格式；top() 是每張表上方的標題、文件管制列與組織／範圍 */
function sheetKit(p){
  const H=t=>({value:String(t),fontWeight:"bold",backgroundColor:"#DCEBEE",wrap:true});
  const V=v=>v===null||v===undefined||v===""?null:(typeof v==="number"?{value:v,type:Number}:{value:String(v),wrap:true});
  const W=a=>a.map(w=>({width:w}));
  const table=(head,rows)=>[head.map(H),...rows.map(r=>r.map(V))];
  const T=v=>v?{value:String(v)}:null;   // 表頭與註記不換行，讓文字延伸到右側空白儲存格
  const top=title=>[[{value:title,fontWeight:"bold",fontSize:14}],[T(docLine(p))],[T(`${p.org||p.name||""}${p.scope?"｜驗證範圍："+p.scope:""}`)],[]];
  return {H,V,W,table,T,top};
}
function buildWorkbook(p,opts={}){
  const now=opts.now||new Date();
  const ctl=code=>(p.controls||{})[code]||{app:"",status:0,owner:"",evidence:"",reason:""};
  const cls=code=>(p.clauses||{})[code]||{status:0,owner:"",evidence:""};
  const {H,V,W,table,T,top}=sheetKit(p);
  const FM=focusMap(p), rbc=risksByControl(p), risks=p.risks||[];
  const lvTxt=s=>s?`${s}（${riskLevel(s,p).label}）`:"";

  const soa=ANNEX.map(c=>{const v=ctl(c.code);
    return [c.code,THEMES.find(t=>t.id===c.theme).name,c.name,c.isNew?"是":"",FM[c.code]?FM[c.code].map(f=>(FEATURE_MAP[f]||{label:"自行標示"}).label).join("、"):"",
      v.app?APP.find(a=>a.v===v.app).label:"",reasonCodes(v.reason),v.reason,v.impl||"",v.app==="N"?"":(v.app?STATUS[v.status].label:""),v.owner,v.evidence,(rbc[c.code]||[]).join("、"),c.ev]});
  const soaData=[...top("適用性聲明（Statement of Applicability）"),
    ...table(["控制措施編號","主題","控制措施","2022 新增","產業建議重點","適用性","理由代碼","納入或排除理由","實施方式","執行狀態","負責人","證據位置","關聯風險","常見證據參考"],soa),
    [],[T("理由代碼：RA 風險評鑑結果、LR 法律或法規、CO 契約或客戶要求、BP 營運需求與業界最佳實務。控制措施名稱為工具自撰摘要，不含 ISO/IEC 27001 原文。")],[],
    ["編製","","審查","","核准",""].map((t,k)=>k%2?null:H(t)),["日期","","日期","","日期",""].map((t,k)=>k%2?null:H(t))];

  const rk=risks.map(r=>[r.id,r.title,r.asset,r.threat,r.vuln||"",r.existing||"",[...(r.cia||"")].map(x=>CIA_LABEL[x]).join("、"),r.owner,r.l||"",r.i||"",lvTxt(inherentScore(r)),
    TREAT_EXPORT[r.treat]||"",(r.controls||[]).map(c=>c+" "+ANNEX_MAP[c].name).join("\n"),r.plan,r.due,r.rl||"",r.ri||"",lvTxt(residualScore(r)),r.accepted?"已核准":"",r.status||""]);
  const rkData=[...top("風險評鑑表暨風險處理計畫"),
    ...table(["風險編號","風險描述","相關資產","威脅","脆弱性","現有控制","影響","風險擁有者","可能性","衝擊","固有風險","處理方式","選定控制措施","處理計畫","預計完成","殘餘可能性","殘餘衝擊","殘餘風險","擁有者核准","處理狀態"],rk)];

  const crit=riskCriteria(p);
  const critData=[...top("風險評鑑準則"),
    ["風險等級","分數下限","分數上限","處理原則"].map(H),...crit.levels.map(l=>[V(l.label),V(SCORES.find(x=>x>=l.min)||l.min),V(l.max),V(POLICIES.find(x=>x.v===l.policy).label)]),[],
    [H("風險分數"),T("可能性 × 衝擊（各 1–5 級），範圍 1–25")],
    [H("核准規定"),T("「需擁有者核准」等級的風險，處理後仍在此等級時須由風險擁有者核准接受；「不可接受」等級須處理至較低等級。")],[],
    ["等級","可能性","衝擊","可能性定義","衝擊定義"].map(H),...[1,2,3,4,5].map(n=>[V(n),V(LIKELIHOOD[n]),V(IMPACT[n]),V(((p.scale||{}).l||[])[n-1]||""),V(((p.scale||{}).i||[])[n-1]||"")])];

  const ck=riskChecks(p).map(c=>[{err:"衝突",warn:"待確認",info:"提醒"}[c.sev],c.rid||"",c.code||"",c.msg]);
  const clRows=CLAUSES.map(c=>{const v=cls(c.code);return [c.code,c.name,c.phase,c.desc,STATUS[v.status].label,v.owner,v.evidence]});

  const sum=[["專案",p.name],["組織",p.org],["驗證範圍",p.scope||""],["產業",INDUSTRY_MAP[p.industry||""]?INDUSTRY_MAP[p.industry||""].label:""],
    ["業務特性",projFeatures(p).map(f=>FEATURE_MAP[f].label).join("、")],["風險準則",criteriaText(p)],["匯出時間",now.toLocaleString("zh-TW",{hour12:false})],[]].map(r=>r.map(V));
  sum.push(["主題","控制措施數","適用","不適用","未決定","已實施","已驗證"].map(H));
  THEMES.forEach(t=>{const list=ANNEX.filter(c=>c.theme===t.id),vs=list.map(c=>ctl(c.code));
    sum.push([t.name,list.length,vs.filter(v=>v.app==="Y").length,vs.filter(v=>v.app==="N").length,vs.filter(v=>!v.app).length,vs.filter(v=>v.app==="Y"&&v.status===2).length,vs.filter(v=>v.app==="Y"&&v.status===3).length].map(V))});
  sum.push([],["不適用但未填排除理由",ANNEX.filter(c=>missingReason(ctl(c.code))).length].map(V));
  const laws=lawsFor(p);if(laws.length){sum.push([],[H("相關法規與標準（整理於"+RULES_DATE+"，請以官方公告為準）")]);laws.forEach(l=>sum.push([l.name,l.kind,l.note].map(V)))}

  const acts=(p.actions||[]).map(a=>[a.id,(ACTION_TYPE_MAP[a.type]||{}).label||"",a.source,a.raised,a.title,a.cause,a.correction,a.action,
    (a.refs||[]).join("、"),a.owner,a.due,actionOverdue(a,now)?a.status+"（逾期）":a.status,a.doneAt,a.verify,a.carried?"沿用自 "+a.carried:""]);
  const actData=[...top("改善追蹤（不符合、矯正措施與改善事項）"),
    ...table(["編號","類型","來源","提出日期","事項描述","原因分析","立即處置","改善或矯正措施","關聯條款／控制措施","負責人","預計完成","狀態","完成日期","有效性確認","備註"],acts),
    [],[T("依條款 9.2 內部稽核、9.3 管理審查、10.1 持續改善、10.2 不符合事項與矯正措施登錄。不符合事項應完成原因分析，並在措施完成後確認有效性再結案。")]];
  const lg=(p.log||[]).slice().reverse().map(e=>{const c=ANNEX_MAP[e.c]||CLAUSE_MAP[e.c];
    return [new Date(e.t).toLocaleString("zh-TW",{hour12:false}),e.c,c?c.name:"",FIELD_LABEL[e.f]||e.f,fmtVal(e.f,e.from),fmtVal(e.f,e.to)]});

  return [
    {sheet:"適用性聲明SoA",data:soaData,columns:W([12,10,24,8,18,8,9,30,28,10,14,24,14,28]),stickyRowsCount:5},
    {sheet:"風險登錄表",data:rkData,columns:W([9,26,16,24,24,18,12,14,7,7,11,8,28,26,11,7,7,11,9,9]),stickyRowsCount:5},
    {sheet:"風險評鑑準則",data:critData,columns:W([14,30,20,36,44])},
    {sheet:"連動檢查",data:[...top("風險評鑑與 SoA 連動檢查"),...table(["類型","風險","控制措施","說明"],ck)],columns:W([8,9,10,70])},
    {sheet:"改善追蹤",data:actData,columns:W([8,12,16,11,30,24,22,28,14,12,11,12,11,24,12]),stickyRowsCount:5},
    {sheet:"條款4-10檢核",data:[...top("管理系統條款 4–10 檢核"),...table(["條款","名稱","PDCA","說明","執行狀態","負責人","證據位置"],clRows)],columns:W([8,24,6,40,10,14,26]),stickyRowsCount:5},
    {sheet:"統計摘要",data:sum,columns:W([22,14,10,10,10,10,10])},
    {sheet:"修改紀錄",data:table(["時間","編號","名稱","欄位","變更前","變更後"],lg),columns:W([20,9,24,10,18,18]),stickyRowsCount:1}
  ];
}

/* ---------- 匯入 ---------- */
/* 欄位名稱的各種寫法（去除空白與括號內文字後比對） */
const IMPORT_COLS={
  soa:{code:["控制措施編號","控制編號"],app:["適用性","是否適用"],codes:["理由代碼","選擇理由"],reason:["納入或排除理由","排除理由","納入理由"],
    impl:["實施方式","實施方式/排除理由"],status:["執行狀態","實施狀態"],owner:["負責人"],evidence:["證據位置","對應文件","證據位置/對應文件"]},
  risk:{id:["風險編號"],title:["風險描述","風險名稱"],asset:["相關資產","資產/範圍","資產"],threat:["威脅","威脅與弱點"],vuln:["脆弱性","弱點","脆弱性/待確認"],
    existing:["現有控制","現有控制待查證"],cia:["影響","CIA"],owner:["風險擁有者","擁有者","擁有者/期限"],l:["可能性","L"],i:["衝擊","I"],
    treat:["處理方式","擬採處理"],controls:["選定控制措施","選用控制","對應控制"],plan:["處理計畫"],due:["預計完成","預計完成日","處理期限"],
    rl:["殘餘可能性","殘餘L"],ri:["殘餘衝擊","殘餘I"],accepted:["擁有者核准"],status:["處理狀態","狀態"]},
  action:{id:["編號","改善編號","矯正編號"],type:["類型"],source:["來源"],raised:["提出日期","發現日期"],title:["事項描述","問題描述","不符合事項"],
    cause:["原因分析"],correction:["立即處置"],action:["改善或矯正措施","矯正措施","改善措施"],refs:["關聯條款/控制措施","關聯條款"],owner:["負責人"],
    due:["預計完成","預計完成日"],status:["狀態","處理狀態"],doneAt:["完成日期"],verify:["有效性確認"],note:["備註"]},
  clause:{code:["條款"],status:["執行狀態","實施狀態"],owner:["負責人"],evidence:["證據位置","對應文件"]}
};
function normHead(h){return String(h??"").replace(/[（(][^）)]*[）)]/g,"").replace(/\s+/g,"").replace(/／/g,"/")}
function cellText(v){
  if(v===null||v===undefined)return "";
  if(v instanceof Date&&!isNaN(v))return v.toISOString().slice(0,10);
  return String(v).trim();
}
function findHeader(data,keys){
  for(let r=0;r<Math.min(data.length,25);r++)if((data[r]||[]).some(h=>keys.includes(normHead(h))))return r;
  return -1;
}
/* 先找完全相同的欄名，再找開頭相同的，避免「擁有者」吃掉「擁有者核准」 */
function mapColumns(row,spec){
  const hs=row.map(normHead),m={},used=new Set();
  for(const [f,al] of Object.entries(spec)){const k=hs.findIndex((h,i)=>!used.has(i)&&al.includes(h));if(k>=0){m[f]=k;used.add(k)}}
  for(const [f,al] of Object.entries(spec)){if(f in m)continue;const k=hs.findIndex((h,i)=>h&&!used.has(i)&&al.some(a=>h.startsWith(a)));if(k>=0){m[f]=k;used.add(k)}}
  return m;
}
function appFrom(t){return /^(適用|納入|是|Y|Yes)$/i.test(t)?"Y":/^(不適用|排除|否|N|No)$/i.test(t)?"N":""}
function statusFrom(t){if(t in STATUS_ALIAS)return STATUS_ALIAS[t];const k=STATUS.findIndex(s=>s.label===t);return k<0?0:k}
function treatFrom(t){return {"降低":"mitigate","接受":"accept","移轉":"transfer","轉移":"transfer","避免":"avoid"}[t]||""}
function dueFrom(v){
  if(v instanceof Date&&!isNaN(v))return v.toISOString().slice(0,10);
  const m=String(v||"").trim().match(/^(\d{4})[\/\-.](\d{1,2})(?:[\/\-.](\d{1,2}))?$/);
  return m?`${m[1]}-${m[2].padStart(2,"0")}${m[3]?"-"+m[3].padStart(2,"0"):""}`:"";
}
/* 「須處理，或經擁有者核准後條件接受」屬於需核准，所以先判斷「不可接受」，再判斷「核准」 */
function policyFrom(t){return /不可接受|不得|須優先/.test(t)?"treat":/核准/.test(t)?"approve":/可接受/.test(t)?"accept":/須處理|必須處理/.test(t)?"treat":""}
/* 風險評鑑準則表中的「可能性定義」「衝擊定義」 */
function parseScale(data){
  const h=data.findIndex(r=>(r||[]).map(normHead).includes("可能性定義"));if(h<0)return null;
  const hs=data[h].map(normHead),cl=hs.indexOf("可能性定義"),ci=hs.indexOf("衝擊定義"),cn=hs.indexOf("等級");
  const s={l:["","","","",""],i:["","","","",""]};
  for(const row of data.slice(h+1,h+8)){const n=Number(cellText((row||[])[cn<0?0:cn]));if(!(n>=1&&n<=5))continue;
    s.l[n-1]=cellText(row[cl]);if(ci>=0)s.i[n-1]=cellText(row[ci])}
  return sanitizeScale(s);
}
function parseCriteria(data){
  // 本工具格式：風險等級｜分數下限｜分數上限｜處理原則
  const h=data.findIndex(r=>(r||[]).map(normHead).includes("風險等級")&&(r||[]).map(normHead).includes("分數上限"));
  if(h>=0){const m=mapColumns(data[h],{label:["風險等級"],max:["分數上限"],policy:["處理原則"]}),lv=[];
    for(let r=h+1;r<data.length;r++){const row=data[r]||[],label=cellText(row[m.label]);if(!label)break;
      lv.push({label,max:Number(cellText(row[m.max])),policy:policyFrom(cellText(row[m.policy]))||(POLICIES.find(x=>x.label===cellText(row[m.policy]))||{}).v||""})}
    const c=sanitizeCriteria({levels:lv});if(c)return c;
  }
  // 文字描述格式：「高風險｜R 15~25：不可接受…」
  const lv=[];
  for(const row of data){const cells=(row||[]).map(cellText);
    for(let k=0;k<cells.length-1;k++){const a=cells[k].match(/^(.{1,4})風險$/),b=cells[k+1].match(/R\s*(\d+)\s*[~～–-]\s*(\d+)\s*[:：]?\s*(.*)$/);
      if(a&&b)lv.push({label:a[1],max:Number(b[2]),policy:policyFrom(b[3])})}}
  return sanitizeCriteria({levels:lv.sort((x,y)=>x.max-y.max)});
}
/* sheets：[{sheet, data:[[儲存格值…]…]}]，回傳 {raw, report}；raw 再交給 sanitizeProject() */
function importWorkbook(sheets,opts={}){
  const raw={name:opts.name||"匯入專案",org:"",controls:{},clauses:{},risks:[],actions:[],criteria:null,doc:null};
  const report={controls:0,risks:0,clauses:0,actions:0,criteria:false,sheets:[],warnings:[]};
  const seenRisk=new Set(),warn=m=>{if(report.warnings.length<50)report.warnings.push(m)};
  for(const {sheet,data} of sheets||[]){
    if(!Array.isArray(data))continue;
    if(!raw.doc)for(const row of data.slice(0,5)){for(const c of row||[]){const d=parseDocLine(c);if(d){raw.doc=d;break}}if(raw.doc)break}
    if(!raw.org)for(const row of data.slice(0,5)){const t=cellText((row||[])[0]);const m=t.match(/^(.+?)｜驗證範圍：(.+)$/);if(m){const ph=x=>/^（.*）$/.test(x)?"":x;raw.org=ph(m[1]);raw.scope=ph(m[2]);break}}
    // 統計摘要的「產業」「業務特性」列
    for(const row of data.slice(0,12)){const k=cellText((row||[])[0]),v=cellText((row||[])[1]);if(!v)continue;
      if(k==="專案"&&!raw.projName)raw.projName=v.slice(0,120);
      if(k==="產業"&&!raw.industry){const ind=INDUSTRIES.find(x=>x.label===v);if(ind)raw.industry=ind.id}
      if(k==="業務特性"&&!raw.features){raw.features=FEATURES.filter(f=>f.id!=="manual"&&v.includes(f.label)).map(f=>f.id)/* 標籤本身可能含「、」，所以用包含比對 */}}
    const hs=findHeader(data,IMPORT_COLS.soa.code);
    const ms=hs>=0?mapColumns(data[hs],IMPORT_COLS.soa):null;
    // 沒有「適用性」欄的表（例如修訂對照、證據清單）不當成 SoA
    if(ms&&!("app" in ms)){if(!/準則/.test(sheet))continue}
    if(ms&&"app" in ms){const m=ms;let n=0;
      for(const row of data.slice(hs+1)){const code=cellText(row&&row[m.code]);if(!/^A\.\d\.\d+$/.test(code))continue;
        if(!ANNEX_MAP[code]){warn(`「${sheet}」的 ${code} 不是 2022 版附錄 A 的編號，已略過`);continue}
        if(raw.controls[code]){warn(`${code} 在多個工作表出現，保留第一次讀到的「${report.sheets[0]||sheet}」內容`);continue}
        const g=k=>k in m?cellText(row[m[k]]):"";
        let app=appFrom(g("app")),st=g("status");if(st==="不適用"){app="N";st=""}
        const rs=splitReasons(g("reason"));
        (g("codes").match(/RA|LR|CO|BP/g)||[]).forEach(k=>{if(!rs.includes(REASON_CODES[k]))rs.push(REASON_CODES[k])});
        let impl=g("impl");if(app==="N"&&!g("reason")&&impl){rs.push(impl);impl=""}
        raw.controls[code]={app,status:app==="N"?0:statusFrom(st),owner:g("owner"),evidence:g("evidence"),reason:rs.join("；"),impl};n++}
      report.controls+=n;if(n)report.sheets.push(sheet);
      if(n&&n<93)warn(`「${sheet}」只有 ${n} 項控制措施，其餘項目為未決定`);
      continue}
    // 改善追蹤表：要有「事項描述」與「狀態」
    const ha=findHeader(data,IMPORT_COLS.action.title);
    const ma=ha>=0?mapColumns(data[ha],IMPORT_COLS.action):null;
    if(ma&&"id" in ma&&"status" in ma){const m=ma,seen=new Set(raw.actions.map(a=>a.id));let n=0;
      for(const row of data.slice(ha+1)){const id=cellText(row&&row[m.id]);if(!/^I-\d{1,4}$/.test(id))continue;
        if(seen.has(id)){warn(`改善事項 ${id} 重複，只保留第一筆`);continue}
        const g=k=>k in m?cellText(row[m[k]]):"";
        const t=ACTION_TYPES.find(x=>x.label===g("type"));
        const carried=(g("note").match(/^沿用自\s*(.+)$/)||[])[1]||"";
        raw.actions.push({id,type:t?t.v:"nc",source:g("source"),raised:dueFrom(row[m.raised]),title:g("title"),cause:g("cause"),correction:g("correction"),
          action:g("action"),refs:parseRefCodes(g("refs")),owner:g("owner"),due:dueFrom(row[m.due]),status:g("status").replace(/（.*）$/,""),
          doneAt:dueFrom(row[m.doneAt]),verify:g("verify"),carried});
        seen.add(id);n++}
      report.actions+=n;if(n)report.sheets.push(sheet);continue}
    const hr=findHeader(data,IMPORT_COLS.risk.id);
    const mr=hr>=0?mapColumns(data[hr],IMPORT_COLS.risk):null;
    // 至少要有編號以外的兩個風險欄位，才當成風險表（避免說明頁裡提到「風險編號」）
    if(mr&&["asset","threat","l","i","treat","controls","owner","title"].filter(k=>k in mr).length>=2){const m=mr;let n=0;
      for(const row of data.slice(hr+1)){const id=cellText(row&&row[m.id]);if(!id)continue;
        if(!/^[A-Z]{1,4}-\d{1,4}$/.test(id)){warn(`「${sheet}」的風險編號「${id}」格式不符（例如 R-001），已略過`);continue}
        if(seenRisk.has(id)){warn(`風險編號 ${id} 重複，只保留第一筆`);continue}
        const g=k=>k in m?cellText(row[m[k]]):"";
        // 範本預留的空白列（只有編號）略過
        if(["title","asset","threat","l","i","treat","controls","owner"].every(k=>!g(k)))continue;
        const treatTxt=g("treat"),treat=treatFrom(treatTxt);
        const codes=parseControlCodes(g("controls"));
        codes.filter(c=>!ANNEX_MAP[c]).forEach(c=>warn(`${id} 引用的 ${c} 不是 2022 版附錄 A 的編號，已略過`));
        let owner=g("owner"),due=dueFrom(k_due(row,m));
        if(owner.includes("／")||owner.includes("/")){const [o,d]=owner.split(/[／\/]/);owner=o.trim();if(!due)due=dueFrom(d)}
        const title=g("title")||[g("asset"),g("threat")].filter(Boolean).join("：");
        raw.risks.push({id,title,asset:g("asset"),threat:g("threat"),vuln:g("vuln"),existing:g("existing"),
          cia:[..."CIA"].filter(x=>g("cia").includes(x)||g("cia").includes(CIA_LABEL[x])).join(""),owner,
          l:Number(g("l"))||0,i:Number(g("i"))||0,rl:Number(g("rl"))||0,ri:Number(g("ri"))||0,
          treat,plan:g("plan")||(treat?"":treatTxt),controls:codes.filter(c=>ANNEX_MAP[c]),due,
          accepted:/已核准|^是$|^Y$|✓|^V$/i.test(g("accepted")),status:RISK_STATUS.includes(g("status"))?g("status"):""});
        seenRisk.add(id);n++}
      report.risks+=n;if(n)report.sheets.push(sheet);continue}
    const hc=findHeader(data,IMPORT_COLS.clause.code);
    if(hc>=0){const m=mapColumns(data[hc],IMPORT_COLS.clause);let n=0;
      for(const row of data.slice(hc+1)){const code=cellText(row&&row[m.code]);if(!CLAUSE_MAP[code])continue;
        const g=k=>k in m?cellText(row[m[k]]):"";
        raw.clauses[code]={status:statusFrom(g("status")),owner:g("owner"),evidence:g("evidence")};n++}
      report.clauses+=n;if(n)report.sheets.push(sheet);continue}
    if(!raw.scale){const sc=parseScale(data);if(sc)raw.scale=sc}
    if(/準則/.test(sheet)||!raw.criteria){const c=parseCriteria(data);if(c&&!raw.criteria){raw.criteria=c;report.criteria=true;report.sheets.push(sheet)}}
  }
  function k_due(row,m){return "due" in m?row[m.due]:""}
  if(!report.controls&&!report.risks)throw new Error("找不到 SoA 或風險評鑑表（需要「控制措施編號」或「風險編號」欄位）");
  return {raw,report};
}
