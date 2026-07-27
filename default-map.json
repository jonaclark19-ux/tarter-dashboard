/* ============================================================
   TARTER YARD — free-placement product locator
   ============================================================ */
const COLORS = {
  A:"#C0473B", B:"#4F7CC7", C:"#3E9E6E", D:"#B5793C", E:"#7E6CC4", F:"#C75B93",
  G:"#4FA3B5", H:"#A9973C", I:"#5B8DEF", J:"#7A8794", K:"#6B7DB3", L:"#C25A4B",
  M:"#3D9BB0", N:"#9C6BB0", O:"#6B8E4E", P:"#B08A3C", T:"#C98A2E", X:"#5b6673"
};
const GROUP_NAMES = {
  A:"General stock (Door 5/6/7)", B:"Water troughs — main row", C:"Troughs & round bale",
  D:"Gates & panels", E:"Gates & bow gates", F:"Round bale feeders", G:"Bow gates & sheeted",
  H:"Economy gates — long row", I:"Feeders / MTO", J:"Gate MTO (feeders)", K:"Gate MTO (KP / dividers)",
  L:"Bumpers, racks & ATV", M:"Water wagons", N:"Rodeo MTO", O:"Open field", P:"Smoker shed",
  T:"Tank plant — new revision (Doors 8–10)", X:"Added products"
};

function DEFAULT_GROUPS(){
  return Object.keys(GROUP_NAMES).map(id=>({id, name:GROUP_NAMES[id], color:COLORS[id]||COLORS.X}));
}
const PALETTE=["#C0473B","#4F7CC7","#3E9E6E","#B5793C","#7E6CC4","#C75B93","#4FA3B5","#A9973C",
  "#5B8DEF","#7A8794","#6B7DB3","#C25A4B","#3D9BB0","#9C6BB0","#6B8E4E","#B08A3C","#C98A2E","#57A79B"];
function groupById(id){ return (data.groups||[]).find(g=>g.id===id); }
function groupName(id){ const g=groupById(id); return g? g.name : ""; }

function ensureGroups(d){
  if(!Array.isArray(d.groups)||!d.groups.length) d.groups=DEFAULT_GROUPS();
  const have=new Set(d.groups.map(g=>g.id));
  (d.tiles||[]).forEach(t=>{ const id=t.g||"X";
    t.g=id;
    if(!have.has(id)){ have.add(id);
      d.groups.push({id, name:GROUP_NAMES[id]||("Group "+id), color:COLORS[id]||PALETTE[d.groups.length%PALETTE.length]}); }
  });
  if(!have.has("X")) d.groups.push({id:"X", name:"Unassigned", color:COLORS.X});
  return d;
}

function newGroupId(){
  const used=new Set((data.groups||[]).map(g=>g.id));
  for(let c=65;c<=90;c++){ const ch=String.fromCharCode(c); if(!used.has(ch)) return ch; }
  let n=1; while(used.has("G"+n)) n++; return "G"+n;
}

// This integrates the full background layout logic
const STRUCT = {
  outline:[[120,60],[2900,60],[2900,520],[2720,720],[2900,900],[2820,1500],[2500,2000],[2400,2280],[200,2280],[60,1600],[60,640]],
  creek:[[46,120],[70,260],[40,400],[66,560],[42,720],[64,900],[44,1080],[62,1260],[46,1440],[60,1600]],
  buildings:[
    {x:500,y:60,w:1200,h:660,label:"TARTER — MAIN BUILDING",big:true},
    {x:340,y:1030,w:250,h:300,label:"LOADING"}
  ],
  pits:[
    {x:1740,y:120,w:210,h:340,label:"UNLOADING PIT"},
    {x:360,y:1060,w:210,h:95,label:"PIT #1"},
    {x:360,y:1180,w:210,h:95,label:"PIT #2"}
  ],
  zones:[
    {x:2170,y:70,w:700,h:360,label:"SECONDS"},
    {x:2150,y:470,w:740,h:400,label:"CUSTOMER PICKUP"},
    {x:1330,y:1855,w:1520,h:410,label:"TANK PLANT · DOORS 8 · 9 · 10"},
    {x:150,y:1520,w:520,h:110,label:"FEEDERS / MTO"},
    {x:150,y:1610,w:960,h:300,label:"GATE MTO"},
    {x:90,y:1930,w:640,h:130,label:"RODEO MTO"},
    {x:740,y:1935,w:260,h:95,label:"WATER WAGONS"},
    {x:1120,y:1600,w:560,h:240,label:"TRAILER PARKING"}
  ],
  boxes:[
    {x:400,y:70,w:96,h:66,label:"Dust coll."},
    {x:395,y:558,w:120,h:86,label:"Smoker shed"},
    {x:300,y:690,w:96,h:60,label:"Diesel"},
    {x:300,y:756,w:130,h:52,label:"Break room"},
    {x:700,y:726,w:110,h:44,label:"AIR LIQUIDE"},
    {x:830,y:726,w:80,h:44,label:"CO2"},
    {x:1740,y:520,w:120,h:44,label:"Propane"},
    {x:1740,y:596,w:120,h:60,label:"Burner-Off"},
    {x:2540,y:326,w:150,h:110,label:"", grid:true}
  ],
  doors:[
    {x:1600,y:60,label:"#1",vert:false},
    {x:1700,y:150,label:"#2",vert:true},{x:1700,y:330,label:"#3",vert:true},{x:1700,y:510,label:"#4",vert:true},
    {x:700,y:718,label:"#5",vert:false},{x:500,y:300,label:"#6",vert:true},{x:500,y:120,label:"#7",vert:true},
    {x:1600,y:1853,label:"#8",vert:false},{x:1930,y:1853,label:"#9",vert:false},{x:2260,y:1853,label:"#10",vert:false}
  ],
  cans:[[2210,110],[2210,178],[2210,246]],
  tanks:{cx:2340,cy:640,r:36,n:7},
  labels:[]
};

