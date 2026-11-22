// Renders the pumpkin body and stem with three.js into plain 2D canvases ("plates"),
// once per settings change, in a day and a night lighting rig. The 2D compositor then
// carves, lights and animates on top of these, so nothing here runs per frame.

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ELEVATION, PLATE } from "./data";
import { type BodyParams, type MeshData, buildBody, buildStem } from "./geometry";
import { mulberry32 } from "./noise";
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
  return { size, bodyDay: make(), bodyNight: make(), stemDay: make(), stemNight: make() };
}

function toGeometry(mesh: MeshData) {
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

/** Fine skin detail: pale speckles, tiny pits and vertical striations. */
function skinTexture() {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(4242);
  ctx.fillStyle = "rgb(236,236,236)";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    const x = rand() * w;
    ctx.strokeStyle = rand() < 0.5 ? "rgba(255,255,255,0.35)" : "rgba(170,170,170,0.22)";
    ctx.lineWidth = 0.6 + rand() * 1.4;
    ctx.beginPath();
    const y0 = rand() * h;
    ctx.moveTo(x, y0);
    ctx.lineTo(x + (rand() - 0.5) * 3, y0 + 20 + rand() * 120);
    ctx.stroke();
  }
  for (let i = 0; i < 1800; i++) {
    const light = rand() < 0.8;
    ctx.fillStyle = light ? "rgba(255,255,255,0.6)" : "rgba(190,190,190,0.35)";
    ctx.beginPath();
    ctx.ellipse(rand() * w, rand() * h, 0.4 + rand() * 0.8, 0.5 + rand() * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function rig(day: boolean) {
  const g = new THREE.Group();
  if (day) {
    g.add(new THREE.HemisphereLight(0xfff4e6, 0x3a2716, 0.55));
    const key = new THREE.DirectionalLight(0xfff0dc, 2.3);
    key.position.set(-2.4, 3, 3.2);
    const fill = new THREE.DirectionalLight(0xffe2c4, 0.35);
    fill.position.set(3, 0.4, 2);
    const rim = new THREE.DirectionalLight(0xffffff, 1.2);
    rim.position.set(1.5, 2.2, -3);
    g.add(key, fill, rim);
  } else {
    g.add(new THREE.HemisphereLight(0x51608f, 0x140a04, 0.1));
    const moon = new THREE.DirectionalLight(0x9db2ff, 1.1);
    moon.position.set(-3, 2.4, -2.2);
    const spill = new THREE.DirectionalLight(0xff9440, 0.24);
    spill.position.set(0.3, -2.2, 3);
    const top = new THREE.DirectionalLight(0x8090c0, 0.12);
    top.position.set(0.5, 3, 1);
    g.add(moon, spill, top);
  }
  return g;
}

export function createPumpkinRenderer(): PumpkinRenderer | null {
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

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  // A small environment is plenty for soft reflections and much cheaper to prefilter.
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04, 0.1, 100, { size: 64 }).texture;
  scene.environment = env;

  const { E, OY } = PLATE;
  const camera = new THREE.OrthographicCamera(-E, E, E + OY, -E + OY, 0.1, 40);
  camera.position.set(0, Math.sin(ELEVATION) * 10, Math.cos(ELEVATION) * 10);
  camera.lookAt(0, 0, 0);

  const dayRig = rig(true);
  const nightRig = rig(false);
  scene.add(dayRig, nightRig);

  const skin = skinTexture();
  // Standard (not Physical): far cheaper to compile, which matters on slow GPUs.
  const bodyMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: skin,
    bumpMap: skin,
    bumpScale: 0.5,
    roughness: 0.4,
  });
  const stemMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.BufferGeometry(), bodyMat);
  const stem = new THREE.Mesh(new THREE.BufferGeometry(), stemMat);
  body.renderOrder = 0;
  stem.renderOrder = 1;
  scene.add(body, stem);
  let geoKey = "";

  const copy = (dst: HTMLCanvasElement) => {
    const ctx = dst.getContext("2d")!;
    ctx.clearRect(0, 0, dst.width, dst.height);
    ctx.drawImage(renderer.domElement, 0, 0, dst.width, dst.height);
  };

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
      renderer.setSize(params.size, params.size, false);

      for (const day of [true, false]) {
        dayRig.visible = day;
        nightRig.visible = !day;
        scene.environmentIntensity = day ? 0.3 : 0.015;

        stem.visible = false;
        renderer.render(scene, camera);
        copy(day ? plates.bodyDay : plates.bodyNight);

        // Stem alone, with the body only occluding (depth, no color).
        stem.visible = true;
        bodyMat.colorWrite = false;
        renderer.render(scene, camera);
        bodyMat.colorWrite = true;
        copy(day ? plates.stemDay : plates.stemNight);
      }
      return plates;
    },
    dispose() {
      body.geometry.dispose();
      stem.geometry.dispose();
      bodyMat.dispose();
      stemMat.dispose();
      skin.dispose();
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
