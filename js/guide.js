/* ================= 下一步建議與導入路線圖 =================
   依專案目前的資料判斷「現在最該做什麼」，讓第一次使用的人不必先懂每個分頁。
   nextSteps()：依急迫程度排序的待辦（逾期、衝突在前，提醒在後）。
   roadmapSteps()：從決定範圍到改善結案的 8 個步驟，各自依資料判斷是否完成。
   兩者都只讀資料、不修改專案。 */

function guideFacts(p,now){
  const ctl=code=>(p.controls||{})[code]||{app:"",status:0,owner:"",reason:""};
  const vs=ANNEX.map(c=>ctl(c.code)),app=vs.filter(v=>v.app==="Y");
  const risks=p.risks||[],checks=riskChecks(p),acts=(p.actions||[]);
  const cl=code=>((p.clauses||{})[code]||{status:0}).status||0;
  const k=kind=>checks.filter(c=>c.kind===kind).length;
  return {
    undecided:vs.filter(v=>!v.app).length,
    noReason:ANNEX.filter(c=>missingReason(ctl(c.code))).length,
    applicable:app.length,
    implemented:app.filter(v=>v.status>=2).length,
    notStarted:app.filter(v=>v.status<2).length,
    noOwner:app.filter(v=>!String(v.owner||"").trim()).length,
    risks:risks.length,
    unscored:risks.filter(r=>!inherentScore(r)).length,
    reassess:risks.filter(r=>r.reassess).length,
    conflicts:checks.filter(c=>c.sev==="err").length,
    riskWarn:checks.filter(c=>c.sev==="warn"&&!["needApproval","noScore","undecided"].includes(c.kind)).length,
    riskCtl:new Set(checks.filter(c=>c.kind==="undecided").map(c=>c.code)).size,
    needApproval:k("needApproval"),
    clausesTotal:CLAUSES.length,
    clausesDone:CLAUSES.filter(c=>cl(c.code)>=2).length,
    auditDone:cl("9.2")>=2,reviewDone:cl("9.3")>=2,
    actOpen:acts.filter(a=>a.status!==ACTION_CLOSED).length,
    actOverdue:acts.filter(a=>actionOverdue(a,now)).length,
    actVerify:acts.filter(a=>a.status==="已完成").length,
    docApproved:sanitizeDoc(p.doc).status==="已核准",
    scope:!!String(p.scope||"").trim(),
    profile:!!p.industry||projFeatures(p).length>0,
    criteria:!!p.criteria&&p.criteriaOk!==false,
    identOk:!!p.identOk,
    // 跨模組一致性：已驗證卻沒有證據位置；未結案的改善事項關聯到判為不適用的控制措施
    noEvidence:app.filter(v=>v.status===3&&!String(v.evidence||"").trim()).length,
    actOnNA:acts.filter(a=>a.status!==ACTION_CLOSED&&(a.refs||[]).some(c=>ANNEX_MAP[c]&&ctl(c).app==="N")).length,
    scaleDefs:!!sanitizeScale(p.scale)
  };
}

