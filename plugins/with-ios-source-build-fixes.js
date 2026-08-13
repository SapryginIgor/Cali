const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

const MARKER = "# @cali-fmt-consteval-fix";

const fmtConstevalFix = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        definitions = config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
        definitions = [definitions] unless definitions.is_a?(Array)
        definitions << 'FMT_USE_CONSTEVAL=0' unless definitions.include?('FMT_USE_CONSTEVAL=0')
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = definitions
      end
    end

    fmt_base_header = File.join(__dir__, 'Pods', 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base_header)
      contents = File.read(fmt_base_header)
      patched = contents.gsub("#  define FMT_USE_CONSTEVAL 1\\n#elif FMT_GCC_VERSION >= 1002 || FMT_CLANG_VERSION >= 1101\\n#  define FMT_USE_CONSTEVAL 1", "#  define FMT_USE_CONSTEVAL 0\\n#elif FMT_GCC_VERSION >= 1002 || FMT_CLANG_VERSION >= 1101\\n#  define FMT_USE_CONSTEVAL 0")
      if patched != contents
        File.chmod(0644, fmt_base_header)
        File.write(fmt_base_header, patched)
      end
    end
`;

function withIosSourceBuildFixes(config) {
  return withDangerousMod(config, [
    "ios",
    async (nextConfig) => {
      const podfilePath = path.join(nextConfig.modRequest.platformProjectRoot, "Podfile");

      if (!fs.existsSync(podfilePath)) {
        return nextConfig;
      }

      const podfile = fs.readFileSync(podfilePath, "utf8");
      if (podfile.includes(MARKER)) {
        return nextConfig;
      }

      const anchor = `    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
`;

      if (!podfile.includes(anchor)) {
        throw new Error("Could not find React Native post_install hook to patch fmt consteval handling.");
      }

      fs.writeFileSync(podfilePath, podfile.replace(anchor, `${anchor}${fmtConstevalFix}`));
      return nextConfig;
    },
  ]);
}

module.exports = withIosSourceBuildFixes;
