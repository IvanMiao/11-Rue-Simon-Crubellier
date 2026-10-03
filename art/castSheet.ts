import { CASE_CARDS } from '../case/caseData';
import { CAST, CAST_ORDER } from './cast';
import { drawCardArt } from './draw/cardArt';
import { drawGlyph } from './draw/glyphs';
import { FIGURE_H, FIGURE_W, drawBust, drawFigure, drawWindowSilhouette } from './draw/people';
import { withPaperBorder } from './draw/paperBorder';

const DPR = 2;

function canvas2D(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width * DPR;
  canvas.height = height * DPR;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create a cast-sheet canvas context.');
  context.scale(DPR, DPR);
  draw(context);
  return canvas;
}

function mediaItem(label: string, canvas: HTMLCanvasElement, className: string) {
  const figure = document.createElement('figure');
  figure.className = className;
  const caption = document.createElement('figcaption');
  caption.textContent = label;
  figure.append(caption, canvas);
  return figure;
}

function renderMember(id: (typeof CAST_ORDER)[number]) {
  const member = CAST[id];
  const card = document.createElement('article');
  card.className = 'ink-card member';

  const heading = document.createElement('header');
  heading.className = 'member-head';
  const identity = document.createElement('div');
  const name = document.createElement('h2');
  name.className = 'member-name';
  name.textContent = member.name;
  const frenchName = document.createElement('p');
  frenchName.className = 'member-fr';
  frenchName.textContent = member.nameFr;
  const role = document.createElement('p');
  role.className = 'member-role';
  role.textContent = member.role;
  identity.append(name, frenchName, role);
  const colorChip = document.createElement('span');
  colorChip.className = 'color-chip';
  colorChip.style.backgroundColor = member.color;
  colorChip.setAttribute('aria-label', `色样 ${member.color}`);
  heading.append(identity, colorChip);

  const media = document.createElement('div');
  media.className = 'member-media';
  const windowCanvas = canvas2D(140, 180, (context) => drawWindowSilhouette(context, member, 140, 180));
  windowCanvas.className = 'window-canvas';
  media.append(mediaItem('窗影 · 140 × 180', windowCanvas, 'window'));

  const rawFigure = canvas2D(FIGURE_W, FIGURE_H, (context) => drawFigure(context, member));
  const figureCanvas = withPaperBorder(rawFigure, 14 * DPR);
  figureCanvas.className = 'figure-canvas';
  figureCanvas.style.width = `${(FIGURE_W * 380) / FIGURE_H}px`;
  figureCanvas.style.height = '380px';
  media.append(mediaItem('全身 · 380 px', figureCanvas, 'full-figure'));

  const bustCanvas = canvas2D(180, 180, (context) => drawBust(context, member, 180));
  bustCanvas.className = 'bust-canvas';
  media.append(mediaItem('胸像 · 180 px', bustCanvas, 'bust'));

  const signatures = document.createElement('div');
  signatures.className = 'signatures';
  member.signature.forEach((glyphId) => {
    const label = CASE_CARDS.find((caseCard) => caseCard.id === glyphId)?.label ?? glyphId;
    const glyphCanvas = canvas2D(96, 96, (context) => drawGlyph(context, glyphId, 96));
    signatures.append(mediaItem(`签名物 · ${label}`, glyphCanvas, 'signature'));
  });
  media.append(signatures);
  card.append(heading, media);

  if (member.deceased) {
    const note = document.createElement('p');
    note.className = 'deceased';
    note.textContent = '1973 年去世 · 以照片出现';
    card.append(note);
  }
  return card;
}

function renderProp(cardId: string, label: string, kind: string) {
  const card = document.createElement('article');
  card.className = 'prop-card';
  const heading = document.createElement('h3');
  heading.textContent = label;
  const type = document.createElement('p');
  type.className = 'prop-kind';
  type.textContent = kind;
  const previews = document.createElement('div');
  previews.className = 'prop-previews';

  for (const size of [64, 32]) {
    const canvas = canvas2D(size, size, (context) => drawCardArt(context, cardId, size));
    const sample = document.createElement('div');
    sample.className = 'prop-size';
    const sizeLabel = document.createElement('span');
    sizeLabel.className = 'size-label';
    sizeLabel.textContent = `${size} px`;
    sample.append(canvas, sizeLabel);
    previews.append(sample);
  }

  card.append(heading, type, previews);
  return card;
}

async function render() {
  await document.fonts.ready;
  const castList = document.getElementById('cast-list');
  const propsGrid = document.getElementById('props-grid');
  if (!castList || !propsGrid) throw new Error('Cast-sheet containers are missing.');

  castList.append(...CAST_ORDER.map(renderMember));
  propsGrid.append(...CASE_CARDS.map((card) => renderProp(card.id, card.label, card.kind)));
  (window as unknown as { __castReady: boolean }).__castReady = true;
}

void render();