// V3 Complete database mapped directly as the default layout.
const V3_DATA_TILES = [
  {"sku":"1001361","x":120,"y":780,"g":"A"},{"sku":"1002682","x":192,"y":780,"g":"A"},{"sku":"1001357","x":264,"y":780,"g":"A"},{"sku":"1002625","x":120,"y":820,"g":"A"},{"sku":"1001356","x":192,"y":820,"g":"A"},{"sku":"1001359","x":264,"y":820,"g":"A"},{"sku":"1001353","x":120,"y":860,"g":"A"},{"sku":"1001358","x":192,"y":860,"g":"A"},{"sku":"1002627","x":264,"y":860,"g":"A"},{"sku":"1002623","x":120,"y":900,"g":"A"},{"sku":"1001355","x":192,"y":900,"g":"A"},{"sku":"1002621","x":264,"y":900,"g":"A"},{"sku":"1002626","x":120,"y":940,"g":"A"},{"sku":"ECR12","x":192,"y":940,"g":"A"},{"sku":"ECGR12","x":264,"y":940,"g":"A"},{"sku":"ECG12T","x":120,"y":980,"g":"A"},{"sku":"1002622","x":430,"y":600,"g":"P"},{"sku":"FEEDER MTO","x":-543,"y":1239,"g":"I"},{"sku":"BBTHF","x":-471,"y":1239,"g":"I"},{"sku":"FFCT","x":-399,"y":1239,"g":"I"},{"sku":"RFM","x":-327,"y":1239,"g":"I"},{"sku":"RHF","x":-255,"y":1239,"g":"I"},{"sku":"RHFG","x":-183,"y":1239,"g":"I"},{"sku":"MGF","x":-111,"y":1239,"g":"I"},{"sku":"CHAS","x":-414,"y":2381,"g":"N"},{"sku":"CH9","x":-342,"y":2381,"g":"N"},{"sku":"CHDE-3","x":-270,"y":2381,"g":"N"},{"sku":"CHDE-2","x":-198,"y":2381,"g":"N"},{"sku":"CHDE-1","x":-126,"y":2381,"g":"N"},{"sku":"CHOS-1","x":-54,"y":2381,"g":"N"},{"sku":"CHBX1","x":18,"y":2381,"g":"N"},{"sku":"CH8","x":90,"y":2381,"g":"N"},{"sku":"CH7-12","x":-414,"y":2421,"g":"N"},{"sku":"CH7-10","x":-342,"y":2421,"g":"N"},{"sku":"CH7-8","x":-270,"y":2421,"g":"N"},{"sku":"CH5","x":-198,"y":2421,"g":"N"},{"sku":"CH3","x":-126,"y":2421,"g":"N"},{"sku":"CH2A","x":-54,"y":2421,"g":"N"},{"sku":"CH1","x":18,"y":2421,"g":"N"},{"sku":"WT214","x":922,"y":727,"g":"B","w":55,"h":67,"c":"#858e89"},{"sku":"WT214CL","x":983,"y":727,"g":"B","w":55,"h":67,"c":"#858e89"},{"sku":"WT226","x":1044,"y":727,"g":"B","w":55,"h":67,"c":"#858e89"},{"sku":"WT226CL","x":1105,"y":727,"g":"B","w":55,"h":67,"c":"#858e89"},{"sku":"WT328","x":1166,"y":727,"g":"B","w":55,"h":67,"c":"#858e89"},{"sku":"WTR82","x":1227,"y":727,"g":"B","w":55,"h":67,"c":"#858e89"},{"sku":"WTR82CL","x":1288,"y":727,"g":"B","w":55,"h":67,"c":"#858e89"},{"sku":"WTR62","x":1349,"y":727,"g":"B","w":55,"h":67,"c":"#858e89"},{"sku":"WTR62CL","x":1410,"y":727,"g":"B","w":55,"h":67,"c":"#858e89"},{"sku":"RBGP318","x":1471,"y":727,"g":"B","w":55,"h":67,"c":"#858e89"},{"sku":"CHWW-1500","x":-1435,"y":997,"g":"M"},{"sku":"CHWW-1000","x":-1363,"y":997,"g":"M"},{"sku":"CHWW-500","x":-1291,"y":997,"g":"M"},{"sku":"FR3CL","x":2560,"y":360,"g":"O"},{"sku":"WT224","x":740,"y":866,"g":"C","c":"#858e89"},{"sku":"WT224CL","x":738,"y":905,"g":"C"},{"sku":"WT216","x":812,"y":866,"g":"C","c":"#858e89"},{"sku":"WT216CL","x":810,"y":905,"g":"C"},{"sku":"WT223","x":884,"y":866,"g":"C","c":"#858e89"},{"sku":"GCT21","x":956,"y":866,"g":"C","c":"#858e89"},{"sku":"GCT21CL","x":1028,"y":866,"g":"C","c":"#858e89"},{"sku":"WT225","x":1100,"y":866,"g":"C","c":"#858e89"},{"sku":"WTR42","x":1172,"y":866,"g":"C","c":"#858e89"},{"sku":"WT228","x":1244,"y":866,"g":"C","c":"#858e89"},{"sku":"WT328CL","x":1316,"y":866,"g":"C","c":"#858e89"},{"sku":"GUT22","x":1676,"y":866,"g":"C","c":"#858e89"},{"sku":"GCT21S","x":1388,"y":866,"g":"C","c":"#858e89"},{"sku":"WTR32","x":1460,"y":866,"g":"C","c":"#858e89"},{"sku":"WT214S","x":1532,"y":866,"g":"C","c":"#858e89"},{"sku":"FR3","x":1604,"y":866,"g":"C","c":"#858e89"},{"sku":"RBGP216","x":1748,"y":866,"g":"F","c":"#858e89"},{"sku":"RBGP214","x":1820,"y":866,"g":"F","c":"#858e89"},{"sku":"6EBR14","x":-758,"y":1967,"g":"F"},{"sku":"6EBR6","x":-686,"y":1967,"g":"F"},{"sku":"6EBR8","x":-614,"y":1967,"g":"F"},{"sku":"6EBR16","x":-542,"y":1967,"g":"F"},{"sku":"6EBR4","x":-470,"y":1967,"g":"F"},{"sku":"6EBR10","x":-398,"y":1967,"g":"F"},{"sku":"6EBR12","x":-326,"y":1967,"g":"F"},{"sku":"ECGR10CL","x":882,"y":905,"g":"D"},{"sku":"EWGR4CL","x":1551,"y":905,"g":"D"},{"sku":"EWGR6CL","x":1623,"y":905,"g":"D"},{"sku":"EWGR64CL","x":1695,"y":905,"g":"D"},{"sku":"ECR16","x":-980,"y":1446,"g":"E"},{"sku":"6ER8","x":-908,"y":1446,"g":"E"},{"sku":"6ER4","x":-836,"y":1446,"g":"E"},{"sku":"6ER14","x":-764,"y":1446,"g":"E"},{"sku":"6ER6","x":-692,"y":1446,"g":"E"},{"sku":"EWR84","x":-620,"y":1446,"g":"E"},{"sku":"EWR4","x":-548,"y":1446,"g":"E"},{"sku":"2RGCH12","x":-476,"y":1446,"g":"E"},{"sku":"2RGCH10","x":-404,"y":1446,"g":"E"},{"sku":"2RGCH8","x":-332,"y":1446,"g":"E"},{"sku":"2RGCH6","x":-260,"y":1446,"g":"E"},{"sku":"RRC12","x":-188,"y":1446,"g":"E"},{"sku":"WGSC4","x":-836,"y":1486,"g":"E"},{"sku":"WGSC12CL","x":-764,"y":1486,"g":"E"},{"sku":"WFGBL16","x":-692,"y":1486,"g":"E"},{"sku":"WFGBL10","x":-620,"y":1486,"g":"E"},{"sku":"WFGBL4","x":-548,"y":1486,"g":"E"},{"sku":"WFGBL12","x":-476,"y":1486,"g":"E"},{"sku":"WFGBLSC10","x":-404,"y":1486,"g":"E"},{"sku":"WFGBLSC4","x":-332,"y":1486,"g":"E"},{"sku":"WFGBLSC16","x":-260,"y":1486,"g":"E"},{"sku":"WFGBLSC8","x":-188,"y":1486,"g":"E"},{"sku":"WFGBLSC12","x":-116,"y":1486,"g":"E"},{"sku":"WFGGSC10","x":-41,"y":2049,"g":"E"},{"sku":"2GGCH14","x":-980,"y":1526,"g":"E"},{"sku":"2GGCH16","x":-908,"y":1526,"g":"E"},{"sku":"2GGCH10","x":-836,"y":1526,"g":"E"},{"sku":"2GGCH12","x":-764,"y":1526,"g":"E"},{"sku":"EWG66T","x":-692,"y":1526,"g":"E"},{"sku":"EWG4T","x":-620,"y":1526,"g":"E"},{"sku":"ECG10T","x":441,"y":1340,"g":"H"},{"sku":"ECG16T","x":369,"y":1340,"g":"H"},{"sku":"6EG4E","x":1017,"y":1340,"g":"H"},{"sku":"6EG8E","x":1161,"y":1340,"g":"H"},{"sku":"6EG6E","x":1089,"y":1340,"g":"H"},{"sku":"6EG12","x":801,"y":1340,"g":"H"},{"sku":"6EG10","x":729,"y":1340,"g":"H"},{"sku":"6EG4","x":513,"y":1340,"g":"H"},{"sku":"6EG16","x":945,"y":1340,"g":"H"},{"sku":"6EG8","x":657,"y":1340,"g":"H"},{"sku":"6EG14","x":873,"y":1340,"g":"H"},{"sku":"6EG6","x":585,"y":1340,"g":"H"},{"sku":"6EG18","x":68,"y":1559,"g":"H"},{"sku":"2GC12","x":152,"y":1559,"g":"H"},{"sku":"WFGGSC12CL","x":699,"y":1385,"g":"H","w":76,"h":35},{"sku":"WFGGSC4CL","x":371,"y":1385,"g":"H","w":76,"h":35},{"sku":"WFGGSC4","x":945,"y":1385,"g":"H"},{"sku":"WFGGSC10CL","x":617,"y":1385,"g":"H","w":76,"h":35},{"sku":"WFGGSC10","x":1161,"y":1385,"g":"H"},{"sku":"WFGGSC8","x":1089,"y":1385,"g":"H"},{"sku":"WFGGSC6","x":1017,"y":1385,"g":"H"},{"sku":"WFGGSC14CL","x":781,"y":1385,"g":"H","w":76,"h":35},{"sku":"WFGGSC8CL","x":535,"y":1385,"g":"H","w":76,"h":35},{"sku":"WFGGSC6CL","x":453,"y":1385,"g":"H","w":76,"h":35},{"sku":"WFGGSC16CL","x":863,"y":1385,"g":"H","w":76,"h":35},{"sku":"6EBL16","x":1099,"y":1587,"g":"H"},{"sku":"6EBL12","x":1182,"y":1594,"g":"H","w":60,"h":43},{"sku":"6EBL10","x":1254,"y":1610,"g":"H"},{"sku":"ECB12VC","x":80,"y":1599,"g":"H"},{"sku":"PPWR8","x":152,"y":1599,"g":"H"},{"sku":"BSBL","x":-794,"y":2021,"g":"L"},{"sku":"CA20BL","x":-722,"y":2021,"g":"L"},{"sku":"HDBPCL","x":-650,"y":2021,"g":"L"},{"sku":"MBSSSCCL","x":-578,"y":2021,"g":"L"},{"sku":"PFQA12","x":-506,"y":2021,"g":"L"},{"sku":"HF30BL","x":-434,"y":2021,"g":"L"},{"sku":"BPCL","x":-362,"y":2021,"g":"L"},{"sku":"CACL","x":-290,"y":2021,"g":"L"},{"sku":"QASS","x":-218,"y":2021,"g":"L"},{"sku":"FC201BL","x":-146,"y":2021,"g":"L"},{"sku":"PFQA","x":-794,"y":2061,"g":"L"},{"sku":"HF20BL","x":-722,"y":2061,"g":"L"},{"sku":"SSTCL","x":-650,"y":2061,"g":"L"},{"sku":"ATVCD","x":-578,"y":2061,"g":"L"},{"sku":"DH105BL","x":-506,"y":2061,"g":"L"},{"sku":"DSC5CL","x":-434,"y":2061,"g":"L"},{"sku":"LRWK","x":-362,"y":2061,"g":"L"},{"sku":"WFSCL","x":-290,"y":2061,"g":"L"},{"sku":"WS20BL","x":-218,"y":2061,"g":"L"},{"sku":"BP20BL","x":-146,"y":2061,"g":"L"},{"sku":"BP30BL","x":-794,"y":2101,"g":"L"},{"sku":"TM20BL","x":-722,"y":2101,"g":"L"},{"sku":"TMCL","x":-650,"y":2101,"g":"L"},{"sku":"DH206BL","x":-578,"y":2101,"g":"L"},{"sku":"DH307BL","x":-506,"y":2101,"g":"L"},{"sku":"MDD6CL","x":-434,"y":2101,"g":"L"},{"sku":"HDD7CL","x":-362,"y":2101,"g":"L"},{"sku":"SS20BL","x":-290,"y":2101,"g":"L"},{"sku":"SUBCL","x":-218,"y":2101,"g":"L"},{"sku":"BSCL","x":-146,"y":2101,"g":"L"},{"sku":"CULCL","x":-794,"y":2141,"g":"L"},{"sku":"RT4LDCL","x":-722,"y":2141,"g":"L"},{"sku":"RT104BL","x":-650,"y":2141,"g":"L"},{"sku":"RT207BL","x":-578,"y":2141,"g":"L"},{"sku":"RC205BL","x":-506,"y":2141,"g":"L"},{"sku":"RC206BL","x":-434,"y":2141,"g":"L"},{"sku":"RC104BL","x":-362,"y":2141,"g":"L"},{"sku":"FM206","x":-290,"y":2141,"g":"L"},{"sku":"RTFK4CL","x":-218,"y":2141,"g":"L"},{"sku":"RT205BL","x":-146,"y":2141,"g":"L"},{"sku":"RT206BL","x":-794,"y":2181,"g":"L"},{"sku":"RBRC205CL","x":-722,"y":2181,"g":"L"},{"sku":"RBRC402CL","x":-650,"y":2181,"g":"L"},{"sku":"RBRC602CL","x":-578,"y":2181,"g":"L"},{"sku":"RTFK5CL","x":-506,"y":2181,"g":"L"},{"sku":"RTFK6CL","x":-434,"y":2181,"g":"L"},{"sku":"LR6CL","x":-362,"y":2181,"g":"L"},{"sku":"LR5CL","x":-290,"y":2181,"g":"L"},{"sku":"LR7CL","x":-218,"y":2181,"g":"L"},{"sku":"LRSC4CL","x":-146,"y":2181,"g":"L"},{"sku":"GB6CL","x":-794,"y":2221,"g":"L"},{"sku":"GB5CL","x":-722,"y":2221,"g":"L"},{"sku":"GB7CL","x":-650,"y":2221,"g":"L"},{"sku":"RBSC4CL","x":-578,"y":2221,"g":"L"},{"sku":"LR206BL","x":-506,"y":2221,"g":"L"},{"sku":"LR205BL","x":-434,"y":2221,"g":"L"},{"sku":"LR207BL","x":-362,"y":2221,"g":"L"},{"sku":"LR104BL","x":-290,"y":2221,"g":"L"},{"sku":"GB206BL","x":-218,"y":2221,"g":"L"},{"sku":"GB207BL","x":-146,"y":2221,"g":"L"},{"sku":"GB205BL","x":-794,"y":2261,"g":"L"},{"sku":"GB104BL","x":-722,"y":2261,"g":"L"},{"sku":"BB6CL","x":-650,"y":2261,"g":"L"},{"sku":"BB206BL","x":-578,"y":2261,"g":"L"},{"sku":"BB5CL","x":-506,"y":2261,"g":"L"},{"sku":"BB205BL","x":-434,"y":2261,"g":"L"},{"sku":"BB104BL","x":-362,"y":2261,"g":"L"},{"sku":"BBSC4CL","x":-290,"y":2261,"g":"L"},{"sku":"MBCL","x":-218,"y":2261,"g":"L"},{"sku":"MB20BL","x":-146,"y":2261,"g":"L"},{"sku":"ATVH44","x":-794,"y":2301,"g":"L"},{"sku":"2RWU","x":-722,"y":2301,"g":"L"},{"sku":"ATVS","x":-650,"y":2301,"g":"L"},{"sku":"FS20","x":-578,"y":2301,"g":"L"},{"sku":"PFS20","x":-506,"y":2301,"g":"L"},{"sku":"CCA","x":200,"y":1640,"g":"J"},{"sku":"CMSCA6","x":272,"y":1640,"g":"J"},{"sku":"MP1","x":344,"y":1640,"g":"J"},{"sku":"SCG","x":416,"y":1640,"g":"J"},{"sku":"SBMF","x":488,"y":1640,"g":"J"},{"sku":"SPGF","x":560,"y":1640,"g":"J"},{"sku":"PGF","x":632,"y":1640,"g":"J"},{"sku":"WMHF","x":704,"y":1640,"g":"J"},{"sku":"GLMF","x":776,"y":1640,"g":"J"},{"sku":"BMF","x":848,"y":1640,"g":"J"},{"sku":"EHB","x":920,"y":1640,"g":"J"},{"sku":"HHGF","x":992,"y":1640,"g":"J"},{"sku":"14G20","x":200,"y":1680,"g":"J"},{"sku":"HDBHF","x":272,"y":1680,"g":"J"},{"sku":"GFP","x":344,"y":1680,"g":"J"},{"sku":"TBFBR","x":416,"y":1680,"g":"J"},{"sku":"CBFG","x":488,"y":1680,"g":"J"},{"sku":"1PB5","x":560,"y":1680,"g":"J"},{"sku":"1PGB5","x":632,"y":1680,"g":"J"},{"sku":"1PB10","x":704,"y":1680,"g":"J"},{"sku":"1PEB10","x":776,"y":1680,"g":"J"},{"sku":"AFBF","x":848,"y":1680,"g":"J"},{"sku":"LSBF","x":920,"y":1680,"g":"J"},{"sku":"KPW5","x":200,"y":1800,"g":"K"},{"sku":"KP5","x":272,"y":1800,"g":"K"},{"sku":"KP10","x":344,"y":1800,"g":"K"},{"sku":"10WKE","x":416,"y":1800,"g":"K"},{"sku":"10WK","x":488,"y":1800,"g":"K"},{"sku":"DKSMDB10/DKF2DHDG","x":560,"y":1800,"g":"K"},{"sku":"DKSMDB5/DKFMDB5","x":632,"y":1800,"g":"K"},{"sku":"DKMDB","x":704,"y":1800,"g":"K"},{"sku":"DKSHDG","x":776,"y":1800,"g":"K"},{"sku":"DKHDG","x":848,"y":1800,"g":"K"},{"sku":"AHGF","x":920,"y":1800,"g":"K"},{"sku":"DTSAF","x":992,"y":1800,"g":"K"},{"sku":"HP8","x":200,"y":1840,"g":"K"},{"sku":"CPH","x":272,"y":1840,"g":"K"},{"sku":"WPG16","x":344,"y":1840,"g":"K"},{"sku":"CPCT","x":416,"y":1840,"g":"K"},{"sku":"WP4466416","x":488,"y":1840,"g":"K"},{"sku":"CPS10","x":560,"y":1840,"g":"K"},{"sku":"WTDT214G","x":1623,"y":731,"g":"T","w":63,"h":25},{"sku":"WTDT216G","x":1623,"y":762,"g":"T","w":63,"h":25},{"sku":"WTDT224G","x":1623,"y":793,"g":"T","w":63,"h":25},{"sku":"WTDT226G","x":1692,"y":731,"g":"T","w":63,"h":25},{"sku":"WTDT328G","x":1692,"y":762,"g":"T","w":63,"h":25},{"sku":"WTDT62G","x":1692,"y":793,"g":"T","w":63,"h":25},{"sku":"GUT22","x":-722,"y":2541,"g":"T"},{"sku":"WTDT102G","x":-650,"y":2541,"g":"T"},{"sku":"TW323","x":-578,"y":2541,"g":"T"},{"sku":"SWT323","x":-506,"y":2541,"g":"T"},{"sku":"TRBGP312","x":-434,"y":2541,"g":"T"},{"sku":"SRBGP313","x":-362,"y":2541,"g":"T"},{"sku":"OVERFLOW","x":-290,"y":2541,"g":"T"},{"sku":"WFGGRSC4","x":1026,"y":905,"g":"T","w":69,"h":34},{"sku":"WFGGRSC6","x":1101,"y":905,"g":"T","w":69,"h":34},{"sku":"WFGGRSC8","x":1176,"y":905,"g":"T","w":69,"h":34},{"sku":"WFGGRSC10","x":1251,"y":905,"g":"T","w":69,"h":34},{"sku":"WFGGRSC12","x":1326,"y":905,"g":"T","w":69,"h":34},{"sku":"WFGGRSC14","x":1401,"y":905,"g":"T","w":69,"h":34},{"sku":"WFGGRSC16","x":1476,"y":905,"g":"T","w":69,"h":34},{"sku":"EWGR4CL","x":1767,"y":905,"g":"T"},{"sku":"EWGR6CL","x":1839,"y":905,"g":"T"},{"sku":"EWGR66CL","x":1911,"y":905,"g":"T"},{"sku":"6MDG4IFA","x":1983,"y":905,"g":"T"},{"sku":"6MDG6IFA","x":2055,"y":905,"g":"T"},{"sku":"6MDG8IFA","x":2127,"y":905,"g":"T"},{"sku":"6MDG10IFA","x":2199,"y":905,"g":"T","w":72,"h":34},{"sku":"6MDG12IFA","x":2277,"y":905,"g":"T","w":72,"h":34},{"sku":"6MDG14IFA","x":2355,"y":905,"g":"T","w":72,"h":34},{"sku":"6MDG16IFA","x":2433,"y":905,"g":"T","w":72,"h":34},{"sku":"ECGR10","x":954,"y":905,"g":"T"},{"sku":"6GG4","x":739,"y":1012,"g":"T"},{"sku":"6GG6","x":811,"y":1012,"g":"T"},{"sku":"6GG8","x":883,"y":1012,"g":"T"},{"sku":"6GG10","x":955,"y":1012,"g":"T"},{"sku":"6GG12","x":1027,"y":1012,"g":"T"},{"sku":"6GG14","x":1099,"y":1012,"g":"T"},{"sku":"6GG16","x":1171,"y":1012,"g":"T"},{"sku":"6EGR4CL","x":1243,"y":1012,"g":"T"},{"sku":"6EGR6CL","x":1315,"y":1012,"g":"T"},{"sku":"6EGR8CL","x":1387,"y":1012,"g":"T"},{"sku":"6EGR10CL","x":1459,"y":1012,"g":"T"},{"sku":"6EGR12CL","x":1531,"y":1012,"g":"T"},{"sku":"6EGR14CL","x":1603,"y":1012,"g":"T"},{"sku":"6EGR16CL","x":1675,"y":1012,"g":"T"},{"sku":"WGSC4","x":1747,"y":1012,"g":"T"},{"sku":"WGSC6","x":1819,"y":1012,"g":"T"},{"sku":"WGSC8","x":1891,"y":1012,"g":"T"},{"sku":"WGSC10","x":1963,"y":1012,"g":"T"},{"sku":"WGSC12","x":2035,"y":1012,"g":"T"},{"sku":"WGSC14","x":2107,"y":1012,"g":"T"},{"sku":"WGSC16","x":2179,"y":1012,"g":"T"},{"sku":"6GC12","x":2251,"y":1012,"g":"T"},{"sku":"6EGR4IFA","x":741,"y":1051,"g":"T","w":69,"h":33},{"sku":"6EGR6IFA","x":816,"y":1051,"g":"T","w":69,"h":33},{"sku":"6EGR8IFA","x":891,"y":1051,"g":"T","w":69,"h":33},{"sku":"6EGR10IFA","x":966,"y":1051,"g":"T","w":69,"h":33},{"sku":"6EGR12IFA","x":1041,"y":1051,"g":"T","w":69,"h":33},{"sku":"6EGR14IFA","x":1116,"y":1051,"g":"T","w":69,"h":33},{"sku":"6EGR16IFA","x":1191,"y":1051,"g":"T","w":69,"h":33},{"sku":"ECR8","x":1266,"y":1051,"g":"T"},{"sku":"ECR10","x":1338,"y":1051,"g":"T"},{"sku":"ECR16","x":1410,"y":1051,"g":"T"},{"sku":"ECBR10","x":1482,"y":1051,"g":"T"},{"sku":"ECBR14","x":1554,"y":1051,"g":"T"},{"sku":"ECBR16","x":1626,"y":1051,"g":"T"},{"sku":"WGSC4CL","x":1720,"y":1052,"g":"T"},{"sku":"WGSC6CL","x":1792,"y":1052,"g":"T"},{"sku":"WGSC8CL","x":1864,"y":1052,"g":"T"},{"sku":"WGSC10CL","x":1936,"y":1052,"g":"T"},{"sku":"WGSC12CL","x":2008,"y":1052,"g":"T"},{"sku":"WGSC14CL","x":2080,"y":1052,"g":"T"},{"sku":"WGSC16CL","x":2152,"y":1052,"g":"T"},{"sku":"6ER4","x":733,"y":1137,"g":"T"},{"sku":"6ER6","x":805,"y":1137,"g":"T"},{"sku":"6ER8","x":877,"y":1137,"g":"T"},{"sku":"6ER10","x":949,"y":1137,"g":"T"},{"sku":"6ER12","x":1021,"y":1137,"g":"T"},{"sku":"6ER14","x":1093,"y":1137,"g":"T"},{"sku":"6ER16","x":1165,"y":1137,"g":"T"},{"sku":"6ER4CL","x":1237,"y":1137,"g":"T"},{"sku":"6ER6CL","x":1309,"y":1137,"g":"T"},{"sku":"6ER8CL","x":1381,"y":1137,"g":"T"},{"sku":"6ER10CL","x":1453,"y":1137,"g":"T"},{"sku":"6ER12CL","x":1525,"y":1137,"g":"T"},{"sku":"6ER14CL","x":1597,"y":1137,"g":"T"},{"sku":"6ER16CL","x":1669,"y":1137,"g":"T"},{"sku":"2RGCH4","x":1741,"y":1137,"g":"T"},{"sku":"2RGCH6","x":1813,"y":1137,"g":"T"},{"sku":"2RGCH8","x":1885,"y":1137,"g":"T"},{"sku":"2RGCH10","x":1957,"y":1137,"g":"T"},{"sku":"2RGCH12","x":2029,"y":1137,"g":"T"},{"sku":"2RGCH14","x":2101,"y":1137,"g":"T"},{"sku":"2RGCH16","x":2173,"y":1137,"g":"T"},{"sku":"2RGCH4CL","x":2245,"y":1137,"g":"T"},{"sku":"2RGCH6CL","x":2317,"y":1137,"g":"T"},{"sku":"2RGCH8CL","x":2389,"y":1137,"g":"T"},{"sku":"2RGCH10CL","x":2461,"y":1137,"g":"T","w":69,"h":34},{"sku":"2RGCH12CL","x":2536,"y":1137,"g":"T","w":69,"h":34},{"sku":"2RGCH14CL","x":2611,"y":1137,"g":"T","w":69,"h":34},{"sku":"2RGCH16CL","x":2686,"y":1137,"g":"T","w":69,"h":34},{"sku":"6EBR4","x":733,"y":1185,"g":"T"},{"sku":"6EBR6","x":805,"y":1185,"g":"T"},{"sku":"6EBR8","x":877,"y":1185,"g":"T"},{"sku":"6EBR10","x":949,"y":1185,"g":"T"},{"sku":"6EBR12","x":1021,"y":1185,"g":"T"},{"sku":"6EBR14","x":1093,"y":1185,"g":"T"},{"sku":"6EBR16","x":1165,"y":1185,"g":"T"},{"sku":"WFGBRSC4","x":1237,"y":1185,"g":"T"},{"sku":"WFGBRSC6","x":1309,"y":1185,"g":"T"},{"sku":"WFGBRSC8","x":1381,"y":1185,"g":"T"},{"sku":"WFGBRSC10","x":1453,"y":1185,"g":"T"},{"sku":"WFGBRSC12","x":1525,"y":1185,"g":"T"},{"sku":"WFGBRSC14","x":1597,"y":1185,"g":"T"},{"sku":"WFGBRSC16","x":1669,"y":1185,"g":"T"},{"sku":"2BRGCH4","x":1741,"y":1185,"g":"T"},{"sku":"2BRGCH6","x":1813,"y":1185,"g":"T"},{"sku":"2BRGCH8","x":1885,"y":1185,"g":"T"},{"sku":"2BRGCH10","x":1957,"y":1185,"g":"T"},{"sku":"2BRGCH12","x":2029,"y":1185,"g":"T"},{"sku":"2BRGCH14","x":2101,"y":1185,"g":"T"},{"sku":"2BRGCH16","x":2173,"y":1185,"g":"T"},{"sku":"6EG10E","x":1233,"y":1340,"g":"T"},{"sku":"6EG12E","x":1305,"y":1340,"g":"T"},{"sku":"6EG14E","x":1377,"y":1340,"g":"T"},{"sku":"6EG16E","x":1449,"y":1340,"g":"T"},{"sku":"2GGCH4","x":1521,"y":1340,"g":"T"},{"sku":"2GGCH6","x":1593,"y":1340,"g":"T"},{"sku":"2GGCH8","x":1665,"y":1340,"g":"T"},{"sku":"2GGCH10","x":1737,"y":1340,"g":"T"},{"sku":"2GGCH12","x":1809,"y":1340,"g":"T"},{"sku":"2GGCH14","x":1881,"y":1340,"g":"T"},{"sku":"2GGCH16","x":1953,"y":1340,"g":"T"},{"sku":"EWG66","x":2025,"y":1340,"g":"T"},{"sku":"EWG6","x":2097,"y":1340,"g":"T"},{"sku":"EWG4","x":2169,"y":1340,"g":"T"},{"sku":"WFGGSC14","x":1305,"y":1385,"g":"T"},{"sku":"WFGGSC16","x":1377,"y":1385,"g":"T"},{"sku":"WFGBLSC4","x":1449,"y":1385,"g":"T"},{"sku":"WFGBLSC6","x":1521,"y":1385,"g":"T","w":69,"h":35},{"sku":"WFGBLSC8","x":1596,"y":1385,"g":"T","w":69,"h":35},{"sku":"WFGBLSC10","x":1671,"y":1385,"g":"T","w":69,"h":35},{"sku":"WFGBLSC12","x":1746,"y":1385,"g":"T","w":69,"h":35},{"sku":"WFGBLSC14","x":1821,"y":1385,"g":"T","w":69,"h":35},{"sku":"WFGBLSC16","x":1896,"y":1385,"g":"T","w":69,"h":35},{"sku":"6EGBL4","x":1971,"y":1385,"g":"T"},{"sku":"6EGBL6","x":2043,"y":1385,"g":"T"},{"sku":"6EGBL8","x":2115,"y":1385,"g":"T"},{"sku":"6EGBL10","x":2187,"y":1385,"g":"T"},{"sku":"6EGBL12","x":2259,"y":1385,"g":"T"},{"sku":"6EGBL14","x":2331,"y":1385,"g":"T"},{"sku":"6EGBL16","x":2403,"y":1385,"g":"T"},{"sku":"WTP82","x":1538,"y":727,"g":"X","w":72,"h":84,"c":"#0b6fea"},{"sku":"WFGGSC12","x":1233,"y":1385,"g":"X"}
];

