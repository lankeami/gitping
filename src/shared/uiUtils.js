import { getAvatarUrl, setAvatarUrl, removeFromWatchList, removeWatchedPullRequest, setLastUpdateTime } from './storageUtils.js';

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


/**
 * Creates a card element for a pull request
 * @param {Object} pr - The pull request object.
 * @returns {HTMLElement} - The card element.
 * 
 * Required Payload:
 * {
 *  type: string,
 *  id: string,
 *  title: string,
 *  html_url: string,
 *  user: {
 *     login: string,
 *    avatar_url: string
 * },
 *  owner: {
 *     login: string,
 *     avatar_url: string
 *  },
 *  updated_at: string,
 *  created_at: string,
 *  state: string,
 *  draft: boolean,
 *  repo_name: string
 * }
 */
async function createPullRequestCard(pr, section_name = null, lastViewedTime = null) {
    const card = document.createElement('div');
    card.className = 'pr-card';
    card.onclick = () => {
        window.open(pr.html_url, '_blank');
    };

    try {
        const highbrow = await cardHighbrow(pr);
        card.appendChild(highbrow);

        const title = cardTitle(pr);
        card.appendChild(title);

        const labels = cardLabels(pr);
        if (labels && labels.children.length > 0) {
            card.appendChild(labels);
        }

        const subtitle = await cardUser(pr.user);
        card.appendChild(subtitle);

        const footnote = cardFootnote(pr, section_name, lastViewedTime);
        card.appendChild(footnote);

    } catch (error) {
        console.error('Error creating pull request card:', error, pr);
        // If there's an error, we can still return the card with partial data
        card.innerHTML = `<div class="pr-error">Error creating card for PR: ${pr.title}</div>`;
    }

    return card;
}

function cardLabels(pr) {
    // --- Create the Labels Element ---
    const labels = document.createElement('div');
    labels.className = 'pr-labels';

    // --- Add Labels to the Element ---
    pr.labels.forEach(label => {
        const labelElement = document.createElement('span');
        labelElement.className = 'pr-label';
        labelElement.textContent = label.name;
        labelElement.style.backgroundColor = `#${label.color}`;
        // convert the background color to an RGB
        const color = label.color.toLowerCase();
        const luminance = hexToLuminance(color);
        if (luminance > 128) {
            labelElement.style.color = 'black';
        }
        labels.appendChild(labelElement);
    });

    return labels;
}

/**
 * converts a hex color to a luminance score
 * @param {string} hex - The hex color code (e.g., '#ff0000' or 'ff0000').
 * @returns {number} - The luminance score (0-255).
 */
