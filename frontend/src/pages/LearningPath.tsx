import { motion } from 'framer-motion';
import { GraduationCap, Trophy, Target, Book, CheckCircle2, Lock, Play, Star } from 'lucide-react';

const courses = [
  {
    id: 1,
    title: 'Docker Fundamentals',
    description: 'Master containerization with Docker from scratch',
    progress: 75,
    lessons: 12,
    completed: 9,
    duration: '6 hours',
    level: 'Beginner',
    color: 'from-blue-500 to-cyan-500',
    unlocked: true,
  },
  {
    id: 2,
    title: 'Kubernetes Basics',
    description: 'Learn container orchestration with Kubernetes',
    progress: 45,
    lessons: 16,
    completed: 7,
    duration: '8 hours',
    level: 'Intermediate',
    color: 'from-indigo-500 to-purple-500',
    unlocked: true,
  },
  {
    id: 3,
    title: 'CI/CD Pipeline',
    description: 'Build automated deployment pipelines',
    progress: 30,
    lessons: 10,
    completed: 3,
    duration: '5 hours',
    level: 'Intermediate',
    color: 'from-orange-500 to-red-500',
    unlocked: true,
  },
  {
    id: 4,
    title: 'Infrastructure as Code',
    description: 'Terraform and cloud infrastructure automation',
    progress: 0,
    lessons: 14,
    completed: 0,
    duration: '7 hours',
    level: 'Advanced',
    color: 'from-green-500 to-emerald-500',
    unlocked: false,
  },
  {
    id: 5,
    title: 'Monitoring & Observability',
    description: 'Prometheus, Grafana, and logging best practices',
    progress: 0,
    lessons: 12,
    completed: 0,
    duration: '6 hours',
    level: 'Advanced',
    color: 'from-pink-500 to-rose-500',
    unlocked: false,
  },
];

const achievements = [
  { name: 'First Container', icon: '🐳', unlocked: true },
  { name: 'K8s Master', icon: '⚓', unlocked: true },
  { name: 'CI/CD Pro', icon: '🚀', unlocked: false },
  { name: 'Infrastructure Expert', icon: '🏗️', unlocked: false },
];

export function LearningPath() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
          Learning Path
        </h1>
        <p className="text-muted-foreground">Your personalized DevOps learning journey</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Courses Started', value: '3', icon: Book, color: 'from-blue-500 to-cyan-500' },
          { label: 'Lessons Completed', value: '19', icon: CheckCircle2, color: 'from-green-500 to-emerald-500' },
          { label: 'Achievements', value: '2/4', icon: Trophy, color: 'from-yellow-500 to-orange-500' },
          { label: 'Study Time', value: '24h', icon: Target, color: 'from-purple-500 to-pink-500' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="border rounded-xl p-4 bg-card hover:shadow-lg transition-shadow"
          >
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} bg-opacity-10 flex items-center justify-center mb-3`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold mb-1">{stat.value}</div>
            <div className="text-sm text-muted-foreground">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Courses */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Your Courses</h2>
        </div>

        <div className="space-y-4">
          {courses.map((course, index) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className={`relative border rounded-2xl p-6 bg-card transition-all duration-300 ${
                course.unlocked ? 'hover:shadow-xl cursor-pointer' : 'opacity-60'
              }`}
            >
              {!course.unlocked && (
                <div className="absolute top-4 right-4">
                  <Lock className="w-5 h-5 text-muted-foreground" />
                </div>
              )}

              <div className="flex items-start gap-6">
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${course.color} flex items-center justify-center text-3xl flex-shrink-0`}>
                  {course.unlocked ? '📚' : '🔒'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-xl font-bold mb-1">{course.title}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{course.description}</p>
                    </div>
                    {course.unlocked && course.progress > 0 && (
                      <button className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:shadow-lg transition-all flex items-center gap-2">
                        <Play className="w-4 h-4" />
                        Continue
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-6 mb-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Book className="w-4 h-4" />
                      {course.lessons} lessons
                    </span>
                    <span>{course.duration}</span>
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                      course.level === 'Beginner'
                        ? 'bg-green-500/10 text-green-600'
                        : course.level === 'Intermediate'
                        ? 'bg-blue-500/10 text-blue-600'
                        : 'bg-purple-500/10 text-purple-600'
                    }`}>
                      {course.level}
                    </span>
                  </div>

                  {course.unlocked && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          {course.completed} of {course.lessons} completed
                        </span>
                        <span className="text-sm font-bold">{course.progress}%</span>
                      </div>
                      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${course.progress}%` }}
                          transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                          className={`absolute inset-y-0 left-0 bg-gradient-to-r ${course.color} rounded-full`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Achievements */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="border rounded-2xl p-6 bg-card"
      >
        <div className="flex items-center gap-2 mb-6">
          <Trophy className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Achievements</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {achievements.map((achievement, index) => (
            <motion.div
              key={achievement.name}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.9 + index * 0.1 }}
              className={`relative p-6 rounded-xl border-2 text-center transition-all ${
                achievement.unlocked
                  ? 'border-yellow-500/50 bg-yellow-500/5 hover:shadow-lg cursor-pointer'
                  : 'border-border bg-muted/30 opacity-50'
              }`}
            >
              <div className="text-4xl mb-2">{achievement.icon}</div>
              <p className="font-medium text-sm">{achievement.name}</p>
              {achievement.unlocked && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1 + index * 0.1, type: 'spring' }}
                  className="absolute -top-2 -right-2"
                >
                  <Star className="w-6 h-6 fill-yellow-500 text-yellow-500" />
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
