import Image from "next/image";
import type { CSSProperties } from "react";

type OptimizedPhotoProps = {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
  loading?: "eager" | "lazy";
  quality?: 75 | 85 | 90;
  objectPosition?: string;
  unoptimized?: boolean;
  onError?: () => void;
};

export default function OptimizedPhoto({
  src,
  alt,
  sizes,
  className,
  priority = false,
  loading = "eager",
  quality = 85,
  objectPosition,
  unoptimized = false,
  onError,
}: OptimizedPhotoProps) {
  const style: CSSProperties = {
    objectFit: "cover",
    ...(objectPosition ? { objectPosition } : {}),
  };

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      // Next 16 deprecated `priority` in favor of `preload`; fetchPriority
      // restores the high-priority hint `priority` used to set on the <img>.
      preload={priority}
      loading={priority ? undefined : loading}
      fetchPriority={priority ? "high" : undefined}
      quality={quality}
      style={style}
      unoptimized={unoptimized}
      onError={onError}
    />
  );
}
