/**
 * Badge System Component
 *
 * Gamification badges with:
 * - Achievement tracking
 * - Progress visualization
 * - Unlock animations
 * - Rarity tiers (Common, Rare, Epic, Legendary)
 * - Badge tooltips with descriptions
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Zap,
  Flame,
  Star,
  Crown,
  Rocket,
  Diamond,
  Target,
  Shield,
  Heart,
  Users,
  TrendingUp,
  Clock,
  Gift,
  Award,
  Medal,
} from 'lucide-react';
import { useTradingSounds } from '@/hooks/useTradingSounds';

// Badge definitions
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  category: 'trading' | 'social' | 'achievement' | 'special';
  requirement: string;
  progress?: number;
  maxProgress?: number;
  unlockedAt?: number;
}

// Rarity colors
const rarityColors = {
  common: {
    bg: 'bg-gray-100',
    border: 'border-gray-300',
    text: 'text-gray-700',
    glow: '',
  },
  rare: {
    bg: 'bg-blue-100',
    border: 'border-blue-400',
    text: 'text-blue-700',
    glow: 'shadow-blue-200',
  },
  epic: {
    bg: 'bg-purple-100',
    border: 'border-purple-400',
    text: 'text-purple-700',
    glow: 'shadow-purple-200',
  },
  legendary: {
    bg: 'bg-gradient-to-br from-yellow-100 to-orange-100',
    border: 'border-yellow-400',
    text: 'text-yellow-700',
    glow: 'shadow-yellow-200 shadow-lg',
  },
};

// Default badge definitions
const DEFAULT_BADGES: Badge[] = [
  // Trading badges
  {
    id: 'first_trade',
    name: 'First Steps',
    description: 'Complete your first trade',
    icon: <Rocket className="h-5 w-5" />,
    rarity: 'common',
    category: 'trading',
    requirement: 'Complete 1 trade',
  },
  {
    id: 'trader_10',
    name: 'Active Trader',
    description: 'Complete 10 trades',
    icon: <TrendingUp className="h-5 w-5" />,
    rarity: 'common',
    category: 'trading',
    requirement: 'Complete 10 trades',
    maxProgress: 10,
  },
  {
    id: 'trader_100',
    name: 'Pro Trader',
    description: 'Complete 100 trades',
    icon: <Target className="h-5 w-5" />,
    rarity: 'rare',
    category: 'trading',
    requirement: 'Complete 100 trades',
    maxProgress: 100,
  },
  {
    id: 'trader_1000',
    name: 'Trading Legend',
    description: 'Complete 1,000 trades',
    icon: <Crown className="h-5 w-5" />,
    rarity: 'legendary',
    category: 'trading',
    requirement: 'Complete 1,000 trades',
    maxProgress: 1000,
  },
  {
    id: 'whale_buyer',
    name: 'Whale',
    description: 'Make a single trade over 10,000 XLM',
    icon: <Diamond className="h-5 w-5" />,
    rarity: 'epic',
    category: 'trading',
    requirement: 'Trade 10,000+ XLM at once',
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Buy within 5 minutes of token launch',
    icon: <Clock className="h-5 w-5" />,
    rarity: 'rare',
    category: 'trading',
    requirement: 'Buy token within 5 min of launch',
  },
  // Achievement badges
  {
    id: 'profit_100',
    name: 'Making Gains',
    description: 'Achieve 100% profit on a trade',
    icon: <Flame className="h-5 w-5" />,
    rarity: 'rare',
    category: 'achievement',
    requirement: '100% profit on single trade',
  },
  {
    id: 'profit_1000',
    name: 'Diamond Hands',
    description: 'Achieve 1,000% profit on a trade',
    icon: <Star className="h-5 w-5" />,
    rarity: 'legendary',
    category: 'achievement',
    requirement: '1,000% profit on single trade',
  },
  {
    id: 'graduation_holder',
    name: 'Graduation Gang',
    description: 'Hold a token that graduates to DEX',
    icon: <Trophy className="h-5 w-5" />,
    rarity: 'epic',
    category: 'achievement',
    requirement: 'Hold token during graduation',
  },
  // Social badges
  {
    id: 'token_creator',
    name: 'Creator',
    description: 'Create your first token',
    icon: <Zap className="h-5 w-5" />,
    rarity: 'common',
    category: 'social',
    requirement: 'Create 1 token',
  },
  {
    id: 'serial_creator',
    name: 'Serial Creator',
    description: 'Create 10 tokens',
    icon: <Medal className="h-5 w-5" />,
    rarity: 'rare',
    category: 'social',
    requirement: 'Create 10 tokens',
    maxProgress: 10,
  },
  {
    id: 'community_builder',
    name: 'Community Builder',
    description: 'Get 100 unique traders on your token',
    icon: <Users className="h-5 w-5" />,
    rarity: 'epic',
    category: 'social',
    requirement: '100 unique traders on your token',
    maxProgress: 100,
  },
  // Special badges
  {
    id: 'og_member',
    name: 'OG Member',
    description: 'Joined during beta period',
    icon: <Shield className="h-5 w-5" />,
    rarity: 'legendary',
    category: 'special',
    requirement: 'Join during beta',
  },
  {
    id: 'streak_7',
    name: 'Weekly Warrior',
    description: 'Trade 7 days in a row',
    icon: <Award className="h-5 w-5" />,
    rarity: 'rare',
    category: 'special',
    requirement: '7-day trading streak',
    maxProgress: 7,
  },
  {
    id: 'streak_30',
    name: 'Monthly Master',
    description: 'Trade 30 days in a row',
    icon: <Gift className="h-5 w-5" />,
    rarity: 'epic',
    category: 'special',
    requirement: '30-day trading streak',
    maxProgress: 30,
  },
  {
    id: 'supporter',
    name: 'Supporter',
    description: 'Support the community',
    icon: <Heart className="h-5 w-5" />,
    rarity: 'common',
    category: 'social',
    requirement: 'Like 10 tokens',
    maxProgress: 10,
  },
];

// Animation variants
const badgeVariants = {
  hidden: { opacity: 0, scale: 0.8, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 20 },
  },
  hover: {
    scale: 1.05,
    transition: { duration: 0.2 },
  },
};

const unlockVariants = {
  hidden: { opacity: 0, scale: 0, rotate: -180 },
  visible: {
    opacity: 1,
    scale: [0, 1.3, 1],
    rotate: 0,
    transition: {
      duration: 0.6,
      ease: 'easeOut' as const,
      times: [0, 0.6, 1],
    },
  },
};

const progressVariants = {
  initial: { width: 0 },
  animate: (progress: number) => ({
    width: `${progress}%`,
    transition: { duration: 0.8, ease: 'easeOut' as const },
  }),
};

// Badge card component
interface BadgeCardProps {
  badge: Badge;
  isUnlocked: boolean;
  isNew?: boolean;
  showProgress?: boolean;
  onClick?: () => void;
}

function BadgeCard({ badge, isUnlocked, isNew, showProgress = true, onClick }: BadgeCardProps) {
  const colors = rarityColors[badge.rarity];
  const progress = badge.progress && badge.maxProgress
    ? Math.min((badge.progress / badge.maxProgress) * 100, 100)
    : 0;

  return (
    <motion.div
      variants={badgeVariants}
      initial="hidden"
      animate="visible"
      whileHover={isUnlocked ? "hover" : undefined}
      onClick={onClick}
      className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
        isUnlocked
          ? `${colors.bg} ${colors.border} ${colors.glow}`
          : 'bg-gray-50 border-gray-200 grayscale opacity-60'
      }`}
    >
      {/* New badge indicator */}
      {isNew && isUnlocked && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full"
        >
          NEW!
        </motion.div>
      )}

      {/* Rarity indicator */}
      <div className={`absolute top-2 right-2 text-xs font-bold uppercase ${colors.text}`}>
        {badge.rarity}
      </div>

      {/* Badge content */}
      <div className="flex flex-col items-center text-center space-y-2">
        <div className={`p-3 rounded-full ${isUnlocked ? colors.bg : 'bg-gray-100'}`}>
          <span className={isUnlocked ? colors.text : 'text-gray-400'}>
            {badge.icon}
          </span>
        </div>

        <h4 className={`font-bold text-sm ${isUnlocked ? 'text-gray-900' : 'text-gray-500'}`}>
          {badge.name}
        </h4>

        <p className="text-xs text-gray-500 line-clamp-2">
          {badge.description}
        </p>

        {/* Progress bar */}
        {showProgress && badge.maxProgress && !isUnlocked && (
          <div className="w-full mt-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-500">Progress</span>
              <span className="font-medium text-gray-700">
                {badge.progress || 0}/{badge.maxProgress}
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                custom={progress}
                variants={progressVariants}
                initial="initial"
                animate="animate"
                className={`h-full rounded-full ${
                  badge.rarity === 'legendary' ? 'bg-gradient-to-r from-yellow-400 to-orange-400' :
                  badge.rarity === 'epic' ? 'bg-purple-500' :
                  badge.rarity === 'rare' ? 'bg-blue-500' :
                  'bg-gray-500'
                }`}
              />
            </div>
          </div>
        )}

        {/* Unlock date */}
        {isUnlocked && badge.unlockedAt && (
          <p className="text-xs text-gray-400">
            Unlocked {new Date(badge.unlockedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// Badge unlock notification
interface BadgeUnlockNotificationProps {
  badge: Badge;
  onClose: () => void;
}

export function BadgeUnlockNotification({ badge, onClose }: BadgeUnlockNotificationProps) {
  const { playMilestone } = useTradingSounds();
  const colors = rarityColors[badge.rarity];

  useEffect(() => {
    playMilestone();

    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [playMilestone, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -100, x: '-50%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -100 }}
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50"
    >
      <div className={`p-6 rounded-2xl border-2 shadow-2xl ${colors.bg} ${colors.border} ${colors.glow}`}>
        <div className="flex items-center gap-4">
          <motion.div
            variants={unlockVariants}
            initial="hidden"
            animate="visible"
            className={`p-4 rounded-full ${colors.bg}`}
          >
            <span className={`${colors.text} scale-150`}>
              {badge.icon}
            </span>
          </motion.div>

          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">Badge Unlocked!</p>
            <h3 className={`text-xl font-bold ${colors.text}`}>{badge.name}</h3>
            <p className="text-sm text-gray-600">{badge.description}</p>
          </div>

          <button
            onClick={onClose}
            className="ml-4 p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            ×
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// Main badge system component
interface BadgeSystemProps {
  userBadges?: Badge[];
  userProgress?: Record<string, number>;
  onBadgeClick?: (badge: Badge) => void;
  showAll?: boolean;
  compact?: boolean;
}

export function BadgeSystem({
  userBadges = [],
  userProgress = {},
  onBadgeClick,
  showAll = true,
  compact = false,
}: BadgeSystemProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [newUnlock, setNewUnlock] = useState<Badge | null>(null);

  // Merge user progress with default badges
  const allBadges = useMemo(() => {
    const unlockedIds = new Set(userBadges.map(b => b.id));

    return DEFAULT_BADGES.map(badge => ({
      ...badge,
      progress: userProgress[badge.id] || 0,
      unlockedAt: userBadges.find(b => b.id === badge.id)?.unlockedAt,
      isUnlocked: unlockedIds.has(badge.id),
    }));
  }, [userBadges, userProgress]);

  // Filter by category
  const filteredBadges = useMemo(() => {
    let badges = showAll ? allBadges : allBadges.filter(b => b.isUnlocked);

    if (selectedCategory !== 'all') {
      badges = badges.filter(b => b.category === selectedCategory);
    }

    // Sort: unlocked first, then by rarity
    const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
    badges.sort((a, b) => {
      if (a.isUnlocked !== b.isUnlocked) return a.isUnlocked ? -1 : 1;
      return rarityOrder[a.rarity] - rarityOrder[b.rarity];
    });

    return badges;
  }, [allBadges, selectedCategory, showAll]);

  // Stats
  const stats = useMemo(() => ({
    total: DEFAULT_BADGES.length,
    unlocked: userBadges.length,
    legendary: userBadges.filter(b => b.rarity === 'legendary').length,
    epic: userBadges.filter(b => b.rarity === 'epic').length,
    rare: userBadges.filter(b => b.rarity === 'rare').length,
    common: userBadges.filter(b => b.rarity === 'common').length,
  }), [userBadges]);

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'trading', label: 'Trading' },
    { id: 'achievement', label: 'Achievements' },
    { id: 'social', label: 'Social' },
    { id: 'special', label: 'Special' },
  ];

  return (
    <div className="space-y-4">
      {/* Stats Header */}
      {!compact && (
        <div className="bg-gradient-to-r from-brand-primary/10 to-brand-blue/10 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg text-ui-text-primary">Your Badges</h3>
              <p className="text-sm text-ui-text-secondary">
                {stats.unlocked} of {stats.total} unlocked
              </p>
            </div>
            <div className="flex items-center gap-2">
              {stats.legendary > 0 && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">
                  {stats.legendary} Legendary
                </span>
              )}
              {stats.epic > 0 && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                  {stats.epic} Epic
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(stats.unlocked / stats.total) * 100}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-brand-primary to-brand-blue rounded-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat.id
                ? 'bg-brand-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Badge Grid */}
      <motion.div
        layout
        className={`grid gap-4 ${compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}
      >
        <AnimatePresence mode="popLayout">
          {filteredBadges.map((badge) => (
            <BadgeCard
              key={badge.id}
              badge={badge}
              isUnlocked={badge.isUnlocked || false}
              showProgress={!compact}
              onClick={() => onBadgeClick?.(badge)}
            />
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Empty state */}
      {filteredBadges.length === 0 && (
        <div className="text-center py-8 text-ui-text-secondary">
          <Trophy className="h-12 w-12 mx-auto mb-2 opacity-30" />
          <p>No badges in this category yet</p>
          <p className="text-sm">Keep trading to unlock achievements!</p>
        </div>
      )}

      {/* Unlock notification */}
      <AnimatePresence>
        {newUnlock && (
          <BadgeUnlockNotification
            badge={newUnlock}
            onClose={() => setNewUnlock(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default BadgeSystem;
