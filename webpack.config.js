const path = require("path");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports = {
  entry: "./src/annotations/browser.ts",
  mode: "production",
  output: {
    path: path.resolve(__dirname, "lib/annotations"),
    filename: "browser.js",
    globalObject: "this",
    library: {
      name: "gingersnap",
      type: "umd",
    },
  },
  externals: ["./model", "./collection", "./property", "./types"],
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new NodePolyfillPlugin({
      excludeAliases: ["console"],
    }),
  ],
  resolve: {
    alias: {
      fs: "browserify-fs",
    },
    extensions: [".ts", ".js", ".json"],
  },
};
