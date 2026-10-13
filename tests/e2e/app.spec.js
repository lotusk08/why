import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const KEY = 'why:map';
const FIXTURE = [
  { id: 'p1', text: 'Premise 1', x: -150, y: -130, lineType: 'solid' },
  { id: 'p2', text: 'Premise 2', x: 150, y: -130, lineType: 'solid' },
  { id: 'c1', text: 'Conclusion', x: 0, y: 130, lineType: 'solid' },
  { id: 'e1', type: '', from: ['p1', 'p2'], to: 'c1' }
];
const P1 = { x: -150, y: -130 };
const C1 = { x: 0, y: 130 };

async function saved(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), KEY);
}

async function counts(page) {
  const main = page.locator('main.workspace');
  return {
    nodes: Number(await main.getAttribute('data-nodes')),
    edges: Number(await main.getAttribute('data-edges'))
  };
}

async function canvasBox(page) {
  return page.locator('canvas.reasons-canvas').boundingBox();
}

async function scaleOf(page) {
  return Number(await page.locator('main.workspace').getAttribute('data-scale'));
}

async function screenPoint(page, world) {
  const box = await canvasBox(page);
  const scale = await scaleOf(page);
  return { x: box.x + box.width / 2 + world.x * scale, y: box.y + box.height / 2 + world.y * scale };
}

async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y - 30, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

async function clickEmpty(page) {
  const box = await canvasBox(page);
  await page.mouse.click(box.x + 40, box.y + 40);
}

async function pixel(page, world) {
  const point = await screenPoint(page, world);
  const box = await canvasBox(page);
  return page.locator('canvas.reasons-canvas').evaluate(
    (canvas, [x, y]) => {
      const ratio = canvas.width / canvas.getBoundingClientRect().width;
      return [...canvas.getContext('2d').getImageData(Math.round(x * ratio), Math.round(y * ratio), 1, 1).data];
    },
    [point.x - box.x, point.y - box.y]
  );
}

async function texts(page) {
  const data = await saved(page);
  return (data || []).filter((e) => typeof e.text === 'string').map((e) => e.text);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(([key, map]) => localStorage.setItem(key, map), [KEY, JSON.stringify(FIXTURE)]);
  await page.reload();
  await expect(page.locator('main.workspace')).toHaveAttribute('data-nodes', '3');
});

test('opens a first visit on the customer journey demo', async ({ page }) => {
  await page.evaluate((key) => localStorage.removeItem(key), KEY);
  await page.reload();
  const main = page.locator('main.workspace');
  await expect(main).toHaveAttribute('data-nodes', '18');
  await expect(main).toHaveAttribute('data-edges', '19');
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
  await clickEmpty(page);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Idea' })).toHaveValue('1. Awareness');
});

