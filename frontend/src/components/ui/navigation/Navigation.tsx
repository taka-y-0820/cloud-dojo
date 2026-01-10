import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Wifi,
  Container,
  Layers,
  Network,
  GitBranch,
  GraduationCap,
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

export function Navigation() {
  return (
    <nav className="w-64 border-r bg-card relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 gradient-mesh opacity-50" />

      <div className="relative z-10">
        <div className="p-6 border-b border-border/50">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r bg-gray-200 flex items-center justify-center text-2xl">
                <img src="/icons/cloud-dojo.png" alt="cloud-dojo" width={50} height={50} />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  Cloud Dojo
                </h1>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>DevOps Learning</span>
                </div>
              </div>
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
                  `group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 relative overflow-hidden ${
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
                    <span className="font-medium relative z-10">{item.label}</span>
                    {isActive && (
                      <motion.div
                        className="ml-auto w-2 h-2 bg-white rounded-full"
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
    </nav>
  );
}
