import path from "path";
import { GITHUB_API_COOLDOWN } from "./constants.js";
import { GitHubHelper } from "./utils.js";
import { DownloadOptions } from "./types.js";
import * as YTDLP from "yt-dlp-helper";

let cachedLatestVersion: { version: string; timestamp: number } | null = null;
const VERSION_CACHE_DURATION = 30 * 60 * 1000; // Cache for 30 minutes
let lastGitHubApiCall = 0;

YTDLP.Config.log = true;
// Clean utility for dynamic ES module imports
// const importESM = (specifier: string) => eval(`import('${specifier}')`);

// let YTDLP: any = null;

async function getInfo(e: any, url: string) {
    try {
        return await YTDLP.getInfo(url);
    } catch (error: any) {
        console.error("Error fetching video info:", error);
        return { error: error.message };
    }
}

async function downloadInternal(
    e: any,
    downloadId: string,
    args: any,
    controller: any,
    completeLog: string,
    processCompletionHandled: boolean
) {
    const { invokeEvent } = e;

    for await (const chunk of controller.listen()) {
        // Collect ALL logs in the main process
        if (chunk?.data?.log) {
            completeLog += chunk.data.log; // Add to complete log
        }

        // Send chunks normally for progress updates, but also include complete log so far
        const enhancedChunk = {
            ...chunk,
            completeLog, // Add complete log to every chunk
        };

        invokeEvent.sender.send(downloadId, enhancedChunk);

        // Handle download completion notifications
        if (chunk != null && chunk.data && chunk.data.status === "finished") {
            invokeEvent.sender.send("set-tray-icon", "alert");

            // Notify the main process about the finished download
            invokeEvent.sender.send("download-finished", {
                name: args.name,
                id: downloadId,
                location: args.outputFilepath,
            });
        }
    }

    // If process completion wasn't handled through events, send a fallback after delay
    setTimeout(() => {
        if (!processCompletionHandled) {
            invokeEvent.sender.send(downloadId, {
                type: "stream_ended",
                data: {
                    log: `Process '${controller.id}' stream completed`,
                    controllerId: controller.id,
                },
            });
        }
    }, 2000);
}

async function download(e: any, downloadId: string, args: any) {
    const { invokeEvent } = e;

    try {
        const controller = await YTDLP.download({
            // args needed for download
            args: {
                url: args.url,
                output: args.outputFilepath,
                videoFormat: args.videoFormat,
                remuxVideo: args.remuxVideo,
                audioFormat: args.audioExt,
                audioQuality: args.audioFormatId,
                limitRate: args.limitRate,
            },
        });

        if (!controller || typeof controller.listen !== "function") {
            throw new Error(
                "Controller is not defined or does not have a listen method"
            );
        }

        // Set up process completion detection WITHOUT interfering with the main stream
        let processCompletionHandled = false;
        let completeLog = ""; // Collect all logs here

        if (controller.process) {
            const handleProcessCompletion = (
                code: number,
                signal: string,
                eventType: string
            ) => {
                if (processCompletionHandled) return; // Prevent duplicate handling
                processCompletionHandled = true;

                const completionMessage = `Process '${controller.id}' ${eventType} with code: ${code}, signal: ${signal}`;

                // completion message to complete log
                completeLog += `\n${completionMessage}`;

                // Send completion with complete log after a small delay to ensure all other logs are processed first
                setTimeout(() => {
                    invokeEvent.sender.send(downloadId, {
                        type: "completion",
                        data: {
                            log: completionMessage,
                            completeLog: completeLog,
                            exitCode: code,
                            signal: signal,
                            controllerId: controller.id,
                        },
                    });
                }, 100); // Small delay to ensure stream logs are processed first
            };

            controller.process.on("exit", (code: number, signal: string) => {
                handleProcessCompletion(code, signal, "exited");
            });

            controller.process.on("close", (code: number, signal: string) => {
                // Only handle close if exit wasn't already handled
                if (!processCompletionHandled) {
                    handleProcessCompletion(code, signal, "closed");
                }
            });
        } else {
            console.log(
                `⚠️ Controller ${controller.id} does not expose process - will rely on stream completion`
            );
        }

        // Process the main download stream normally
        downloadInternal(
            e,
            downloadId,
            args,
            controller,
            completeLog,
            processCompletionHandled
        );

        // Return the download ID and controller ID
        return { downloadId, controllerId: controller.id };
    } catch (error: any) {
        invokeEvent.sender.send(downloadId, {
            type: "error",
            data: error.message,
        });

        throw error; // Ensure the error is propagated
    }
}

