import { gsap } from 'gsap'
import { type MouseEvent, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Magnetic } from '@/components/motion/magnetic'
import { useReducedMotion } from '@/hooks/use-media-query'
import { HGT_URL } from '@/i18n'
import { getLenis } from '@/lib/smooth-scroll'
import { cn } from '@/lib/utils'

import { PaperGrid, useList } from './hgt-kit'
import { ACT_STARTS, ACTS, actProgress, onActEnter, onHgtFrame, pointer, smooth } from './hgt-store'

type Glyph = {
  hx: number
  hy: number
  x: number
  y: number
  vx: number
  vy: number
  text: string
  size: number
  alpha: number
  phase: number
}

/**
 * 终幕：滚动拆封的「汤底/入席信封」。
 * 追光上方浮现「砚已经看过了汤底。」，舞台中央是一封合拢封缄的墨黑信封；
 * 随幕内滚动推进，火漆解封、上折盖沿顶边折痕 3D 向上翻开（0° → 180°），
 * 米白宣纸「进入海龟汤」入席邀请卡自封口向上平滑抽出，并盖下清晰的「凭邀请入座」红章。
 */
export function ActSeat({ index }: { index: number }) {
  const { t, i18n } = useTranslation()
  const reduced = useReducedMotion()
  const zh = i18n.language.startsWith('zh')
  const root = useRef<HTMLDivElement>(null)
  const spot = useRef<HTMLDivElement>(null)
  const header = useRef<HTMLDivElement>(null)
  const stageEnvelope = useRef<HTMLDivElement>(null)
  const envelope = useRef<HTMLDivElement>(null)
  const pocketBox = useRef<HTMLDivElement>(null)
  const flap = useRef<HTMLDivElement>(null)
  const flapOuter = useRef<SVGGElement>(null)
  const flapInner = useRef<SVGGElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const stamp = useRef<HTMLSpanElement>(null)
  const hint = useRef<HTMLParagraphElement>(null)
  const button = useRef<HTMLAnchorElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const light = useRef<HTMLDivElement>(null)
  const glyphs = useList('hgtPage.seat.glyphs')
  const seal = useList('hgtPage.seat.seal')
  const launching = useRef(false)
  const focused = useRef(false)
  const openRef = useRef(0)

  // 追光自上而下打亮，引言与封缄信封依次浮现
  useEffect(
    () =>
      onActEnter((event) => {
        if (event.index !== index) return
        if (reduced) {
          gsap.set([spot.current, header.current, stageEnvelope.current], { clearProps: 'all' })
          return
        }
        const quick = event.via === 'jump'
        gsap
          .timeline()
          .fromTo(
            spot.current,
            { clipPath: 'circle(0% at 50% 0%)', opacity: 0 },
            { clipPath: 'circle(140% at 50% 0%)', opacity: 1, duration: quick ? 0.6 : 1.35, ease: 'expo.out' },
          )
          .fromTo(
            spot.current,
            { filter: 'brightness(.3)' },
            { filter: 'brightness(1)', duration: 0.24, ease: 'steps(3)' },
            0,
          )
          .fromTo(
            header.current,
            { opacity: 0, y: -14 },
            { opacity: 1, y: 0, duration: 0.85, ease: 'expo.out' },
            quick ? 0.08 : 0.28,
          )
          .fromTo(
            stageEnvelope.current,
            { opacity: 0, y: 36, scale: 0.94 },
            { opacity: 1, y: 0, scale: 1, duration: 1.05, ease: 'expo.out' },
            quick ? 0.16 : 0.48,
          )
      }),
    [index, reduced],
  )

  // 白光切开黑幕后才离开；从浏览器后退回来时把幕收起
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      launching.current = false
      gsap.set(light.current, { clipPath: 'inset(50% 0% 50% 0%)', display: 'none' })
    }
    window.addEventListener('pageshow', reset)
    return () => window.removeEventListener('pageshow', reset)
  }, [])

  // 四散的「是」「不是」、滚动拆封三段式动效（翻盖 → 抽卡 → 盖章）与三维透视倾斜
  useEffect(() => {
    const element = root.current
    const target = canvas.current
    if (!element || !target) return
    const ctx = target.getContext('2d')
    if (!ctx) return
    let list: Glyph[] = []
    let width = 0
    let height = 0
    let dpr = 1
    let pull = 0
    let touchPull = 0
    let rx = 0
    let ry = 0
    let gx = 50
    let gy = 28
    let smoothOpen = reduced ? 1 : 0

    const seed = () => {
      width = element.clientWidth
      height = element.clientHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      target.width = Math.round(width * dpr)
      target.height = Math.round(height * dpr)
      const count = Math.round(Math.min(320, Math.max(120, (width * height) / 5200)))
      const envRect = pocketBox.current?.getBoundingClientRect()
      const headRect = header.current?.getBoundingClientRect()
      const host = element.getBoundingClientRect()
      const avoidEnv = envRect
        ? {
            x: envRect.left - host.left - 32,
            y: envRect.top - host.top - 120,
            w: envRect.width + 64,
            h: envRect.height + 150,
          }
        : { x: 0, y: 0, w: 0, h: 0 }
      const avoidHead = headRect
        ? {
            x: headRect.left - host.left - 24,
            y: headRect.top - host.top - 16,
            w: headRect.width + 48,
            h: headRect.height + 32,
          }
        : { x: 0, y: 0, w: 0, h: 0 }
      const inside = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) =>
        x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h

      list = Array.from({ length: count }, (_, i) => {
        let hx = Math.random() * width
        let hy = Math.random() * height
        for (let tries = 0; tries < 8 && (inside(hx, hy, avoidEnv) || inside(hx, hy, avoidHead)); tries++) {
          hx = Math.random() * width
          hy = Math.random() * height
        }
        return {
          hx,
          hy,
          x: hx,
          y: hy,
          vx: 0,
          vy: 0,
          text: glyphs[i % Math.max(1, glyphs.length)] ?? '是',
          size: 9 + Math.random() * 7,
          alpha: 0.12 + Math.random() * 0.32,
          phase: Math.random() * Math.PI * 2,
        }
      })
    }
    seed()
    const observer = new ResizeObserver(seed)
    observer.observe(element)
    const press = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') touchPull = 1
      if (openRef.current < 0.75) {
        const targetU = ACT_STARTS[index] + ACTS[index].screens * 0.88
        const targetY = targetU * window.innerHeight
        const lenis = getLenis()
        if (lenis) lenis.scrollTo(targetY, { duration: 1.1 })
        else window.scrollTo({ top: targetY, behavior: 'smooth' })
      }
    }
    envelope.current?.addEventListener('pointerdown', press)

    const off = onHgtFrame((frame) => {
      const act = element.closest('[data-act]')
      if (frame.shown !== index && !act?.hasAttribute('data-cut')) return
      const { dt, time } = frame
      const p = actProgress(frame.u, index)

      // 幕内滚动进度驱动拆封总进度（0 = 合拢封缄，1 = 完全拆开并抽出邀请卡）
      const targetOpen = reduced || focused.current || launching.current ? 1 : smooth(0.02, 0.78, p)
      smoothOpen += (targetOpen - smoothOpen) * (reduced ? 1 : 1 - Math.exp(-dt * 10))
      openRef.current = smoothOpen

      const box = pocketBox.current?.getBoundingClientRect()
      const host = element.getBoundingClientRect()
      if (!box) return
      const cx = box.left - host.left + box.width / 2
      const cy = box.top - host.top + box.height / 2
      const hw = box.width / 2
      const hh = box.height / 2

      // 指针距离信封边缘的最近距离
      const edge =
        pointer.x >= 0
          ? Math.hypot(Math.max(0, Math.abs(pointer.x - cx) - hw), Math.max(0, Math.abs(pointer.y - cy) - hh * 1.3))
          : 1e4
      touchPull = Math.max(0, touchPull - dt * 0.6)
      const nearRadius = Math.min(280, host.width * 0.2)
      const near = pointer.fine && pointer.moved ? 1 - smooth(0, nearRadius, edge) : 0
      const goal = launching.current || focused.current ? 1 : Math.max(near, touchPull)
      pull += (goal - pull) * (1 - Math.exp(-dt * 5))
      element.style.setProperty('--pull', Math.max(pull, smoothOpen * 0.5).toFixed(3))
      element.style.setProperty('--open', smoothOpen.toFixed(3))

      // 信封随指针做细腻的 3D 透视倾斜与纸面反光位移
      let targetRx = 0
      let targetRy = 0
      let targetGx = 50
      let targetGy = 28
      if (!reduced && pointer.fine && pointer.moved && pointer.x >= 0) {
        const nx = Math.max(-1.35, Math.min(1.35, (pointer.x - cx) / Math.max(1, hw)))
        const ny = Math.max(-1.35, Math.min(1.35, (pointer.y - cy) / Math.max(1, hh)))
        targetRx = -ny * 4.5
        targetRy = nx * 5.5
        targetGx = 50 + nx * 28
        targetGy = 35 + ny * 24
      } else if (!reduced) {
        targetRx = Math.sin(time * 0.55) * 1.2
        targetRy = Math.cos(time * 0.42) * 1.6
      }
      const easeTilt = 1 - Math.exp(-dt * 8)
      rx += (targetRx - rx) * easeTilt
      ry += (targetRy - ry) * easeTilt
      gx += (targetGx - gx) * easeTilt
      gy += (targetGy - gy) * easeTilt

      if (envelope.current) {
        const lift = 1 + smoothOpen * 0.02 + near * 0.012
        envelope.current.style.transform = reduced
          ? 'none'
          : `perspective(1200px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${lift.toFixed(4)})`
        envelope.current.style.setProperty('--gx', `${gx.toFixed(1)}%`)
        envelope.current.style.setProperty('--gy', `${gy.toFixed(1)}%`)
      }

      // 第一阶段（smoothOpen 0 → 0.48）：信封上折盖沿顶边折痕 3D 翻开（0° 合拢在最前 → 180° 掀开在卡后）
      const flapPhase = smooth(0, 0.48, smoothOpen)
      const flapDeg = flapPhase * 180
      const isPastHalf = flapDeg >= 90
      if (flap.current) {
        flap.current.style.zIndex = isPastHalf ? '12' : '40'
        flap.current.style.transform = `perspective(1100px) rotateX(${flapDeg.toFixed(1)}deg)`
      }
      if (flapOuter.current && flapInner.current) {
        flapOuter.current.style.opacity = isPastHalf ? '0' : '1'
        flapInner.current.style.opacity = isPastHalf ? '1' : '0'
      }

      // 第二阶段（smoothOpen 0.34 → 0.92）：米白宣纸入席邀请卡自信封袋内向上抽出
      const cardPhase = smooth(0.34, 0.92, smoothOpen)
      if (card.current) {
        const hoverBoost = cardPhase > 0.7 ? near * 8 : 0
        const yPercent = (1 - cardPhase) * 58 - cardPhase * 38
        card.current.style.transform = `translate3d(0, calc(${yPercent.toFixed(2)}% - ${hoverBoost.toFixed(1)}px), 0)`
        card.current.style.pointerEvents = cardPhase > 0.6 ? 'auto' : 'none'
      }

      // 第三阶段（smoothOpen 0.68 → 0.98）：「凭邀请入座」红章落定
      const stampPhase = smooth(0.68, 0.98, smoothOpen)
      if (stamp.current) {
        const stampScale = 1.32 - stampPhase * 0.32
        stamp.current.style.opacity = stampPhase.toFixed(3)
        stamp.current.style.transform = `rotate(-8deg) scale(${stampScale.toFixed(3)})`
      }

      if (hint.current) {
        hint.current.style.opacity = (1 - smooth(0.05, 0.35, smoothOpen)).toFixed(3)
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const glyph of list) {
        if (!reduced) {
          const dx = cx - glyph.x
          const dy = cy - glyph.y
          const dist = Math.hypot(dx, dy) || 1
          const activePull = Math.max(pull, smoothOpen * 0.35)
          const force = 0.28 * activePull
          const swirl = activePull * 18
          glyph.vx += (dx * force + (-dy / dist) * swirl + (glyph.hx - glyph.x) * 2.6) * dt
          glyph.vy += (dy * force + (dx / dist) * swirl + (glyph.hy - glyph.y) * 2.6) * dt
          glyph.vx += Math.cos(time * 0.4 + glyph.phase) * 6 * dt
          glyph.vy += Math.sin(time * 0.33 + glyph.phase) * 6 * dt
          const damp = Math.exp(-dt * 3.6)
          glyph.vx *= damp
          glyph.vy *= damp
          glyph.x += glyph.vx * dt
          glyph.y += glyph.vy * dt
        }
        // 信封本体、上方主句与顶栏 HUD 消隐，不让漂浮字压住正文与坐标
        const inEnvX = Math.abs(glyph.x - cx) / Math.max(1, hw * 1.1)
        const inEnvY = Math.abs(glyph.y - (cy - hh * 0.25)) / Math.max(1, hh * 1.45)
        const envDist = Math.max(inEnvX, inEnvY)
        const swallowed = 1 - smooth(0.84, 1.08, envDist)
        const topHudFade = smooth(44, 84, glyph.y)
        const headFade =
          glyph.y < height * 0.25 && Math.abs(glyph.x - width * 0.5) < Math.min(340, width * 0.38) ? 0.12 : 1
        const alpha = glyph.alpha * (1 - swallowed) * topHudFade * headFade * (1 + pull * 0.85)
        if (alpha < 0.01) continue
        ctx.globalAlpha = Math.min(1, alpha)
        ctx.fillStyle = glyph.text === glyphs[0] ? '#f2efe6' : '#c9c3b4'
        ctx.font = `600 ${glyph.size}px "Noto Serif SC Variable", "JetBrains Mono Variable", serif`
        ctx.fillText(glyph.text, glyph.x, glyph.y)
      }
      ctx.globalAlpha = 1
    })
    return () => {
      off()
      observer.disconnect()
      envelope.current?.removeEventListener('pointerdown', press)
    }
  }, [glyphs, index, reduced])

  const enter = (event: MouseEvent<HTMLAnchorElement>) => {
    if (reduced || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (launching.current) return
    launching.current = true
    const box = button.current?.getBoundingClientRect()
    const host = root.current?.getBoundingClientRect()
    const y = box && host ? ((box.top + box.height / 2 - host.top) / host.height) * 100 : 50
    gsap
      .timeline({ onComplete: () => window.location.assign(HGT_URL) })
      .set(light.current, { display: 'block', clipPath: `inset(${y}% 0% ${100 - y}% 0%)` })
      .to(
        light.current,
        { clipPath: `inset(${y - 0.4}% 0% ${100 - y - 0.4}% 0%)`, duration: 0.18, ease: 'power2.out' },
        0.15,
      )
      .to(light.current, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.5, ease: 'expo.in' }, 0.38)
  }

  return (
    <div
      ref={root}
      className='absolute inset-0 overflow-hidden bg-[#0d0b09] text-[#f2efe6] select-none [--open:0] [--pull:0]'
    >
      {/* 顶光光束 */}
      <div
        ref={spot}
        aria-hidden
        className='pointer-events-none absolute inset-0'
        style={{
          background:
            'radial-gradient(ellipse 40% 68% at 50% -4%, rgba(242,239,230,.22), rgba(242,239,230,.06) 54%, transparent 76%), radial-gradient(ellipse 38% 22% at 50% 62%, rgba(242,239,230,.1), transparent 72%)',
        }}
      >
        <span className='absolute top-0 left-1/2 h-[74%] w-[42vw] -translate-x-1/2 bg-[linear-gradient(180deg,rgba(242,239,230,.08),rgba(242,239,230,0))] [clip-path:polygon(36%_0,64%_0,100%_100%,0_100%)]' />
      </div>

      <canvas ref={canvas} aria-hidden className='pointer-events-none absolute inset-0 size-full' />

      {/* 追光上部：主持人暗记与「砚已经看过了汤底。」 */}
      <div
        ref={header}
        className='pointer-events-none absolute inset-x-0 top-[7.5vh] z-20 flex flex-col items-center px-6 text-center max-sm:pr-11'
      >
        <p className='flex items-center gap-2.5 font-mono text-[.58rem] tracking-[.3em] text-[#f2efe6]/60 uppercase'>
          <span className='size-1.5 bg-[#b3261e]' />
          {t('hgtPage.gate.seat')} · {t('hgtPage.gate.host')}
        </p>
        <p className='mt-[1.6vh] font-serif-sc text-[clamp(1.35rem,2.8vw,2.45rem)] leading-[1.25] font-bold tracking-[.08em] text-[#f2efe6]'>
          {t('hgtPage.seat.line')}
        </p>
        <span
          aria-hidden
          className='mt-[1.6vh] h-[clamp(1.4rem,3.2vh,2.4rem)] w-px bg-gradient-to-b from-[#b3261e]/80 via-[#f2efe6]/35 to-transparent'
        />
      </div>

      {/* 追光正中：统一坐标系的 3D 滚动拆封信封 */}
      <div
        ref={stageEnvelope}
        className='absolute inset-x-0 top-[26vh] bottom-[5vh] z-20 flex flex-col items-center justify-center px-5 max-sm:pr-11'
      >
        <div
          ref={envelope}
          className='relative w-[min(41rem,90vw)] max-sm:w-full pt-[clamp(4.8rem,11.5vh,7rem)] will-change-transform [--gx:50%] [--gy:32%]'
        >
          {/* 统一信封袋坐标系（640×240）：背腔、上折盖、卡槽、前袋严格共用 (0,0) 与 (640,0) 顶角 */}
          <div
            ref={pocketBox}
            style={{
              boxShadow:
                '0 38px 95px rgba(0,0,0,.88), 0 0 calc(24px + var(--pull)*72px) calc(2px + var(--pull)*6px) rgba(242,239,230,.13)',
            }}
            className='relative aspect-[640/240] w-full'
          >
            {/* 第 1 层（z-10）：信封背腔（与前袋严格等大，顶边为折痕而非切口，无错位重线） */}
            <svg
              aria-hidden='true'
              viewBox='0 0 640 240'
              preserveAspectRatio='none'
              className='pointer-events-none absolute inset-0 z-10 size-full'
            >
              <defs>
                <radialGradient id='hgt-chamber-glow' cx='50%' cy='18%' r='65%'>
                  <stop offset='0%' stopColor='#f2efe6' stopOpacity='0.3' />
                  <stop offset='45%' stopColor='#b3261e' stopOpacity='0.18' />
                  <stop offset='100%' stopColor='#080706' stopOpacity='0' />
                </radialGradient>
              </defs>
              <rect x='0' y='0' width='640' height='240' fill='#080706' />
              <rect
                x='0'
                y='0'
                width='640'
                height='240'
                fill='url(#hgt-chamber-glow)'
                style={{ opacity: 'var(--open)' }}
              />
              {/* 顶边折痕暗线（避免在卡片两侧形成突兀横切白线） */}
              <line x1='0' y1='0' x2='640' y2='0' stroke='rgba(242,239,230,0.08)' strokeWidth='1' />
              <polyline
                points='0,0 0,240 640,240 640,0'
                fill='none'
                stroke='rgba(242,239,230,0.26)'
                strokeWidth='1.5'
              />
            </svg>

            {/* 第 2 层（z-12 / z-40）：信封上折盖，严格铰接在顶边 y=0（0° 时完全严丝合缝盖住前袋 V 口，>90° 时翻至卡后） */}
            <div
              ref={flap}
              aria-hidden
              style={{ transformOrigin: '50% 0%' }}
              className='pointer-events-none absolute inset-x-0 top-0 z-40 h-[68.333%] will-change-transform'
            >
              <svg
                aria-hidden='true'
                viewBox='0 0 640 164'
                preserveAspectRatio='none'
                className='size-full overflow-visible'
              >
                <defs>
                  <linearGradient id='hgt-flap-outer' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor='#221d18' />
                    <stop offset='100%' stopColor='#120f0c' />
                  </linearGradient>
                  <linearGradient id='hgt-flap-inner' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor='#0c0a08' />
                    <stop offset='100%' stopColor='#1d1814' />
                  </linearGradient>
                  <linearGradient id='hgt-flap-seam' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor='#f2efe6' stopOpacity='0.38' />
                    <stop offset='55%' stopColor='#b3261e' stopOpacity='0.2' />
                    <stop offset='100%' stopColor='#0d0b09' stopOpacity='0' />
                  </linearGradient>
                </defs>

                {/* 折盖外表面（0° ~ 90° 合拢状态可见）：顶点严格为 (0,0) -> (320,162) -> (640,0)，完全覆盖前袋 V 口 */}
                <g ref={flapOuter}>
                  <polygon
                    points='0,0 320,162 640,0'
                    fill='url(#hgt-flap-outer)'
                    stroke='rgba(242,239,230,0.34)'
                    strokeWidth='1.5'
                  />
                  {/* 仅沿两侧斜边绘制虚线缝线 */}
                  <polyline
                    points='22,6 320,151 618,6'
                    fill='none'
                    stroke='rgba(242,239,230,0.16)'
                    strokeWidth='1'
                    strokeDasharray='5 4'
                  />
                  {/* 折盖尖端封缄火漆扣（合拢时正好压住信封中轴） */}
                  <rect
                    x='308'
                    y='136'
                    width='24'
                    height='24'
                    fill='#0d0b09'
                    stroke='rgba(242,239,230,0.55)'
                    strokeWidth='1.4'
                  />
                  <rect x='314' y='142' width='12' height='12' fill='#b3261e' />
                </g>

                {/* 折盖内衬面（90° ~ 180° 翻开状态可见，翻转后朝向观众） */}
                <g ref={flapInner} style={{ opacity: 0 }}>
                  <polygon
                    points='0,0 320,162 640,0'
                    fill='url(#hgt-flap-inner)'
                    stroke='rgba(242,239,230,0.32)'
                    strokeWidth='1.5'
                  />
                  <polygon points='28,0 320,146 612,0' fill='url(#hgt-flap-seam)' />
                  <polyline
                    points='22,6 320,151 618,6'
                    fill='none'
                    stroke='rgba(242,239,230,0.15)'
                    strokeWidth='1'
                    strokeDasharray='5 4'
                  />
                  <rect
                    x='312'
                    y='134'
                    width='16'
                    height='16'
                    fill='#0d0b09'
                    stroke='rgba(242,239,230,0.4)'
                    strokeWidth='1'
                  />
                  <rect x='316' y='138' width='8' height='8' fill='#b3261e' />
                </g>
              </svg>
            </div>

            {/* 第 3 层（z-20）：信封卡槽与向上抽出的米白宣纸「入席邀请卡」（底边严格裁切于信封袋内，上方可自由抽出） */}
            <div className=' absolute inset-x-[7.5%] top-0 bottom-[6px] z-20 [clip-path:inset(-160%_-10%_0_-10%)]'>
              <div
                ref={card}
                className='relative bg-[#f2efe6] px-[clamp(1.15rem,2.6vw,2.2rem)] pt-[clamp(1rem,2.2vh,1.5rem)] pb-[clamp(5.6rem,13vh,8rem)] text-[#0d0b09] shadow-[0_-10px_32px_rgba(0,0,0,.55),0_8px_24px_rgba(0,0,0,.45)] will-change-transform'
              >
                <PaperGrid />
                {/* 随指针移动的纸面柔光 */}
                <span
                  aria-hidden
                  className='pointer-events-none absolute inset-0'
                  style={{
                    background:
                      'radial-gradient(circle at var(--gx) var(--gy), rgba(255,253,247,.62) 0%, rgba(242,239,230,0) 64%)',
                  }}
                />
                {/* 邀请卡内框刻线与上方两角折标 */}
                <span aria-hidden className='pointer-events-none absolute inset-[8px] border border-[#0d0b09]/16' />
                <span
                  aria-hidden
                  className='pointer-events-none absolute top-[6px] left-[6px] size-2.5 border-t-2 border-l-2 border-[#0d0b09]'
                />
                <span
                  aria-hidden
                  className='pointer-events-none absolute top-[6px] right-[6px] size-2.5 border-t-2 border-r-2 border-[#0d0b09]'
                />

                {/* 邀请卡抬头：案号与站点暗记 */}
                <div className='relative flex items-center justify-between gap-3 border-b border-[#0d0b09]/15 pb-[1vh] font-mono text-[.54rem] tracking-[.22em] text-[#0d0b09]/60 uppercase'>
                  <span className='flex items-center gap-2'>
                    <span className='size-1.5 bg-[#b3261e]' />
                    {t('hgtPage.case')}
                  </span>
                  <span className='max-sm:hidden'>{t('hgtPage.seat.site')}</span>
                </div>

                {/* 核心行动入口：「进入海龟汤」与清晰锐利的「凭邀请入座」红章 */}
                <div className='relative mt-[clamp(.95rem,2.1vh,1.45rem)] flex flex-col items-center'>
                  <Magnetic strength={0.16} className='block w-full [&>span]:block [&>span]:w-full'>
                    <span className='relative block w-full'>
                      <a
                        ref={button}
                        href={HGT_URL}
                        onClick={enter}
                        onFocus={() => {
                          focused.current = true
                        }}
                        onBlur={() => {
                          focused.current = false
                        }}
                        data-cursor={t('hgtPage.seat.enter')}
                        className={cn(
                          'group grid w-full place-items-center border border-[#0d0b09] bg-[#0d0b09] px-[clamp(1.3rem,3.4vw,3.6rem)] py-[clamp(.95rem,2.3vh,1.45rem)] font-serif-sc leading-none font-black whitespace-nowrap text-[#f2efe6] no-underline transition-colors duration-500 ease-out-expo hover:border-[#b3261e] hover:bg-[#b3261e] hover:text-[#f2efe6] focus-visible:border-[#b3261e] focus-visible:bg-[#b3261e] focus-visible:text-[#f2efe6]',
                          zh
                            ? 'text-[clamp(1.45rem,2.7vw,2.35rem)] tracking-[.12em]'
                            : 'text-[clamp(1.2rem,2.1vw,1.9rem)] tracking-[.05em]',
                        )}
                      >
                        {t('hgtPage.seat.enter')}
                      </a>

                      {/* 朱红印章：仅对印泥底色应用毛边滤镜，外框与印文保持清晰锐利 */}
                      <span
                        ref={stamp}
                        aria-hidden
                        className={cn(
                          'pointer-events-none absolute -top-3 right-3 grid size-[clamp(3.2rem,4.5vw,4.1rem)] rotate-[-8deg] place-items-center p-1 text-center leading-[1.2] font-black text-[#f2efe6] will-change-transform',
                          zh
                            ? 'font-serif-sc text-[clamp(.62rem,.84vw,.76rem)] tracking-[.1em]'
                            : 'font-mono text-[clamp(.4rem,.55vw,.5rem)] tracking-[.03em]',
                        )}
                      >
                        <span
                          aria-hidden
                          className='absolute inset-0 bg-[#b3261e] shadow-[0_0_0_2.5px_#f2efe6] [filter:url(#hgt-ink-edge)]'
                        />
                        <span aria-hidden className='absolute inset-[3px] border border-[#f2efe6]/45' />
                        <span className='relative z-10'>
                          {seal[0]}
                          <br />
                          {seal[1]}
                        </span>
                      </span>
                    </span>
                  </Magnetic>
                </div>
              </div>
            </div>

            {/* 第 4 层（z-30 · 不拦指针）：信封前袋（与背腔严格共用 640×240，左右斜折翼严格起于 (0,0) 与 (640,0)） */}
            <svg
              aria-hidden='true'
              viewBox='0 0 640 240'
              preserveAspectRatio='none'
              className='pointer-events-none absolute inset-0 z-30 size-full overflow-visible'
            >
              <defs>
                <linearGradient id='hgt-pocket-left' x1='0' y1='0' x2='1' y2='1'>
                  <stop offset='0%' stopColor='#1c1814' />
                  <stop offset='100%' stopColor='#0f0d0b' />
                </linearGradient>
                <linearGradient id='hgt-pocket-right' x1='1' y1='0' x2='0' y2='1'>
                  <stop offset='0%' stopColor='#1c1814' />
                  <stop offset='100%' stopColor='#0f0d0b' />
                </linearGradient>
                <linearGradient id='hgt-pocket-bottom' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='0%' stopColor='#211c17' />
                  <stop offset='100%' stopColor='#0d0b09' />
                </linearGradient>
                <filter id='hgt-pocket-shadow' x='-10%' y='-15%' width='120%' height='130%'>
                  <feDropShadow dx='0' dy='-6' stdDeviation='7' floodColor='#000000' floodOpacity='0.55' />
                </filter>
              </defs>

              <g filter='url(#hgt-pocket-shadow)'>
                {/* 左斜折翼：严格从左上顶角 (0,0) 斜切至中央封口 (304,154) */}
                <polygon
                  points='0,0 304,154 0,240'
                  fill='url(#hgt-pocket-left)'
                  stroke='rgba(242,239,230,0.28)'
                  strokeWidth='1.4'
                />
                <line
                  x1='14'
                  y1='18'
                  x2='276'
                  y2='150'
                  stroke='rgba(242,239,230,0.13)'
                  strokeWidth='1'
                  strokeDasharray='4 4'
                />

                {/* 右斜折翼：严格从右上顶角 (640,0) 斜切至中央封口 (336,154) */}
                <polygon
                  points='640,0 336,154 640,240'
                  fill='url(#hgt-pocket-right)'
                  stroke='rgba(242,239,230,0.28)'
                  strokeWidth='1.4'
                />
                <line
                  x1='626'
                  y1='18'
                  x2='364'
                  y2='150'
                  stroke='rgba(242,239,230,0.13)'
                  strokeWidth='1'
                  strokeDasharray='4 4'
                />

                {/* 底折梯形襟片 */}
                <polygon
                  points='0,240 236,144 404,144 640,240'
                  fill='url(#hgt-pocket-bottom)'
                  stroke='rgba(242,239,230,0.34)'
                  strokeWidth='1.5'
                />
                <polyline
                  points='26,232 244,154 396,154 614,232'
                  fill='none'
                  stroke='rgba(242,239,230,0.14)'
                  strokeWidth='1'
                />
              </g>

              {/* 信封中轴朱红火漆封扣（正好位于上折盖合拢尖端 (320,150) 处） */}
              <rect
                x='308'
                y='136'
                width='24'
                height='24'
                fill='#0d0b09'
                stroke='rgba(242,239,230,0.55)'
                strokeWidth='1.4'
              />
              <rect x='314' y='142' width='12' height='12' fill='#b3261e' />
            </svg>

            {/* 信封袋底栏烫印字样 */}
            <div
              aria-hidden
              className='pointer-events-none absolute inset-x-0 bottom-[1.3vh] z-30 flex items-center justify-center font-mono text-[.54rem] tracking-[.28em] text-[#f2efe6]/60 uppercase'
            >
              {t('hgtPage.seat.sealText')} · {t('hgtPage.seat.site')}
            </div>
          </div>

          {/* 尚未拆封时的底部滚动拆封微提示 */}
          <p
            ref={hint}
            aria-hidden
            className='pointer-events-none mt-[2.2vh] text-center font-mono text-[.56rem] tracking-[.32em] text-[#f2efe6]/55 uppercase transition-opacity duration-300'
          >
            ↓ {t('hgtPage.seat.sealText')}
          </p>
        </div>
      </div>

      <div ref={light} aria-hidden className='pointer-events-none absolute inset-0 z-50 hidden bg-[#fbfaf6]' />
    </div>
  )
}
