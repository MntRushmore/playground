"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MarbleAudio } from "./audio";
import type { NoteEvent, Settings } from "./types";

/** locked: no gesture yet (silent preview). on / muted after the first gesture. */
export type SoundState = "locked" | "on" | "muted";

/** Owns the audio engine: unlocks on a gesture, follows settings, sleeps with the tab. */
export function useMarbleAudio(settings: Pick<Settings, "reverb" | "volume">) {
  const audioRef = useRef<MarbleAudio | null>(null);
  const [sound, setSound] = useState<SoundState>("locked");
  const soundRef = useRef(sound);
  const settingsRef = useRef(settings);

  useEffect(() => {
    soundRef.current = sound;
    audioRef.current?.setMuted(sound !== "on");
  }, [sound]);

  useEffect(() => {
    settingsRef.current = settings;
    audioRef.current?.setReverb(settings.reverb);
    audioRef.current?.setVolume(settings.volume);
  }, [settings]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) audioRef.current?.suspend();
      else audioRef.current?.resume();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  /** Call from inside a pointer/key handler. */
  const unlock = useCallback(() => {
    if (!audioRef.current) {
      const audio = new MarbleAudio();
      audio.setReverb(settingsRef.current.reverb);
      audio.setVolume(settingsRef.current.volume);
      audioRef.current = audio;
    }
    audioRef.current.start();
    if (soundRef.current === "locked") {
      soundRef.current = "on";
      audioRef.current.setMuted(false);
      setSound("on");
    }
  }, []);

  const toggle = useCallback(() => {
    if (soundRef.current === "locked") return unlock();
    audioRef.current?.start();
    setSound((s) => (s === "on" ? "muted" : "on"));
  }, [unlock]);

  const play = useCallback((note: NoteEvent) => {
    if (soundRef.current === "on") audioRef.current?.play(note);
  }, []);

  return { sound, unlock, toggle, play };
}
