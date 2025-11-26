/**
 * Animated Graduation Progress Component
 *
 * Epic visualization of token graduation progress to AMM
 * Features:
 * - Animated progress bar with glow effects
 * - Rocket animation moving along progress
 * - Fire/boost particles at milestones
 * - Confetti explosion on graduation
 * - Pulsing milestones
 * - Real-time XLM counter
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { Rocket, Trophy, Flame, Zap, Star, PartyPopper, TrendingUp, Target, Droplets, Info } from 'lucide-react';

interface AstroAllocationConfig {
  /** ASTRO liquidity basis points (default 1000 = 10%) */
  liquidityBps?: number;
  /** Buyback basis points (default 500 = 5%) */
  buybackBps?: number;
  /** Whether ASTRO is enabled */
  enabled?: boolean;
}

interface GraduationProgressAnimatedProps {
  xlmRaised: string | number;
  graduated: boolean;
  threshold?: number;
  tokenSymbol?: string;
  astroConfig?: AstroAllocationConfig;
}

// Particle component for effects
function Particle({ x, y, emoji }: { x: number; y: number; emoji: string }) {
  return (
    <motion.div
      className="absolute text-lg pointer-events-none"
      initial={{ x, y, opacity: 1, scale: 1 }}
      animate={{
        y: y - 100 - Math.random() * 50,
        x: x + (Math.random() - 0.5) * 60,
        opacity: 0,
        scale: 0.5,
        rotate: Math.random() * 360,
      }}
      transition={{ duration: 1.5, ease: 'easeOut' }}
    >
      {emoji}
    </motion.div>
  );
}

