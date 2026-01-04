import { TabItem } from './types';
import { TabButton } from './TabButton';

type Props<T extends string> = {
  tabs: readonly TabItem<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
};

export const Tabs = <T extends string>({ tabs, activeTab, onChange }: Props<T>) => {
  return (
    <div className="flex items-center gap-2 border-b border-border">
      {tabs.map((tab) => (
        <TabButton
          key={tab.key}
          active={activeTab === tab.key}
          onClick={() => {
            onChange(tab.key);
            tab.onSelect?.();
          }}
        >
          {tab.label}
        </TabButton>
      ))}
    </div>
  );
};
