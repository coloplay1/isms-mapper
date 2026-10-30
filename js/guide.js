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
    scaleDefs:!!sanitizeScale(p.scale),
    // 風險處理計畫的期限（6.1.3、8.3）
    planLate:risks.filter(r=>(planDue(r,now)||{}).state==="late").length,
    planSoon:risks.filter(r=>(planDue(r,now)||{}).state==="soon").length,
    planNoDue:risks.filter(r=>(planDue(r,now)||{}).state==="nodue").length
  };
}

/* 每一項：{key, sev: err|warn|info, title, desc, tab, filter?, cta} */
function nextSteps(p,now){
  if(!p)return [];
  const f=guideFacts(p,now),out=[];
  const add=(cond,o)=>{if(cond)out.push(o)};
  add(f.actOverdue,{key:"actOverdue",sev:"err",title:`追蹤 ${f.actOverdue} 項逾期的改善事項`,desc:"超過預計完成日仍未完成，稽核時會被追問（10.2）",tab:"improve",actf:"late",cta:"前往改善追蹤"});
  add(f.planLate,{key:"planLate",sev:"err",title:`追蹤 ${f.planLate} 項逾期的風險處理計畫`,desc:"超過預計完成日仍未完成；處理計畫的執行情形是管理審查與稽核會檢視的重點（6.1.3、8.3）",tab:"risks",riskf:"late",cta:"前往風險評鑑"});
  add(f.conflicts,{key:"conflicts",sev:"err",title:`處理 ${f.conflicts} 項風險與 SoA 的衝突`,desc:"例如被風險引用的控制措施卻判為不適用，或不可接受的風險直接接受",tab:"risks",cta:"前往風險評鑑"});
  add(f.reassess,{key:"reassess",sev:"warn",title:`重新評估 ${f.reassess} 項沿用去年分數的風險`,desc:"建立新年度時保留了去年的可能性與衝擊，請依今年情況確認（6.1.2）",tab:"risks",cta:"前往風險評鑑"});
  add(!f.criteria,{key:"criteria",sev:"warn",title:"確認風險評鑑準則",desc:"新專案先帶入預設的四級準則，請確認符合組織可接受的風險程度（6.1.2 a）",tab:"risks",open:"criteria",cta:"開啟風險準則"});
  add(f.criteria&&!f.scaleDefs,{key:"scaleDefs",sev:"info",title:"寫下可能性與衝擊各級的定義",desc:"例如「每年一次」「中斷 1 天」，不同的人評分才會一致，也會匯出到風險評鑑準則",tab:"risks",open:"criteria",cta:"開啟風險準則"});
  add(!f.risks,{key:"noRisk",sev:"warn",title:"登錄第一個風險",desc:"適用性要依風險評鑑結果決定（6.1.3）。按「新增風險」可從常見情境挑選",tab:"risks",cta:"前往風險評鑑"});
  add(f.risks&&!f.identOk,{key:"identOk",sev:"info",title:"確認風險清單已涵蓋驗證範圍",desc:`目前登錄 ${f.risks} 項。範圍內的主要資產、流程與業務特性都識別過風險後，在風險管理流程的「風險識別」按確認（6.1.2 c）`,tab:"risks",open:"ident",cta:"前往風險評鑑"});
  add(f.unscored,{key:"unscored",sev:"warn",title:`評估 ${f.unscored} 項風險的可能性與衝擊`,desc:"還沒有分數，就無法判斷要不要處理（6.1.2 d）",tab:"risks",cta:"前往風險評鑑"});
  add(f.riskCtl,{key:"riskCtl",sev:"warn",title:`把 ${f.riskCtl} 項風險選定的控制措施設為適用`,desc:"風險要用這些控制措施處理，SoA 卻還沒判定；在風險評鑑的連動檢查可一次設為適用",tab:"risks",cta:"前往風險評鑑"});
  add(f.undecided,{key:"undecided",sev:"warn",title:`判定 ${f.undecided} 項控制措施的適用性`,desc:"SoA 需要列出每一項適用或不適用，以及理由（6.1.3 d）",tab:"annex",filter:"undec",cta:"前往附錄 A"});
  add(f.noReason,{key:"noReason",sev:"warn",title:`補填 ${f.noReason} 項排除理由`,desc:"標為不適用卻沒有理由，是稽核最常開的缺失之一",tab:"annex",filter:"noreason",cta:"前往附錄 A"});
  add(f.riskWarn,{key:"riskWarn",sev:"warn",title:`確認 ${f.riskWarn} 項風險處理的待辦`,desc:"例如尚未決定處理方式、沒有選定控制措施或殘餘風險未評估",tab:"risks",cta:"前往風險評鑑"});
  add(f.needApproval,{key:"needApproval",sev:"warn",title:`取得 ${f.needApproval} 項殘餘風險的擁有者核准`,desc:"處理後仍需核准的風險，要由風險擁有者核准接受（6.1.3 f）",tab:"risks",cta:"前往風險評鑑"});
  add(f.noEvidence,{key:"noEvidence",sev:"warn",title:`補上 ${f.noEvidence} 項已驗證控制措施的證據位置`,desc:"標為「已驗證」卻沒寫證據在哪裡，稽核時拿不出佐證",tab:"annex",filter:"noevid",cta:"前往附錄 A"});
  add(f.actOnNA,{key:"actOnNA",sev:"warn",title:`確認 ${f.actOnNA} 項改善事項關聯的控制措施`,desc:"改善事項關聯的控制措施在 SoA 判為不適用，兩邊說法互相矛盾；請調整關聯或重新檢討適用性",tab:"improve",cta:"前往改善追蹤"});
  add(f.actVerify,{key:"actVerify",sev:"info",title:`確認 ${f.actVerify} 項已完成改善的有效性`,desc:"措施完成後確認有效才能結案（10.2 d）",tab:"improve",actf:"verify",cta:"前往改善追蹤"});
  add(!f.planLate&&f.planSoon,{key:"planSoon",sev:"info",title:`${f.planSoon} 項風險處理計畫 ${PLAN_SOON_DAYS} 天內到期`,desc:"確認進度，來不及時調整計畫或期限，並記錄原因",tab:"risks",riskf:"soon",cta:"前往風險評鑑"});
  add(f.planNoDue,{key:"planNoDue",sev:"info",title:`替 ${f.planNoDue} 項風險處理計畫設定預計完成日`,desc:"處理計畫要寫明何時完成，才能追蹤是否如期執行（6.1.3 e）",tab:"risks",riskf:"nodue",cta:"前往風險評鑑"});
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
    {n:6,keys:["notStarted","noOwner","noEvidence","planLate","planSoon","planNoDue"],short:"落實",title:"落實控制措施與風險處理計畫",clause:"8.1、8.3、附錄 A",tab:"annex",done:f.applicable>0&&!f.notStarted&&!f.planLate,
      detail:(f.applicable?`已實施 ${f.implemented}／${f.applicable} 項`:"尚無適用的控制措施")+(f.planLate?`｜${f.planLate} 項風險處理計畫逾期`:f.planSoon?`｜${f.planSoon} 項處理計畫 ${PLAN_SOON_DAYS} 天內到期`:"")},
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
    6:f.planLate?[f.notStarted+f.planLate,`逾期 ${f.planLate}`]:f.applicable?[f.notStarted]:[0,"未開始"],
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
    // 逾期的風險處理計畫排最前面
    const late=risks.map(r=>({r,d:planDue(r,now)})).filter(x=>x.d&&x.d.state==="late").sort((a,b)=>a.d.days-b.d.days);
    late.forEach(({r,d})=>items.push({kind:"risk",id:r.id,label:rlabel(r.id),note:`計畫逾期 ${-d.days} 天`,hot:true}));
    ANNEX.forEach(c=>{const v=ctl(c.code);if(v.app==="Y"&&v.status<2)items.push({kind:"ctl",id:c.code,label:c.code+" "+c.name,note:STATUS[v.status].label})});
    more=items.length>late.length?{tab:"annex",filter:"notimpl"}:{tab:"risks",riskf:"late"};
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
  if(d.opt)return {level:"opt",label:"選用",why:d.opt,codes:[],risks:rk};   // 標準未要求、但實務上常見的文件（例如手冊）
  if(!d.controls.length)return {level:"opt",label:"選用",why:d.clauses.length?`支援條款 ${d.clauses.join("、")} 的作法，標準未要求一定要有這份`:"標準未要求一定要有這份",codes:[],risks:rk};
  const app=d.controls.filter(c=>ctl(c)==="Y"),und=d.controls.filter(c=>!ctl(c));
  if(app.length)return {level:"need",label:"本專案需要",why:app.length===d.controls.length?`對應的 ${d.controls.length} 項控制措施都判為適用`:`對應的 ${d.controls.length} 項控制措施中，${app.length} 項判為適用`,codes:app,risks:rk};
  if(und.length)return {level:"undec",label:"尚未判定",why:und.length===d.controls.length?`對應的 ${d.controls.length} 項控制措施都還沒判定適用性，判定後才知道需不需要`:`對應的 ${d.controls.length} 項控制措施中，${und.length} 項尚未判定、其餘不適用`,codes:und,risks:rk};
  return {level:"none",label:"可能不需要",why:`對應的 ${d.controls.length} 項控制措施都判為不適用，可考慮不建立`,codes:[],risks:rk};
}

