import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  decorative?: boolean;
  priority?: boolean;
};

export function BrandLogo({
  className = "h-16 w-auto",
  decorative = false,
  priority = false,
}: BrandLogoProps) {
  return (
    <Image
      src="/images/brand/jahan-bastan-logo.png"
      alt={decorative ? "" : "جهان باستان"}
      width={1024}
      height={1024}
      priority={priority}
      className={`brand-logo bg-transparent ${className}`}
    />
  );
}
