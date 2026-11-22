// Matter.js bodies for pieces. Pure: depends only on Matter and the shared geometry.

import Matter from "matter-js";
import { TRACK } from "./data";
import { CUP_SENSOR, LIFT, localPrims } from "./geometry";
import { mirrorPrim, rad, toWorld } from "./transforms";
import type { Piece, Prim } from "./types";

const { Bodies, Body } = Matter;

/** Matter 0.20 internals that @types/matter-js doesn't declare. */
type BodyInternals = Omit<Matter.Body, "angularVelocity"> & {
  positionPrev: Matter.Vector;
  anglePrev: number;
  angularVelocity: number;
  deltaTime: number;
};
export const Kinematic = Body as unknown as {
  setPosition(body: Matter.Body, position: Matter.Vector, updateVelocity?: boolean): void;
  setAngle(body: Matter.Body, angle: number, updateVelocity?: boolean): void;
  rotate(body: Matter.Body, rotation: number, point?: Matter.Vector, updateVelocity?: boolean): void;
};

export function internals(body: Matter.Body) {
  return body as BodyInternals;
}

/** Displacement over the last sub-step, scaled by `scale` (e.g. to u per 1/60 s). */
export function stepVelocity(body: Matter.Body, scale: number): Matter.Vector {
  const prev = internals(body).positionPrev;
  return { x: (body.position.x - prev.x) * scale, y: (body.position.y - prev.y) * scale };
}

/** What a Matter body represents. Stored on `body.plugin`. */
export type BodyTag =
  | { kind: "marble"; id: number }
  | { kind: "piece"; id: string }
  | { kind: "cup"; id: string };

const STATIC: Matter.IBodyDefinition = {
  isStatic: true,
  friction: 1,
  frictionStatic: 0.4,
  restitution: 0,
  slop: 0.02,
};

function part(prim: Prim) {
  if (prim.k === "circle") {
    return Bodies.polygon(prim.x, prim.y, 28, prim.r, { label: prim.tag ?? "part" });
  }
  // Rounded ends so marbles glide over joints instead of catching on corners.
  const radius = Math.max(0.5, Math.min(prim.w, prim.h) / 2 - 0.5);
  return Bodies.rectangle(prim.x, prim.y, prim.w, prim.h, {
    angle: prim.a,
    chamfer: { radius: prim.h <= TRACK + 0.1 ? radius : Math.min(4, radius) },
    label: prim.tag ?? "part",
  });
}

export type PieceBodies = { body: Matter.Body | null; sensor: Matter.Body | null; cleats: Matter.Body[] };

/**
 * Builds the static (or kinematic) bodies for one piece. Parts are created in the local frame,
 * then the whole body is moved and rotated into place so moving parts pivot on the piece origin.
 */
export function buildPieceBodies(p: Piece): PieceBodies {
  const prims = localPrims(p.type).map((pr) => mirrorPrim(pr, p.flip));
  let body: Matter.Body | null = null;
  if (prims.length) {
    const parts = prims.map(part);
    const plugin: BodyTag = { kind: "piece", id: p.id };
    body =
      parts.length === 1
        ? parts[0]
        : Body.create({ parts, ...STATIC, plugin });
    if (parts.length === 1) {
      Body.set(body, { ...STATIC, plugin, label: parts[0].label });
    }
    // Pivot pieces (wheel, switch) are symmetric, so their centre of mass is the origin.
    Body.translate(body, { x: p.x, y: p.y });
    Kinematic.rotate(body, rad(p.angle), { x: p.x, y: p.y });
  }

  let sensor: Matter.Body | null = null;
  if (p.type === "cup") {
    const c = toWorld(p, CUP_SENSOR.x, CUP_SENSOR.y);
    sensor = Bodies.rectangle(c.x, c.y, CUP_SENSOR.w, CUP_SENSOR.h, {
      isStatic: true,
      isSensor: true,
      angle: rad(p.angle),
      plugin: { kind: "cup", id: p.id } satisfies BodyTag,
    });
  }

  const cleats: Matter.Body[] = [];
  if (p.type === "lift") {
    for (let i = 0; i < LIFT.cleats; i++) {
      cleats.push(
        Bodies.rectangle(p.x, p.y, LIFT.cleatW, 10, {
          ...STATIC,
          chamfer: { radius: 4 },
          label: "cleat",
          plugin: { kind: "piece", id: p.id } satisfies BodyTag,
        })
      );
    }
  }

  return { body, sensor, cleats };
}

/** Moves a kinematic static body so the solver sees its velocity (marbles get carried/pushed). */
export function driveBody(body: Matter.Body, x: number, y: number, angle: number) {
  Kinematic.setPosition(body, { x, y }, true);
  Kinematic.setAngle(body, angle, true);
}

/** Teleports a static body with zero implied velocity. */
export function placeBody(body: Matter.Body, x: number, y: number, angle: number) {
  Kinematic.setPosition(body, { x, y }, false);
  Kinematic.setAngle(body, angle, false);
  Kinematic.setPosition(body, { x, y }, true);
  Kinematic.setAngle(body, angle, true);
}

export function tagOf(part: Matter.Body): BodyTag | undefined {
  const root = part.parent ?? part;
  const tag = root.plugin as Partial<BodyTag> | undefined;
  return tag && "kind" in tag ? (tag as BodyTag) : undefined;
}