/* 每一項：{key, sev: err|warn|info, title, desc, tab, filter?, cta} */
function nextSteps(p,now){
  if(!p)return [];
  const f=guideFacts(p,now),out=[];
  const add=(cond,o)=>{if(cond)out.push(o)};
  add(f.actOverdue,{key:"actOverdue",sev:"err",title:`追蹤 ${f.actOverdue} 項逾期的改善事項`,desc:"超過預計完成日仍未完成，稽核時會被追問（10.2）",tab:"improve",actf:"late",cta:"查看逾期事項"});
  add(f.conflicts,{key:"conflicts",sev:"err",title:`處理 ${f.conflicts} 項風險與 SoA 的衝突`,desc:"例如被風險引用的控制措施卻判為不適用，或不可接受的風險直接接受",tab:"risks",cta:"前往風險評鑑"});
  add(f.reassess,{key:"reassess",sev:"warn",title:`重新評估 ${f.reassess} 項沿用去年分數的風險`,desc:"建立新年度時保留了去年的可能性與衝擊，請依今年情況確認（6.1.2）",tab:"risks",cta:"前往風險評鑑"});
  add(!f.criteria,{key:"criteria",sev:"warn",title:"確認風險評鑑準則",desc:"新專案先帶入預設的四級準則，請確認符合組織可接受的風險程度（6.1.2 a）",tab:"risks",open:"criteria",cta:"確認準則"});
  add(f.criteria&&!f.scaleDefs,{key:"scaleDefs",sev:"info",title:"寫下可能性與衝擊各級的定義",desc:"例如「每年一次」「中斷 1 天」，不同的人評分才會一致，也會匯出到風險評鑑準則",tab:"risks",open:"criteria",cta:"填寫定義"});
  add(!f.risks,{key:"noRisk",sev:"warn",title:"登錄第一個風險",desc:"適用性要依風險評鑑結果決定（6.1.3）。按「新增風險」可從常見情境挑選",tab:"risks",cta:"前往風險評鑑"});
  add(f.risks&&!f.identOk,{key:"identOk",sev:"info",title:"確認風險清單已涵蓋驗證範圍",desc:`目前登錄 ${f.risks} 項。範圍內的主要資產、流程與業務特性都識別過風險後，在風險管理流程的「風險識別」按確認（6.1.2 c）`,tab:"risks",open:"ident",cta:"前往確認"});
  add(f.unscored,{key:"unscored",sev:"warn",title:`評估 ${f.unscored} 項風險的可能性與衝擊`,desc:"還沒有分數，就無法判斷要不要處理（6.1.2 d）",tab:"risks",cta:"前往風險評鑑"});
  add(f.riskCtl,{key:"riskCtl",sev:"warn",title:`把 ${f.riskCtl} 項風險選定的控制措施設為適用`,desc:"風險要用這些控制措施處理，SoA 卻還沒判定；在風險評鑑的連動檢查可一次設為適用",tab:"risks",cta:"前往風險評鑑"});
  add(f.undecided,{key:"undecided",sev:"warn",title:`判定 ${f.undecided} 項控制措施的適用性`,desc:"SoA 需要列出每一項適用或不適用，以及理由（6.1.3 d）",tab:"annex",filter:"undec",cta:"前往附錄 A"});
  add(f.noReason,{key:"noReason",sev:"warn",title:`補填 ${f.noReason} 項排除理由`,desc:"標為不適用卻沒有理由，是稽核最常開的缺失之一",tab:"annex",filter:"noreason",cta:"前往補填"});
  add(f.riskWarn,{key:"riskWarn",sev:"warn",title:`確認 ${f.riskWarn} 項風險處理的待辦`,desc:"例如尚未決定處理方式、沒有選定控制措施或殘餘風險未評估",tab:"risks",cta:"前往風險評鑑"});
  add(f.needApproval,{key:"needApproval",sev:"warn",title:`取得 ${f.needApproval} 項殘餘風險的擁有者核准`,desc:"處理後仍需核准的風險，要由風險擁有者核准接受（6.1.3 f）",tab:"risks",cta:"前往風險評鑑"});
  add(f.noEvidence,{key:"noEvidence",sev:"warn",title:`補上 ${f.noEvidence} 項已驗證控制措施的證據位置`,desc:"標為「已驗證」卻沒寫證據在哪裡，稽核時拿不出佐證",tab:"annex",filter:"noevid",cta:"前往補填"});
  add(f.actOnNA,{key:"actOnNA",sev:"warn",title:`確認 ${f.actOnNA} 項改善事項關聯的控制措施`,desc:"改善事項關聯的控制措施在 SoA 判為不適用，兩邊說法互相矛盾；請調整關聯或重新檢討適用性",tab:"improve",cta:"開啟改善追蹤"});
  add(f.actVerify,{key:"actVerify",sev:"info",title:`確認 ${f.actVerify} 項已完成改善的有效性`,desc:"措施完成後確認有效才能結案（10.2 d）",tab:"improve",actf:"verify",cta:"查看待確認事項"});
  add(f.applicable&&f.notStarted,{key:"notStarted",sev:"info",title:`落實 ${f.notStarted} 項尚未實施的控制措施`,desc:`適用的 ${f.applicable} 項中已實施 ${f.implemented} 項${p.baseline?"；去年已驗證的項目重新收集證據後可改回已驗證":"，記得填寫證據位置"}`,tab:"annex",cta:"前往附錄 A"});
  add(f.applicable&&f.noOwner,{key:"noOwner",sev:"info",title:`指定 ${f.noOwner} 項控制措施的負責人`,desc:"每一項都要有人負責（5.3）",tab:"annex",cta:"前往附錄 A"});
  add(f.clausesDone<f.clausesTotal,{key:"clauses",sev:"info",title:`完成 ${f.clausesTotal-f.clausesDone} 項管理系統條款`,desc:"條款 4–10 是驗證稽核第一階段的重點，可搭配文件範本",tab:"clauses",cta:"前往條款 4–10"});
  add(!f.scope,{key:"scope",sev:"info",title:"填寫驗證範圍",desc:"範圍決定哪些系統、地點與人員納入 ISMS（4.3）",tab:"projects",cta:"前往專案管理"});
  add(f.applicable>0&&!f.docApproved&&!f.undecided&&!f.noReason,{key:"approve",sev:"info",title:"核准 SoA 並填寫文件管制資訊",desc:"SoA 與風險處理計畫需經核准（6.1.3 e、f），核准後把狀態改為「已核准」",tab:"projects",anchor:"docctl",cta:"前往文件管制資訊"});
  return out;
}

