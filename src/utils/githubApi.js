// This file contains utility functions for interacting with the GitHub API.

const GITHUB_API_URL = 'https://api.github.com';
const LOCAL_STORAGE_KEY = 'pullRequests';
const POLLING_INTERVAL = 60000; // 1 minute

async function authenticateUser(token) {
    localStorage.setItem('githubToken', token);
}

async function fetchPullRequests() {
    const token = localStorage.getItem('githubToken');
    if (!token) {
        throw new Error('User not authenticated');
    }

    const response = await fetch(`${GITHUB_API_URL}/user/pulls`, {
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch Pull Requests');
    }

    return await response.json();
}

function storePullRequests(pullRequests) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(pullRequests));
}

function getStoredPullRequests() {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

function comparePullRequests(newPRs) {
    const storedPRs = getStoredPullRequests();
    const newPRsToNotify = newPRs.filter(pr => !storedPRs.some(storedPR => storedPR.id === pr.id));
    storePullRequests(newPRs);
    return newPRsToNotify;
}

function notifyUser(newPRs) {
    newPRs.forEach(pr => {
        const message = `New Pull Request: ${pr.title} by ${pr.user.login}`;
        alert(message);
    });
}

async function pollForPullRequests() {
    try {
        const pullRequests = await fetchPullRequests();
        const newPRs = comparePullRequests(pullRequests);
        if (newPRs.length > 0) {
            notifyUser(newPRs);
        }
    } catch (error) {
        console.error('Error polling for Pull Requests:', error);
    }
}

setInterval(pollForPullRequests, POLLING_INTERVAL);