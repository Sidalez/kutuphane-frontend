export default function BrandLogo({ className = "h-10 w-10" }: { className?: string }) {
  return <img src="/icons/brand.svg" width="64" height="64" alt="" aria-hidden="true" draggable={false} className={`shrink-0 rounded-[26%] ${className}`} />;
}
