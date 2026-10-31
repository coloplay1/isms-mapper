/* ISMS 條款對照台：用專案資料填寫 Word 範本，以及產生給 AI 的提示詞
   以一般 <script> 載入，頂層宣告與其他檔共用全域範圍。
   - 範本（.docx）在瀏覽器中解開、替換【】、在文末加上「本專案的相關資料」附錄，再重新打包下載；全程不離開瀏覽器
   - 提示詞只產生文字，由使用者自己決定要不要貼到哪個 AI 服務 */

/* ---------- ZIP 讀寫（docx 是 ZIP） ---------- */
const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC_TABLE[(c^b[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
async function inflateRaw(data){
  const ds=new DecompressionStream("deflate-raw");
  const out=new Response(new Blob([data]).stream().pipeThrough(ds));
  return new Uint8Array(await out.arrayBuffer());
}
/* 讀取 ZIP：回傳 [{name, data}]；只支援未壓縮（0）與 deflate（8），超過 30 MB 或檔案數過多視為不正常 */
async function unzipEntries(buf){
  const u=buf instanceof Uint8Array?buf:new Uint8Array(buf),dv=new DataView(u.buffer,u.byteOffset,u.byteLength);
  if(u.length>30*1024*1024)throw new Error("檔案過大");
  let e=-1;for(let i=u.length-22;i>=Math.max(0,u.length-65557);i--){if(dv.getUint32(i,true)===0x06054b50){e=i;break}}
  if(e<0)throw new Error("不是有效的 Word 檔");
  const n=dv.getUint16(e+10,true);let off=dv.getUint32(e+16,true);if(n>2000)throw new Error("檔案內容過多");
  const dec=new TextDecoder(),out=[];
  for(let k=0;k<n;k++){
    if(dv.getUint32(off,true)!==0x02014b50)throw new Error("檔案結構不正確");
    const method=dv.getUint16(off+10,true),csize=dv.getUint32(off+20,true),nl=dv.getUint16(off+28,true),xl=dv.getUint16(off+30,true),cl=dv.getUint16(off+32,true),lh=dv.getUint32(off+42,true);
    const name=dec.decode(u.subarray(off+46,off+46+nl));
    const lnl=dv.getUint16(lh+26,true),lxl=dv.getUint16(lh+28,true),start=lh+30+lnl+lxl,raw=u.subarray(start,start+csize);
    let data;if(method===0)data=raw.slice();else if(method===8)data=await inflateRaw(raw);else throw new Error("不支援的壓縮方式");
    out.push({name,data});off+=46+nl+xl+cl;
  }
  return out;
}
/* 寫出 ZIP（不壓縮；Word 可正常開啟） */
function zipEntries(entries){
  const enc=new TextEncoder(),parts=[],central=[];let off=0;
  const u16=v=>[v&255,(v>>>8)&255],u32=v=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
  for(const {name,data} of entries){
    const nb=enc.encode(name),crc=crc32(data),sz=data.length;
    const lh=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(sz),...u32(sz),...u16(nb.length),...u16(0)]);
    parts.push(lh,nb,data);
    central.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(sz),...u32(sz),...u16(nb.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),nb);
    off+=lh.length+nb.length+sz;
  }
  const cs=central.reduce((a,b)=>a+b.length,0);
  const end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(entries.length),...u16(entries.length),...u32(cs),...u32(off),...u16(0)]);
  const all=[...parts,...central,end],out=new Uint8Array(all.reduce((a,b)=>a+b.length,0));let p=0;for(const a of all){out.set(a,p);p+=a.length}
  return out;
}

