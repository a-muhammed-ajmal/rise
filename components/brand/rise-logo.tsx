import Image from "next/image";
import { cn } from "@/lib/utils";

type RiseLogoProps = {
  className?: string;
  /** White silhouette — for solid brand/orange surfaces (FAB, orange tiles). */
  mono?: boolean;
  /** Keep original colors in dark mode too (use on white tiles). By default
      the mark flips to a white silhouette in dark mode so the black body
      stripes stay visible on navy surfaces. */
  keepColor?: boolean;
};

export function RiseLogo({ className, mono, keepColor }: RiseLogoProps) {
  return (
    <Image
      src="/rise-logo.png"
      alt=""
      aria-hidden="true"
      width={64}
      height={64}
      className={cn(
        "select-none",
        mono && "brightness-0 invert",
        !mono && !keepColor && "dark:brightness-0 dark:invert",
        className,
      )}
    />
  );
}
