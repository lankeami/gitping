/**
 * Display the list of pull requests in the popup.
 * @param {Array} pullRequests - List of pull requests to display.
 * @param {HTMLElement} pullRequestsList - The DOM element to render the pull requests into.
 */
export function displayPullRequests(pullRequests, pullRequestsList) {
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

/**
 * Display a list of comments as cards in the mentions tab.
 * @param {Array} comments - List of comments to display.
 * @param {HTMLElement} commentsList - The DOM element to render the comments into.
 */
export function displayItemComments(comments, commentsList) {
    // Check for mentions - only show the list if there are mentions
    if (!Array.isArray(comments) || comments.length === 0) {
        console.log('No comments found.');
        commentsList.innerHTML = '<div class="no-pull-requests">No mentions found.</div>';
        return;
    }
    // Clear the comments list
    commentsList.innerHTML = '';

    // sort comments by updated_at date in descending order
    comments.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    // Create a card for each comment
    // and append it to the comments list
    comments.forEach((comment) => {
        const card = document.createElement('div');
        card.className = 'pr-card';
        card.onclick = () => {
            window.open(comment.pull_request.html_url, '_blank'); // Navigate to the pull request
        };

        // Extract repository name from repository_url
        const repoUrlParts = comment.repository_url.split('/');
        const repoName = `${repoUrlParts[repoUrlParts.length - 2]}/${repoUrlParts[repoUrlParts.length - 1]}`;

        // Highbrow: Repository name
        const highbrow = document.createElement('div');
        highbrow.className = 'pr-highbrow';
        highbrow.textContent = repoName;
        card.appendChild(highbrow);

        // Title: First n characters of the comment body (fallback to empty string if body is null/undefined)
        const title = document.createElement('div');
        title.className = 'pr-title';
        title.textContent = comment.title;
        card.appendChild(title);

        // Author: Comment author
        const author = document.createElement('div');
        author.className = 'pr-subtitle';
        author.textContent = `Author: ${comment.user.login}`;
        card.appendChild(author);

        const footnote = document.createElement('div');
        footnote.className = 'pr-footnote';
        const updatedAt = new Date(comment.updated_at).toLocaleString();
        const requestedAt = new Date(comment.created_at).toLocaleString();

        const updatedDiv = document.createElement('div');
        updatedDiv.className = 'pr-footnote';
        updatedDiv.textContent = `Updated: ${updatedAt}`;
        footnote.appendChild(updatedDiv);

        const requestedDiv = document.createElement('div');
        requestedDiv.className = 'pr-footnote';
        requestedDiv.textContent = `Created: ${requestedAt}`;
        footnote.appendChild(requestedDiv);
        
        card.appendChild(footnote);

        // Append the card to the comments list
        commentsList.appendChild(card);
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
}

