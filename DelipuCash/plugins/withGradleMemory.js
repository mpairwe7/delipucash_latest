const { withGradleProperties } = require("expo/config-plugins");

/**
 * Config plugin to raise the Gradle daemon heap for release builds.
 * The Expo template defaults org.gradle.jvmargs to -Xmx2048m, which is not
 * enough for :app:minifyReleaseWithR8 on this app (daemon dies with
 * java.lang.OutOfMemoryError: Java heap space). GRADLE_OPTS cannot fix this —
 * it only sizes the Gradle client JVM, not the daemon that runs R8.
 */
const JVM_ARGS = "-Xmx6g -XX:MaxMetaspaceSize=1g";

function withGradleMemory(config) {
  return withGradleProperties(config, (config) => {
    const existing = config.modResults.find(
      (item) => item.type === "property" && item.key === "org.gradle.jvmargs"
    );
    if (existing) {
      existing.value = JVM_ARGS;
    } else {
      config.modResults.push({
        type: "property",
        key: "org.gradle.jvmargs",
        value: JVM_ARGS,
      });
    }
    return config;
  });
}

module.exports = withGradleMemory;
