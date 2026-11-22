// Renders the hero pumpkin (body + stem) into plain 2D canvases ("plates") once per
// settings change, under three lighting rigs: room lights on, moonlit night, and the
// candle's own warm glow. The 2D compositor carves, lights and animates on top.

import * as THREE from "three";
import { ELEVATION, PLATE } from "./data";
import { type BodyParams, buildBody, buildStem } from "./geometry";
import { type Studio, texture, toGeometry } from "./studio";
import { skinMaps } from "./skin-textures";
import type { PumpkinPlates } from "./types";

export type PlateParams = BodyParams & { size: number };

export type PumpkinRenderer = {
  render: (params: PlateParams, into?: PumpkinPlates) => PumpkinPlates;
  dispose: () => void;
};

export function makePlateCanvases(size: number): PumpkinPlates {
  const make = () => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    return c;
  };
  return { size, bodyDay: make(), bodyNight: make(), bodyGlow: make(), stemDay: make(), stemNight: make() };
}

type Mode = "day" | "night" | "glow";

function dir(color: number, intensity: number, x: number, y: number, z: number) {
  const l = new THREE.DirectionalLight(color, intensity);
  l.position.set(x, y, z);
  return l;
}

/** Same light count and types in every rig, so materials compile once. */
function rig(mode: Mode) {
  const g = new THREE.Group();
  if (mode === "day") {
    g.add(new THREE.HemisphereLight(0xffe6cc, 0x24160c, 0.5));
    g.add(dir(0xffe0bc, 2.2, -2.5, 2.6, 3), dir(0xbcd0ff, 1.5, 2.2, 1.8, -3), dir(0xffb070, 0.35, 2.5, -0.5, 2.5));
  } else if (mode === "night") {
    g.add(new THREE.HemisphereLight(0x34446e, 0x080504, 0.14));
    g.add(dir(0xaabcff, 1.5, -2.2, 2.8, 2.2), dir(0x8090d0, 0.7, 2.6, 1, -2.5), dir(0xff8a3a, 0.12, 0, -2, 3));
  } else {
    g.add(new THREE.HemisphereLight(0x5a3a20, 0x0a0503, 0.18));
    g.add(dir(0xff9a44, 2.4, 0, -0.2, 4), dir(0x8090d0, 0.45, -2.6, 1.5, -2.5), dir(0xffb060, 0.5, 0.4, 2.5, 2));
  }
  g.visible = false;
  return g;
}

export function createPumpkinRenderer(studio: Studio): PumpkinRenderer {
  const scene = new THREE.Scene();
  scene.environment = studio.env;

  const { E, OY } = PLATE;
  const camera = new THREE.OrthographicCamera(-E, E, E + OY, -E + OY, 0.1, 40);
  camera.position.set(0, Math.sin(ELEVATION) * 10, Math.cos(ELEVATION) * 10);
  camera.lookAt(0, 0, 0);

  const rigs: Record<Mode, THREE.Group> = { day: rig("day"), night: rig("night"), glow: rig("glow") };
  scene.add(rigs.day, rigs.night, rigs.glow);

  const maps = skinMaps();
  const colorMap = texture(maps.color, true);
  const normalMap = texture(maps.normal, false);
  const roughMap = texture(maps.rough, false);
  // Waxy skin: clearcoat for the tight highlight, sheen for the soft velvet falloff.
  const bodyMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    map: colorMap,
    normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.55,
    roughnessMap: roughMap,
    clearcoat: 0.35,
    clearcoatRoughness: 0.38,
    sheen: 0.35,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(0xffc690),
    emissive: new THREE.Color(0xff5a10),
    emissiveIntensity: 0,
  });
  const stemMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, normalMap, normalScale: new THREE.Vector2(0.6, 0.6) });
  const body = new THREE.Mesh(new THREE.BufferGeometry(), bodyMat);
  const stem = new THREE.Mesh(new THREE.BufferGeometry(), stemMat);
  body.renderOrder = 0;
  stem.renderOrder = 1;
  scene.add(body, stem);
  let geoKey = "";

  return {
    render(params, into) {
      const plates = into && into.size === params.size ? into : makePlateCanvases(params.size);
      const key = JSON.stringify([params.shape, params.ribs, params.ribDepth, params.seed, params.palette]);
      if (key !== geoKey) {
        geoKey = key;
        body.geometry.dispose();
        stem.geometry.dispose();
        body.geometry = toGeometry(buildBody(params));
        stem.geometry = toGeometry(buildStem(params.shape, params.seed));
      }
      const size = params.size;
      for (const mode of ["night", "glow", "day"] as Mode[]) {
        for (const m of Object.keys(rigs) as Mode[]) rigs[m].visible = m === mode;
        scene.environmentIntensity = mode === "day" ? 0.32 : mode === "night" ? 0.05 : 0.08;
        bodyMat.emissiveIntensity = mode === "glow" ? 0.07 : 0;
        // Candle glow is scattered light: no glossy streaks on the ribs.
        // (Kept above zero so the shader variant, and its compile, is shared.)
        bodyMat.clearcoat = mode === "glow" ? 0.001 : 0.35;
        bodyMat.roughness = mode === "glow" ? 0.85 : 0.55;
        bodyMat.sheen = mode === "glow" ? 0.6 : 0.35;
        stem.visible = false;
        const bodyDst = mode === "day" ? plates.bodyDay : mode === "night" ? plates.bodyNight : plates.bodyGlow;
        studio.shoot(scene, camera, bodyDst, size, size);
        if (mode === "glow") continue;
        // Stem alone, with the body only occluding (depth, no color).
        stem.visible = true;
        bodyMat.colorWrite = false;
        studio.shoot(scene, camera, mode === "day" ? plates.stemDay : plates.stemNight, size, size);
        bodyMat.colorWrite = true;
      }
      return plates;
    },
    dispose() {
      body.geometry.dispose();
      stem.geometry.dispose();
      bodyMat.dispose();
      stemMat.dispose();
      colorMap.dispose();
      normalMap.dispose();
      roughMap.dispose();
    },
  };
}
