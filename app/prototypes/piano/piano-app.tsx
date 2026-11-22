"use client";

import { useEffect, useState } from "react";
import { ControlPanel, ControlsLayout, useControls } from "@/components/controls";
import { PianoAudio } from "./audio-engine";
import { SLUG, controls } from "./data";
import { PianoStage } from "./piano-stage";

export function PianoApp() {
  const c = useControls(SLUG, controls);
  // The engine doesn't touch Web Audio until the first gesture, so it's safe to create during render.
  const [audio] = useState(() => new PianoAudio());
  const { sound, volume, reverb } = c.values;

  useEffect(() => {
    audio.configure({ preset: sound, volume, reverb });
  }, [audio, sound, volume, reverb]);

  useEffect(() => () => audio.dispose(), [audio]);

  return (
    // Exactly the viewport under the 56px header: the keys never scroll.
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden">
      <ControlsLayout panel={<ControlPanel controls={c} />}>
        <PianoStage settings={c.values} audio={audio} ready={c.loaded} />
      </ControlsLayout>
    </div>
  );
}
