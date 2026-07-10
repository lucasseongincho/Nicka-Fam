type MascotProps = {
  size?: number;
  color?: "orange" | "teal";
  mouth?: boolean;
  className?: string;
};

const colorMap = {
  orange: "var(--color-orange)",
  teal: "var(--color-teal)",
};

export function Mascot({
  size = 30,
  color = "orange",
  mouth = false,
  className = "",
}: MascotProps) {
  const eye = Math.max(4, Math.round(size * 0.08));
  const eyeInset = Math.round(size * 0.27);
  const eyeTop = Math.round(size * 0.37);
  return (
    <div
      className={`relative shrink-0 border-2 border-ink ${className}`}
      style={{
        width: size,
        height: size,
        background: colorMap[color],
        borderRadius: "42% 58% 55% 45% / 55% 45% 58% 42%",
      }}
    >
      <div
        className="absolute rounded-full bg-ink"
        style={{ width: eye, height: eye, top: eyeTop, left: eyeInset }}
      />
      <div
        className="absolute rounded-full bg-ink"
        style={{ width: eye, height: eye, top: eyeTop, right: eyeInset }}
      />
      {mouth && (
        <div
          className="absolute border-2 border-t-0 border-ink"
          style={{
            width: Math.round(size * 0.19),
            height: Math.round(size * 0.09),
            top: Math.round(size * 0.5),
            left: "50%",
            transform: "translateX(-50%)",
            borderRadius: "0 0 20px 20px",
          }}
        />
      )}
    </div>
  );
}
