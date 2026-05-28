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
    if (!user || !user.login) {
        return null;
    }
    // check storageUtils for user avatar url first
    // iff it doesn't exist, pull from the user object and save it for a day
    // then build the avatar image element

    let avatarUrl = await getAvatarUrl(user.login);
    if (!avatarUrl) {
        // If avatar URL is not found in storage, use the user object
        avatarUrl = user.avatar_url || user.avatarUrl;
        if(avatarUrl) {
            setAvatarUrl(user.login, avatarUrl);
        } else {
            return null;
        }
    }

    const avatarImg = document.createElement('img');
    avatarImg.src = avatarUrl;
    avatarImg.alt = user.login;
    avatarImg.className = 'avatar avatar-md';
    return avatarImg;
}


/**
 * Calculate staleness metadata for a PR based on its last update.
 * Returns { daysSinceUpdate, badgeText, className } or null if not stale.
 */
function calculateStaleness(updatedAtIso, thresholds = {}) {
  // Validate ISO date
  if (!updatedAtIso || isNaN(new Date(updatedAtIso).getTime())) {
    return null; // Invalid date; treat as not stale
  }

  const staleThreshold = thresholds.staleThreshold || 3;
  const criticalThreshold = thresholds.criticalThreshold || 6;

  // Validate thresholds
  if (staleThreshold < 0 || criticalThreshold < 0 || criticalThreshold < staleThreshold) {
    console.warn('Invalid staleness thresholds', thresholds);
    return null;
  }

  const updatedAt = new Date(updatedAtIso);
  const now = new Date();
  const daysSinceUpdate = Math.floor((now - updatedAt) / (1000 * 60 * 60 * 24));

  if (daysSinceUpdate < staleThreshold) {
    return null; // Not stale enough to show badge
  }

  const badgeText = `${daysSinceUpdate}d`;
  let className;

  if (daysSinceUpdate >= criticalThreshold) {
    className = 'staleness-badge--critical';
  } else {
    className = 'staleness-badge--warning';
  }

  return { daysSinceUpdate, badgeText, className };
}

/**
 * Creates a card element for a pull request
 * @param {Object} pr - The pull request object.
 * @returns {HTMLElement} - The card element.
 */
export async function createPullRequestCard(pr, section_name = null, lastViewedTime = null) {
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
        if (subtitle instanceof Node) {
            card.appendChild(subtitle);
        }

        const quote = await quoteCard(pr);
        if (quote && quote.textContent.trim() !== '') {
            card.appendChild(quote);
        }

        const footnote = cardFootnote(pr, section_name, lastViewedTime);
        card.appendChild(footnote);

    } catch (error) {
        console.error('Error creating pull request card:', error, pr);
        // If there's an error, we can still return the card with partial data
        card.innerHTML = `<div class="pr-error">Error creating card for PR: ${pr.title}</div>`;
    }

    return card;
}

async function quoteCard(pr) {
    // --- Create the Quote Element ---
    const quote = document.createElement('blockquote');
    quote.className = 'pr-quote';
    // render the markdwown text of the latest message
    // Set the text content of the quote
    quote.textContent = pr.meta?.latest_message?.message || '';
    // TODO: convert quote.textContent markdown to HTML

    // Add click handler to expand/collapse
    quote.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card click
        quote.classList.toggle('expanded');
    });

    // --- Add the author of the quote ---
    if (pr.meta?.latest_message?.author?.login) {
        const author = document.createElement('span');
        author.className = 'pr-quote-author';
        author.textContent = ` - ${pr.meta.latest_message.author.login} `;

        // Add the avatar of the author
        const authorAvatar = await avatarForUser(pr.meta.latest_message.author);
        if (authorAvatar) {
            authorAvatar.className = 'avatar avatar-sm';
            author.prepend(authorAvatar);
        }

        quote.appendChild(author);
    }

    return quote;
}

