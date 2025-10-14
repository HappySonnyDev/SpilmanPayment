/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  maxWorkers: 1, // Fix BigInt serialization issue
  collectCoverageFrom: [
    "contracts/*/src/**/*.ts",
    "!dist/**"
  ]
};
