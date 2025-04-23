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
            // Username exists: hide login form and header, show refresh and trashcan icons
            credentialsDiv.classList.add('hidden');
            headerSection.classList.add('hidden');
            iconContainer.classList.remove('hidden');
        } else {
            // Username does not exist: show login form and header, hide refresh and trashcan icons
            credentialsDiv.classList.remove('hidden');
            headerSection.classList.remove('hidden');
            iconContainer.classList.add('hidden');
        }

        // Display the last update time
        if (result.lastUpdateTime) {
            const lastUpdateTime = new Date(result.lastUpdateTime).toLocaleString();
            lastUpdateTimeElement.textContent = `Last updated: ${lastUpdateTime}`;
        } else {
            lastUpdateTimeElement.textContent = 'Last updated: Never';
        }

        // Display the last error
        if (result.lastError) {
            lastErrorElement.textContent = `Error: ${result.lastError}`;
            lastErrorElement.classList.remove('hidden');
        } else {
            lastErrorElement.textContent = '';
            lastErrorElement.classList.add('hidden');
        }

        // Display the pull requests if they exist
        const pullRequests = result.pullRequests || [];
        if (pullRequests.length > 0) {
            displayPullRequests(pullRequests);
            updateExtensionBadge(pullRequests.length); // Update the badge with the number of PRs
        } else {
            if(username) {
                pullRequestsList.innerHTML = '<p>No pull requests found.</p>';
            }
            updateExtensionBadge(''); // Clear the badge if no PRs
        }
    });

    // Listen for changes to chrome.storage.local
    chrome.storage.onChanged.addListener((changes, namespace) => {
        // Check if the changes are in the local storage for any errors
        if (namespace === 'local' && changes.lastError) {
            if (changes.lastError.newValue) {
                lastErrorElement.textContent = `Error: ${changes.lastError.newValue}`;
                lastErrorElement.classList.remove('hidden');
            } else {
                lastErrorElement.textContent = '';
                lastErrorElement.classList.add('hidden');
            }
        }

        // Check if the changes are in the local storage for last update time
        if (namespace === 'local' && changes.lastUpdateTime) {
            const lastUpdateTime = new Date(changes.lastUpdateTime.newValue).toLocaleString();
            lastUpdateTimeElement.textContent = `Last updated: ${lastUpdateTime}`;
        }

        // Check if the changes are in the local storage for pull requests
        if (namespace === 'local' && changes.pullRequests) {
            const pullRequests = changes.pullRequests.newValue || [];
            if (pullRequests.length > 0) {
                displayPullRequests(pullRequests);
                updateExtensionBadge(pullRequests.length); // Update the badge with the number of PRs
            } else {
                pullRequestsList.innerHTML = '<p>No pull requests found.</p>';
                updateExtensionBadge(''); // Clear the badge if no PRs
            }
        }
    });

    // Add click event listener to the app icon
    appIconContainer.addEventListener('click', () => {
        chrome.storage.local.get(['githubUsername'], function(result) {
            const username = result.githubUsername;
            if (username) {
                // Redirect to the review-requested page with the username
                window.open(`https://github.com/pulls/review-requested?page=1&q=is%3Aopen+is%3Apr+review-requested%3A${username}+archived%3Afalse`, '_blank');
            } else {
                // Redirect to GitHub homepage
                window.open('https://github.com/pulls', '_blank');
            }
        });
    });

    loginButton.addEventListener('click', async () => {
        const token = tokenInput.value;
        const username = usernameInput.value;
        if (token && username) {
            chrome.storage.local.set({ githubToken: token, githubUsername: username }, function () {
                credentialsDiv.classList.add('hidden'); // Hide credentials after login
                headerSection.classList.add('hidden'); // Hide header after login
                iconContainer.classList.remove('hidden');
            });

            const pullRequests = await fetchPullRequests(username, token);
            chrome.storage.local.set({ pullRequests }, function () {
                displayPullRequests(pullRequests);
                updateExtensionBadge(pullRequests.length); // Update the badge with the number of PRs
            });
        } else {
            alert('Please enter both your username and token.');
        }
    });

    resetButton.addEventListener('click', () => {
        resetLocalStorage();
        alert('Credentials and data have been reset.');    
    });

    async function resetLocalStorage(){
        chrome.storage.local.remove(['githubToken', 'githubUsername', 'pullRequests', 'lastError', 'lastUpdateTime'], function () {
            usernameInput.value = '';
            tokenInput.value = '';
            pullRequestsList.innerHTML = '';
            credentialsDiv.classList.remove('hidden'); // Show credentials after reset
            headerSection.classList.remove('hidden'); // Show header after reset
            iconContainer.classList.add('hidden');
            lastErrorElement.textContent = '';
            lastErrorElement.classList.add('hidden');
            lastUpdateTimeElement.textContent = '';

            updateExtensionBadge(0); // Clear the badge
        });
    }

    async function fetchPullRequests(username, token) {
        const allPullRequests = [];
        try {
            const orgsURL = `https://api.github.com/user/orgs?per_page=100&page=1`;
            const orgsResponse = await fetch(orgsURL, {
                headers: {
                    Authorization: `token ${token}`,
                },
            });

            // Check if the username and token were valid
            if (orgsResponse.status === 401) {
                throw new Error('Unauthorized: Invalid GitHub token');
            }

            const orgs = await orgsResponse.json();
            for (const org of orgs) {
                const reposURL = `https://api.github.com/orgs/${org.login}/repos?type=all&per_page=100&page=1`;
                const reposResponse = await fetch(reposURL, {
                    headers: {
                        Authorization: `token ${token}`,
                    },
                });
                const repos = await reposResponse.json();

                for (const repo of repos) {
                    const prsURL = `https://api.github.com/repos/${org.login}/${repo.name}/pulls?state=open&per_page=100&page=1`;
                    const prsResponse = await fetch(prsURL, {
                        headers: {
                            Authorization: `token ${token}`,
                        },
                    });
                    const pullRequests = await prsResponse.json();

                    // Filter pull requests where the user is in the requested_reviewers list
                    const userRequestedPRs = pullRequests.filter((pr) =>
                        pr.requested_reviewers.some((reviewer) => reviewer.login === username)
                    );

                    allPullRequests.push(...userRequestedPRs);
                }
            }
        } catch (error) {
            chrome.storage.local.set({ lastError: error.message }); // Store the error message
            updateExtensionBadge("?"); // Clear the badge if an error occurs
        }

        return allPullRequests;
    }

    function displayPullRequests(pullRequests) {
        pullRequestsList.innerHTML = ''; // Clear the list

        pullRequests.forEach((pr) => {
            // Create the card container
            const card = document.createElement('div');
            card.className = 'pr-card';
            card.onclick = () => {
                window.open(pr.html_url, '_blank'); // Open PR in a new tab
            };

            // Add the highbrow (repo name)
            const highbrow = document.createElement('div');
            highbrow.className = 'pr-highbrow';
            highbrow.textContent = pr.base.repo.full_name; // Repository name
            card.appendChild(highbrow);

            // Add the title (PR title)
            const title = document.createElement('div');
            title.className = 'pr-title';
            title.textContent = pr.title; // Pull request title
            card.appendChild(title);

            // Add the subtitle (PR author/owner)
            const subtitle = document.createElement('div');
            subtitle.className = 'pr-subtitle';
            subtitle.textContent = `Author: ${pr.user.login}`; // PR author
            card.appendChild(subtitle);

            // Add the footnote (datetime of review request)
            const footnote = document.createElement('div');
            footnote.className = 'pr-footnote';
            const updatedAt = new Date(pr.updated_at).toLocaleString(); // Format datetime
            const requestedAt = new Date(pr.created_at).toLocaleString(); // Format datetime
            // footnote.textContent = `Updated: ${requestedAt}`;

            // create updatedAt time
            // create createdAt time
            // append both divs to pr-footnote
            const updatedDiv = document.createElement('div');
            updatedDiv.className = 'pr-footnote';
            updatedDiv.textContent = `Updated: ${updatedAt}`;
            footnote.appendChild(updatedDiv);
            const requestedDiv = document.createElement('div');
            requestedDiv.className = 'pr-footnote';
            requestedDiv.textContent = `Created: ${requestedAt}`;
            footnote.appendChild(requestedDiv);

            card.appendChild(footnote);

            // Append the card to the list
            pullRequestsList.appendChild(card);
        });
    }

    function updateExtensionBadge(count) {
        console.log('Updating badge with count:', count);
        chrome.action.setBadgeText({ text: count.toString() }); // Set the badge text
        chrome.action.setBadgeBackgroundColor({ color: '#FF8469' }); // Set the badge color (red)
    }
});