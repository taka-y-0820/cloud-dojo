import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { allCourses } from '../data/courses';

const prisma = new PrismaClient();

export async function learningRoutes(fastify: FastifyInstance) {
  // 全コース一覧取得
  fastify.get('/courses', async (request, reply) => {
    return allCourses.map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      level: course.level,
      duration: course.duration,
      moduleCount: course.modules.length,
      prerequisites: course.prerequisites,
    }));
  });

  // 特定コースの詳細取得
  fastify.get('/courses/:courseId', async (request, reply) => {
    const { courseId } = request.params as { courseId: string };

    const course = allCourses.find((c) => c.id === courseId);

    if (!course) {
      return reply.status(404).send({ error: 'Course not found' });
    }

    return course;
  });

  // 特定モジュールの詳細取得
  fastify.get('/courses/:courseId/modules/:moduleId', async (request, reply) => {
    const { courseId, moduleId } = request.params as { courseId: string; moduleId: string };

    const course = allCourses.find((c) => c.id === courseId);

    if (!course) {
      return reply.status(404).send({ error: 'Course not found' });
    }

    const module = course.modules.find((m) => m.id === moduleId);

    if (!module) {
      return reply.status(404).send({ error: 'Module not found' });
    }

    return module;
  });

  // 特定レッスンの詳細取得
  fastify.get('/courses/:courseId/modules/:moduleId/lessons/:lessonId', async (request, reply) => {
    const { courseId, moduleId, lessonId } = request.params as {
      courseId: string;
      moduleId: string;
      lessonId: string;
    };

    const course = allCourses.find((c) => c.id === courseId);
    if (!course) {
      return reply.status(404).send({ error: 'Course not found' });
    }

    const module = course.modules.find((m) => m.id === moduleId);
    if (!module) {
      return reply.status(404).send({ error: 'Module not found' });
    }

    const lesson = module.lessons.find((l) => l.id === lessonId);
    if (!lesson) {
      return reply.status(404).send({ error: 'Lesson not found' });
    }

    return lesson;
  });

  // レッスン完了記録
  fastify.post(
    '/courses/:courseId/modules/:moduleId/lessons/:lessonId/complete',
    async (request, reply) => {
      try {
        await request.jwtVerify();
        const payload = request.user as any;
        const { courseId, moduleId, lessonId } = request.params as {
          courseId: string;
          moduleId: string;
          lessonId: string;
        };

        const body = request.body as { timeSpent?: number };

        // レッスンが存在するか確認
        const course = allCourses.find((c) => c.id === courseId);
        if (!course) {
          return reply.status(404).send({ error: 'Course not found' });
        }

        const module = course.modules.find((m) => m.id === moduleId);
        if (!module) {
          return reply.status(404).send({ error: 'Module not found' });
        }

        const lesson = module.lessons.find((l) => l.id === lessonId);
        if (!lesson) {
          return reply.status(404).send({ error: 'Lesson not found' });
        }

        // 完了記録を保存（既存の場合は更新）
        const completedLesson = await prisma.completedLesson.upsert({
          where: {
            userId_courseId_moduleId_lessonId: {
              userId: payload.userId,
              courseId,
              moduleId,
              lessonId,
            },
          },
          update: {
            timeSpent: body.timeSpent,
            completedAt: new Date(),
          },
          create: {
            userId: payload.userId,
            courseId,
            moduleId,
            lessonId,
            score: 10,
            timeSpent: body.timeSpent,
          },
        });

        // 学習進捗を更新
        const progress = await prisma.learningProgress.findUnique({
          where: { userId: payload.userId },
        });

        if (progress) {
          // スコアを加算
          await prisma.learningProgress.update({
            where: { userId: payload.userId },
            data: {
              totalScore: progress.totalScore + 10,
              currentModule: moduleId,
            },
          });
        }

        // アチーブメントのチェック
        await checkAchievements(payload.userId, courseId, moduleId);

        return {
          message: 'Lesson completed',
          courseId,
          moduleId,
          lessonId,
          completedAt: completedLesson.completedAt,
          points: 10,
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    }
  );

  // ユーザーの学習進捗取得
  fastify.get('/my-progress', async (request, reply) => {
    try {
      await request.jwtVerify();
      const payload = request.user as any;

      // ユーザーの完了レッスン取得
      const completedLessons = await prisma.completedLesson.findMany({
        where: { userId: payload.userId },
        orderBy: { completedAt: 'desc' },
      });

      // コース別に集計
      const courseProgress: Record<string, any> = {};

      for (const completed of completedLessons) {
        if (!courseProgress[completed.courseId]) {
          courseProgress[completed.courseId] = {
            courseId: completed.courseId,
            completedLessons: [],
            completedModules: new Set(),
          };
        }
        courseProgress[completed.courseId].completedLessons.push(completed.lessonId);
        courseProgress[completed.courseId].completedModules.add(completed.moduleId);
      }

      // 進捗率を計算
      const coursesWithProgress = allCourses.map((course) => {
        const progress = courseProgress[course.id];
        const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
        const completedCount = progress?.completedLessons.length || 0;

        return {
          courseId: course.id,
          title: course.title,
          progress: totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0,
          completedLessons: progress?.completedLessons || [],
          completedModules: progress ? Array.from(progress.completedModules) : [],
          currentLesson: progress?.completedLessons[progress.completedLessons.length - 1],
        };
      });

      // 全体統計
      const userProgress = await prisma.learningProgress.findUnique({
        where: { userId: payload.userId },
      });

      return {
        userId: payload.userId,
        courses: coursesWithProgress,
        totalPoints: userProgress?.totalScore || 0,
        totalCompletedLessons: completedLessons.length,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });
}

// アチーブメントチェック関数
async function checkAchievements(userId: string, courseId: string, moduleId: string) {
  const completedLessons = await prisma.completedLesson.findMany({
    where: { userId, courseId },
  });

  const achievements = [];

  // 最初のレッスン完了
  if (completedLessons.length === 1) {
    achievements.push({
      userId,
      title: 'First Step',
      description: 'Complete your first lesson',
      icon: '🎯',
    });
  }

  // 10レッスン完了
  if (completedLessons.length === 10) {
    achievements.push({
      userId,
      title: 'Learning Enthusiast',
      description: 'Complete 10 lessons',
      icon: '📚',
    });
  }

  // Docker Fundamentals完了
  if (courseId === 'docker-fundamentals') {
    const course = allCourses.find((c) => c.id === courseId);
    if (course) {
      const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
      if (completedLessons.length === totalLessons) {
        achievements.push({
          userId,
          title: 'Docker Master',
          description: 'Complete Docker Fundamentals course',
          icon: '🐳',
        });
      }
    }
  }

  // アチーブメントを保存
  for (const achievement of achievements) {
    const existing = await prisma.achievement.findFirst({
      where: {
        userId: achievement.userId,
        title: achievement.title,
      },
    });

    if (!existing) {
      await prisma.achievement.create({ data: achievement });
    }
  }
}
