import { ReactNode } from 'react';

export type TabItem<T extends string> = {
  key: T;
  label: ReactNode;
  onSelect?: () => void;
};
