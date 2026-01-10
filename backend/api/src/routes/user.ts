import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
});

const updateProgressSchema = z.object({
  currentModule: z.string().optional(),
  completedModules: z.array(z.string()).optional(),
  scoreIncrement: z.number().optional(),
});

export async function userRoutes(fastify: FastifyInstance) {
  // プロフィール取得
  fastify.get('/profile', async (request, reply) => {
    try {
      await request.jwtVerify();
      const payload = request.user as any;

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        include: {
          progress: true,
          achievements: true,
          executions: {
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        progress: user.progress,
        achievements: user.achievements,
        recentExecutions: user.executions,
        createdAt: user.createdAt,
      };
    } catch (error) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // プロフィール更新
  fastify.put('/profile', async (request, reply) => {
    try {
      await request.jwtVerify();
      const payload = request.user as any;
      const body = updateProfileSchema.parse(request.body);

      // メールアドレス変更の場合、重複チェック
      if (body.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: body.email },
        });

        if (existingUser && existingUser.id !== payload.userId) {
          return reply.status(400).send({ error: 'Email already in use' });
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id: payload.userId },
        data: {
          email: body.email,
        },
      });

      return {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        updatedAt: updatedUser.updatedAt,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', details: error.errors });
      }
      return reply.status(500).send({ error: 'Update failed' });
    }
  });

  // パスワード変更
  fastify.post('/change-password', async (request, reply) => {
    try {
      await request.jwtVerify();
      const payload = request.user as any;
      const body = changePasswordSchema.parse(request.body);

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // 現在のパスワード検証
      const isValidPassword = await bcrypt.compare(body.currentPassword, user.password);

      if (!isValidPassword) {
        return reply.status(401).send({ error: 'Current password is incorrect' });
      }

      // 新しいパスワードをハッシュ化
      const hashedPassword = await bcrypt.hash(body.newPassword, 10);

      await prisma.user.update({
        where: { id: payload.userId },
        data: { password: hashedPassword },
      });

      return { message: 'Password changed successfully' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', details: error.errors });
      }
      return reply.status(500).send({ error: 'Password change failed' });
    }
  });

  // 学習進捗取得
  fastify.get('/progress', async (request, reply) => {
    try {
      await request.jwtVerify();
      const payload = request.user as any;

      const progress = await prisma.learningProgress.findUnique({
        where: { userId: payload.userId },
      });

      if (!progress) {
        return reply.status(404).send({ error: 'Progress not found' });
      }

      return progress;
    } catch (error) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // 学習進捗更新
  fastify.put('/progress', async (request, reply) => {
    try {
      await request.jwtVerify();
      const payload = request.user as any;
      const body = updateProgressSchema.parse(request.body);

      const currentProgress = await prisma.learningProgress.findUnique({
        where: { userId: payload.userId },
      });

      if (!currentProgress) {
        return reply.status(404).send({ error: 'Progress not found' });
      }

      const updatedProgress = await prisma.learningProgress.update({
        where: { userId: payload.userId },
        data: {
          currentModule: body.currentModule ?? currentProgress.currentModule,
          completedModules: body.completedModules ?? currentProgress.completedModules,
          totalScore: body.scoreIncrement
            ? currentProgress.totalScore + body.scoreIncrement
            : currentProgress.totalScore,
        },
      });

      return updatedProgress;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', details: error.errors });
      }
      return reply.status(500).send({ error: 'Progress update failed' });
    }
  });

  // 学習統計取得
  fastify.get('/stats', async (request, reply) => {
    try {
      await request.jwtVerify();
      const payload = request.user as any;

      const progress = await prisma.learningProgress.findUnique({
        where: { userId: payload.userId },
      });

      const executionCount = await prisma.execution.count({
        where: { userId: payload.userId },
      });

      const successCount = await prisma.execution.count({
        where: {
          userId: payload.userId,
          status: 'success',
        },
      });

      const achievementCount = await prisma.achievement.count({
        where: { userId: payload.userId },
      });

      return {
        totalScore: progress?.totalScore || 0,
        completedModules: progress?.completedModules || [],
        currentModule: progress?.currentModule,
        executionCount,
        successCount,
        achievementCount,
        successRate: executionCount > 0 ? (successCount / executionCount) * 100 : 0,
      };
    } catch (error) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });
}
