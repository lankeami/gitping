function extractUniqueStates(pullRequests) {
    const states = new Set();
    pullRequests.forEach(pr => {
        if (pr.state) states.add(pr.state);
    });
    return Array.from(states).sort();
}

function extractUniqueRepos(pullRequests) {
    const repos = new Set();
    pullRequests.forEach(pr => {
        if (pr.repository && pr.repository.name) repos.add(pr.repository.name);
    });
    return Array.from(repos).sort();
}

function extractUniqueOrgs(pullRequests) {
    const orgs = new Set();
    pullRequests.forEach(pr => {
        if (pr.repository && pr.repository.owner && pr.repository.owner.login) {
            orgs.add(pr.repository.owner.login);
        } else if (pr.org) {
            orgs.add(pr.org);
        }
    });
    return Array.from(orgs).sort();
}
// --- DYNAMIC HEIGHT LOGIC (moved from inline script for CSP) ---
function setPopupContainerHeight() {
    const iconContainer = document.getElementById('icon-container');
    const popupContainer = document.getElementById('popup-container');
    const footer = document.querySelector('div[style*="display: flex;"][style*="justify-content: space-between;"]');
    if (!popupContainer || !iconContainer || !footer) return;
    const winHeight = window.innerHeight;
    const iconHeight = iconContainer.offsetHeight;
    const footerHeight = footer.offsetHeight;
    // Subtract the footer height twice
    const newHeight = winHeight - iconHeight - (2 * footerHeight + 15);
    popupContainer.style.height = newHeight > 0 ? newHeight + 'px' : 'auto';
    popupContainer.style.overflowY = 'auto';
}
window.addEventListener('resize', setPopupContainerHeight);
window.addEventListener('DOMContentLoaded', setPopupContainerHeight);
import { getAuthToken, getUsername, resetLocalStorage, getLastUpdateTime, getLastError, setLastError, updateExtensionBadge, setLastUpdateTime, getFirstUpdateTime, setLastViewedTime, getLastViewedTime, addToWatchList, shouldSuppressReviewToast, setReviewClicked, snoozeReviewToast, getPopupOpenCount, incrementPopupOpenCount, getAvatarUrl, setAvatarUrl } from '../shared/storageUtils.js';
import { displayPullRequestsCards, createPullRequestCard, resetUI, displayBadgeCount } from '../shared/uiUtils.js';

// Helper: get card element by PR id
function getCardElementById(listElem, prId) {
    return listElem.querySelector(`.pr-card[data-pr-id="${prId}"]`);
}

// --- FILTER LOGIC ---
const TAB_KEYS = ['personal', 'mine', 'team', 'mention', 'issues'];

function extractUniqueAuthors(pullRequests) {
    const authors = new Set();
    pullRequests.forEach(pr => {
        const login = pr.author?.login || pr.user?.login;
        if (login) authors.add(login);
    });
    return Array.from(authors).sort();
}

function extractUniqueLabels(pullRequests) {
    const labels = new Set();
    pullRequests.forEach(pr => {
        let labelArr = [];
        if (Array.isArray(pr.labels)) {
            labelArr = pr.labels;
        } else if (pr.labels && Array.isArray(pr.labels.nodes)) {
            labelArr = pr.labels.nodes;
        }
        labelArr.forEach(label => {
            if (label && label.name) labels.add(label.name);
        });
    });
    return Array.from(labels).sort();
}


// Render a custom multiselect dropdown with checkboxes and chips
function renderCustomMultiselect(container, options, selected, onChange) {
    container.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'multiselect-list';
    options.forEach(opt => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'multiselect-option';
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = opt;
            checkbox.checked = selected.includes(opt);
            checkbox.addEventListener('change', e => {
                if (e.target.checked) {
                    onChange([...selected, opt]);
                } else {
                    onChange(selected.filter(v => v !== opt));
                }
            });
            const textSpan = document.createElement('span');
            textSpan.textContent = opt;
            textSpan.style.marginLeft = '6px';
            label.appendChild(checkbox);
            label.appendChild(textSpan);
            optionDiv.appendChild(label);
        list.appendChild(optionDiv);
    });
    container.appendChild(list);
}

function getSelectedOptions(selectElem) {
    return Array.from(selectElem.selectedOptions).map(opt => opt.value);
}

