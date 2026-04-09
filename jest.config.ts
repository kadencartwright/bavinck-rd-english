import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testEnvironment: "node",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json"
      }
    ]
  },
  moduleNameMapper: {
    "^@calibration-domain$": "<rootDir>/libs/calibration-domain/src",
    "^@calibration-domain/(.*)$": "<rootDir>/libs/calibration-domain/src/$1",
    "^@calibration-config$": "<rootDir>/libs/calibration-config/src",
    "^@calibration-config/(.*)$": "<rootDir>/libs/calibration-config/src/$1",
    "^@provider-clients$": "<rootDir>/libs/provider-clients/src",
    "^@provider-clients/(.*)$": "<rootDir>/libs/provider-clients/src/$1",
    "^@artifact-store$": "<rootDir>/libs/artifact-store/src",
    "^@artifact-store/(.*)$": "<rootDir>/libs/artifact-store/src/$1",
    "^@deterministic-lint$": "<rootDir>/libs/deterministic-lint/src",
    "^@deterministic-lint/(.*)$": "<rootDir>/libs/deterministic-lint/src/$1",
    "^@translation-workflow$": "<rootDir>/libs/translation-workflow/src",
    "^@translation-workflow/(.*)$": "<rootDir>/libs/translation-workflow/src/$1"
  }
};

export default config;
