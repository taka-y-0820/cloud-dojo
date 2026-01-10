import { motion } from 'framer-motion';
import {
  TrendingUp,
  Award,
  Target,
  Zap,
  Clock,
  CheckCircle2,
  ArrowRight,
  Activity,
  Container,
  Network,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/constants';
import { PageLayout } from '@/layouts/PageLayout';

const stats = [
  {
    label: 'Exercises Completed',
    value: '12',
    change: '+3 this week',
    icon: CheckCircle2,
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-green-500/10',
  },
  {
    label: 'Learning Streak',
    value: '7 days',
    change: 'Keep it up!',
    icon: TrendingUp,
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    label: 'Achievements',
    value: '8',
    change: '2 new',
    icon: Award,
    color: 'from-yellow-500 to-orange-500',
    bgColor: 'bg-yellow-500/10',
  },
  {
    label: 'Total Time',
    value: '24h',
    change: '+5h this week',
    icon: Clock,
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-500/10',
  },
];

const recentActivities = [
  { title: 'Completed Docker Multi-stage Build', time: '2 hours ago', icon: Container },
  { title: 'Started Kubernetes Deployment', time: '5 hours ago', icon: Network },
  { title: 'Earned "Container Expert" Badge', time: '1 day ago', icon: Award },
];

const learningPaths = [
  { title: 'Docker Fundamentals', progress: 75, lessons: 12, color: 'from-blue-500 to-cyan-500' },
  { title: 'Kubernetes Basics', progress: 45, lessons: 16, color: 'from-indigo-500 to-purple-500' },
  { title: 'CI/CD Pipeline', progress: 30, lessons: 10, color: 'from-orange-500 to-red-500' },
];

export function Dashboard() {
  return (
    <PageLayout>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Welcome back! 👋
        </h1>
        <p className="text-muted-foreground text-lg">Continue your DevOps learning journey</p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            whileHover={{ y: -8 }}
            className="relative group"
          >
            <div className="border rounded-2xl p-6 bg-card hover:shadow-xl hover:border-primary/50 transition-all duration-300 relative overflow-hidden">
              {/* Gradient background on hover */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}
              />

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}
                  >
                    <stat.icon
                      className={`w-6 h-6 bg-gradient-to-br ${stat.color} bg-clip-text text-transparent`}
                      style={{ WebkitTextFillColor: 'transparent' }}
                    />
                  </div>
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {stat.change}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Learning Progress */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="lg:col-span-2 border rounded-2xl p-8 bg-card hover:shadow-xl hover:border-primary/50 transition-all duration-300"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Target className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">Learning Progress</h2>
            </div>
            <Link
              to={ROUTES.LEARNING}
              className="text-sm text-primary hover:underline flex items-center gap-1 group"
            >
              View all
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="space-y-4">
            {learningPaths.map((path, index) => (
              <motion.div
                key={path.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
                className="group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium group-hover:text-primary transition-colors">
                    {path.title}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {path.progress}% · {path.lessons} lessons
                  </span>
                </div>
                <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${path.progress}%` }}
                    transition={{ duration: 1, delay: 0.6 + index * 0.1, ease: 'easeOut' }}
                    className={`absolute inset-y-0 left-0 bg-gradient-to-r ${path.color} rounded-full`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Recent Activities */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="border rounded-2xl p-8 bg-card hover:shadow-xl hover:border-primary/50 transition-all duration-300"
        >
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Recent Activity</h2>
          </div>

          <div className="space-y-4">
            {recentActivities.map((activity, index) => (
              <motion.div
                key={activity.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <activity.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm group-hover:text-primary transition-colors">
                    {activity.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        className="border rounded-2xl p-6 bg-card hover:shadow-xl transition-shadow duration-300"
      >
        <div className="flex items-center gap-2 mb-6">
          <Zap className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Quick Actions</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to={ROUTES.DOCKER}
            className="group relative overflow-hidden rounded-xl p-6 border-2 border-transparent hover:border-blue-500 transition-all duration-300 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 hover:shadow-lg"
          >
            <Container className="w-8 h-8 text-blue-500 mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold mb-1">Start Docker Build</h3>
            <p className="text-sm text-muted-foreground">Build and visualize containers</p>
            <ArrowRight className="absolute bottom-4 right-4 w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </Link>

          <Link
            to={ROUTES.KUBERNETES}
            className="group relative overflow-hidden rounded-xl p-6 border-2 border-transparent hover:border-purple-500 transition-all duration-300 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 hover:shadow-lg"
          >
            <Network className="w-8 h-8 text-purple-500 mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold mb-1">Deploy to K8s</h3>
            <p className="text-sm text-muted-foreground">Visualize deployments</p>
            <ArrowRight className="absolute bottom-4 right-4 w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </Link>

          <Link
            to={ROUTES.LEARNING}
            className="group relative overflow-hidden rounded-xl p-6 border-2 border-transparent hover:border-green-500 transition-all duration-300 bg-gradient-to-br from-green-500/10 to-emerald-500/10 hover:shadow-lg"
          >
            <Target className="w-8 h-8 text-green-500 mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold mb-1">Continue Learning</h3>
            <p className="text-sm text-muted-foreground">Resume your path</p>
            <ArrowRight className="absolute bottom-4 right-4 w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </Link>
        </div>
      </motion.div>
    </PageLayout>
  );
}