async function killController(e: any, id: string) {
    try {
        const controller = YTDLP.getTerminalFromID(id);

        if (controller) {
            controller.kill();
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.error(`Failed to kill controller with ID ${id}:`, error);
        return false;
    }
}

// Helper function to get cached version if still valid
function getCachedVersion(): string | null {
    if (!cachedLatestVersion) return null;

    const now = Date.now();
    const isExpired =
        now - cachedLatestVersion.timestamp > VERSION_CACHE_DURATION;

    return isExpired ? null : cachedLatestVersion.version;
}

// Helper function to check if we can make a GitHub API call
function canMakeGitHubApiCall(): boolean {
    const now = Date.now();
    return now - lastGitHubApiCall >= GITHUB_API_COOLDOWN;
}

async function ready({
    events,
    channels,
    electron: { BrowserWindow },
    api,
}: any) {
    // Check for YT-DLP updates when app starts
    setTimeout(async () => {
        try {
            console.log("Checking for YT-DLP updates on startup...");

            // Get current version first
            const currentVersion = await YTDLP.getYTDLPVersion();

            // Check if we have a cached version first
            let latestVersion = getCachedVersion();

            if (!latestVersion && canMakeGitHubApiCall()) {
                // Make the API call if we can
                lastGitHubApiCall = Date.now();
                const latestResponse =
                    await YTDLP.getLatestYTDLPVersionFromGitHub();

                if (latestResponse.ok && latestResponse.version) {
                    latestVersion = latestResponse.version;
                    // Cache the result
                    cachedLatestVersion = {
                        version: latestVersion,
                        timestamp: Date.now(),
                    };
                }
            }

            // Only auto-update if we have both versions and they differ
            if (
                currentVersion &&
                latestVersion &&
                currentVersion !== latestVersion
            ) {
                console.log(
                    `Auto-updating YT-DLP from ${currentVersion} to ${latestVersion}...`
                );
                await YTDLP.downloadYTDLP({
                    version: latestVersion,
                    forceDownload: true,
                });
                console.log("YT-DLP auto-update completed!");

                // Notify renderer about the update
                BrowserWindow.getAllWindows().forEach((win: any) => {
                    win.webContents.send("ytdlp-auto-updated", {
                        fromVersion: currentVersion,
                        toVersion: latestVersion,
                        message: `YT-DLP automatically updated from ${currentVersion} to ${latestVersion}`,
                    });
                });
            } else if (!currentVersion) {
                console.log("YT-DLP not found, downloading latest version...");
                await YTDLP.downloadYTDLP();
                console.log("YT-DLP downloaded successfully!");

                // Notify renderer about the installation
                BrowserWindow.getAllWindows().forEach((win: any) => {
                    win.webContents.send("ytdlp-auto-installed", {
                        version: latestVersion || "latest",
                        message:
                            "YT-DLP was automatically downloaded and installed",
                    });
                });
            } else {
                console.log(
                    "YT-DLP is up to date or update check skipped due to rate limiting"
                );
            }
        } catch (error) {
            console.error("Error during automatic YT-DLP update check:", error);
            // Don't notify user about auto-update failures to avoid spam
        }
    }, 7000); // Check after 7 seconds, after app updates
}

async function main(args: any) {
    const {
        events,
        channels,
        electron: { ipcMain },
        api,
    } = args;

    // Initialize the yt-dlp-helper module
    events.on("extendr:getInfo", getInfo);
    events.on("extendr:download", download);
    events.on("extendr:killController", killController);

    ipcMain.handle(channels.register("getCurrentVersion"), async () => {
        try {
            const version = await YTDLP.getYTDLPVersion();

            return { success: true, version };
        } catch (error: any) {
            console.error("Error getting current YT-DLP version:", error);

            return { success: false, error: error.message, version: null };
        }
    });

    ipcMain.handle(channels.register("getLatestVersion"), async () => {
        try {
            // Check if we have a cached version first
            const cachedVersion = GitHubHelper.getCachedVersion();
            if (cachedVersion) {
                console.log("Using cached YT-DLP version:", cachedVersion);
                return {
                    success: true,
                    version: cachedVersion,
                    message: "Retrieved from cache",
                };
            }

            // Check rate limiting
            if (!GitHubHelper.canMakeGitHubApiCall()) {
                const remainingTime = Math.ceil(
                    (GITHUB_API_COOLDOWN -
                        (Date.now() - GitHubHelper.lastGitHubApiCall)) /
                        1000
                );
                return {
                    success: false,
                    error: `Rate limited. Please wait ${remainingTime} seconds before checking again.`,
                    version: null,
                };
            }

            // Make the API call
            GitHubHelper.lastGitHubApiCall = Date.now();
            const response = await YTDLP.getLatestYTDLPVersionFromGitHub();

            // Cache the result if successful
            if (response.ok && response.version) {
                GitHubHelper.cachedLatestVersion = {
                    version: response.version,
                    timestamp: Date.now(),
                };
            }

            return {
                success: response.ok,
                version: response.version,
                message: response.message,
            };
        } catch (error: any) {
            console.error("Error getting latest YT-DLP version:", error);

            // Check if it's a rate limit error
            if (error.message && error.message.includes("403")) {
                return {
                    success: false,
                    error: "GitHub API rate limit exceeded. Please wait an hour before trying again.",
                    version: null,
                };
            }

            return { success: false, error: error.message, version: null };
        }
    });

    ipcMain.handle(
        channels.register("getPlaylistInfo"),
        async (e: any, { url }: any) => {
            try {
                const r = await YTDLP.getPlaylistInfo({
                    url,
                    //ytdlpDownloadDestination: os.tmpdir(),
                    // ffmpegDownloadDestination: os.tmpdir(),
                });

                return r;
            } catch (error) {
                console.error("Error fetching playlist info:", error);
                throw error; // Propagate the error to the renderer process
            }
        }
    );

    ipcMain.handle(channels.register("checkAndUpdate"), async () => {
        try {
            const currentVersion = await YTDLP.getYTDLPVersion();

            // Check if we have a cached version first
            let latestVersion = GitHubHelper.getCachedVersion();
            let latestResponse;

            if (!latestVersion) {
                // Check rate limiting
                if (!GitHubHelper.canMakeGitHubApiCall()) {
                    const remainingTime = Math.ceil(
                        (GITHUB_API_COOLDOWN -
                            (Date.now() - GitHubHelper.lastGitHubApiCall)) /
                            1000
                    );
                    return {
                        success: false,
                        error: `Rate limited. Please wait ${remainingTime} seconds before checking again.`,
                        action: "error",
                    };
                }

                // Make the API call
                GitHubHelper.lastGitHubApiCall = Date.now();
                latestResponse = await YTDLP.getLatestYTDLPVersionFromGitHub();

                if (!latestResponse.ok || !latestResponse.version) {
                    // Check if it's a rate limit error
                    if (
                        latestResponse.message &&
                        latestResponse.message.includes("403")
                    ) {
                        throw new Error(
                            "GitHub API rate limit exceeded. Please wait an hour before trying again."
                        );
                    }
                    throw new Error(
                        latestResponse.message || "Failed to get latest version"
                    );
                }

                latestVersion = latestResponse.version;

                // Cache the result
                GitHubHelper.cachedLatestVersion = {
                    version: latestVersion || "",
                    timestamp: Date.now(),
                };
            }

            if (!currentVersion) {
                console.log("YT-DLP not found. Downloading latest version...");
                await YTDLP.downloadYTDLP();
                return {
                    success: true,
                    action: "downloaded",
                    message: "YT-DLP was not found and has been downloaded.",
                    currentVersion: null,
                    latestVersion,
                };
            }

            console.log(`Current version: ${currentVersion}`);
            console.log(`Latest version: ${latestVersion}`);

            if (latestVersion && currentVersion !== latestVersion) {
                console.log("Updating YT-DLP to latest version...");
                await YTDLP.downloadYTDLP({
                    version: latestVersion,
                    forceDownload: true,
                });
                console.log("Update completed!");
                return {
                    success: true,
                    action: "updated",
                    message: `YT-DLP updated from ${currentVersion} to ${latestVersion}`,
                    currentVersion,
                    latestVersion,
                };
            } else {
                console.log("YT-DLP is up to date!");
                return {
                    success: true,
                    action: "up-to-date",
                    message: "YT-DLP is already up to date",
                    currentVersion,
                    latestVersion,
                };
            }
        } catch (error: any) {
            console.error("Error managing YT-DLP version:", error);
            return {
                success: false,
                error: error.message,
                action: "error",
                message: `Error managing YT-DLP version: ${error.message}`,
            };
        }
    });

    ipcMain.handle(
        channels.register("downloadYTDLP"),
        async (options: any = {}) => {
            try {
                console.log("YTDLP download options:", options);

                const downloadOptions: DownloadOptions = {
                    forceDownload: options.forceDownload || false,
                };

                // Handle filePath - if it's provided, ensure it's a proper file path
                if (options.filePath && options.filePath.trim()) {
                    const filePath = options.filePath.trim();

                    // Check if the path is a directory (doesn't end with an executable extension)
                    if (
                        !path.extname(filePath) ||
                        path.extname(filePath).toLowerCase() !== ".exe"
                    ) {
                        // If it's a directory or doesn't have .exe extension, append the default filename
                        const defaultFilename =
                            process.platform === "win32"
                                ? "yt-dlp.exe"
                                : "yt-dlp";
                        downloadOptions.filePath = path.join(
                            filePath,
                            defaultFilename
                        );
                    } else {
                        downloadOptions.filePath = filePath;
                    }
                }
                // If no filePath provided, let YTDLP use its default location

                // Handle version
                if (
                    options.version &&
                    options.version.trim() &&
                    options.version.trim().toLowerCase() !== "latest"
                ) {
                    downloadOptions.version = options.version.trim();
                }
                // If no version provided or 'latest', let YTDLP use latest

                // Handle platform
                if (options.platform && options.platform !== "auto") {
                    downloadOptions.platform = options.platform;
                }
                // If no platform provided or 'auto', let YTDLP auto-detect

                console.log("Final YTDLP download options:", downloadOptions);

                await YTDLP.downloadYTDLP(downloadOptions);
                return { success: true };
            } catch (error: any) {
                console.error("Error downloading YTDLP:", error);
                return { success: false, error: error.message };
            }
        }
    );

    await ready(args);
}

export { main };