/* ================= 稽核準備度：用稽核員的角度看同一份資料 =================
   驗證稽核分兩個階段：第一階段審查 ISMS 是否建立（範圍、準則、風險評鑑、SoA、核准），
   第二階段查核是否落實（證據、處理計畫執行、內部稽核、管理審查、矯正措施）。
   grade：nc 可能開立不符合、obs 可能列為觀察或改善建議、ok 資料齊全（工具裡填的資料沒有缺口，不代表證據檔案一定存在）、na 還沒有可查的資料（例如沒有適用的控制措施時，不算已備妥）。
   這是依常見稽核做法整理的參考判斷，實際結果依稽核員與驗證機構而定。 */
/* 每一項「資料齊全」的判斷條件，顯示在畫面上，讓使用者知道工具看的是什麼、要補什麼 */
const AUDIT_RULES={
  scope:"專案有填寫驗證範圍，條款 4.3 標為「已實施」以上，並寫了範圍文件的位置（例如 POL-02 ISMS 適用範圍書，或手冊中的範圍章節）",
  criteria:"風險準則已按「確認」，並寫了可能性與衝擊各級的定義",
  riskAssess:"至少登錄一項風險、全部都已評分，並在風險識別按過「確認風險識別完成」；沒有明顯的矛盾，例如發生過相關事件卻把可能性評得很低、沒寫威脅或脆弱性、所有風險分數都一樣",
  verify:"標為已驗證的控制措施與條款都記錄了確認人，且確認人不是負責人本人；風險識別完成也記錄了確認人",
  soa:"93 項控制措施都已判定適用性，判為不適用的都有排除理由",
  consistent:"已有風險，且風險選定的控制措施在 SoA 都判為適用、沒有衝突",
  approve:"文件管制狀態為「已核准」、需核准的殘餘風險都已勾選擁有者核准、處理計畫都有預計完成日",
  clauses:"條款 4–10 都標為「已實施」或「已驗證」",
  impl:"判為適用的控制措施都標為「已實施」或「已驗證」",
  evidence:"已實施與已驗證的控制措施都有填寫證據位置，抽查確認過的不超過一年；建議用「模擬抽查」實際打開證據確認",
  owner:"判為適用的控制措施都有負責人",
  plan:"降低、移轉或避免的處理計畫都沒有逾期，也沒有 30 天內到期",
  reassess:"建立過新年度，沿用去年分數的風險都已重新評估",
  audit:"條款 9.2 標為「已實施」或「已驗證」",
  review:"條款 9.3 標為「已實施」或「已驗證」",
  correct:"改善事項沒有逾期，已完成的都已確認有效"
};
function auditReadiness(p,now){
  if(!p)return [];
  const f=guideFacts(p,now);
  const vs=ANNEX.map(c=>({c,v:(p.controls||{})[c.code]||{app:"",status:0,evidence:""}})).filter(x=>x.v.app==="Y");
  const notStart=vs.filter(x=>x.v.status===0).length,partial=vs.filter(x=>x.v.status===1).length;
  const implNoEv=vs.filter(x=>x.v.status===2&&!String(x.v.evidence||"").trim()).length;
  const stale=vs.filter(x=>x.v.status>=2&&(evidenceAge(x.v,now)||0)>SPOT_STALE_DAYS).length;
  const verified=[...vs.map(x=>x.v),...CLAUSES.map(c=>(p.clauses||{})[c.code]).filter(Boolean)].filter(v=>v.status===3);
  const noVer=verified.filter(v=>!String(v.verifier||"").trim()).length,selfVer=verified.filter(selfVerified).length;
  const sanity=riskSanity(p);
  const it=(key,clause,title,ask,checks,go,na)=>{
    const rule=AUDIT_RULES[key]||"";
    if(na)return {key,clause,title,ask,rule,grade:"na",detail:[na],go};
    const hit=checks.filter(c=>c[1]);
    const grade=hit.some(c=>c[0]==="nc")?"nc":hit.length?"obs":"ok";
    return {key,clause,title,ask,rule,grade,detail:hit.map(c=>c[2]),go:grade==="ok"?null:go};
  };
  const cl43=(p.clauses||{})["4.3"]||{status:0,evidence:""};
  const noApp=!f.applicable&&"還沒有判為適用的控制措施，判定 SoA 後才查得到";
  const planNeed=(p.risks||[]).some(r=>r.treat&&r.treat!=="accept");
  const s1=[
    it("scope","4.3","ISMS 範圍","請出示 ISMS 範圍文件：包含哪些部門、地點與系統？與外部的介面、排除的部分理由是什麼？",
      [["nc",!f.scope,"尚未填寫驗證範圍"],
       ["nc",f.scope&&cl43.status<2,"範圍要寫成文件化資訊並經核准（4.3）：條款 4.3 尚未標為已實施"],
       ["obs",cl43.status>=2&&!String(cl43.evidence||"").trim(),"條款 4.3 沒有寫範圍文件放在哪裡"]],
      f.scope?{tab:"clauses",cta:"前往條款 4–10"}:{tab:"projects",cta:"前往專案管理"}),
    it("criteria","6.1.2 a、b","風險評鑑準則","風險怎麼評分？多少分以上要處理？由誰核定？",
      [["nc",!f.criteria,"風險準則尚未確認"],["obs",f.criteria&&!f.scaleDefs,"可能性與衝擊沒有寫各級定義，不同人評分可能不一致"]],
      {tab:"risks",open:"criteria",cta:"開啟風險準則"}),
    it("riskAssess","6.1.2","風險評鑑結果","請出示風險評鑑表，這些風險是怎麼識別出來的？",
      [["nc",!f.risks,"還沒有登錄風險"],["nc",f.unscored,`${f.unscored} 項風險未評分`],["obs",f.risks&&!f.identOk,"尚未確認風險清單涵蓋整個範圍"],
       ...sanity.slice(0,4).map(x=>["obs",true,(x.rid?x.rid+"：":"")+x.msg]),["obs",sanity.length>4,`另有 ${sanity.length-4} 項評分依據可能被追問`]],
      {tab:"risks",cta:"前往風險評鑑"}),
    it("soa","6.1.3 d","適用性聲明（SoA）","93 項控制措施都判定了嗎？不適用的理由是什麼？",
      [["nc",f.undecided,`${f.undecided} 項未判定適用性`],["nc",f.noReason,`${f.noReason} 項不適用但沒有理由`]],
      {tab:"annex",filter:f.undecided?"undec":"noreason",cta:"前往附錄 A"}),
    it("consistent","6.1.3 b、c","風險處理與 SoA 一致","風險處理選用的控制措施，在 SoA 中都是適用嗎？",
      [["nc",f.conflicts,`${f.conflicts} 項風險與 SoA 衝突`],["obs",f.riskCtl,`${f.riskCtl} 項風險選定的控制措施在 SoA 尚未判定`]],
      {tab:"risks",cta:"前往風險評鑑"},!f.risks&&"還沒有風險，無法比對風險處理與 SoA"),
    it("approve","6.1.3 e、f","SoA 與風險處理計畫的核准","SoA 與處理計畫由誰核准？殘餘風險有沒有經擁有者接受？",
      [["nc",!f.docApproved,"文件狀態尚未改為「已核准」"],["nc",f.needApproval,`${f.needApproval} 項殘餘風險未經擁有者核准`],["obs",f.planNoDue,`${f.planNoDue} 項處理計畫沒有預計完成日`]],
      f.docApproved?{tab:"risks",cta:"前往風險評鑑"}:{tab:"projects",anchor:"docctl",cta:"前往文件管制資訊"}),
    it("clauses","4–10","管理系統條款","政策、目標、角色職責、文件管制這些管理系統要求都建立了嗎？",
      [["nc",f.clausesDone<f.clausesTotal,`條款 4–10 還有 ${f.clausesTotal-f.clausesDone} 項未實施`]],
      {tab:"clauses",cta:"前往條款 4–10"})
  ];
  const s2=[
    it("impl","8.1、附錄 A","控制措施已實施","請說明這項控制措施現在怎麼執行？",
      [["nc",notStart,`${notStart} 項適用但未開始`],["obs",partial,`${partial} 項部分實施`]],
      {tab:"annex",filter:"notimpl",cta:"前往附錄 A"},noApp),
    it("evidence","7.5、附錄 A","執行證據","請出示最近一次執行的紀錄。",
      [["nc",f.noEvidence,`${f.noEvidence} 項標為已驗證但沒有證據位置`],["obs",implNoEv,`${implNoEv} 項已實施但沒寫證據位置`],["obs",stale,`${stale} 項證據超過一年沒有抽查確認`]],
      {tab:"annex",filter:"noevany",cta:"前往附錄 A"},noApp),
    it("owner","5.3","責任分工","這項控制措施由誰負責？他知道嗎？",
      [["obs",f.applicable&&f.noOwner,`${f.noOwner} 項沒有負責人`]],
      {tab:"annex",cta:"前往附錄 A"},noApp),
    it("plan","8.3","風險處理計畫的執行","處理計畫有沒有如期完成？延誤的原因與因應是什麼？",
      [["nc",f.planLate,`${f.planLate} 項處理計畫逾期`],["obs",!f.planLate&&f.planSoon,`${f.planSoon} 項處理計畫 30 天內到期`]],
      f.planLate||f.planSoon?{tab:"risks",riskf:f.planLate?"late":"soon",cta:"前往風險評鑑"}:{tab:"risks",cta:"前往風險評鑑"},
      !planNeed&&(f.risks?"還沒有需要執行的處理計畫（處理方式為降低、移轉或避免）":"還沒有風險，也就還沒有處理計畫")),
    it("reassess","8.2","定期風險評鑑","今年有重新評估風險嗎？有哪些變化？",
      [["obs",f.reassess,`${f.reassess} 項風險沿用去年分數，尚未重新評估`]],
      {tab:"risks",cta:"前往風險評鑑"},!p.baseline&&"第一年導入；建立新年度後檢查是否重新評估"),
    it("verify","9.2、5.3","確認的獨立性","已驗證的項目是誰確認的？確認的人和負責執行的人是同一個嗎？",
      [["obs",noVer,`${noVer} 項標為已驗證，但沒有記錄確認人`],["obs",selfVer,`${selfVer} 項由負責人自己確認`],["obs",p.identOk&&!String(p.identBy||"").trim(),"風險識別完成沒有記錄確認人"]],
      {tab:"annex",filter:"verissue",cta:"前往附錄 A"},!verified.length&&!p.identOk&&"還沒有標為已驗證的項目"),
    it("audit","9.2","內部稽核","請出示內部稽核計畫、報告與稽核員資格。",
      [["nc",!f.auditDone,"條款 9.2 內部稽核尚未完成"]],
      {tab:"clauses",cta:"前往條款 4–10"}),
    it("review","9.3","管理審查","管理審查的輸入有哪些？做了哪些決議？",
      [["nc",!f.reviewDone,"條款 9.3 管理審查尚未完成"]],
      {tab:"clauses",cta:"前往條款 4–10"}),
    it("correct","10.2","矯正措施","上次的不符合事項改善了嗎？怎麼確認有效？",
      [["nc",f.actOverdue,`${f.actOverdue} 項改善事項逾期`],["obs",f.actVerify,`${f.actVerify} 項已完成但尚未確認有效`]],
      {tab:"improve",actf:f.actOverdue?"late":"verify",cta:"前往改善追蹤"},
      !(p.actions||[]).length&&!f.auditDone&&"還沒有改善事項；內部稽核後登錄發現事項")
  ];
  return [{id:"s1",name:"第一階段：文件審查",desc:"確認 ISMS 已建立：範圍、風險評鑑、SoA 與核准",items:s1},
          {id:"s2",name:"第二階段：實施查核",desc:"抽樣確認有在執行：證據、處理計畫、內部稽核與管理審查",items:s2}];
}

