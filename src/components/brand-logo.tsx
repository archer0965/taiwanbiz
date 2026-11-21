import { cn } from "@/lib/utils";
import Image from "next/image";

type Props = {
  className?: string;
  size?: number;
  priority?: boolean;
};

export function BrandLogo({ className, size = 36, priority = false }: Props) {
  return (
    <Image
      src="/logo-nova-crest-pulse.jpg"
      alt="拓脈 Nova Crest Pulse"
      width={size}
      height={size}
      priority={priority}
      className={cn("rounded-xl object-cover shadow-sm", className)}
    />
  );
}
