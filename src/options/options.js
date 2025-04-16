document.addEventListener('DOMContentLoaded', function() {
    const saveButton = document.getElementById('save');
    const tokenInput = document.getElementById('github-token');
    const intervalInput = document.getElementById('polling-interval');

    // Load saved settings
    chrome.storage.sync.get(['githubToken', 'pollingInterval'], function(data) {
        tokenInput.value = data.githubToken || '';
        intervalInput.value = data.pollingInterval || 5; // default to 5 minutes
    });

    // Save settings
    saveButton.addEventListener('click', function() {
        const token = tokenInput.value;
        const interval = intervalInput.value;

        chrome.storage.sync.set({
            githubToken: token,
            pollingInterval: interval
        }, function() {
            alert('Settings saved!');
        });
    });
});