/* ================= 送審確認單：送驗證稽核前列印、簽名留存 =================
   工具判斷得到的項目直接帶入準備度的結果（不讓人另外勾選，避免與系統判斷不一致）；
   工具看不到的事項才留空白方框，由確認人親自勾選。 */
const SIGNOFF_MANUAL=[
  {id:"climate",clause:"4.1、4.2",text:"已判斷氣候變遷是否為相關議題，並留有紀錄（Amd 1:2024）"},
  {id:"mgmt",clause:"5.1、6.1.2",text:"風險準則、ISMS 範圍與資訊安全政策已經管理階層核准"},
  {id:"docs",clause:"7.5",text:"條款 4–10 要求的文件化資訊都已建立，且為最新核准版本"},
  {id:"files",clause:"7.5",text:"已抽查證據位置的檔案，確認可以開啟、內容相符且是最新的"},
  {id:"backup",clause:"—",text:"已匯出最新的專案檔、稽核用 SoA 與工作底稿備份"},
  {id:"people",clause:"—",text:"稽核當天的受訪人員、會議室與證據提供方式已安排"}
];
function signoffSheet(p,now){
  const st=auditReadiness(p,now);
  const rows=st.flatMap(s=>s.items.map(x=>({stage:s.id,stageName:s.name,key:x.key,clause:x.clause,title:x.title,grade:x.grade,detail:x.detail})));
  const count={ok:0,obs:0,nc:0,na:0};rows.forEach(r=>count[r.grade]++);
  const sp=(p.spots||[]).filter(x=>x&&x.items&&x.items.length).slice(-1)[0];
  const spot=sp?{id:sp.id,date:sp.date||"",done:sp.done,...spotStats(sp)}:null;
  return {rows,count,manual:SIGNOFF_MANUAL,spot,ready:!count.nc};
}

