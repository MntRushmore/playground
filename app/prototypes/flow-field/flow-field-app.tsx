"use client";

import { ControlPanel, ControlsLayout, useControls } from "@/components/controls";
import { SLUG, controls } from "./data";
import { FlowCanvas } from "./flow-canvas";

export function FlowFieldApp() {
  const c = useControls(SLUG, controls);
  return (
    <ControlsLayout panel={<ControlPanel controls={c} />}>
      <FlowCanvas settings={c.values} />
    </ControlsLayout>
  );
}
