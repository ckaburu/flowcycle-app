import { useCallback, useState, type ReactElement } from "react";
import { completeOnboarding } from "../domain/OnboardingState";
import { WelcomeScreen } from "./WelcomeScreen";
import { CreateFirstProfileScreen } from "./CreateFirstProfileScreen";
import { PinPromptScreen } from "./PinPromptScreen";
import { OnboardingPinSetup } from "./OnboardingPinSetup";

type OnboardingStep = "welcome" | "createProfile" | "pinPrompt" | "pinSetup";

type OnboardingFlowProps = {
  onComplete: () => void;
};

export function OnboardingFlow({
  onComplete,
}: OnboardingFlowProps): ReactElement {
  const [step, setStep] = useState<OnboardingStep>("welcome");

  const handleComplete = useCallback(async (): Promise<void> => {
    await completeOnboarding();
    onComplete();
  }, [onComplete]);

  switch (step) {
    case "welcome":
      return <WelcomeScreen onNext={() => setStep("createProfile")} />;
    case "createProfile":
      return <CreateFirstProfileScreen onNext={() => setStep("pinPrompt")} />;
    case "pinPrompt":
      return (
        <PinPromptScreen
          onSetPin={() => setStep("pinSetup")}
          onSkip={handleComplete}
        />
      );
    case "pinSetup":
      return <OnboardingPinSetup onComplete={handleComplete} />;
  }
}
