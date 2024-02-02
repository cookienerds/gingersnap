import typescript from "@rollup/plugin-typescript";
import packageBundler from "./plugins/packageBundler.js";
import fs from "fs";
import dts from "rollup-plugin-dts";
import del from "rollup-plugin-delete";

const { name, author, description, dependencies, version } = JSON.parse(fs.readFileSync("./package.json").toString());

export default (options) => {
  const config = {
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
      mocks: "./src/mocks.ts",
      types: "./src/types.ts",
    },
    output: [
      {
        dir: "./lib",
        format: "es",
      },
    ],
  };

  return [
    {
      ...config,
      plugins: [
        packageBundler({
          name,
          author,
          description,
          dependencies,
          version: options?.releaseVersion ?? version,
        }),
        typescript({ tsconfig: "./tsconfig.json" }),
      ],
    },
    {
      ...config,
      input: Object.fromEntries(
        Object.entries(config.input).map(([key, value]) => [
          key,
          value.replace(".ts", ".d.ts").replace("./src", "./lib/dts"),
        ])
      ),
      plugins: [dts(), del({ targets: "lib/dts", hook: "buildEnd" })],
    },
  ];
};
