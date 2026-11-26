'use client'
// Globo 3D da secção «Presença Global». Carregado só quando a secção se aproxima do ecrã (ver GlobalPresenceSection).
// Planeta e atmosfera: three.js. Bandeiras, pontos, pulsos e rotas: camada SVG por cima (mesmas classes/animações
// CSS do mapa plano), com as posições recalculadas a partir da projecção 3D a cada alteração da vista.
// Textura: NASA Earth Observatory «Blue Marble» (relevo + batimetria) — ver docs/globo-presenca-global.md.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AdditiveBlending, BackSide, Euler, Mesh, PerspectiveCamera, Quaternion, Scene, ShaderMaterial, SphereGeometry,
  TextureLoader, Vector2, Vector3, WebGLRenderer, LinearMipmapLinearFilter, LinearFilter, RepeatWrapping, ClampToEdgeWrapping,
  type Texture,
} from 'three'
import { INITIAL_VIEW, LBL, connections, flagSrc, labelBox, nodes, type GpNode } from './globalPresenceData'

export interface GlobeProps {
  active: string | null
  setActive: (id: string | null) => void
  /** Pedido para rodar o globo até um país (clique na lista ou no marcador); `n` muda a cada pedido. */
  focus: { id: string; n: number } | null
  noFlag: Record<string, boolean>
  onFlagError: (id: string) => void
  onFail: (reason: string) => void
}

const RAD = Math.PI / 180
const DEG = 180 / Math.PI
const FOV = 30
const LAT_MAX = 72
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const unit = (lat: number, lon: number) => new Vector3(Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.sin(lat * RAD), -Math.cos(lat * RAD) * Math.sin(lon * RAD))
const SHELL = 1.06

const EARTH_VERT = /* glsl */`
varying vec2 vUv; varying vec3 vN; varying vec3 vP; varying vec3 vUp;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vUp = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
  gl_Position = projectionMatrix * viewMatrix * wp;
}`
// Iluminação suave (envolvente), sombra azulada, brilho no oceano, relevo subtil a partir da própria textura
// (já traz o relevo sombreado) e halo atmosférico junto ao limbo. Cálculo em espaço de ecrã (sRGB), sem tone mapping.
const EARTH_FRAG = /* glsl */`
uniform sampler2D uMap; uniform vec3 uSun; uniform vec2 uTexel; uniform float uRelief;
varying vec2 vUv; varying vec3 vN; varying vec3 vP; varying vec3 vUp;
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vP);
  vec3 alb = texture2D(uMap, vUv).rgb;
  // máscara de água e relevo a partir de amostras suavizadas (evita os blocos JPEG do oceano escuro)
  vec3 soft = texture2D(uMap, vUv, 2.0).rgb;
  float water = smoothstep(0.34, 0.12, soft.r) * smoothstep(0.0, 0.1, soft.b - soft.r);
  alb = mix(alb, alb * 1.55 + vec3(0.0, 0.03, 0.085), water);              // oceano: azul profundo, sem ficar preto
  vec3 T = normalize(cross(normalize(vUp), N));
  vec3 B = cross(N, T);
  vec2 o = uTexel * 1.5;
  float lx = lum(texture2D(uMap, vUv + vec2(o.x, 0.0), 1.0).rgb) - lum(texture2D(uMap, vUv - vec2(o.x, 0.0), 1.0).rgb);
  float ly = lum(texture2D(uMap, vUv + vec2(0.0, o.y), 1.0).rgb) - lum(texture2D(uMap, vUv - vec2(0.0, o.y), 1.0).rgb);
  vec3 Np = normalize(N - uRelief * (1.0 - water) * (lx * T + ly * B));
  vec3 L = normalize(uSun);
  float ndl = dot(Np, L);
  float diff = pow(clamp(ndl * 0.5 + 0.5, 0.0, 1.0), 1.2);
  vec3 col = alb * (0.2 + 1.06 * diff);
  col = mix(col, col * vec3(0.52, 0.66, 1.0), (1.0 - diff) * 0.55);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(Np, H), 0.0), 140.0) * water * 0.2 * smoothstep(0.05, 0.45, ndl);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.8);
  col += vec3(0.2, 0.45, 1.0) * fres * (0.35 + 0.65 * clamp(ndl + 0.35, 0.0, 1.0)) * 0.8;
  col += spec * vec3(0.8, 0.9, 1.0);
  gl_FragColor = vec4(col, 1.0);
}`
const ATMO_VERT = /* glsl */`
varying vec3 vN; varying vec3 vP;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`
const ATMO_FRAG = /* glsl */`
uniform vec3 uSun; uniform float uInner;
varying vec3 vN; varying vec3 vP;
void main() {
  vec3 V = normalize(cameraPosition - vP);
  float t = clamp(-dot(normalize(vN), V) / uInner, 0.0, 1.0);
  float a = pow(t, 2.2);
  float lit = 0.55 + 0.45 * clamp(dot(normalize(vP), normalize(uSun)) + 0.3, 0.0, 1.0);
  gl_FragColor = vec4(vec3(0.24, 0.52, 1.0) * lit, a * 0.85);
}`