/* ---------- 填寫範本 ---------- */
const xmlEsc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const xmlUnesc=s=>String(s).replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&");
/* 依專案資料能確定的【】：目前只有公司名稱；其他（日期、職稱、時限）由組織決定，保留黃色標示 */
function docFillMap(p){const m={};const org=String((p&&p.org)||"").trim();if(org)m["【公司名稱】"]=org;return m}
/* 在 Word XML 中替換【】；整段文字被替換掉的，順便拿掉黃色螢光，表示已經填好 */
function fillDocXml(xml,map){
  const keys=Object.keys(map||{});if(!keys.length)return {xml,count:0};
  let count=0;
  const out=xml.replace(/<w:r>([\s\S]*?)<\/w:r>|<w:r ([^>]*)>([\s\S]*?)<\/w:r>/g,(run,a,attr,b)=>{
    const inner=a!==undefined?a:b;
    let whole=false,changed=false;
    const body=inner.replace(/(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g,(m,o,t,c)=>{
      const raw=xmlUnesc(t);let s=raw;
      for(const k of keys){if(s.includes(k)){s=s.split(k).join(map[k]);count++;changed=true;if(raw.trim()===k)whole=true}}
      return changed?o.replace(/<w:t(?=[\s>])/,'<w:t xml:space="preserve"').replace(/xml:space="preserve"\s+xml:space="preserve"/,'xml:space="preserve"')+xmlEsc(s)+c:m});
    if(!changed)return run;
    const fixed=whole?body.replace(/<w:highlight [^>]*\/>/g,""):body;
    return a!==undefined?`<w:r>${fixed}</w:r>`:`<w:r ${attr}>${fixed}</w:r>`;
  });
  return {xml:out,count};
}
const STATUS_TXT=["未開始","部分實施","已實施","已驗證"];
const TREAT_TXT={mitigate:"降低",accept:"接受",transfer:"移轉",avoid:"避免"};
/* 文件相關的控制措施、條款與風險，整理成附錄用的資料（測試與提示詞共用） */
function docContext(p,d){
  const ctl=c=>((p.controls||{})[c]||{}),cl=c=>((p.clauses||{})[c]||{});
  const app=v=>v.app==="Y"?"適用":v.app==="N"?"不適用":"未決定";
  const controls=(d.controls||[]).filter(c=>ANNEX_MAP[c]).map(c=>{const v=ctl(c);return {code:c,name:ANNEX_MAP[c].name,app:app(v),
    status:v.app==="Y"?STATUS_TXT[v.status||0]:"",owner:[v.owner,v.co?`協辦：${v.co}`:""].filter(Boolean).join("；"),impl:v.impl||"",reason:v.reason||"",evidence:v.evidence||""}});
  const clauses=(d.clauses||[]).filter(c=>CLAUSE_MAP[c]).map(c=>{const v=cl(c);return {code:c,name:CLAUSE_MAP[c].name,status:STATUS_TXT[v.status||0],owner:v.owner||"",evidence:v.evidence||""}});
  const set=new Set(d.controls||[]);
  const risks=(p.risks||[]).filter(r=>(r.controls||[]).some(c=>set.has(c))).map(r=>{const s=inherentScore(r),rs=residualScore(r);
    return {id:r.id,title:r.title||"（未命名風險）",owner:r.owner||"",inherent:s?`${s} ${(riskLevel(s,p)||{}).label||""}`.trim():"未評分",treat:TREAT_TXT[r.treat]||"",residual:rs?`${rs} ${(riskLevel(rs,p)||{}).label||""}`.trim():"",controls:(r.controls||[]).filter(c=>set.has(c))}});
  const ind=INDUSTRY_MAP[p.industry||""];
  return {org:p.org||"",scope:p.scope||"",industry:ind&&ind.id?ind.label:"",features:(p.features||[]).map(f=>(FEATURE_MAP[f]||{}).label).filter(Boolean),controls,clauses,risks};
}
/* 附錄：WordprocessingML 段落與表格 */
function wPara(text,{bold,size,color,before,after,shade}={}){
  const rpr=`<w:rPr>${bold?"<w:b/>":""}${color?`<w:color w:val="${color}"/>`:""}${size?`<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`:""}</w:rPr>`;
  return `<w:p><w:pPr><w:spacing w:before="${before||0}" w:after="${after||80}"/>${shade?`<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>`:""}</w:pPr><w:r>${rpr}<w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r></w:p>`;
}
function wTable(head,rows,widths){
  const total=widths.reduce((a,b)=>a+b,0);
  const cell=(t,w,h)=>`<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${h?'<w:shd w:val="clear" w:color="auto" w:fill="E6EEEE"/>':""}</w:tcPr>${String(t||"—").split("\n").map(line=>`<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr><w:r><w:rPr>${h?"<w:b/>":""}<w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${xmlEsc(line)}</w:t></w:r></w:p>`).join("")}</w:tc>`;
  const b='w:val="single" w:sz="4" w:space="0" w:color="9AA9AC"';
  return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:tblBorders><w:top ${b}/><w:left ${b}/><w:bottom ${b}/><w:right ${b}/><w:insideH ${b}/><w:insideV ${b}/></w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>`+
    `<w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>`+
    `<w:tr><w:trPr><w:tblHeader/></w:trPr>${head.map((h,i)=>cell(h,widths[i],true)).join("")}</w:tr>`+
    rows.map(r=>`<w:tr><w:trPr><w:cantSplit/></w:trPr>${r.map((c,i)=>cell(c,widths[i],false)).join("")}</w:tr>`).join("")+`</w:tbl>`;
}
function docAppendixXml(p,d,now){
  const c=docContext(p,d),dt=new Date(now||Date.now()),ds=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
  const W=9600;let x=`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
  x+=wPara("附錄　本專案的相關資料",{bold:true,size:28,after:60});
  x+=wPara(`由 ISMS 條款對照台於 ${ds} 依專案「${p.name||""}」產生，供撰寫本文件時參考；發行前請整理成正式內容或刪除本附錄。`,{size:18,color:"5A6B72",after:160,shade:"FFF4CC"});
  const meta=[["組織",c.org||"（未填）"],["驗證範圍",c.scope||"（未填）"],["產業與業務特性",[c.industry,...c.features].filter(Boolean).join("、")||"（未選）"]];
  if(String(p.notes||"").trim())meta.push(["補充說明",String(p.notes).trim()]);
  x+=wTable(["項目","內容"],meta,[2000,W-2000]);
  if(c.controls.length){x+=wPara("相關控制措施（附錄 A）",{bold:true,size:22,before:200,after:80});
    x+=wTable(["編號","名稱","適用性／狀態","負責人","實施方式／理由","證據位置"],c.controls.map(v=>[v.code,v.name,v.status?`${v.app}\n${v.status}`:v.app,v.owner,v.impl||v.reason,v.evidence]),[900,1700,1250,1550,2600,1600])}
  if(c.clauses.length){x+=wPara("相關條款（4–10）",{bold:true,size:22,before:200,after:80});
    x+=wTable(["條款","名稱","執行狀態","負責人","證據位置"],c.clauses.map(v=>[v.code,v.name,v.status,v.owner,v.evidence]),[900,3100,1300,1900,2400])}
  if(c.risks.length){x+=wPara("引用上述控制措施的風險",{bold:true,size:22,before:200,after:80});
    x+=wTable(["編號","風險","擁有者","固有風險","處理方式","殘餘風險"],c.risks.map(r=>[r.id,r.title,r.owner,r.inherent,r.treat,r.residual]),[900,3300,1600,1300,1100,1400])}
  if(!c.controls.length&&!c.clauses.length&&!c.risks.length)x+=wPara("本文件沒有對應的控制措施或條款資料。",{size:18,before:120});
  return x;
}
/* 在文件最後一節的 <w:sectPr> 之前插入附錄（保留原本的頁面設定） */
function insertBeforeBodyEnd(xml,frag){
  const i=xml.lastIndexOf("<w:sectPr"),j=xml.lastIndexOf("</w:body>");
  const at=i>=0&&i<j?i:j;if(at<0)throw new Error("不是有效的 Word 文件");
  return xml.slice(0,at)+frag+xml.slice(at);
}
/* 主流程：範本 bytes → 填好的 bytes；回傳 {bytes, replaced} */
async function fillDocx(buf,p,d,now){
  const entries=await unzipEntries(buf),dec=new TextDecoder(),enc=new TextEncoder(),map=docFillMap(p);let replaced=0;
  for(const e of entries){
    if(!/^word\/(document|header\d*|footer\d*)\.xml$/.test(e.name))continue;
    let x=dec.decode(e.data);const r=fillDocXml(x,map);x=r.xml;replaced+=r.count;
    if(e.name==="word/document.xml")x=insertBeforeBodyEnd(x,docAppendixXml(p,d,now));
    e.data=enc.encode(x);
  }
  return {bytes:zipEntries(entries),replaced};
}

/* ---------- 給 AI 的提示詞 ---------- */
/* 去識別化：公司名換成「本公司」，負責人只留單位（「資訊處 周處長」→「資訊處」） */
function anonPerson(s){const t=String(s||"").trim();if(!t)return "";return t.split(/[、；;,，]/).map(x=>x.trim().split(/\s+/)[0]).filter(Boolean).join("、")}
function docPrompt(p,d,{anon=false,notes=""}={}){
  const c=docContext(p,d),org=anon||!c.org?"本公司":c.org,who=s=>anon?anonPerson(s):s;
  const scrub=s=>anon&&c.org?String(s||"").split(c.org).join("本公司"):String(s||"");
  const L=[];
  L.push(d.ctl?`請以台灣企業資安主管的角度，用繁體中文撰寫附錄 A 控制措施「${d.name}」，供 ISO/IEC 27001:2022 資訊安全管理系統的適用性聲明與內部文件使用。`:`請以台灣企業資安主管的角度，用繁體中文撰寫「${d.name}」（文件編號 ${d.id}）的草稿，供 ISO/IEC 27001:2022 資訊安全管理系統使用。`);
  L.push("");L.push("【組織背景】");
  L.push(`- 組織：${org}`);
  if(c.scope)L.push(`- 驗證範圍：${scrub(c.scope)}`);
  if(c.industry||c.features.length)L.push(`- 產業與業務特性：${[c.industry,...c.features].filter(Boolean).join("、")}`);
  if(d.desc)L.push(d.ctl?`- 控制措施要求（摘要）：${d.desc}`:`- 這份文件的目的：${d.desc}`);
  if(String(notes||"").trim()){L.push("");L.push("【組織提供的補充說明（目前做法、系統、規定）】");String(notes).trim().split(/\n+/).forEach(x=>L.push(`- ${scrub(x.trim())}`))}
  if(!(p.controls&&Object.keys(p.controls).length)&&!(p.risks||[]).length){L.push("");L.push("（尚未提供控制措施的執行狀況與風險評鑑結果，請依一般做法撰寫，並用【】標出需要組織確認的地方。）")}
  if(c.clauses.length){L.push("");L.push("【需要涵蓋的條款】");c.clauses.forEach(v=>L.push(`- ${v.code} ${v.name}（目前：${v.status}${v.owner?`，負責：${who(v.owner)}`:""}）`))}
  if(c.controls.length){L.push("");L.push("【相關控制措施與目前做法】");
    c.controls.forEach(v=>L.push(`- ${v.code} ${v.name}：${v.app}${v.status?`、${v.status}`:""}${v.owner?`；負責：${who(v.owner)}`:""}${v.impl?`；目前做法：${scrub(v.impl)}`:""}${v.app==="不適用"&&v.reason?`；排除理由：${scrub(v.reason)}`:""}`))}
  if(c.risks.length){L.push("");L.push("【風險評鑑中與這份文件有關的風險】");
    c.risks.slice(0,10).forEach(r=>L.push(`- ${r.id} ${scrub(r.title)}（固有 ${r.inherent}${r.treat?`，處理方式：${r.treat}`:""}${r.residual?`，殘餘 ${r.residual}`:""}）`))}
  L.push("");L.push("【撰寫要求】");
  L.push("1. 依上面的實際做法撰寫，不要寫組織沒有提到的措施；資料不足或需要決定的地方（例如期限、頻率、核准層級），用【】標示並寫出建議值，例如【每季】。");
  L.push(d.fmt==="xlsx"?"2. 這是表單或紀錄，請設計欄位（欄名、填寫說明、範例值），並說明填寫頻率、負責人與保存方式；以表格呈現。":"2. 包含：目的、適用範圍、權責、作業內容（依步驟寫）、紀錄與表單、相關文件，以及文件管制資訊（編號、版次、核准）。");
  L.push("3. 每個主要段落註明對應的條款或附錄 A 控制措施編號，方便稽核時對照。");
  L.push("4. 不要引用或改寫 ISO/IEC 27001 的標準原文，用自己的話說明要求。");
  L.push("5. 用詞具體、可執行，避免「適當」「必要時」這類沒有標準的說法；需要量化的地方給出數字或判斷方式。");
  L.push("");L.push("【輸出格式】");
  const fn=`${d.ctl?d.id.replace(/\s+/g,""):d.id} ${d.ctl?"實施說明":d.name}`;
  if(d.fmt==="xlsx"){
    L.push(`請直接產生可下載的 Excel 檔（.xlsx），檔名「${fn}.xlsx」：第一列為文件標題（含組織名稱與文件編號），第二列為欄名，接著放 2–3 列範例資料；另開一張「填寫說明」工作表，寫填寫頻率、負責人、保存方式與每個欄位的說明。欄寬調整到內容看得清楚，凍結欄名列。`);
    L.push("如果你無法產生檔案，請改用 Markdown 表格輸出完整內容（每張工作表一個表格，前面用標題標出工作表名稱），方便我貼到 Excel。");
  }else{
    L.push(`請直接產生可下載的 Word 檔（.docx），檔名「${fn}.docx」：使用 Word 內建的標題樣式（標題 1、標題 2）分層，表格加框線，頁首放組織名稱與文件編號，頁尾放頁碼；文件開頭放文件管制表（編號、版次、制定日期、核准）。`);
    L.push("如果你無法產生檔案，請改用 Markdown 輸出完整內容（標題用 #、表格用 Markdown 表格），不要只給大綱或摘要，方便我貼到 Word。");
  }
  return L.join("\n");
}
/* 控制措施的提示詞：撰寫實施方式與證據清單 */
function controlPrompt(p,code,{anon=false}={}){
  const a=ANNEX_MAP[code];if(!a)return "";
  const d={id:code,ctl:true,name:`${code} ${a.name} 的實施說明`,desc:a.desc||"",clauses:[],controls:[code]};
  const base=docPrompt(p,d,{anon}).split("\n【撰寫要求】")[0];
  return base+`\n\n【撰寫要求】
1. 依上面的目前做法，寫出這項控制措施的實施方式（200–400 字），包括誰做、多久做一次、用什麼工具或流程、怎麼確認有效。
2. 列出稽核時可以出示的證據（紀錄名稱、產生頻率、保存位置的建議），並標出目前資料中還缺的部分。
3. 資料不足或需要組織決定的地方用【】標示並給建議值；不要寫組織沒有提到的措施。
4. 不要引用或改寫 ISO/IEC 27001 的標準原文。`;
}

/* 沒有開啟專案（或想覆寫）時，用輸入框的內容組成填寫與提示詞用的資料；有專案時保留它的控制措施與風險 */
function docInputProject(base,{org="",scope="",industry="",notes=""}={}){
  const b=base||{};
  return {...b,name:b.name||"（未建立專案）",org:String(org).trim(),scope:String(scope).trim(),industry:INDUSTRY_MAP[industry]?industry:"",
    features:base&&b.industry===industry?(b.features||[]):[],controls:b.controls||{},clauses:b.clauses||{},risks:b.risks||[],notes:String(notes).trim()};
}
/* 整包範本：解開範本包，逐份 Word 帶入資料（依檔名開頭的文件編號對應），Excel 與說明檔原樣保留，再打包 */
async function fillKit(buf,p,now){
  const entries=await unzipEntries(buf);let filled=0,replaced=0;
  for(const e of entries){
    if(!/\.(docx|xlsx)$/i.test(e.name)||/填寫範例/.test(e.name))continue;
    const base=e.name.split("/").pop(),id=(base.match(/^([A-Z]+-\d+)\s/)||[])[1],d=id&&DOC_MAP[id];
    if(!d)continue;
    const r=/\.xlsx$/i.test(e.name)?await fillXlsx(e.data,p,d):await fillDocx(e.data,p,d,now);e.data=r.bytes;filled++;replaced+=r.replaced;
  }
  return {bytes:zipEntries(entries),filled,replaced};
}
/* 預覽用：範本中某個【】出現幾次（內文、頁首、頁尾） */
async function countPlaceholder(buf,key){
  const dec=new TextDecoder();let n=0;
  for(const e of await unzipEntries(buf)){
    if(!/^word\/(document|header\d*|footer\d*)\.xml$/.test(e.name))continue;
    for(const t of dec.decode(e.data).match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g)||[])n+=xmlUnesc(t.replace(/<[^>]+>/g,"")).split(key).length-1;
  }
  return n;
}
/* ---------- Excel 範本 ----------
   Excel 範本沒有【公司名稱】，帶入方式是：每張工作表 A1 標題前加上組織名稱，
   列印頁首左邊放組織名稱、右邊放文件編號與名稱；其他【】（日期、單位）由組織決定，維持原樣 */
