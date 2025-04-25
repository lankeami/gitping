import { getAuthToken, getUsername, updateExtensionBadge, resetLocalStorage } from '../shared/storageUtils.js';
import { fetchAndFilterPullRequests } from '../shared/githubApi.js';
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

    const personalTab = document.getElementById('personal-tab');
    const teamTab = document.getElementById('team-tab');
    const personalContent = document.getElementById('personal-content');
    const teamContent = document.getElementById('team-content');
    const personalPullRequestsList = document.getElementById('personal-pull-requests-list');
    const teamPullRequestsList = document.getElementById('team-pull-requests-list');

    // Tab switching logic
    personalTab.addEventListener('click', () => {
        personalTab.classList.add('active');
        teamTab.classList.remove('active');
        personalContent.classList.add('active');
        teamContent.classList.remove('active');
    });

    teamTab.addEventListener('click', () => {
        teamTab.classList.add('active');
        personalTab.classList.remove('active');
        teamContent.classList.add('active');
        personalContent.classList.remove('active');
    });

    // Fetch and display pull requests
    async function updateDisplays() {
        const token = await getAuthToken();
        const username = await getUsername();

        if (token && username) {
            const pullRequests = await fetchAndFilterPullRequests(username, token);
            const personalPRReviews = pullRequests.personal;
            const teamPRReviews = pullRequests.teams;

            // Display personal pull requests
            chrome.storage.local.set({ personalPRReviews }, function () {
                displayPullRequests(personalPRReviews, personalPullRequestsList);
                updateExtensionBadge(personalPRReviews.length);
            });

            // Display team pull requests
            chrome.storage.local.set({ teamPRReviews }, function () {
                displayPullRequests(teamPRReviews, teamPullRequestsList);
            });
        } else {
            console.error('Error:', error);
            chrome.storage.local.set({ lastError: error.message });
        }
    }

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
            lastUpdateTimeElement.textContent = '';
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
            displayPullRequests(pullRequests, teamPullRequestsList);
            updateExtensionBadge(teamPullRequestsList.length);
        } else {
            if (username) {
                teamPullRequestsList.innerHTML = '<p>No pull requests found.</p>';
            } else {
                teamPullRequestsList.innerHTML = '';
            }
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
                displayPullRequests(pullRequests, teamPullRequestsList);
                updateExtensionBadge(teamPullRequestsList.length);
            } else {
                teamPullRequestsList.innerHTML = '<p>No pull requests found.</p>';
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

            updateDisplays()
        } else {
            alert('Please enter both your username and token.');
        }
    });

    resetButton.addEventListener('click', async () => {
        await resetLocalStorage();
        alert('Credentials and data have been reset.');
    });

    refreshButton.addEventListener('click', async () => {
        updateDisplays()
    });
});