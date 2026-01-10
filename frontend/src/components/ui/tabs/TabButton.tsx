type TabButtonProps = {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
};

export const TabButton = ({ active, onClick, icon: Icon, children }: TabButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-3 font-medium transition-all ${
        active
          ? 'border-b-2 border-primary text-primary'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {Icon && <Icon className="w-4 h-4 inline mr-2" />}
      {children}
    </button>
  );
};
