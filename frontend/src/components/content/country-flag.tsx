import Image from "next/image";

import { PUBLIC_API_BASE_URL } from "@/lib/api/client";

type CountryFlagProps = {
  country: string;
  imageId?: number | null;
  className?: string;
};

export function CountryFlag({
  country,
  imageId,
  className = "h-4 w-6",
}: CountryFlagProps) {
  if (!imageId) return null;

  return (
    <Image
      alt={`پرچم ${country}`}
      className={`${className} shrink-0 rounded-sm border border-black/10 object-cover shadow-sm`}
      height={18}
      src={`${PUBLIC_API_BASE_URL}/media/${imageId}`}
      width={27}
    />
  );
}
