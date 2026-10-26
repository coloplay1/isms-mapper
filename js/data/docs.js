/* ISMS 條款對照台：ISMS 文件範本清單（五層架構）
   以一般 <script> 載入，頂層宣告與其他檔共用全域範圍。
   file 為 templates/ 下的檔案；如有 status "planned" 表示規劃中、尚未提供範本。
   範本內容為通用寫法，以【】標示需依組織調整的地方，不含任何真實公司資料。 */
const DOC_LAYERS=[
  {id:"01",name:"手冊與索引",desc:"說明整個 ISMS 如何運作，以及有哪些文件"},
  {id:"02",name:"政策",desc:"管理階層的方向與原則：範圍、政策、適用性聲明"},
  {id:"03",name:"程序辦法",desc:"誰、在什麼時候、用什麼方法做"},
  {id:"04",name:"表單範本",desc:"執行程序時填寫的空白表單"},
  {id:"05",name:"執行紀錄",desc:"持續維護的清冊與紀錄，稽核時的主要證據"}
];
const DOCS=[
  // 01 手冊與索引
  {id:"M-01",layer:"01",name:"資訊安全管理手冊",fmt:"docx",file:"docs/M-01.docx",mandatory:true,
   clauses:["4.4","5.1","5.3","7.1","7.4","7.5","8.1"],controls:["A.5.2","A.5.4"],desc:"ISMS 的整體架構、組織與權責、各條款由哪份文件落實"},
  {id:"M-02",layer:"01",name:"文件總清單",fmt:"xlsx",file:"docs/M-02.xlsx",mandatory:true,
   clauses:["7.5"],controls:["A.5.37"],desc:"所有 ISMS 文件的編號、版次、負責單位與存放位置"},
  // 02 政策
  {id:"POL-01",layer:"02",name:"資訊安全政策",fmt:"docx",file:"docs/POL-01.docx",mandatory:true,
   clauses:["5.1","5.2"],controls:["A.5.1"],desc:"管理階層核准的資安方向、目標框架與承諾"},
  {id:"POL-02",layer:"02",name:"ISMS 適用範圍書",fmt:"docx",file:"docs/POL-02.docx",mandatory:true,
   clauses:["4.3"],controls:[],desc:"驗證範圍涵蓋的組織、地點、系統、介面與排除事項"},
  {id:"POL-03",layer:"02",name:"組織全景與利害關係者分析",fmt:"docx",file:"docs/POL-03.docx",mandatory:false,
   clauses:["4.1","4.2","6.1.1"],controls:["A.5.31"],desc:"內外部議題、利害關係者及其要求，作為範圍與風險評鑑的輸入"},
  {id:"POL-04",layer:"02",name:"存取控制政策",fmt:"docx",file:"docs/POL-04.docx",mandatory:false,
   clauses:[],controls:["A.5.15","A.5.16","A.5.17","A.5.18","A.8.2","A.8.3","A.8.5"],desc:"帳號生命週期、最小權限、特權帳號、鑑別與定期複審"},
  {id:"POL-05",layer:"02",name:"資訊資產可接受使用政策",fmt:"docx",file:"docs/POL-05.docx",mandatory:false,
   clauses:["7.3"],controls:["A.5.10","A.5.11","A.6.7","A.7.7","A.8.1"],desc:"員工使用電腦、網路、郵件、行動裝置與遠距工作的規則"},
  {id:"SOA",layer:"02",name:"適用性聲明（SoA）",fmt:"xlsx",file:"isms-soa-risk-template.xlsx",mandatory:true,
   clauses:["6.1.3"],controls:[],desc:"93 項控制措施的適用性、理由與實施狀態；與風險評鑑表在同一個活頁簿，可匯入本工具檢查",tool:true,example:"isms-soa-risk-example.xlsx"},
  // 03 程序辦法
  {id:"PRO-01",layer:"03",name:"文件化資訊管制程序",fmt:"docx",file:"docs/PRO-01.docx",mandatory:true,
   clauses:["7.5"],controls:["A.5.33","A.5.37"],desc:"文件的編號、審查核准、發行、變更、保存與銷毀"},
  {id:"PRO-02",layer:"03",name:"風險評鑑與風險處理程序",fmt:"docx",file:"docs/PRO-02.docx",mandatory:true,
   clauses:["6.1.2","6.1.3","8.2","8.3"],controls:[],desc:"風險準則、識別與評估方法、處理方式選擇、SoA 與處理計畫"},
  {id:"PRO-03",layer:"03",name:"內部稽核程序",fmt:"docx",file:"docs/PRO-03.docx",mandatory:true,
   clauses:["9.2"],controls:["A.5.35"],desc:"稽核方案、稽核員資格與獨立性、稽核執行與報告"},
  {id:"PRO-04",layer:"03",name:"管理審查程序",fmt:"docx",file:"docs/PRO-04.docx",mandatory:true,
   clauses:["9.3"],controls:[],desc:"管理審查的頻率、輸入事項、決議與追蹤"},
  {id:"PRO-05",layer:"03",name:"不符合事項與矯正措施程序",fmt:"docx",file:"docs/PRO-05.docx",mandatory:true,
   clauses:["10.1","10.2"],controls:[],desc:"不符合的處理、原因分析、矯正措施與有效性確認"},
  {id:"PRO-06",layer:"03",name:"資訊安全事件管理程序",fmt:"docx",file:"docs/PRO-06.docx",mandatory:false,
   clauses:[],controls:["A.5.24","A.5.25","A.5.26","A.5.27","A.5.28","A.6.8"],desc:"事件通報、分級、應變、證據保全、通報主管機關與檢討"},
  {id:"PRO-07",layer:"03",name:"營運持續與 ICT 備援程序",fmt:"docx",file:"docs/PRO-07.docx",mandatory:false,
   clauses:[],controls:["A.5.29","A.5.30","A.8.13","A.8.14"],desc:"營運衝擊分析、復原目標、備份與還原測試、演練"},
  {id:"PRO-08",layer:"03",name:"供應商資訊安全管理程序",fmt:"docx",file:"docs/PRO-08.docx",mandatory:false,
   clauses:[],controls:["A.5.19","A.5.20","A.5.21","A.5.22","A.5.23"],desc:"供應商評估、契約資安條款、監督與雲端服務"},
  {id:"PRO-09",layer:"03",name:"變更與組態管理程序",fmt:"docx",file:"docs/PRO-09.docx",mandatory:false,
   clauses:["6.3"],controls:["A.8.9","A.8.32"],desc:"系統變更申請、測試、核准與組態基準"},
  {id:"PRO-10",layer:"03",name:"實體與環境安全管理辦法",fmt:"docx",file:"docs/PRO-10.docx",mandatory:false,
   clauses:[],controls:["A.7.1","A.7.2","A.7.4","A.7.11"],desc:"門禁、機房、設備與環境監控"},
  {id:"WI-01",layer:"03",name:"帳號與權限清冊維護作業指引",fmt:"docx",file:"docs/WI-01.docx",mandatory:false,
   clauses:[],controls:["A.5.16","A.5.18","A.5.37"],desc:"從 AD、NAS 匯出帳號與權限，更新清冊並核對"},
  // 04 表單範本
  {id:"FRM-01",layer:"04",name:"文件異動申請單",fmt:"xlsx",file:"docs/FRM-01.xlsx",mandatory:false,
   clauses:["7.5"],controls:[],desc:"文件新增、修訂、廢止的申請與核准"},
  {id:"FRM-02",layer:"04",name:"權限申請異動單／權限定期複審表",fmt:"xlsx",file:"access-forms-template.xlsx",mandatory:false,
   clauses:[],controls:["A.5.3","A.5.18","A.6.5","A.8.2"],desc:"到職、調職、離職的權限異動，以及定期複審"},
  {id:"FRM-03",layer:"04",name:"內部稽核計畫與檢核表",fmt:"xlsx",file:"docs/FRM-03.xlsx",mandatory:true,
   clauses:["9.2"],controls:[],desc:"年度稽核方案、稽核日程與逐條檢核"},
  {id:"FRM-04",layer:"04",name:"不符合事項與矯正措施報告",fmt:"xlsx",file:"docs/FRM-04.xlsx",mandatory:true,
   clauses:["10.2"],controls:[],desc:"不符合描述、原因分析、矯正措施與有效性確認"},
  {id:"FRM-05",layer:"04",name:"管理審查會議紀錄",fmt:"xlsx",file:"docs/FRM-05.xlsx",mandatory:true,
   clauses:["9.3"],controls:[],desc:"9.3 要求的輸入事項逐項報告、決議與追蹤"},
  {id:"FRM-06",layer:"04",name:"資安事件通報與處理紀錄",fmt:"xlsx",file:"docs/FRM-06.xlsx",mandatory:false,
   clauses:[],controls:["A.5.24","A.5.25","A.5.26","A.6.8"],desc:"事件通報、分級、處理過程與結案檢討"},
  {id:"FRM-07",layer:"04",name:"變更申請單",fmt:"xlsx",file:"docs/FRM-07.xlsx",mandatory:false,
   clauses:["6.3"],controls:["A.8.32"],desc:"系統變更的影響評估、測試與核准"},
  // 05 執行紀錄
  {id:"REC-01",layer:"05",name:"資訊資產清冊",fmt:"xlsx",file:"docs/REC-01.xlsx",mandatory:false,
   clauses:[],controls:["A.5.9","A.5.12"],desc:"資產、擁有者、分級與存放位置，作為風險評鑑的基礎"},
  {id:"REC-02",layer:"05",name:"風險評鑑表暨風險處理計畫",fmt:"xlsx",file:"isms-soa-risk-template.xlsx",mandatory:true,
   clauses:["6.1.2","6.1.3","8.2","8.3"],controls:[],desc:"風險登錄、評估結果與處理計畫；與 SoA 在同一個活頁簿，可匯入本工具檢查",tool:true,example:"isms-soa-risk-example.xlsx"},
  {id:"REC-03",layer:"05",name:"資安目標與量測計畫",fmt:"xlsx",file:"docs/REC-03.xlsx",mandatory:true,
   clauses:["6.2","9.1"],controls:[],desc:"可量測的目標、負責人、期限與每期量測結果"},
  {id:"REC-04",layer:"05",name:"教育訓練與能力紀錄",fmt:"xlsx",file:"docs/REC-04.xlsx",mandatory:true,
   clauses:["7.2","7.3"],controls:["A.6.3"],desc:"各職務的能力要求、訓練與成效評估"},
  {id:"REC-05",layer:"05",name:"法令法規與契約要求清冊",fmt:"xlsx",file:"docs/REC-05.xlsx",mandatory:false,
   clauses:["4.2"],controls:["A.5.31","A.5.32","A.5.34"],desc:"適用的法規、契約要求、主管機關與遵循方式"},
  {id:"REC-06",layer:"05",name:"營運衝擊分析（BIA）",fmt:"xlsx",file:"docs/REC-06.xlsx",mandatory:false,
   clauses:[],controls:["A.5.30"],desc:"關鍵業務、可容忍中斷時間與復原優先順序"}
];
/* 條款 4–10 明確要求保存的文件化資訊（用自己的話整理，非標準原文） */
const DOC_REQUIREMENTS=[
  {code:"4.3",req:"ISMS 範圍",docs:["POL-02"]},
  {code:"5.2",req:"資訊安全政策",docs:["POL-01"]},
  {code:"6.1.2",req:"風險評鑑的過程（準則與方法）",docs:["PRO-02"]},
  {code:"6.1.3",req:"風險處理的過程、適用性聲明、風險處理計畫",docs:["PRO-02","SOA","REC-02"]},
  {code:"6.2",req:"資訊安全目標",docs:["REC-03"]},
  {code:"7.2",req:"人員適任性的證據",docs:["REC-04"]},
  {code:"7.5",req:"組織判定 ISMS 有效運作所需的文件化資訊",docs:["M-01","M-02","PRO-01"]},
  {code:"8.1",req:"足以確信流程依計畫執行的資訊",docs:["M-01"]},
  {code:"8.2",req:"風險評鑑的結果",docs:["REC-02"]},
  {code:"8.3",req:"風險處理的結果",docs:["REC-02"]},
  {code:"9.1",req:"監督與量測的結果",docs:["REC-03"]},
  {code:"9.2",req:"稽核方案的實施與稽核結果",docs:["PRO-03","FRM-03","FRM-04"]},
  {code:"9.3",req:"管理審查的結果",docs:["PRO-04","FRM-05"]},
  {code:"10.2",req:"不符合事項的性質、採取的措施與矯正措施的結果",docs:["PRO-05","FRM-04"]}
];
const DOC_MAP=Object.assign(Object.create(null),Object.fromEntries(DOCS.map(d=>[d.id,d])));   // 無原型：「__proto__」「toString」等鍵查不到