/* 核准步驟完成時，直接顯示核准資訊，不用切到專案管理才看得到 */
function approvalText(p){const d=sanitizeDoc(p.doc);
  return ["已核准",d.no&&"文件編號 "+d.no,d.ver&&"版次 "+d.ver,d.approver&&"核准 "+d.approver+(d.approvedAt?"（"+d.approvedAt+"）":"")].filter(Boolean).join("｜")}
/* 導入路線圖：done 依資料判斷；第一個未完成的是目前步驟 */
function roadmapSteps(p,now){
  if(!p)return [];
  const f=guideFacts(p,now);
  const steps=[
    {n:1,keys:["scope"],short:"範圍",title:"決定驗證範圍與業務特性",clause:"4.3",tab:"projects",done:f.scope&&f.profile,
      detail:f.scope?(f.profile?"已填寫範圍與產業特性":"已填寫範圍，尚未選擇產業或業務特性"):"尚未填寫驗證範圍"},
    {n:2,keys:["criteria","scaleDefs"],short:"準則",title:"訂定風險評鑑準則",clause:"6.1.2 a",tab:"risks",open:"criteria",done:f.criteria,
      detail:(f.criteria?"":"尚未確認，目前是預設值：")+criteriaText(p)+(f.scaleDefs?"｜已寫可能性與衝擊定義":"｜尚未寫可能性與衝擊定義")},
    {n:3,keys:["noRisk","identOk","unscored","reassess"],short:"風險評鑑",title:"識別與評估風險",clause:"6.1.2",tab:"risks",done:f.risks>0&&f.identOk&&!f.unscored&&!f.reassess,
      detail:!f.risks?"還沒有登錄風險":[!f.identOk&&"尚未確認風險清單已涵蓋範圍",f.unscored&&`${f.unscored} 項未評估`,f.reassess&&`${f.reassess} 項沿用去年分數，待重新評估`].filter(Boolean).join("、")||`已識別並評估 ${f.risks} 項風險；處理方式與控制措施在下一步決定（6.1.3）`},
    {n:4,keys:["riskCtl","undecided","noReason","conflicts","riskWarn"],short:"處理・SoA",title:"決定風險處理與適用性（SoA）",clause:"6.1.3",tab:"annex",done:f.risks>0&&!f.undecided&&!f.noReason&&!f.conflicts&&!f.riskWarn,
      detail:[f.undecided&&`${f.undecided} 項未判定`,f.noReason&&`${f.noReason} 項缺排除理由`,f.conflicts&&`${f.conflicts} 項衝突`,f.riskWarn&&`${f.riskWarn} 項風險處理待確認`].filter(Boolean).join("、")||"適用性與風險處理一致"},
    {n:5,keys:["needApproval","approve"],short:"核准",title:"核准 SoA 與風險處理計畫",clause:"6.1.3 e、f",tab:"projects",anchor:"docctl",go:"文件管制資訊",done:f.docApproved&&!f.needApproval&&f.applicable>0,
      detail:[!f.docApproved&&"文件狀態尚未改為「已核准」（在專案管理的「文件管制資訊」填寫）",f.needApproval&&`${f.needApproval} 項殘餘風險待擁有者核准`].filter(Boolean).join("、")||approvalText(p)},
    {n:6,keys:["notStarted","noOwner","noEvidence"],short:"落實",title:"落實控制措施並收集證據",clause:"8.1、附錄 A",tab:"annex",done:f.applicable>0&&!f.notStarted,
      detail:f.applicable?`已實施 ${f.implemented}／${f.applicable} 項`:"尚無適用的控制措施"},
    {n:7,keys:["clauses"],short:"稽核",title:"完成管理系統條款、內部稽核與管理審查",clause:"4–10、9.2、9.3",tab:"clauses",done:f.clausesDone===f.clausesTotal,
      detail:`條款已完成 ${f.clausesDone}／${f.clausesTotal} 項｜內部稽核${f.auditDone?"已完成":"未完成"}｜管理審查${f.reviewDone?"已完成":"未完成"}`},
    {n:8,keys:["actOverdue","actVerify","actOnNA"],short:"改善",title:"改善事項結案",clause:"10.1、10.2",tab:"improve",done:f.auditDone&&!f.actOpen,
      detail:f.actOpen?`${f.actOpen} 項未結案${f.actOverdue?`、${f.actOverdue} 項逾期`:""}`:(f.auditDone?"所有改善事項已結案":"內部稽核後登錄發現事項")}
  ];
  /* 未完成步驟的待辦數，顯示在進度圖下方，不用點開就知道還缺多少 */
  const n=x=>+!!x;
  const gaps={
    1:[n(!f.scope)+n(!f.profile)],
    2:[n(!f.criteria)],
    3:f.risks?[f.unscored+f.reassess+n(!f.identOk)]:[0,"尚無風險"],
    4:[f.undecided+f.noReason+f.conflicts+f.riskWarn,f.conflicts?`衝突 ${f.conflicts}`:""],
    5:[n(!f.docApproved)+f.needApproval],
    6:f.applicable?[f.notStarted]:[0,"未開始"],
    7:[f.clausesTotal-f.clausesDone],
    8:f.actOverdue?[f.actOpen,`逾期 ${f.actOverdue}`]:f.auditDone?[f.actOpen]:[f.actOpen,"待稽核"]
  };
  for(const st of steps){if(st.done)continue;const[k,special]=gaps[st.n];
    st.todo=k;st.badge=special||(k?`待辦 ${k}`:"");st.hot=!!special&&/逾期|衝突/.test(special)}
  const cur=steps.find(s=>!s.done);if(cur)cur.current=true;
  return steps;
}

