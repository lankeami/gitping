/**
 * Display the list of pull requests in the popup.
 * @param {Array} pullRequests - List of pull requests to display.
 * @param {HTMLElement} pullRequestsList - The DOM element to render the pull requests into.
 */
export function displayPullRequests(pullRequests, pullRequestsList) {
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