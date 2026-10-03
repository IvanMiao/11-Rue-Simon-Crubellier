import * as THREE from 'three';
import { LINE, PALETTE } from './palette';
import { canvas, texture } from './textures';
import { toonMaterial } from './materials';
import type { CastMember } from './cast';
import { FIGURE_H, FIGURE_W, drawFigure } from './draw/people';
import { withPaperBorder } from './draw/paperBorder';

/** World height of the whole figure canvas: a build.height = 1 resident stands 1.72 m. */
export const FIGURE_WORLD_H = 2.06;

export function figureCanvas(m: CastMember): HTMLCanvasElement {
  const raw = canvas(FIGURE_W, FIGURE_H, (ctx) => drawFigure(ctx, m));
  return withPaperBorder(raw, LINE.cutoutBorderPx * 1.6);
}

/**
 * A paper cut-out standing in the 3D room: alpha-tested card that receives and casts real shadows,
 * with a small wooden foot so it reads as a theatre flat.
 */
export function paperCutout(src: HTMLCanvasElement, worldHeight: number, opts: { mirror?: boolean } = {}): THREE.Group {
  const map = texture(src);
  const w = (worldHeight * src.width) / src.height;
  const geo = new THREE.PlaneGeometry(w, worldHeight);
  geo.translate(0, worldHeight / 2, 0);
  const mat = toonMaterial('#ffffff', { map, alphaTest: 0.5, side: THREE.DoubleSide });
  const card = new THREE.Mesh(geo, mat);
  card.castShadow = true;
  card.receiveShadow = true;
  card.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5 });
  card.userData.cutout = map;
  if (opts.mirror) card.scale.x = -1;
  const g = new THREE.Group();
  g.add(card);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(w * 0.35, 0.05, 0.16), toonMaterial(PALETTE.woodDark));
  foot.position.set(0, 0.025, -0.06);
  foot.castShadow = true;
  g.add(foot);
  return g;
}
