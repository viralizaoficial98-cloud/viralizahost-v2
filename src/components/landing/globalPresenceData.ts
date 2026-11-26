// Dados partilhados da secção «Presença Global»: mapa plano (alternativa) e globo 3D.

/*
  Mapa plano: viewBox="0 0 1000 500", projecção equirectangular simplificada
    x = (lon + 180) * 2.7778        y = (90 - lat) * 2.7778
  As posições x/y abaixo são as do mapa original (desenhado à mão sobre continentes simplificados).
*/
export type Side = 't' | 'b' | 'l' | 'r'
export interface GpNode { id: string; code: string; pos: Side; name: string; x: number; y: number; lat: number; lon: number }

// Localizações: código ISO 3166-1 alfa-2 (GB = Reino Unido, HK = Hong Kong) → bandeira local em /flags/<id>.png
// (flag-icons, MIT, rasterizadas a 96×72). pos = lado do rótulo (bandeira + código) em relação ao ponto, escolhido
// para não se sobreporem nas zonas densas (Europa, Cone Sul, Sudeste Asiático).
const RAW: Omit<GpNode, 'lat' | 'lon'>[] = [
  { id:'ao', code:'AO', pos:'t', name:'Angola',      x:551, y:283 },
  { id:'br', code:'BR', pos:'t', name:'Brasil',      x:360, y:278 },
  { id:'pt', code:'PT', pos:'l', name:'Portugal',    x:475, y:148 },
  { id:'us', code:'US', pos:'t', name:'EUA',         x:210, y:155 },
  { id:'gb', code:'GB', pos:'t', name:'Reino Unido', x:489, y:108 },
  { id:'ca', code:'CA', pos:'t', name:'Canadá',      x:225, y:92  },
  { id:'fr', code:'FR', pos:'b', name:'França',      x:508, y:122 },
  { id:'de', code:'DE', pos:'r', name:'Alemanha',    x:527, y:110 },
  { id:'mx', code:'MX', pos:'l', name:'México',      x:215, y:200 },
  { id:'co', code:'CO', pos:'t', name:'Colômbia',    x:285, y:244 },
  { id:'cl', code:'CL', pos:'l', name:'Chile',       x:302, y:345 },
  { id:'pe', code:'PE', pos:'l', name:'Peru',        x:276, y:275 },
  { id:'bo', code:'BO', pos:'r', name:'Bolívia',     x:318, y:305 },
  { id:'uy', code:'UY', pos:'r', name:'Uruguai',     x:348, y:352 },
  { id:'ar', code:'AR', pos:'b', name:'Argentina',   x:318, y:360 },
  { id:'tr', code:'TR', pos:'r', name:'Turquia',     x:597, y:143 },
  { id:'ru', code:'RU', pos:'t', name:'Rússia',      x:660, y:82  },
  { id:'in', code:'IN', pos:'t', name:'Índia',       x:708, y:208 },
  { id:'cn', code:'CN', pos:'t', name:'China',       x:775, y:155 },
  { id:'hk', code:'HK', pos:'r', name:'Hong Kong',   x:800, y:202 },
  { id:'my', code:'MY', pos:'r', name:'Malásia',     x:790, y:248 },
  { id:'sg', code:'SG', pos:'l', name:'Singapura',   x:775, y:258 },
  { id:'id', code:'ID', pos:'b', name:'Indonésia',   x:830, y:268 },
]

/*
  Globo 3D: a latitude/longitude parte das mesmas coordenadas x/y do mapa (inversa da fórmula acima), de modo que cada
  ponto fica onde estava. Num globo realista, porém, 7 desses pontos cairiam fora do país (o mapa plano foi desenhado
  à mão): Portugal e Peru no mar, Uruguai no Atlântico, Hong Kong no Vietname, Malásia e Singapura em Samatra,
  Indonésia no Mar de Java. Esses 7 usam a localização real da cidade principal.
*/
const GEO_FIX: Record<string, { lat: number; lon: number }> = {
  pt: { lat: 38.72, lon: -9.14 },   // Lisboa
  pe: { lat: -12.05, lon: -77.04 }, // Lima
  uy: { lat: -34.9, lon: -56.16 },  // Montevideu
  hk: { lat: 22.32, lon: 114.17 },  // Hong Kong
  my: { lat: 3.14, lon: 101.69 },   // Kuala Lumpur
  sg: { lat: 1.35, lon: 103.82 },   // Singapura
  id: { lat: -6.2, lon: 106.85 },   // Jacarta
}
const r2 = (n: number) => Math.round(n * 100) / 100

export const nodes: GpNode[] = RAW.map(n => ({
  ...n,
  ...(GEO_FIX[n.id] ?? { lat: r2(90 - n.y / 2.7778), lon: r2(n.x / 2.7778 - 180) }),
}))

export const connections: [string, string][] = [
  ['pt','ao'],['pt','br'],['pt','gb'],['pt','fr'],['pt','de'],
  ['us','ca'],['us','mx'],['us','gb'],['us','fr'],
  ['br','co'],['br','ar'],['br','pe'],['br','uy'],['br','bo'],['ao','br'],
  ['cn','hk'],['cn','sg'],['cn','my'],['cn','id'],['cn','in'],
  ['ru','cn'],['ru','de'],['tr','de'],['tr','ru'],['in','sg'],
]

export function nd(id: string) { return nodes.find(n => n.id === id)! }
export const flagSrc = (id: string) => `/flags/${id}.png`

/* Rótulo dos marcadores com tamanho em PIXELS de ecrã (convertidos para unidades do viewBox com k = 1000/largura),
   para ficar legível tanto no desktop como no telemóvel. */
export const LBL = { flagW: 16, flagH: 12, font: 10.5, pad: 4, gap: 4, h: 18, dist: 7 }
export function labelBox(n: { x: number; y: number; code: string; pos: Side }, k: number, hasFlag: boolean, side: Side = n.pos, text = n.code, font = LBL.font) {
  // largura aproximada por letra (fonte a negrito): M/W largas, I estreita
  const textW = [...text].reduce((t, ch) => t + font * (/[MW]/.test(ch) ? 0.98 : /[Iil]/.test(ch) ? 0.36 : ch === ' ' ? 0.3 : 0.74), 0)
  const w = (LBL.pad * 2 + (hasFlag ? LBL.flagW + LBL.gap : 0) + textW) * k, h = LBL.h * k, d = LBL.dist * k
  const x = side === 'l' ? n.x - d - w : side === 'r' ? n.x + d : n.x - w / 2
  const y = side === 't' ? n.y - d - h : side === 'b' ? n.y + d : n.y - h / 2
  return { x, y, w, h }
}
export const OPP: Record<Side, Side> = { t: 'b', b: 't', l: 'r', r: 'l' }

/** Vista inicial do globo: África e o Atlântico, com Angola bem visível. */
export const INITIAL_VIEW = { lat: 11, lon: -4 }
