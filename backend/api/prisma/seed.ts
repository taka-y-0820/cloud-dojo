import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // デモユーザーの作成
  const demoEmail = 'demo@clouddojo.dev';
  const demoPassword = 'demo1234';

  // 既存のユーザーをチェック
  const existingUser = await prisma.user.findUnique({
    where: { email: demoEmail },
  });

  if (existingUser) {
    console.log('✅ Demo user already exists');
  } else {
    const hashedPassword = await bcrypt.hash(demoPassword, 10);

    const user = await prisma.user.create({
      data: {
        email: demoEmail,
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

    console.log('✅ Demo user created:', demoEmail);
    console.log('   Password:', demoPassword);
  }

  // サンプルアチーブメント（オプション）
  console.log('✅ Seed completed');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
