import { getAuthToken, getUsername, resetLocalStorage, getLastUpdateTime, getLastError, setLastError, updateExtensionBadge, setLastUpdateTime, getFirstUpdateTime, setLastViewedTime, getLastViewedTime, addToWatchList, getGitHubApiBaseUrl } from '../shared/storageUtils.js';
import { fetchAndFilterPullRequests } from '../shared/githubApi.js';
import { displayPullRequests, resetUI, displayBadgeCount } from '../shared/uiUtils.js';

async function addWatchListUrl() {
    console.log('Adding watch list URL');
    const addWatchInput = document.getElementById('add-watched-input');

    if (!addWatchInput) {
        setLastError('Add watch input element not found');
        return;
    }

    const watchInput = addWatchInput.value.trim();

    // validate the input
    if (!watchInput) {
        return;
    }

    const urlParts = watchInput.replace(/https?:\/\//, '').split('/');

    // first part of the path should be the organization name
    // second part of the path should be the repo name
    // the third part of the path should be the type of request (pull, issue)
    // the fourth part of the path should be the id of the request
    if (urlParts.length < 5) {
        setLastError(`Invalid URL format. \nExpected format like: https://github.com/<org>/<repo>/<type>/<id>`);
        return;
    }

    if (watchInput) {
        try {
            const token = await getAuthToken();
            const username = await getUsername();
            if (token && username) {
                // Add the watch to the user's GitHub account
                // This is a placeholder for the actual implementation
                console.log(`Adding watch for: ${watchInput}`);
                addToWatchList(watchInput, token, username);
                addWatchInput.value = ''; // Clear the input field
                // NOTE: we can't fetch GitHub APIs in the main thread, it leads to CORS issues
                // so we use a background script to run in the service worker   

                // add a toast indicating addition was a success
                const toast = document.getElementById('toast');
                if (toast) {
                    console.log('Showing toast for watch addition');
                    // toast text should be two lines
                    toast.style.whiteSpace = 'pre-line'; // Allow line breaks in the toast text
                    toast.textContent = `Added ${watchInput} to watch list.\n It may appear in the next update.`;
                    toast.classList.remove('hidden');
                    toast.classList.add('show');
                    setTimeout(() => {
                        toast.classList.remove('show');
                        toast.classList.add('hidden');
                        chrome.alarms.create('popupCheckForUpdates',{delayInMinutes: 0});
                    }, 3000);
                }
            }
        } catch (error) {
            setLastError(error.message);
        }
    } else {
        console.warn('No input provided for watch list');
    }
    addWatchInput.value = ''; // Clear the input field

}

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
    const settingsButton = document.getElementById('settings-button');
    const addWatchButton = document.getElementById('add-watched-btn');


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
        const lastViewedTime = await getLastViewedTime();

        var pullRequests = null;

        if (token && username) {
            if (overridePRs) {
                pullRequests = overridePRs;
                if(!getFirstUpdateTime()) {
                    return;
                }
            } else {
                lastUpdateTimeElement.textContent = "Fetching latest pull requests.";
                
                // NOTE: we can't fetch GitHub APIs in the main thread, it leads to CORS issues
                // so we use a background script to run in the service worker
                chrome.alarms.create('popupCheckForUpdates',{delayInMinutes: 0});
                return;
            }

            // TODO: hard coded Tab names / stored pull requests -- make them configurable
            const config = {
                personal: pullRequests.personalPullRequests || pullRequests.personal,
                mine: pullRequests.minePullRequests         || pullRequests.mine,
                team: pullRequests.teamPullRequests         || pullRequests.team,
                mention: pullRequests.mentionsPullRequests  || pullRequests.mentions,
                issues: pullRequests.issuesPullRequests     || pullRequests.issues,
                watched: pullRequests.watchedPullRequests   || pullRequests.watched
            }

            // set all displays
            Object.keys(config).forEach(element => {
                var pullRequests = config[element];
                var listElement = document.getElementById(`${element}-pull-requests-list`);
                if (listElement) {
                    chrome.storage.local.set({ [`${element}PullRequests`]: pullRequests }, async function () {
                        await displayPullRequests(pullRequests, listElement, lastViewedTime, element);
                        displayBadgeCount(element, pullRequests);
                    });
                }
            });

            setLastUpdateTime();
            setLastError();
        } else {
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
        chrome.storage.local.get(['githubUsername', 'lastUpdateTime', 'lastError', 'minePullRequests', 'personalPullRequests', 'teamPullRequests', 'mentionsPullRequests', 'issuesPullRequests', 'watchedPullRequests'], async function (result) {
            const username = result.githubUsername
            const firstUpdateTime = await getFirstUpdateTime();

            if (username) {
                if(firstUpdateTime) {
                    updateDisplays(result);
                }
                await showPopup();
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
            updateDisplaysFromStorage();
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

                await updateDisplays();
            } else {
                alert('Please enter both your username and token.');
            }
        } catch (error) {
            setLastError(error.message);
        }
    });

    try {
        addWatchButton.addEventListener('click', async() => {
            console.log('Add watch button clicked');
            await addWatchListUrl();
        });
    } catch (error) {
    }


    resetButton.addEventListener('click', async () => {
        await resetLocalStorage();
        resetUI();
        alert('Credentials and data have been reset.');
    });

    refreshButton.addEventListener('click', async () => {
        setLastError();
        updateDisplays();
    });

    settingsButton.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // Add event listeners to tabs
    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            const tabId = tab.id.replace('-tab', ''); // Extract the tab ID (e.g., "personal", "team", "mentions")
            switchTab(tabId);
        });
    });

    // Call setLastViewedTime when the popup becomes hidden
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            setLastViewedTime();
        }
    });

    updateDisplaysFromStorage();
});