function cardLabels(pr) {
    // --- Create the Labels Element ---
    const labelsDiv = document.createElement('div');
    labelsDiv.className = 'pr-labels';

    let labelArr = [];
    if (Array.isArray(pr.labels)) {
        labelArr = pr.labels;
    } else if (pr.labels && Array.isArray(pr.labels.nodes)) {
        labelArr = pr.labels.nodes;
    }

    labelArr.forEach(label => {
        if (!label || !label.name) return;
        const labelElement = document.createElement('span');
        labelElement.className = 'pr-label';
        labelElement.textContent = label.name;
        if (label.color) {
            labelElement.style.backgroundColor = `#${label.color}`;
            // convert the background color to an RGB
            const color = label.color.toLowerCase();
            const luminance = hexToLuminance(color);
            if (luminance > 128) {
                labelElement.style.color = 'black';
            }
        }
        labelsDiv.appendChild(labelElement);
    });

    return labelsDiv;
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
    highbrow.textContent = pr.repo_name || '';
    let owner = pr.owner;
    if (!owner && pr.base && pr.base.repo && pr.base.repo.owner) {
        owner = pr.base.repo.owner;
    }
    const ownerAvatar = await avatarForUser(owner);
    if(ownerAvatar) {
        ownerAvatar.classList.add('avatar-float-right');
        highbrow.appendChild(ownerAvatar);
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
        typeIcon.className = 'pr-type-icon';
        typeIcon.width = 18;
        typeIcon.height = 18;
        title.appendChild(typeIcon);
    }
    title.appendChild(document.createTextNode(pr.title));

    // --- Add PR status badge ---
    const statusBadge = document.createElement('span');
    if (pr.draft) {
        statusBadge.textContent = 'Draft';
        statusBadge.className = 'pr-status-badge pr-status-badge--draft';
    } else if (pr.state.toLowerCase() === 'open') {
        statusBadge.textContent = 'Open';
        statusBadge.className = 'pr-status-badge pr-status-badge--open';
    } else if (pr.state.toLowerCase() === 'closed' && pr.merged_at) {
        statusBadge.textContent = 'Merged';
        statusBadge.className = 'pr-status-badge pr-status-badge--merged';
    } else if (pr.state.toLowerCase() === 'closed') {
        statusBadge.textContent = 'Closed';
        statusBadge.className = 'pr-status-badge pr-status-badge--closed';
    } else {
        statusBadge.textContent = pr.state;
        statusBadge.className = 'pr-status-badge pr-status-badge--default';
    }

    title.appendChild(statusBadge);

    if (pr.ciStatus) {
        const ciSvg = {
            success: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="#1a7f37" fill-rule="evenodd" d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm3.78 4.47a.75.75 0 0 0-1.06 0L6.75 8.44 5.28 6.97a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4.5-4.5a.75.75 0 0 0 0-1.06Z"/></svg>',
            failure: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="#cf222e" fill-rule="evenodd" d="M2.343 13.657A8 8 0 1 1 13.657 2.343 8 8 0 0 1 2.343 13.657ZM6.03 4.97a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042L6.94 8 4.97 9.99a.749.749 0 0 0 .326 1.275.749.749 0 0 0 .734-.215L8 9.06l1.97 1.99a.749.749 0 0 0 1.275-.326.749.749 0 0 0-.215-.734L9.06 8l1.99-1.97a.749.749 0 0 0-.326-1.275.749.749 0 0 0-.734.215L8 6.94 6.03 4.97Z"/></svg>',
            running: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="#9a6700" fill-rule="evenodd" d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM5 8a1 1 0 1 0-2 0 1 1 0 0 0 2 0Zm4 0a1 1 0 1 0-2 0 1 1 0 0 0 2 0Zm3 0a1 1 0 1 0-2 0 1 1 0 0 0 2 0Z"/></svg>',
        };
        const ciBadge = document.createElement('span');
        ciBadge.className = `ci-badge ci-badge--${pr.ciStatus}`;
        ciBadge.title = `CI: ${pr.ciStatus}`;
        const ciImg = document.createElement('img');
        ciImg.src = 'data:image/svg+xml,' + encodeURIComponent(ciSvg[pr.ciStatus]);
        ciImg.width = 16;
        ciImg.height = 16;
        ciImg.alt = 'CI: ' + pr.ciStatus;
        ciBadge.appendChild(ciImg);
        title.appendChild(ciBadge);
    }

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
        footnoteRow.className = 'watched-footnote-row';

        // Left: timestamps
        const timestampsDiv = document.createElement('div');
        timestampsDiv.appendChild(updatedDiv);
        timestampsDiv.appendChild(requestedDiv);

        // Right: remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-watched-btn';
        removeBtn.title = 'Remove from watch list';

        const trashIcon = document.createElement('img');
        trashIcon.src = './images/delete.png';
        trashIcon.alt = 'Remove';
        trashIcon.width = 18;
        trashIcon.height = 18;

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

/**
 * Displays the list of users requested to review a pull request.
 * @param {*} pr - The pull request object.
 */
export async function displayReviewers(pr) {
    const reviewersList = document.getElementById('reviewers-list');
    if (!reviewersList) return;

    // Clear the existing list
    reviewersList.innerHTML = '';

    // Get the list of reviewers from the pull request object
    const reviewers = pr.requested_reviewers || [];
    if (reviewers.length === 0) {
        reviewersList.innerHTML = '<div class="no-reviewers"></div>';
        return;
    }

    // Create a list item for each reviewer
    // display a pill or avatar per reviewer
    reviewersList.className = 'reviewers-list';
    reviewersList.innerHTML = ''; // Clear existing content

    reviewers.forEach((reviewer) => {
        const listItem = document.createElement('div');
        listItem.className = 'reviewer-item';
        listItem.title = reviewer.login;

        reviewersList.appendChild(listItem);
    });
}
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

    const cardPromises = pullRequests.map(async pr => {
        try {
            const card = await createPullRequestCard(pr.card, elementId, lastViewedTime);
            return [pr.id.toString(), card];
        } catch (error) {
            console.error('Error creating card for PR:', pr, error);
            return [pr.id.toString(), document.createElement('div')]; // Return an empty div if there's an error 
        }
    });
    const cardEntries = await Promise.all(cardPromises);
    const cardMap = Object.fromEntries(cardEntries);

    pullRequests.forEach((pr) => {
        const cardElement = cardMap[pr.id.toString()];
        if (cardElement) {
            pullRequestsList.appendChild(cardElement);
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
    // Count only visible cards in the tab's list
    const listElem = document.getElementById(`${prefix}-pull-requests-list`);
    let visibleCount = 0;
    if (listElem) {
        const visibleCards = listElem.querySelectorAll('.pr-card:not(.hidden)');
        visibleCount = visibleCards.length;
    }
    const badgeText = visibleCount > 0 ? visibleCount : '';

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