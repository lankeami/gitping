document.addEventListener('DOMContentLoaded', function() {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'newPullRequests') {
            const pullRequests = request.data;
            if (pullRequests.length > 0) {
                pullRequests.forEach(pr => {
                    alert(`New Pull Request: ${pr.title} - ${pr.html_url}`);
                });
            }
        }
    });
});