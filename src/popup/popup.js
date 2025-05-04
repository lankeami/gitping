import { getAuthToken, getUsername, resetLocalStorage, getLastUpdateTime, getLastError, setLastError, updateExtensionBadge, setLastUpdateTime } from '../shared/storageUtils.js';
import { fetchAndFilterPullRequests } from '../shared/githubApi.js';
import { displayPullRequests, resetUI, displayItemComments, displayBadgeCount } from '../shared/uiUtils.js';


document.addEventListener('DOMContentLoaded', function () {
    const loginButton = document.getElementById('login-button');
    const refreshButton = document.getElementById('refresh-button');
    const resetButton = document.getElementById('reset-button');
    const usernameInput = document.getElementById('username');
    const apiBaseUrlInput = document.getElementById('api-base-url');
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
            selectedContent.classList = ["tab-content", "active"];
        }
    }

    /**
     * Fetch and display all pull requests
     * @param {object} overridePRs 
     */
    async function updateDisplays(overridePRs=null) {
        const token = await getAuthToken();
        const username = await getUsername();
        const lastUpdateTime = await getLastUpdateTime();
        var pullRequests = null;

        if (token && username) {
            if (overridePRs) {
                pullRequests = overridePRs;
            } else {
                pullRequests = await fetchAndFilterPullRequests(username, token, lastUpdateTime);
            }

            // TODO: hard coded Tab names / stored pull requests -- make them configurable
            const config = {
                personal: pullRequests.personalPullRequests || pullRequests.personal,
                team: pullRequests.teamPullRequests         || pullRequests.team,
                mention: pullRequests.mentionsPullRequests  || pullRequests.mentions,
                mine: pullRequests.minePullRequests         || pullRequests.mine,
            }

            // set all displays
            Object.keys(config).forEach(element => {
                var pullRequests = config[element];
                var listElement = document.getElementById(`${element}-pull-requests-list`);
                if (listElement) {
                    chrome.storage.local.set({ [`${element}PullRequests`]: pullRequests }, function () {
                        // use displayItemComments on the mentions tab
                        if (element === "mention") {
                            displayItemComments(pullRequests, listElement);
                        } else {
                            displayPullRequests(pullRequests, listElement);
                        }
                        displayBadgeCount(element, pullRequests);
                    });
                }
            });

            setLastUpdateTime();
            setLastError();
        } else {
            console.error('Error:', error);
            setLastError(error.message);
        }
    }

    async function showPopup() {
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

    function updateDisplaysFromStorage() {
        // Check if username is stored in local storage
        // TODO: hard coded Tab names / stored pull requests -- make them configurable
        chrome.storage.local.get(['githubUsername', 'lastUpdateTime', 'lastError', 'personalPullRequests', 'teamPullRequests', 'mentionsPullRequests', 'minePullRequests'], async function (result) {
            const username = await getUsername();

            if (username) {
                await showPopup();
                updateDisplays(result);
                updateExtensionBadge(0);
            } else {
                await hidePopup();
            }
        });
    }

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

        updateDisplaysFromStorage();
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
        try {
            const token = tokenInput.value;
            const username = usernameInput.value;
            const apiBaseUrl = apiBaseUrlInput.value;
            if (token && username && apiBaseUrl) {
                chrome.storage.local.set({ githubToken: token, githubUsername: username, githubApiBaseUrl: apiBaseUrl }, function () {
                    credentialsDiv.classList.add('hidden');
                    headerSection.classList.add('hidden');
                    iconContainer.classList.remove('hidden');
                });
                
                lastUpdateTimeElement.textContent = "Fetching latest pull requests.";
    
                updateDisplays()
            } else {
                alert('Please enter both your username and token.');
            }
        } catch (error) {
            console.error('Error:', error);
            setLastError(error.message);
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

    // Add event listeners to tabs
    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            const tabId = tab.id.replace('-tab', ''); // Extract the tab ID (e.g., "personal", "team", "mentions")
            switchTab(tabId);
        });
    });

    updateDisplaysFromStorage();
});