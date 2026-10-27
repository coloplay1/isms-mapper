/* ISMS 條款對照台：產業、業務特性、法規提示與選項清單
   以一般 <script> 載入（非 ES module），讓使用者直接用瀏覽器開啟本機檔案也能運作。
   各檔頂層宣告共用同一個全域範圍，載入順序見 index.html。 */
/* ================= 產業與業務特性規則 =================
   建議只做標示，不會自動變更適用性。資料整理日期：2026-10 */
const RULES_DATE="2026 年 10 月";
const FEATURES=[
  {id:"pii",label:"儲存會員或客戶個資",why:"大量個資一旦外洩，同時涉及法規通報、罰則與商譽",codes:["A.5.34","A.8.11","A.8.12","A.8.10","A.5.31","A.8.24"]},
  {id:"payment",label:"處理線上付款或信用卡資料",why:"持卡人資料是攻擊者首要目標，收單銀行通常要求符合 PCI DSS",codes:["A.8.24","A.8.22","A.8.8","A.8.15","A.5.20"]},
  {id:"dev",label:"自行開發系統、網站或 App",why:"自行開發的程式碼與上線流程都在驗證範圍內，安全開發相關控制幾乎都會被檢視",codes:["A.8.25","A.8.28","A.8.29","A.8.31","A.8.32","A.8.33"]},
  {id:"cloud",label:"主要使用雲端服務",why:"雲端的共同責任分界、帳號安全與退出機制是常見缺口",codes:["A.5.23","A.5.19","A.8.5","A.8.9","A.8.13"]},
  {id:"remote",label:"有遠距工作或外勤人員",why:"端點與連線離開公司網路後，防護要靠設備與帳號本身",codes:["A.6.7","A.8.1","A.7.9","A.8.5"]},
  {id:"vendor",label:"系統由外部廠商維運或開發",why:"廠商的權限與交付品質會直接影響組織的資安",codes:["A.5.19","A.5.20","A.5.22","A.8.30","A.8.2"]},
  {id:"ci",label:"資安法適用對象或其委外廠商",why:"需配合主管機關的通報時限、應辦事項與委外契約要求",codes:["A.5.24","A.5.26","A.5.5","A.5.20","A.5.21","A.8.8","A.6.1"]},
  {id:"health",label:"處理病歷或健康資料",why:"病歷屬特種個資，系統中斷也會影響醫療作業",codes:["A.5.34","A.8.13","A.5.30","A.8.15","A.5.18","A.5.20"]},
  {id:"finance",label:"受金管會監理的金融業務",why:"主管機關對事故通報、營運持續與存取控制有額外要求",codes:["A.5.24","A.5.29","A.5.30","A.8.14","A.8.16","A.8.2"]},
  {id:"ot",label:"有生產線或工控（OT）設備",why:"OT 設備難以修補，一旦中毒常造成停產",codes:["A.8.22","A.8.8","A.8.19","A.7.10","A.5.30"]},
  {id:"listed",label:"上市、上櫃或準備掛牌",why:"證交所與櫃買中心要求依資通安全管控指引設置資安人力，重大資安事件須發布重大訊息，年報也要揭露資安管理",codes:["A.5.2","A.5.4","A.5.24","A.5.26","A.6.3","A.5.20","A.5.35"]},
  {id:"onprem",label:"自建機房或伺服器室",why:"實體環境與支援設施由組織自行負責",codes:["A.7.1","A.7.2","A.7.5","A.7.11","A.8.14"]}
];
const FEATURE_MAP=Object.assign(Object.create(null),Object.fromEntries(FEATURES.map(x=>[x.id,x])));   // 無原型：「__proto__」「toString」等鍵查不到
FEATURE_MAP.manual={id:"manual",label:"自行標示",why:"由專案成員手動加入的重點"};
const INDUSTRIES=[
  {id:"",label:"未選擇",features:[]},
  {id:"ecom",label:"電商／線上零售",features:["pii","payment","cloud","dev"]},
  {id:"saas",label:"軟體與雲端服務",features:["dev","cloud","pii","remote"]},
  {id:"finance",label:"金融／保險",features:["pii","finance","payment","onprem","vendor","remote"]},
  {id:"health",label:"醫療院所",features:["pii","health","vendor","onprem"]},
  {id:"mfg",label:"製造業",features:["ot","onprem","vendor","remote"]},
  {id:"gov",label:"政府委外／資訊服務廠商",features:["ci","dev","vendor","remote"]},
  {id:"edu",label:"教育／補教",features:["pii","cloud"]},
  {id:"general",label:"一般企業",features:["cloud","remote"]}
];
const INDUSTRY_MAP=Object.assign(Object.create(null),Object.fromEntries(INDUSTRIES.map(x=>[x.id,x])));   // 無原型：「__proto__」「toString」等鍵查不到
const mojq=kw=>"https://law.moj.gov.tw/Law/LawSearchResult.aspx?ty=ONEBAR&kw="+encodeURIComponent(kw);
const LAWS=[
  {when:{f:"pii"},name:"個人資料保護法",kind:"法律",
   note:"2025 年 11 月修正公布，將設立個人資料保護委員會，並強化外洩通報與安全維護義務；修正條文的施行日期由行政院另定。",
   todo:["網站與 App 公告隱私權政策，蒐集時完成告知","建立個資盤點清冊與外洩通報流程","確認所屬產業的個資檔案安全維護辦法"],
   codes:["A.5.34","A.5.31","A.5.26"],link:mojq("個人資料保護法")},
  {when:{i:["ecom","saas"]},name:"數位經濟相關產業個人資料檔案安全維護管理辦法",kind:"法規命令",
   note:"數位發展部主管，適用無店面零售、軟體出版、電腦系統設計、資料處理等業別。要求訂定個資安全維護計畫，事故知悉後 72 小時內通報。",
   todo:["訂定個資保護管理政策與安全維護計畫","準備 72 小時內通報的流程與聯絡窗口","每年執行個資盤點、教育訓練與稽核"],
   codes:["A.5.34","A.5.24","A.6.3","A.5.35"],link:mojq("數位經濟相關產業個人資料檔案安全維護管理辦法")},
  {when:{f:"ci"},name:"資通安全管理法",kind:"法律",
   note:"2025 年 9 月修正公布，主管機關改為數位發展部；提高未通報資安事件的罰鍰上限，並規定委外須以書面契約約定資安責任。修正條文的施行日期由行政院另定。",
   todo:["確認組織或客戶的資通安全責任等級與應辦事項","依時限通報資安事件","委外契約載明資安要求，避免使用危害國家資安產品"],
   codes:["A.5.24","A.5.26","A.5.20","A.5.21"],link:mojq("資通安全管理法")},
  {when:{f:"listed"},name:"上市上櫃公司資通安全管控指引",kind:"交易所規範",
   note:"臺灣證券交易所與證券櫃檯買賣中心訂定，2021 年 12 月發布、2024 年 9 月修正。上市櫃公司分三級配置資安人力：第一級（例如實收資本額 100 億元以上或台灣 50 成分股）須設資安長、資安專責主管及至少 2 名專責人員；第二級須設資安專責主管及至少 1 名專責人員。重大資安事件須於次一營業日上午 7 時前發布重大訊息。分級條件與最新要求請以交易所公告為準。",
   todo:["確認公司所屬級別，配置資安長、專責主管與專責人員","訂定重大資安事件的判斷標準與重大訊息發布流程","每年辦理電子郵件社交工程演練並保存紀錄","資安推動組織定期向董事會或管理階層報告，年報揭露資安風險管理架構與投入資源"],
   codes:["A.5.2","A.5.4","A.5.24","A.5.26","A.6.3","A.5.35"],link:"https://dsp.tpex.org.tw/web/listing/security.php"},
  {when:{f:"health"},name:"醫療機構電子病歷製作及管理辦法",kind:"法規命令",
   note:"衛生福利部主管，2022 年修正。允許使用雲端與委外，但須簽訂書面契約、採取風險管控與避免中斷措施，並具備資料移轉機制。",
   todo:["委外與雲端契約載明資安保障機制","規劃雲端終止時的資料移轉","病歷系統納入營運持續演練"],
   codes:["A.5.20","A.5.23","A.5.30"],link:mojq("醫療機構電子病歷製作及管理辦法")},
  {when:{f:"finance"},name:"金融監督管理委員會資安相關規範",kind:"主管機關規範",
   note:"金管會透過金融資安行動方案與各業別的內控、資安規範提出要求，例如設置資安長與專責單位。實際要求依業別不同，請以主管機關與公會的最新公告為準。",
   todo:["對照所屬業別的資安自律規範","確認重大事件的通報時限與管道"],
   codes:["A.5.31","A.5.24","A.5.2"],link:"https://www.fsc.gov.tw/"},
  {when:{f:"payment"},name:"PCI DSS",kind:"產業標準",
   note:"支付卡產業資料安全標準，目前版本為 v4.0.1。只要儲存、處理或傳輸持卡人資料就適用，通常由收單銀行要求。改用金流業者代收可大幅縮小適用範圍。",
   todo:["確認系統是否接觸完整卡號","評估改由金流服務商代收以縮小範圍"],
   codes:["A.8.24","A.8.22","A.5.20"],link:"https://www.pcisecuritystandards.org/"},
  {when:{f:"ot"},name:"IEC 62443",kind:"參考標準",
   note:"工業自動化與控制系統的資安標準系列，適合作為 OT 網路分區與設備防護的參考。半導體業另可參考 SEMI E187。",
   todo:["盤點 OT 設備並劃分網路區域","規劃無法修補設備的補償措施"],
   codes:["A.8.22","A.8.8"],link:"https://www.isa.org/standards-and-publications/isa-standards/isa-iec-62443-series-of-standards"}
];
// 未勾選「自行開發」時，可能不適用的候選（僅供參考）
// SoA 常見的納入與排除理由（ISO 27001 6.1.3 要求說明納入與排除的理由）
const REASONS_IN=["依風險評鑑結果，需處理已識別的風險","法律或法規要求","契約或客戶要求","主管機關或稽核要求","營運需求與業界最佳實務","集團或母公司政策要求"];
const REASONS_OUT=["範圍內沒有此業務或活動","範圍內沒有相關的資產或系統","風險評鑑結果低於可接受水準，經管理階層核准","已由其他控制措施涵蓋（請註明編號）"];
const DEV_ONLY=["A.8.25","A.8.26","A.8.27","A.8.28","A.8.29","A.8.31","A.8.33","A.8.4"];

