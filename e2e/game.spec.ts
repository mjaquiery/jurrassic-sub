import { expect, test } from '@playwright/test';

test('dive, find a creature, read about it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/');
  await expect(page.locator('.region')).toHaveCount(3);
  await page.screenshot({ path: 'shots/1-start.png' });
  await page.click('[data-region="clay-bay"]');
  await expect(page.locator('#start')).toBeHidden();

  // Steer by dragging; the sub should move.
  const before = await page.evaluate(() => (window as any).__jsub.sub.position.x);
  const vp = page.viewportSize()!;
  await page.mouse.move(vp.width / 2, vp.height / 2);
  await page.mouse.down();
  await page.mouse.move(vp.width * 0.8, vp.height / 2, { steps: 5 });
  await page.waitForTimeout(1500);
  await page.mouse.up();
  const after = await page.evaluate(() => (window as any).__jsub.sub.position.x);
  expect(after).not.toBe(before);
  await page.screenshot({ path: 'shots/2-swimming.png' });

  // Park the sub facing a frozen Cryptoclidus: its portrait should appear.
  await page.evaluate(() => {
    const g = (window as any).__jsub;
    const c = g.creatures.find((x: any) => x.sp.id === 'cryptoclidus');
    c.update = () => {};
    c.position.set(0, -20, 0);
    g.sub.position.set(11, -20, 0);
    g.subState.yaw = Math.PI;
    g.subState.pitch = 0;
    g.subState.speed = 0;
    for (const o of g.creatures) if (o !== c) o.position.set(500, -20, 500);
  });
  await page.waitForTimeout(2500);
  await expect(page.locator('#screen.live')).toBeVisible();
  await expect(page.locator('#screen-name')).toHaveText('Cryptoclidus');
  await page.screenshot({ path: 'shots/3-identified.png' });

  await page.click('#screen');
  await expect(page.locator('#info')).toBeVisible();
  expect(await page.locator('#info-facts li').count()).toBeGreaterThanOrEqual(3);
  await page.screenshot({ path: 'shots/4-info.png' });
  await page.click('#info-close');
  await expect(page.locator('#info')).toBeHidden();

  // Tapping the creature makes it react.
  await page.mouse.click(vp.width / 2, vp.height / 2 + 20);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'shots/5-tapped.png' });

  expect(errors).toEqual([]);
});

test('every portrait renders', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-region="clay-bay"]');
  await page.evaluate(() => {
    const g = (window as any).__jsub;
    // Line the whole cast up in front of the camera for a gallery shot.
    g.creatures.filter((c: any) => !c.flora).forEach((c: any, i: number) => {
      c.update = () => {};
      c.position.set(-25 + (i % 9) * 6, -20 + Math.floor(i / 9) * 7, 20 - Math.floor(i / 9) * 6);
    });
    g.sub.position.set(0, -20, 50);
    g.subState.yaw = Math.PI / 2;
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'shots/6-cast.png' });
});

test('plants can be inspected too', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-region="clay-bay"]');
  await page.evaluate(() => {
    const g = (window as any).__jsub;
    const c = g.creatures.find((x: any) => x.sp.id === 'sponge');
    c.update = () => {};
    c.position.set(0, c.position.y, 0);
    for (const o of g.creatures) if (o !== c) o.position.set(500, -20, 500);
    g.sub.position.set(8, c.position.y, 0);
    g.subState.yaw = Math.PI;
    g.subState.pitch = 0;
    g.subState.speed = 0;
  });
  await page.waitForTimeout(2000);
  await expect(page.locator('#screen-name')).toHaveText('Sponge');
  await page.screenshot({ path: 'shots/7-flora.png' });
});

test('boundary wall shows at the edge, and regions switch', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-region="clay-bay"]');
  await page.evaluate(() => {
    const g = (window as any).__jsub;
    g.sub.position.set(80, -20, 0);
    g.subState.yaw = 0;
    g.subState.pitch = 0;
    g.subState.speed = 0;
    for (const o of g.creatures) o.position.set(0, -20, 500);
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'shots/8-boundary.png' });
  await page.click('#map');
  await page.click('[data-region="deep-blue"]');
  expect(await page.evaluate(() => (window as any).__jsub.region)).toBe('deep-blue');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'shots/9-deep-blue.png' });
});