test('loads the saved argument', async ({ page }) => {
  await expect(page).toHaveTitle('Think Why?');
  await expect.poll(() => counts(page)).toEqual({ nodes: 3, edges: 1 });
  await expect(page.getByRole('button', { name: 'Switch mode' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Redo' })).toHaveCount(0);
  expect(await scaleOf(page)).toBeGreaterThan(0);
  await expect(page.locator('.topbar, .breadcrumb, .zoom')).toHaveCount(0);
});

test('adds an idea by double-clicking empty space and saves it', async ({ page }) => {
  const box = await canvasBox(page);
  await page.mouse.dblclick(box.x + 90, box.y + 70);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#editor-title')).toHaveText('New idea');
  await page.keyboard.type('Because it rains');
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect.poll(() => counts(page)).toEqual({ nodes: 4, edges: 1 });
  await expect.poll(() => texts(page)).toContain('Because it rains');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
});

test('cancelling a new idea removes it again', async ({ page }) => {
  const box = await canvasBox(page);
  await page.mouse.dblclick(box.x + 90, box.y + 70);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect.poll(() => counts(page)).toEqual({ nodes: 3, edges: 1 });
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
});

test('edits a premise, marks it as an objection, then undoes and redoes', async ({ page }) => {
  const point = await screenPoint(page, P1);
  await page.mouse.dblclick(point.x, point.y);
  const textarea = page.getByRole('textbox', { name: 'Idea' });
  await expect(textarea).toHaveValue('Premise 1');
  await textarea.fill('Rain is wet');
  await page.getByRole('radio', { name: 'Objection' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect.poll(() => texts(page)).toContain('Rain is wet');
  await expect.poll(() => saved(page).then((m) => m.find((e) => e.text === 'Rain is wet').lineType)).toBe('dashed');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => texts(page)).toContain('Premise 1');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect.poll(() => texts(page)).toContain('Rain is wet');
});

test('colours an idea, draws the tint, and undo takes it off', async ({ page }) => {
  const color = () => saved(page).then((m) => m?.find((e) => e.id === 'p1')?.color ?? null);
  const inside = { x: P1.x - 90, y: P1.y };
  const [r, g] = await pixel(page, inside);
  expect(Math.abs(r - g)).toBeLessThan(6);
  const point = await screenPoint(page, P1);
  await page.mouse.dblclick(point.x, point.y);
  await expect(page.getByRole('radio', { name: 'No colour' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: 'Teal' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect.poll(color).toBe('teal');
  await expect.poll(() => pixel(page, inside).then(([red, green]) => green - red)).toBeGreaterThan(8);
  await page.mouse.dblclick(point.x, point.y);
  await expect(page.getByRole('radio', { name: 'Teal' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(color).toBeNull();
});

test('links ideas by dragging one onto another', async ({ page }) => {
  const box = await canvasBox(page);
  const start = { x: box.x + box.width / 2, y: box.y + box.height - 70 };
  await page.mouse.dblclick(start.x, start.y);
  await page.keyboard.type('Support');
  await page.keyboard.press('Enter');
  await expect.poll(() => counts(page)).toEqual({ nodes: 4, edges: 1 });
  const target = await screenPoint(page, C1);
  await drag(page, start, target);
  await expect(page.locator('main.workspace')).toHaveAttribute('data-edges', '2');
  await expect.poll(() => saved(page).then((m) => m.filter((e) => e.to).length)).toBe(2);
});

test('links both ways when dragged back, and the editor turns it one way again', async ({ page }) => {
  const box = await canvasBox(page);
  const start = { x: box.x + box.width / 2, y: box.y + box.height - 70 };
  await page.mouse.dblclick(start.x, start.y);
  await page.keyboard.type('Support');
  await page.keyboard.press('Enter');
  const target = await screenPoint(page, C1);
  await drag(page, start, target);
  await expect(page.locator('main.workspace')).toHaveAttribute('data-edges', '2');
  await drag(page, target, start);
  await expect(page.locator('.toast')).toHaveText('Linked both ways');
  await expect(page.locator('main.workspace')).toHaveAttribute('data-edges', '3');

  await page.mouse.dblclick((start.x + target.x) / 2, (start.y + target.y) / 2);
  await expect(page.locator('#editor-title')).toHaveText('Link');
  await expect(page.getByRole('radio', { name: 'Both ways' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: 'Support → Conclusion' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('main.workspace')).toHaveAttribute('data-edges', '2');
  await expect
    .poll(() => saved(page).then((m) => m.filter((e) => e.to).map((e) => `${e.from.join('+')}>${e.to}`)))
    .toContain('p1+p2>c1');
});

test('joins three, then four premises into one conclusion, and fans one premise out', async ({ page }) => {
  const box = await canvasBox(page);
  const target = await screenPoint(page, C1);
  const premise = await screenPoint(page, P1);
  const spots = [
    { x: box.x + 120, y: box.y + box.height - 70 },
    { x: box.x + box.width - 120, y: box.y + box.height - 70 }
  ];
  for (const [index, spot] of spots.entries()) {
    await page.mouse.dblclick(spot.x, spot.y);
    await page.keyboard.type(`Premise ${index + 3}`);
    await page.keyboard.press('Enter');
    await drag(page, spot, target);
  }
  await expect(page.locator('main.workspace')).toHaveAttribute('data-edges', '3');
  await drag(page, spots[0], premise);
  await expect(page.locator('main.workspace')).toHaveAttribute('data-edges', '2');
  await drag(page, spots[1], premise);
  await expect(page.locator('main.workspace')).toHaveAttribute('data-edges', '1');
  await expect.poll(() => saved(page).then((m) => m?.find((e) => e.to)?.from?.length ?? 0)).toBe(4);

  const spot = { x: box.x + box.width / 2, y: box.y + 60 };
  await page.mouse.dblclick(spot.x, spot.y);
  await page.keyboard.type('Another conclusion');
  await page.keyboard.press('Enter');
  await drag(page, premise, spot);
  await expect(page.locator('main.workspace')).toHaveAttribute('data-edges', '2');
  await expect.poll(() => saved(page).then((m) => m?.filter((e) => e.to && e.from.includes('p1')).length ?? 0)).toBe(2);
});

test('takes one premise out of a joint link before deleting the rest', async ({ page }) => {
  const junctionY = C1.y - 28 - 1 - 64;
  const segment = await screenPoint(page, { x: P1.x / 2, y: (P1.y + junctionY) / 2 });
  await page.mouse.dblclick(segment.x, segment.y);
  await expect(page.locator('#editor-title')).toHaveText('Joint link');
  await expect(page.getByRole('list', { name: 'Premises in this link' })).toContainText('Premise 1 → Conclusion');
  await page.getByRole('button', { name: 'Remove Premise 1' }).click();
  await expect(page.locator('#editor-title')).toHaveText('Link');
  await expect(page.getByRole('radio', { name: 'Premise 2 → Conclusion' })).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => saved(page).then((m) => m?.find((e) => e.to)?.from ?? null)).toEqual(['p2']);
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('main.workspace')).toHaveAttribute('data-edges', '0');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('main.workspace')).toHaveAttribute('data-edges', '1');
});

test('keyboard selects, deletes, undoes and empties the map', async ({ page }) => {
  await clickEmpty(page);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Delete');
  await expect(page.locator('main.workspace')).toHaveAttribute('data-nodes', '2');
  await page.keyboard.press('Control+z');
  await expect(page.locator('main.workspace')).toHaveAttribute('data-nodes', '3');
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Tab');
    await page.keyboard.press('Backspace');
  }
  await expect(page.locator('main.workspace')).toHaveAttribute('data-nodes', '0');
  await page.keyboard.press('0');
  await expect(page.locator('main.workspace')).toHaveAttribute('data-scale', '1.000');
});

test('selects everything with the keyboard and deletes it, and the eraser clears the map', async ({ page }) => {
  await clickEmpty(page);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await expect(page.locator('main.workspace')).toHaveAttribute('data-nodes', '0');
  await expect(page.locator('main.workspace')).toHaveAttribute('data-edges', '0');
  await page.getByRole('button', { name: 'Clear or reset' }).click();
  await expect(page.getByRole('button', { name: 'Clear the map' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Clear the map' })).toBeHidden();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('main.workspace')).toHaveAttribute('data-nodes', '3');

  const premise = await screenPoint(page, P1);
  await page.keyboard.down('Shift');
  await page.mouse.click(premise.x, premise.y);
  await page.keyboard.up('Shift');
  await page.keyboard.press('Backspace');
  await expect(page.locator('main.workspace')).toHaveAttribute('data-nodes', '2');

  await page.getByRole('button', { name: 'Clear or reset' }).click();
  await page.getByRole('button', { name: 'Clear the map' }).click();
  await expect(page.locator('main.workspace')).toHaveAttribute('data-nodes', '0');
  await expect(page.locator('.toast')).toHaveText('Map cleared. Undo brings it back.');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('main.workspace')).toHaveAttribute('data-nodes', '2');
});

test('resets the map to the demo, and undo brings the map back', async ({ page }) => {
  const main = page.locator('main.workspace');
  await page.getByRole('button', { name: 'Clear or reset' }).click();
  await page.getByRole('button', { name: 'Reset to demo' }).click();
  await expect(main).toHaveAttribute('data-nodes', '18');
  await expect(main).toHaveAttribute('data-edges', '19');
  await expect(page.locator('.toast')).toHaveText('Demo restored. Undo brings your map back.');
  await expect(page.getByRole('button', { name: 'Reset to demo' })).toBeHidden();
  await expect.poll(() => texts(page)).toContain('7. Purchase');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(main).toHaveAttribute('data-nodes', '3');
  await expect.poll(() => texts(page)).toContain('Premise 1');
});

test('closes a menu sheet when clicking elsewhere', async ({ page }) => {
  await page.getByRole('button', { name: 'Share' }).click();
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear or reset' }).click();
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Reset to demo' })).toBeVisible();
  await clickEmpty(page);
  await expect(page.getByRole('button', { name: 'Reset to demo' })).toBeHidden();
});

test('adds an idea with N and links it with L, Tab and Enter', async ({ page }) => {
  const main = page.locator('main.workspace');
  await clickEmpty(page);
  await page.keyboard.press('Tab');
  await page.keyboard.press('n');
  await expect(page.locator('#editor-title')).toHaveText('New idea');
  await page.keyboard.type('Typed idea');
  await page.keyboard.press('Enter');
  await expect(main).toHaveAttribute('data-nodes', '4');

  await page.keyboard.press('l');
  await expect(page.locator('.toast')).toHaveText('Tab picks an idea, Enter links, Esc cancels');
  await page.keyboard.press('Escape');
  await page.keyboard.press('l');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(main).toHaveAttribute('data-edges', '2');
  await expect
    .poll(async () => {
      const map = await saved(page);
      const typed = map.find((e) => e.text === 'Typed idea');
      const link = map.find((e) => e.to && e.from.includes(typed?.id));
      return { below: typed?.y > P1.y, to: link?.to, from: link?.from.length };
    })
    .toEqual({ below: true, to: 'c1', from: 1 });
});

test('pans with the arrow keys when no idea is selected', async ({ page }) => {
  await clickEmpty(page);
  const premise = await screenPoint(page, P1);
  await page.keyboard.press('Shift+ArrowDown');
  await page.mouse.dblclick(premise.x, premise.y);
  await expect(page.locator('#editor-title')).toHaveText('New idea');
});

test('reaches the menu with F6 and moves through it with the arrow keys', async ({ page }) => {
  await clickEmpty(page);
  await page.keyboard.press('F6');
  await expect(page.getByRole('button', { name: 'Clear or reset' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Share' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Save as PDF' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Save as PDF' })).toHaveText('PDF');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Save as SVG' })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Share' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Help' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('canvas.reasons-canvas')).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Delete');
  await expect(page.locator('main.workspace')).toHaveAttribute('data-nodes', '2');
});

test('saves and shares with keyboard shortcuts', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => (window.print = () => (document.documentElement.dataset.printed = 'true')));
  const svg = page.waitForEvent('download');
  await page.keyboard.press('ControlOrMeta+s');
  expect((await svg).suggestedFilename()).toBe('argument-map.svg');
  const png = page.waitForEvent('download');
  await page.keyboard.press('ControlOrMeta+Shift+S');
  expect((await png).suggestedFilename()).toBe('argument-map.png');
  await page.keyboard.press('ControlOrMeta+p');
  await expect(page.locator('html')).toHaveAttribute('data-printed', 'true');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.keyboard.press('ControlOrMeta+Shift+L');
  await expect(page.locator('.toast')).toHaveText('Link copied');
  expect(page.url()).toContain('#map=');
});

test('zooms with the keyboard and the wheel, and fits back', async ({ page }) => {
  const main = page.locator('main.workspace');
  const before = await main.getAttribute('data-scale');
  await page.keyboard.press('+');
  await expect(main).not.toHaveAttribute('data-scale', before);
  await page.keyboard.press('0');
  await expect(main).toHaveAttribute('data-scale', before);
  const box = await canvasBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -200);
  await expect.poll(() => scaleOf(page)).toBeGreaterThan(Number(before));
});

test('glides the view, and jumps when the system asks for less motion', async ({ page }) => {
  const main = page.locator('main.workspace');
  const before = await main.getAttribute('data-scale');
  await page.keyboard.press('+');
  expect(await main.getAttribute('data-scale')).toBe(before);
  await expect(main).not.toHaveAttribute('data-scale', before);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const zoomed = await main.getAttribute('data-scale');
  await page.keyboard.press('0');
  expect(await main.getAttribute('data-scale')).toBe(before);
  expect(zoomed).not.toBe(before);
});

test('switches between light and dark mode', async ({ page }) => {
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-mode', /.+/);
  await page.getByRole('button', { name: 'Switch mode' }).click();
  await expect(html).toHaveAttribute('data-mode', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#000000');
  await page.getByRole('button', { name: 'Switch mode' }).click();
  await expect(html).not.toHaveAttribute('data-mode', /.+/);
});

test('shows the menu tips on hover', async ({ page }) => {
  const tips = page.locator('#menu-tips');
  await expect(tips).toBeHidden();
  await page.getByRole('button', { name: 'Help' }).hover();
  await expect(tips).toBeVisible();
  await expect(tips).toContainText('Double-click empty space to add an idea.');
  const box = await canvasBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + 40);
  await expect(tips).toBeHidden();
});

test('opens and closes the help dialog', async ({ page }) => {
  await page.getByRole('button', { name: 'Help' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('How to think');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('saves the map as a PNG', async ({ page }) => {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Share' }).click();
  await page.getByRole('button', { name: 'Save as PNG' }).click();
  expect((await download).suggestedFilename()).toBe('argument-map.png');
  await expect(page.locator('.toast')).toHaveText('PNG saved');
});

test('saves the map as an SVG that parses and holds every idea', async ({ page }) => {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Share' }).click();
  await page.getByRole('button', { name: 'Save as SVG' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('argument-map.svg');
  await expect(page.locator('.toast')).toHaveText('SVG saved');
  const svg = await readFile(await file.path(), 'utf8');
  expect(svg).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  const parsed = await page.evaluate((text) => {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    return {
      errors: doc.getElementsByTagName('parsererror').length,
      texts: [...doc.querySelectorAll('text')].map((el) => el.textContent)
    };
  }, svg);
  expect(parsed.errors).toBe(0);
  expect(parsed.texts).toEqual(expect.arrayContaining(['Premise 1', 'Premise 2', 'Conclusion', 'therefore']));
});

test('prints the map alone on a page of its own size for PDF', async ({ page }) => {
  await page.evaluate(() => (window.print = () => (document.documentElement.dataset.printed = 'true')));
  await page.getByRole('button', { name: 'Share' }).click();
  await page.getByRole('button', { name: 'Save as PDF' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-printed', 'true');
  const size = await page
    .locator('.print-sheet svg')
    .evaluate((svg) => [svg.getAttribute('width'), svg.getAttribute('height')]);
  expect(await page.locator('style.print-page').evaluate((style) => style.textContent)).toBe(
    `@page { size: ${size[0]}px ${size[1]}px; margin: 0; }`
  );
  await expect(page.locator('.print-sheet')).toBeHidden();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.print-sheet svg')).toBeVisible();
  await expect(page.locator('#app')).toBeHidden();
  await expect(page.locator('.print-sheet')).toContainText('Conclusion');
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('.print-sheet, style.print-page')).toHaveCount(0);
});

test('copies a share link that reopens the same map elsewhere', async ({ page, context, browser }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const box = await canvasBox(page);
  await page.mouse.dblclick(box.x + 90, box.y + 70);
  await page.keyboard.type('Shared idea');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Share' }).click();
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.locator('.toast')).toHaveText('Link copied');
  expect(page.url()).toContain('#map=');
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe(page.url());

  const fresh = await browser.newContext();
  const other = await fresh.newPage();
  await other.goto(clipboard);
  await expect(other.locator('main.workspace')).toHaveAttribute('data-nodes', '4');
  await expect.poll(() => texts(other)).toContain('Shared idea');
  await fresh.close();
});

test('opens legacy links and migrates legacy storage', async ({ page, browser }) => {
  const legacy = [
    { id: 'a', text: 'Old premise', x: 100, y: 100 },
    { id: 'b', text: 'Old conclusion', x: 100, y: 300 },
    { from: ['a'], to: 'b', type: 'do' }
  ];
  await page.goto('about:blank');
  await page.goto(`/#${encodeURIComponent(JSON.stringify(legacy))}`);
  await expect(page.locator('main.workspace')).toHaveAttribute('data-nodes', '2');
  await expect(page.locator('main.workspace')).toHaveAttribute('data-edges', '1');

  const fresh = await browser.newContext();
  await fresh.addInitScript((data) => localStorage.setItem('codageArgument', data), JSON.stringify(legacy));
  const other = await fresh.newPage();
  await other.goto('/');
  await expect(other.locator('main.workspace')).toHaveAttribute('data-nodes', '2');
  await expect.poll(() => texts(other)).toContain('Old premise');
  await fresh.close();
});

test('adds an idea with a double tap on touch screens', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch only');
  const box = await canvasBox(page);
  await page.touchscreen.tap(box.x + 60, box.y + 60);
  await page.touchscreen.tap(box.x + 60, box.y + 60);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.type('Tapped');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('main.workspace')).toHaveAttribute('data-nodes', '4');
});