function filterPRsByAuthorAndLabel(prs, selectedAuthors, selectedLabels) {
    // If nothing is selected, show all
    if ((!selectedAuthors || selectedAuthors.length === 0) && (!selectedLabels || selectedLabels.length === 0)) {
        return prs;
    }
    return prs.filter(pr => {
        const author = pr.author?.login || pr.user?.login;
        let prLabels = [];
        if (Array.isArray(pr.labels)) {
            prLabels = pr.labels.map(l => l.name);
        } else if (pr.labels && Array.isArray(pr.labels.nodes)) {
            prLabels = pr.labels.nodes.map(l => l.name);
        }
        // If author is selected, REMOVE it from the list
        if (selectedAuthors.includes(author)) return false;
        // If any label is selected and matches, REMOVE it from the list
        if (prLabels.some(label => selectedLabels.includes(label))) return false;
        return true;
    });
}

async function setupTabFilters(tabKey, pullRequests, lastViewedTime) {
    const orgDiv = document.getElementById(`${tabKey}-org-filter`);
    const authorDiv = document.getElementById(`${tabKey}-author-filter`);
    const labelDiv = document.getElementById(`${tabKey}-label-filter`);
    const repoDiv = document.getElementById(`${tabKey}-repo-filter`);
    const dateDiv = document.getElementById(`${tabKey}-date-filter`); // Add date filter container
    const listElem = document.getElementById(`${tabKey}-pull-requests-list`);
    if (!orgDiv || !authorDiv || !labelDiv || !repoDiv || !dateDiv || !listElem) return;

    const orgs = extractUniqueOrgs(pullRequests);
    const authors = extractUniqueAuthors(pullRequests);
    const labels = extractUniqueLabels(pullRequests);
    const repos = extractUniqueRepos(pullRequests);

    // Restore filter selections from storage
    const filterKey = `filterSelections_${tabKey}`;
    let restoredOrgs = [];
    let restoredAuthors = [];
    let restoredLabels = [];
    let restoredRepos = [];
    let restoredDate = null; // Add restored date
    await new Promise(resolve => {
        chrome.storage.local.get([filterKey], result => {
            if (result[filterKey]) {
                restoredOrgs = result[filterKey].orgs || [];
                restoredAuthors = result[filterKey].authors || [];
                restoredLabels = result[filterKey].labels || [];
                restoredRepos = result[filterKey].repos || [];
                restoredDate = result[filterKey].date || null; // Restore date
            }
            resolve();
        });
    });

    // State for selected values
    let selectedOrgs = [...restoredOrgs];
    let selectedAuthors = [...restoredAuthors];
    let selectedLabels = [...restoredLabels];
    let selectedRepos = [...restoredRepos];
    let selectedDate = restoredDate; // Initialize selected date

    // Render all cards at once using displayPullRequestsCards (ensures all data is present)
    await displayPullRequestsCards(pullRequests, listElem, lastViewedTime, tabKey);

    // Add data-pr-id to each card for filtering (match order)
    const cardElems = listElem.querySelectorAll('.pr-card');
    pullRequests.forEach((pr, idx) => {
        const cardElem = cardElems[idx];
        if (cardElem) {
            cardElem.setAttribute('data-pr-id', pr.id);
        }
    });

    function updateFilterCountBadge() {
        const badge = document.getElementById(`${tabKey}-filter-count`);
        const count = selectedOrgs.length + selectedAuthors.length + selectedLabels.length + selectedRepos.length + (selectedDate ? 1 : 0);
        if (badge) {
            badge.textContent = count > 0 ? count : '';
            if (count > 0) {
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    }

    function updateCardVisibilityAndPersist() {
        chrome.storage.local.set({ [filterKey]: { orgs: selectedOrgs, authors: selectedAuthors, labels: selectedLabels, repos: selectedRepos, date: selectedDate } });
        pullRequests.forEach(pr => {
            const cardElem = listElem.querySelector(`.pr-card[data-pr-id="${pr.id}"]`);
            if (!cardElem) return;
            const org = pr.repository?.owner?.login || pr.org;
            const author = pr.author?.login || pr.user?.login;
            let prLabels = [];
            if (Array.isArray(pr.labels)) {
                prLabels = pr.labels.map(l => l.name);
            } else if (pr.labels && Array.isArray(pr.labels.nodes)) {
                prLabels = pr.labels.nodes.map(l => l.name);
            }
            const repo = pr.repository && pr.repository.name;
            const updatedAtRaw = pr.card?.updated_at || pr.last_updated || null; // Check multiple fields for updated_at
            const updatedAt = updatedAtRaw ? new Date(updatedAtRaw) : null; // Ensure updated_at is valid
            let hide = false;
            if (selectedOrgs.length > 0 && selectedOrgs.includes(org)) hide = true;
            if (selectedAuthors.length > 0 && selectedAuthors.includes(author)) hide = true;
            if (selectedLabels.length > 0 && prLabels.some(label => selectedLabels.includes(label))) hide = true;
            if (selectedRepos.length > 0 && selectedRepos.includes(repo)) hide = true;
            if (selectedDate && updatedAt && updatedAt < new Date(selectedDate)) hide = true; // Hide if updated_at is less than the selected date

            cardElem.classList.toggle('hidden', hide);
        });
        updateFilterCountBadge();
    }

    // Render all custom multiselects
    function renderAll() {
        renderCustomMultiselect(orgDiv, orgs, selectedOrgs, vals => { selectedOrgs = vals; renderAll(); updateCardVisibilityAndPersist(); });
        renderCustomMultiselect(authorDiv, authors, selectedAuthors, vals => { selectedAuthors = vals; renderAll(); updateCardVisibilityAndPersist(); });
        renderCustomMultiselect(labelDiv, labels, selectedLabels, vals => { selectedLabels = vals; renderAll(); updateCardVisibilityAndPersist(); });
        renderCustomMultiselect(repoDiv, repos, selectedRepos, vals => { selectedRepos = vals; renderAll(); updateCardVisibilityAndPersist(); });

        // Render date picker
        dateDiv.innerHTML = '';
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.value = selectedDate || '';
        dateInput.className = 'filter-input'; // Add class for consistent styling
        dateInput.addEventListener('change', e => {
            selectedDate = e.target.value;
            updateCardVisibilityAndPersist();
        });
        dateDiv.appendChild(dateInput);

        updateFilterCountBadge();
    }
    renderAll();

    // Clear buttons
    orgDiv.parentElement.querySelector('.clear-filter-btn').onclick = () => { selectedOrgs = []; renderAll(); updateCardVisibilityAndPersist(); };
    authorDiv.parentElement.querySelector('.clear-filter-btn').onclick = () => { selectedAuthors = []; renderAll(); updateCardVisibilityAndPersist(); };
    labelDiv.parentElement.querySelector('.clear-filter-btn').onclick = () => { selectedLabels = []; renderAll(); updateCardVisibilityAndPersist(); };
    repoDiv.parentElement.querySelector('.clear-filter-btn').onclick = () => { selectedRepos = []; renderAll(); updateCardVisibilityAndPersist(); };
    dateDiv.parentElement.querySelector('.clear-filter-btn').onclick = () => { selectedDate = null; renderAll(); updateCardVisibilityAndPersist(); }; // Clear date filter

    // Initial visibility (after restoring selections)
    updateCardVisibilityAndPersist();
}

function aggregateWorkload(config) {
    const seen = new Set();
    const authors = {};

    ['personal', 'mine', 'team', 'mention'].forEach(key => {
        const prs = config[key] || [];
        prs.forEach(pr => {
            if (seen.has(pr.id)) return;
            seen.add(pr.id);
            const login = pr.author?.login || pr.user?.login || pr.card?.user?.login;
            if (!login) return;
            if (!authors[login]) {
                authors[login] = {
                    login,
                    user: pr.card?.user || pr.user || { login },
                    authored: 0,
                    reviewRequested: 0,
                    prs: [],
                };
            }
            authors[login].authored++;
            authors[login].prs.push(pr);
        });
    });

    ['personal', 'team'].forEach(key => {
        const prs = config[key] || [];
        prs.forEach(pr => {
            const reviewers = pr.card?.requested_reviewers || pr.requested_reviewers || [];
            reviewers.forEach(r => {
                if (!r?.login) return;
                if (!authors[r.login]) {
                    authors[r.login] = { login: r.login, user: r, authored: 0, reviewRequested: 0, prs: [] };
                }
                authors[r.login].reviewRequested++;
            });
        });
    });

    return Object.values(authors)
        .sort((a, b) => (b.authored + b.reviewRequested) - (a.authored + a.reviewRequested))
        .slice(0, 20);
}

async function setupWorkloadFilters(config) {
    const orgDiv = document.getElementById('workload-org-filter');
    const authorDiv = document.getElementById('workload-author-filter');
    const labelDiv = document.getElementById('workload-label-filter');
    const repoDiv = document.getElementById('workload-repo-filter');
    const dateDiv = document.getElementById('workload-date-filter');
    if (!orgDiv || !authorDiv || !labelDiv || !repoDiv || !dateDiv) return;

    const seen = new Set();
    const allPRs = [];
    ['personal', 'mine', 'team', 'mention'].forEach(key => {
        (config[key] || []).forEach(pr => {
            if (!seen.has(pr.id)) { seen.add(pr.id); allPRs.push(pr); }
        });
    });

    const orgs = extractUniqueOrgs(allPRs);
    const authors = extractUniqueAuthors(allPRs);
    const labels = extractUniqueLabels(allPRs);
    const repos = extractUniqueRepos(allPRs);

    const filterKey = 'filterSelections_workload';
    let restoredOrgs = [], restoredAuthors = [], restoredLabels = [], restoredRepos = [];
    let restoredDate = null;
    await new Promise(resolve => {
        chrome.storage.local.get([filterKey], result => {
            if (result[filterKey]) {
                restoredOrgs = result[filterKey].orgs || [];
                restoredAuthors = result[filterKey].authors || [];
                restoredLabels = result[filterKey].labels || [];
                restoredRepos = result[filterKey].repos || [];
                restoredDate = result[filterKey].date || null;
            }
            resolve();
        });
    });

    let selectedOrgs = [...restoredOrgs];
    let selectedAuthors = [...restoredAuthors];
    let selectedLabels = [...restoredLabels];
    let selectedRepos = [...restoredRepos];
    let selectedDate = restoredDate;

    function updateFilterCountBadge() {
        const badge = document.getElementById('workload-filter-count');
        const count = selectedOrgs.length + selectedAuthors.length + selectedLabels.length + selectedRepos.length + (selectedDate ? 1 : 0);
        if (badge) {
            badge.textContent = count > 0 ? count : '';
            badge.classList.toggle('hidden', count === 0);
        }
    }

    function filterPR(pr) {
        const org = pr.repository?.owner?.login || pr.org;
        const author = pr.author?.login || pr.user?.login;
        let prLabels = [];
        if (Array.isArray(pr.labels)) prLabels = pr.labels.map(l => l.name);
        else if (pr.labels?.nodes) prLabels = pr.labels.nodes.map(l => l.name);
        const repo = pr.repository?.name;
        const updatedAt = pr.card?.updated_at || pr.last_updated;

        if (selectedOrgs.length > 0 && selectedOrgs.includes(org)) return false;
        if (selectedAuthors.length > 0 && selectedAuthors.includes(author)) return false;
        if (selectedLabels.length > 0 && prLabels.some(l => selectedLabels.includes(l))) return false;
        if (selectedRepos.length > 0 && selectedRepos.includes(repo)) return false;
        if (selectedDate && updatedAt && new Date(updatedAt) < new Date(selectedDate)) return false;
        return true;
    }

    async function applyFiltersAndRender() {
        chrome.storage.local.set({ [filterKey]: { orgs: selectedOrgs, authors: selectedAuthors, labels: selectedLabels, repos: selectedRepos, date: selectedDate } });

        const filteredConfig = {};
        ['personal', 'mine', 'team', 'mention'].forEach(key => {
            filteredConfig[key] = (config[key] || []).filter(filterPR);
        });

        const workloadData = aggregateWorkload(filteredConfig);
        await renderWorkload(workloadData);

        const workloadBadge = document.getElementById('workload-badge');
        if (workloadBadge) {
            if (workloadData.length > 0) {
                workloadBadge.textContent = workloadData.length;
                workloadBadge.classList.remove('hidden');
            } else {
                workloadBadge.classList.add('hidden');
            }
        }
        updateFilterCountBadge();
    }

    function renderAll() {
        renderCustomMultiselect(orgDiv, orgs, selectedOrgs, vals => { selectedOrgs = vals; renderAll(); applyFiltersAndRender(); });
        renderCustomMultiselect(authorDiv, authors, selectedAuthors, vals => { selectedAuthors = vals; renderAll(); applyFiltersAndRender(); });
        renderCustomMultiselect(labelDiv, labels, selectedLabels, vals => { selectedLabels = vals; renderAll(); applyFiltersAndRender(); });
        renderCustomMultiselect(repoDiv, repos, selectedRepos, vals => { selectedRepos = vals; renderAll(); applyFiltersAndRender(); });

        dateDiv.textContent = '';
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.value = selectedDate || '';
        dateInput.className = 'filter-input';
        dateInput.addEventListener('change', e => { selectedDate = e.target.value; applyFiltersAndRender(); });
        dateDiv.appendChild(dateInput);

        updateFilterCountBadge();
    }
    renderAll();

    orgDiv.parentElement.querySelector('.clear-filter-btn').onclick = () => { selectedOrgs = []; renderAll(); applyFiltersAndRender(); };
    authorDiv.parentElement.querySelector('.clear-filter-btn').onclick = () => { selectedAuthors = []; renderAll(); applyFiltersAndRender(); };
    labelDiv.parentElement.querySelector('.clear-filter-btn').onclick = () => { selectedLabels = []; renderAll(); applyFiltersAndRender(); };
    repoDiv.parentElement.querySelector('.clear-filter-btn').onclick = () => { selectedRepos = []; renderAll(); applyFiltersAndRender(); };
    dateDiv.parentElement.querySelector('.clear-filter-btn').onclick = () => { selectedDate = null; renderAll(); applyFiltersAndRender(); };

    await applyFiltersAndRender();
}

async function renderWorkload(workloadData) {
    const list = document.getElementById('workload-list');
    if (!list) return;
    list.textContent = '';

    if (workloadData.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'no-pull-requests';
        empty.textContent = 'No open PRs found.';
        list.appendChild(empty);
        return;
    }

    const { stalenessThresholds } = await new Promise(resolve => {
        chrome.storage.local.get(['stalenessThresholds'], resolve);
    });
    const thresholds = stalenessThresholds || { staleThreshold: 3, criticalThreshold: 6 };

    for (const author of workloadData) {
        const section = document.createElement('div');
        section.className = 'workload-accordion';

        const header = document.createElement('button');
        header.type = 'button';
        header.className = 'workload-row';

        const avatarImg = document.createElement('img');
        let avatarUrl = await getAvatarUrl(author.login);
        if (!avatarUrl) {
            avatarUrl = author.user?.avatar_url || author.user?.avatarUrl;
            if (avatarUrl) setAvatarUrl(author.login, avatarUrl);
        }
        if (avatarUrl) avatarImg.src = avatarUrl;
        avatarImg.alt = author.login;
        avatarImg.className = 'avatar avatar-md';
        header.appendChild(avatarImg);

        const info = document.createElement('div');
        info.className = 'workload-info';
        const name = document.createElement('span');
        name.className = 'workload-name';
        name.textContent = author.login;
        info.appendChild(name);
        const breakdown = document.createElement('span');
        breakdown.className = 'workload-breakdown';
        const parts = [];
        if (author.authored > 0) parts.push(`${author.authored} authored`);
        if (author.reviewRequested > 0) parts.push(`${author.reviewRequested} reviewing`);
        breakdown.textContent = parts.join(' · ');
        info.appendChild(breakdown);
        header.appendChild(info);

        const count = document.createElement('span');
        count.className = 'workload-count';
        count.textContent = author.authored;
        header.appendChild(count);

        const chevron = document.createElement('span');
        chevron.className = 'workload-chevron';
        chevron.textContent = '▸';
        header.appendChild(chevron);

        const panel = document.createElement('div');
        panel.className = 'workload-panel hidden';

        header.addEventListener('click', async () => {
            const isOpen = !panel.classList.contains('hidden');
            panel.classList.toggle('hidden');
            chevron.textContent = isOpen ? '▸' : '▾';
            if (!isOpen && panel.childElementCount === 0) {
                for (const pr of author.prs) {
                    if (!pr.card) continue;
                    const card = await createPullRequestCard(pr.card, 'workload', null, thresholds);
                    panel.appendChild(card);
                }
            }
        });

        section.appendChild(header);
        section.appendChild(panel);
        list.appendChild(section);
    }
}

document.getElementById('manifest-version').textContent = `v${chrome.runtime.getManifest().version}`;

async function addWatchListUrl() {
    console.log('Adding watch list URL');
    const addWatchInput = document.getElementById('add-watched-input');

    if (!addWatchInput) {
        setLastError('Add watch input element not found');
        return;
    }

    const watchInput = addWatchInput.value.trim();

    // validate the input
    if (!watchInput) {
        return;
    }

    const urlParts = watchInput.replace(/https?:\/\//, '').split('/');

    // first part of the path should be the organization name
    // second part of the path should be the repo name
    // the third part of the path should be the type of request (pull, issue)
    // the fourth part of the path should be the id of the request
    if (urlParts.length < 5) {
        setLastError(`Invalid URL format. \nExpected format like: https://github.com/<org>/<repo>/<type>/<id>`);
        return;
    }

    if (watchInput) {
        try {
            const token = await getAuthToken();
            const username = await getUsername();
            if (token && username) {
                // Add the watch to the user's GitHub account
                // This is a placeholder for the actual implementation
                addToWatchList(watchInput, token, username);
                addWatchInput.value = ''; // Clear the input field
                // NOTE: we can't fetch GitHub APIs in the main thread, it leads to CORS issues
                // so we use a background script to run in the service worker   

                // add a toast indicating addition was a success
                const toast = document.getElementById('toast');
                if (toast) {
                    // toast text should be two lines
                    toast.style.whiteSpace = 'pre-line'; // Allow line breaks in the toast text
                    toast.textContent = `Added ${watchInput} to watch list.\n It may appear in the next update.`;
                    toast.classList.remove('hidden');
                    toast.classList.add('show');
                    setTimeout(() => {
                        toast.classList.remove('show');
                        toast.classList.add('hidden');
                        chrome.alarms.create('popupCheckForUpdates',{delayInMinutes: 0});
                    }, 3000);
                }
            }
        } catch (error) {
            setLastError(error.message);
        }
    } else {
        console.warn('No input provided for watch list');
    }
    addWatchInput.value = ''; // Clear the input field

}

document.addEventListener('DOMContentLoaded', async function () {
    // Accordion logic for filter forms
    document.querySelectorAll('.filter-accordion').forEach(acc => {
        const toggle = acc.querySelector('.accordion-toggle');
        const container = acc.querySelector('.filter-form-container');
        if (toggle && container) {
            toggle.addEventListener('click', () => {
                const expanded = toggle.getAttribute('aria-expanded') === 'true';
                toggle.setAttribute('aria-expanded', !expanded);
                if (expanded) {
                    container.classList.add('hidden');
                } else {
                    container.classList.remove('hidden');
                }
            });
            // Default: hidden
            toggle.setAttribute('aria-expanded', false);
            container.classList.add('hidden');
        }
    });
    const loginButton = document.getElementById('login-button');
    const refreshButton = document.getElementById('refresh-button');
    const resetButton = document.getElementById('reset-button');
    const usernameInput = document.getElementById('username');
    const apiBaseUrlInput = document.getElementById('api-base-url');
    const tokenInput = document.getElementById('token');
    const credentialsDiv = document.getElementById('credentials');
    const appHeader = document.querySelector('.app-header');
    const headerNav = document.querySelector('.header-nav');
    const lastUpdateTimeElement = document.getElementById('last-update-time');
    const lastErrorElement = document.getElementById('last-error');
    const appIconContainer = document.getElementById('app-icon-container');
    const popupContainer = document.getElementById('popup-container');
    const settingsButton = document.getElementById('settings-button');
    const recapTab = document.getElementById('recap-tab');
    const addWatchButton = document.getElementById('add-watched-btn');


    // Tab elements
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    /**
     * Handles tab switching by hiding all tab content and activating the selected tab.
     * @param {string} tabId - The ID of the tab to activate.
     */
    function switchTab(tabId) {
        // Deactivate all tabs and hide all tab content
        tabs.forEach((tab) => tab.classList.remove('active'));
        tabContents.forEach((content) => {
            content.classList.remove('active')
            content.classList.add('hidden');
        });

        // Collapse all filter accordions
        document.querySelectorAll('.filter-accordion').forEach(acc => {
            const toggle = acc.querySelector('.accordion-toggle');
            const container = acc.querySelector('.filter-form-container');
            if (toggle && container) {
                toggle.setAttribute('aria-expanded', false);
                container.classList.add('hidden');
            }
        });

        // Activate the selected tab and its corresponding content
        const selectedTab = document.getElementById(`${tabId}-tab`);
        const selectedContent = document.getElementById(`${tabId}-content`);

        if (selectedTab && selectedContent) {
            selectedTab.classList.add('active');
            selectedContent.classList = ["tab-content", "active"];
        }
    }

    /**
     * Fetch and display all pull requests
     * @param {object} overridePRs 
     */
    async function updateDisplays(overridePRs = null) {
        const token = await getAuthToken();
        const username = await getUsername();
        const lastUpdateTime = await getLastUpdateTime();
        const lastViewedTime = await getLastViewedTime();

        let pullRequests = null;

        try {
            if (token && username) {
                if (overridePRs) {
                    pullRequests = overridePRs;
                    if (!getFirstUpdateTime()) {
                        return;
                    }
                } else {
                    lastUpdateTimeElement.textContent = "Fetching latest pull requests.";

                    // NOTE: we can't fetch GitHub APIs in the main thread, it leads to CORS issues
                    // so we use a background script to run in the service worker
                    chrome.alarms.create('popupCheckForUpdates', { delayInMinutes: 0 });
                    return;
                }

                // TODO: hard coded Tab names / stored pull requests -- make them configurable
                const config = {
                    personal: pullRequests.personalPullRequests || pullRequests.personal,
                    mine: pullRequests.minePullRequests || pullRequests.mine,
                    team: pullRequests.teamPullRequests || pullRequests.team,
                    mention: pullRequests.mentionsPullRequests || pullRequests.mentions,
                    issues: pullRequests.issuesPullRequests || pullRequests.issues,
                    watched: pullRequests.watchedPullRequests || pullRequests.watched,
                };

                // Set all displays
                Object.keys(config).forEach((element) => {
                    const pullRequests = config[element];
                    const listElement = document.getElementById(`${element}-pull-requests-list`);
                    const key = element === 'mention' ? 'mentions' : element;
                    chrome.storage.local.set({ [`${key}PullRequests`]: pullRequests }, async function () {
                        // Setup filters for tabs with filter forms
                        if (TAB_KEYS.includes(element)) {
                            setupTabFilters(element, pullRequests, lastViewedTime);
                        } else if (listElement) {
                            // Fallback: just display cards
                            await displayPullRequestsCards(pullRequests, listElement, lastViewedTime, element);
                        }
                        displayBadgeCount(element, pullRequests, lastViewedTime);
                    });
                });

                await setupWorkloadFilters(config);

                if (lastViewedTime) {
                    await showReviewToast();
                }

                setLastUpdateTime();
                setLastError();
            }
        } catch (error) {
            setLastError("Error updating displays", error.message);
        }
    }

    async function showPopup() {
        credentialsDiv.classList.add('hidden');
        popupContainer.classList.remove('hidden');
        headerNav.classList.remove('hidden');

        const lastUpdateTime = await getLastUpdateTime();
        const lastError = await getLastError();

        if (lastUpdateTime) {
            lastUpdateTimeElement.textContent = `Last updated: ${lastUpdateTime}`;
        } else {
            lastUpdateTimeElement.textContent = '';
        }

        if (lastError) {
            lastErrorElement.textContent = `Error: ${lastError}`;
            lastErrorElement.classList.remove('hidden');
        } else {
            lastErrorElement.textContent = '';
            lastErrorElement.classList.add('hidden');
        }

        switchTab('personal'); // Set the default tab to "personal"
    }

    async function hidePopup() {
        credentialsDiv.classList.remove('hidden');
        popupContainer.classList.add('hidden');
        headerNav.classList.add('hidden');
        lastUpdateTimeElement.textContent = '';
        lastErrorElement.textContent = '';
        lastErrorElement.classList.add('hidden');
    }

    function updateDisplaysFromStorage() {
        // Check if username is stored in local storage
        // TODO: hard coded Tab names / stored pull requests -- make them configurable
        chrome.storage.local.get(['githubUsername', 'lastUpdateTime', 'lastError', 'minePullRequests', 'personalPullRequests', 'teamPullRequests', 'mentionsPullRequests', 'issuesPullRequests', 'watchedPullRequests'], async function (result) {
            const username = result.githubUsername
            const firstUpdateTime = await getFirstUpdateTime();

            if (username) {
                if(firstUpdateTime) {
                    updateDisplays(result);
                }
                await showPopup();
                updateExtensionBadge(0);
            } else {
                await hidePopup();
            }
        });
    }

    // Listen for changes to chrome.storage.local
    chrome.storage.onChanged.addListener((changes, namespace) => {
        // Did lastError change?
        if (namespace === 'local' && changes.lastError) {
            if (changes.lastError.newValue) {
                lastErrorElement.textContent = `Error: ${changes.lastError.newValue}`;
                lastErrorElement.classList.remove('hidden');
            } else {
                lastErrorElement.textContent = '';
                lastErrorElement.classList.add('hidden');
            }
        }

        // Did lastUpdateTime change?
        if (namespace === 'local' && changes.lastUpdateTime) {
            const lastUpdateTime = new Date(changes.lastUpdateTime.newValue).toLocaleString();
            lastUpdateTimeElement.textContent = `Last updated: ${lastUpdateTime}`;
            updateDisplaysFromStorage();
        }
    });

    appIconContainer.addEventListener('click', () => {
        chrome.storage.local.get(['githubUsername'], function (result) {
            const username = result.githubUsername;
            if (username) {
                window.open(`https://github.com/pulls/review-requested?page=1&q=is%3Aopen+is%3Apr+review-requested%3A${username}+archived%3Afalse`, '_blank');
            } else {
                window.open('https://github.com/pulls', '_blank');
            }
        });
    });

    loginButton.addEventListener('click', async () => {
        try {
            const token = tokenInput.value;
            const username = usernameInput.value;
            const apiBaseUrl = apiBaseUrlInput.value;
            if (token && username && apiBaseUrl) {
                chrome.storage.local.set({ githubToken: token, githubUsername: username, githubApiBaseUrl: apiBaseUrl }, function () {
                    credentialsDiv.classList.add('hidden');
                });
                
                lastUpdateTimeElement.textContent = "Fetching latest pull requests.";

                await updateDisplays();
            } else {
                alert('Please enter both your username and token.');
            }
        } catch (error) {
            setLastError(error.message);
        }
    });

    try {
        addWatchButton.addEventListener('click', async() => {
            await addWatchListUrl();
        });
    } catch (error) {
    }


    resetButton.addEventListener('click', async () => {
        await resetLocalStorage();
        resetUI();
        alert('Credentials and data have been reset.');
    });

    refreshButton.addEventListener('click', async () => {
        setLastError();
        updateDisplays();
    });

    settingsButton.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    recapTab.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/recap/recap.html') });
    });

    // Add event listeners to tabs
    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            const tabId = tab.id.replace('-tab', ''); // Extract the tab ID (e.g., "personal", "team", "mentions")
            switchTab(tabId);
        });
    });

    // Call setLastViewedTime when the popup becomes hidden
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            setLastViewedTime();
        }

        if (document.visibilityState === 'visible') {
            chrome.alarms.create('updateLastViewedTime',{delayInMinutes: 0.2});
        }
    });

    async function showReviewToast() {
        if (await shouldSuppressReviewToast()) return;

        // Gate 1: at least 7 days since first use
        const firstUpdateTime = await getFirstUpdateTime();
        if (!firstUpdateTime || (Date.now() - new Date(firstUpdateTime).getTime()) < 7 * 24 * 60 * 60 * 1000) return;

        // Gate 2: at least 15 popup opens (proves real engagement)
        const openCount = await getPopupOpenCount();
        if (openCount < 15) return;

        const toast = document.getElementById('review-toast');
        if (toast) toast.classList.remove('hidden');
        // Do NOT set any flag here — only on user action
    }

    // Dismiss = snooze (comes back in 14 days)
    document.getElementById('close-review-toast')?.addEventListener('click', () => {
        document.getElementById('review-toast').classList.add('hidden');
        snoozeReviewToast();
    });

    // Clicking the review link = permanent suppress.
    // Prevent default so the storage write commits before the popup can close.
    document.querySelector('#review-toast a')?.addEventListener('click', (e) => {
        e.preventDefault();
        const href = e.currentTarget.href;
        setReviewClicked().then(() => {
            window.open(href, '_blank');
        });
    });

    await incrementPopupOpenCount();
    updateDisplaysFromStorage();
});