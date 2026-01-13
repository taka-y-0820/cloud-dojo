import { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Wifi,
  Container,
  Layers,
  Network,
  GitBranch,
  GraduationCap,
  Pin,
  PinOff,
} from 'lucide-react';
import { ROUTES } from '@/config/constants';

const navItems = [
  {
    to: ROUTES.HOME,
    icon: LayoutDashboard,
    label: 'Dashboard',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    to: ROUTES.NETWORK,
    icon: Wifi,
    label: 'Network Basics',
    color: 'from-cyan-500 to-blue-500',
  },
  { to: ROUTES.DOCKER, icon: Container, label: 'Docker Build', color: 'from-blue-600 to-blue-400' },
  {
    to: ROUTES.COMPOSE,
    icon: Layers,
    label: 'Docker Compose',
    color: 'from-purple-600 to-pink-500',
  },
  {
    to: ROUTES.KUBERNETES,
    icon: Network,
    label: 'Kubernetes',
    color: 'from-indigo-500 to-purple-500',
  },
  {
    to: ROUTES.CICD,
    icon: GitBranch,
    label: 'CI/CD Pipeline',
    color: 'from-orange-500 to-red-500',
  },
  {
    to: ROUTES.LEARNING,
    icon: GraduationCap,
    label: 'Learning Path',
    color: 'from-green-500 to-emerald-500',
  },
];

const NAV_PIN_KEY = 'nav-pinned';

const getPinnedState = () => {
  const stored = localStorage.getItem(NAV_PIN_KEY);
  return stored === 'true';
};

const setPinnedState = (pinned: boolean) => {
  localStorage.setItem(NAV_PIN_KEY, pinned.toString());
};

export function Navigation() {
  const [isPinned, setIsPinned] = useState(getPinnedState());
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimerRef = useRef<number | null>(null);

  const isExpanded = isPinned || isHovered;

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === NAV_PIN_KEY) {
        setIsPinned(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // ピン状態変更時に LocalStorage 保存
  useEffect(() => {
    setPinnedState(isPinned);
  }, [isPinned]);

  const handleMouseEnter = useCallback(() => {
    if (isPinned) return; // ピン固定中はホバー処理不要
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 200);
  }, [isPinned]);

  const handleMouseLeave = useCallback(() => {
    if (isPinned) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 150);
  }, [isPinned]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const togglePin = () => {
    setIsPinned((prev) => !prev);
  };

  return (
    <motion.nav
      className="w-64 border-r bg-card relative overflow-hidden"
      animate={{ width: isExpanded ? 256 : 64 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-expanded={isExpanded}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 gradient-mesh opacity-50" />

      <div className="relative z-10 flex flex-col h-full">
        <div className="p-3 pt-5 border-b border-border/50 flex items-center justify-between gap-2">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r bg-gray-200 flex items-center justify-center text-2xl">
                <img src="/icons/cloud-dojo.png" alt="cloud-dojo" width={50} height={50} />
              </div>
              <AnimatePresence mode="wait">
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <h1 className="w-40 flex-shrink-0 text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                      Cloud Dojo
                    </h1>
                  </motion.div>
                )}
              </AnimatePresence>
              {/* ピンボタン */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    onClick={togglePin}
                    aria-label={isPinned ? 'ナビゲーション固定を解除' : 'ナビゲーションを固定'}
                    aria-pressed={isPinned}
                    title={isPinned ? '固定解除' : '固定'}
                  >
                    {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        <div className="space-y-2 p-3 mt-2">
          {navItems.map((item, index) => (
            <motion.div
              key={item.to}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `group flex items-center ${isExpanded ? 'gap-3 px-3' : 'justify-center px-2'} py-3 rounded-xl transition-all duration-200 relative overflow-hidden ${
                    isActive
                      ? 'bg-gradient-to-r ' + item.color + ' text-white shadow-lg scale-105'
                      : 'hover:bg-accent/50 hover:scale-102 hover:shadow-md'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute inset-0 bg-gradient-to-r opacity-20"
                        initial={false}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}
                    <item.icon
                      className={`w-5 h-5 relative z-10 transition-transform group-hover:scale-110 ${
                        isActive ? '' : 'text-muted-foreground'
                      }`}
                    />
                    <AnimatePresence mode="wait">
                      {isExpanded && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.15 }}
                          className="font-medium relative z-10 whitespace-nowrap overflow-hidden"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {isActive && isExpanded && (
                      <motion.div
                        className="ml-auto w-2 h-2 bg-white rounded-full flex-shrink-0"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.nav>
  );
}
