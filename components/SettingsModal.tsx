import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { IosInstallBanner } from "@/components/push/IosInstallBanner";
import { NotificationSettings } from "@/components/push/NotificationSettings";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <p className="mb-4 text-center font-heading text-lg font-semibold text-ink">
        settings
      </p>
      <IosInstallBanner />
      <NotificationSettings />
      <Button variant="ghost" className="mt-5 w-full" onClick={onClose}>
        done
      </Button>
    </Modal>
  );
}
