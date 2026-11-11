import { normalizePollingInterval } from '../shared/storageUtils.js';

document.addEventListener('DOMContentLoaded', () => {
    const usernameInput = document.getElementById('username');
    const tokenInput = document.getElementById('token');
    const apiBaseUrlInput = document.getElementById('api-base-url');
    const pollingIntervalInput = document.getElementById('polling-interval');
    const staleThresholdInput = document.getElementById('staleness-threshold');
    const criticalThresholdInput = document.getElementById('critical-threshold');
    const optionsForm = document.getElementById('options-form');
    const toast = document.getElementById('toast');

    // Load saved options from chrome.storage.local
    chrome.storage.local.get(['githubUsername', 'githubToken', 'githubApiBaseUrl', 'pollingInterval', 'stalenessThresholds'], (result) => {
        if (result.githubUsername) {
            usernameInput.value = result.githubUsername;
        }
        if (result.githubToken) {
            tokenInput.value = result.githubToken;
        }
        if (result.githubApiBaseUrl) {
            apiBaseUrlInput.value = result.githubApiBaseUrl;
        }
        pollingIntervalInput.value = normalizePollingInterval(result.pollingInterval);
        if (result.stalenessThresholds) {
            staleThresholdInput.value = result.stalenessThresholds.staleThreshold || 3;
            criticalThresholdInput.value = result.stalenessThresholds.criticalThreshold || 6;
        }
    });

    // Save options to chrome.storage.local.
    // The background service worker recreates the checkForUpdates alarm when pollingInterval changes.
    optionsForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const username = usernameInput.value;
        const token = tokenInput.value;
        const apiBaseUrl = apiBaseUrlInput.value;
        const pollingInterval = normalizePollingInterval(pollingIntervalInput.value);
        const staleThreshold = Number(staleThresholdInput.value);
        const criticalThreshold = Number(criticalThresholdInput.value);

        pollingIntervalInput.value = pollingInterval;

        // Validate that critical > stale
        if (criticalThreshold <= staleThreshold) {
            alert('Critical threshold must be greater than stale threshold');
            return;
        }

        const stalenessThresholds = {
            staleThreshold: staleThreshold,
            criticalThreshold: criticalThreshold
        };

        chrome.storage.local.set({
            githubUsername: username,
            githubToken: token,
            githubApiBaseUrl: apiBaseUrl,
            pollingInterval: pollingInterval,
            stalenessThresholds: stalenessThresholds,
        }, () => {
            // Show the toast notification
            toast.classList.remove('hidden');
            toast.classList.add('show');

            // Hide the toast after 3 seconds
            setTimeout(() => {
                toast.classList.remove('show');
                toast.classList.add('hidden');
            }, 3000);
        });
    });
});
