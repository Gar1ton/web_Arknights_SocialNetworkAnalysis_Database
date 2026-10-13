export interface AtlasNode { id: string; name: string; en: string; faction: number; messages: number; confidence: number; description: string; traits: number[]; tags: string[] }
export interface AtlasEdge { id: string; source: string; target: string; weight: number; messages: number; affect: number; power: number; mutual: boolean; label: string }
export const factions = [
  { name: '罗德岛', en: 'Rhodes Island', color: '#d991a6', short: 'RI' },
  { name: '龙门', en: 'Lungmen', color: '#ddb780', short: 'LM' },
  { name: '莱茵生命', en: 'Rhine Lab', color: '#8ec1b2', short: 'RL' },
  { name: '喀兰贸易', en: 'Karlan Trade', color: '#9eafda', short: 'KT' },
  { name: '企鹅物流', en: 'Penguin Logistics', color: '#cf9acb', short: 'PL' },
  { name: '整合运动', en: 'Reunion', color: '#d9886a', short: 'RM' },
];
const roster = [
  [['阿米娅','Amiya'],['凯尔希',"Kal'tsit"],['博士','Doctor'],['煌','Blaze'],['迷迭香','Rosmontis'],['杜宾','Dobermann'],['芙蓉','Hibiscus'],['安赛尔','Ansel']],
  [['陈','Ch’en'],['星熊','Hoshiguma'],['诗怀雅','Swire'],['魏彦吾','Wei Yenwu'],['林','Lin'],['九','Nine'],['文月','Fumizuki'],['槐琥','Waai Fu']],
  [['塞雷娅','Saria'],['伊芙利特','Ifrit'],['赫默','Silence'],['白面鸮','Ptilopsis'],['麦哲伦','Magallan'],['多萝西','Dorothy'],['缪尔赛思','Muelsyse'],['克丽斯腾','Kristen']],
  [['银灰','SilverAsh'],['初雪','Pramanix'],['崖心','Cliffheart'],['角峰','Matterhorn'],['讯使','Courier'],['灵知','Gnosis'],['极光','Aurora'],['锏','Degenbrecher']],
  [['能天使','Exusiai'],['德克萨斯','Texas'],['可颂','Croissant'],['空','Sora'],['大帝','Emperor'],['莫斯提马','Mostima'],['拜松','Bison'],['拉普兰德','Lappland']],
  [['塔露拉','Talulah'],['霜星','FrostNova'],['爱国者','Patriot'],['W','W'],['梅菲斯特','Mephisto'],['浮士德','Faust'],['弑君者','Crownslayer'],['泥岩','Mudrock']],
];
export const nodes: AtlasNode[] = roster.flatMap((group,faction)=>group.map(([name,en],i)=>({
  id: `n${faction*8+i}`, name, en, faction,
  messages: Math.round(64 + ((faction*37+i*83)%380) + (i===0?800:0)),
  confidence: 0.72+((faction*5+i*3)%26)/100,
  description: i===0 ? '位于社群交汇处的关键节点。通过连接不同角色，让原本分散的叙事形成可探索的关系网络。' : '每一段对话，都为关系留下新的线索。选择相连节点，观察互动方向、情感倾向与社群之间的联系。',
  traits: [57+(i*7)%40,48+(i*11)%48,35+(i*13)%60,58+(i*5)%38,22+(i*9)%52],
  tags: [factions[faction].name, i===0?'社群枢纽':'社群成员', ['协作','信任','交流','观察'][i%4]],
})));
export const edges: AtlasEdge[] = [];
function add(a:number,b:number) {
  if(a===b || edges.some(e=>(e.source===`n${a}`&&e.target===`n${b}`)||(e.source===`n${b}`&&e.target===`n${a}`))) return;
  const k=edges.length;
  edges.push({id:`e${k}`,source:`n${a}`,target:`n${b}`,weight:0.25+((a*17+b*7)%75)/100,messages:12+(a*37+b*19)%340,affect:Math.round(Math.sin(k*1.7)*85)/100,power:Math.round(Math.cos(k*0.7)*72)/100,mutual:k%3!==0,label:['信任','协作','关注','分歧'][k%4]});
}
for(let f=0;f<6;f++) { for(let i=1;i<8;i++) {add(f*8,f*8+i);add(f*8+i,f*8+1+i%7);if(i%2===0)add(f*8+i,f*8+1);} }
for(let f=1;f<6;f++){add(0,f*8);add(2,f*8+2);add(f*8,(f+1)%6*8);add(f*8+1,((f+2)%6)*8+3);}
export const nodeById = new Map(nodes.map(n=>[n.id,n]));
export function degree(id:string, links=edges) {return links.filter(e=>e.source===id||e.target===id).length;}
export function neighborhood(center:string, links:AtlasEdge[], hops:number) {
  const result=new Set([center]);let frontier=[center];
  for(let h=0;h<hops;h++){const next:string[]=[];for(const id of frontier)for(const edge of links){const other=edge.source===id?edge.target:edge.target===id?edge.source:null;if(other&&!result.has(other)){result.add(other);next.push(other);}}frontier=next;}
  return result;
}
