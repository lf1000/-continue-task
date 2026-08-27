const fs = require("fs");
const path = require("path");

const { writeBuildTimestamp } = require("./utils");

const esbuild = require("esbuild");

const flags = process.argv.slice(2);

const esbuildConfig = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "out/extension.js",
  external: ["vscode", "esbuild", "./xhr-sync-worker.js"],
  format: "cjs",
  platform: "node",
  sourcemap: flags.includes("--sourcemap"),
  alias: {
    "@continuedev/config-types": path.resolve(__dirname, "../../../packages/config-types/src/index.ts"),
    "@continuedev/config-yaml": path.resolve(__dirname, "../../../packages/config-yaml/src/index.ts"),
    "@continuedev/fetch": path.resolve(__dirname, "../../../packages/fetch/src/index.ts"),
    "@continuedev/llm-info": path.resolve(__dirname, "../../../packages/llm-info/src/index.ts"),
    "@continuedev/openai-adapters": path.resolve(__dirname, "../../../core/__mocks__/@continuedev/openai-adapters/index.ts"),
    "@continuedev/terminal-security": path.resolve(__dirname, "../../../packages/terminal-security/src/index.ts"),
  },
  nodePaths: [
    path.resolve(__dirname, "../node_modules"),
    path.resolve(__dirname, "../../../core/node_modules"),
    path.resolve(__dirname, "../../../node_modules"),
  ],
  loader: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ".node": "file",
  },

  // To allow import.meta.path for transformers.js
  // https://github.com/evanw/esbuild/issues/1492#issuecomment-893144483
  inject: ["./scripts/importMetaUrl.js"],
  define: { "import.meta.url": "importMetaUrl" },
  supported: { "dynamic-import": false },
  metafile: true,
  plugins: [
    {
      name: "on-end-plugin",
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length > 0) {
            console.error("Build failed with errors:", result.errors);
            throw new Error(result.errors);
          } else {
            try {
              if (!fs.existsSync("./build")) {
                fs.mkdirSync("./build", { recursive: true });
              }
              fs.writeFileSync(
                "./build/meta.json",
                JSON.stringify(result.metafile, null, 2),
              );
            } catch (e) {
              console.error("Failed to write esbuild meta file", e);
            }

            // Copy native addons and worker files needed at runtime
            try {
              // 1. sqlite3 native addon
              const sqliteSources = [
                path.join(__dirname, "../node_modules/sqlite3/build/Release/node_sqlite3.node"),
                path.join(__dirname, "../../../core/node_modules/sqlite3/build/Release/node_sqlite3.node"),
              ];
              const sqliteSrc = sqliteSources.find((p) => fs.existsSync(p));
              if (sqliteSrc) {
                const targets = [
                  path.join(__dirname, "../build/Release/node_sqlite3.node"),
                  path.join(__dirname, "../build/node_sqlite3.node"),
                  path.join(__dirname, "../out/build/Release/node_sqlite3.node"),
                  path.join(__dirname, "../out/Release/node_sqlite3.node"),
                  path.join(__dirname, "../out/node_sqlite3.node"),
                ];
                targets.forEach((tgt) => {
                  const dir = path.dirname(tgt);
                  if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                  }
                  fs.copyFileSync(sqliteSrc, tgt);
                });
                console.log("[info] Copied node_sqlite3.node to build and out targets");
              } else {
                console.warn("[warn] Could not locate source node_sqlite3.node");
              }

              // 2. jsdom xhr-sync-worker.js
              const xhrSources = [
                path.join(__dirname, "../node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js"),
                path.join(__dirname, "../../../core/node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js"),
              ];
              const xhrSrc = xhrSources.find((p) => fs.existsSync(p));
              if (xhrSrc) {
                const xhrTargets = [
                  path.join(__dirname, "../out/xhr-sync-worker.js"),
                  path.join(__dirname, "../build/xhr-sync-worker.js"),
                  path.join(__dirname, "../xhr-sync-worker.js"),
                ];
                xhrTargets.forEach((tgt) => {
                  const dir = path.dirname(tgt);
                  if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                  }
                  fs.copyFileSync(xhrSrc, tgt);
                });
                console.log("[info] Copied xhr-sync-worker.js to out and build targets");
              } else {
                console.warn("[warn] Could not locate source xhr-sync-worker.js");
              }

              // 3. web-tree-sitter wasm
              const treeSitterSources = [
                path.join(__dirname, "../../../core/vendor/tree-sitter.wasm"),
                path.join(__dirname, "../../../core/node_modules/web-tree-sitter/tree-sitter.wasm"),
                path.join(__dirname, "../node_modules/web-tree-sitter/tree-sitter.wasm"),
              ];
              const treeSitterSrc = treeSitterSources.find((p) => fs.existsSync(p));
              if (treeSitterSrc) {
                const tsTargets = [
                  path.join(__dirname, "../out/tree-sitter.wasm"),
                  path.join(__dirname, "../build/tree-sitter.wasm"),
                ];
                tsTargets.forEach((tgt) => {
                  const dir = path.dirname(tgt);
                  if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                  }
                  fs.copyFileSync(treeSitterSrc, tgt);
                });
                console.log("[info] Copied tree-sitter.wasm to out and build targets");
              }
            } catch (copyErr) {
              console.error("Error copying runtime assets:", copyErr);
            }

            console.log("VS Code Extension esbuild complete"); // used verbatim in vscode tasks to detect completion
          }
        });
      },
    },
  ],
};

void (async () => {
  // Create .buildTimestamp.js before starting the first build
  writeBuildTimestamp();
  // Bundles the extension into one file
  if (flags.includes("--watch")) {
    const ctx = await esbuild.context(esbuildConfig);
    await ctx.watch();
  } else if (flags.includes("--notify")) {
    const inFile = esbuildConfig.entryPoints[0];
    const outFile = esbuildConfig.outfile;

    // The watcher automatically notices changes to source files
    // so the only thing it needs to be notified about is if the
    // output file gets removed.
    if (fs.existsSync(outFile)) {
      console.log("VS Code Extension esbuild up to date");
      return;
    }

    fs.watchFile(outFile, (current, previous) => {
      if (current.size > 0) {
        console.log("VS Code Extension esbuild rebuild complete");
        fs.unwatchFile(outFile);
        process.exit(0);
      }
    });

    console.log("Triggering VS Code Extension esbuild rebuild...");
    writeBuildTimestamp();
  } else {
    await esbuild.build(esbuildConfig);
  }
})();
