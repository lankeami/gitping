import { fetchOrganizations, fetchRepositories, fetchPullRequests, filterPullRequestsByReviewer } from '../shared/githubApi.js';

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
    const iconContainer = document.getElementById('icon-container');
    const appIconContainer = document.getElementById('app-icon-container');
    const lastErrorElement = document.getElementById('last-error');

    // Check if username is stored in local storage
    chrome.storage.local.get(['githubUsername', 'lastUpdateTime', 'lastError', 'pullRequests'], function (result) {
        const username = result.githubUsername;

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
            displayPullRequests(pullRequests);
            updateExtensionBadge(pullRequests.length);
        } else {
            if (username) {
                pullRequestsList.innerHTML = '<p>No pull requests found.</p>';
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
                displayPullRequests(pullRequests);
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
                displayPullRequests(pullRequests);
                updateExtensionBadge(pullRequests.length);
            });
        } else {
            alert('Please enter both your username and token.');
        }
    });

    resetButton.addEventListener('click', () => {
        resetLocalStorage();
        alert('Credentials and data have been reset.');
    });

    async function resetLocalStorage() {
        chrome.storage.local.remove(['githubToken', 'githubUsername', 'pullRequests', 'lastError', 'lastUpdateTime'], function () {
            usernameInput.value = '';
            tokenInput.value = '';
            pullRequestsList.innerHTML = '';
            credentialsDiv.classList.remove('hidden');
            headerSection.classList.remove('hidden');
            iconContainer.classList.add('hidden');
            lastErrorElement.textContent = '';
            lastErrorElement.classList.add('hidden');
            lastUpdateTimeElement.textContent = '';

            updateExtensionBadge(0);
        });
    }

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

    function displayPullRequests(pullRequests) {
        pullRequestsList.innerHTML = '';

        pullRequests.forEach((pr) => {
            const card = document.createElement('div');
            card.className = 'pr-card';
            card.onclick = () => {
                window.open(pr.html_url, '_blank');
            };

            const highbrow = document.createElement('div');
            highbrow.className = 'pr-highbrow';
            highbrow.textContent = pr.base.repo.full_name;
            card.appendChild(highbrow);

            const title = document.createElement('div');
            title.className = 'pr-title';
            title.textContent = pr.title;
            card.appendChild(title);

            const subtitle = document.createElement('div');
            subtitle.className = 'pr-subtitle';
            subtitle.textContent = `Author: ${pr.user.login}`;
            card.appendChild(subtitle);

            const footnote = document.createElement('div');
            footnote.className = 'pr-footnote';
            const updatedAt = new Date(pr.updated_at).toLocaleString();
            const requestedAt = new Date(pr.created_at).toLocaleString();

            const updatedDiv = document.createElement('div');
            updatedDiv.className = 'pr-footnote';
            updatedDiv.textContent = `Updated: ${updatedAt}`;
            footnote.appendChild(updatedDiv);

            const requestedDiv = document.createElement('div');
            requestedDiv.className = 'pr-footnote';
            requestedDiv.textContent = `Created: ${requestedAt}`;
            footnote.appendChild(requestedDiv);

            card.appendChild(footnote);
            pullRequestsList.appendChild(card);
        });
    }

    function updateExtensionBadge(count) {
        console.log('Updating badge with count:', count);
        chrome.action.setBadgeText({ text: count.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#FF8469' });
    }
});