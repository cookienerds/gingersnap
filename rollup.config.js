import typescript from "@rollup/plugin-typescript";
import packageBundler from "./plugins/packageBundler.js";
import path from "path";
import fs from "fs";

const { name, author, description, dependencies, version } = JSON.parse(fs.readFileSync("./package.json").toString());
const { compilerOptions } = JSON.parse(fs.readFileSync("./tsconfig.json").toString());

export default (options) => ({
  input: {
    index: "./src/index.ts",
    context: "./src/context.ts",
    dataStructure: "./src/dataStructure.ts",
    error: "./src/error.ts",
    future: "./src/future.ts",
    model: "./src/model.ts",
    service: "./src/service.ts",
    stream: "./src/stream.ts",
    synchronize: "./src/synchronize.ts",
  },
  output: [
    {
      dir: "./lib",
      format: "es",
    },
  ],
  plugins: [
    typescript({ tsconfig: "./tsconfig.json" }),
    packageBundler({
      name,
      author,
      description,
      dependencies,
      version: options?.releaseVersion ?? version,
      mainDeclarationFile: path.join(compilerOptions.declarationDir, "index.d.ts"),
    }),
  ],
});