/* 導入進度明細：某一步還沒完成的具體項目，讓使用者在總覽就能點開處理。
   kind：ctl（附錄 A 或條款，點開抽屜）、risk（風險）、act（改善事項）；more 是「查看全部」要帶的分頁與篩選 */
const RISK_NOTE={conflict:"適用性衝突",noTreat:"未決定處理方式",noControl:"未選控制措施",acceptTreat:"處理方式待確認",noResidual:"殘餘風險未評估",residualTreat:"殘餘風險待處理",orphan:"關聯的控制措施不存在",noOwner:"未指定擁有者"};
function roadmapItems(p,n,now){
  if(!p)return {items:[]};
  const ctl=code=>(p.controls||{})[code]||{app:"",status:0};
  const risks=p.risks||[],rmap=Object.fromEntries(risks.map(r=>[r.id,r]));
  const rlabel=id=>id+" "+((rmap[id]&&rmap[id].title)||"（未命名風險）");
  const items=[];let more=null;
  if(n===3){
    risks.forEach(r=>{if(!inherentScore(r))items.push({kind:"risk",id:r.id,label:rlabel(r.id),note:"未評分"});
      else if(r.reassess)items.push({kind:"risk",id:r.id,label:rlabel(r.id),note:"待重新評估"})});
    more={tab:"risks"};
  }else if(n===4){
    const ck=riskChecks(p),seen=new Set();
    ck.filter(c=>c.sev==="err").forEach(c=>{const k=c.rid+c.kind;if(c.rid&&!seen.has(k)){seen.add(k);items.push({kind:"risk",id:c.rid,label:rlabel(c.rid),note:RISK_NOTE[c.kind]||"待確認",hot:true})}});
    ANNEX.forEach(c=>{if(missingReason(ctl(c.code)))items.push({kind:"ctl",id:c.code,label:c.code+" "+c.name,note:"缺排除理由"})});
    ANNEX.forEach(c=>{if(!ctl(c.code).app)items.push({kind:"ctl",id:c.code,label:c.code+" "+c.name,note:"未判定適用性"})});
    ck.filter(c=>c.sev==="warn"&&!["needApproval","noScore","undecided"].includes(c.kind)).forEach(c=>{const k=c.rid+c.kind;if(c.rid&&!seen.has(k)){seen.add(k);items.push({kind:"risk",id:c.rid,label:rlabel(c.rid),note:RISK_NOTE[c.kind]||"待確認"})}});
    const nr=items.filter(x=>x.note==="缺排除理由").length,ud=items.filter(x=>x.note==="未判定適用性").length;
    more=ud?{tab:"annex",filter:"undec"}:nr?{tab:"annex",filter:"noreason"}:{tab:"risks"};
  }else if(n===5){
    const seen=new Set();
    riskChecks(p).filter(c=>c.kind==="needApproval").forEach(c=>{if(c.rid&&!seen.has(c.rid)){seen.add(c.rid);items.push({kind:"risk",id:c.rid,label:rlabel(c.rid),note:"待擁有者核准"})}});
    more={tab:"risks"};
  }else if(n===6){
    ANNEX.forEach(c=>{const v=ctl(c.code);if(v.app==="Y"&&v.status<2)items.push({kind:"ctl",id:c.code,label:c.code+" "+c.name,note:STATUS[v.status].label})});
    more={tab:"annex",filter:"notimpl"};
  }else if(n===7){
    CLAUSES.forEach(c=>{const st=((p.clauses||{})[c.code]||{status:0}).status||0;if(st<2)items.push({kind:"ctl",id:c.code,label:c.code+" "+c.name,note:STATUS[st].label})});
    more={tab:"clauses"};
  }else if(n===8){
    const acts=(p.actions||[]).filter(a=>a.status!==ACTION_CLOSED);
    acts.sort((a,b)=>actionOverdue(b,now)-actionOverdue(a,now));
    acts.forEach(a=>items.push({kind:"act",id:a.id,label:a.id+" "+(a.title||"（未填寫）"),note:actionOverdue(a,now)?"逾期":a.status,hot:actionOverdue(a,now)}));
    more={tab:"improve",actf:"open"};
  }
  return {items,more};
}