const STATUS = [
  {v:0,label:"未開始"},{v:1,label:"部分實施"},{v:2,label:"已實施"},{v:3,label:"已驗證"}
];
const APP = [{v:"",label:"未決定"},{v:"Y",label:"適用"},{v:"N",label:"不適用"}];
const FIELD_LABEL={app:"適用性",status:"執行狀態",reason:"理由",impl:"實施方式",owner:"負責人",evidence:"證據位置",focus:"重點標示"};
/* 匯入其他格式時可辨識的狀態說法（例如「規劃中」「待驗證」） */
const STATUS_ALIAS={"未開始":0,"規劃中":0,"未實施":0,"建置中":1,"部分實施":1,"實施中":1,"已實施":2,"待驗證":2,"已驗證":3,"已有證據":3};
/* 納入理由代碼：RA 風險評鑑、LR 法規、CO 契約、BP 最佳實務 */
const REASON_CODES={RA:REASONS_IN[0],LR:REASONS_IN[1],CO:REASONS_IN[2],BP:REASONS_IN[4]};

/* 產品／服務生命週期（Product/Service Life Cycle Pipeline）：階段依 ISO/IEC 24748 的生命週期概念整理，
   與控制措施的對應為本工具歸納，非標準規定（最直接相關的是 A.8.25 安全開發生命週期）
   每個階段列出最相關的附錄 A 控制措施；同一項可出現在多個階段。只是檢視方式，不影響適用性判定。 */
