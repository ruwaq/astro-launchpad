import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router'

interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  alpha: number
  life: number
}

interface FloatingItem {
  id: number
  x: number
  y: number
  type: 'xlm' | 'burn' | 'whale'
  size: number
  speed: number
  collected: boolean
}

const GRADUATION_TARGET = 2000
const STORAGE_KEY = 'astrogate.game.best_time.v1'

export function CosmicLauncherGame() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [altitude, setAltitude] = useState(10) // In XLM, starts at 10 XLM seed
  const [velocity, setVelocity] = useState(0)
  const [multiplier, setMultiplier] = useState(1.0)
  const [combo, setCombo] = useState(0)
  const [score, setScore] = useState(0)
  const [gameWon, setGameWon] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [bestTime, setBestTime] = useState<number | null>(() => {
    try {
      const val = localStorage.getItem(STORAGE_KEY)
      return val ? parseFloat(val) : null
    } catch {
      return null
    }
  })
  const [lastMilestone, setLastMilestone] = useState<string | null>(null)
  const [particles, setParticles] = useState<Particle[]>([])
  const [items, setItems] = useState<FloatingItem[]>([])

  const comboTimerRef = useRef<NodeJS.Timeout | null>(null)
  const nextItemIdRef = useRef<number>(1)
  const nextParticleIdRef = useRef<number>(1)

  // Trigger rocket thrust
  const boostRocket = useCallback(() => {
    if (!isPlaying && !gameWon) {
      setIsPlaying(true)
    }

    setVelocity((v) => Math.min(v + 120, 480))
    setCombo((c) => {
      const nextCombo = c + 1
      const nextMult = Math.min(1 + nextCombo * 0.2, 5.0)
      setMultiplier(Math.round(nextMult * 10) / 10)
      return nextCombo
    })

    // Reset combo timeout
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current)
    comboTimerRef.current = setTimeout(() => {
      setCombo(0)
      setMultiplier(1.0)
    }, 1200)

    // Spawn flame particles
    const newParticles: Particle[] = []
    for (let i = 0; i < 6; i++) {
      newParticles.push({
        id: nextParticleIdRef.current++,
        x: 50 + (Math.random() * 8 - 4),
        y: 65,
        vx: (Math.random() - 0.5) * 3,
        vy: 4 + Math.random() * 4,
        size: 3 + Math.random() * 4,
        color: Math.random() > 0.4 ? '#38bdf8' : '#f59e0b',
        alpha: 1.0,
        life: 1.0,
      })
    }
    setParticles((prev) => [...prev.slice(-30), ...newParticles])
  }, [isPlaying, gameWon])

  // Handle keyboard (Spacebar)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' && (isPlaying || (!gameWon && !isPlaying))) {
        e.preventDefault()
        boostRocket()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [boostRocket, isPlaying, gameWon])

  // Main game tick loop
  useEffect(() => {
    if (!isPlaying || gameWon) return

    let lastTick = performance.now()
    const interval = setInterval(() => {
      const now = performance.now()
      const dt = (now - lastTick) / 1000
      lastTick = now

      setElapsedSeconds((s) => s + dt)

      // Altitude physics: velocity decayed by gravity/drag
      setVelocity((v) => Math.max(v - 45 * dt, 20)) // Base constant drift
      setAltitude((alt) => {
        const nextAlt = alt + (velocity * multiplier * dt * 0.6)

        // Check milestones
        if (nextAlt >= 100 && alt < 100) {
          setLastMilestone('🌱 100 XLM: Micro-Cap Orbit reached! 99.5% locked in AMM.')
        } else if (nextAlt >= 500 && alt < 500) {
          setLastMilestone('🔥 500 XLM: Deep Space! 100% LP burned permanently.')
        } else if (nextAlt >= 1200 && alt < 1200) {
          setLastMilestone('⚡ 1,200 XLM: Orbital velocity! Approaching Graduation.')
        }

        // Win condition: Moonshot Graduation at 2,000 XLM!
        if (nextAlt >= GRADUATION_TARGET) {
          setGameWon(true)
          setIsPlaying(false)
          setLastMilestone('🌕 2,000 XLM: GRADUATION COMPLETE! Token landed on the Moon!')
          setBestTime((prevBest) => {
            const time = Math.round((elapsedSeconds + dt) * 10) / 10
            if (!prevBest || time < prevBest) {
              try {
                localStorage.setItem(STORAGE_KEY, String(time))
              } catch {
                // Ignore storage errors
              }
              return time
            }
            return prevBest
          })
          return GRADUATION_TARGET
        }

        return nextAlt
      })

      // Update particles
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            alpha: p.alpha - dt * 2.5,
          }))
          .filter((p) => p.alpha > 0)
      )

      // Spawn falling collectibles occasionally
      if (Math.random() < 0.08) {
        const rand = Math.random()
        const type: 'xlm' | 'burn' | 'whale' =
          rand > 0.4 ? 'xlm' : rand > 0.15 ? 'burn' : 'whale'

        setItems((prev) => [
          ...prev.slice(-10),
          {
            id: nextItemIdRef.current++,
            x: 15 + Math.random() * 70,
            y: -10,
            type,
            size: type === 'whale' ? 24 : 18,
            speed: 25 + Math.random() * 20,
            collected: false,
          },
        ])
      }

      // Move items & handle collision with rocket at x=50, y=50
      setItems((prev) =>
        prev
          .map((item) => {
            const nextY = item.y + item.speed * dt

            // Collision check with rocket (center around x=50, y=50)
            if (!item.collected && nextY > 38 && nextY < 62 && Math.abs(item.x - 50) < 16) {
              if (item.type === 'xlm') {
                setAltitude((a) => Math.min(a + 40, GRADUATION_TARGET))
                setScore((s) => s + 250)
              } else if (item.type === 'burn') {
                setVelocity((v) => Math.min(v + 150, 500))
                setScore((s) => s + 500)
              } else if (item.type === 'whale') {
                setVelocity((v) => Math.max(v - 80, 10))
                setCombo(0)
                setMultiplier(1.0)
              }
              return { ...item, y: nextY, collected: true }
            }

            return { ...item, y: nextY }
          })
          .filter((item) => item.y < 110 && !item.collected)
      )
    }, 40)

    return () => clearInterval(interval)
  }, [isPlaying, gameWon, velocity, multiplier, elapsedSeconds])

  function resetGame() {
    setIsPlaying(false)
    setAltitude(10)
    setVelocity(0)
    setMultiplier(1.0)
    setCombo(0)
    setScore(0)
    setGameWon(false)
    setElapsedSeconds(0)
    setLastMilestone(null)
    setParticles([])
    setItems([])
  }

  const progressPercent = Math.min(
    Math.round((altitude / GRADUATION_TARGET) * 100),
    100
  )

  return (
    <div className="relative overflow-hidden rounded-3xl border border-sky-500/20 bg-gradient-to-b from-slate-950 via-indigo-950/40 to-slate-950 p-5 sm:p-7 shadow-2xl backdrop-blur-xl">
      {/* Background Animated Starfield Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />
      <div className="absolute top-0 right-1/4 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      {/* Header telemetry */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-sky-400">
              Interactive Fair-Launch Simulation
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2 mt-0.5">
            <span>🚀</span> AstroGate Moonshot Simulator
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-right font-mono text-xs">
            <div className="text-[10px] text-slate-400">Score</div>
            <div className="font-bold text-sky-300">{score}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-right font-mono text-xs">
            <div className="text-[10px] text-slate-400">Target</div>
            <div className="font-bold text-amber-300">2,000 XLM</div>
          </div>
          {bestTime !== null ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-right font-mono text-xs">
              <div className="text-[10px] text-slate-400">Best Time</div>
              <div className="font-bold text-emerald-400">{bestTime}s</div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Game Stage Area */}
      <div
        onClick={boostRocket}
        className="group relative z-10 mt-5 h-64 sm:h-72 w-full cursor-pointer select-none overflow-hidden rounded-2xl border border-sky-500/30 bg-slate-950/90 shadow-inner"
        role="button"
        tabIndex={0}
        aria-label="Click or press Spacebar to boost the AstroGate fair launch rocket"
      >
        {/* Floating Stellar Moon at the top */}
        <div
          className="absolute left-1/2 -translate-x-1/2 transition-transform duration-700"
          style={{
            top: `${Math.max(6, 20 - progressPercent * 0.16)}%`,
            transform: `translateX(-50%) scale(${1 + progressPercent * 0.008})`,
          }}
        >
          <div className="relative flex items-center justify-center">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gradient-to-br from-amber-100 via-amber-300 to-amber-500 shadow-lg shadow-amber-400/30 flex items-center justify-center text-3xl">
              🌕
            </div>
            {progressPercent >= 100 ? (
              <span className="absolute -top-3 rounded-full bg-emerald-500 px-2 py-0.5 font-mono text-[9px] font-bold text-slate-950 uppercase tracking-widest animate-bounce">
                Graduated!
              </span>
            ) : null}
          </div>
        </div>

        {/* Falling Collectibles */}
        {items.map((item) => (
          <div
            key={item.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform"
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
          >
            {item.type === 'xlm' ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/30 border border-sky-400 text-xs shadow-md shadow-sky-500/50">
                💎
              </span>
            ) : item.type === 'burn' ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/30 border border-amber-400 text-xs shadow-md shadow-amber-500/50 animate-pulse">
                🔥
              </span>
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500/30 border border-rose-400 text-sm shadow-md shadow-rose-500/50">
                🐋
              </span>
            )}
          </div>
        ))}

        {/* Flame Exhaust Particles */}
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color,
              opacity: p.alpha,
              boxShadow: `0 0 8px ${p.color}`,
            }}
          />
        ))}

        {/* Rocket Sprite */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none transition-transform duration-100"
          style={{
            transform: `translate(-50%, -50%) scale(${1 + (multiplier - 1) * 0.1}) ${
              velocity > 120 ? 'rotate(-2deg)' : 'rotate(0deg)'
            }`,
          }}
        >
          <div className="relative flex items-center justify-center text-4xl sm:text-5xl drop-shadow-[0_0_15px_rgba(56,189,248,0.7)] animate-pulse">
            🚀
          </div>
          {/* Flame jet */}
          <div
            className="w-3 rounded-full bg-gradient-to-b from-sky-400 via-amber-400 to-transparent transition-all duration-75"
            style={{
              height: `${12 + Math.min(velocity * 0.08, 40)}px`,
              opacity: isPlaying ? 0.9 : 0.3,
            }}
          />
        </div>

        {/* Overlay HUD / Instructions */}
        {!isPlaying && !gameWon ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 p-4 text-center backdrop-blur-sm">
            <span className="rounded-full border border-sky-400/40 bg-sky-950/80 px-3 py-1 font-mono text-xs font-bold text-sky-300 shadow-lg">
              ✨ Click or Tap to Pump Liquidity
            </span>
            <p className="mt-2 text-sm text-slate-300 max-w-sm">
              Tap rapidly to boost the rocket, burn LP tokens, and reach the 2,000 XLM Moonshot Graduation!
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                boostRocket()
              }}
              className="mt-3 inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-sky-400 bg-sky-500 px-5 py-2 text-xs font-black text-slate-950 hover:bg-sky-400 transition transform hover:scale-105 shadow-lg shadow-sky-500/25"
            >
              🔥 START PUMPING
            </button>
          </div>
        ) : null}

        {/* Win Screen */}
        {gameWon ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 p-4 text-center backdrop-blur-md animate-fade-in">
            <span className="text-4xl animate-bounce">🌕🎉</span>
            <h3 className="mt-2 text-lg sm:text-xl font-black text-white">
              Moonshot Graduation Achieved!
            </h3>
            <p className="mt-1 text-xs text-slate-300 max-w-md">
              Reached 2,000 XLM in <span className="font-bold text-emerald-400">{Math.round(elapsedSeconds * 10) / 10}s</span>!
              100% LP burned, 0 rug risk, and seamlessly graduated to Stellar ecosystem.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  resetGame()
                }}
                className="inline-flex min-h-[36px] items-center rounded-xl border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                🔄 Play Again
              </button>
              <Link
                to="/create"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex min-h-[36px] items-center rounded-xl border border-sky-400 bg-sky-500 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400 shadow-md shadow-sky-500/20"
              >
                🚀 Launch Real Token
              </Link>
            </div>
          </div>
        ) : null}

        {/* Top-Right Multiplier Pill */}
        {isPlaying ? (
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <span className="rounded-lg border border-sky-500/40 bg-slate-900/90 px-2.5 py-1 font-mono text-xs font-bold text-sky-300 shadow">
              {multiplier}x PUMP
            </span>
            {combo > 3 ? (
              <span className="rounded-lg border border-amber-500/40 bg-amber-950/80 px-2 py-1 font-mono text-[10px] font-bold text-amber-300 animate-bounce">
                🔥 {combo} COMBO
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Live Milestone Toast */}
        {lastMilestone ? (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto max-w-md rounded-xl border border-sky-500/40 bg-slate-900/95 px-3 py-1.5 text-xs text-sky-200 shadow-xl backdrop-blur-md">
            {lastMilestone}
          </div>
        ) : null}
      </div>

      {/* Progress & Controls Bar */}
      <div className="relative z-10 mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400 flex items-center gap-1.5">
            <span>Pool Liquidity Altitude:</span>
            <span className="font-bold text-white">{Math.round(altitude)} XLM</span>
          </span>
          <span className="font-bold text-sky-400">{progressPercent}% to Moon</span>
        </div>

        {/* Progress Bar */}
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-amber-400 transition-all duration-150 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Micro-Features Row */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/60 text-center">
          <div className="rounded-xl bg-slate-900/40 p-2 border border-slate-800/40">
            <div className="text-[10px] text-slate-500 uppercase font-mono">Launch Type</div>
            <div className="text-xs font-bold text-sky-300 mt-0.5">Single-Tx Atomic</div>
          </div>
          <div className="rounded-xl bg-slate-900/40 p-2 border border-slate-800/40">
            <div className="text-[10px] text-slate-500 uppercase font-mono">LP Allocation</div>
            <div className="text-xs font-bold text-emerald-300 mt-0.5">100% LP Burned</div>
          </div>
          <div className="rounded-xl bg-slate-900/40 p-2 border border-slate-800/40">
            <div className="text-[10px] text-slate-500 uppercase font-mono">Admin Control</div>
            <div className="text-xs font-bold text-purple-300 mt-0.5">Renounced Owner</div>
          </div>
          <div className="rounded-xl bg-slate-900/40 p-2 border border-slate-800/40">
            <div className="text-[10px] text-slate-500 uppercase font-mono">Graduation Target</div>
            <div className="text-xs font-bold text-amber-300 mt-0.5">2,000 XLM Moon</div>
          </div>
        </div>
      </div>
    </div>
  )
}
