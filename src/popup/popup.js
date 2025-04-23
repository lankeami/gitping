import { getAuthToken, getUsername, updateExtensionBadge, resetLocalStorage } from '../shared/storageUtils.js';
import { fetchOrganizations, fetchRepositories, fetchPullRequests, filterPullRequestsByReviewer } from '../shared/githubApi.js';
import { displayPullRequests } from '../shared/uiUtils.js';

document.addEventListener('DOMContentLoaded', function () {
    const loginButton = document.getElementById('login-button');
    const refreshButton = document.getElementById('refresh-button');
    const resetButton = document.getElementById('reset-button');
    const pullRequestsList = document.getElementById('pull-requests-list');
    const usernameInput = document.getElementById('username');
    const tokenInput = document.getElementById('token');
    const credentialsDiv = document.getElementById('credentials');
    const headerSection = document.getElementById('header-section');
    const lastUpdateTimeElement = document.getElementById('last-update-time');
    const lastErrorElement = document.getElementById('last-error');
    const iconContainer = document.getElementById('icon-container');
    const appIconContainer = document.getElementById('app-icon-container');


    // Check if username is stored in local storage
    chrome.storage.local.get(['githubUsername', 'lastUpdateTime', 'lastError', 'pullRequests'], async function (result) {
        const username = await getUsername();

        if (username) {
            credentialsDiv.classList.add('hidden');
            headerSection.classList.add('hidden');
            iconContainer.classList.remove('hidden');
        } else {
            credentialsDiv.classList.remove('hidden');
            headerSection.classList.remove('hidden');
            iconContainer.classList.add('hidden');
        }

        if (result.lastUpdateTime) {
            const lastUpdateTime = new Date(result.lastUpdateTime).toLocaleString();
            lastUpdateTimeElement.textContent = `Last updated: ${lastUpdateTime}`;
        } else {
            lastUpdateTimeElement.textContent = 'Last updated: Never';
        }

        if (result.lastError) {
            lastErrorElement.textContent = `Error: ${result.lastError}`;
            lastErrorElement.classList.remove('hidden');
        } else {
            lastErrorElement.textContent = '';
            lastErrorElement.classList.add('hidden');
        }

        const pullRequests = result.pullRequests || [];
        if (pullRequests.length > 0) {
            displayPullRequests(pullRequests, pullRequestsList);
            updateExtensionBadge(pullRequests.length);
        } else {
            pullRequestsList.innerHTML = '<p>No pull requests found.</p>';
            updateExtensionBadge('');
        }
    });

    // Listen for changes to chrome.storage.local
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.lastError) {
            if (changes.lastError.newValue) {
                lastErrorElement.textContent = `Error: ${changes.lastError.newValue}`;
                lastErrorElement.classList.remove('hidden');
            } else {
                lastErrorElement.textContent = '';
                lastErrorElement.classList.add('hidden');
            }
        }

        if (namespace === 'local' && changes.lastUpdateTime) {
            const lastUpdateTime = new Date(changes.lastUpdateTime.newValue).toLocaleString();
            lastUpdateTimeElement.textContent = `Last updated: ${lastUpdateTime}`;
        }

        if (namespace === 'local' && changes.pullRequests) {
            const pullRequests = changes.pullRequests.newValue || [];
            if (pullRequests.length > 0) {
                displayPullRequests(pullRequests, pullRequestsList);
                updateExtensionBadge(pullRequests.length);
            } else {
                pullRequestsList.innerHTML = '<p>No pull requests found.</p>';
                updateExtensionBadge('');
            }
        }
    });

    appIconContainer.addEventListener('click', () => {
        chrome.storage.local.get(['githubUsername'], function (result) {
            const username = result.githubUsername;
            if (username) {
                window.open(`https://github.com/pulls/review-requested?page=1&q=is%3Aopen+is%3Apr+review-requested%3A${username}+archived%3Afalse`, '_blank');
            } else {
                window.open('https://github.com/pulls', '_blank');
            }
        });
    });

    loginButton.addEventListener('click', async () => {
        const token = tokenInput.value;
        const username = usernameInput.value;
        if (token && username) {
            chrome.storage.local.set({ githubToken: token, githubUsername: username }, function () {
                credentialsDiv.classList.add('hidden');
                headerSection.classList.add('hidden');
                iconContainer.classList.remove('hidden');
            });

            const pullRequests = await fetchAndFilterPullRequests(username, token);
            chrome.storage.local.set({ pullRequests }, function () {
                displayPullRequests(pullRequests, pullRequestsList);
                updateExtensionBadge(pullRequests.length);
            });
        } else {
            alert('Please enter both your username and token.');
        }
    });

    resetButton.addEventListener('click', async () => {
        await resetLocalStorage();
        alert('Credentials and data have been reset.');
    });

    refreshButton.addEventListener('click', async () => {
        try {
            const token = await getAuthToken();
            const username = await getUsername();
    
            if (token && username) {
                console.log('Refreshing pull requests...');
                const pullRequests = await fetchAndFilterPullRequests(username, token);
                chrome.storage.local.set({ pullRequests }, function () {
                    displayPullRequests(pullRequests, pullRequestsList);
                    updateExtensionBadge(pullRequests.length);
                });
            } else {
                throw('Please ensure you are logged in with valid credentials.');
            }
        } catch (error) {
            console.error('Error during refresh:', error);
            chrome.storage.local.set({ lastError: error.message });
        }
    });

    async function fetchAndFilterPullRequests(username, token) {
        const allPullRequests = [];
        try {
            const organizations = await fetchOrganizations(token);

            for (const org of organizations) {
                const repositories = await fetchRepositories(org.login, token);

                for (const repo of repositories) {
                    const pullRequests = await fetchPullRequests(org.login, repo.name, token);
                    const userRequestedPRs = filterPullRequestsByReviewer(pullRequests, username);
                    allPullRequests.push(...userRequestedPRs);
                }
            }
        } catch (error) {
            chrome.storage.local.set({ lastError: error.message });
            updateExtensionBadge('?');
        }

        return allPullRequests;
    }
});