import { MakerPKG } from '@electron-forge/maker-pkg';
import { MakerZIP } from '@electron-forge/maker-zip';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import MakerNSIS from '@felixrieseberg/electron-forge-maker-nsis';
import fs from 'fs/promises';
import path from 'path';

// Helper function to recursively copy directories
async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: './src/Assets/AppLogo/256x256',
    name: 'Downlodr',
    executableName: 'Downlodr',
    extraResource: ['./src/Assets/AppLogo'],
  },
  rebuildConfig: {},
  makers: [
    // macOS PKG installer
    new MakerPKG({
      identity: null, // Set to null for development, add your Apple Developer ID for production
      /*signing: {
        identity: null, // Same as above
        "entitlements": null,
        "entitlements-inherit": null,
        "gatekeeper-assess": false,
      },*/
    }),

    // Windows NSIS installer
    new MakerNSIS({
      async getAppBuilderConfig() {
        return {
          nsis: {
            artifactName: '${productName}-${version}-${arch}.${ext}',
            oneClick: false,
            allowElevation: true,
            installerIcon: './src/Assets/AppLogo/256x256.ico',
            uninstallerIcon: './src/Assets/AppLogo/256x256.ico',
            allowToChangeInstallationDirectory: true,
            createDesktopShortcut: true,
            createStartMenuShortcut: true,
            shortcutName: 'Downlodr',
            uninstallDisplayName: 'Downlodr',
            deleteAppDataOnUninstall: false,
            warningsAsErrors: false,
            perMachine: false, // Changed to false - install per-user, not machine-wide
            include: './installer.nsh', // Keep this for admin privileges at runtime
          },
        };
      },
    }),

    // Cross-platform ZIP packages
    new MakerZIP({}, ['darwin', 'win32', 'linux']),
  ],
  hooks: {
    postPackage: async (forgeConfig, packageResult) => {
      for (const outputPath of packageResult.outputPaths) {
        try {
          // Copy yt-dlp.exe
          await fs.copyFile(
            path.resolve(__dirname, 'yt-dlp.exe'),
            path.join(outputPath, 'yt-dlp.exe'),
          );
        } catch (error) {
          console.error(`Failed to copy yt-dlp for ${outputPath}:`, error);
        }

        try {
          // Copy extensions directory beside the executable
          const extensionsSource = path.resolve(__dirname, 'extensions');
          const extensionsTarget = path.join(outputPath, 'extensions');

          // Check if extensions directory exists
          try {
            await fs.access(extensionsSource);
            await copyDirectory(extensionsSource, extensionsTarget);
            console.log(
              `Successfully copied extensions to ${extensionsTarget}`,
            );
          } catch (accessError) {
            console.warn(
              `Extensions directory not found at ${extensionsSource}, skipping copy`,
            );
          }
        } catch (error) {
          console.error(`Failed to copy extensions for ${outputPath}:`, error);
        }

        try {
          // Copy load-order.json beside the executable
          const loadOrderSource = path.resolve(__dirname, 'load-order.json');
          const loadOrderTarget = path.join(outputPath, 'load-order.json');

          // Check if load-order.json exists
          try {
            await fs.access(loadOrderSource);
            await fs.copyFile(loadOrderSource, loadOrderTarget);
            console.log(
              `Successfully copied load-order.json to ${loadOrderTarget}`,
            );
          } catch (accessError) {
            console.warn(
              `load-order.json not found at ${loadOrderSource}, skipping copy`,
            );
          }
        } catch (error) {
          console.error(
            `Failed to copy load-order.json for ${outputPath}:`,
            error,
          );
        }
      }
    },
  },
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
