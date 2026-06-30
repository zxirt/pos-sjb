import { cn } from "@/lib/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-line bg-surface shadow-card", className)}
      {...props}
    />
  );
}

export function CardSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-t border-line p-5 first:border-t-0", className)}>
      {title && (
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-ink-soft">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}
