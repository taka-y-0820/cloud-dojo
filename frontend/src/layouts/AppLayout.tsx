import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Navigation } from '@/components/ui/navigation/Navigation';
import { AIChat } from '@/features/ai/AIChat';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-background relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 gradient-mesh opacity-30 pointer-events-none" />

      <Navigation />
      <main className="flex-1 overflow-auto relative z-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {children}
        </motion.div>
      </main>
      <AIChat />
    </div>
  );
}