// Confetti component for graduation celebration
function Confetti() {
  const colors = ['#fa9427', '#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];
  const confetti = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: colors[Math.floor(Math.random() * colors.length)],
    delay: Math.random() * 0.5,
    rotation: Math.random() * 360,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {confetti.map((c) => (
        <motion.div
          key={c.id}
          className="absolute w-2 h-3 rounded-sm"
          style={{ backgroundColor: c.color, left: `${c.x}%` }}
          initial={{ y: -20, rotate: 0, opacity: 1 }}
          animate={{
            y: 400,
            rotate: c.rotation + 720,
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: 3,
            delay: c.delay,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        />
      ))}
    </div>
  );
}

export function GraduationProgressAnimated({
  xlmRaised,
  graduated,
  threshold = 10000,
  tokenSymbol = 'TOKEN',
  astroConfig,
}: GraduationProgressAnimatedProps) {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; emoji: string }[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [prevProgress, setPrevProgress] = useState(0);
  const [showAstroDetails, setShowAstroDetails] = useState(false);

  const raised = parseFloat(xlmRaised.toString());
  const percentComplete = Math.min((raised / threshold) * 100, 100);
  const remaining = Math.max(threshold - raised, 0);

  // Calculate ASTRO allocation
  const liquidityBps = astroConfig?.liquidityBps ?? 1000;
  const buybackBps = astroConfig?.buybackBps ?? 500;
  const astroEnabled = astroConfig?.enabled ?? true;

  const totalAstroBps = liquidityBps + buybackBps;
  const mainPoolPercent = ((10000 - totalAstroBps) / 100);
  const astroLiquidityPercent = liquidityBps / 100;
  const buybackPercent = buybackBps / 100;

  // Calculate projected allocations
  const xlmForMainPool = (threshold * mainPoolPercent) / 100;
  const xlmForAstroLiquidity = (threshold * astroLiquidityPercent) / 100;
  const xlmForBuyback = (threshold * buybackPercent) / 100;

  // Spring animation for smooth progress
  const springProgress = useSpring(percentComplete, { stiffness: 50, damping: 20 });
  const progressWidth = useTransform(springProgress, (v) => `${v}%`);

  // Milestones
  const milestones = [
    { percent: 25, label: '25%', icon: Flame, emoji: '🔥' },
    { percent: 50, label: '50%', icon: Zap, emoji: '⚡' },
    { percent: 75, label: '75%', icon: Star, emoji: '⭐' },
    { percent: 100, label: 'DEX!', icon: Trophy, emoji: '🏆' },
  ];

  // Detect milestone crossings and create particles
  useEffect(() => {
    milestones.forEach((milestone) => {
      if (percentComplete >= milestone.percent && prevProgress < milestone.percent) {
        // Milestone reached! Create particles
        const newParticles = Array.from({ length: 8 }, (_, i) => ({
          id: Date.now() + i,
          x: (milestone.percent / 100) * 300,
          y: 50,
          emoji: milestone.emoji,
        }));
        setParticles((prev) => [...prev, ...newParticles]);

        // Clean up particles after animation
        setTimeout(() => {
          setParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)));
        }, 2000);
      }
    });

    setPrevProgress(percentComplete);
  }, [percentComplete, prevProgress]);

  // Graduation celebration
  useEffect(() => {
    if (graduated && !showConfetti) {
      setShowConfetti(true);
    }
  }, [graduated, showConfetti]);

  // Calculate rocket position
  const rocketPosition = useMemo(() => {
    return Math.min(percentComplete, 100);
  }, [percentComplete]);

  if (graduated) {
    return (
      <motion.div
        className="relative bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border-2 border-green-300 p-6 overflow-hidden"
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
      >
        {showConfetti && <Confetti />}

        <motion.div
          className="text-center relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Trophy Animation */}
          <motion.div
            className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center"
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, -5, 5, 0],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Trophy className="h-10 w-10 text-white" />
          </motion.div>

          <h3 className="text-2xl font-bold text-green-800 mb-2">
            Graduated to DEX! 🎉
          </h3>

          <p className="text-green-700 mb-4">
            {tokenSymbol} is now trading on Stellar DEX with permanent liquidity!
          </p>

          <div className="flex items-center justify-center gap-4 text-sm">
            <div className="bg-white/80 rounded-lg px-4 py-2">
              <span className="text-green-600 font-semibold">{raised.toLocaleString()} XLM</span>
              <span className="text-green-500 ml-1">raised</span>
            </div>
            <div className="bg-white/80 rounded-lg px-4 py-2">
              <span className="text-green-600 font-semibold">100%</span>
              <span className="text-green-500 ml-1">complete</span>
            </div>
          </div>

          {/* ASTRO Allocation Summary (Graduated) */}
          {astroEnabled && (
            <motion.div
              className="mt-4 bg-purple-100/80 border border-purple-300 rounded-xl p-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Flame className="h-4 w-4 text-purple-600" />
                <p className="text-sm text-purple-800 font-semibold">
                  ASTRO Protocol Integration
                </p>
              </div>
              <div className="text-xs text-purple-700 space-y-1">
                <p>{mainPoolPercent}% allocated to Token/XLM pool</p>
                <p>{astroLiquidityPercent}% allocated to ASTRO ecosystem</p>
                <p>{buybackPercent}% used for ASTRO buyback & burn</p>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Floating emojis */}
        <motion.div
          className="absolute -top-4 -left-4 text-4xl"
          animate={{ y: [0, -10, 0], rotate: [-5, 5, -5] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          🚀
        </motion.div>
        <motion.div
          className="absolute -top-4 -right-4 text-4xl"
          animate={{ y: [0, -10, 0], rotate: [5, -5, 5] }}
          transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
        >
          🎊
        </motion.div>
      </motion.div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-ui-border p-6 relative overflow-hidden">
      {/* Particles */}
      <AnimatePresence>
        {particles.map((p) => (
          <Particle key={p.id} x={p.x} y={p.y} emoji={p.emoji} />
        ))}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <motion.div
            className="w-10 h-10 bg-gradient-to-br from-brand-primary to-orange-600 rounded-xl flex items-center justify-center"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <Target className="h-5 w-5 text-white" />
          </motion.div>
          <div>
            <h3 className="font-bold text-ui-text-primary">Graduation Progress</h3>
            <p className="text-xs text-ui-text-tertiary">Launching to DEX</p>
          </div>
        </div>

        <div className="text-right">
          <motion.p
            className="text-2xl font-bold text-brand-primary"
            key={percentComplete}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
          >
            {percentComplete.toFixed(1)}%
          </motion.p>
          <p className="text-xs text-ui-text-tertiary">complete</p>
        </div>
      </div>

      {/* Progress Bar Container */}
      <div className="relative mb-6">
        {/* Milestones */}
        <div className="absolute top-0 left-0 right-0 h-full flex">
          {milestones.map((milestone) => (
            <div
              key={milestone.percent}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
              style={{ left: `${milestone.percent}%` }}
            >
              <motion.div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                  percentComplete >= milestone.percent
                    ? 'bg-gradient-to-br from-brand-primary to-orange-600 border-brand-primary text-white'
                    : 'bg-gray-100 border-gray-300 text-gray-400'
                }`}
                animate={
                  percentComplete >= milestone.percent
                    ? { scale: [1, 1.2, 1], boxShadow: ['0 0 0 0 rgba(250, 148, 39, 0)', '0 0 0 8px rgba(250, 148, 39, 0.3)', '0 0 0 0 rgba(250, 148, 39, 0)'] }
                    : {}
                }
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <milestone.icon className="h-4 w-4" />
              </motion.div>
              <p className={`text-xs mt-1 text-center font-medium ${
                percentComplete >= milestone.percent ? 'text-brand-primary' : 'text-gray-400'
              }`}>
                {milestone.label}
              </p>
            </div>
          ))}
        </div>

        {/* Progress Track */}
        <div className="h-6 bg-gray-100 rounded-full overflow-hidden relative">
          {/* Progress Fill */}
          <motion.div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-brand-primary via-orange-500 to-yellow-500 rounded-full"
            style={{ width: progressWidth }}
          >
            {/* Animated shine */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>

          {/* Rocket */}
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 z-20"
            style={{ left: `calc(${rocketPosition}% - 16px)` }}
            animate={{
              y: [-2, 2, -2],
              rotate: [0, 5, -5, 0],
            }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            <div className="relative">
              <Rocket className="h-8 w-8 text-brand-primary drop-shadow-lg transform -rotate-90" />
              {/* Fire trail */}
              {percentComplete > 0 && (
                <motion.div
                  className="absolute -left-4 top-1/2 -translate-y-1/2 text-lg"
                  animate={{ opacity: [0.5, 1, 0.5], scale: [0.8, 1, 0.8] }}
                  transition={{ duration: 0.3, repeat: Infinity }}
                >
                  🔥
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-3 border border-orange-100">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            <span className="text-xs text-orange-600 font-medium">Raised</span>
          </div>
          <motion.p
            className="text-xl font-bold text-orange-700"
            key={raised}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
          >
            {raised.toLocaleString()} <span className="text-sm font-normal">XLM</span>
          </motion.p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-blue-600 font-medium">Remaining</span>
          </div>
          <p className="text-xl font-bold text-blue-700">
            {remaining.toLocaleString()} <span className="text-sm font-normal">XLM</span>
          </p>
        </div>
      </div>

      {/* ASTRO Allocation Preview */}
      {astroEnabled && (
        <motion.div
          className="mb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <button
            onClick={() => setShowAstroDetails(!showAstroDetails)}
            className="w-full flex items-center justify-between text-sm text-purple-600 hover:text-purple-700 transition-colors bg-purple-50 rounded-xl p-3 border border-purple-200"
          >
            <span className="flex items-center gap-2">
              <Flame className="h-4 w-4" />
              <span className="font-medium">ASTRO Allocation Preview</span>
            </span>
            <Info className="h-4 w-4" />
          </button>

          <AnimatePresence>
            {showAstroDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
                  {/* Visual allocation bar */}
                  <div className="h-3 rounded-full overflow-hidden flex">
                    <div
                      className="bg-brand-primary h-full"
                      style={{ width: `${mainPoolPercent}%` }}
                      title={`Main Pool: ${mainPoolPercent}%`}
                    />
                    <div
                      className="bg-blue-500 h-full"
                      style={{ width: `${astroLiquidityPercent}%` }}
                      title={`ASTRO Liquidity: ${astroLiquidityPercent}%`}
                    />
                    <div
                      className="bg-purple-600 h-full"
                      style={{ width: `${buybackPercent}%` }}
                      title={`Buyback: ${buybackPercent}%`}
                    />
                  </div>

                  {/* Legend */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <TrendingUp className="h-3 w-3 text-brand-primary" />
                        <span className="text-purple-700">Main Pool ({mainPoolPercent}%)</span>
                      </span>
                      <span className="font-semibold text-purple-800">
                        ~{xlmForMainPool.toLocaleString()} XLM
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Droplets className="h-3 w-3 text-blue-500" />
                        <span className="text-purple-700">ASTRO Liquidity ({astroLiquidityPercent}%)</span>
                      </span>
                      <span className="font-semibold text-purple-800">
                        ~{xlmForAstroLiquidity.toLocaleString()} XLM
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Flame className="h-3 w-3 text-purple-600" />
                        <span className="text-purple-700">Buyback & Burn ({buybackPercent}%)</span>
                      </span>
                      <span className="font-semibold text-purple-800">
                        ~{xlmForBuyback.toLocaleString()} XLM
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-purple-600 pt-2 border-t border-purple-200">
                    ASTRO buyback supports the ecosystem by permanently removing tokens from circulation.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Info Box */}
      <motion.div
        className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <PartyPopper className="h-4 w-4 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-purple-800 mb-1">
              What happens at graduation?
            </p>
            <p className="text-xs text-purple-600 leading-relaxed">
              When {tokenSymbol} reaches <strong>{threshold.toLocaleString()} XLM</strong>, it automatically
              graduates to a full AMM pool on Stellar DEX with permanently locked liquidity.
              {astroEnabled && (
                <span className="block mt-1 text-purple-700">
                  {buybackPercent}% will be used to buy and burn ASTRO tokens.
                </span>
              )}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Progress indicator dots */}
      <div className="mt-4 flex justify-center gap-1">
        {[...Array(10)].map((_, i) => (
          <motion.div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i < Math.floor(percentComplete / 10)
                ? 'w-4 bg-brand-primary'
                : 'w-1.5 bg-gray-200'
            }`}
            animate={i < Math.floor(percentComplete / 10) ? { scale: [1, 1.2, 1] } : {}}
            transition={{ delay: i * 0.1, duration: 0.5 }}
          />
        ))}
      </div>
    </div>
  );
}
