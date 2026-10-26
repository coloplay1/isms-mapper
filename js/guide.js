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
    riskWarn:checks.filter(c=>c.sev==="warn"&&!["needApproval","noScore"].includes(c.kind)).length,
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
    scaleDefs:!!sanitizeScale(p.scale)
  };
}

/* 每一項：{key, sev: err|warn|info, title, desc, tab, filter?, cta} */
function nextSteps(p,now){
  if(!p)return [];
  const f=guideFacts(p,now),out=[];
  const add=(cond,o)=>{if(cond)out.push(o)};
  add(f.actOverdue,{key:"actOverdue",sev:"err",title:`追蹤 ${f.actOverdue} 項逾期的改善事項`,desc:"超過預計完成日仍未完成，稽核時會被追問（10.2）",tab:"improve",cta:"開啟改善追蹤"});
  add(f.conflicts,{key:"conflicts",sev:"err",title:`處理 ${f.conflicts} 項風險與 SoA 的衝突`,desc:"例如被風險引用的控制措施卻判為不適用，或不可接受的風險直接接受",tab:"risks",cta:"前往風險評鑑"});
  add(f.reassess,{key:"reassess",sev:"warn",title:`重新評估 ${f.reassess} 項沿用去年分數的風險`,desc:"建立新年度時保留了去年的可能性與衝擊，請依今年情況確認（6.1.2）",tab:"risks",cta:"前往風險評鑑"});
  add(!f.criteria,{key:"criteria",sev:"warn",title:"確認風險評鑑準則",desc:"新專案先帶入預設的四級準則，請確認符合組織可接受的風險程度（6.1.2 a）",tab:"risks",open:"criteria",cta:"確認準則"});
  add(f.criteria&&!f.scaleDefs,{key:"scaleDefs",sev:"info",title:"寫下可能性與衝擊各級的定義",desc:"例如「每年一次」「中斷 1 天」，不同的人評分才會一致，也會匯出到風險評鑑準則",tab:"risks",open:"criteria",cta:"填寫定義"});
  add(!f.risks,{key:"noRisk",sev:"warn",title:"登錄第一個風險",desc:"適用性要依風險評鑑結果決定（6.1.3）。按「新增風險」可從常見情境挑選",tab:"risks",cta:"前往風險評鑑"});
  add(f.unscored,{key:"unscored",sev:"warn",title:`評估 ${f.unscored} 項風險的可能性與衝擊`,desc:"還沒有分數，就無法判斷要不要處理（6.1.2 d）",tab:"risks",cta:"前往風險評鑑"});
  add(f.undecided,{key:"undecided",sev:"warn",title:`判定 ${f.undecided} 項控制措施的適用性`,desc:"SoA 需要列出每一項適用或不適用，以及理由（6.1.3 d）",tab:"annex",filter:"undec",cta:"前往附錄 A"});
  add(f.noReason,{key:"noReason",sev:"warn",title:`補填 ${f.noReason} 項排除理由`,desc:"標為不適用卻沒有理由，是稽核最常開的缺失之一",tab:"annex",filter:"noreason",cta:"前往補填"});
  add(f.riskWarn,{key:"riskWarn",sev:"warn",title:`確認 ${f.riskWarn} 項風險處理的待辦`,desc:"例如尚未決定處理方式、沒有選定控制措施或殘餘風險未評估",tab:"risks",cta:"前往風險評鑑"});
  add(f.needApproval,{key:"needApproval",sev:"warn",title:`取得 ${f.needApproval} 項殘餘風險的擁有者核准`,desc:"處理後仍需核准的風險，要由風險擁有者核准接受（6.1.3 f）",tab:"risks",cta:"前往風險評鑑"});
  add(f.actVerify,{key:"actVerify",sev:"info",title:`確認 ${f.actVerify} 項已完成改善的有效性`,desc:"措施完成後確認有效才能結案（10.2 d）",tab:"improve",cta:"開啟改善追蹤"});
  add(f.applicable&&f.notStarted,{key:"notStarted",sev:"info",title:`落實 ${f.notStarted} 項尚未實施的控制措施`,desc:`適用的 ${f.applicable} 項中已實施 ${f.implemented} 項${p.baseline?"；去年已驗證的項目重新收集證據後可改回已驗證":"，記得填寫證據位置"}`,tab:"annex",cta:"前往附錄 A"});
  add(f.applicable&&f.noOwner,{key:"noOwner",sev:"info",title:`指定 ${f.noOwner} 項控制措施的負責人`,desc:"每一項都要有人負責（5.3）",tab:"annex",cta:"前往附錄 A"});
  add(f.clausesDone<f.clausesTotal,{key:"clauses",sev:"info",title:`完成 ${f.clausesTotal-f.clausesDone} 項管理系統條款`,desc:"條款 4–10 是驗證稽核第一階段的重點，可搭配文件範本",tab:"clauses",cta:"前往條款 4–10"});
  add(!f.scope,{key:"scope",sev:"info",title:"填寫驗證範圍",desc:"範圍決定哪些系統、地點與人員納入 ISMS（4.3）",tab:"projects",cta:"前往專案管理"});
  add(f.applicable>0&&!f.docApproved&&!f.undecided&&!f.noReason,{key:"approve",sev:"info",title:"核准 SoA 並填寫文件管制資訊",desc:"SoA 與風險處理計畫需經核准（6.1.3 e、f），核准後把狀態改為「已核准」",tab:"projects",cta:"前往專案管理"});
  return out;
}

