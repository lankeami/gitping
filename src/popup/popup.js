import { getAuthToken, getUsername, updateExtensionBadge, resetLocalStorage } from '../shared/storageUtils.js';
import { fetchAndFilterPullRequests } from '../shared/githubApi.js';
import { displayPullRequests, resetUI } from '../shared/uiUtils.js';


document.addEventListener('DOMContentLoaded', function () {
    const loginButton = document.getElementById('login-button');
    const refreshButton = document.getElementById('refresh-button');
    const resetButton = document.getElementById('reset-button');
    const usernameInput = document.getElementById('username');
    const tokenInput = document.getElementById('token');
    const credentialsDiv = document.getElementById('credentials');
    const headerSection = document.getElementById('header-section');
    const lastUpdateTimeElement = document.getElementById('last-update-time');
    const lastErrorElement = document.getElementById('last-error');
    const iconContainer = document.getElementById('icon-container');
    const appIconContainer = document.getElementById('app-icon-container');
    const popupContainer = document.getElementById('popup-container');

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
            const personalPullRequests = pullRequests.personal;
            const teamPullRequests = pullRequests.teams;

            // Display personal pull requests
            chrome.storage.local.set({ personalPullRequests }, function () {
                displayPullRequests(personalPullRequests, personalPullRequestsList);
                updateExtensionBadge(personalPullRequests.length);
            });

            // Display team pull requests
            chrome.storage.local.set({ teamPullRequests }, function () {
                displayPullRequests(teamPullRequests, teamPullRequestsList);
            });
        } else {
            console.error('Error:', error);
            chrome.storage.local.set({ lastError: error.message });
        }
    }

    // Check if username is stored in local storage
    chrome.storage.local.get(['githubUsername', 'lastUpdateTime', 'lastError', 'personalPullRequests', 'teamPullRequests'], async function (result) {
        const username = await getUsername();

        if (username) {
            credentialsDiv.classList.add('hidden');
            headerSection.classList.add('hidden');
            iconContainer.classList.remove('hidden');
            popupContainer.classList.remove('hidden');
        } else {
            credentialsDiv.classList.remove('hidden');
            headerSection.classList.remove('hidden');
            iconContainer.classList.add('hidden');
            popupContainer.classList.add('hidden');
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

        const teamPullRequests = result.teamPullRequests || [];
        if (teamPullRequests.length > 0) {
            displayPullRequests(teamPullRequests, teamPullRequestsList);
        }

        const personalPullRequests = result.personalPullRequests || [];
        if (personalPullRequests.length > 0) {
            displayPullRequests(personalPullRequests, personalPullRequestsList);
            updateExtensionBadge(personalPullRequestsList.length);
        } else {
            console.log('No personal pull requests found.');
            if (username) {
                console.log('No personal pull requests found for user:', username);
                personalPullRequestsList.innerHTML = '<p>No pull requests found.</p>';
            } else {
                console.log('No personal pull requests found and no username provided.');
                personalPullRequestsList.innerHTML = '';
            }
            updateExtensionBadge('');
        }
    });

    // Listen for changes to chrome.storage.local
    chrome.storage.onChanged.addListener((changes, namespace) => {
        // Did lastError change?
        if (namespace === 'local' && changes.lastError) {
            if (changes.lastError.newValue) {
                lastErrorElement.textContent = `Error: ${changes.lastError.newValue}`;
                lastErrorElement.classList.remove('hidden');
            } else {
                lastErrorElement.textContent = '';
                lastErrorElement.classList.add('hidden');
            }
        }

        // Did lastUpdateTime change?
        if (namespace === 'local' && changes.lastUpdateTime) {
            const lastUpdateTime = new Date(changes.lastUpdateTime.newValue).toLocaleString();
            lastUpdateTimeElement.textContent = `Last updated: ${lastUpdateTime}`;
        }

        // Did personalPullRequests change?
        if (namespace === 'local' && changes.personalPullRequests) {
            const pullRequests = changes.personalPullRequests.newValue || [];
            if (pullRequests.length > 0) {
                displayPullRequests(pullRequests, personalPullRequestsList);
                updateExtensionBadge(pullRequests.length);
            } else {
                personalPullRequestsList.innerHTML = '<p>No pull requests found.</p>';
                updateExtensionBadge('');
            }
        }

        // Did teamPullRequests change?
        if (namespace === 'local' && changes.teamPullRequests) {
            const pullRequests = changes.teamPullRequests.newValue || [];
            if (pullRequests.length > 0) {
                displayPullRequests(pullRequests, teamPullRequestsList);
            } else {
                teamPullRequestsList.innerHTML = '<p>No pull requests found.</p>';
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
            lastUpdateTimeElement.textContent = "Fetching latest pull requests.";

            updateDisplays()
        } else {
            alert('Please enter both your username and token.');
        }
    });

    resetButton.addEventListener('click', async () => {
        await resetLocalStorage();
        resetUI();
        alert('Credentials and data have been reset.');
    });

    refreshButton.addEventListener('click', async () => {
        lastUpdateTimeElement.textContent = "Fetching latest pull requests.";
        updateDisplays();
    });
});