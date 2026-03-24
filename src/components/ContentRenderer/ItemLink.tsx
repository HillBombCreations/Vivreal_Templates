import Link from "next/link";

export default function ItemLink({
  href,
  enabled,
  children,
  className,
}: {
  href: string;
  enabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  if (!enabled) return <div className={className}>{children}</div>;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
