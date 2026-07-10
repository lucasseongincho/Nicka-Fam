type Option<T extends string> = { value: T; label: string };

type SegmentedToggleProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: SegmentedToggleProps<T>) {
  return (
    <div className="flex gap-1.5 bg-ink/[0.06] rounded-pill p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`font-body text-[13px] rounded-pill px-4 py-2 cursor-pointer transition-colors ${
              active
                ? "bg-ink text-paper font-semibold"
                : "text-ink/50 font-medium"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
