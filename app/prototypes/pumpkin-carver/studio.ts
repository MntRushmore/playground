// One offscreen three.js renderer shared by the hero pumpkin and the set. Everything
// rendered here is copied into plain 2D canvases; nothing 3D runs per frame.

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { MeshData } from "./geometry";

export type Studio = {
  renderer: THREE.WebGLRenderer;
  env: THREE.Texture;
  /** Renders `scene` at w×h and copies the result into `dst` (resized to match). */
  shoot: (scene: THREE.Scene, camera: THREE.Camera, dst: HTMLCanvasElement, w: number, h: number) => void;
  dispose: () => void;
};

export function createStudio(): Studio | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: document.createElement("canvas"),
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      premultipliedAlpha: true,
    });
  } catch {
    return null;
  }
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  const pmrem = new THREE.PMREMGenerator(renderer);
  // A small environment is plenty for soft reflections and much cheaper to prefilter.
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04, 0.1, 100, { size: 64 }).texture;

  return {
    renderer,
    env,
    shoot(scene, camera, dst, w, h) {
      renderer.setSize(w, h, false);
      renderer.render(scene, camera);
      if (dst.width !== w || dst.height !== h) {
        dst.width = w;
        dst.height = h;
      }
      const ctx = dst.getContext("2d")!;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(renderer.domElement, 0, 0, w, h);
    },
    dispose() {
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

export function toGeometry(mesh: MeshData) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
  // Vertex colors arrive in sRGB; three expects linear.
  const lin = new Float32Array(mesh.colors.length);
  const c = new THREE.Color();
  for (let i = 0; i < lin.length; i += 3) {
    c.setRGB(mesh.colors[i], mesh.colors[i + 1], mesh.colors[i + 2], THREE.SRGBColorSpace);
    lin[i] = c.r;
    lin[i + 1] = c.g;
    lin[i + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(lin, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(mesh.uvs, 2));
  g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  g.computeVertexNormals();
  return g;
}

export function texture(c: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