/* ================= 追蹤鏈：稽核員從一個點往下追 =================
   控制措施：為什麼要做 → SoA 判定 → 負責人 → 執行 → 證據 → 改善紀錄
   風險：識別 → 評估 → 處理方式 → 控制措施 → 處理計畫 → 殘餘風險與核准 → 改善紀錄
   state：ok 完整、warn 待補強、bad 斷掉（稽核時拿不出來）、idle 前面斷了或還不需要；broken 是第一個斷掉的步驟 */
function traceChain(p,kind,id,now){
  if(!p)return null;
  const ctl=code=>(p.controls||{})[code]||{app:"",status:0,owner:"",reason:"",evidence:""};
  const acts=p.actions||[],risks=p.risks||[];
  const actLinks=codes=>acts.filter(a=>(a.refs||[]).some(c=>codes.includes(c))).map(a=>{
    const late=actionOverdue(a,now),closed=a.status===ACTION_CLOSED;
    return {kind:"act",id:a.id,label:a.id+" "+(a.title||"（未填寫）"),note:late?"逾期":a.status,state:late?"bad":closed?"ok":"warn"}});
  const actNode=codes=>{const l=actLinks(codes);
    return {k:"act",label:"改善紀錄",clause:"10.2",state:!l.length?"idle":l.some(x=>x.state==="bad")?"bad":"ok",
      text:!l.length?"沒有相關的改善事項":l.some(x=>x.state==="bad")?"有改善事項逾期":l.some(x=>x.state==="warn")?`${l.filter(x=>x.state==="warn").length} 項改善事項處理中，尚未逾期`:"相關改善事項都已確認有效",links:l}};
  const ctlState=c=>{const v=ctl(c);return v.app!=="Y"?"bad":v.status===0?"bad":v.status===1?"warn":!String(v.evidence||"").trim()?"warn":"ok"};
  const ctlNote=c=>{const v=ctl(c);return v.app==="N"?"SoA 不適用":v.app===""?"SoA 未判定":v.status<2?STATUS[v.status].label:!String(v.evidence||"").trim()?"沒寫證據位置":STATUS[v.status].label};
  let nodes=[];
  if(kind==="ctl"){
    const c=ANNEX_MAP[id];if(!c)return null;
    const v=ctl(id),rs=(risksByControl(p)[id]||[]),rlinks=rs.map(rid=>{const r=risks.find(x=>x.id===rid);return {kind:"risk",id:rid,label:rid+" "+((r&&r.title)||""),state:"ok"}});
    const reason=String(v.reason||"").trim(),ev=String(v.evidence||"").trim(),owner=String(v.owner||"").trim();
    if(v.app==="N"){
      nodes=[{k:"why",label:"為什麼不做",clause:"6.1.3 d",state:rs.length?"bad":reason?"ok":"bad",
        text:rs.length?`判為不適用，卻有 ${rs.length} 項風險要用它處理`:reason?`排除理由：${reason}`:"判為不適用，但沒有寫排除理由",links:rlinks},
        {k:"soa",label:"SoA 判定",clause:"6.1.3 d",state:rs.length?"bad":"ok",text:"不適用；不需要再往下追實施與證據"}];
    }else{
      const und=v.app==="";
      nodes.push({k:"why",label:"為什麼要做",clause:"6.1.3",state:rs.length||reason?"ok":und?"idle":"warn",
        text:rs.length?`處理 ${rs.length} 項風險`+(reason?`；理由：${reason}`:""):reason?`納入理由：${reason}`:und?"還沒判定適用性":"沒有風險引用，也沒有寫納入理由",links:rlinks});
      nodes.push({k:"soa",label:"SoA 判定",clause:"6.1.3 d",state:und?"bad":"ok",text:und?"尚未判定適用或不適用":"適用"});
      if(und){["負責人","執行","證據"].forEach((l,i)=>nodes.push({k:["owner","impl","ev"][i],label:l,state:"idle",text:"判定適用後再確認"}))}
      else{
        const co=coList(v);
        nodes.push({k:"owner",label:"負責人",clause:"5.3",state:owner?"ok":"warn",text:(owner||"沒有指定負責人")+(co.length?`；協辦：${co.join("、")}`:"")});
        const vr=String(v.verifier||"").trim();
        nodes.push({k:"impl",label:"執行",clause:"8.1",state:v.status===3&&(!vr||selfVerified(v))?"warn":v.status>=2?"ok":v.status===1?"warn":"bad",
          text:STATUS[v.status].label+(v.status===3?(vr?`（確認人：${vr}${v.verifiedAt?"，"+v.verifiedAt:""}${selfVerified(v)?"；與負責人相同，屬自我確認":""}）`:"（沒有記錄確認人）"):"")});
        const age=evidenceAge(v,now);
        nodes.push({k:"ev",label:"證據",clause:"7.5",state:ev?(age!==null&&age>SPOT_STALE_DAYS?"warn":"ok"):v.status===3?"bad":v.status===2?"warn":"idle",
          text:ev?ev+(age===null?"（尚未抽查確認）":age>SPOT_STALE_DAYS?`（${v.checked} 抽查確認，已超過一年）`:`（${v.checked} 抽查確認）`):v.status===3?"標為已驗證，卻沒寫證據在哪裡":v.status===2?"已實施，但沒寫證據位置":"實施後補上證據位置"});
      }
      nodes.push(actNode([id]));
    }
  }else if(kind==="risk"){
    const r=risks.find(x=>x.id===id);if(!r)return null;
    const s=inherentScore(r),lv=riskLevel(s,p),owner=String(r.owner||"").trim();
    nodes.push({k:"ident",label:"識別",clause:"6.1.2 c",state:owner?"ok":"warn",text:owner?`風險擁有者：${owner}`:"沒有指定風險擁有者"});
    const sn=riskSanity(p).filter(x=>x.rid===r.id);
    nodes.push({k:"assess",label:"評估",clause:"6.1.2 d、e",state:!s?"bad":sn.length?"warn":"ok",text:s?`${s} 分・${lv?lv.label:""}`+(sn.length?"；"+sn.map(x=>x.msg).join("；"):""):"尚未評估可能性與衝擊"});
    const T={accept:"接受",mitigate:"降低",transfer:"移轉",avoid:"避免"};
    if(!s){nodes.push({k:"treat",label:"處理方式",state:"idle",text:"評估後再決定"})}
    else if(!r.treat){nodes.push({k:"treat",label:"處理方式",clause:"6.1.3 a",state:"bad",text:"尚未決定處理方式"})}
    else if(r.treat==="accept"){
      const need=policyOf(s,p)!=="accept";
      nodes.push({k:"treat",label:"處理方式",clause:"6.1.3 a",state:policyOf(s,p)==="treat"?"bad":"ok",text:policyOf(s,p)==="treat"?"接受，但這個分數依準則不可接受":"接受"});
      nodes.push({k:"appr",label:"擁有者核准",clause:"6.1.3 f",state:!need||r.accepted?"ok":"warn",text:!need?"在可接受範圍內":r.accepted?"風險擁有者已核准接受":"需要風險擁有者核准接受"});
    }else{
      nodes.push({k:"treat",label:"處理方式",clause:"6.1.3 a",state:"ok",text:T[r.treat]});
      if(r.treat==="mitigate"){
        const cs=r.controls||[],links=cs.map(c=>({kind:"ctl",id:c,label:c+" "+(ANNEX_MAP[c]?ANNEX_MAP[c].name:""),note:ctlNote(c),state:ctlState(c)}));
        const st=!cs.length?"bad":links.some(x=>x.state==="bad")?"bad":links.some(x=>x.state==="warn")?"warn":"ok";
        nodes.push({k:"ctl",label:"控制措施",clause:"6.1.3 b、c",state:st,
          text:!cs.length?"沒有選定控制措施":st==="bad"?"有控制措施在 SoA 不適用、未判定或未開始":st==="warn"?"有控制措施部分實施或沒寫證據位置":`${cs.length} 項都已實施並有證據位置`,links});
      }
      const d=planDue(r,now);
      nodes.push({k:"plan",label:"處理計畫",clause:"8.3",state:r.status==="已完成"?"ok":!String(r.plan||"").trim()?"warn":d&&d.state==="late"?"bad":d&&d.state==="nodue"?"warn":"ok",
        text:r.status==="已完成"?"已完成":[String(r.plan||"").trim()||"沒有寫處理計畫",d&&d.state==="late"?`逾期 ${-d.days} 天`:d&&d.state==="nodue"?"沒有預計完成日":d?`預計 ${r.due} 完成（還有 ${d.days} 天）`:""].filter(Boolean).join("；")});
      if(r.treat!=="avoid"){
        const rs=residualScore(r),need=rs&&policyOf(rs,p)==="approve";
        nodes.push({k:"resid",label:"殘餘風險與核准",clause:"6.1.3 f",state:!rs?"warn":policyOf(rs,p)==="treat"?"bad":need&&!r.accepted?"warn":"ok",
          text:!rs?"尚未評估處理後的殘餘風險":policyOf(rs,p)==="treat"?`殘餘 ${rs} 分仍不可接受`:need?(r.accepted?`殘餘 ${rs} 分，擁有者已核准`:`殘餘 ${rs} 分，需要擁有者核准`):`殘餘 ${rs} 分，在可接受範圍內`});
      }
    }
    nodes.push(actNode(r.controls||[]));
  }else return null;
  const b=nodes.findIndex(n=>n.state==="bad");
  return {kind,id,nodes,broken:b<0?null:nodes[b].label,warn:nodes.filter(n=>n.state==="warn").length};
}