const V3_DATA_BG = [
  {"type":"poly","pts":[[3508,-222],[6288,-222],[6288,238],[6108,438],[6288,618],[6208,1218],[5888,1718],[5788,1998],[3588,1998],[3448,1318],[3448,358]],"closed":true,"kind":"outline"},{"type":"poly","pts":[[-1782,-70],[-1758,70],[-1788,210],[-1762,370],[-1786,530],[-1764,710],[-1784,890],[-1766,1070],[-1782,1250],[-1768,1410]],"closed":false,"kind":"creek"},{"type":"rect","x":2368,"y":73,"w":700,"h":360,"label":"SECONDS","kind":"zone"},{"type":"rect","x":1951,"y":427,"w":270,"h":361,"label":"CUSTOMER PICKUP","kind":"zone"},{"type":"rect","x":3408,"y":2147,"w":1520,"h":410,"label":"TANK PLANT · DOORS 8 · 9 · 10","kind":"zone"},{"type":"rect","x":-1105,"y":2534,"w":520,"h":110,"label":"FEEDERS / MTO","kind":"zone"},{"type":"rect","x":-139,"y":2490,"w":960,"h":300,"label":"GATE MTO","kind":"zone"},{"type":"rect","x":-1995,"y":2262,"w":640,"h":130,"label":"RODEO MTO","kind":"zone"},{"type":"rect","x":112,"y":2642,"w":260,"h":95,"label":"WATER WAGONS","kind":"zone"},{"type":"rect","x":1044,"y":2542,"w":560,"h":240,"label":"TRAILER PARKING","kind":"zone"},{"type":"rect","x":500,"y":60,"w":1200,"h":660,"label":"TARTER — MAIN BUILDING","kind":"buildingbig"},{"type":"rect","x":332,"y":912,"w":326,"h":340,"label":"LOADING","kind":"building"},{"type":"rect","x":385,"y":970,"w":210,"h":95,"label":"PIT #1","kind":"pit"},{"type":"rect","x":394,"y":1117,"w":210,"h":95,"label":"PIT #2","kind":"pit"},{"type":"rect","x":400,"y":70,"w":96,"h":66,"label":"Dust coll.","kind":"box"},{"type":"rect","x":372,"y":384,"w":120,"h":86,"label":"Smoker shed","kind":"box"},{"type":"rect","x":443,"y":723,"w":53,"h":48,"label":"Diesel","kind":"box"},{"type":"rect","x":507,"y":727,"w":108,"h":134,"label":"Break room","kind":"box"},{"type":"rect","x":744,"y":728,"w":83,"h":44,"label":"AIR LIQUIDE","kind":"box"},{"type":"rect","x":846,"y":730,"w":57,"h":43,"label":"CO2","kind":"box"},{"type":"rect","x":1740,"y":520,"w":120,"h":44,"label":"Propane","kind":"box"},{"type":"rect","x":1740,"y":596,"w":120,"h":60,"label":"Burner-Off","kind":"box"},{"type":"rect","x":2540,"y":326,"w":150,"h":110,"label":"","kind":"grid"},{"type":"rect","x":2210,"y":110,"w":120,"h":44,"label":"GARBAGE","kind":"box"},{"type":"rect","x":2210,"y":178,"w":120,"h":44,"label":"GARBAGE","kind":"box"},{"type":"rect","x":2210,"y":246,"w":120,"h":44,"label":"GARBAGE","kind":"box"},{"type":"door","x":1600,"y":60,"label":"#1","vert":false},{"type":"door","x":1700,"y":150,"label":"#2","vert":true},{"type":"door","x":1700,"y":330,"label":"#3","vert":true},{"type":"door","x":1700,"y":510,"label":"#4","vert":true},{"type":"door","x":700,"y":718,"label":"#5","vert":false},{"type":"door","x":500,"y":300,"label":"#6","vert":true},{"type":"door","x":500,"y":120,"label":"#7","vert":true},{"type":"door","x":2918,"y":838,"label":"#8","vert":false},{"type":"door","x":2954,"y":1647,"label":"#9","vert":false},{"type":"door","x":2855,"y":1471,"label":"#10","vert":false},{"type":"circle","cx":2408,"cy":640,"r":36},{"type":"circle","cx":2383,"cy":682,"r":36},{"type":"circle","cx":2325,"cy":693,"r":36},{"type":"circle","cx":2278,"cy":663,"r":36},{"type":"circle","cx":2278,"cy":617,"r":36},{"type":"circle","cx":2325,"cy":587,"r":36},{"type":"circle","cx":2383,"cy":598,"r":36},{"type":"rect","x":-385,"y":717,"w":151,"h":385,"label":"","kind":"box"},{"type":"rect","x":-525,"y":194,"w":650,"h":1175,"label":"","kind":"box"},{"type":"rect","x":2967,"y":658,"w":180,"h":541,"label":"","kind":"box"},{"type":"label","x":3047,"y":691,"text":"TANKS","size":22}
];

/* The map that ships with the app (assets/default-map.json, loaded at boot).
   Falls back to the inline v3 tables if that fetch fails. */
let SEED_DATA = null;

function DEFAULT_DATA(){
  if(SEED_DATA) return ensureGroups(JSON.parse(JSON.stringify(SEED_DATA)));
  return ensureGroups({
    version:6,
    updated:"",
    groups: DEFAULT_GROUPS(),
    tiles: V3_DATA_TILES.map(t=>({...t})),
    bg: V3_DATA_BG.map(b=>({...b})).concat([
      {type:"rect", kind:"flex", x:1120, y:1600, w:560, h:240, label:"MTO", skus:[]}
    ])
  });
}
/* Used by "Reset background" and by legacy payloads that carry no bg array. */
function DEFAULT_BG(){ return DEFAULT_DATA().bg; }

const TW=66, TH=34;
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const stage=$("#stage"), canvas=$("#canvas"), bg=$("#bg"), band=$("#band"), ghostwrap=$("#ghostwrap");

let data=DEFAULT_DATA();
let view={tx:0,ty:0,k:1};
let editing=false, snap=false;
let selection=new Set();
const tileEls=new Map();

/* Set while we are applying a remote update, so echoing it straight back
   to the server never turns one person's edit into a save loop. */
let applyingRemote=false;

function canEdit(){ return window.Sync ? Sync.canEdit() : true; }

function save(){
  data.updated=new Date().toISOString();
  if(applyingRemote) return;
  if(!canEdit()){ toast(t("session.noPermission")); return; }
  if(window.Sync) Sync.pushState(data);
}
const color=g=>{ const G=groupById(g); return G? G.color : (COLORS[g]||COLORS.X); };

function esc(s){ return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function hl(text,q){ const e=esc(text); if(!q) return e; const i=text.toUpperCase().indexOf(q.toUpperCase());
  if(i<0) return e; return esc(text.slice(0,i))+"<mark>"+esc(text.slice(i,i+q.length))+"</mark>"+esc(text.slice(i+q.length)); }

function itemBox(it){
  if(it.type==="rect") return {x:it.x,y:it.y,w:it.w,h:it.h};
  if(it.type==="line") return {x:Math.min(it.x1,it.x2),y:Math.min(it.y1,it.y2),w:Math.abs(it.x2-it.x1),h:Math.abs(it.y2-it.y1)};
  if(it.type==="circle") return {x:it.cx-it.r,y:it.cy-it.r,w:it.r*2,h:it.r*2};
  if(it.type==="door") return {x:it.x-26,y:it.y-26,w:52,h:52};
  if(it.type==="label") return {x:it.x-40,y:it.y-12,w:80,h:24};
  if(it.type==="poly"){ const xs=it.pts.map(p=>p[0]),ys=it.pts.map(p=>p[1]);
    return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}; }
  return {x:0,y:0,w:0,h:0};
}
function bounds(){
  let minx=1e9,miny=1e9,maxx=-1e9,maxy=-1e9;
  const grow=(x,y)=>{minx=Math.min(minx,x);miny=Math.min(miny,y);maxx=Math.max(maxx,x);maxy=Math.max(maxy,y);};
  (data.bg||[]).forEach(it=>{ const b=itemBox(it); grow(b.x,b.y); grow(b.x+b.w,b.y+b.h); });
  data.tiles.forEach(t=>{ grow(t.x,t.y); grow(t.x+(t.w||TW),t.y+(t.h||TH)); });
  if(minx>maxx){minx=0;miny=0;maxx=100;maxy=100;}
  return {minx:minx-60,miny:miny-60,maxx:maxx+60,maxy:maxy+60};
}
const SVGNS="http://www.w3.org/2000/svg";
function svgel(tag,attrs,txt){ const n=document.createElementNS(SVGNS,tag);
  for(const k in attrs) n.setAttribute(k,attrs[k]); if(txt!=null) n.textContent=txt; return n; }
function bgLabel(x,y,t,size,col,weight){ return svgel("text",{x,y,fill:col||"#7c8896",
  "font-family":"Barlow Semi Condensed, sans-serif","font-size":size||20,"font-weight":weight||700,
  "text-anchor":"middle","dominant-baseline":"middle","letter-spacing":.5},t); }

function kindStyle(k){
  if(k==="flex")        return {fill:"rgba(255,192,46,.06)",stroke:"#C98A2E",sw:2.5,rx:14,dash:"14 9",lsize:19,lcol:"#E0A93E",lw:800,ltop:true};
  if(k==="zone")        return {fill:"rgba(90,141,239,.04)",stroke:"#37506e",sw:2,rx:16,dash:"10 8",lsize:20,lcol:"#5f7690",lw:800,ltop:true};
  if(k==="building")    return {fill:"rgba(255,255,255,.045)",stroke:"#465364",sw:3,rx:10,dash:null,lsize:18,lcol:"#6d7a8a",lw:800,ltop:true};
  if(k==="buildingbig") return {fill:"rgba(255,255,255,.045)",stroke:"#465364",sw:3,rx:10,dash:null,lsize:34,lcol:"#6d7a8a",lw:800,ltop:false};
  if(k==="pit")         return {fill:"rgba(255,255,255,.03)",stroke:"#3f4a58",sw:2,rx:8,dash:null,lsize:15,lcol:"#7c8896",lw:700,ltop:false};
  return {fill:"rgba(255,255,255,.025)",stroke:"#39434f",sw:1.5,rx:6,dash:null,lsize:12,lcol:"#6c7887",lw:600,ltop:false};
}
const DASHMAP={solid:null,dashed:"10 8",dotted:"2 7"};
function styleFor(it){
  const s=kindStyle(it.kind||"box");
  if(it.fill!=null)   s.fill=it.fill;
  if(it.stroke!=null) s.stroke=it.stroke;
  if(it.sw!=null)     s.sw=it.sw;
  if(it.rx!=null)     s.rx=it.rx;
  if(it.op!=null)     s.op=it.op;
  if(it.dash!=null)   s.dash=(it.dash in DASHMAP)?DASHMAP[it.dash]:it.dash;
  if(it.lsize!=null)  s.lsize=it.lsize;
  return s;
}

function shapeNode(it,s){
  const A={fill:s.fill,stroke:s.stroke,"stroke-width":s.sw};
  if(s.dash) A["stroke-dasharray"]=s.dash;
  const x=it.x,y=it.y,w=it.w,h=it.h, sh=it.shape||"rect";
  if(sh==="ellipse")  return svgel("ellipse",{cx:x+w/2,cy:y+h/2,rx:Math.max(1,w/2),ry:Math.max(1,h/2),...A});
  if(sh==="diamond")  return svgel("polygon",{points:`${x+w/2},${y} ${x+w},${y+h/2} ${x+w/2},${y+h} ${x},${y+h/2}`,...A});
  if(sh==="triangle") return svgel("polygon",{points:`${x+w/2},${y} ${x+w},${y+h} ${x},${y+h}`,...A});
  return svgel("rect",{x,y,width:w,height:h,rx:s.rx,...A});
}
function itemCenter(it){ const b=itemBox(it); return {cx:b.x+b.w/2, cy:b.y+b.h/2}; }
function renderBgItem(it,idx,frag){
  const rot=+it.rot||0;
  const c=itemCenter(it);
  const g=svgel("g", rot?{transform:`rotate(${rot} ${c.cx} ${c.cy})`}:{});
  if(it.op!=null && it.type!=="poly") g.setAttribute("opacity", it.op);
  frag.appendChild(g);
  const hit=n=>{ n.setAttribute("data-bi",idx); n.setAttribute("class","bgi"); return n; };
  const s=styleFor(it);
  if(it.type==="poly"){
    const pts=it.pts.map(p=>p.join(",")).join(" ");
    if(it.closed) g.appendChild(hit(svgel("polygon",{points:pts,fill:it.fill||"rgba(255,255,255,.015)",stroke:it.stroke||"#3a4657","stroke-width":it.sw||3,...(s.dash?{"stroke-dasharray":s.dash}:{})})));
    else g.appendChild(hit(svgel("polyline",{points:pts,fill:"none",stroke:it.stroke||it.color||"#2f5d86","stroke-width":it.sw||5,"stroke-linecap":"round",opacity:it.op!=null?it.op:.7,...(s.dash?{"stroke-dasharray":s.dash}:{})})));
  } else if(it.type==="rect"){
    const k=it.kind||"box";
    g.appendChild(hit(shapeNode(it,s)));
    if(k==="grid"){ for(let i=1;i<5;i++) g.appendChild(svgel("line",{x1:it.x+i*it.w/5,y1:it.y,x2:it.x+i*it.w/5,y2:it.y+it.h,stroke:s.stroke,"stroke-width":1}));
      for(let j=1;j<3;j++) g.appendChild(svgel("line",{x1:it.x,y1:it.y+j*it.h/3,x2:it.x+it.w,y2:it.y+j*it.h/3,stroke:s.stroke,"stroke-width":1})); }
    if(it.label) g.appendChild(bgLabel(it.x+it.w/2, s.ltop?it.y+22:it.y+it.h/2, it.label, s.lsize, it.lcol||s.lcol, s.lw));
    if(k==="flex"){
      const n=(it.skus||[]).length;
      g.appendChild(bgLabel(it.x+it.w/2, it.y+44, t("bg.flexCount",{n}), 13, "#b8863a", 600));
      if(flashFlex===idx) g.appendChild(svgel("rect",{x:it.x-4,y:it.y-4,width:it.w+8,height:it.h+8,rx:16,fill:"none",
        stroke:"#FFC02E","stroke-width":Math.max(2,4/view.k),"stroke-dasharray":`${10/view.k} ${6/view.k}`}));
    }
  } else if(it.type==="line"){
    g.appendChild(hit(svgel("line",{x1:it.x1,y1:it.y1,x2:it.x2,y2:it.y2,stroke:it.stroke||it.color||"#4a5666","stroke-width":it.sw||4,"stroke-linecap":"round",...(s.dash?{"stroke-dasharray":s.dash}:{})})));
  } else if(it.type==="circle"){
    g.appendChild(hit(svgel("circle",{cx:it.cx,cy:it.cy,r:it.r,fill:it.fill||"rgba(255,255,255,.02)",stroke:it.stroke||"#3f4a58","stroke-width":it.sw||2,...(s.dash?{"stroke-dasharray":s.dash}:{})})));
  } else if(it.type==="door"){
    const col=it.stroke||"#37C871", dw=it.sw||6;
    if(it.vert) g.appendChild(hit(svgel("line",{x1:it.x,y1:it.y-26,x2:it.x,y2:it.y+26,stroke:col,"stroke-width":dw,"stroke-linecap":"round"})));
    else g.appendChild(hit(svgel("line",{x1:it.x-26,y1:it.y,x2:it.x+26,y2:it.y,stroke:col,"stroke-width":dw,"stroke-linecap":"round"})));
    if(it.label) g.appendChild(bgLabel(it.vert?it.x+(it.x<1000?38:-38):it.x, it.vert?it.y:it.y-16, "DOOR "+it.label, it.lsize||12, "#6f8f78", 700));
  } else if(it.type==="label"){
    g.appendChild(hit(bgLabel(it.x,it.y,it.text,it.size||20,it.stroke||it.color||"#7c8896",700)));
  }
}

