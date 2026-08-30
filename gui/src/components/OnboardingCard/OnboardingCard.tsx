import { OnboardingModes } from "core/protocol/core";
import { useAppSelector } from "../../redux/hooks";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import { ReusableCard } from "../ReusableCard";
import { OnboardingLocalTab } from "./components/OnboardingLocalTab";
import { useOnboardingCard } from "./hooks/useOnboardingCard";

// Keep activeTab in the state type so existing callsites (utils.ts, HelpSection.tsx, etc.)
// that set it continue to compile — we simply ignore it and always render the Local tab.
export interface OnboardingCardState {
  show?: boolean;
  activeTab?: OnboardingModes;
}

interface OnboardingCardProps {
  isDialog?: boolean;
}

/**
 * Air-gapped onboarding card — only shows the Local (Ollama/LM Studio/vLLM)
 * setup tab. The "API Key" cloud-provider tab is intentionally removed.
 */
export function OnboardingCard({ isDialog }: OnboardingCardProps) {
  const { close } = useOnboardingCard();
  const config = useAppSelector((store) => store.config.config);

  if (getLocalStorage("onboardingStatus") === undefined) {
    setLocalStorage("onboardingStatus", "Started");
  }

  return (
    <ReusableCard
      showCloseButton={!isDialog && !!config.modelsByRole.chat.length}
      onClose={close}
      testId="onboarding-card"
    >
      {/* No tab bar — only the Local setup is relevant in an air-gapped environment */}
      <OnboardingLocalTab />
    </ReusableCard>
  );
}