const LIFECYCLE=[
  {id:"req",name:"需求",en:"Requirement",desc:"蒐集利害關係者（4.2）與 ICT 需求，把資安、法規、隱私與供應商要求寫進需求",
   codes:["A.5.8","A.8.26","A.5.31","A.5.34","A.5.12","A.5.19","A.5.20","A.5.23"]},
  {id:"dev",name:"設計開發",en:"Design / Development",desc:"安全的架構設計、開發流程與程式碼，委外開發也要管理",
   codes:["A.8.25","A.8.27","A.8.28","A.8.30","A.8.4","A.8.31","A.5.21"]},
  {id:"ver",name:"查證確證",en:"Verification / Validation",desc:"在測試環境驗證是否符合規格與需求，未通過就回到設計開發",
   codes:["A.8.29","A.8.33","A.8.31"]},
  {id:"trans",name:"轉移上線",en:"Transition",desc:"經變更管理部署到正式環境，登錄資產、建立組態與作業程序",
   codes:["A.8.32","A.8.9","A.8.19","A.5.37","A.5.9","A.6.3"]},
  {id:"op",name:"監控營運",en:"Monitor / Operation",desc:"日常運作的存取、日誌、監控、備份、弱點與事件處理",
   codes:["A.5.15","A.5.18","A.8.2","A.8.6","A.8.7","A.8.8","A.8.13","A.8.14","A.8.15","A.8.16","A.5.24","A.5.25","A.5.26","A.5.29","A.5.30"]},
  {id:"reeval",name:"重新評估",en:"Re-evaluation",desc:"定期檢討是否仍符合需求與要求：遵循性審查、供應商監督、事件學習",
   codes:["A.5.35","A.5.36","A.5.22","A.5.27","A.5.7"]},
  {id:"disp",name:"處置退休",en:"Disposal / Retirement",desc:"報廢、汰換或歸檔：資料刪除、設備汰除、資產歸還與紀錄保存",
   codes:["A.7.14","A.8.10","A.7.10","A.5.11","A.5.33"]}
];
const LIFECYCLE_MAP=Object.assign(Object.create(null),Object.fromEntries(LIFECYCLE.map(x=>[x.id,x])));
