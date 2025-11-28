/**
 * Streak Counter Component
 *
 * Daily trading streak tracker with:
 * - Visual streak counter with fire animation
 * - Progress to next milestone
 * - Streak protection (freeze days)
 * - Celebration animations on milestones
 * - Mobile-optimized compact view
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame,
  Calendar,
  Shield,
  Gift,
  Sparkles,
  TrendingUp,
  Clock,
  Check,
} from 'lucide-react';
import { useTradingSounds } from '@/hooks/useTradingSounds';
import confetti from 'canvas-confetti';

// Streak milestones with rewards
const STREAK_MILESTONES = [
  { days: 3, reward: 'Early Bird Badge', icon: <Clock className="h-4 w-4" /> },
  { days: 7, reward: 'Weekly Warrior Badge', icon: <Shield className="h-4 w-4" /> },
  { days: 14, reward: '2x XP Boost (24h)', icon: <TrendingUp className="h-4 w-4" /> },
  { days: 30, reward: 'Monthly Master Badge', icon: <Gift className="h-4 w-4" /> },
  { days: 60, reward: 'Streak Champion Badge', icon: <Sparkles className="h-4 w-4" /> },
  { days: 100, reward: 'Diamond Hands Badge + Exclusive NFT', icon: <Flame className="h-4 w-4" /> },
];

// Animation variants
const flameVariants = {
  idle: {
    scale: [1, 1.1, 1],
    rotate: [0, 5, -5, 0],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    },
  },
  burst: {
    scale: [1, 1.5, 1],
    rotate: [0, 360],
    transition: {
      duration: 0.6,
      ease: 'easeOut' as const,
    },
  },
};

const numberVariants = {
  initial: { scale: 1 },
  increment: {
    scale: [1, 1.3, 1],
    transition: { duration: 0.3 },
  },
};

const milestoneVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 20,
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.9,
  },
};

interface StreakCounterProps {
  currentStreak: number;
  longestStreak: number;
  lastTradeDate?: Date;
  freezeDaysRemaining?: number;
  compact?: boolean;
  onCheckIn?: () => void;
}

export function StreakCounter({
  currentStreak,
  longestStreak,
  lastTradeDate,
  freezeDaysRemaining = 0,
  compact = false,
  onCheckIn,
}: StreakCounterProps) {
  const { playMilestone, playNotification } = useTradingSounds();
  const [isAnimating, setIsAnimating] = useState(false);
  const [showMilestone, setShowMilestone] = useState<typeof STREAK_MILESTONES[0] | null>(null);

  // Calculate next milestone
  const nextMilestone = useMemo(() => {
    return STREAK_MILESTONES.find(m => m.days > currentStreak);
  }, [currentStreak]);

  // Calculate progress to next milestone
  const progressToNext = useMemo(() => {
    if (!nextMilestone) return 100;
    const prevMilestone = STREAK_MILESTONES.filter(m => m.days <= currentStreak).pop();
    const start = prevMilestone?.days || 0;
    const end = nextMilestone.days;
    return ((currentStreak - start) / (end - start)) * 100;
  }, [currentStreak, nextMilestone]);

  // Check if today is tradeable
  const canTradeToday = useMemo(() => {
    if (!lastTradeDate) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastTrade = new Date(lastTradeDate);
    lastTrade.setHours(0, 0, 0, 0);
    return today.getTime() !== lastTrade.getTime();
  }, [lastTradeDate]);

  // Check for milestone unlock
  useEffect(() => {
    const milestone = STREAK_MILESTONES.find(m => m.days === currentStreak);
    if (milestone) {
      setShowMilestone(milestone);
      playMilestone();

      // Confetti burst!
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#ff6b6b', '#ffa500', '#ffd700'],
      });

      setTimeout(() => setShowMilestone(null), 5000);
    }
  }, [currentStreak, playMilestone]);

  // Handle streak increment animation
  const handleCheckIn = () => {
    if (!canTradeToday) return;

    setIsAnimating(true);
    playNotification();

    setTimeout(() => {
      setIsAnimating(false);
      onCheckIn?.();
    }, 600);
  };

  // Get flame intensity based on streak
  const flameIntensity = useMemo(() => {
    if (currentStreak >= 30) return 'text-orange-500';
    if (currentStreak >= 14) return 'text-orange-400';
    if (currentStreak >= 7) return 'text-yellow-500';
    if (currentStreak >= 3) return 'text-yellow-400';
    return 'text-gray-400';
  }, [currentStreak]);

  // Compact view
  if (compact) {
    return (
      <div className="flex items-center gap-2 bg-gradient-to-r from-orange-50 to-yellow-50 px-4 py-2 rounded-full">
        <motion.div
          variants={flameVariants}
          animate={isAnimating ? 'burst' : 'idle'}
          className={flameIntensity}
        >
          <Flame className="h-5 w-5" />
        </motion.div>
        <motion.span
          variants={numberVariants}
          animate={isAnimating ? 'increment' : 'initial'}
          className="font-bold text-lg text-gray-900"
        >
          {currentStreak}
        </motion.span>
        <span className="text-sm text-gray-500">day streak</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-ui-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border-b border-ui-border">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-ui-text-primary flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Trading Streak
          </h3>
          {freezeDaysRemaining > 0 && (
            <div className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
              <Shield className="h-3 w-3" />
              {freezeDaysRemaining} freeze days
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Main Streak Counter */}
        <div className="text-center py-6">
          <motion.div
            variants={flameVariants}
            animate={isAnimating ? 'burst' : 'idle'}
            className={`inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-orange-100 to-yellow-100 mb-4 ${flameIntensity}`}
          >
            <Flame className="h-10 w-10" />
          </motion.div>

          <motion.div
            variants={numberVariants}
            animate={isAnimating ? 'increment' : 'initial'}
            className="text-5xl font-bold text-gray-900 mb-1"
          >
            {currentStreak}
          </motion.div>

          <p className="text-ui-text-secondary">
            {currentStreak === 1 ? 'Day Streak' : 'Days Streak'}
          </p>

          {currentStreak > 0 && currentStreak === longestStreak && (
            <div className="mt-2 inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              Personal Best!
            </div>
          )}
        </div>

        {/* Today's Status */}
        <div className={`p-4 rounded-xl ${canTradeToday ? 'bg-gray-50' : 'bg-green-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${canTradeToday ? 'bg-gray-200' : 'bg-green-200'}`}>
                {canTradeToday ? (
                  <Calendar className="h-5 w-5 text-gray-600" />
                ) : (
                  <Check className="h-5 w-5 text-green-600" />
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {canTradeToday ? 'Trade Today!' : "Today's Complete"}
                </p>
                <p className="text-sm text-gray-500">
                  {canTradeToday
                    ? 'Make a trade to maintain your streak'
                    : 'Come back tomorrow to continue'}
                </p>
              </div>
            </div>

            {canTradeToday && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleCheckIn}
                className="px-4 py-2 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
              >
                Trade Now
              </motion.button>
            )}
          </div>
        </div>

        {/* Progress to Next Milestone */}
        {nextMilestone && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ui-text-secondary">Next milestone</span>
              <span className="font-medium text-gray-900 flex items-center gap-1">
                {nextMilestone.icon}
                Day {nextMilestone.days}
              </span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressToNext}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-orange-400 to-yellow-400 rounded-full"
              />
            </div>
            <p className="text-xs text-center text-ui-text-secondary">
              {nextMilestone.days - currentStreak} days to unlock: {nextMilestone.reward}
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="text-center p-3 bg-gray-50 rounded-xl">
            <p className="text-2xl font-bold text-gray-900">{longestStreak}</p>
            <p className="text-xs text-ui-text-secondary">Longest Streak</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-xl">
            <p className="text-2xl font-bold text-gray-900">
              {STREAK_MILESTONES.filter(m => m.days <= currentStreak).length}
            </p>
            <p className="text-xs text-ui-text-secondary">Milestones Hit</p>
          </div>
        </div>

        {/* Milestones Preview */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Streak Rewards</h4>
          <div className="space-y-2">
            {STREAK_MILESTONES.slice(0, 4).map((milestone) => (
              <div
                key={milestone.days}
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                  currentStreak >= milestone.days
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-gray-50'
                }`}
              >
                <div className={`p-1.5 rounded-full ${
                  currentStreak >= milestone.days ? 'bg-green-200 text-green-700' : 'bg-gray-200 text-gray-500'
                }`}>
                  {currentStreak >= milestone.days ? <Check className="h-4 w-4" /> : milestone.icon}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    currentStreak >= milestone.days ? 'text-green-700' : 'text-gray-600'
                  }`}>
                    Day {milestone.days}
                  </p>
                </div>
                <p className={`text-xs ${
                  currentStreak >= milestone.days ? 'text-green-600' : 'text-gray-500'
                }`}>
                  {milestone.reward}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Milestone Unlock Popup */}
      <AnimatePresence>
        {showMilestone && (
          <motion.div
            variants={milestoneVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowMilestone(null)}
          >
            <div
              className="bg-white rounded-2xl p-8 max-w-sm mx-4 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0],
                }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-yellow-400 text-white mb-4"
              >
                <Flame className="h-10 w-10" />
              </motion.div>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {showMilestone.days} Day Streak!
              </h2>

              <p className="text-gray-600 mb-4">
                Congratulations! You&apos;ve unlocked:
              </p>

              <div className="bg-gradient-to-r from-orange-100 to-yellow-100 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-center gap-2 text-orange-700 font-bold">
                  {showMilestone.icon}
                  {showMilestone.reward}
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowMilestone(null)}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold rounded-xl"
              >
                Awesome!
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default StreakCounter;
