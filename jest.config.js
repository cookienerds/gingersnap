module.exports = {
  preset: "ts-jest/presets/js-with-ts",
  testEnvironment: "jsdom",
  coverageReporters: ["html", "text", "text-summary", "cobertura"],
  transform: {
    "^.+\\.[tj]s$": "ts-jest",
  },
  moduleNameMapper: {
    cborg: "<rootDir>/node_modules/cborg/cjs/cborg.js",
  },
  setupFilesAfterEnv: ["<rootDir>/jestSetup.js"],
};
