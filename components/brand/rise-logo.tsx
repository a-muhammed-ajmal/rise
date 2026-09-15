import { cn } from "@/lib/utils";

// Geometry and colours are taken verbatim from the supplied brand vector
// (public/rise-logo.svg). Do not redraw, recolour or re-proportion these paths.
const NAVY = "#0C2443";
const GOLD = "#FDB304";

const LEAF_LOWER_RIGHT =
  "M 964 616 L 959 613 L 931 614 L 872 622 L 812 636 L 766 651 L 714 673 L 678 692 L 626 726 L 591 755 L 564 782 L 538 814 L 524 836 L 503 883 L 491 927 L 484 973 L 483 1046 L 490 1048 L 576 1034 L 675 1007 L 724 988 L 785 955 L 826 924 L 858 893 L 887 858 L 906 830 L 929 788 L 948 739 L 958 699 L 964 656 Z";
const LEAF_LOWER_LEFT =
  "M 80 516 L 78 519 L 79 607 L 90 686 L 110 748 L 125 779 L 147 815 L 184 861 L 222 898 L 259 929 L 326 976 L 371 1003 L 421 1029 L 428 1028 L 429 964 L 424 758 L 410 700 L 403 682 L 382 644 L 362 618 L 333 590 L 299 566 L 260 546 L 222 532 L 175 521 L 127 515 Z";
const LEAF_UPPER =
  "M 896 80 L 881 77 L 791 107 L 697 148 L 645 177 L 568 234 L 527 277 L 494 324 L 469 379 L 456 445 L 458 813 L 468 811 L 504 756 L 567 693 L 617 658 L 715 604 L 771 567 L 827 517 L 867 463 L 892 407 L 904 348 L 904 91 Z";

type RiseLogoProps = {
  className?: string;
  /**
   * Render the mark on the standard light plate. The mark is two-tone — navy
   * leaves and a golden leaf — and the navy loses contrast on dark surfaces,
   * so prominent placements (sidebar, topbar, login, FAB, assistant header)
   * sit it on a light ground where both leaves keep their master colours.
   * Small inline uses omit this and rely on the --brand-mark dark treatment.
   */
  plate?: boolean;
  /**
   * Accessible name. Omit wherever visible "RISE" text already sits beside the
   * mark — it is decorative there, and announcing the name twice is noise.
   */
  title?: string;
};

export function RiseLogo({ className, plate, title }: RiseLogoProps) {
  const mark = (
    <svg
      viewBox="0 0 1043 1126"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className={cn("select-none", plate ? "w-[72%] h-[72%]" : className)}
    >
      {/* preserveAspectRatio defaults to xMidYMid meet, so the mark is never
          stretched even when the box it is given is square. */}
      <g className="rise-mark__navy" fill={NAVY}>
        <path d={LEAF_LOWER_RIGHT} />
        <path d={LEAF_LOWER_LEFT} />
      </g>
      <g fill={GOLD}>
        <path d={LEAF_UPPER} />
      </g>
    </svg>
  );

  if (!plate) return mark;

  return (
    <span
      className={cn(
        "rise-mark--plate inline-flex items-center justify-center shrink-0",
        "rounded-lg bg-white border-[1.5px] border-border shadow-card",
        className,
      )}
    >
      {mark}
    </span>
  );
}
