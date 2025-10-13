import { GITHUB_API_COOLDOWN, VERSION_CACHE_DURATION } from "./constants.js";

export abstract class GitHubHelper {
    static cachedLatestVersion: { version: string; timestamp: number } | null =
        null;
    static lastGitHubApiCall = 0;

    static getCachedVersion() {
        if (!this.cachedLatestVersion) return null;

        const now = Date.now();
        const isExpired =
            now - this.cachedLatestVersion.timestamp > VERSION_CACHE_DURATION;

        return isExpired ? null : this.cachedLatestVersion.version;
    }

    static canMakeGitHubApiCall() {
        const now = Date.now();
        return now - this.lastGitHubApiCall >= GITHUB_API_COOLDOWN;
    }
}
