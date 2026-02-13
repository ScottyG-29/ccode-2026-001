import * as esbuild from "esbuild";

const isProduction = process.argv.includes("--production");
const isWatch = process.argv.includes("--watch");

/** @type {esbuild.BuildOptions} */
const sharedOptions = {
  bundle: true,
  minify: isProduction,
  sourcemap: !isProduction,
  platform: "node",
  target: "node20",
  format: "cjs",
  logLevel: "info",
};

// Client bundle — runs in the VS Code extension host
/** @type {esbuild.BuildOptions} */
const clientOptions = {
  ...sharedOptions,
  entryPoints: ["client/src/extension.ts"],
  outfile: "dist/client/extension.js",
  external: ["vscode"],
};

// Server bundle — runs as a separate Language Server process
/** @type {esbuild.BuildOptions} */
const serverOptions = {
  ...sharedOptions,
  entryPoints: ["server/src/server.ts"],
  outfile: "dist/server/server.js",
};

async function main() {
  if (isWatch) {
    const clientCtx = await esbuild.context(clientOptions);
    const serverCtx = await esbuild.context(serverOptions);
    await Promise.all([clientCtx.watch(), serverCtx.watch()]);
    console.log("Watching for changes...");
  } else {
    await Promise.all([
      esbuild.build(clientOptions),
      esbuild.build(serverOptions),
    ]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
