import { motion } from 'framer-motion';
import type { ElementType } from 'react';

interface PageHeaderProps {
  title: string;
  description: string;
  Icon: ElementType;
  bgColor: string;
}

export function PageHeader({ title, description, Icon, bgColor }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between"
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 ${bgColor} rounded-2xl flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className={`text-3xl font-bold ${bgColor} bg-clip-text text-transparent`}>{title}</h1>
          <p className="text-muted-foreground">
            <span className="font-mono text-sm">{description}</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