const IS_TOUCH = (typeof matchMedia==="function") && matchMedia("(pointer:coarse)").matches;
function bgHandles(it,frag){
  const hs=Math.max(4,(IS_TOUCH?13:9)/view.k);
  const lwv=Math.max(1,1.5/view.k);
  const b=itemBox(it);
  const rot=+it.rot||0, cx=b.x+b.w/2, cy=b.y+b.h/2;
  const g=svgel("g", rot?{transform:`rotate(${rot} ${cx} ${cy})`}:{});
  frag.appendChild(g);
  const mk=(x,y,name)=>{ const r=svgel("rect",{x:x-hs,y:y-hs,width:hs*2,height:hs*2,rx:2,fill:"#FFC02E",stroke:"#221a02","stroke-width":lwv});
    r.setAttribute("data-h",name); r.setAttribute("class","bgh"); g.appendChild(r); };
  g.appendChild(svgel("rect",{x:b.x-3,y:b.y-3,width:b.w+6,height:b.h+6,fill:"none",stroke:"#FFC02E","stroke-width":lwv,"stroke-dasharray":`${8/view.k} ${6/view.k}`}));
  if(it.type==="line"){ mk(it.x1,it.y1,"p1"); mk(it.x2,it.y2,"p2"); return; }
  if(it.type==="rect"||it.type==="circle"){
    mk(b.x,b.y,"nw");        mk(b.x+b.w/2,b.y,"n");      mk(b.x+b.w,b.y,"ne");
    mk(b.x,b.y+b.h/2,"w");                                mk(b.x+b.w,b.y+b.h/2,"e");
    mk(b.x,b.y+b.h,"sw");    mk(b.x+b.w/2,b.y+b.h,"s");  mk(b.x+b.w,b.y+b.h,"se");
  }
  const ry=b.y-(IS_TOUCH?38:30)/view.k;
  g.appendChild(svgel("line",{x1:cx,y1:b.y,x2:cx,y2:ry,stroke:"#FFC02E","stroke-width":lwv,opacity:.75}));
  const knob=svgel("circle",{cx,cy:ry,r:hs*1.05,fill:"#FFC02E",stroke:"#221a02","stroke-width":lwv});
  knob.setAttribute("data-h","rot"); knob.setAttribute("class","bgh"); g.appendChild(knob);
}
function drawBackground(){
  const b=bounds(); bg.setAttribute("width",b.maxx); bg.setAttribute("height",b.maxy); bg.setAttribute("viewBox",`0 0 ${b.maxx} ${b.maxy}`);
  const frag=document.createDocumentFragment();
  (data.bg||[]).forEach((it,idx)=>renderBgItem(it,idx,frag));
  if(bgDraw){
    if(bgDraw.tool==="rect") frag.appendChild(svgel("rect",{x:Math.min(bgDraw.x0,bgDraw.x),y:Math.min(bgDraw.y0,bgDraw.y),
      width:Math.abs(bgDraw.x-bgDraw.x0),height:Math.abs(bgDraw.y-bgDraw.y0),rx:6,fill:"rgba(255,192,46,.08)",stroke:"#FFC02E","stroke-width":2,"stroke-dasharray":"6 5"}));
    else frag.appendChild(svgel("line",{x1:bgDraw.x0,y1:bgDraw.y0,x2:bgDraw.x,y2:bgDraw.y,stroke:"#FFC02E","stroke-width":3,"stroke-dasharray":"6 5"}));
  }
  if(bgGuides && bgGuides.length){
    const gw=Math.max(1,1.4/view.k), dash=`${7/view.k} ${5/view.k}`;
    bgGuides.forEach(g=>{
      if(g.x!=null) frag.appendChild(svgel("line",{x1:g.x,y1:0,x2:g.x,y2:b.maxy,stroke:"#FF4FA3","stroke-width":gw,"stroke-dasharray":dash}));
      if(g.y!=null) frag.appendChild(svgel("line",{x1:0,y1:g.y,x2:b.maxx,y2:g.y,stroke:"#FF4FA3","stroke-width":gw,"stroke-dasharray":dash}));
    });
  }
  if(bgEditing && bgSel!=null && data.bg[bgSel]) bgHandles(data.bg[bgSel],frag);
  bg.innerHTML=""; bg.appendChild(frag);
}

function tileKey(i){ return "t"+i; }
function renderTiles(){
  canvas.querySelectorAll(".tile").forEach(n=>n.remove());
  tileEls.clear();
  const q=($("#q").value||"").trim();
  const frag=document.createDocumentFragment();
  // Resolved up front: inside the loop `t` is the tile, not the translator.
  const LBL={color:esc(t("tile.changeColor")), sku:esc(t("tile.editSku")),
             size:esc(t("tile.resize")), del:esc(t("tile.remove"))};
  data.tiles.forEach((t,i)=>{
    const d=document.createElement("div");
    d.className="tile"; d.dataset.i=i;
    const tc=t.c||color(t.g);
    d.style.cssText=`left:${t.x}px;top:${t.y}px;width:${t.w||TW}px;height:${t.h||TH}px;background:${tc}`;
    d.title=t.sku+"  ·  "+groupName(t.g);
    d.innerHTML=`<span>${hl(t.sku,q)}</span>`+
      `<div class="abadge"></div>`+
      `<input type="color" class="colorchip" value="${tc}" title="${LBL.color}" />`+
      `<div class="ren" title="${LBL.sku}">✎</div>`+
      `<div class="rz" title="${LBL.size}"></div>`+
      `<div class="del" title="${LBL.del}">×</div>`;
    if(selection.has(i)) d.classList.add("sel");
    frag.appendChild(d);
    tileEls.set(i,d);
  });
  canvas.appendChild(frag);
  highlightSearch();
  applyAlertMarks();
  renderAlertPins();
}
function render(){ drawBackground(); renderTiles(); applyView(); }

function applyView(){ canvas.style.transform=`translate(${view.tx}px,${view.ty}px) scale(${view.k})`; }
function contentBounds(){ const b=bounds(); return {w:b.maxx, h:b.maxy}; }
function fit(){
  const b=contentBounds(), r=stage.getBoundingClientRect();
  const k=Math.min(r.width/b.w, r.height/b.h)*0.97;
  view.k=Math.max(0.12, Math.min(k,1.2));
  view.tx=(r.width - b.w*view.k)/2;
  view.ty=Math.max(10,(r.height - b.h*view.k)/2);
  applyView();
}
function clampK(k){ return Math.max(0.12, Math.min(5, k)); }
function zoomAt(cx,cy,f){
  const r=stage.getBoundingClientRect(); const px=cx-r.left, py=cy-r.top;
  const nk=clampK(view.k*f), ratio=nk/view.k;
  view.tx=px-(px-view.tx)*ratio; view.ty=py-(py-view.ty)*ratio; view.k=nk; applyView();
}
$("#zin").onclick=()=>{const r=stage.getBoundingClientRect();zoomAt(r.left+r.width/2,r.top+r.height/2,1.25);};
$("#zout").onclick=()=>{const r=stage.getBoundingClientRect();zoomAt(r.left+r.width/2,r.top+r.height/2,.8);};
$("#fit").onclick=fit;
stage.addEventListener("wheel",e=>{e.preventDefault();zoomAt(e.clientX,e.clientY,e.deltaY<0?1.12:.89);},{passive:false});

let pointers=new Map(), pinch=0;
let panning=false, panStart=null, didPan=false;
let tileDrag=null, bandDrag=null, resizeDrag=null;
let bgEditing=false, bgTool="select", bgSel=null, bgDraw=null, bgMove=null, bgResize=null, bgRotate=null;
let flashFlex=null;
const flexZones=()=>(data.bg||[]).map((it,idx)=>({it,idx})).filter(o=>o.it.kind==="flex");
const SHAPE_TOOLS=["rect","ellipse","diamond","triangle"];

function toCanvas(cx,cy){ const r=stage.getBoundingClientRect(); return {x:(cx-r.left-view.tx)/view.k, y:(cy-r.top-view.ty)/view.k}; }
function dist2(){const p=[...pointers.values()];return Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}
function cen2(){const p=[...pointers.values()];return{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};}

stage.addEventListener("pointerdown",e=>{
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){ pinch=dist2(); panning=false; tileDrag=null; bandDrag=null; resizeDrag=null; bgDraw=bgMove=bgResize=bgRotate=null; return; }
  if(bgEditing){ bgPointerDown(e); return; }
  
  if(e.target.closest(".colorchip")) return;
  if(e.target.closest(".ren")) return;   // pencil handled on click
  const rzEl=e.target.closest(".rz");
  if(rzEl && editing){ startResize(rzEl.closest(".tile"),e); return; }
  
  const tileEl=e.target.closest(".tile");
  // Edit logic: Only allow moving if Editing is enabled!
  if(tileEl && !e.target.closest(".del")){ 
      if(editing) {
          startTileDrag(tileEl,e); return; 
      }
  }
  
  if(e.target.closest(".del")) return;
  
  if(editing){ // edit mode: empty drag = box select
    bandDrag={x0:e.clientX,y0:e.clientY,add:e.shiftKey};
    band.style.display="block"; updateBand(e.clientX,e.clientY);
    stage.setPointerCapture(e.pointerId); return;
  }
  
  // View mode fallback: pan map
  panning=true; didPan=false; panStart={x:e.clientX,y:e.clientY,tx:view.tx,ty:view.ty}; stage.classList.add("grabbing");
});

stage.addEventListener("pointermove",e=>{
  if(pointers.has(e.pointerId)) pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){ const d=dist2(); if(pinch){const c=cen2();zoomAt(c.x,c.y,d/pinch);} pinch=d; return; }
  if(bgEditing && (bgDraw||bgMove||bgResize||bgRotate||panning)){ bgPointerMove(e); return; }
  if(resizeDrag){ moveResize(e); return; }
  if(tileDrag){ moveTileDrag(e); return; }
  if(bandDrag){ updateBand(e.clientX,e.clientY); return; }
  if(panning){ 
    if(Math.abs(e.clientX-panStart.x)>5 || Math.abs(e.clientY-panStart.y)>5) didPan=true;
    view.tx=panStart.tx+(e.clientX-panStart.x); view.ty=panStart.ty+(e.clientY-panStart.y); applyView(); 
  }
});

function endPointer(e){
  pointers.delete(e.pointerId); if(pointers.size<2) pinch=0;
  if(bgEditing && (bgDraw||bgMove||bgResize||bgRotate)){ bgPointerUp(e); }
  if(resizeDrag){ endResize(e); }
  if(tileDrag){ endTileDrag(e); }
  if(bandDrag){ endBand(e); }
  panning=false; stage.classList.remove("grabbing");
}
stage.addEventListener("pointerup",endPointer);
stage.addEventListener("pointercancel",endPointer);

function startTileDrag(tileEl,e){
  const i=+tileEl.dataset.i; e.stopPropagation();
  if(!selection.has(i)){ clearSelection(); }
  const ids = selection.size && selection.has(i) ? [...selection] : [i];
  tileDrag={ ids, startX:e.clientX, startY:e.clientY, moved:false,
    origins: ids.map(id=>({id, x:data.tiles[id].x, y:data.tiles[id].y})), lead:i };
  stage.setPointerCapture(e.pointerId);
}
function moveTileDrag(e){
  const dxw=(e.clientX-tileDrag.startX)/view.k, dyw=(e.clientY-tileDrag.startY)/view.k;
  if(!tileDrag.moved){ if(Math.abs(e.clientX-tileDrag.startX)+Math.abs(e.clientY-tileDrag.startY)<4) return; tileDrag.moved=true; }
  tileDrag.origins.forEach(o=>{
    const el=tileEls.get(o.id); if(!el) return;
    el.style.left=(o.x+dxw)+"px"; el.style.top=(o.y+dyw)+"px";
  });
}
function endTileDrag(e){
  const drag=tileDrag; tileDrag=null;
  if(!drag.moved){                       // a tap (no drag)
    if(editing){ selection.clear(); selection.add(drag.lead); paintSelection(); }  // select it → reveals its controls (color, size, ✎, ×)
    else flashTile(drag.lead);
    return;
  }
  const dxw=(e.clientX-drag.startX)/view.k, dyw=(e.clientY-drag.startY)/view.k;
  drag.origins.forEach(o=>{
    let nx=o.x+dxw, ny=o.y+dyw;
    if(snap){ nx=Math.round(nx/12)*12; ny=Math.round(ny/12)*12; }
    data.tiles[o.id].x=Math.round(nx); data.tiles[o.id].y=Math.round(ny);
    const el=tileEls.get(o.id); if(el){ el.style.left=data.tiles[o.id].x+"px"; el.style.top=data.tiles[o.id].y+"px"; }
  });
  save();
  toast(drag.ids.length>1 ? t("tile.movedN",{n:drag.ids.length}) : t("tile.moved",{sku:data.tiles[drag.lead].sku}));
}
function flashTile(i){ const el=tileEls.get(i); if(el){ el.classList.add("match"); setTimeout(()=>el.classList.remove("match"),1300); } }

function startResize(tileEl,e){
  const i=+tileEl.dataset.i; e.stopPropagation(); const t=data.tiles[i];
  resizeDrag={ i, el:tileEl, startX:e.clientX, startY:e.clientY, w0:t.w||TW, h0:t.h||TH, w:t.w||TW, h:t.h||TH };
  stage.setPointerCapture(e.pointerId);
}
function moveResize(e){
  let w=resizeDrag.w0+(e.clientX-resizeDrag.startX)/view.k;
  let h=resizeDrag.h0+(e.clientY-resizeDrag.startY)/view.k;
  w=Math.max(22,w); h=Math.max(18,h);
  if(snap){ w=Math.round(w/12)*12; h=Math.round(h/12)*12; }
  resizeDrag.w=w; resizeDrag.h=h;
  resizeDrag.el.style.width=w+"px"; resizeDrag.el.style.height=h+"px";
}
function endResize(){
  const r=resizeDrag; resizeDrag=null;
  const w=Math.round(r.w), h=Math.round(r.h);
  const ids=(selection.size>1 && selection.has(r.i)) ? [...selection] : [r.i];
  ids.forEach(id=>{ data.tiles[id].w=w; data.tiles[id].h=h;
    const el=tileEls.get(id); if(el){ el.style.width=w+"px"; el.style.height=h+"px"; } });
  save();
  toast(ids.length>1 ? t("tile.resizedN",{n:ids.length,w,h}) : t("tile.resized",{sku:data.tiles[r.i].sku,w,h}));
}

canvas.addEventListener("input",e=>{
  if(!e.target.classList.contains("colorchip")) return;
  const i=+e.target.closest(".tile").dataset.i, c=e.target.value;
  const ids=(selection.size>1 && selection.has(i)) ? [...selection] : [i];
  ids.forEach(id=>{ data.tiles[id].c=c; const el=tileEls.get(id); if(el) el.style.background=c; });
  save();
});

function updateBand(x,y){
  const r=stage.getBoundingClientRect();
  const l=Math.min(x,bandDrag.x0)-r.left, t=Math.min(y,bandDrag.y0)-r.top;
  const w=Math.abs(x-bandDrag.x0), h=Math.abs(y-bandDrag.y0);
  band.style.left=l+"px"; band.style.top=t+"px"; band.style.width=w+"px"; band.style.height=h+"px";
  bandDrag.rect={l,t,w,h};
}
function endBand(e){
  band.style.display="none";
  const bd=bandDrag; bandDrag=null;
  if(!bd.rect || (bd.rect.w<5&&bd.rect.h<5)){ if(!bd.add) clearSelection(); return; }
  const p0=toCanvas(Math.min(e.clientX,bd.x0),Math.min(e.clientY,bd.y0));
  const p1=toCanvas(Math.max(e.clientX,bd.x0),Math.max(e.clientY,bd.y0));
  if(!bd.add) selection.clear();
  data.tiles.forEach((t,i)=>{ const cx=t.x+(t.w||TW)/2, cy=t.y+(t.h||TH)/2;
    if(cx>=p0.x&&cx<=p1.x&&cy>=p0.y&&cy<=p1.y) selection.add(i); });
  paintSelection();
  if(selection.size) toast(t("tile.selected",{n:selection.size}));
}
function paintSelection(){ tileEls.forEach((el,i)=>el.classList.toggle("sel",selection.has(i))); updateSelTool(); }
function clearSelection(){ selection.clear(); paintSelection(); }

function updateSelTool(){ const n=selection.size; const bar=$("#seltool");
  bar.classList.toggle("show", editing && !bgEditing && n>=1);
  $("#selCount").textContent=n; }
