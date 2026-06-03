document.addEventListener('DOMContentLoaded', () => {
    const usernameInput = document.getElementById('username');
    const tokenInput = document.getElementById('token');
    const apiBaseUrlInput = document.getElementById('api-base-url');
    const pollingIntervalInput = document.getElementById('polling-interval');
    const staleThresholdInput = document.getElementById('staleness-threshold');
    const criticalThresholdInput = document.getElementById('critical-threshold');
    const optionsForm = document.getElementById('options-form');

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
        if (result.pollingInterval) {
            pollingIntervalInput.value = result.pollingInterval;
        }
        if (result.stalenessThresholds) {
            staleThresholdInput.value = result.stalenessThresholds.staleThreshold || 3;
            criticalThresholdInput.value = result.stalenessThresholds.criticalThreshold || 6;
        }
    });

    // Save options to chrome.storage.local
    optionsForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const username = usernameInput.value;
        const token = tokenInput.value;
        const apiBaseUrl = apiBaseUrlInput.value;
        const pollingInterval = Number(pollingIntervalInput.value); // Convert directly to a number
        const staleThreshold = Number(staleThresholdInput.value);
        const criticalThreshold = Number(criticalThresholdInput.value);

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
            chrome.alarms.clear('checkForUpdates', (wasCleared) => {
                if (wasCleared) {
                    console.log('Existing job schedule was cleared. Creating a new schedule with updated interval:', pollingInterval);

                    // Create a new alarm with the updated interval
                    chrome.alarms.create('checkForUpdates', { periodInMinutes: pollingInterval });
                } else {
                    console.error('Failed to clear the existing schedule.');
                }
            });
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