/* 文件範本對本專案的必要性：依標準要求、SoA 判定與風險引用自動判斷，回答「為什麼要有這份」。
   level：req 標準要求、need 本專案需要、undec 尚未判定、none 可能不需要、opt 選用 */
function docNeed(p,d){
  if(!p||!d)return null;
  const ctl=code=>((p.controls||{})[code]||{app:""}).app;
  const risks=(p.risks||[]).filter(r=>(r.controls||[]).some(c=>d.controls.includes(c)));
  const rk=risks.map(r=>({id:r.id,title:r.title||"（未命名風險）"}));
  if(d.mandatory)return {level:"req",label:"標準要求",why:`條款 ${d.clauses.join("、")} 要求`,codes:[],risks:rk};
  if(!d.controls.length)return {level:"opt",label:"選用",why:d.clauses.length?`支援條款 ${d.clauses.join("、")} 的作法，標準未要求一定要有這份`:"標準未要求一定要有這份",codes:[],risks:rk};
  const app=d.controls.filter(c=>ctl(c)==="Y"),und=d.controls.filter(c=>!ctl(c));
  if(app.length)return {level:"need",label:"本專案需要",why:`對應的 ${d.controls.length} 項控制措施中，${app.length} 項判為適用`,codes:app,risks:rk};
  if(und.length)return {level:"undec",label:"尚未判定",why:und.length===d.controls.length?`對應的 ${d.controls.length} 項控制措施都還沒判定適用性，判定後才知道需不需要`:`對應的 ${d.controls.length} 項控制措施中，${und.length} 項尚未判定、其餘不適用`,codes:und,risks:rk};
  return {level:"none",label:"可能不需要",why:`對應的 ${d.controls.length} 項控制措施都判為不適用，可考慮不建立`,codes:[],risks:rk};
}

/* ================= 風險管理流程（ISO/IEC 27005、ISO 31000） =================
   把風險登錄表的資料對應到標準的風險管理流程圖：每一步顯示進度，pending 是卡在這一步的風險編號。 */
