const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Config plugin to disable lint checks for release builds
 * This helps resolve memory-intensive lint check issues during release builds
 */
function withDisableLint(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      // Check if lintOptions already exists
      if (!config.modResults.contents.includes("lintOptions")) {
        // Find the android block and add lint options
        config.modResults.contents = config.modResults.contents.replace(
          /android\s*\{/,
          `android {
    lintOptions {
        checkReleaseBuilds false
        abortOnError false
    }`
        );
      }
    } else if (config.modResults.language === "kt") {
      // Kotlin DSL (build.gradle.kts)
      if (!config.modResults.contents.includes("lint {")) {
        config.modResults.contents = config.modResults.contents.replace(
          /android\s*\{/,
          `android {
    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }`
        );
      }
    }
    return config;
  });
}

module.exports = withDisableLint;
