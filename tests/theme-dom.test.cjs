const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const source = ts.transpileModule(fs.readFileSync("src/theme/themeDom.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function environment(saved = "light", storageBlocked = false, systemDark = false) {
  const tags = new Map();
  const classes = new Set();
  const root = { style: {}, classList: { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) } };
  const document = { documentElement: root, body: { style: {} },
    querySelector: selector => tags.get(/name="([^"]+)"/.exec(selector)[1]) || null,
    createElement: () => ({ name: "", setAttribute(name, value) { this[name] = value; } }),
    head: { appendChild: node => tags.set(node.name, node) },
  };
  const localStorage = { getItem: () => { if (storageBlocked) throw Error("blocked"); return saved; }, setItem: (_, value) => { if (storageBlocked) throw Error("blocked"); saved = value; } };
  const matchMedia = () => ({ matches: systemDark });
  const exports = {};
  const context = vm.createContext({ exports, document, window: { localStorage, matchMedia }, localStorage, matchMedia });
  vm.runInContext(source, context);
  return { exports, document, tags, classes, root, context };
}
test("both theme directions update safe-area backgrounds, colour scheme and native hints", () => {
  const env = environment();
  for (const theme of ["dark", "light", "dark", "light"]) {
    env.exports.applyTheme(theme);
    const colour = theme === "dark" ? "#020617" : "#fffaf3";
    assert.equal(env.root.style.backgroundColor, colour);
    assert.equal(env.document.body.style.backgroundColor, colour);
    assert.equal(env.root.style.colorScheme, theme);
    assert.equal(env.classes.has("dark"), theme === "dark");
    assert.equal(env.tags.get("theme-color").content, colour);
    assert.equal(env.tags.get("color-scheme").content, theme);
    assert.equal(env.tags.get("apple-mobile-web-app-status-bar-style").content, theme === "dark" ? "black" : "default");
    assert.equal(env.exports.readTheme(), theme);
  }
  assert.equal(env.tags.size, 3);
});
test("blocked storage falls back to system preference without breaking theme changes", () => {
  const env = environment(null, true, true);
  assert.equal(env.exports.readTheme(), "dark");
  assert.doesNotThrow(() => env.exports.applyTheme("light"));
  assert.equal(env.root.style.colorScheme, "light");
});
test("pre-React bootstrap and runtime agree on saved and system themes", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const bootstrap = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
  for (const [saved, blocked, systemDark, expected] of [["dark", false, false, "dark"], ["light", false, true, "light"], [null, true, true, "dark"], ["invalid", false, false, "light"]]) {
    const env = environment(saved, blocked, systemDark);
    for (const name of ["theme-color", "color-scheme", "apple-mobile-web-app-status-bar-style"]) env.tags.set(name, { name });
    vm.runInContext(bootstrap, env.context);
    assert.equal(env.root.style.colorScheme, expected);
    assert.equal(env.tags.get("color-scheme").content, expected);
    assert.equal(env.tags.get("theme-color").content, expected === "dark" ? "#020617" : "#fffaf3");
  }
});
