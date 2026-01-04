type Props = {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

export const TabButton = ({ active, onClick, children }: Props) => {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-3 font-medium transition-all ${
        active
          ? 'border-b-2 border-primary text-primary'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
};
