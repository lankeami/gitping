import { getAvatarUrl, setAvatarUrl } from './storageUtils.js';

//
//
// INTERNAL HELPER FUNCTIONS
//
//

async function cardUser(user) {
    const subtitle = document.createElement('div');
    subtitle.className = 'pr-subtitle';

    // Create the avatar image
    const avatarImg = await avatarForUser(user);

    if (!avatarImg) {
        return null;
    }

    // Create the username span
    const usernameSpan = document.createElement('span');
    usernameSpan.textContent = user.login;

    // Append avatar and username to subtitle
    subtitle.appendChild(avatarImg);
    subtitle.appendChild(usernameSpan);
    return subtitle;
}

async function avatarForUser(user) {
    // check storageUtils for user avatar url first
    // iff it doesn't exist, pull from the user object and save it for a day
    // then build the avatar image element

    let avatarUrl = await getAvatarUrl(user.login);
    if (!avatarUrl) {
        // If avatar URL is not found in storage, use the user object
        avatarUrl = user.avatar_url;
        if(avatarUrl) {
            setAvatarUrl(user.login, avatarUrl);
        } else {
            return null;
        }
    }

    const avatarImg = document.createElement('img');
    avatarImg.src = avatarUrl;
    avatarImg.alt = user.login;
    avatarImg.style.width = '24px';
    avatarImg.style.height = '24px';
    avatarImg.style.borderRadius = '50%';
    avatarImg.style.verticalAlign = 'middle';
    avatarImg.style.marginRight = '8px';
    return avatarImg;
}

//
//
// EXPORTED UI HELPER FUNCTIONS
//
//


/**
 * Display the list of pull requests in the popup.
 * @param {Array} pullRequests - List of pull requests to display.
 * @param {HTMLElement} pullRequestsList - The DOM element to render the pull requests into.
 */
export async function displayPullRequests(pullRequests, pullRequestsList, lastViewedTime=null) {
    // Hide all tab content
    const allTabContents = document.querySelectorAll('.tab-content');
    allTabContents.forEach((content) => {
        content.classList.add('hidden');
    });

    // Show the tab content associated with the pullRequestsList
    const parentTabContent = pullRequestsList.closest('.tab-content');
    if (parentTabContent) {
        parentTabContent.classList.remove('hidden');
    }

    if (!Array.isArray(pullRequests)) {
        console.log('Invalid pull requests data:', pullRequests);
        pullRequestsList.innerHTML = '<div class="no-pull-requests">No pull requests found.</div>';
        return;
    }

    if (pullRequests.length === 0) {
        console.log('No pull requests found.');
        pullRequestsList.innerHTML = '<div class="no-pull-requests">No pull requests found.</div>';
        return;
    }

    pullRequestsList.innerHTML = '';

    // sort pull requests by updated_at date in descending order
    pullRequests.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    // Create a card for each pull request
    // and append it to the pull requests list
    pullRequests.forEach(async (pr) => {
        const card = document.createElement('div');
        card.className = 'pr-card';
        card.onclick = () => {
            window.open(pr.html_url, '_blank');
        };

        const highbrow = document.createElement('div');
        highbrow.className = 'pr-highbrow';
        highbrow.textContent = pr.base.repo.full_name;
        if (pr.base.repo.owner) {
            const ownerAvatar = await avatarForUser(pr.base.repo.owner);
            if(ownerAvatar) {
                ownerAvatar.style.float = 'right';
                ownerAvatar.style.marginLeft = '8px';
                highbrow.appendChild(ownerAvatar);
            } else {
                console.log("No avatar found for owner:", pr.base.repo.owner);
            }
        } else {
            console.log("No owner found for repository:", pr.base.repo);
        }
        card.appendChild(highbrow);

        const title = document.createElement('div');
        title.className = 'pr-title';
        title.textContent = pr.title;

        // --- Add PR status badge ---
        const statusBadge = document.createElement('span');
        statusBadge.className = 'pr-status-badge';
        if (pr.draft) {
            statusBadge.textContent = 'Draft';
            statusBadge.style.backgroundColor = '#6c757d';
        } else if (pr.state === 'open') {
            statusBadge.textContent = 'Open';
            statusBadge.style.backgroundColor = '#28a745';
        } else if (pr.state === 'closed' && pr.merged_at) {
            statusBadge.textContent = 'Merged';
            statusBadge.style.backgroundColor = '#6f42c1';
        } else if (pr.state === 'closed') {
            statusBadge.textContent = 'Closed';
            statusBadge.style.backgroundColor = '#d73a49';
        } else {
            statusBadge.textContent = pr.state;
            statusBadge.style.backgroundColor = '#cccccc';
        }
        statusBadge.style.color = '#fff';
        statusBadge.style.padding = '2px 8px';
        statusBadge.style.borderRadius = '12px';
        statusBadge.style.fontSize = '12px';
        statusBadge.style.marginLeft = '8px';
        statusBadge.style.verticalAlign = 'middle';

        title.appendChild(statusBadge);
        card.appendChild(title);

        const subtitle = await cardUser(pr.user);
        card.appendChild(subtitle);

        const footnote = document.createElement('div');
        footnote.className = 'pr-footnote';
        const updatedAt = new Date(pr.updated_at).toLocaleString();
        const requestedAt = new Date(pr.created_at).toLocaleString();

        const updatedDiv = document.createElement('div');
        updatedDiv.className = 'pr-footnote';
        updatedDiv.textContent = `Updated: ${updatedAt}`;
        footnote.appendChild(updatedDiv);

        // Highlight the updatedAt text if it is greater than lastViewedTime
        if (lastViewedTime && new Date(pr.updated_at) > new Date(lastViewedTime)) {
            updatedDiv.classList.add('highlight-updated');
        }

        const requestedDiv = document.createElement('div');
        requestedDiv.className = 'pr-footnote';
        requestedDiv.textContent = `Created: ${requestedAt}`;
        footnote.appendChild(requestedDiv);

        card.appendChild(footnote);
        pullRequestsList.appendChild(card);
    });
}

