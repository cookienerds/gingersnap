export default {
  preset: "ts-jest/presets/js-with-ts",
  testEnvironment: "jsdom",
  coverageReporters: ["html", "text", "text-summary", "cobertura"],
  transform: {
    "^.+\\.[tj]s$": ["ts-jest", { tsconfig: "./tsconfig.jest.json" }],
  },
  moduleNameMapper: {
    cborg: "<rootDir>/node_modules/cborg/cjs/cborg.js",
  },
  setupFilesAfterEnv: ["<rootDir>/jestSetup.js"],
};
