import Image from "next/image";
import type { CSSProperties } from "react";

type OptimizedPhotoProps = {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
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
      priority={priority}
      quality={quality}
      style={style}
      unoptimized={unoptimized}
      onError={onError}
    />
  );
}
