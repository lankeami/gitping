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