function riskStages(p,now){
  if(!p)return [];
  const risks=p.risks||[],checks=riskChecks(p),pol=s=>policyOf(s,p);
  const ids=fn=>risks.filter(fn).map(r=>r.id);
  const ckIds=kinds=>[...new Set(checks.filter(c=>kinds.includes(c.kind)).map(c=>c.rid))];
  const scored=risks.filter(r=>inherentScore(r));
  const need=scored.filter(r=>pol(inherentScore(r))!=="accept");
  const n=k=>scored.filter(r=>pol(inherentScore(r))===k).length;
  const today=new Date(now||Date.now()).toISOString().slice(0,10);
  const late=ids(r=>r.due&&r.status!=="已完成"&&r.treat&&r.treat!=="accept"&&(r.due.length===7?r.due+"-31":r.due)<today);
  const ctxOk=!!String(p.scope||"").trim()&&p.criteriaOk!==false;
  const identDone=risks.length>0&&!!p.identOk&&!ckIds(["noOwner"]).length;
  const treatPend=ckIds(["noTreat","noControl","acceptTreat","conflict","undecided"]),accPend=ckIds(["noResidual","residualTreat","needApproval"]);
  const st=[
    {id:"ctx",name:"建立全景",en:"Context",clause:"4、6.1.2 a",done:ctxOk,value:ctxOk?"範圍與準則已確認":"範圍或準則待確認",pending:[]},
    {id:"ident",name:"風險識別",en:"Identification",clause:"6.1.2 c",done:identDone,value:`${risks.length} 項${risks.length&&!p.identOk?"・待確認涵蓋範圍":""}`,
      pending:ids(r=>!String(r.owner||"").trim()),note:"未指定擁有者"},
    {id:"anal",name:"風險分析",en:"Analysis",clause:"6.1.2 d",done:risks.length>0&&scored.length===risks.length,value:`已評分 ${scored.length}／${risks.length}`,
      pending:ids(r=>!inherentScore(r)),note:"未評可能性與衝擊"},
    {id:"eval",name:"風險評估",en:"Evaluation",clause:"6.1.2 e",done:scored.length>0,value:`須處理 ${n("treat")}・需核准 ${n("approve")}・可接受 ${n("accept")}${scored.length<risks.length?`・未評分 ${risks.length-scored.length}`:""}`,
      pending:need.map(r=>r.id),note:"高於可接受水準",info:true},
    {id:"treat",name:"風險處理",en:"Treatment",clause:"6.1.3",done:scored.length>0&&!treatPend.length,
      value:`已決定 ${scored.filter(r=>r.treat).length}／${scored.length}${treatPend.length?`・待確認 ${treatPend.length}`:""}`,pending:treatPend,note:"處理方式或控制措施待確認"},
    {id:"accept",name:"風險接受",en:"Acceptance",clause:"6.1.3 f",done:scored.length>0&&!treatPend.length&&!accPend.length,
      value:accPend.length?`待處理 ${accPend.length}`:"殘餘風險已核准或可接受",pending:accPend,note:"殘餘風險待評估或核准"},
    {id:"consult",name:"溝通與諮詢",en:"Communication & Consultation",clause:"7.4",side:true,done:false,neutral:true,
      value:"與風險擁有者、管理階層溝通風險與處理決定",pending:[],note:""},
    {id:"record",name:"記錄與報告",en:"Recording & Reporting",clause:"6.1.2、8.2、7.5",side:true,
      done:!!p.lastExcelAt&&sanitizeDoc(p.doc).status==="已核准",
      value:`${p.lastExcelAt?"最近匯出 "+new Date(p.lastExcelAt).toISOString().slice(0,10):"尚未匯出風險評鑑表"}・文件${sanitizeDoc(p.doc).status}`,pending:[],note:""},
    {id:"monitor",name:"監督與審查",en:"Monitoring & Review",clause:"8.2、9.1",side:true,done:identDone&&scored.length===risks.length&&!treatPend.length&&!risks.some(r=>r.reassess)&&!late.length,
      value:`待重新評估 ${risks.filter(r=>r.reassess).length}・計畫逾期 ${late.length}`,pending:[...new Set([...ids(r=>r.reassess),...late])],note:"待重新評估或處理計畫逾期"}
  ];
  /* 還沒有可處理的風險時，後續步驟顯示「尚未開始」，避免一排 0 看起來像已經沒問題 */
  const idle=(id,msg)=>{const x=st.find(y=>y.id===id);x.idle=true;x.value=msg};
  if(!risks.length){idle("anal","新增風險後開始");idle("eval","新增風險後開始");idle("treat","新增風險後開始");idle("accept","新增風險後開始");idle("monitor","新增風險後開始")}
  else if(!scored.length){idle("eval","評分後開始");idle("treat","評分後開始");idle("accept","評分後開始")}
  /* 步驟依序完成：前一步還沒完成時，後面的步驟不打勾（例如還有風險沒評分，就不能說評估、處理已完成） */
  let prevDone=true;
  for(const x of st.filter(y=>!y.side)){if(!prevDone&&x.done){x.done=false;x.wait=true}prevDone=x.done}
  const mon=st.find(y=>y.id==="monitor");if(!prevDone)mon.done=false;
  const nx=st.find(x=>!x.side&&!x.done);if(nx)nx.next=true;
  return st;
}
