import { RedesignWizard } from "@/components/redesign-wizard";
import { StudioGate } from "@/components/studio-gate";

export default function StudioPage() {
  return (
    <StudioGate>
      <RedesignWizard />
    </StudioGate>
  );
}