/* ================= 反向查詢：從現場看到的東西往回追 =================
   稽核員常從一個人、一套系統、一份紀錄或一起事件往回查：它對應到哪些要求、風險評鑑有沒有考慮到。
   mode：person 人員、asset 資產或系統、evidence 文件或證據、event 事件或改善事項。
   回傳 {groups:[{title,items:[{kind,id,label,note,state}]}], notes:[發現]}；q 空白時回傳 suggest 供點選。 */
const nz=s=>norm(s||"").replace(/\s/g,"");
function reverseLookup(p,mode,q,now){
  const out={groups:[],notes:[],suggest:[]};if(!p)return out;
  const ctl=code=>(p.controls||{})[code]||{app:"",status:0,owner:"",evidence:"",reason:""};
  const cls=code=>(p.clauses||{})[code]||{status:0,owner:"",evidence:""};
  const risks=p.risks||[],acts=p.actions||[],k=nz(q);
  const has=t=>k&&nz(t).includes(k);
  const ctlItem=(code,extra)=>{const c=ANNEX_MAP[code]||CLAUSE_MAP[code],v=ANNEX_MAP[code]?ctl(code):cls(code),isA=!!ANNEX_MAP[code];
    const st=isA&&v.app==="N"?"不適用":isA&&!v.app?"未判定":STATUS[v.status].label;
    return {kind:"ctl",id:code,label:code+" "+(c?c.name:""),note:st+(extra?"・"+extra:""),state:(isA&&v.app!=="Y")?"":v.status>=2?"ok":v.status===1?"warn":"bad"}};
  const riskItem=r=>{const s=inherentScore(r),d=planDue(r,now);
    return {kind:"risk",id:r.id,label:r.id+" "+(r.title||"（未命名風險）"),note:[s?`${s} 分`:"未評分",r.treat?({accept:"接受",mitigate:"降低",transfer:"移轉",avoid:"避免"})[r.treat]:"未決定處理",d&&d.state==="late"?`計畫逾期 ${-d.days} 天`:""].filter(Boolean).join("・"),
      state:!s||!r.treat?"bad":d&&d.state==="late"?"bad":"ok"}};
  const actItem=a=>{const late=actionOverdue(a,now);return {kind:"act",id:a.id,label:a.id+" "+(a.title||"（未填寫）"),note:(ACTION_TYPE_MAP[a.type]||{}).label+"・"+(late?"逾期":a.status),state:late?"bad":a.status===ACTION_CLOSED?"ok":"warn"}};
  const grp=(title,items)=>{if(items.length)out.groups.push({title,items})};
  const appCodes=ANNEX.map(c=>c.code);
  if(mode==="person"){
    const names={};const add=n=>{n=String(n||"").trim();if(n)names[n]=(names[n]||0)+1};
    appCodes.forEach(c=>{const v=ctl(c);if(v.app==="Y"){add(v.owner);coList(v).forEach(add)}});CLAUSES.forEach(c=>{add(cls(c.code).owner);coList(cls(c.code)).forEach(add)});risks.forEach(r=>add(r.owner));acts.forEach(a=>add(a.owner));
    out.suggest=Object.entries(names).sort((a,b)=>b[1]-a[1]).slice(0,16).map(([n,c])=>({q:n,label:`${n}（${c}）`}));
    if(!k)return out;
    grp("負責的控制措施",appCodes.filter(c=>ctl(c).app==="Y"&&has(ctl(c).owner)).map(c=>ctlItem(c)));
    grp("負責的條款",CLAUSES.filter(c=>has(cls(c.code).owner)).map(c=>ctlItem(c.code)));
    grp("協辦的控制措施與條款",[...appCodes.filter(c=>ctl(c).app==="Y"),...CLAUSES.map(c=>c.code)].filter(c=>{const v=ANNEX_MAP[c]?ctl(c):cls(c);return !has(v.owner)&&coList(v).some(has)}).map(c=>ctlItem(c,"主責："+((ANNEX_MAP[c]?ctl(c):cls(c)).owner||"未指定"))));
    grp("擁有的風險",risks.filter(r=>has(r.owner)).map(riskItem));
    grp("負責的改善事項",acts.filter(a=>has(a.owner)).map(actItem));
    grp("確認過的項目（確認人）",[...appCodes,...CLAUSES.map(c=>c.code)].filter(c=>{const v=ANNEX_MAP[c]?ctl(c):cls(c);return v.status===3&&has(v.verifier)}).map(c=>ctlItem(c,"由此人確認")));
    const g=t=>(out.groups.find(x=>x.title===t)||{items:[]}).items;
    const bad=[...g("負責的控制措施"),...g("擁有的風險"),...g("負責的改善事項")].filter(x=>x.state==="bad").length;
    if(bad)out.notes.push(`有 ${bad} 項未開始、未評分或逾期，訪談時很可能被問到`);
    const self=g("負責的控制措施").filter(x=>{const v=ctl(x.id);return v.status===3&&selfVerified(v)}).length;
    if(self)out.notes.push(`${self} 項由此人負責、也由此人確認（自我確認）`);
  }else if(mode==="asset"){
    const seen={};risks.forEach(r=>String(r.asset||"").split(/[、,，;；\/]/).map(x=>x.trim()).filter(Boolean).forEach(a=>seen[a]=(seen[a]||0)+1));
    out.suggest=Object.entries(seen).sort((a,b)=>b[1]-a[1]).slice(0,16).map(([n,c])=>({q:n,label:`${n}（${c}）`}));
    if(!k)return out;
    const rs=risks.filter(r=>has(r.asset)||has(r.title)||has(r.threat));
    grp("提到它的風險",rs.map(riskItem));
    const cs=[...new Set(rs.flatMap(r=>r.controls||[]))];
    grp("這些風險用來處理的控制措施",cs.map(c=>ctlItem(c)));
    grp("證據或實施方式提到它的控制措施",appCodes.filter(c=>!cs.includes(c)&&(has(ctl(c).evidence)||has(ctl(c).impl))).map(c=>ctlItem(c)));
    if(!rs.length)out.notes.push(`沒有風險提到「${q.trim()}」。如果它在驗證範圍內，風險識別可能有缺口`);
    else if(rs.some(r=>!inherentScore(r)||!r.treat))out.notes.push("有相關風險尚未評分或尚未決定處理方式");
  }else if(mode==="evidence"){
    const ev={};[...appCodes.map(ctl),...CLAUSES.map(c=>cls(c.code))].forEach(v=>{const e=String(v.evidence||"").trim();if(e)ev[e]=(ev[e]||0)+1});
    out.suggest=[...DOCS.filter(d=>d.mandatory).map(d=>({q:d.id,label:`${d.id} ${d.name}`})),...Object.entries(ev).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([n])=>({q:n,label:n}))].slice(0,16);
    if(!k)return out;
    const docs=DOCS.filter(d=>has(d.id)||has(d.name));
    grp("引用它當證據的控制措施",appCodes.filter(c=>has(ctl(c).evidence)||has(ctl(c).impl)).map(c=>ctlItem(c)));
    grp("引用它當證據的條款",CLAUSES.filter(c=>has(cls(c.code).evidence)).map(c=>ctlItem(c.code)));
    docs.forEach(d=>grp(`文件範本 ${d.id} ${d.name} 對應的要求`,[...d.clauses.filter(c=>CLAUSE_MAP[c]),...d.controls].map(c=>ctlItem(c))));
    if(!out.groups.length)out.notes.push(`沒有控制措施或條款引用「${q.trim()}」當證據`);
    else if(docs.length&&!out.groups.some(g=>g.title.startsWith("引用")))out.notes.push("這份文件對應的要求，證據位置都沒有寫到它；確認證據位置是否寫的是其他名稱");
  }else if(mode==="event"){
    out.suggest=acts.filter(a=>["inc","nc"].includes(a.type)||actionOverdue(a,now)).slice(0,16).map(a=>({q:a.id,label:`${a.id} ${a.title||""}`}));
    if(!k)return out;
    const as=acts.filter(a=>has(a.id)||has(a.title)||has(a.source));
    grp("符合的改善事項",as.map(actItem));
    const refs=[...new Set(as.flatMap(a=>a.refs||[]))];
    grp("關聯的控制措施與條款",refs.map(c=>ctlItem(c)));
    const rs=risks.filter(r=>(r.controls||[]).some(c=>refs.includes(c)));
    grp("用到這些控制措施的風險",rs.map(r=>{const it=riskItem(r);if(r.l&&r.l<=2&&as.some(a=>a.type==="inc")){it.state="warn";it.note+=`・可能性 ${r.l}，可能沒反映這次事件`}return it}));
    if(as.length&&refs.length&&!rs.length)out.notes.push("沒有風險用到這些控制措施：這起事件的情境可能還沒登錄成風險");
    if(as.some(a=>!(a.refs||[]).length))out.notes.push("有改善事項沒有關聯控制措施或條款，無法往回追");
    if(!as.length)out.notes.push(`沒有改善事項符合「${q.trim()}」`);
  }
  return out;
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
  const late=ids(r=>(planDue(r,now)||{}).state==="late");
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
