import { Modal } from "@/components/ui/Modal";

/** A curated grid rather than a full emoji-picker library/dependency -- plenty of range for quick reactions without adding new tooling. */
const EMOJI_OPTIONS = [
  "❤️", "😂", "👍", "😮", "😢", "🎉",
  "🔥", "👏", "😍", "🙄", "😅", "🤔",
  "💀", "😭", "🥳", "😴", "😡", "🤯",
  "🙌", "👀", "💯", "🤝", "😎", "🥺",
  "😬", "🍕", "☕", "🌊", "🏖️", "🐶",
];

export function EmojiReactionPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose}>
      <p className="mb-3 text-center font-heading text-base font-semibold text-ink">
        react with...
      </p>
      <div className="grid grid-cols-6 gap-2">
        {EMOJI_OPTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onPick(emoji)}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-card-sm border-2 border-ink/15 bg-paper text-xl transition-colors hover:bg-orange/10"
          >
            {emoji}
          </button>
        ))}
      </div>
    </Modal>
  );
}
