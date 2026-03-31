/**
 * Universal page container. Every page wraps its content in this component
 * for consistent max-width and horizontal padding across the app.
 *
 * Width: fluid up to 1600px. Padding: 24px horizontal (px-6).
 * Pages control their own vertical spacing — this component only handles width.
 */
export default function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto max-w-[1600px] px-6 py-6 lg:py-8${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}