function alignSel(kind){
  if(selection.size<2) return; const ids=[...selection]; const T=ids.map(i=>data.tiles[i]);
  const w=t=>t.w||TW, h=t=>t.h||TH;
  const L=Math.min(...T.map(t=>t.x)), R=Math.max(...T.map(t=>t.x+w(t)));
  const Tp=Math.min(...T.map(t=>t.y)), B=Math.max(...T.map(t=>t.y+h(t)));
  const cx=(L+R)/2, cy=(Tp+B)/2;
  if(kind==="rowh"){ let order=ids.slice().sort((a,b)=>data.tiles[a].x-data.tiles[b].x); let x=L;
    order.forEach(i=>{ const t=data.tiles[i]; t.x=Math.round(x); t.y=Math.round(Tp); x+=w(t)+6; }); }
  else if(kind==="colv"){ let order=ids.slice().sort((a,b)=>data.tiles[a].y-data.tiles[b].y); let y=Tp;
    order.forEach(i=>{ const t=data.tiles[i]; t.y=Math.round(y); t.x=Math.round(L); y+=h(t)+6; }); }
  else ids.forEach(i=>{ const t=data.tiles[i];
    if(kind==="left") t.x=Math.round(L); else if(kind==="right") t.x=Math.round(R-w(t)); else if(kind==="cx") t.x=Math.round(cx-w(t)/2);
    else if(kind==="top") t.y=Math.round(Tp); else if(kind==="bottom") t.y=Math.round(B-h(t)); else if(kind==="cy") t.y=Math.round(cy-h(t)/2); });
  save(); renderTiles(); paintSelection();
  toast(t("tile.aligned",{n:ids.length}));
}
function colorSel(c){ if(!selection.size) return; selection.forEach(i=>{ data.tiles[i].c=c; const el=tileEls.get(i); if(el) el.style.background=c; }); save(); }
function sameSizeSel(){ if(selection.size<2) return; const ids=[...selection]; const f=data.tiles[ids[0]]; const w=f.w||TW,h=f.h||TH;
  ids.forEach(i=>{ data.tiles[i].w=w; data.tiles[i].h=h; }); save(); renderTiles(); paintSelection(); toast(t("tile.unified",{w,h})); }

canvas.addEventListener("click",e=>{
  const ren=e.target.closest(".ren");
  if(ren){ e.stopPropagation(); if(!canEdit()) return; renameTile(+ren.closest(".tile").dataset.i); return; }
  const del=e.target.closest(".del");
  if(del){
    e.stopPropagation(); if(!canEdit()) return;
    const i=+del.closest(".tile").dataset.i; const sku=data.tiles[i].sku;
    data.tiles.splice(i,1); selection.clear(); save(); render(); toast(t("tile.removed",{sku}));
    return;
  }
  const pin=e.target.closest(".apin");
  if(pin){ e.stopPropagation(); openAlertsPanel(pin.dataset.aid); return; }

  // View mode: a plain tap on a tile opens its report sheet.
  if(!editing && !bgEditing && !didPan && !picking){
    const tile=e.target.closest(".tile");
    if(tile) openTileReport(+tile.dataset.i);
  }
});
function renameTile(i){
  const tile=data.tiles[i]; if(!tile) return;
  const v=prompt(t("tile.renamePrompt"), tile.sku); if(v==null) return;
  const sku=v.trim().toUpperCase();
  if(!sku){ toast(t("tile.skuEmpty")); return; }
  const dup=data.tiles.some((x,j)=>j!==i && x.sku.toUpperCase()===sku);
  tile.sku=sku; save(); renderTiles(); paintSelection();
  toast(t("tile.skuSet",{sku})+(dup?t("tile.skuDup"):""));
}
canvas.addEventListener("dblclick",e=>{
  if(bgEditing){ const h=e.target.closest("[data-bi]"); if(h){ editBgLabel(+h.dataset.bi); } return; }
  if(!editing || !canEdit()) return; const tile=e.target.closest(".tile"); if(!tile) return;
  renameTile(+tile.dataset.i);
});
document.addEventListener("keydown",e=>{
  if(e.target.tagName==="INPUT") return;
  if((e.key==="Delete"||e.key==="Backspace") && bgEditing && bgSel!=null){
    e.preventDefault(); const it=data.bg[bgSel]; data.bg.splice(bgSel,1); bgSel=null; save(); drawBackground(); toast(t("bg.deleted")); return;
  }
  if((e.key==="Delete"||e.key==="Backspace") && selection.size && editing){
    e.preventDefault(); const ids=[...selection].sort((a,b)=>b-a); const n=ids.length;
    ids.forEach(i=>data.tiles.splice(i,1)); selection.clear(); save(); render(); toast(t("tile.removedN",{n}));
  }
  if(bgEditing && bgSel!=null && e.key.startsWith("Arrow")){
    e.preventDefault(); const st=e.shiftKey?10:1;
    const dx=(e.key==="ArrowLeft"?-st:e.key==="ArrowRight"?st:0), dy=(e.key==="ArrowUp"?-st:e.key==="ArrowDown"?st:0);
    data.bg[bgSel]=translateItem(data.bg[bgSel],dx,dy,true); save(); drawBackground(); updateInspector(); return;
  }
  if(bgEditing && bgSel!=null && (e.key==="d"||e.key==="D") && (e.ctrlKey||e.metaKey)){ e.preventDefault(); duplicateBg(); return; }
  if(e.key==="Escape"){ if(bgEditing){ bgSel=null; drawBackground(); updateInspector(); } clearSelection(); }
});

function bgPointerDown(e){
  const w=toCanvas(e.clientX,e.clientY);
  if(bgTool==="label"){ const txt=prompt(t("bg.labelPrompt")); if(txt&&txt.trim()){ data.bg.push({type:"label",x:Math.round(w.x),y:Math.round(w.y),text:txt.trim(),size:22}); bgSel=data.bg.length-1; save(); drawBackground(); } return; }
  if(bgTool==="door"){ const lb=prompt(t("bg.doorPrompt"),"#"); data.bg.push({type:"door",x:Math.round(w.x),y:Math.round(w.y),label:(lb||"").replace(/^DOOR\s*/i,"")||"#",vert:false}); bgSel=data.bg.length-1; save(); drawBackground(); return; }
  if(SHAPE_TOOLS.includes(bgTool)||bgTool==="line"){ bgDraw={tool:bgTool,x0:w.x,y0:w.y,x:w.x,y:w.y}; stage.setPointerCapture(e.pointerId); return; }
  const hEl=e.target.closest("[data-h]");
  if(hEl && bgSel!=null){
    const orig=JSON.parse(JSON.stringify(data.bg[bgSel]));
    if(hEl.dataset.h==="rot") bgRotate={orig};
    else bgResize={h:hEl.dataset.h, start:w, orig};
    stage.setPointerCapture(e.pointerId); return;
  }
  const hit=e.target.closest("[data-bi]");
  if(hit){ bgSel=+hit.dataset.bi; bgMove={start:w, orig:JSON.parse(JSON.stringify(data.bg[bgSel]))};
    showInspector(true); drawBackground(); updateInspector(); stage.setPointerCapture(e.pointerId); return; }
  bgSel=null; drawBackground(); updateInspector();
  panning=true; panStart={x:e.clientX,y:e.clientY,tx:view.tx,ty:view.ty}; stage.classList.add("grabbing");
}
function bgPointerMove(e){
  const w=toCanvas(e.clientX,e.clientY);
  if(bgDraw){ bgDraw.x=w.x; bgDraw.y=w.y; drawBackground(); return; }
  if(bgRotate){ data.bg[bgSel]=rotateItem(bgRotate.orig,w.x,w.y,e.shiftKey); drawBackground(); updateInspector(); return; }
  if(bgMove){
    const dx=w.x-bgMove.start.x, dy=w.y-bgMove.start.y;
    const moved=translateItem(bgMove.orig,dx,dy);
    const r=alignSnap(moved,bgSel);
    bgGuides=r.guides; data.bg[bgSel]=r.it; drawBackground(); return;
  }
  if(bgResize){ data.bg[bgSel]=resizeItem(bgResize.orig,bgResize.h,w.x,w.y); drawBackground(); updateInspector(); return; }
  if(panning){ view.tx=panStart.tx+(e.clientX-panStart.x); view.ty=panStart.ty+(e.clientY-panStart.y); applyView(); }
}
function bgPointerUp(e){
  if(bgDraw){ const d=bgDraw; bgDraw=null;
    if(Math.abs(d.x-d.x0)+Math.abs(d.y-d.y0)>6){
      if(SHAPE_TOOLS.includes(d.tool)) data.bg.push({type:"rect",shape:d.tool,x:Math.round(Math.min(d.x0,d.x)),y:Math.round(Math.min(d.y0,d.y)),w:Math.round(Math.abs(d.x-d.x0)),h:Math.round(Math.abs(d.y-d.y0)),label:"",kind:"box"});
      else data.bg.push({type:"line",x1:Math.round(d.x0),y1:Math.round(d.y0),x2:Math.round(d.x),y2:Math.round(d.y)});
      bgSel=data.bg.length-1; save(); setBgTool("select");
    }
    drawBackground(); updateInspector(); return;
  }
  if(bgMove){ bgMove=null; bgGuides=[]; save(); drawBackground(); updateInspector(); }
  if(bgResize){ bgResize=null; save(); updateInspector(); }
  if(bgRotate){ bgRotate=null; save(); updateInspector(); }
}
function translateItem(o,dx,dy,raw){ const it=JSON.parse(JSON.stringify(o));
  if(snap && !raw){ dx=Math.round(dx/12)*12; dy=Math.round(dy/12)*12; }
  dx=Math.round(dx); dy=Math.round(dy);
  if(it.type==="rect"){ it.x+=dx; it.y+=dy; }
  else if(it.type==="line"){ it.x1+=dx; it.y1+=dy; it.x2+=dx; it.y2+=dy; }
  else if(it.type==="circle"){ it.cx+=dx; it.cy+=dy; }
  else if(it.type==="door"||it.type==="label"){ it.x+=dx; it.y+=dy; }
  else if(it.type==="poly"){ it.pts=it.pts.map(p=>[p[0]+dx,p[1]+dy]); }
  return it;
}
function resizeItem(o,handle,wx,wy){
  const it=JSON.parse(JSON.stringify(o));
  if(it.type==="line"){
    let x=Math.round(wx), y=Math.round(wy);
    if(snap){ x=Math.round(x/12)*12; y=Math.round(y/12)*12; }
    if(handle==="p1"){ it.x1=x; it.y1=y; } else if(handle==="p2"){ it.x2=x; it.y2=y; }
    return it;
  }
  const b=itemBox(o);
  const cx=b.x+b.w/2, cy=b.y+b.h/2;
  const rot=(+o.rot||0)*Math.PI/180;
  const dx=wx-cx, dy=wy-cy;
  const lx=cx+dx*Math.cos(-rot)-dy*Math.sin(-rot);
  const ly=cy+dx*Math.sin(-rot)+dy*Math.cos(-rot);
  let x0=b.x, y0=b.y, x1=b.x+b.w, y1=b.y+b.h;
  if(handle.includes("w")) x0=lx;
  if(handle.includes("e")) x1=lx;
  if(handle.includes("n")) y0=ly;
  if(handle.includes("s")) y1=ly;
  if(snap){ x0=Math.round(x0/12)*12; y0=Math.round(y0/12)*12; x1=Math.round(x1/12)*12; y1=Math.round(y1/12)*12; }
  let nx=Math.min(x0,x1), ny=Math.min(y0,y1);
  let nw=Math.max(12,Math.abs(x1-x0)), nh=Math.max(12,Math.abs(y1-y0));
  const ncx=nx+nw/2, ncy=ny+nh/2;
  const ddx=ncx-cx, ddy=ncy-cy;
  const wcx=cx+ddx*Math.cos(rot)-ddy*Math.sin(rot);
  const wcy=cy+ddx*Math.sin(rot)+ddy*Math.cos(rot);
  if(it.type==="circle"){
    it.r=Math.max(8,Math.round(Math.min(nw,nh)/2));
    it.cx=Math.round(wcx); it.cy=Math.round(wcy);
  } else if(it.type==="rect"){
    it.w=Math.round(nw); it.h=Math.round(nh);
    it.x=Math.round(wcx-nw/2); it.y=Math.round(wcy-nh/2);
  }
  return it;
}
function rotateItem(o,wx,wy,fine){
  const it=JSON.parse(JSON.stringify(o));
  const b=itemBox(o), cx=b.x+b.w/2, cy=b.y+b.h/2;
  let a=Math.atan2(wy-cy,wx-cx)*180/Math.PI+90;
  if(!fine) a=Math.round(a/15)*15;
  it.rot=Math.round(((a%360)+360)%360);
  return it;
}
let bgGuides=[];
function alignSnap(it,skipIdx){
  const b=itemBox(it); if(!b.w&&!b.h) return {it,guides:[]};
  const th=9/view.k, guides=[];
  const xs=[],ys=[];
  (data.bg||[]).forEach((o,i)=>{ if(i===skipIdx) return; const ob=itemBox(o);
    if(!isFinite(ob.x)) return;
    xs.push(ob.x,ob.x+ob.w/2,ob.x+ob.w); ys.push(ob.y,ob.y+ob.h/2,ob.y+ob.h); });
  const mineX=[b.x,b.x+b.w/2,b.x+b.w], mineY=[b.y,b.y+b.h/2,b.y+b.h];
  let bx=null,by=null;
  mineX.forEach(m=>xs.forEach(t=>{ const d=t-m; if(Math.abs(d)<th && (bx===null||Math.abs(d)<Math.abs(bx.d))) bx={d,t}; }));
  mineY.forEach(m=>ys.forEach(t=>{ const d=t-m; if(Math.abs(d)<th && (by===null||Math.abs(d)<Math.abs(by.d))) by={d,t}; }));
  if(bx){ guides.push({x:bx.t}); }
  if(by){ guides.push({y:by.t}); }
  if(bx||by) it=translateItem(it, bx?bx.d:0, by?by.d:0, true);
  return {it,guides};
}
function editBgLabel(idx){ const it=data.bg[idx]; if(!it) return; bgSel=idx;
  const cur = it.type==="label"?it.text : (it.type==="door"?it.label : (it.label||""));
  const v=prompt("Label text (blank to clear):", cur); if(v==null){ drawBackground(); return; }
  if(it.type==="label") it.text=v.trim()||"label"; else if(it.type==="door") it.label=v.trim().replace(/^DOOR\s*/i,"")||"#"; else it.label=v.trim();
  save(); drawBackground();
}
function setBgTool(t){ bgTool=t; document.querySelectorAll(".bgbar [data-tool]").forEach(b=>b.classList.toggle("on",b.dataset.tool===t)); }

const SHAPE_LABEL={rect:"Rectangle",ellipse:"Ellipse",diamond:"Diamond",triangle:"Triangle"};
function rgbaToHex(c){
  if(!c) return null;
  if(c[0]==="#") return c.length===4? "#"+c[1]+c[1]+c[2]+c[2]+c[3]+c[3] : c.slice(0,7);
  const m=String(c).match(/rgba?\(([^)]+)\)/); if(!m) return null;
  const p=m[1].split(",").map(v=>parseFloat(v));
  const h=n=>Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,"0");
  return "#"+h(p[0])+h(p[1])+h(p[2]);
}
function alphaOf(c){ const m=String(c||"").match(/rgba\(([^)]+)\)/); if(!m) return 1;
  const p=m[1].split(","); return p.length>3? Math.max(0,Math.min(1,parseFloat(p[3]))) : 1; }