/** Estrelas discretas (determinísticas) desenhadas na área do globo. */
function paintStars(cv: HTMLCanvasElement, W: number, H: number, dpr: number) {
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
  const g = cv.getContext('2d'); if (!g) return
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H)
  let s = 0x9e3779b9
  const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const n = Math.round(clamp(W * H / 2600, 60, 260))
  for (let i = 0; i < n; i++) {
    const x = rnd() * W, y = rnd() * H, r = 0.3 + rnd() * rnd() * 1.0, a = 0.22 + rnd() * 0.65
    g.fillStyle = rnd() < 0.22 ? `rgba(190,215,255,${a})` : rnd() < 0.12 ? `rgba(255,236,190,${a})` : `rgba(255,255,255,${a})`
    g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill()
  }
}

export default function GlobalPresenceGlobe({ active, setActive, focus, noFlag, onFlagError, onFail }: GlobeProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const starsRef = useRef<HTMLCanvasElement>(null)
  const dotRefs = useRef<Record<string, SVGGElement | null>>({})
  const labelRefs = useRef<Record<string, SVGGElement | null>>({})
  const leaderRefs = useRef<Record<string, SVGLineElement | null>>({})
  const tipRefs = useRef<Record<string, SVGGElement | null>>({})
  const arcRefs = useRef<(SVGPathElement | null)[]>([])
  const api = useRef<{ focusTo: (lat: number, lon: number) => void; nudge: (dLon: number, dLat: number) => void; reset: () => void } | null>(null)
  const live = useRef({ active, setActive, noFlag, onFail })
  const [ready, setReady] = useState(false)
  const [touched, setTouched] = useState(false)

  useEffect(() => { live.current = { active, setActive, noFlag, onFail } })

  // ── Pedido de rotação até um país ──
  useEffect(() => {
    if (!focus) return
    const n = nodes.find(x => x.id === focus.id)
    if (n) api.current?.focusTo(n.lat, n.lon)
  }, [focus])

  // ── Cena 3D + camada de marcadores ──
  useEffect(() => {
    const stage = stageRef.current, host = hostRef.current
    if (!stage || !host) return
    let disposed = false
    const fail = (why: string) => { if (!disposed) live.current.onFail(why) }

    let renderer: WebGLRenderer
    try { renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }) }
    catch { fail('webgl'); return }
    renderer.setClearColor(0x000000, 0)
    const canvas = renderer.domElement
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
    canvas.setAttribute('aria-hidden', 'true')
    host.appendChild(canvas)
    const onLost = (e: Event) => { e.preventDefault(); fail('context-lost') }
    canvas.addEventListener('webglcontextlost', onLost)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const scene = new Scene()
    const camera = new PerspectiveCamera(FOV, 1, 0.1, 50)
    const sun = new Vector3(-0.42, 0.36, 0.86).normalize()
    const earthMat = new ShaderMaterial({
      vertexShader: EARTH_VERT, fragmentShader: EARTH_FRAG,
      uniforms: { uMap: { value: null as Texture | null }, uSun: { value: sun }, uTexel: { value: new Vector2(1 / 2048, 1 / 1024) }, uRelief: { value: 1.0 } },
    })
    const earthGeo = new SphereGeometry(1, 128, 96)
    const earth = new Mesh(earthGeo, earthMat)
    scene.add(earth)
    const atmoMat = new ShaderMaterial({
      vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG, side: BackSide, transparent: true, depthWrite: false, blending: AdditiveBlending,
      uniforms: { uSun: { value: sun }, uInner: { value: Math.sqrt(1 - 1 / (SHELL * SHELL)) } },
    })
    const atmoGeo = new SphereGeometry(SHELL, 96, 64)
    scene.add(new Mesh(atmoGeo, atmoMat))

    // ── Estado da vista ──
    const view = { lon: INITIAL_VIEW.lon, lat: INITIAL_VIEW.lat }
    let W = 0, H = 0, D = 4, Rpx = 200
    const euler = new Euler(0, 0, 0, 'XYZ')
    const q = new Quaternion()
    const local = nodes.map(n => unit(n.lat, n.lon))
    const world = nodes.map(() => new Vector3())
    const sx = new Float32Array(nodes.length), sy = new Float32Array(nodes.length), fade = new Float32Array(nodes.length), face = new Float32Array(nodes.length)
    const cur = nodes.map(() => ({ x: 0, y: 0, init: false }))
    const tmp = new Vector3(), C = new Vector3()
    let raf = 0, inView = true, tween: { t0: number; dur: number; lon0: number; lat0: number; lon1: number; lat1: number } | null = null
    let vLon = 0, vLat = 0, dragging = false, settling = false, lastT = 0, texReady = false, needsDraw = true

    const idx: Record<string, number> = {}; nodes.forEach((n, i) => { idx[n.id] = i })
    const arcSpec = connections.map(([a, b]) => {
      const va = local[idx[a]], vb = local[idx[b]]
      const omega = Math.acos(clamp(va.dot(vb), -1, 1))
      return { a: va, b: vb, omega, n: clamp(Math.ceil(omega * DEG / 2.5), 16, 56), h: clamp(0.24 * omega / Math.PI, 0.025, 0.2) }
    })

    const visibleFromCamera = (Q: Vector3) => {
      // O raio câmara→Q atravessa a esfera unitária antes de Q? (então Q está atrás da Terra)
      const dx = Q.x, dy = Q.y, dz = Q.z - D
      const a = dx * dx + dy * dy + dz * dz, b = 2 * (C.z * dz), c = D * D - 1
      const disc = b * b - 4 * a * c
      if (disc <= 0) return true
      const t1 = (-b - Math.sqrt(disc)) / (2 * a)
      return !(t1 > 1e-4 && t1 < 0.9992)
    }
    const projX = (Q: Vector3) => { tmp.copy(Q).project(camera); return tmp }

    function resize() {
      const r = stage!.getBoundingClientRect(); W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height))
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      renderer.setPixelRatio(dpr); renderer.setSize(W, H, false)
      const f = Math.min(0.9 * H, 0.96 * W) / H                     // diâmetro do globo ≈ 90 % da altura (ou 96 % da largura)
      const alpha = Math.atan(f * Math.tan(FOV * RAD / 2))
      D = 1 / Math.sin(alpha); Rpx = f * H / 2
      camera.aspect = W / H; camera.position.set(0, 0, D); C.set(0, 0, D); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true)
      if (starsRef.current) paintStars(starsRef.current, W, H, dpr)
      cur.forEach(c => { c.init = false })
      kick()
    }

    function layout() {
      const L = live.current
      q.setFromEuler(euler.set(view.lat * RAD, -(view.lon + 90) * RAD, 0))
      const zMin = 1 / D
      const vis: number[] = []
      for (let i = 0; i < nodes.length; i++) {
        world[i].copy(local[i]).applyQuaternion(q)
        const z = world[i].z
        fade[i] = smooth(zMin + 0.05, zMin + 0.2, z); face[i] = clamp((z - zMin) / (1 - zMin), 0, 1)
        const p = projX(world[i]); sx[i] = (p.x * 0.5 + 0.5) * W; sy[i] = (-p.y * 0.5 + 0.5) * H
        if (fade[i] > 0.02) vis.push(i)
      }
      // Pontos: achatados na direcção do limbo (seguem a curvatura da superfície)
      for (let i = 0; i < nodes.length; i++) {
        const el = dotRefs.current[nodes[i].id]; if (!el) continue
        if (fade[i] <= 0.02) { el.setAttribute('opacity', '0'); el.style.pointerEvents = 'none'; continue }
        const ang = Math.atan2(sy[i] - H / 2, sx[i] - W / 2) * DEG
        el.setAttribute('transform', `translate(${sx[i].toFixed(1)} ${sy[i].toFixed(1)}) rotate(${ang.toFixed(1)}) scale(${(0.3 + 0.7 * Math.sqrt(face[i])).toFixed(3)} 1)`)
        el.setAttribute('opacity', fade[i].toFixed(2)); el.style.pointerEvents = fade[i] > 0.4 ? 'auto' : 'none'
      }
      // Rótulos: para cada ponto (do mais central para o limbo) escolhe-se a primeira posição livre entre as candidatas
      // (lado preferido, restantes lados, depois círculos cada vez maiores), sem tapar outros rótulos nem pontos.
      // Quando o rótulo se afasta do ponto, desenha-se uma linha de ligação.
      const order = vis.slice().sort((a, b) => face[b] - face[a])
      const placed: { x: number; y: number; w: number; h: number }[] = []
      const rects = new Map<number, { x: number; y: number; w: number; h: number }>()
      const hits = (r: { x: number; y: number; w: number; h: number }, self: number) => {
        let pen = 0
        if (r.x < 3 || r.y < 3 || r.x + r.w > W - 3 || r.y + r.h > H - 3) pen += 1e4
        for (const o of placed) { const ox = Math.min(r.x + r.w, o.x + o.w) - Math.max(r.x, o.x) + 2, oy = Math.min(r.y + r.h, o.y + o.h) - Math.max(r.y, o.y) + 2; if (ox > 0 && oy > 0) pen += ox * oy }
        for (const j of vis) if (sx[j] > r.x - 6 && sx[j] < r.x + r.w + 6 && sy[j] > r.y - 6 && sy[j] < r.y + r.h + 6) pen += j === self ? 300 : 120
        return pen
      }
      for (const i of order) {
        const n = nodes[i], hasFlag = !L.noFlag[n.id]
        const o = { x: sx[i], y: sy[i], code: n.code }
        const sides: ('t' | 'b' | 'l' | 'r')[] = [n.pos, ({ t: 'b', b: 't', l: 'r', r: 'l' } as const)[n.pos], ...(n.pos === 't' || n.pos === 'b' ? (['r', 'l'] as const) : (['t', 'b'] as const))]
        const cand = sides.map(sd => labelBox({ ...o, pos: n.pos }, 1, hasFlag, sd))
        const base = labelBox({ ...o, pos: 't' }, 1, hasFlag)
        for (const rad of [30, 48, 66, 86]) for (let a = 0; a < 12; a++) {
          const th = (a * 30 + 15) * RAD
          cand.push({ x: sx[i] + Math.cos(th) * rad - base.w / 2, y: sy[i] + Math.sin(th) * rad - base.h / 2, w: base.w, h: base.h })
        }
        let best = cand[0], bestPen = Infinity
        for (const c of cand) { const pen = hits(c, i); if (pen < bestPen) { best = c; bestPen = pen; if (pen === 0) break } }
        placed.push(best); rects.set(i, best)
      }
      settling = false
      const shown = new Set<number>()
      for (const [i, r] of rects) {
        const c = cur[i], n = nodes[i]; shown.add(i)
        if (!c.init || reduced.matches) { c.x = r.x; c.y = r.y; c.init = true }
        else { c.x += (r.x - c.x) * 0.34; c.y += (r.y - c.y) * 0.34; if (Math.abs(r.x - c.x) > 0.4 || Math.abs(r.y - c.y) > 0.4) settling = true }
        const el = labelRefs.current[n.id]
        if (el) { el.setAttribute('transform', `translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`); el.setAttribute('opacity', fade[i].toFixed(2)); el.style.pointerEvents = fade[i] > 0.4 ? 'auto' : 'none' }
        const ln = leaderRefs.current[n.id]
        if (ln) {
          const px = clamp(sx[i], c.x, c.x + r.w), py = clamp(sy[i], c.y, c.y + r.h)
          if (Math.hypot(sx[i] - px, sy[i] - py) > 9) { ln.setAttribute('x1', sx[i].toFixed(1)); ln.setAttribute('y1', sy[i].toFixed(1)); ln.setAttribute('x2', px.toFixed(1)); ln.setAttribute('y2', py.toFixed(1)); ln.setAttribute('opacity', (fade[i] * 0.9).toFixed(2)) }
          else ln.setAttribute('opacity', '0')
        }
        const tip = tipRefs.current[n.id]
        if (tip) tip.setAttribute('transform', `translate(0 ${c.y < 34 ? LBL.h + 5 : -(LBL.h + 5)})`)
      }
      for (let i = 0; i < nodes.length; i++) if (!shown.has(i)) {
        const el = labelRefs.current[nodes[i].id]; if (el) { el.setAttribute('opacity', '0'); el.style.pointerEvents = 'none' }
        const ln = leaderRefs.current[nodes[i].id]; if (ln) ln.setAttribute('opacity', '0')
      }
      // Rotas: arcos entre as mesmas origens e destinos; só os troços visíveis (os de trás da Terra são omitidos)
      const P = new Vector3(), S = new Vector2()
      arcSpec.forEach((arc, ci) => {
        const el = arcRefs.current[ci]; if (!el) return
        let d = '', pen = false
        const sinO = Math.sin(arc.omega) || 1
        for (let s = 0; s <= arc.n; s++) {
          const t = s / arc.n
          P.copy(arc.a).multiplyScalar(Math.sin((1 - t) * arc.omega) / sinO).addScaledVector(arc.b, Math.sin(t * arc.omega) / sinO).normalize()
          P.multiplyScalar(1.004 + arc.h * Math.sin(Math.PI * t)).applyQuaternion(q)
          if (!visibleFromCamera(P)) { pen = false; continue }
          const p = projX(P); S.set((p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H)
          d += `${pen ? 'L' : 'M'}${S.x.toFixed(1)} ${S.y.toFixed(1)}`; pen = true
        }
        el.setAttribute('d', d)
      })
    }

    function draw() {
      earth.quaternion.copy(q.setFromEuler(euler.set(view.lat * RAD, -(view.lon + 90) * RAD, 0)))
      earth.updateMatrixWorld(true)
      if (texReady) renderer.render(scene, camera)
      layout()
    }

    function frame(now: number) {
      raf = 0
      const dt = Math.min(48, lastT ? now - lastT : 16); lastT = now
      let changed = false
      if (tween) {
        const t = clamp((now - tween.t0) / tween.dur, 0, 1), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
        view.lon = tween.lon0 + (tween.lon1 - tween.lon0) * e; view.lat = tween.lat0 + (tween.lat1 - tween.lat0) * e
        if (t >= 1) tween = null
        changed = true
      } else if (!dragging && (Math.abs(vLon) > 0.002 || Math.abs(vLat) > 0.002)) {
        view.lon += vLon * dt; view.lat = clamp(view.lat + vLat * dt, -LAT_MAX, LAT_MAX)
        const k = Math.pow(0.94, dt / 16); vLon *= k; vLat *= k; changed = true
      }
      if (view.lon > 180) view.lon -= 360; else if (view.lon < -180) view.lon += 360
      if (changed || settling || dragging || needsDraw) { needsDraw = false; draw() }
      if (tween || dragging || settling || Math.abs(vLon) > 0.002 || Math.abs(vLat) > 0.002) kick()
      else lastT = 0
    }
    function kick() { if (!raf && inView && !document.hidden && !disposed) raf = requestAnimationFrame(frame) }
    const redraw = () => { needsDraw = true; kick() }

    api.current = {
      focusTo(lat, lon) {
        const lat1 = clamp(lat, -LAT_MAX, LAT_MAX), dLon = ((lon - view.lon + 540) % 360) - 180
        vLon = vLat = 0
        if (reduced.matches) { view.lon += dLon; view.lat = lat1; redraw(); return }
        tween = { t0: performance.now(), dur: 800, lon0: view.lon, lat0: view.lat, lon1: view.lon + dLon, lat1 }; lastT = 0; kick()
      },
      nudge(dLon, dLat) { tween = null; vLon = vLat = 0; view.lon += dLon; view.lat = clamp(view.lat + dLat, -LAT_MAX, LAT_MAX); redraw() },
      reset() { api.current?.focusTo(INITIAL_VIEW.lat, INITIAL_VIEW.lon) },
    }

    // ── Arrastar para rodar (o scroll vertical da página fica livre: touch-action: pan-y) ──
    let pid = -1, moved = false, startX = 0, startY = 0, lastX = 0, lastY = 0, lastMove = 0, suppress = false
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if ((e.target as Element).closest('button')) return
      pid = e.pointerId; moved = false; dragging = false; startX = lastX = e.clientX; startY = lastY = e.clientY; lastMove = performance.now()
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pid) return
      if (!moved) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < 6) return
        moved = true; dragging = true; tween = null; vLon = vLat = 0; setTouched(true)
        try { stage.setPointerCapture(pid) } catch { /* sem captura: continua a seguir o ponteiro */ }
        stage.style.cursor = 'grabbing'
      }
      const dx = e.clientX - lastX, dy = e.clientY - lastY, now = performance.now(), dt = Math.max(1, now - lastMove)
      lastX = e.clientX; lastY = e.clientY; lastMove = now
      const dLon = -(dx / (Rpx * Math.max(0.35, Math.cos(view.lat * RAD)))) * DEG, dLat = (dy / Rpx) * DEG
      view.lon += dLon; view.lat = clamp(view.lat + dLat, -LAT_MAX, LAT_MAX)
      vLon = vLon * 0.6 + (dLon / dt) * 0.4; vLat = vLat * 0.6 + (dLat / dt) * 0.4
      redraw()
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pid) return
      pid = -1; dragging = false; stage.style.cursor = 'grab'
      if (moved) { suppress = true; setTimeout(() => { suppress = false }, 0) }
      if (reduced.matches || e.type === 'pointercancel' || performance.now() - lastMove > 90) vLon = vLat = 0
      kick()
    }
    const onClickCapture = (e: MouseEvent) => { if (suppress) { e.stopPropagation(); e.preventDefault() } }
    stage.addEventListener('pointerdown', onDown); stage.addEventListener('pointermove', onMove)
    stage.addEventListener('pointerup', onUp); stage.addEventListener('pointercancel', onUp); stage.addEventListener('click', onClickCapture, true)

    const ro = new ResizeObserver(resize); ro.observe(stage)
    const io = new IntersectionObserver(([en]) => { inView = en.isIntersecting; if (inView) { lastT = 0; redraw() } })
    io.observe(stage)
    const onVis = () => { if (!document.hidden) redraw() }
    document.addEventListener('visibilitychange', onVis)

    // ── Textura (carregada já com a secção perto do ecrã); 4K em ecrãs grandes, 2K nos restantes ──
    const maxTex = renderer.capabilities.maxTextureSize
    resize()
    const big = Rpx * 2 * Math.min(window.devicePixelRatio || 1, 2) >= 900 && maxTex >= 4096
    const timer = window.setTimeout(() => fail('timeout'), 25000)
    new TextureLoader().load(
      big ? '/textures/earth-blue-marble-4k.jpg' : '/textures/earth-blue-marble-2k.jpg',
      tex => {
        window.clearTimeout(timer)
        if (disposed) { tex.dispose(); return }
        tex.wrapS = RepeatWrapping; tex.wrapT = ClampToEdgeWrapping; tex.minFilter = LinearMipmapLinearFilter; tex.magFilter = LinearFilter
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); tex.generateMipmaps = true
        const img = tex.image as { width: number; height: number }
        earthMat.uniforms.uMap.value = tex; (earthMat.uniforms.uTexel.value as Vector2).set(1 / img.width, 1 / img.height)
        texReady = true; draw(); setReady(true); kick()
      },
      undefined,
      () => { window.clearTimeout(timer); fail('texture') },
    )

    return () => {
      disposed = true
      window.clearTimeout(timer); if (raf) cancelAnimationFrame(raf)
      api.current = null
      ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis)
      stage.removeEventListener('pointerdown', onDown); stage.removeEventListener('pointermove', onMove)
      stage.removeEventListener('pointerup', onUp); stage.removeEventListener('pointercancel', onUp); stage.removeEventListener('click', onClickCapture, true)
      canvas.removeEventListener('webglcontextlost', onLost)
      earthGeo.dispose(); atmoGeo.dispose(); earthMat.dispose(); atmoMat.dispose(); (earthMat.uniforms.uMap.value as Texture | null)?.dispose()
      renderer.dispose(); renderer.forceContextLoss(); canvas.remove()
    }
  }, [])

  const onKey = useCallback((e: React.KeyboardEvent) => {
    const a = api.current; if (!a) return
    const k = e.key
    if (k === 'ArrowLeft') a.nudge(-14, 0); else if (k === 'ArrowRight') a.nudge(14, 0)
    else if (k === 'ArrowUp') a.nudge(0, 10); else if (k === 'ArrowDown') a.nudge(0, -10)
    else if (k === 'Home') a.reset(); else return
    e.preventDefault(); setTouched(true)
  }, [])
  const btn = 'w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white/25 focus-visible:bg-white/25 text-white text-sm leading-none flex items-center justify-center backdrop-blur-sm border border-white/15 transition-colors'

  const nodeEls = (render: (n: GpNode, i: number) => React.ReactNode) => nodes.map(render)
  const lbl = (n: GpNode) => ({ hasFlag: !noFlag[n.id], bx: labelBox({ x: 0, y: 0, code: n.code, pos: 't' }, 1, !noFlag[n.id]) })

  return (
    <div ref={stageRef} className="absolute inset-0 select-none outline-none focus-visible:ring-2 focus-visible:ring-[#F5B700] rounded-2xl"
      style={{ touchAction: 'pan-y', cursor: 'grab' }} data-testid="gp-globe" role="group" tabIndex={0} onKeyDown={onKey}
      aria-label="Globo interativo com os países atendidos. Arraste para rodar, ou use as setas do teclado.">
      <canvas ref={starsRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />
      <div ref={hostRef} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: ready ? 1 : 0 }} />
      <svg className="absolute inset-0 w-full h-full transition-opacity duration-700" style={{ pointerEvents: 'none', opacity: ready ? 1 : 0 }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="gp3-drop" x="-10%" y="-20%" width="120%" height="150%"><feDropShadow dx="0" dy="1" stdDeviation="1.6" floodColor="#000" floodOpacity="0.45" /></filter>
          <filter id="gp3-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {/* Rotas (arcos): mesmas classes e animação do mapa plano */}
        {connections.map(([a, b], i) => {
          const isActive = active === a || active === b
          return <path key={i} ref={el => { arcRefs.current[i] = el }} d="" fill="none" stroke="#F5B700" strokeWidth={isActive ? 1.9 : 1.15} strokeLinecap="round"
            strokeDasharray="5 8" opacity={isActive ? 0.95 : 0.5} className="gp-flow" style={{ animationDuration: `${1.4 + (i % 7) * 0.15}s` }} />
        })}
        {/* Pontos de presença */}
        {nodeEls(node => {
          const isActive = active === node.id
          const delay = ((node.x * 3 + node.y * 7) % 2800) / 2800 * 2.8
          return (
            <g key={node.id} ref={el => { dotRefs.current[node.id] = el }} opacity="0" data-testid="gp-dot" data-code={node.code} style={{ cursor: 'pointer' }}
              onMouseEnter={() => setActive(node.id)} onMouseLeave={() => setActive(null)}>
              <circle r="12" fill="transparent" />
              <circle r="8" fill="none" stroke="#F5B700" strokeWidth="1.5" opacity="0" className="gp-ring" style={{ animation: 'gp-ring 2.8s ease-out infinite', animationDelay: `${delay}s` }} />
              <circle r={isActive ? 15 : 10} fill="#F5B700" opacity={isActive ? 0.3 : 0.16} style={{ transition: 'r 0.2s,opacity 0.2s' }} />
              <circle r={isActive ? 5 : 3.8} fill="#F5B700" stroke="white" strokeWidth="1.4" className="gp-dot" style={{ animationDelay: `${delay}s`, transition: 'r 0.2s' }} filter={isActive ? 'url(#gp3-glow)' : undefined} />
            </g>
          )
        })}
        {/* Linhas de ligação dos rótulos que precisam de se afastar do ponto */}
        {nodeEls(node => <line key={node.id} ref={el => { leaderRefs.current[node.id] = el }} stroke="#F5B700" strokeWidth="1" strokeLinecap="round" opacity="0" />)}
        {/* Rótulos: bandeira (decorativa) + código ISO, sempre legíveis mesmo sem a imagem */}
        {nodeEls(node => {
          const { hasFlag, bx } = lbl(node), isActive = active === node.id
          const fx = LBL.pad, fy = (LBL.h - LBL.flagH) / 2
          return (
            <g key={node.id} ref={el => { labelRefs.current[node.id] = el }} opacity="0" data-testid="gp-marker" data-code={node.code} style={{ cursor: 'pointer' }}
              onMouseEnter={() => setActive(node.id)} onMouseLeave={() => setActive(null)} onClick={() => { setActive(node.id); api.current?.focusTo(node.lat, node.lon) }}>
              <rect x={0} y={0} width={bx.w} height={bx.h} rx={4} fill="white" stroke={isActive ? '#F5B700' : '#CBD8E6'} strokeWidth={isActive ? 1.5 : 0.8} filter="url(#gp3-drop)" style={{ transition: 'stroke 0.2s' }} />
              {hasFlag && <image href={flagSrc(node.id)} x={fx} y={fy} width={LBL.flagW} height={LBL.flagH} preserveAspectRatio="xMidYMid slice" aria-hidden="true" data-testid="gp-marker-flag" onError={() => onFlagError(node.id)} />}
              {hasFlag && <rect x={fx} y={fy} width={LBL.flagW} height={LBL.flagH} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth={0.6} aria-hidden="true" />}
              <text x={hasFlag ? fx + LBL.flagW + LBL.gap : LBL.pad} y={bx.h / 2} textAnchor="start" dominantBaseline="central" fontSize={LBL.font} fontWeight="800" fill="#0A0A0A"
                style={{ userSelect: 'none', letterSpacing: 0.2 }} data-testid="gp-marker-code">{node.code}</text>
              {/* Nome ao passar o rato */}
              {isActive && (() => {
                const nb = labelBox({ x: bx.w / 2, y: 0, code: node.code, pos: 't' }, 1, false, 't', node.name, 11)
                return (
                  <g ref={el => { tipRefs.current[node.id] = el }} style={{ pointerEvents: 'none' }}>
                    <rect x={nb.x} y={0} width={nb.w} height={nb.h} rx={4} fill="#0A0A0A" opacity="0.9" stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" />
                    <text x={nb.x + nb.w / 2} y={nb.h / 2} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="700" fill="white">{node.name}</text>
                  </g>
                )
              })()}
            </g>
          )
        })}
      </svg>

      <div className="absolute left-1/2 -translate-x-1/2 sm:left-3 sm:translate-x-0 bottom-3 flex gap-1.5 transition-opacity duration-700" style={{ opacity: ready ? 1 : 0 }}>
        <button type="button" className={btn} aria-label="Rodar o globo para a esquerda" onClick={() => { api.current?.nudge(-18, 0); setTouched(true) }}>←</button>
        <button type="button" className={btn} aria-label="Rodar o globo para a direita" onClick={() => { api.current?.nudge(18, 0); setTouched(true) }}>→</button>
        <button type="button" className={btn} aria-label="Inclinar o globo para norte" onClick={() => { api.current?.nudge(0, 12); setTouched(true) }}>↑</button>
        <button type="button" className={btn} aria-label="Inclinar o globo para sul" onClick={() => { api.current?.nudge(0, -12); setTouched(true) }}>↓</button>
        <button type="button" className={btn} aria-label="Repor a vista inicial (África e Atlântico)" onClick={() => api.current?.reset()} data-testid="gp-globe-reset">⟲</button>
      </div>
      <p className="absolute left-0 right-0 bottom-[3.4rem] sm:bottom-3 text-center text-[11px] text-white/60 pointer-events-none transition-opacity duration-700" style={{ opacity: ready && !touched ? 1 : 0 }} data-testid="gp-globe-hint">
        Arraste para rodar o globo
      </p>
      <p className="absolute top-2 left-3 sm:top-auto sm:left-auto sm:bottom-2 sm:right-3 text-[9.5px] text-white/45 sm:text-right max-w-[60%] sm:max-w-[40%] leading-tight pointer-events-none" data-testid="gp-globe-credit">
        Textura: NASA Earth Observatory (Blue Marble)
      </p>
      {!ready && <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true"><span className="w-7 h-7 rounded-full border-2 border-white/20 border-t-[#F5B700] animate-spin" /></div>}
    </div>
  )
}
