import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

export type TabItem<T extends string> = {
  key: T;
  label: ReactNode;
  icon?: LucideIcon;
  onSelect?: () => void;
};