function showInspector(on){ $("#insp").classList.toggle("show", !!on); }
function inspOpen(){ return $("#insp").classList.contains("show"); }
function updateInspector(){
  if(!inspOpen()) return;
  const it = (bgSel!=null) ? data.bg[bgSel] : null;
  $("#iEmpty").style.display = it? "none":"block";
  $("#iForm").style.display  = it? "block":"none";
  if(!it) { $("#iTitle").textContent="Shape"; $("#iKind").textContent="—"; return; }
  const isBox = it.type==="rect", isLine=it.type==="line", isText=it.type==="label",
        isDoor= it.type==="door", isCirc=it.type==="circle", isPoly=it.type==="poly";
  $("#iTitle").textContent = isBox? (SHAPE_LABEL[it.shape||"rect"]) :
    isLine?"Line": isText?"Text": isDoor?"Door": isCirc?"Circle":"Outline";
  $("#iKind").textContent = it.kind||it.type;
  const s=styleFor(it);
  const show=(id,v)=>{ const el=$(id); if(el) el.style.display = v? "flex":"none"; };
  show("#rowShape", isBox);
  show("#rowFill",  isBox||isCirc||isPoly);
  show("#rowStroke",true);
  show("#rowDash",  true);
  show("#rowRx",    isBox && (it.shape||"rect")==="rect");
  show("#rowRot",   !isLine && !isPoly);
  show("#rowSize",  isBox||isCirc);
  show("#rowLabel", !isPoly);
  show("#rowTsize", isText||isBox||isDoor);
  
  document.querySelectorAll("#shapeChips button").forEach(b=>b.classList.toggle("on", isBox && (it.shape||"rect")===b.dataset.shape));
  const fhex=rgbaToHex(it.fill!=null?it.fill:s.fill)||"#2b3542";
  $("#iFill").value=fhex;
  const op = it.op!=null? it.op : alphaOf(it.fill!=null?it.fill:s.fill);
  $("#iOp").value=Math.round(op*100); $("#iOpV").textContent=Math.round(op*100)+"%";
  
  $("#iStroke").value=rgbaToHex(it.stroke!=null?it.stroke:s.stroke)||"#39434f";
  const swv = it.sw!=null? it.sw : s.sw;
  $("#iSw").value=swv; $("#iSwV").textContent=swv;
  
  const dashKey = it.dash|| (s.dash? (s.dash==="2 7"?"dotted":"dashed") : "solid");
  document.querySelectorAll("#dashChips button").forEach(b=>b.classList.toggle("on", b.dataset.dash===dashKey));
  
  const rxv = it.rx!=null? it.rx : s.rx; $("#iRx").value=rxv; $("#iRxV").textContent=rxv;
  const rv=+it.rot||0; $("#iRot").value=rv; $("#iRotN").value=rv;
  const bb=itemBox(it); $("#iW").value=Math.round(isCirc? it.r*2 : (it.w||bb.w)); $("#iH").value=Math.round(isCirc? it.r*2 : (it.h||bb.h));
  $("#iLabel").value = isText? (it.text||"") : (it.label||"");
  const tsv = isText? (it.size||20) : (it.lsize!=null? it.lsize : s.lsize);
  $("#iTs").value=tsv; $("#iTsV").textContent=tsv;
}
function inspSet(fn){
  if(bgSel==null||!data.bg[bgSel]) return;
  fn(data.bg[bgSel]); save(); drawBackground();
}
function bindInsp(){
  $("#iClose").onclick=()=>showInspector(false);
  $("#bgPropBtn").onclick=()=>{ showInspector(!inspOpen()); updateInspector(); };
  document.querySelectorAll("#shapeChips button").forEach(b=>b.onclick=()=>{
    inspSet(it=>{
      if(it.type!=="rect"){                    
        const bb=itemBox(it);
        it.x=Math.round(bb.x); it.y=Math.round(bb.y);
        it.w=Math.max(12,Math.round(bb.w)); it.h=Math.max(12,Math.round(bb.h));
        delete it.pts; delete it.closed; delete it.cx; delete it.cy; delete it.r;
        delete it.x1; delete it.y1; delete it.x2; delete it.y2;
        if(!it.kind) it.kind="box";
        it.type="rect";
      }
      it.shape=b.dataset.shape;
    });
    updateInspector(); toast("Shape → "+SHAPE_LABEL[b.dataset.shape]); });
  document.querySelectorAll("#dashChips button").forEach(b=>b.onclick=()=>{
    inspSet(it=>it.dash=b.dataset.dash); updateInspector(); });
  const applyFill=()=>{ const hex=$("#iFill").value, op=+$("#iOp").value/100;
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),bl=parseInt(hex.slice(5,7),16);
    inspSet(it=>{ it.fill=`rgba(${r},${g},${bl},${op})`; delete it.op; });
    $("#iOpV").textContent=Math.round(op*100)+"%"; };
  $("#iFill").addEventListener("input",applyFill);
  $("#iOp").addEventListener("input",applyFill);
  $("#iStroke").addEventListener("input",()=>inspSet(it=>it.stroke=$("#iStroke").value));
  $("#iSw").addEventListener("input",()=>{ const v=+$("#iSw").value; $("#iSwV").textContent=v; inspSet(it=>it.sw=v); });
  $("#iRx").addEventListener("input",()=>{ const v=+$("#iRx").value; $("#iRxV").textContent=v; inspSet(it=>it.rx=v); });
  const setRot=v=>{ v=((Math.round(v)%360)+360)%360; $("#iRot").value=v; $("#iRotN").value=v; inspSet(it=>it.rot=v); };
  $("#iRot").addEventListener("input",e=>setRot(+e.target.value));
  $("#iRotN").addEventListener("change",e=>setRot(+e.target.value||0));
  $("#iRot90").onclick=()=>setRot((+$("#iRot").value||0)+90);
  const setSize=()=>{ const w=Math.max(8,+$("#iW").value||8), h=Math.max(8,+$("#iH").value||8);
    inspSet(it=>{ if(it.type==="circle") it.r=Math.round(Math.min(w,h)/2); else { it.w=Math.round(w); it.h=Math.round(h); } }); };
  $("#iW").addEventListener("change",setSize); $("#iH").addEventListener("change",setSize);
  $("#iLabel").addEventListener("input",()=>{ const v=$("#iLabel").value;
    inspSet(it=>{ if(it.type==="label") it.text=v; else if(it.type==="door") it.label=v.replace(/^DOOR\s*/i,""); else it.label=v; }); });
  $("#iTs").addEventListener("input",()=>{ const v=+$("#iTs").value; $("#iTsV").textContent=v;
    inspSet(it=>{ if(it.type==="label") it.size=v; else it.lsize=v; }); });
  $("#iDup").onclick=()=>duplicateBg();
  $("#iFront").onclick=()=>zOrder(1);
  $("#iBack").onclick=()=>zOrder(-1);
  $("#iDel").onclick=()=>{ if(bgSel==null) return; data.bg.splice(bgSel,1); bgSel=null; save(); drawBackground(); updateInspector(); toast("Deleted shape"); };
}
function duplicateBg(){
  if(bgSel==null||!data.bg[bgSel]) return;
  const copy=translateItem(JSON.parse(JSON.stringify(data.bg[bgSel])),24,24,true);
  data.bg.push(copy); bgSel=data.bg.length-1; save(); drawBackground(); updateInspector(); toast("Duplicated");
}
function zOrder(dir){
  if(bgSel==null) return;
  const it=data.bg.splice(bgSel,1)[0];
  if(dir>0){ data.bg.push(it); bgSel=data.bg.length-1; } else { data.bg.unshift(it); bgSel=0; }
  save(); drawBackground(); updateInspector(); toast(dir>0?t("bg.front"):t("bg.back"));
}
$("#addBtn").onclick=()=>{
  if(!canEdit()){ toast(t("session.noPermission")); return; }
  const v=prompt(t("tile.addPrompt")); if(!v) return;
  const sku=v.trim().toUpperCase(); if(!sku) return;
  const r=stage.getBoundingClientRect(); const c=toCanvas(r.left+r.width/2, r.top+r.height/2);
  data.tiles.push({sku, x:Math.round(c.x-TW/2), y:Math.round(c.y-TH/2), g:"X"});
  save(); render(); toast(t("tile.added",{sku}));
  closeDrawer();
};

const qInput=$("#q"), resultsBox=$("#results"), clrBtn=$("#clr");
let currentResults=[], activeIdx=-1;
let searchTimeout = null;

qInput.addEventListener("input",() => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(onSearch, 300);
});
qInput.addEventListener("focus",()=>{ if(qInput.value.trim()) onSearch(); });
qInput.addEventListener("keydown",e=>{
  if(e.key==="ArrowDown"){e.preventDefault();activeIdx=Math.min(activeIdx+1,currentResults.length-1);paintActive();}
  else if(e.key==="ArrowUp"){e.preventDefault();activeIdx=Math.max(activeIdx-1,0);paintActive();}
  else if(e.key==="Enter"){ if(currentResults[activeIdx]) choose(currentResults[activeIdx]); }
  else if(e.key==="Escape"){ closeResults(); qInput.blur(); }
});
clrBtn.onclick=()=>{ qInput.value=""; onSearch(); qInput.focus(); };
document.addEventListener("click",e=>{ if(!e.target.closest(".search")) closeResults(); });

function onSearch(){
  const q=qInput.value.trim(); clrBtn.style.display=q?"block":"none"; highlightSearch();
  if(!q){ closeResults(); return; }
  const Q=q.toUpperCase(); const m=[];
  data.tiles.forEach((t,i)=>{ if(t.sku&&t.sku.toUpperCase().includes(Q)) m.push({sku:t.sku,i,g:t.g}); });
  // also scan flexible (MTO) zones — a match points to the AREA, not a tile
  flexZones().forEach(z=>{ (z.it.skus||[]).forEach(sku=>{ if(sku&&sku.toUpperCase().includes(Q))
    m.push({sku, flex:true, bi:z.idx, zone:z.it.label||"MTO"}); }); });
  m.sort((x,y)=>{ const xi=x.sku.toUpperCase().startsWith(Q)?0:1, yi=y.sku.toUpperCase().startsWith(Q)?0:1;
    if(xi!==yi) return xi-yi; return x.sku.localeCompare(y.sku,undefined,{numeric:true}); });
  currentResults=m.slice(0,80); activeIdx=m.length?0:-1; paintResults(m.length);
}
function paintResults(total){
  if(!currentResults.length){
    const hint = canEdit() ? t("search.noneHintEditor") : t("search.noneHintViewer");
    resultsBox.innerHTML=`<div class="rnone">${esc(t("search.none",{q:qInput.value.trim()}))}<br>${esc(hint)}</div>`;
    resultsBox.classList.add("show"); return;
  }
  const q=qInput.value.trim();
  resultsBox.innerHTML=`<div class="rhint">${esc(I18N.tn("search.matches",total))}</div>`+
    currentResults.map((r,i)=>{
      if(r.flex) return `<div class="ritem ${i===activeIdx?"active":""}" data-i="${i}">
        <div class="rb" style="background:#C98A2E">★</div>
        <div class="rtext"><div class="rsku">${hl(r.sku,q)}</div><div class="rloc">${esc(t("search.mtoLoc",{zone:r.zone}))}</div></div>
        <div class="arrow">→</div></div>`;
      return `<div class="ritem ${i===activeIdx?"active":""}" data-i="${i}">
        <div class="rb" style="background:${color(r.g)}">${esc(r.g)}</div>
        <div class="rtext"><div class="rsku">${hl(r.sku,q)}</div><div class="rloc">${esc(groupName(r.g))}</div></div>
        <div class="arrow">→</div></div>`;
    }).join("");
  resultsBox.classList.add("show");
  resultsBox.querySelectorAll(".ritem").forEach(it=>it.onclick=()=>choose(currentResults[+it.dataset.i]));
}
function paintActive(){ resultsBox.querySelectorAll(".ritem").forEach(it=>it.classList.toggle("active",+it.dataset.i===activeIdx));
  const a=resultsBox.querySelector(".ritem.active"); if(a) a.scrollIntoView({block:"nearest"}); }
function choose(r){ closeResults(); qInput.value=r.sku; highlightSearch();
  if(r.flex){ focusFlex(r.bi); toast(t("search.mtoToast",{sku:r.sku,zone:r.zone})); }
  else flyTo(r.i);
}
function focusFlex(bi){
  const it=data.bg[bi]; if(!it) return; const b=itemBox(it); const r=stage.getBoundingClientRect();
  view.k=clampK(Math.min(r.width/(b.w+240), r.height/(b.h+240), 1.1)); view.k=Math.max(view.k,.35);
  view.tx=r.width/2-(b.x+b.w/2)*view.k; view.ty=r.height/2-(b.y+b.h/2)*view.k; applyView();
  flashFlex=bi; drawBackground();
  clearTimeout(focusFlex._t); focusFlex._t=setTimeout(()=>{ flashFlex=null; drawBackground(); }, 2600);
}
function closeResults(){ resultsBox.classList.remove("show"); }

function highlightSearch(){
  const q=(qInput.value||"").trim().toUpperCase();
  tileEls.forEach((el,i)=>{ const hit=q && data.tiles[i].sku.toUpperCase().includes(q);
    el.classList.toggle("match",!!hit); el.classList.toggle("faded",!!q&&!hit); });
}
function flyTo(i){
  const t=data.tiles[i]; const r=stage.getBoundingClientRect(); const w=t.w||TW, h=t.h||TH;
  view.k=clampK(Math.max(0.6, Math.min(2.2, 380/Math.max(w,h))));
  view.tx=r.width/2-(t.x+w/2)*view.k; view.ty=r.height/2-(t.y+h/2)*view.k;
  applyView(); flashTile(i);
}

$("#editBtn").onclick=()=>{
  if(!canEdit()){ toast(t("session.noPermission")); return; }
  editing=!editing; if(editing && bgEditing) setBgEditing(false);
  document.body.classList.toggle("editing",editing);
  $("#editBtn").classList.toggle("on",editing); $("#editBadge").classList.toggle("show",editing);
  $("#addBtn").classList.toggle("on",false);
  stage.classList.toggle("selmode",editing);
  if(!editing) clearSelection(); else updateSelTool();
  toast(editing?t("edit.on"):t("edit.off"));
  closeDrawer();
};
function setBgEditing(on){
  bgEditing=on; bgSel=null; bgDraw=bgMove=bgResize=bgRotate=null; bgGuides=[];
  document.body.classList.toggle("bgedit",on);
  $("#bgBtn").classList.toggle("on",on); $("#bgbar").classList.toggle("show",on);
  if(on){
    if(editing){ editing=false; document.body.classList.remove("editing"); $("#editBtn").classList.remove("on"); $("#editBadge").classList.remove("show"); clearSelection(); }
    setBgTool("select");
  }
  showInspector(on); updateInspector();
  drawBackground();
  toast(on?t("bg.on"):t("bg.off"));
}
$("#bgBtn").onclick=()=>{ if(!canEdit()){ toast(t("session.noPermission")); return; } setBgEditing(!bgEditing); closeDrawer(); };
document.querySelectorAll(".bgbar [data-tool]").forEach(b=>b.onclick=()=>setBgTool(b.dataset.tool));
$("#bgDelBtn").onclick=()=>{ if(bgSel!=null){ data.bg.splice(bgSel,1); bgSel=null; save(); drawBackground(); updateInspector(); toast(t("bg.deleted")); } else toast(t("bg.selectFirst")); };
$("#bgResetBtn").onclick=()=>{ if(!confirm(t("bg.resetConfirm"))) return; data.bg=DEFAULT_BG(); bgSel=null; save(); drawBackground(); updateInspector(); toast(t("bg.wasReset")); };

document.querySelectorAll("#seltool [data-al]").forEach(b=>b.onclick=()=>alignSel(b.dataset.al));
$("#selColor").addEventListener("input",e=>colorSel(e.target.value));
$("#selSame").onclick=sameSizeSel;
$("#snapBtn").onclick=()=>{ snap=!snap; $("#snapBtn").classList.toggle("on",snap); toast(snap?t("snap.on"):t("snap.off")); };
$("#addGroupBtn").onclick=e=>{ e.stopPropagation(); addGroup(); };
$("#legendBtn").onclick=()=>{
  const l=$("#legend"); const show=!l.classList.contains("show");
  l.classList.toggle("show",show); $("#legendBtn").classList.toggle("on",show);
  if(show) buildLegend();
  closeDrawer();
};
function buildLegend(){
  if(!Array.isArray(data.groups)||!data.groups.length) ensureGroups(data);   
  const counts={}; data.tiles.forEach(t=>counts[t.g]=(counts[t.g]||0)+1);
  const rows=(data.groups||[]).map(g=>{
    const n=counts[g.id]||0;
    return `<div class="lrow" data-g="${esc(g.id)}">
      <input type="color" class="sw" value="${esc(g.color)}" title="Group color" />
      <span class="nm" title="${esc(g.name)}">${esc(g.name)}</span>
      <span class="ct">${n}</span>
      <span class="lacts">
        <button data-act="assign" title="${esc(t("legend.assign"))}">⤓</button>
        <button data-act="ren" title="${esc(t("legend.rename"))}">✎</button>
        <button data-act="del" title="${esc(t("legend.delete"))}">🗑</button>
      </span></div>`;
  }).join("");
  $("#legendBody").innerHTML = rows || `<div style="padding:14px;color:var(--muted);font-size:12px">${esc(t("legend.empty"))}</div>`;
  $("#legendBody").querySelectorAll(".lrow").forEach(row=>{
    const id=row.dataset.g;
    row.onclick=e=>{
      if(e.target.closest(".lacts")||e.target.classList.contains("sw")) return;
      selection.clear(); data.tiles.forEach((t,i)=>{ if(t.g===id) selection.add(i); });
      paintSelection();
      toast(selection.size? t("group.selected",{name:groupName(id),n:selection.size}) : t("group.emptyGroup"));
    };
    row.querySelector(".sw").addEventListener("input",e=>{
      const g=groupById(id); if(!g) return; g.color=e.target.value;
      data.tiles.forEach(t=>{ if(t.g===id) delete t.c; });   
      save(); renderTiles(); paintSelection();
    });
    row.querySelectorAll(".lacts button").forEach(b=>b.onclick=e=>{
      e.stopPropagation();
      const act=b.dataset.act;
      if(act==="ren") renameGroup(id);
      else if(act==="del") deleteGroup(id);
      else if(act==="assign") assignSelectionTo(id);
    });
  });
}
function addGroup(){
  if(!canEdit()){ toast(t("session.noPermission")); return; }
  const name=prompt(t("group.newPrompt")); if(name==null) return;
  const nm=name.trim(); if(!nm) return;
  const id=newGroupId();
  data.groups.push({id, name:nm, color:PALETTE[data.groups.length%PALETTE.length]});
  save(); buildLegend();
  toast(t("group.created",{name:nm}));
}
function renameGroup(id){
  const g=groupById(id); if(!g) return;
  const v=prompt(t("group.renamePrompt"), g.name); if(v==null) return;
  g.name=v.trim()||g.name; save(); buildLegend(); renderTiles(); toast(t("group.renamed",{name:g.name}));
}
function deleteGroup(id){
  const g=groupById(id); if(!g) return;
  const n=data.tiles.filter(t=>t.g===id).length;
  const others=data.groups.filter(x=>x.id!==id);
  if(!others.length){ toast(t("group.needOne")); return; }
  const fallback=(groupById("X") && id!=="X") ? "X" : others[0].id;
  if(!confirm(t("group.deleteConfirm",{name:g.name})+(n?"\n\n"+t("group.deleteMoves",{n,to:groupName(fallback)}):""))) return;
  data.tiles.forEach(t=>{ if(t.g===id){ t.g=fallback; delete t.c; } });
  data.groups=others;
  save(); renderTiles(); buildLegend(); paintSelection();
  toast(n? t("group.deletedMoved",{n,to:groupName(fallback)}) : t("group.deleted"));
}
function assignSelectionTo(id){
  if(!selection.size){ toast(t("group.selectFirst")); return; }
  const n=selection.size;
  selection.forEach(i=>{ data.tiles[i].g=id; delete data.tiles[i].c; });
  save(); renderTiles(); paintSelection(); buildLegend();
  toast(t("group.moved",{n,to:groupName(id)}));
}

$("#exportBtn").onclick=()=>{
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download="tarter-yard-map.json"; a.click(); URL.revokeObjectURL(url);
  toast(t("io.downloaded")); closeDrawer();
};
$("#importBtn").onclick=()=>{ if(!canEdit()){ toast(t("session.noPermission")); return; } $("#fileIn").click(); };
$("#fileIn").onchange=e=>{
  const f=e.target.files[0]; if(!f) return; const rd=new FileReader();
  rd.onload=()=>{
    try{
      const d=JSON.parse(rd.result); if(!Array.isArray(d.tiles)) throw 0;
      data=ensureGroups(d); if(!Array.isArray(data.bg)) data.bg=DEFAULT_BG();
      selection.clear(); save(); render(); fit(); rebuildSkuList(); toast(t("io.imported"));
    }catch(err){ toast(t("io.importFailed")); }
  };
  rd.readAsText(f); e.target.value=""; closeDrawer();
};

