let path = require("path");
let fs = require("fs/promises");
let esbuild = require("esbuild");
let { register } = require("esbuild-register/dist/node");
let { h, Fragment } = require("preact");
let { render } = require("preact-render-to-string");

globalThis.h = h;
globalThis.Fragment = Fragment;

/**
 * @typedef {object} EleventyPage
 * @prop {Date} date
 * @prop {string} inputPath
 * @prop {string} fileSlug
 * @prop {string} filePathStem
 * @prop {string} url
 * @prop {string} outputPath
 * 
 * @typedef {object} Island
 * @prop {string} id
 * @prop {string} entry
 * @prop {any} props
 * @prop {string} name
 * @prop {EleventyPage} page
 */

/**
 * @type {Island[]}
 */
let globalIslands = [];

/**
 * @type {import("esbuild").CommonOptions}
 */
let esbuildCommonOptions = {
  jsx: "transform",
  jsxFactory: "h",
  jsxFragment: "Fragment",
};

let namespace = "islands";
let filter = /^@islands$/;

/**
 * @param {Record<string, Island[]>} groups
 * @returns {import("esbuild").Plugin}
 */
let esbuildIslandsPlugin = groups => ({
  name: "islands",
  setup(build) {
    build.onResolve({ filter: /^islands:/ }, args => {
      let file = args.path.replace("islands:", "");
      return { path: file, namespace };
    });

    build.onLoad({ filter: /.*/, namespace }, args => {
      let url = args.path;
      let imports = `import { h, hydrate } from "preact"`;

      let blocks = groups[url].map(island => `
import ${island.name} from ${JSON.stringify(island.entry)};
hydrate(h(${island.name}, ${JSON.stringify(island.props)}), document.getElementById(${JSON.stringify(island.id)}));
      `).join("\n");

      let contents = `
${imports}
${blocks}
      `.trim();

      return {
        contents,
        loader: "tsx",
        resolveDir: process.cwd(),
      };
    });
  },
});

/**
 * Liquid shortcodes don't support named parameters, so we have to parse a
 * list of alternating string/value pairs into one.
 * @param {any[]} propPairs
 * @returns Record<string, any>
 */
function parsePropPairs(propPairs) {
  let props = {};

  for (let i = 0; i < propPairs.length; i += 2) {
    let key = propPairs[i];
    let value = propPairs[i + 1];

    try {
      value = JSON.parse(propPairs[i + 1]);
    } catch(err) {

    }

    props[key] = value;
  }

  return props;
}

/**
 * @param {"client" | "static" | "hydrate"} mode
 * @param {string} entryPoint
 * @param {Record<string, any>} props
 * @returns {string} Rendered html
 */
function renderGenericComponent(mode, entryPoint, props) {
  let id = Math.random().toString(36).slice(2);
  let html = "";

  if (mode === "hydrate" || mode === "static") {
    let { unregister } = register(esbuildCommonOptions);
    let mod = require(entryPoint);
    unregister();
    let component = mod.default;
    html = render(h(component, props));
  }

  if (mode === "hydrate" || mode === "client") {
    /**
     * @type {Island}
     */
    let island = {
      id,
      entry: entryPoint,
      props,
      name: `C_${id}`,
      page: this.page,
    };

    globalIslands.push(island);
  }

  if (mode === "hydrate" || mode === "client") {
    return `<div id=${JSON.stringify(id)}>${html}</div>`;
  } else {
    return html;
  }
}


async function beforeEleventyBuild() {
  globalIslands = [];
}

async function afterEleventyBuild() {
  /**
   * @type {Record<string, Island[]>}
   */
  let islandsByPageUrl = {};

  /**
   * @type {Set<EleventyPage>}
   */
  let pages = new Set();

  /**
   * @type {Set<string>}
   */
  let entryPoints = new Set();

  for (let island of globalIslands) {
    islandsByPageUrl[island.page.url] ||= [];
    islandsByPageUrl[island.page.url].push(island);
    pages.add(island.page);
    entryPoints.add(`islands:${island.page.url}`);
  }

  let result = await esbuild.build({
    ...esbuildCommonOptions,
    entryPoints: Array.from(entryPoints),
    entryNames: `[hash]`,
    minify: true,
    metafile: true,
    sourcemap: true,
    bundle: true,
    outdir: path.resolve("_site/assets"),
    plugins: [esbuildIslandsPlugin(islandsByPageUrl)],
    inject: [path.join(__dirname, "./preact-jsx.ts")],
  });

  return Promise.all(Array.from(pages).map(async page => {
    let { outputs } = result.metafile;

    let jsFiles = Object
      .keys(outputs)
      .filter(id => outputs[id].entryPoint === `islands:${page.url}`);

    let cssFiles = jsFiles
      .map(id => id.replace(/\.js$/, ".css"))
      .filter(id => id in outputs);

    jsFiles = jsFiles.map(id => id.replace("_site", ""));
    cssFiles = cssFiles.map(id => id.replace("_site", ""));

    let scripts = jsFiles.map(id => `<script defer src="${id}"></script>`);
    let styles = cssFiles.map(id => `<link rel="stylesheet" href="${id}">`);
    let tags = `${scripts.join("\n")}\n${styles.join("\n")}`

    let srcHtml = await fs.readFile(page.outputPath, "utf8");
    let dstHtml = srcHtml.replace("</head>", `${tags}\n</head>`);
    await fs.writeFile(page.outputPath, dstHtml);
  }));
}

function resolveImport(pagePath, requirePath) {
  let directory = path.dirname(pagePath);
  return requirePath.startsWith(".")
    ? path.resolve(directory, requirePath)
    : requirePath;
}

function renderComponent(requirePath, ...propPairs) {
  let entryPoint = resolveImport(this.page.inputPath, requirePath);
  let props = parsePropPairs(propPairs);
  return renderGenericComponent.call(this, "hydrate", entryPoint, props);
}

function renderStaticComponent(requirePath, ...propPairs) {
  let entryPoint = resolveImport(this.page.inputPath, requirePath);
  let props = parsePropPairs(propPairs);
  return renderGenericComponent.call(this, "static", entryPoint, props);
}

function renderClientComponent(requirePath, ...propPairs) {
  let entryPoint = resolveImport(this.page.inputPath, requirePath);
  let props = parsePropPairs(propPairs);
  return renderGenericComponent.call(this, "client", entryPoint, props);
}

module.exports = eleventyConfig => {
  eleventyConfig.on("beforeBuild", beforeEleventyBuild);
  eleventyConfig.on("afterBuild", afterEleventyBuild);
  eleventyConfig.addShortcode("renderComponent", renderComponent);
  eleventyConfig.addShortcode("renderClientComponent", renderClientComponent);
  eleventyConfig.addShortcode("renderStaticComponent", renderStaticComponent);
};
