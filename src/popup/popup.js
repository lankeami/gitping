import { getAuthToken, getUsername, updateExtensionBadge, resetLocalStorage, getLastUpdateTime, getLastError } from '../shared/storageUtils.js';
import { fetchAndFilterPullRequests } from '../shared/githubApi.js';
import { displayPullRequests, resetUI, displayItemComments } from '../shared/uiUtils.js';


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

    // Tab elements
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    // Tab content elements
    const personalPullRequestsList = document.getElementById('personal-pull-requests-list');
    const teamPullRequestsList = document.getElementById('team-pull-requests-list');
    const mentionsPullRequestsList = document.getElementById('mentions-pull-requests-list');
    const minePullRequestsList = document.getElementById('mine-pull-requests-list');

    /**
     * Handles tab switching by hiding all tab content and activating the selected tab.
     * @param {string} tabId - The ID of the tab to activate.
     */
    function switchTab(tabId) {
        // Deactivate all tabs and hide all tab content
        tabs.forEach((tab) => tab.classList.remove('active'));
        tabContents.forEach((content) => {
            content.classList.remove('active')
            content.classList.add('hidden');
        });

        // Activate the selected tab and its corresponding content
        const selectedTab = document.getElementById(`${tabId}-tab`);
        const selectedContent = document.getElementById(`${tabId}-content`);

        if (selectedTab && selectedContent) {
            selectedTab.classList.add('active');
            selectedContent.classList.add('active');
            selectedContent.classList.remove('hidden');
        }
    }

    // Add event listeners to tabs
    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            const tabId = tab.id.replace('-tab', ''); // Extract the tab ID (e.g., "personal", "team", "mentions")
            switchTab(tabId);
        });
    });

    // Fetch and display pull requests
    async function updateDisplays() {
        const token = await getAuthToken();
        const username = await getUsername();
        const lastUpdateTime = await getLastUpdateTime();

        if (token && username) {
            const pullRequests = await fetchAndFilterPullRequests(username, token, lastUpdateTime);
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

            // Display mentions pull requests (if applicable)
            const mentionsPullRequests = pullRequests.mentions || [];
            chrome.storage.local.set({ mentionsPullRequests }, function () {
                displayItemComments(mentionsPullRequests, mentionsPullRequestsList);
            });

            // Display mine pull requests (if applicable)
            const minePullRequests = pullRequests.mine || [];
            chrome.storage.local.set({ minePullRequests }, function () {
                displayPullRequests(minePullRequests, minePullRequestsList);
            });
        } else {
            console.error('Error:', error);
            chrome.storage.local.set({ lastError: error.message });
        }
    }

    async function showPopup() {
        console.log('showPopup called');
        credentialsDiv.classList.add('hidden');
        headerSection.classList.add('hidden');
        iconContainer.classList.remove('hidden');
        popupContainer.classList.remove('hidden');

        const lastUpdateTime = await getLastUpdateTime();
        const lastError = await getLastError();

        if (lastUpdateTime) {
            lastUpdateTimeElement.textContent = `Last updated: ${lastUpdateTime}`;
        } else {
            lastUpdateTimeElement.textContent = '';
        }

        if (lastError) {
            lastErrorElement.textContent = `Error: ${lastError}`;
            lastErrorElement.classList.remove('hidden');
        } else {
            lastErrorElement.textContent = '';
            lastErrorElement.classList.add('hidden');
        }

        switchTab('personal'); // Set the default tab to "personal"
    }

    async function hidePopup() {
        credentialsDiv.classList.remove('hidden');
        headerSection.classList.remove('hidden');
        iconContainer.classList.add('hidden');
        popupContainer.classList.add('hidden');
        lastUpdateTimeElement.textContent = '';
        lastErrorElement.textContent = '';
        lastErrorElement.classList.add('hidden');
    }

    // Check if username is stored in local storage
    chrome.storage.local.get(['githubUsername', 'lastUpdateTime', 'lastError', 'personalPullRequests', 'teamPullRequests', 'mentionsPullRequests', 'minePullRequests'], async function (result) {
        const username = await getUsername();

        const teamPullRequests = result.teamPullRequests || [];
        displayPullRequests(teamPullRequests, teamPullRequestsList);

        const personalPullRequests = result.personalPullRequests || [];
        if (personalPullRequests.length > 0) {
            displayPullRequests(personalPullRequests, personalPullRequestsList);
            updateExtensionBadge(personalPullRequestsList.length);
        } else {
            console.log('No personal pull requests found.');
            if (username) {
                personalPullRequestsList.innerHTML = '<p>No pull requests found.</p>';
            } else {
                personalPullRequestsList.innerHTML = '';
            }
            updateExtensionBadge('');
        }

        const minePullRequests = result.minePullRequests || [];
        displayPullRequests(minePullRequests, minePullRequestsList);

        const mentionsPullRequests = result.mentionsPullRequests || [];
        displayItemComments(mentionsPullRequests, mentionsPullRequestsList);

        if (username) {
            await showPopup();
        } else {
            await hidePopup();
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
            displayPullRequests(pullRequests, personalPullRequestsList);

            if (pullRequests.length > 0) {
                updateExtensionBadge(pullRequests.length);
            } else {
                updateExtensionBadge('');
            }
        }

        // Did teamPullRequests change?
        if (namespace === 'local' && changes.teamPullRequests) {
            const pullRequests = changes.teamPullRequests.newValue || [];
            displayPullRequests(pullRequests, teamPullRequestsList);
        }

        // Did mentionsPullRequests change?
        if (namespace === 'local' && changes.mentionsPullRequests) {
            const pullRequests = changes.mentionsPullRequests.newValue || [];
            displayItemComments(pullRequests, mentionsPullRequestsList);
        }

        // Did minePullRequests change?
        if (namespace === 'local' && changes.minePullRequests) {
            const pullRequests = changes.minePullRequests.newValue || [];
            displayPullRequests(pullRequests, minePullRequestsList);
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