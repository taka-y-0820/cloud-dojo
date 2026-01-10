import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).optional(),
});

const SALT_ROUNDS = 10;

export async function authRoutes(fastify: FastifyInstance) {
  // ユーザー登録
  fastify.post('/register', async (request, reply) => {
    try {
      const body = registerSchema.parse(request.body);

      // 既存ユーザーチェック
      const existingUser = await prisma.user.findUnique({
        where: { email: body.email },
      });

      if (existingUser) {
        return reply.status(400).send({ error: 'Email already registered' });
      }

      // パスワードのハッシュ化
      const hashedPassword = await bcrypt.hash(body.password, SALT_ROUNDS);

      // ユーザー作成
      const user = await prisma.user.create({
        data: {
          email: body.email,
          password: hashedPassword,
          role: 'owner',
        },
      });

      // 学習進捗レコード作成
      await prisma.learningProgress.create({
        data: {
          userId: user.id,
          currentModule: null,
          completedModules: [],
          totalScore: 0,
        },
      });

      // JWTトークン生成
      const token = fastify.jwt.sign({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', details: error.errors });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Registration failed' });
    }
  });

  // ログイン
  fastify.post('/login', async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);

      // ユーザー検索
      const user = await prisma.user.findUnique({
        where: { email: body.email },
        include: { progress: true },
      });

      if (!user) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      // パスワード検証
      const isValidPassword = await bcrypt.compare(body.password, user.password);

      if (!isValidPassword) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      // JWTトークン生成
      const token = fastify.jwt.sign({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          progress: user.progress,
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', details: error.errors });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Login failed' });
    }
  });

  // トークンリフレッシュ
  fastify.post('/refresh', async (request, reply) => {
    try {
      await request.jwtVerify();
      const payload = request.user as any;

      const newToken = fastify.jwt.sign({
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      });

      return { token: newToken };
    } catch (error) {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  });

  // プロフィール取得（認証必須）
  fastify.get('/me', async (request, reply) => {
    try {
      await request.jwtVerify();
      const payload = request.user as any;

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        include: {
          progress: true,
          achievements: true,
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
        createdAt: user.createdAt,
      };
    } catch (error) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // ログアウト（クライアント側でトークン削除が主）
  fastify.post('/logout', async (request, reply) => {
    return { message: 'Logged out successfully' };
  });
}