/* ===== Importar productos desde Excel/CSV (crea fichas en lote) ===== */
$("#xlsBtn").onclick=()=>{
  if(!canEdit()){ toast(t("session.noPermission")); return; }
  if(typeof XLSX==="undefined"){ toast(t("io.xlsMissing")); return; }
  $("#xlsFile").click();
};
// resolve a group by its id (single letter) or by name; create it if new
function resolveGroupRef(ref){
  const v=(ref==null?"":String(ref)).trim(); if(!v) return "IMP";
  let g=(data.groups||[]).find(x=>x.id.toLowerCase()===v.toLowerCase() || (x.name||"").toLowerCase()===v.toLowerCase());
  if(g) return g.id;
  const id=newGroupId();
  data.groups.push({id, name:v, color:PALETTE[data.groups.length%PALETTE.length]});
  return id;
}
function stageImportedTiles(rows){
  // ensure an "Importados" staging group exists
  if(!groupById("IMP")) data.groups.push({id:"IMP", name:"Importados", color:"#57A79B"});
  const startX=120, startY=120, per=14, PX=72, PY=44;
  let added=0, skipped=0;
  rows.forEach(r=>{
    const sku=(r.sku==null?"":String(r.sku)).trim();
    if(!sku){ skipped++; return; }
    const g = r.group ? resolveGroupRef(r.group) : "IMP";
    const col=added%per, row=Math.floor(added/per);
    const t={ sku, x:startX+col*PX, y:startY+row*PY, g };
    if(r.color && /^#?[0-9a-fA-F]{6}$/.test(String(r.color).trim())){ let c=String(r.color).trim(); if(c[0]!=="#") c="#"+c; t.c=c; }
    const w=parseFloat(r.w), h=parseFloat(r.h);
    if(w>0) t.w=Math.round(w); if(h>0) t.h=Math.round(h);
    data.tiles.push(t); added++;
  });
  if(!added){ toast(t("io.xlsNoColumn")); return; }
  save(); render(); rebuildSkuList();
  // pan to the staging area so the new tiles are visible
  const r=stage.getBoundingClientRect();
  view.k=clampK(0.8); view.tx=r.width/2-(startX+per*PX/2)*view.k; view.ty=140-startY*view.k; applyView();
  toast(t("io.xlsImported",{n:added})+(skipped?t("io.xlsSkipped",{n:skipped}):""));
}
$("#xlsFile").onchange=e=>{
  const f=e.target.files[0]; if(!f) return; const rd=new FileReader();
  rd.onload=()=>{
    try{
      const wb=XLSX.read(new Uint8Array(rd.result),{type:"array"});
      const shName = wb.SheetNames.find(n=>/produc/i.test(n)) || wb.SheetNames[0];
      const arr=XLSX.utils.sheet_to_json(wb.Sheets[shName],{defval:"",raw:false});
      const pick=(o,...keys)=>{ for(const k in o){ const kk=k.trim().toLowerCase(); if(keys.includes(kk)) return o[k]; } return ""; };
      const rows=arr.map(o=>({
        sku:   pick(o,"producto","product","sku","numero","número","item","código","codigo"),
        group: pick(o,"grupo","group","area","área","seccion","sección"),
        color: pick(o,"color","colour"),
        w:     pick(o,"ancho","width","w"),
        h:     pick(o,"alto","height","h","largo")
      })).filter(r=>{ const s=String(r.sku).trim(); return s && !s.startsWith("(") && s.toLowerCase()!=="producto"; }); // drop blank/hint/header rows
      if(!rows.length){ toast(t("io.xlsNoColumn")); return; }
      stageImportedTiles(rows);
    }catch(err){ console.error(err); toast(t("io.xlsUnreadable")); }
  };
  rd.readAsArrayBuffer(f); e.target.value="";
};

/* ===== Zonas flexibles (MTO / Especiales): lista de SKUs sin ficha ===== */
let mtoImportTarget=null;
function skuLinesToArray(text){
  return [...new Set(String(text).split(/[\n,;\t]+/).map(s=>s.trim()).filter(Boolean))];
}
function renderMtoModal(){
  const zones=flexZones();
  const body=$("#mtoBody");
  if(!zones.length){ body.innerHTML=`<div class="mtoempty">${t("mto.empty")}</div>`; return; }
  body.innerHTML=zones.map(z=>{
    const skus=z.it.skus||[];
    return `<div class="mtozone" data-bi="${z.idx}">
      <div class="mztop">
        <input class="mzname" value="${esc(z.it.label||"")}" placeholder="${esc(t("mto.namePh"))}" />
        <span class="mzcount">${esc(t("mto.skuCount",{n:skus.length}))}</span>
      </div>
      <textarea class="mzskus" spellcheck="false" placeholder="${esc(t("mto.skusPh"))}">${esc(skus.join("\n"))}</textarea>
      <div class="mzacts">
        <button data-act="import">${esc(t("mto.importExcel"))}</button>
        <button data-act="view">${esc(t("mto.viewOnMap"))}</button>
        <button data-act="del" class="danger">${esc(t("mto.deleteZone"))}</button>
      </div>
    </div>`;
  }).join("");
  body.querySelectorAll(".mtozone").forEach(card=>{
    const bi=+card.dataset.bi;
    card.querySelector(".mzname").addEventListener("change",e=>{ data.bg[bi].label=e.target.value.trim()||"MTO"; save(); drawBackground(); });
    const ta=card.querySelector(".mzskus");
    ta.addEventListener("change",()=>{ data.bg[bi].skus=skuLinesToArray(ta.value); save(); drawBackground();
      card.querySelector(".mzcount").textContent=t("mto.skuCount",{n:data.bg[bi].skus.length}); rebuildSkuList(); });
    card.querySelector('[data-act="import"]').onclick=()=>{ mtoImportTarget=bi; $("#mtoXls").click(); };
    card.querySelector('[data-act="view"]').onclick=()=>{ $("#mtoModal").classList.remove("show"); focusFlex(bi); };
    card.querySelector('[data-act="del"]').onclick=()=>{ if(!confirm(t("mto.deleteConfirm"))) return;
      data.bg.splice(bi,1); if(bgSel===bi) bgSel=null; save(); drawBackground(); renderMtoModal(); };
  });
}
function openMto(){ renderMtoModal(); $("#mtoModal").classList.add("show"); }
$("#mtoBtn").onclick=()=>{ if(!canEdit()){ toast(t("session.noPermission")); return; } openMto(); closeDrawer(); };
$("#mtoCloseBtn").onclick=()=>$("#mtoModal").classList.remove("show");
$("#mtoModal").addEventListener("click",e=>{ if(e.target.id==="mtoModal") $("#mtoModal").classList.remove("show"); });
$("#mtoNewBtn").onclick=()=>{
  const name=prompt(t("mto.newPrompt"),"MTO"); if(name==null) return;
  // place it in a visible open spot near the current view centre
  const r=stage.getBoundingClientRect(); const c=toCanvas(r.left+r.width/2, r.top+r.height*0.55);
  data.bg.push({type:"rect", kind:"flex", x:Math.round(c.x-280), y:Math.round(c.y-120), w:560, h:240, label:name.trim()||"MTO", skus:[]});
  save(); drawBackground(); renderMtoModal();
  toast(t("mto.created"));
};
$("#mtoXls").onchange=e=>{
  const f=e.target.files[0]; if(!f||mtoImportTarget==null){ e.target.value=""; return; }
  if(typeof XLSX==="undefined"){ toast(t("io.xlsMissing")); e.target.value=""; return; }
  const bi=mtoImportTarget; const rd=new FileReader();
  rd.onload=()=>{ try{
    const wb=XLSX.read(new Uint8Array(rd.result),{type:"array"});
    const sh=wb.SheetNames.find(n=>/produc/i.test(n))||wb.SheetNames[0];
    const arr=XLSX.utils.sheet_to_json(wb.Sheets[sh],{defval:"",raw:false});
    const pick=(o)=>{ for(const k in o){ const kk=k.trim().toLowerCase(); if(["producto","product","sku","numero","número","item","código","codigo"].includes(kk)) return o[k]; } return ""; };
    const skus=arr.map(pick).map(s=>String(s).trim()).filter(s=>s && !s.startsWith("(") && s.toLowerCase()!=="producto");
    if(!skus.length){ toast(t("mto.noProducts")); return; }
    const cur=data.bg[bi].skus||[]; data.bg[bi].skus=[...new Set([...cur,...skus])];
    save(); drawBackground(); renderMtoModal(); rebuildSkuList();
    toast(t("mto.added",{n:skus.length,zone:data.bg[bi].label||"MTO"}));
  }catch(err){ console.error(err); toast(t("io.xlsUnreadable")); } };
  rd.readAsArrayBuffer(f); e.target.value=""; mtoImportTarget=null;
};
$("#resetBtn").onclick=()=>{
  if(!canEdit()){ toast(t("session.noPermission")); return; }
  if(!confirm(t("io.resetConfirm"))) return;
  data=DEFAULT_DATA(); selection.clear(); save();
  qInput.value=""; clrBtn.style.display="none";
  render(); fit(); rebuildSkuList(); toast(t("io.wasReset")); closeDrawer();
};

let toastT;
function toast(m){
  const el=$("#toast"); el.textContent=m; el.classList.add("show");
  clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove("show"),2600);
}

/* ============================================================
   v6 — SKU index, alerts, reporting, scanning, drawer, boot
   ============================================================ */

/* ---------------------------------------------------- SKU index ---- */

const normCode = s => String(s == null ? "" : s).toUpperCase().replace(/[^A-Z0-9]/g, "");
let SKU_INDEX = null;

function buildSkuIndex(){
  const idx = new Map();
  const put = (key, val) => { const k = normCode(key); if(k && !idx.has(k)) idx.set(k, val); };
  data.tiles.forEach((tile, i) => put(tile.sku, { sku: tile.sku, tileIdx: i }));
  flexZones().forEach(z => (z.it.skus || []).forEach(s =>
    put(s, { sku: s, flexIdx: z.idx, zone: z.it.label || "MTO" })));
  return idx;
}