function hexToLuminance(hex) {
    // Remove the '#' if present
    hex = hex.replace(/^#/, '');

    // Parse the r, g, b values
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate the luminance using the formula
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

async function cardHighbrow(pr) {
    // HIGHBROW
    const highbrow = document.createElement('div');
    highbrow.className = 'pr-highbrow';
    highbrow.textContent = pr.repo_name;
    const ownerAvatar = await avatarForUser(pr.owner);
    if(ownerAvatar) {
        ownerAvatar.style.float = 'right';
        ownerAvatar.style.marginLeft = '8px';
        highbrow.appendChild(ownerAvatar);
    } else {
        console.log("No avatar found for pr.base.repo.owner:", pr);
    }
    return highbrow;
}

function cardTitle(pr) {
    // --- Create the Ttile Element ---
    const title = document.createElement('div');
    title.className = 'pr-title';

    // --- Add PR/Issue icon to the left of the title ---
    if (pr && pr.type ) {
        const typeIcon = document.createElement('img');
        if (pr.type === 'pulls') {
            // It's a pull request
            typeIcon.src = '../popup/images/requests.png'; // Make sure this icon exists
            typeIcon.alt = 'Pull Request';
        } else if (pr.type === 'issues'){
            // It's an issue
            typeIcon.src = '../popup/images/issues.png'; // Make sure this icon exists
            typeIcon.alt = 'Issue';
        }
        typeIcon.width = 18;
        typeIcon.height = 18;
        typeIcon.style.verticalAlign = 'middle';
        typeIcon.style.marginRight = '6px';
        title.appendChild(typeIcon);
    }
    title.appendChild(document.createTextNode(pr.title));

    // --- Add PR status badge ---
    const statusBadge = document.createElement('span');
    statusBadge.className = 'pr-status-badge';
    if (pr.draft) {
        statusBadge.textContent = 'Draft';
        statusBadge.style.backgroundColor = '#6c757d';
    } else if (pr.state.toLowerCase() === 'open') {
        statusBadge.textContent = 'Open';
        statusBadge.style.backgroundColor = '#28a745';
    } else if (pr.state.toLowerCase() === 'closed' && pr.merged_at) {
        statusBadge.textContent = 'Merged';
        statusBadge.style.backgroundColor = '#6f42c1';
    } else if (pr.state.toLowerCase() === 'closed') {
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
    return title;
}

function cardFootnote(pr, section_name = null, lastViewedTime = null) {
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

    // --- Add Remove button if in watched list ---
    if (section_name === 'watched') {
        // Create a container for timestamps and remove button
        const footnoteRow = document.createElement('div');
        footnoteRow.style.display = 'flex';
        footnoteRow.style.alignItems = 'center';
        footnoteRow.style.justifyContent = 'space-between';

        // Left: timestamps
        const timestampsDiv = document.createElement('div');
        timestampsDiv.appendChild(updatedDiv);
        timestampsDiv.appendChild(requestedDiv);

        // Right: remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-watched-btn';
        removeBtn.title = 'Remove from watch list';
        removeBtn.style.display = 'flex';
        removeBtn.style.alignItems = 'center';
        removeBtn.style.justifyContent = 'center';
        removeBtn.style.background = 'none';
        removeBtn.style.border = 'none';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.padding = '2px 6px';
        removeBtn.style.marginLeft = '12px';

        const trashIcon = document.createElement('img');
        trashIcon.src = './images/delete.png';
        trashIcon.alt = 'Remove';
        trashIcon.width = 18;
        trashIcon.height = 18;
        trashIcon.style.display = 'block';

        removeBtn.appendChild(trashIcon);

        removeBtn.onclick = async (e) => {
            e.stopPropagation(); // Prevent card click
            await removeFromWatchList(pr.meta.requested_url);
            await removeWatchedPullRequest(pr.id);
            await setLastUpdateTime();
            // delete the card from the UI using e as a reference
            const card = e.target.closest('.pr-card');
            if (card) {
                card.remove();
            }
        };

        footnoteRow.appendChild(timestampsDiv);
        footnoteRow.appendChild(removeBtn);

        // Clear footnote and append the row
        footnote.innerHTML = '';
        footnote.appendChild(footnoteRow);
    } else {
        footnote.appendChild(updatedDiv);
        footnote.appendChild(requestedDiv);
    }

    return footnote;
}

//
//
// EXPORTED UI HELPER FUNCTIONS
//
//

/**
 * Simplified method to display the list of pull requests in the popup.
 * @param {Array} pullRequests - List of pull requests to display.
 * @param {HTMLElement} pullRequestsList - The DOM element to render the pull requests into.
 */
export async function displayPullRequestsCards(pullRequests, pullRequestsList, lastViewedTime=null, elementId = null) {
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
        console.log(`No pull requests found [${elementId}].`);
        pullRequestsList.innerHTML = '<div class="no-pull-requests">No pull requests found.</div>';
        return;
    }

    pullRequestsList.innerHTML = '';
    pullRequests.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    // Create a card for each pull request
    // and append it to the pull requests list
    pullRequests.forEach(async (pr) => {
        let card = await createPullRequestCard(pr.card, elementId, lastViewedTime);
        if (card) {
            pullRequestsList.appendChild(card);
        }
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

    // create a boolean if pullRequests have updated after lastViewedTime
    // Highlight the updatedAt text if it is greater than lastViewedTime
    let hasUpdatedAfterLastViewed = false;

    // pullRequests has updated_at > lastViewedTime?
    hasUpdatedAfterLastViewed = pullRequests.some(pr => {
        let updatedAt = pr.updated_at ? new Date(pr.updated_at) : (pr.updatedAt ? new Date(pr.updatedAt) : null);
        return new Date(updatedAt) > new Date(lastViewedTime);
    });

    // Find the badge element and update the text
    const badgeElement = document.getElementById(`${prefix}-badge`);
    if (badgeElement) {
        badgeElement.textContent = badgeText;
    }

    if (badgeText === '') {
        badgeElement.classList.add('hidden');
    } else {
        if (hasUpdatedAfterLastViewed) {
            badgeElement.classList.add('tab-badge-new');
            badgeElement.classList.remove('tab-badge');
        } else {
            badgeElement.classList.add('tab-badge');
            badgeElement.classList.remove('tab-badge-new');
        }
        badgeElement.classList.remove('hidden');
    }
}