/* 導入路線圖：done 依資料判斷；第一個未完成的是目前步驟 */
function roadmapSteps(p,now){
  if(!p)return [];
  const f=guideFacts(p,now);
  const steps=[
    {n:1,keys:["scope"],short:"範圍",title:"決定驗證範圍與業務特性",clause:"4.3",tab:"projects",done:f.scope&&f.profile,
      detail:f.scope?(f.profile?"已填寫範圍與產業特性":"已填寫範圍，尚未選擇產業或業務特性"):"尚未填寫驗證範圍"},
    {n:2,keys:["criteria","scaleDefs"],short:"準則",title:"訂定風險評鑑準則",clause:"6.1.2 a",tab:"risks",open:"criteria",done:f.criteria,
      detail:(f.criteria?"":"尚未確認，目前是預設值：")+criteriaText(p)+(f.scaleDefs?"｜已寫可能性與衝擊定義":"｜尚未寫可能性與衝擊定義")},
    {n:3,keys:["noRisk","unscored","reassess"],short:"風險",title:"識別與評估風險",clause:"6.1.2",tab:"risks",done:f.risks>0&&!f.unscored&&!f.reassess,
      detail:!f.risks?"還沒有登錄風險":[f.unscored&&`${f.unscored} 項未評估`,f.reassess&&`${f.reassess} 項沿用去年分數，待重新評估`].filter(Boolean).join("、")||`已評估 ${f.risks} 項風險`},
    {n:4,keys:["undecided","noReason","conflicts","riskWarn"],short:"SoA",title:"決定風險處理與適用性（SoA）",clause:"6.1.3",tab:"annex",done:f.risks>0&&!f.undecided&&!f.noReason&&!f.conflicts&&!f.riskWarn,
      detail:[f.undecided&&`${f.undecided} 項未判定`,f.noReason&&`${f.noReason} 項缺排除理由`,f.conflicts&&`${f.conflicts} 項衝突`,f.riskWarn&&`${f.riskWarn} 項風險處理待確認`].filter(Boolean).join("、")||"適用性與風險處理一致"},
    {n:5,keys:["needApproval","approve"],short:"核准",title:"核准 SoA 與風險處理計畫",clause:"6.1.3 e、f",tab:"projects",done:f.docApproved&&!f.needApproval&&f.applicable>0,
      detail:[!f.docApproved&&"文件狀態尚未改為「已核准」",f.needApproval&&`${f.needApproval} 項殘餘風險待擁有者核准`].filter(Boolean).join("、")||"已核准"},
    {n:6,keys:["notStarted","noOwner"],short:"落實",title:"落實控制措施並收集證據",clause:"8.1、附錄 A",tab:"annex",done:f.applicable>0&&!f.notStarted,
      detail:f.applicable?`已實施 ${f.implemented}／${f.applicable} 項`:"尚無適用的控制措施"},
    {n:7,keys:["clauses"],short:"稽核",title:"完成管理系統條款、內部稽核與管理審查",clause:"4–10、9.2、9.3",tab:"clauses",done:f.clausesDone===f.clausesTotal,
      detail:`條款已完成 ${f.clausesDone}／${f.clausesTotal} 項｜內部稽核${f.auditDone?"已完成":"未完成"}｜管理審查${f.reviewDone?"已完成":"未完成"}`},
    {n:8,keys:["actOverdue","actVerify"],short:"改善",title:"改善事項結案",clause:"10.1、10.2",tab:"improve",done:f.auditDone&&!f.actOpen,
      detail:f.actOpen?`${f.actOpen} 項未結案${f.actOverdue?`、${f.actOverdue} 項逾期`:""}`:(f.auditDone?"所有改善事項已結案":"內部稽核後登錄發現事項")}
  ];
  const cur=steps.find(s=>!s.done);if(cur)cur.current=true;
  return steps;
}
