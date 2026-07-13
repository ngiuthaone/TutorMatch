interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

function Card({ children, className, hover = false }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-border bg-background ${
        hover ? "hover:shadow-md hover:border-primary/20 transition-all duration-200" : ""
      } ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-5 ${className ?? ""}`}>{children}</div>;
}

export { Card, CardContent };
