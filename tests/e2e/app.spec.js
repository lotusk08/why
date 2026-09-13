import { expect, test } from '@playwright/test';

const KEY = 'why:map';
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

async function texts(page) {
  const data = await saved(page);
  return (data || []).filter((e) => typeof e.text === 'string').map((e) => e.text);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main.workspace')).toHaveAttribute('data-nodes', '3');
});

test('loads the default argument', async ({ page }) => {
  await expect(page).toHaveTitle('Think Why?');
  expect(await counts(page)).toEqual({ nodes: 3, edges: 1 });
  await expect(page.getByRole('button', { name: 'Switch mode' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo' })).toBeDisabled();
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
  expect(await counts(page)).toEqual({ nodes: 4, edges: 1 });
  await expect.poll(() => texts(page)).toContain('Because it rains');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
});

test('cancelling a new idea removes it again', async ({ page }) => {
  const box = await canvasBox(page);
  await page.mouse.dblclick(box.x + 90, box.y + 70);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await counts(page)).toEqual({ nodes: 3, edges: 1 });
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
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

test('links ideas by dragging one onto another', async ({ page }) => {
  const box = await canvasBox(page);
  const start = { x: box.x + box.width / 2, y: box.y + box.height - 70 };
  await page.mouse.dblclick(start.x, start.y);
  await page.keyboard.type('Support');
  await page.keyboard.press('Enter');
  expect(await counts(page)).toEqual({ nodes: 4, edges: 1 });
  const target = await screenPoint(page, C1);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, start.y - 30, { steps: 4 });
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await page.mouse.up();
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
  const drag = async (from, to) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y - 30, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
  };
  await drag(start, target);
  await expect(page.locator('main.workspace')).toHaveAttribute('data-edges', '2');
  await drag(target, start);
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

test('takes one premise out of a joint link before deleting the rest', async ({ page }) => {
  const segment = await screenPoint(page, { x: P1.x / 2, y: P1.y / 2 });
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
  const box = await canvasBox(page);
  await page.mouse.click(box.x + 40, box.y + 40);
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
  await page.getByRole('button', { name: 'Save as image' }).click();
  expect((await download).suggestedFilename()).toBe('argument-map.png');
  await expect(page.locator('.toast')).toHaveText('Image saved');
});

test('copies a share link that reopens the same map elsewhere', async ({ page, context, browser }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const box = await canvasBox(page);
  await page.mouse.dblclick(box.x + 90, box.y + 70);
  await page.keyboard.type('Shared idea');
  await page.keyboard.press('Enter');
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