/**
 * Resets the UI by hiding the popup container, clearing the last update time and error,
 * and showing the credentials section.
 */
export function resetUI() {
    // Hide the popup container
    const popupContainer = document.getElementById('popup-container');
    if (popupContainer) {
        popupContainer.classList.add('hidden');
    }

    // Clear the last update time
    const lastUpdateTime = document.getElementById('last-update-time');
    if (lastUpdateTime) {
        lastUpdateTime.textContent = '';
    }

    // Clear the last error
    const lastError = document.getElementById('last-error');
    if (lastError) {
        lastError.textContent = '';
        lastError.classList.add('hidden');
    }

    // Show the credentials section
    const credentialsSection = document.getElementById('credentials');
    if (credentialsSection) {
        credentialsSection.classList.remove('hidden');
    }

    // Purge local storage
    chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
            console.error('Error clearing local storage:', chrome.runtime.lastError);
        } else {
            console.log('Local storage cleared successfully.');
        }
    });

    // Clear all tab-badges
    const allBadges = document.querySelectorAll('.tab-badge');
    allBadges.forEach((badge) => {
        badge.textContent = '';
        badge.classList.add('hidden');
    });

    // Clear all pul-request-lists
    const allPullRequestLists = document.querySelectorAll('.pull-requests-list');
    allPullRequestLists.forEach((list) => {
        if (list.id === 'mentions-pull-requests-list') {
            list.innerHTML = '<div class="no-pull-requests">No mentions found.</div>';
        } else {
            list.innerHTML = '<div class="no-pull-requests">No pull requests found.</div>';
        }
    });

    // Clear all mentions-lists
    const allMentionsLists = document.querySelectorAll('.mentions-list');
    allMentionsLists.forEach((list) => {
        list.innerHTML = '<div class="no-pull-requests">No mentions found.</div>';
    });
}

/**
 * Display the badge count on a tab for the number of pull requests
 * @param {string} prefix - tab prefix
 * @param {Array} pullRequests - List of pull requests to display.
 * @param {Date} lastViewedTime - The last time this tab was viewed.
 */
export function displayBadgeCount(prefix, pullRequests, lastViewedTime=null) {
    // Check if pullRequests is an array
    if (!Array.isArray(pullRequests)) {
        return;
    }
    const pullRequestCount = pullRequests.length;
    const badgeText = pullRequestCount > 0 ? pullRequestCount : '';

    // Find the badge element and update the text
    const badgeElement = document.getElementById(`${prefix}-badge`);
    if (badgeElement) {
        badgeElement.textContent = badgeText;
    }

    if (badgeText === '') {
        badgeElement.classList.add('hidden');
    } else {
        badgeElement.classList.remove('hidden');
    }

    // TODO: Compare the count of pullRequests that occurred after lastViewedTime
    // and update the badge accordingly
}