/** Refresh the lookup table and the <datalist> that backs manual SKU entry. */
function rebuildSkuList(){
  SKU_INDEX = buildSkuIndex();
  const dl = $("#skuList");
  if(!dl) return;
  const all = [];
  data.tiles.forEach(tile => all.push(tile.sku));
  flexZones().forEach(z => (z.it.skus || []).forEach(s => all.push(s)));
  const seen = new Set();
  dl.innerHTML = all
    .filter(s => s && !seen.has(s.toUpperCase()) && seen.add(s.toUpperCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .slice(0, 1500)
    .map(s => `<option value="${esc(s)}"></option>`).join("");
}

/**
 * Map a scanned or typed code onto a known SKU.
 * Barcodes often carry the SKU with extra packaging digits (a leading
 * country/company digit, a trailing check digit, padded zeros), so we try a
 * few sensible variants before giving up.
 */
function resolveSku(code){
  const raw = String(code == null ? "" : code).trim();
  if(!SKU_INDEX) SKU_INDEX = buildSkuIndex();
  const n = normCode(raw);
  const cands = [n, n.replace(/^0+/, "")];
  if(/^\d{8,14}$/.test(n)){
    cands.push(n.slice(1), n.slice(0, -1), n.slice(1, -1), n.replace(/^0+/, "").slice(0, -1));
  }
  for(const c of cands){
    const k = normCode(c);
    if(k && SKU_INDEX.has(k)) return Object.assign({ raw, found: true }, SKU_INDEX.get(k));
  }
  return { raw, found: false, sku: raw.toUpperCase() };
}

/* ---------------------------------------------------- alerts ---- */

let ALERTS = [];
let alertFilter = "open";

const openAlerts = () => ALERTS.filter(a => a.status !== "resolved");
const isPinAlert = a => a.type === "found" || a.type === "unknown";

function alertTypeLabel(type){
  return t({
    empty: "alerts.type.empty",
    damaged: "alerts.type.damaged",
    found: "alerts.type.found",
    unknown: "alerts.type.unknown",
    low: "alerts.type.low",
  }[type] || "alerts.type.empty");
}

function tileCentre(tile){
  return { x: Math.round(tile.x + (tile.w || TW) / 2), y: Math.round(tile.y + (tile.h || TH) / 2) };
}

/** Badge the tiles that have an open issue reported against them. */
function applyAlertMarks(){
  const bySku = new Map();
  openAlerts().forEach(a => {
    if(isPinAlert(a)) return;                 // those render as map pins instead
    const k = (a.sku || "").toUpperCase();
    if(!k) return;
    if(!bySku.has(k)) bySku.set(k, []);
    bySku.get(k).push(a);
  });
  tileEls.forEach((el, i) => {
    const tile = data.tiles[i];
    if(!tile) return;
    const list = bySku.get((tile.sku || "").toUpperCase());
    el.classList.toggle("has-alert", !!(list && list.length));
    const b = el.querySelector(".abadge");
    if(b) b.textContent = (list && list.length) ? "⚠️ " + alertTypeLabel(list[0].type) : "";
  });
  updateAlertBadge();
}

/** Drop a pin wherever somebody found a product that does not belong there. */
function renderAlertPins(){
  canvas.querySelectorAll(".apin").forEach(n => n.remove());
  const frag = document.createDocumentFragment();
  openAlerts().forEach(a => {
    if(!isPinAlert(a) || !a.foundAt || a.foundAt.x == null) return;
    const d = document.createElement("div");
    d.className = "apin" + (a.type === "unknown" ? " unknown" : "");
    d.dataset.aid = a.id;
    d.style.left = a.foundAt.x + "px";
    d.style.top = a.foundAt.y + "px";
    d.innerHTML = `<span class="plbl">${esc(a.sku || "?")}</span>`;
    frag.appendChild(d);
  });
  canvas.appendChild(frag);
}

function updateAlertBadge(){
  const n = openAlerts().length;
  const badge = $("#alertBadge");
  badge.textContent = n;
  badge.classList.toggle("show", n > 0);
  $("#alertBtn").style.color = n > 0 ? "var(--red)" : "";
}

function alertMessage(a){
  if(a.type === "unknown") return t("alerts.unknownMsg", { sku: a.sku || a.rawCode || "?" });
  if(a.type === "found"){
    return a.homeAt
      ? t("alerts.foundMsg", { sku: a.sku })
      : t("alerts.foundMsgNoHome", { sku: a.sku });
  }
  return alertTypeLabel(a.type);
}

function renderAlerts(){
  updateAlertBadge();
  const body = $("#alertsBody");
  const list = ALERTS.filter(a =>
    alertFilter === "all" ? true :
    alertFilter === "done" ? a.status === "resolved" : a.status !== "resolved");

  if(!list.length){
    body.innerHTML = `<div class="alerts-none">${t("alerts.none")}</div>`;
    return;
  }

  body.innerHTML = list.map(a => {
    const done = a.status === "resolved";
    const meta = [t("alerts.by", { name: a.by || "—" }), t("alerts.at", { date: I18N.fmtDate(a.createdAt) })].join(" · ");
    const canGo = !!(a.foundAt && a.foundAt.x != null) || !!findTileBySku(a.sku);
    return `<div class="alert-item ${done ? "done" : ""}" data-aid="${esc(a.id)}">
      <div class="atitle"><span class="atype ${esc(a.type)}">${esc(alertTypeLabel(a.type))}</span><span>${esc(a.sku || a.rawCode || "?")}</span></div>
      <div class="amsg">${esc(alertMessage(a))}${a.note ? " · " + esc(a.note) : ""}</div>
      <div class="ameta">${esc(meta)}</div>
      <div class="aacts">
        ${canGo ? `<button data-act="go">${esc(t("alerts.goto"))}</button>` : ""}
        ${(!done && canEdit()) ? `<button class="ok" data-act="resolve">${esc(t("alerts.resolve"))}</button>` : ""}
      </div>
    </div>`;
  }).join("");

  body.querySelectorAll(".alert-item").forEach(item => {
    const id = item.dataset.aid;
    const a = ALERTS.find(x => x.id === id);
    item.querySelectorAll("[data-act]").forEach(btn => {
      btn.onclick = ev => {
        ev.stopPropagation();
        if(btn.dataset.act === "go") focusAlert(a);
        else if(btn.dataset.act === "resolve") resolveAlert(id);
      };
    });
    item.onclick = () => focusAlert(a);
  });
}

function findTileBySku(sku){
  if(!sku) return null;
  const K = String(sku).toUpperCase();
  const i = data.tiles.findIndex(tl => (tl.sku || "").toUpperCase() === K);
  return i < 0 ? null : { i, tile: data.tiles[i] };
}

function focusAlert(a){
  if(!a) return;
  $("#alertsPanel").classList.remove("show");
  if(a.foundAt && a.foundAt.x != null){
    const r = stage.getBoundingClientRect();
    view.k = clampK(1.1);
    view.tx = r.width / 2 - a.foundAt.x * view.k;
    view.ty = r.height / 2 - a.foundAt.y * view.k;
    applyView();
    const pin = canvas.querySelector(`.apin[data-aid="${CSS.escape(a.id)}"]`);
    if(pin){ pin.classList.add("flash"); setTimeout(() => pin.classList.remove("flash"), 1800); }
    return;
  }
  const hit = findTileBySku(a.sku);
  if(hit) flyTo(hit.i);
}

async function resolveAlert(id){
  const r = await Sync.setAlertStatus(id, "resolved", false);
  if(r && r.forbidden){ toast(t("session.noPermission")); return; }
  toast(t("alerts.resolved"));
}

function openAlertsPanel(focusId){
  $("#alertsPanel").classList.add("show");
  renderAlerts();
  if(focusId){
    const el = $("#alertsBody").querySelector(`.alert-item[data-aid="${CSS.escape(focusId)}"]`);
    if(el) el.scrollIntoView({ block: "nearest" });
  }
}

$("#alertBtn").onclick = e => {
  e.stopPropagation();
  const p = $("#alertsPanel");
  const show = !p.classList.contains("show");
  p.classList.toggle("show", show);
  if(show) renderAlerts();
};
document.addEventListener("click", e => {
  if(!e.target.closest("#alertsPanel") && !e.target.closest("#alertBtn")) $("#alertsPanel").classList.remove("show");
});
$("#alertsPanel").querySelectorAll(".afilter button").forEach(b => {
  b.onclick = () => {
    alertFilter = b.dataset.f;
    $("#alertsPanel").querySelectorAll(".afilter button").forEach(x => x.classList.toggle("on", x === b));
    renderAlerts();
  };
});

/** Single entry point for filing any kind of report. */
async function submitAlert(payload){
  const res = await Sync.addAlert(payload);
  ALERTS = Sync.state.alerts;
  applyAlertMarks();
  renderAlertPins();
  renderAlerts();
  toast(res.ok ? t("report.sent") : (res.queued ? t("report.failed") : t("report.sent")));
  return res;
}

/* ---------------------------------------------------- pick a spot ---- */

let picking = false, pickCb = null, pickPoint = null, pickResume = null;

function setPickPoint(p){
  pickPoint = { x: Math.round(p.x), y: Math.round(p.y) };
  const pin = $("#dropPin");
  pin.hidden = false;
  pin.style.left = pickPoint.x + "px";
  pin.style.top = pickPoint.y + "px";
  canvas.appendChild(pin);
  $("#pickConfirm").disabled = false;
}

function startPicking(resumeModalId, onDone){
  picking = true;
  pickCb = onDone;
  pickResume = resumeModalId;
  pickPoint = null;
  document.body.classList.add("picking");
  if(resumeModalId) $(resumeModalId).classList.remove("show");
  $("#dropPin").hidden = true;
  $("#pickBar").hidden = false;
  $("#pickConfirm").disabled = true;
}

function stopPicking(){
  picking = false;
  document.body.classList.remove("picking");
  $("#pickBar").hidden = true;
  $("#dropPin").hidden = true;
  if(pickResume) $(pickResume).classList.add("show");
  pickResume = null;
}

// Capture phase so a tap lands the pin without the map treating it as a pan.
stage.addEventListener("click", e => {
  if(!picking || didPan) return;
  e.stopPropagation();
  setPickPoint(toCanvas(e.clientX, e.clientY));
}, true);

$("#pickConfirm").onclick = () => {
  if(!pickPoint) return;
  const p = pickPoint;
  const cb = pickCb;
  stopPicking();
  if(cb) cb(p);
};
$("#pickCancel").onclick = () => { const cb = pickCb; stopPicking(); if(cb) cb(null); };

/* ---------------------------------------------------- tile report ---- */

let reportCtx = null;

function openTileReport(i){
  const tile = data.tiles[i];
  if(!tile) return;
  reportCtx = { i, sku: tile.sku, at: tileCentre(tile), g: tile.g };
  $("#reportHead").textContent = t("report.forSku", { sku: tile.sku });
  $("#reportNote").value = "";
  $("#reportModal").classList.add("show");
}

$("#closeReportBtn").onclick = () => $("#reportModal").classList.remove("show");
$("#reportModal").addEventListener("click", e => {
  if(e.target.id === "reportModal") $("#reportModal").classList.remove("show");
});

document.querySelectorAll("#reportModal .report-btn").forEach(btn => {
  btn.onclick = () => {
    if(!reportCtx) return;
    const reason = btn.dataset.reason;
    const note = $("#reportNote").value.trim();
    $("#reportModal").classList.remove("show");

    if(reason === "found-here"){
      // "Something else is sitting here" — jump into the found-a-product flow
      // with the spot already known, and ask which product it actually is.
      openFoundModal(reportCtx.at, note);
      return;
    }
    submitAlert({
      type: reason,
      sku: reportCtx.sku,
      note,
      homeAt: reportCtx.at,
      foundAt: reportCtx.at,
      homeGroup: groupName(reportCtx.g),
    });
    clearSelection();
  };
});

/* ---------------------------------------------------- found-here flow ---- */

let foundCtx = { at: null, lookup: null };

function openFoundModal(at, note){
  foundCtx = { at: at || null, lookup: null };
  $("#foundSku").value = "";
  $("#foundNote").value = note || "";
  rebuildSkuList();
  updateFoundUi();
  $("#foundModal").classList.add("show");
}

function closeFoundModal(){ $("#foundModal").classList.remove("show"); }

function updateFoundUi(){
  const pinTxt = $("#foundPinTxt");
  pinTxt.textContent = foundCtx.at
    ? t("found.pinSet") + ` (${foundCtx.at.x}, ${foundCtx.at.y})`
    : t("found.pinHint");

  const box = $("#foundLookup");
  const code = $("#foundSku").value.trim();
  if(!code){ box.hidden = true; foundCtx.lookup = null; $("#foundSubmit").disabled = true; return; }

  const r = resolveSku(code);
  foundCtx.lookup = r;
  box.hidden = false;
  $("#foundSubmit").disabled = false;

  if(r.found && r.tileIdx != null){
    const tile = data.tiles[r.tileIdx];
    box.className = "lookup ok";
    box.innerHTML =
      `<span class="lsku">${esc(r.sku)}</span>` +
      `<span class="lmsg">${esc(t("found.expected", { loc: groupName(tile.g) || "—" }))}</span>` +
      `<div class="lact"><button data-act="show">${esc(t("alerts.goto"))}</button></div>`;
    box.querySelector('[data-act="show"]').onclick = () => { closeFoundModal(); flyTo(r.tileIdx); };
    return;
  }

  if(r.found && r.flexIdx != null){
    box.className = "lookup ok";
    box.innerHTML =
      `<span class="lsku">${esc(r.sku)}</span>` +
      `<span class="lmsg">${esc(t("search.mtoLoc", { zone: r.zone }))}</span>`;
    return;
  }

  box.className = "lookup warn";
  box.innerHTML =
    `<span class="lsku">${esc(r.sku)}</span>` +
    `<span class="lmsg"><b>${esc(t("found.notInSystem"))}</b><br>${esc(t("found.notInSystemDesc"))}</span>` +
    (canEdit() ? `<div class="lact"><button data-act="create">${esc(t("found.createHere"))}</button></div>` : "");
  const create = box.querySelector('[data-act="create"]');
  if(create) create.onclick = () => createProductHere(r.sku);
}

function createProductHere(sku){
  if(!canEdit()){ toast(t("session.noPermission")); return; }
  if(!foundCtx.at){ toast(t("found.needSpot")); return; }
  data.tiles.push({
    sku: String(sku).toUpperCase(),
    x: Math.round(foundCtx.at.x - TW / 2),
    y: Math.round(foundCtx.at.y - TH / 2),
    g: "X",
  });
  save();
  render();
  rebuildSkuList();
  closeFoundModal();
  toast(t("tile.added", { sku }));
}

$("#foundSku").addEventListener("input", updateFoundUi);
$("#foundSku").addEventListener("change", updateFoundUi);
$("#foundCancel").onclick = closeFoundModal;
$("#foundModal").addEventListener("click", e => { if(e.target.id === "foundModal") closeFoundModal(); });

$("#foundPickBtn").onclick = () => {
  startPicking("#foundModal", p => {
    if(p) foundCtx.at = p;
    updateFoundUi();
  });
};

$("#foundScanBtn").onclick = () => {
  $("#foundModal").classList.remove("show");
  Scanner.open({
    onResult: code => {
      $("#foundModal").classList.add("show");
      $("#foundSku").value = code;
      updateFoundUi();
      toast(t("scan.detected", { code }));
    },
    onCancel: opt => {
      $("#foundModal").classList.add("show");
      if(opt && opt.manual) $("#foundSku").focus();
    },
  });
};

$("#foundSubmit").onclick = async () => {
  const code = $("#foundSku").value.trim();
  if(!code){ toast(t("found.needSku")); return; }
  if(!foundCtx.at){ toast(t("found.needSpot")); return; }

  const r = foundCtx.lookup || resolveSku(code);
  const note = $("#foundNote").value.trim();
  let homeAt = null, homeGroup = "";

  if(r.found && r.tileIdx != null){
    const tile = data.tiles[r.tileIdx];
    homeAt = tileCentre(tile);
    homeGroup = groupName(tile.g);
    // Reporting a product at the spot it is already assigned to is a no-op.
    if(Math.hypot(homeAt.x - foundCtx.at.x, homeAt.y - foundCtx.at.y) < 70){
      toast(t("found.sameSpot"));
      return;
    }
  }

  await submitAlert({
    type: r.found ? "found" : "unknown",
    sku: r.found ? r.sku : String(code).toUpperCase(),
    rawCode: r.raw || code,
    note,
    foundAt: foundCtx.at,
    homeAt,
    homeGroup,
  });
  closeFoundModal();
};

/* ---------------------------------------------------- long press ---- */

let lpTimer = null, lpStart = null;

function cancelLongPress(){ clearTimeout(lpTimer); lpTimer = null; lpStart = null; }

stage.addEventListener("pointerdown", e => {
  if(editing || bgEditing || picking) return;
  if(pointers.size > 1){ cancelLongPress(); return; }
  lpStart = { x: e.clientX, y: e.clientY };
  clearTimeout(lpTimer);
  lpTimer = setTimeout(() => {
    lpTimer = null;
    if(navigator.vibrate){ try { navigator.vibrate(30); } catch(err){} }
    panning = false;
    stage.classList.remove("grabbing");
    didPan = true;                       // stops the follow-up click re-opening a tile sheet
    const p = toCanvas(lpStart.x, lpStart.y);
    openFoundModal({ x: Math.round(p.x), y: Math.round(p.y) });
  }, 550);
});
stage.addEventListener("pointermove", e => {
  if(!lpTimer || !lpStart) return;
  if(Math.abs(e.clientX - lpStart.x) + Math.abs(e.clientY - lpStart.y) > 12) cancelLongPress();
});
stage.addEventListener("pointerup", cancelLongPress);
stage.addEventListener("pointercancel", cancelLongPress);

/* ---------------------------------------------------- toolbar wiring ---- */

$("#selRename").onclick = () => {
  if(selection.size === 1) renameTile([...selection][0]);
  else toast(t("edit.selectOne"));
};
$("#selReport").onclick = () => {
  if(selection.size === 1) openTileReport([...selection][0]);
  else toast(t("edit.selectOne"));
};

$("#reportBtn").onclick = () => openFoundModal(null);
$("#drReport").onclick = () => { closeDrawer(); openFoundModal(null); };

function startScanFlow(){
  openFoundModal(null);
  $("#foundScanBtn").click();
}
$("#scanBtn").onclick = startScanFlow;
$("#drScan").onclick = () => { closeDrawer(); startScanFlow(); };

/* ---------------------------------------------------- drawer ---- */

function openDrawer(){
  $("#drawer").classList.add("show");
  $("#drawerScrim").classList.add("show");
  $("#drawer").setAttribute("aria-hidden", "false");
  updateDrawerInfo();
}
function closeDrawer(){
  $("#drawer").classList.remove("show");
  $("#drawerScrim").classList.remove("show");
  $("#drawer").setAttribute("aria-hidden", "true");
}
$("#menuBtn").onclick = openDrawer;
$("#drawerClose").onclick = closeDrawer;
$("#drawerScrim").onclick = closeDrawer;

function updateDrawerInfo(){
  const role = Sync.role === "editor" ? t("role.editor") : Sync.role === "viewer" ? t("role.viewer") : t("role.local");
  $("#drName").textContent = Sync.name || "—";
  $("#drRole").textContent = role;
  const s = $("#drSync");
  if(Sync.mode === "remote"){
    s.classList.remove("warn");
    s.innerHTML = `<b>●</b> ${esc(canEdit() ? t("sync.saved") : t("sync.readonly"))}`;
  } else {
    s.classList.add("warn");
    s.innerHTML = `<b>●</b> ${esc(t("sync.localBanner"))}`;
  }
}

$("#signOutBtn").onclick = async () => {
  await Sync.flush();
  await Sync.logout();
  location.reload();
};

/* ---------------------------------------------------- language ---- */

function paintLangPills(){
  $$(".langpill").forEach(b => b.classList.toggle("on", b.dataset.lang === I18N.getLang()));
}
$$(".langpill").forEach(b => { b.onclick = () => I18N.setLang(b.dataset.lang); });

I18N.onLangChange(() => {
  paintLangPills();
  if(!$("#app").hidden){
    renderTiles();
    drawBackground();
    renderAlerts();
    updateDrawerInfo();
    if($("#legend").classList.contains("show")) buildLegend();
    if($("#mtoModal").classList.contains("show")) renderMtoModal();
    if($("#foundModal").classList.contains("show")) updateFoundUi();
  }
});

/* ---------------------------------------------------- login ---- */

function showLogin(opts){
  const screen = $("#loginScreen");
  screen.classList.remove("hide");
  document.body.classList.remove("booting");
  $("#loginName").value = Sync.rememberedName() || "";
  $("#loginLocal").hidden = !opts.local;
  if(opts.local){
    // No backend on this host — the access code cannot be checked, so hide it.
    $("#loginCode").closest(".fld").hidden = true;
    $("#loginCode").required = false;
    $("#loginSubmit").hidden = true;
  }
  if(opts.misconfigured) showLoginError(t("login.offline"));
}

function showLoginError(msg){
  const box = $("#loginErr");
  box.textContent = msg;
  box.hidden = !msg;
}

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const name = $("#loginName").value.trim();
  const code = $("#loginCode").value;
  if(!name){ showLoginError(t("login.needName")); return; }
  showLoginError("");
  const btn = $("#loginSubmit");
  btn.disabled = true;
  btn.textContent = t("login.working");
  try {
    const r = await Sync.login(name, code);
    if(r.ok){ await startApp(); return; }
    showLoginError(r.status === 401 ? t("login.badPassword") : t("login.offline"));
  } catch(err){
    showLoginError(t("login.offline"));
  }
  btn.disabled = false;
  btn.textContent = t("login.submit");
});

$("#loginLocalBtn").onclick = async () => {
  const name = $("#loginName").value.trim() || "Local";
  Sync.useLocalMode(name);
  await startApp();
};

/* ---------------------------------------------------- boot ---- */

/* Remote updates are queued while the user is mid-gesture so the map never
   jumps out from under a drag. */
let pendingRemote = null;
const busyEditing = () => !!(tileDrag || bandDrag || resizeDrag || bgDraw || bgMove || bgResize || bgRotate);

function applyRemoteState(payload){
  if(!payload || !payload.data) return;
  if(busyEditing()){ pendingRemote = payload; return; }
  const keep = { tx: view.tx, ty: view.ty, k: view.k };
  applyingRemote = true;
  data = ensureGroups(payload.data);
  if(!Array.isArray(data.bg)) data.bg = DEFAULT_BG();
  selection.clear();
  bgSel = null;
  render();
  view = keep;
  applyView();
  applyingRemote = false;
  rebuildSkuList();
  if($("#legend").classList.contains("show")) buildLegend();
  toast(payload.reason === "conflict" ? t("sync.conflict") : t("sync.updated"));
}

async function startApp(){
  $("#loginScreen").classList.add("hide");
  $("#app").hidden = false;
  document.body.classList.remove("booting");
  document.body.classList.toggle("viewer", !canEdit());
  updateDrawerInfo();

  const st = await Sync.loadState(DEFAULT_DATA());
  applyingRemote = true;
  data = ensureGroups(st.data && Array.isArray(st.data.tiles) ? st.data : DEFAULT_DATA());
  if(!Array.isArray(data.bg)) data.bg = DEFAULT_BG();
  applyingRemote = false;

  ALERTS = await Sync.loadAlerts();

  bindInsp();
  rebuildSkuList();
  render();
  fit();
  renderAlerts();

  Sync.onState(applyRemoteState);
  Sync.onAlerts(list => {
    ALERTS = list;
    applyAlertMarks();
    renderAlertPins();
    if($("#alertsPanel").classList.contains("show")) renderAlerts();
    else updateAlertBadge();
  });
  Sync.onStatus(s => {
    if(s.unauthorized){ toast(t("session.expired")); setTimeout(() => location.reload(), 1500); return; }
    if(s.forbidden) toast(t("session.noPermission"));
    if(s.offline) toast(t("sync.offline"));
    if(s.newAlerts) toast(t("sync.newAlerts", { n: s.newAlerts }));
  });
  Sync.startPolling();

  // Flush any queued remote update as soon as the user stops dragging.
  stage.addEventListener("pointerup", () => {
    if(pendingRemote && !busyEditing()){ const p = pendingRemote; pendingRemote = null; applyRemoteState(p); }
  });

  window.addEventListener("resize", applyView);
}

async function boot(){
  I18N.applyI18n(document);
  paintLangPills();

  // The yard layout that ships with the build, used to seed an empty server
  // and as the offline fallback.
  try {
    const res = await fetch("assets/default-map.json", { cache: "no-cache" });
    if(res.ok){
      const seed = await res.json();
      if(seed && Array.isArray(seed.tiles)) SEED_DATA = seed;
    }
  } catch(e){ /* inline v3 tables remain the fallback */ }
  data = DEFAULT_DATA();

  const probe = await Sync.probe();
  if(probe.mode === "local") showLogin({ local: true });
  else if(!probe.authed) showLogin({ local: false, misconfigured: probe.misconfigured });
  else await startApp();
}

boot();
