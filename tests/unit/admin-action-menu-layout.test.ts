import assert from "node:assert/strict";
import test from "node:test";

import { computeAdminActionMenuLayout } from "../../src/lib/admin-action-menu-layout";

const trigger = { top: 300, right: 980, bottom: 332 };

test("le mobile ne reçoit aucune coordonnée inline concurrente", () => {
  assert.deepEqual(computeAdminActionMenuLayout({ viewportWidth: 639, viewportHeight: 800, trigger, menuHeight: 240 }), {
    mode: "mobile",
    style: {},
  });
});

test("le desktop calcule top/right et bascule au-dessus si nécessaire", () => {
  assert.deepEqual(computeAdminActionMenuLayout({ viewportWidth: 1024, viewportHeight: 800, trigger, menuHeight: 240 }), {
    mode: "desktop",
    style: { top: 336, right: 44 },
  });
  assert.deepEqual(computeAdminActionMenuLayout({ viewportWidth: 1024, viewportHeight: 500, trigger, menuHeight: 240 }), {
    mode: "desktop",
    style: { top: 56, right: 44 },
  });
});

test("une transition desktop vers mobile réinitialise entièrement le style", () => {
  const desktop = computeAdminActionMenuLayout({ viewportWidth: 1024, viewportHeight: 800, trigger, menuHeight: 240 });
  assert.deepEqual(desktop.style, { top: 336, right: 44 });
  const mobile = computeAdminActionMenuLayout({ viewportWidth: 390, viewportHeight: 800, trigger, menuHeight: 240 });
  assert.deepEqual(mobile.style, {});
});