const decEnt=s=>xmlUnesc(String(s).replace(/&#(\d+);/g,(m,n)=>String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi,(m,n)=>String.fromCodePoint(parseInt(n,16))));
function fillSheetXml(xml,org,d){
  if(!org)return {xml,count:0};let count=0;
  let out=xml.replace(/(<c r="A1"[^>]*><is><t(?:\s[^>]*)?>)([\s\S]*?)(<\/t><\/is><\/c>)/,(m,a,t,c)=>{const cur=decEnt(t);if(cur.startsWith(org))return m;count++;return a+xmlEsc(`${org}｜${cur}`)+c});
  const hf=s=>String(s).replace(/&/g,"&&");
  const head=`<oddHeader>${xmlEsc(`&L${hf(org)}&R${hf(d.id+" "+d.name)}`)}</oddHeader>`;
  if(/<oddHeader\s*\/>|<oddHeader><\/oddHeader>/.test(out)){out=out.replace(/<oddHeader\s*\/>|<oddHeader><\/oddHeader>/,head);count++}
  else if(/<headerFooter(?:\s[^>]*)?\/>/.test(out)){out=out.replace(/<headerFooter(?:\s[^>]*)?\/>/,`<headerFooter>${head}</headerFooter>`);count++}
  else if(/<headerFooter(?:\s[^>]*)?>/.test(out)&&!/<oddHeader>/.test(out)){out=out.replace(/(<headerFooter(?:\s[^>]*)?>)/,`$1${head}`);count++}
  return {xml:out,count};
}
async function fillXlsx(buf,p,d){
  const entries=await unzipEntries(buf),dec=new TextDecoder(),enc=new TextEncoder(),org=String((p&&p.org)||"").trim();let replaced=0,sheets=0;
  for(const e of entries){if(!/^xl\/worksheets\/sheet\d+\.xml$/.test(e.name))continue;sheets++;
    const r=fillSheetXml(dec.decode(e.data),org,d);replaced+=r.count;e.data=enc.encode(r.xml)}
  return {bytes:zipEntries(entries),replaced,sheets};
}
