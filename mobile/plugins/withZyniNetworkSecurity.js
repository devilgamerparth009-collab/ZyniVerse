/**
 * ZyniVerse config plugin — TLS enforcement and certificate pinning.
 *
 * The native app only talks to https://zyverse.in. Pinning the Let's Encrypt
 * intermediate and ISRG roots (rather than only the short-lived leaf) keeps the
 * app working through normal certificate renewal while blocking MITM proxies
 * with a different issuing chain.
 *
 * The generated android/ folder is gitignored, so this plugin is the durable
 * source of truth: `expo prebuild` / `eas build` re-applies both the manifest
 * attributes and the res/xml pin set on every build.
 */
const fs = require('fs/promises');
const path = require('path');
const {
  withAndroidManifest,
  withDangerousMod,
} = require('@expo/config-plugins');

const PINS = [
  // Let's Encrypt E1 (intermediate currently issuing zyverse.in)
  'nWN7PSep5XDQdge5zK24CnCRXHr3KvzhKEGxsdqCX9E=',
  // ISRG Root R2 / X1 trust anchors
  'fk6IOKit1ild5647BH06ujSIq5XbCgqlbYl6ANhhi88=',
  'C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=',
  // Current leaf, kept as an additional pin; renewal is covered above.
  'yBv4BsbR4BaQxCm9WufgjwvUEGggwLf/A+TKaWXEBYk=',
];

const NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="true">zyverse.in</domain>
    <pin-set expiration="2028-11-22">
${PINS.map((pin) => `      <pin digest="SHA-256">${pin}</pin>`).join('\n')}
    </pin-set>
  </domain-config>
</network-security-config>
`;

function withManifestAttributes(config) {
  return withAndroidManifest(config, (configProps) => {
    const manifestRoot = configProps.modResults.manifest || {};
    const application = Array.isArray(manifestRoot.application)
      ? manifestRoot.application[0]
      : null;
    if (!application) return configProps;
    application.$ = application.$ || {};
    application.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    application.$['android:usesCleartextTraffic'] = 'false';
    return configProps;
  });
}

function withNetworkSecurityXml(config) {
  return withDangerousMod(config, [
    'android',
    async (configProps) => {
      const xmlDir = path.join(
        configProps.modRequest.projectRoot,
        'android',
        'app',
        'src',
        'main',
        'res',
        'xml'
      );
      await fs.mkdir(xmlDir, { recursive: true });
      await fs.writeFile(
        path.join(xmlDir, 'network_security_config.xml'),
        NETWORK_SECURITY_CONFIG,
        'utf8'
      );
      return configProps;
    },
  ]);
}

module.exports = function withZyniNetworkSecurity(config) {
  return withNetworkSecurityXml(withManifestAttributes(config));
};
