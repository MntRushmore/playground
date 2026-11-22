// The set around the hero pumpkin: a plank table, a board wall and a few smaller
// pumpkins, shot with a perspective camera that lines up with the hero's plate so the
// pumpkin sits on the table. Rendered once per layout/shape in two lighting rigs.

import * as THREE from "three";
import { skinPalette } from "./color";
import { ELEVATION, PLATE, PROPS } from "./data";
import { bodyDims, buildBody, buildStem } from "./geometry";
import type { PlateRect } from "./space";
import { type Studio, texture, toGeometry } from "./studio";
import { shadowDecal, tableTexture, wallTexture } from "./textures";
import type { PumpkinShape } from "./types";

const DISTANCE = 7;

export type SetShot = {
  /** Output size in px, and where the hero plate sits in that space. */
  width: number;
  height: number;
  rect: PlateRect;
  shape: PumpkinShape;
};

/** Lowest point of the body, relative to its center (bottom dimple included). */
export const bodyBottom = (shape: PumpkinShape) => -0.91 * bodyDims(shape).b;

function dir(color: number, intensity: number, x: number, y: number, z: number) {
  const l = new THREE.DirectionalLight(color, intensity);
  l.position.set(x, y, z);
  return l;
}

export function createSetRenderer(studio: Studio) {
  const scene = new THREE.Scene();
  scene.environment = studio.env;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

  const day = new THREE.Group();
  day.add(new THREE.HemisphereLight(0xffe2c4, 0x140d08, 0.45), dir(0xffd9b0, 1.6, -3, 3.5, 4), dir(0xa8bcff, 0.6, 3, 2, -3));
  const night = new THREE.Group();
  night.add(new THREE.HemisphereLight(0x2c3a66, 0x050304, 0.12), dir(0x9fb0ff, 0.75, -3, 3.5, 3), dir(0xff8a3a, 0.08, 0, 1, 3));
  scene.add(day, night);

  const tableTex = texture(tableTexture(), true);
  const wallTex = texture(wallTexture(), true);
  const shadowTex = new THREE.CanvasTexture(shadowDecal());
  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 9),
    new THREE.MeshStandardMaterial({ map: tableTex, bumpMap: tableTex, bumpScale: 2, roughness: 0.85 })
  );
  table.rotation.x = -Math.PI / 2;
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 9),
    new THREE.MeshStandardMaterial({ map: wallTex, bumpMap: wallTex, bumpScale: 2, roughness: 0.9 })
  );
  scene.add(table, wall);

  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
  const props = new THREE.Group();
  scene.add(props);
  const disposables: { dispose: () => void }[] = [tableTex, wallTex, shadowTex, shadowMat, table.geometry, wall.geometry];

  for (const p of PROPS) {
    const palette = skinPalette(p.variety, p.hue);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 });
    const stemMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    const bodyGeo = toGeometry(buildBody({ shape: "squat", ribs: 9 + (p.seed % 4), ribDepth: 0.8, seed: p.seed, palette }));
    const stemGeo = toGeometry(buildStem("squat", p.seed));
    const g = new THREE.Group();
    g.add(new THREE.Mesh(bodyGeo, mat), new THREE.Mesh(stemGeo, stemMat));
    g.scale.setScalar(p.scale);
    g.rotation.y = p.seed;
    g.userData = p;
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.8 * p.scale, 2.8 * p.scale), shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.userData = { ...p, shadow: true };
    props.add(g, shadow);
    disposables.push(mat, stemMat, bodyGeo, stemGeo, shadow.geometry);
  }
  // The hero's own contact shadow (the hero itself is composited in 2D).
  const heroShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
  heroShadow.rotation.x = -Math.PI / 2;
  scene.add(heroShadow);
  disposables.push(heroShadow.geometry);

  function layout(shape: PumpkinShape) {
    const floor = bodyBottom(shape);
    const { a } = bodyDims(shape);
    table.position.set(0, floor, 0);
    wall.position.set(0, floor + 4.3, -4.5);
    heroShadow.position.set(0, floor + 0.003, -0.08);
    heroShadow.scale.set(a * 2.7, a * 2.1, 1);
    for (const child of props.children) {
      const p = child.userData as (typeof PROPS)[number] & { shadow?: boolean };
      const lift = p.shadow ? 0.003 : -bodyBottom("squat") * p.scale;
      child.position.set(p.x, floor + lift, p.z);
    }
  }

  /** Perspective camera whose principal point lands on the hero plate's origin. */
  function aim(shot: SetShot) {
    const { E, OY } = PLATE;
    const worldPerPx = (2 * E) / shot.rect.size;
    const cx = shot.rect.x + shot.rect.size / 2;
    const cy = shot.rect.y + ((E + OY) / (2 * E)) * shot.rect.size;
    const fw = 2 * Math.max(cx, shot.width - cx);
    const fh = 2 * Math.max(cy, shot.height - cy);
    camera.fov = (2 * Math.atan((fh * worldPerPx) / 2 / DISTANCE) * 180) / Math.PI;
    camera.aspect = fw / fh;
    camera.position.set(0, Math.sin(ELEVATION) * DISTANCE, Math.cos(ELEVATION) * DISTANCE);
    camera.lookAt(0, 0, 0);
    camera.setViewOffset(fw, fh, fw / 2 - cx, fh / 2 - cy, shot.width, shot.height);
    camera.updateProjectionMatrix();
  }

  return {
    render(shot: SetShot, dst: { day: HTMLCanvasElement; night: HTMLCanvasElement }) {
      layout(shot.shape);
      aim(shot);
      for (const mode of ["day", "night"] as const) {
        day.visible = mode === "day";
        night.visible = mode === "night";
        scene.environmentIntensity = mode === "day" ? 0.25 : 0.04;
        studio.shoot(scene, camera, dst[mode], shot.width, shot.height);
      }
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}

export type SetRenderer = ReturnType<typeof createSetRenderer>;
