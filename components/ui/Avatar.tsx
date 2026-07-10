import Image from "next/image";

const sizes = {
  sm: 24,
  md: 30,
  lg: 56,
};

type AvatarProps = {
  src: string;
  name: string;
  size?: keyof typeof sizes;
  active?: boolean;
  overlap?: boolean;
  className?: string;
};

export function Avatar({
  src,
  name,
  size = "md",
  active = false,
  overlap = false,
  className = "",
}: AvatarProps) {
  const px = sizes[size];
  return (
    <Image
      src={src}
      alt={name}
      width={px}
      height={px}
      className={`rounded-full object-cover border-2 ${active ? "border-orange" : "border-paper"} shadow-[0_0_0_1.5px_rgba(36,28,22,0.25)] ${overlap ? "-ml-2 first:ml-0" : ""} ${className}`}
    />
  );
}
