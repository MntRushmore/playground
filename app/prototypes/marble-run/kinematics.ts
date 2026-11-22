// Motorised pieces: wheels spin, switch planks flip, lift cleats ride their belt.
// They're static bodies moved every sub-step with velocity, so the solver pushes marbles
// along with them (true kinematic bodies: infinitely heavy, never stalled by marbles).

import { driveBody, placeBody } from "./bodies";
import { LIFT, SWITCH, WHEEL, cleatPose } from "./geometry";
import { rad, toLocal, toWorld } from "./transforms";
import type { PieceRt, Sim } from "./physics";

const CLEAR_MS = 90;

function driveWheel(rt: PieceRt, dt: number, motors: number) {
  if (!rt.body) return;
  const dir = rt.piece.flip ? -1 : 1;
  // Never wrap the angle: a 2π jump would read as a huge angular velocity to the solver.
  rt.turn += dir * WHEEL.speed * motors * (dt / 1000);
  driveBody(rt.body, rt.piece.x, rt.piece.y, rad(rt.piece.angle) + rt.turn);
}

/** A flip-flop: each marble that passes tips the plank the other way, with an eased snap. */
function driveSwitch(sim: Sim, rt: PieceRt, dt: number) {
  if (!rt.body) return;
  if (rt.armed) {
    const near = sim.marbles.some((m) => {
      if (m.dying >= 0) return false;
      const l = toLocal(rt.piece, m.body.position.x, m.body.position.y);
      // Wait until the marble is fully clear of the plank's swing.
      return Math.abs(l.x) < SWITCH.length / 2 + m.radius + 12 && l.y > -m.radius * 2 - 40 && l.y < 50;
    });
    rt.clearFor = near ? 0 : rt.clearFor + dt;
    if (rt.clearFor >= CLEAR_MS) {
      rt.armed = false;
      rt.clearFor = 0;
      rt.side = -rt.side;
      rt.flipT = 0;
      sim.events.push({ kind: "flip" });
    }
  }
  rt.flipT = Math.min(1, rt.flipT + dt / SWITCH.flipMs);
  const e = 1 - Math.pow(1 - rt.flipT, 3);
  // side -1 tips the left end down (counter-clockwise), +1 the right end.
  const target = rt.side * SWITCH.tilt;
  rt.turn = -target + (target - -target) * e;
  if (rt.flipT >= 1) rt.turn = target;
  driveBody(rt.body, rt.piece.x, rt.piece.y, rad(rt.piece.angle) + rt.turn);
}

function driveLift(rt: PieceRt, dt: number, motors: number) {
  rt.belt = (rt.belt + LIFT.speed * motors * (dt / 1000)) % LIFT.cycle;
  const base = rad(rt.piece.angle);
  const mirror = rt.piece.flip ? -1 : 1;
  rt.cleats.forEach((body, i) => {
    const s = (rt.belt + (i * LIFT.cycle) / LIFT.cleats) % LIFT.cycle;
    const pose = cleatPose(s);
    if (!pose) {
      if (rt.cleatOn[i]) {
        rt.cleatOn[i] = false;
        body.collisionFilter.mask = 0;
      }
      const park = toWorld(rt.piece, LIFT.cleatX, LIFT.start + 40);
      placeBody(body, park.x, park.y, base);
      return;
    }
    const w = toWorld(rt.piece, pose.x, pose.y);
    const angle = base + pose.a * mirror;
    if (!rt.cleatOn[i]) {
      rt.cleatOn[i] = true;
      body.collisionFilter.mask = 0xffffffff;
      placeBody(body, w.x, w.y, angle);
    } else {
      driveBody(body, w.x, w.y, angle);
    }
  });
}

export function driveKinematics(sim: Sim, dt: number) {
  const motors = sim.settings.motors;
  for (const rt of sim.pieces.values()) {
    switch (rt.piece.type) {
      case "wheel":
        driveWheel(rt, dt, motors);
        break;
      case "switch":
        driveSwitch(sim, rt, dt);
        break;
      case "lift":
        driveLift(rt, dt, motors);
        break;
    }
  }
}
