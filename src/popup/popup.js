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

    // Check if username is stored in local storage
    chrome.storage.local.get(['githubUsername', 'lastUpdateTime'], function (result) {
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
        chrome.storage.local.remove(['githubToken', 'githubUsername', 'pullRequests'], function () {
            usernameInput.value = '';
            tokenInput.value = '';
            pullRequestsList.innerHTML = '';
            credentialsDiv.classList.remove('hidden'); // Show credentials after reset
            headerSection.classList.remove('hidden'); // Show header after reset
            iconContainer.classList.add('hidden');

            updateExtensionBadge(0); // Clear the badge
            alert('Credentials and data have been reset.');
        });
    });

    async function fetchPullRequests(username, token) {
        const orgsURL = `https://api.github.com/user/orgs`;
        const orgsResponse = await fetch(orgsURL, {
            headers: {
                Authorization: `token ${token}`,
            },
        });
        const orgs = await orgsResponse.json();

        const allPullRequests = [];

        for (const org of orgs) {
            const reposURL = `https://api.github.com/orgs/${org.login}/repos`;
            const reposResponse = await fetch(reposURL, {
                headers: {
                    Authorization: `token ${token}`,
                },
            });
            const repos = await reposResponse.json();

            for (const repo of repos) {
                const prsURL = `https://api.github.com/repos/${org.login}/${repo.name}/pulls?state=open`;
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
            const requestedAt = new Date(pr.created_at).toLocaleString(); // Format datetime
            footnote.textContent = `Requested: ${requestedAt}`;
            card.appendChild(footnote);

            // Append the card to the list
            pullRequestsList.appendChild(card);
        });
    }

    function updateExtensionBadge(count) {
        if (count > 0) {
            chrome.action.setBadgeText({ text: count.toString() }); // Set the badge text
            chrome.action.setBadgeBackgroundColor({ color: '#FF0000' }); // Set the badge color (red)
        } else {
            chrome.action.setBadgeText({ text: '' }); // Clear the badge if no PRs
        }
    }
});