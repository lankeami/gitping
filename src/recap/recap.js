import { getAuthToken, getUsername } from '../shared/storageUtils.js';
import { fetchYesterdayActivity } from '../shared/recapApi.js';
import { buildRecapMarkdown } from '../shared/recapMarkdown.js';
import { generateSummary, validateModelsAccess, DEFAULT_SYSTEM_PROMPT } from '../shared/githubModels.js';
import { getRecapCache, setRecapCache } from '../shared/recapStorage.js';

// Storage key for custom prompt
const CUSTOM_PROMPT_KEY = 'gitping_custom_prompt';

// DOM Elements - initialized after DOMContentLoaded
let elements = {};

// State
let currentMarkdown = '';
let currentSummary = '';

/**
 * Get the selected date range from the inputs
 * @param {string} prefix - 'controls' or 'result' to determine which inputs to read
 * @returns {{ startDate: string, endDate: string }}
 */
function getSelectedDateRange(prefix = '') {
    const startId = prefix ? `${prefix}-start-date` : 'start-date';
    const endId = prefix ? `${prefix}-end-date` : 'end-date';
    const startInput = document.getElementById(startId);
    const endInput = document.getElementById(endId);
    return {
        startDate: startInput?.value || getDefaultStartDate(),
        endDate: endInput?.value || getDefaultEndDate()
    };
}

/**
 * Format a date as YYYY-MM-DD in local timezone
 */
function formatDateLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get default start date (yesterday in local timezone)
 */
function getDefaultStartDate() {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return formatDateLocal(date);
}

/**
 * Get default end date (yesterday in local timezone)
 */
function getDefaultEndDate() {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return formatDateLocal(date);
}

/**
 * Format date range for display
 */
function formatDateRangeString(startDate, endDate) {
    const formatDate = (dateStr) => {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    if (startDate === endDate) {
        return formatDate(startDate);
    }
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

/**
 * Get cache key based on date range
 */
function getCacheKey(startDate, endDate) {
    return `recap_${startDate}_${endDate}`;
}

/**
 * Sync date inputs between controls and result sections
 */
function syncDateInputs(startDate, endDate) {
    const inputs = [
        document.getElementById('start-date'),
        document.getElementById('end-date'),
        document.getElementById('result-start-date'),
        document.getElementById('result-end-date')
    ];

    if (inputs[0]) inputs[0].value = startDate;
    if (inputs[1]) inputs[1].value = endDate;
    if (inputs[2]) inputs[2].value = startDate;
    if (inputs[3]) inputs[3].value = endDate;
}

/**
 * Initialize date inputs with default values
 */
function initializeDateInputs() {
    const startDate = getDefaultStartDate();
    const endDate = getDefaultEndDate();
    const today = new Date().toISOString().split('T')[0];

    // Set values and max constraints
    const inputs = [
        { el: document.getElementById('start-date'), value: startDate },
        { el: document.getElementById('end-date'), value: endDate },
        { el: document.getElementById('result-start-date'), value: startDate },
        { el: document.getElementById('result-end-date'), value: endDate }
    ];

    inputs.forEach(({ el, value }) => {
        if (el) {
            el.value = value;
            el.max = today;
        }
    });
}

/**
 * Load custom prompt from storage
 */
async function loadCustomPrompt() {
    try {
        const result = await chrome.storage.local.get(CUSTOM_PROMPT_KEY);
        return result[CUSTOM_PROMPT_KEY] || null;
    } catch (err) {
        console.error('[Recap] Failed to load custom prompt:', err);
        return null;
    }
}

/**
 * Save custom prompt to storage
 */
async function saveCustomPrompt(prompt) {
    try {
        if (prompt && prompt.trim() !== DEFAULT_SYSTEM_PROMPT.trim()) {
            await chrome.storage.local.set({ [CUSTOM_PROMPT_KEY]: prompt });
            return true;
        } else {
            // If it's the default, remove the custom setting
            await chrome.storage.local.remove(CUSTOM_PROMPT_KEY);
            return false;
        }
    } catch (err) {
        console.error('[Recap] Failed to save custom prompt:', err);
        return false;
    }
}

/**
 * Get the current prompt (custom or default)
 */
async function getCurrentPrompt() {
    const customPrompt = await loadCustomPrompt();
    return customPrompt || DEFAULT_SYSTEM_PROMPT;
}

/**
 * Initialize the prompt textarea
 */
async function initializePromptTextarea() {
    const textarea = document.getElementById('custom-prompt');
    const statusEl = document.getElementById('prompt-status');

    if (!textarea) return;

    const customPrompt = await loadCustomPrompt();
    textarea.value = customPrompt || DEFAULT_SYSTEM_PROMPT;

    if (customPrompt) {
        if (statusEl) statusEl.textContent = 'Using custom prompt';
    }

    // Auto-save on change (debounced)
    let saveTimeout;
    textarea.addEventListener('input', () => {
        if (statusEl) statusEl.textContent = 'Saving...';
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            const isCustom = await saveCustomPrompt(textarea.value);
            if (statusEl) {
                statusEl.textContent = isCustom ? 'Custom prompt saved' : 'Using default prompt';
            }
        }, 500);
    });
}

/**
 * Show a specific section, hiding all others
 */
function showSection(sectionId) {
    ['auth-error', 'controls', 'progress', 'error', 'result', 'empty-activity'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.toggle('hidden', id !== sectionId);
        }
    });
}

/**
 * Update progress message
 */
function setProgress(message) {
    console.log('[Recap]', message);
    if (elements.progressMessage) {
        elements.progressMessage.textContent = message;
    }
}

/**
 * Show error state
 */
function showError(message) {
    console.error('[Recap] Error:', message);
    if (elements.errorMessage) {
        elements.errorMessage.textContent = message;
    }
    showSection('error');
}

/**
 * Display the recap results
 */
function displayResults(summary, markdown) {
    currentSummary = summary;
    currentMarkdown = markdown;

    // Parse and render the summary as HTML (basic markdown to HTML)
    if (elements.summaryContent) {
        elements.summaryContent.innerHTML = markdownToHtml(summary);
    }
    if (elements.rawMarkdown) {
        elements.rawMarkdown.textContent = markdown;
    }

    showSection('result');
}

/**
 * Basic markdown to HTML converter for the summary
 */
function markdownToHtml(markdown) {
    if (!markdown) return '';

    return markdown
        // Normalize multiple newlines to max 2
        .replace(/\n{3,}/g, '\n\n')
        // Headers (order matters - match longer patterns first)
        .replace(/^##### (.*$)/gm, '<h5>$1</h5>')
        .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Code
        .replace(/`(.*?)`/g, '<code>$1</code>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
        // Unordered lists
        .replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        // Remove newlines after block elements (headers, lists)
        .replace(/(<\/h[1-5]>)\n+/g, '$1')
        .replace(/(<\/ul>)\n+/g, '$1')
        .replace(/(<\/li>)\n+(?=<li>)/g, '$1')
        // Paragraphs (double newlines)
        .replace(/\n\n/g, '</p><p>')
        // Single newlines within paragraphs
        .replace(/\n/g, '<br>')
        // Wrap in paragraph
        .replace(/^(.*)$/, '<p>$1</p>')
        // Clean up empty paragraphs and extra breaks
        .replace(/<p><\/p>/g, '')
        .replace(/<p><br><\/p>/g, '')
        .replace(/<br><br>/g, '<br>')
        .replace(/<p><br>/g, '<p>')
        .replace(/<br><\/p>/g, '</p>');
}

/**
 * Copy text to clipboard and show toast
 */
async function copyToClipboard(text, label = 'Copied!') {
    try {
        await navigator.clipboard.writeText(text);
        showToast(label);
    } catch (err) {
        console.error('Failed to copy:', err);
        showToast('Failed to copy');
    }
}

/**
 * Show a toast notification
 */
function showToast(message) {
    // Remove existing toast if any
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Remove after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 200);
    }, 2000);
}

/**
 * Main recap generation flow
 */
async function generateRecap(forceRegenerate = false, dateRange = null) {
    // Get date range from parameter or from inputs
    const { startDate, endDate } = dateRange || getSelectedDateRange();
    console.log('[Recap] Starting generation, forceRegenerate:', forceRegenerate, 'dateRange:', { startDate, endDate });

    // Sync date inputs to ensure consistency
    syncDateInputs(startDate, endDate);

    const cacheKey = getCacheKey(startDate, endDate);

    // Update the date display
    if (elements.recapDate) {
        elements.recapDate.textContent = `Activity from ${formatDateRangeString(startDate, endDate)}`;
    }

    // Check cache first (unless regenerating)
    if (!forceRegenerate) {
        try {
            const cached = await getRecapCache(cacheKey);
            if (cached) {
                console.log('[Recap] Found cached recap');
                displayResults(cached.summary, cached.markdown);
                return;
            }
        } catch (err) {
            console.error('[Recap] Cache check failed:', err);
        }
    }

    showSection('progress');

    try {
        // Get auth credentials
        setProgress('Checking authentication...');
        const token = await getAuthToken();
        const username = await getUsername();

        console.log('[Recap] Auth check - username:', username, 'token exists:', !!token);

        if (!token || !username) {
            showSection('auth-error');
            return;
        }

        // Phase 1: Fetch activity
        setProgress(`Fetching GitHub activity from ${formatDateRangeString(startDate, endDate)}...`);
        const activity = await fetchYesterdayActivity(username, token, startDate, endDate);
        console.log('[Recap] Activity fetched:', {
            prs: activity?.prs?.length || 0,
            issues: activity?.issues?.length || 0
        });

        // Check if there's any activity
        if (!activity || (activity.prs.length === 0 && activity.issues.length === 0)) {
            showSection('empty-activity');
            return;
        }

        // Phase 2: Build markdown document
        setProgress('Building activity document...');
        const markdown = buildRecapMarkdown(activity, username);
        console.log('[Recap] Markdown built, length:', markdown?.length || 0);

        if (!markdown || markdown.trim().length === 0) {
            showSection('empty-activity');
            return;
        }

        // Phase 3: Try to generate AI summary (but don't fail if Models isn't available)
        let summary = '';
        try {
            setProgress('Validating GitHub Models access...');
            const validation = await validateModelsAccess(token);
            console.log('[Recap] Models validation:', validation);

            if (validation.valid) {
                setProgress('Generating AI summary...');
                const customPrompt = await loadCustomPrompt();
                summary = await generateSummary(markdown, token, setProgress, customPrompt);
                console.log('[Recap] Summary generated, length:', summary?.length || 0);
            } else {
                console.warn('[Recap] GitHub Models not available:', validation.error);
                summary = `*AI summary unavailable: ${validation.error}*\n\nSee raw activity data below.`;
            }
        } catch (aiErr) {
            console.error('[Recap] AI summary failed:', aiErr);
            summary = `*AI summary failed: ${aiErr.message}*\n\nSee raw activity data below.`;
        }

        // Cache the results
        await setRecapCache(cacheKey, { summary, markdown });

        // Display results
        displayResults(summary, markdown);

    } catch (err) {
        console.error('[Recap] Generation failed:', err);
        showError(err.message || 'An unexpected error occurred. Please try again.');
    }
}

/**
 * Initialize DOM element references
 */
function initElements() {
    elements = {
        recapDate: document.getElementById('recap-date'),
        startDate: document.getElementById('start-date'),
        endDate: document.getElementById('end-date'),
        resultStartDate: document.getElementById('result-start-date'),
        resultEndDate: document.getElementById('result-end-date'),
        applyDateBtn: document.getElementById('apply-date-btn'),
        customPrompt: document.getElementById('custom-prompt'),
        resetPromptBtn: document.getElementById('reset-prompt-btn'),
        promptStatus: document.getElementById('prompt-status'),
        authError: document.getElementById('auth-error'),
        controls: document.getElementById('controls'),
        progress: document.getElementById('progress'),
        progressMessage: document.getElementById('progress-message'),
        error: document.getElementById('error'),
        errorMessage: document.getElementById('error-message'),
        result: document.getElementById('result'),
        summaryContent: document.getElementById('summary-content'),
        rawMarkdown: document.getElementById('raw-markdown'),
        emptyActivity: document.getElementById('empty-activity'),
        generateBtn: document.getElementById('generate-btn'),
        regenerateBtn: document.getElementById('regenerate-btn'),
        retryBtn: document.getElementById('retry-btn'),
        copyBtn: document.getElementById('copy-btn'),
        copyRawBtn: document.getElementById('copy-raw-btn'),
        openSettingsBtn: document.getElementById('open-settings-btn')
    };
    console.log('[Recap] Elements initialized');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    elements.generateBtn?.addEventListener('click', () => generateRecap(false));
    elements.regenerateBtn?.addEventListener('click', () => generateRecap(true));
    elements.retryBtn?.addEventListener('click', () => generateRecap(false));

    elements.copyBtn?.addEventListener('click', () => {
        copyToClipboard(currentSummary, 'Summary copied!');
    });

    elements.copyRawBtn?.addEventListener('click', () => {
        copyToClipboard(currentMarkdown, 'Raw markdown copied!');
    });

    elements.openSettingsBtn?.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // Apply new date range from result section
    elements.applyDateBtn?.addEventListener('click', () => {
        const startDate = elements.resultStartDate?.value;
        const endDate = elements.resultEndDate?.value;
        if (startDate && endDate) {
            generateRecap(false, { startDate, endDate });
        }
    });

    // Reset prompt to default
    elements.resetPromptBtn?.addEventListener('click', async () => {
        if (elements.customPrompt) {
            elements.customPrompt.value = DEFAULT_SYSTEM_PROMPT;
            await saveCustomPrompt(DEFAULT_SYSTEM_PROMPT);
            if (elements.promptStatus) {
                elements.promptStatus.textContent = 'Reset to default prompt';
            }
        }
    });

    // Sync date inputs when controls section dates change
    elements.startDate?.addEventListener('change', () => {
        const { startDate, endDate } = getSelectedDateRange();
        syncDateInputs(startDate, endDate);
        if (elements.recapDate) {
            elements.recapDate.textContent = `Activity from ${formatDateRangeString(startDate, endDate)}`;
        }
    });

    elements.endDate?.addEventListener('change', () => {
        const { startDate, endDate } = getSelectedDateRange();
        syncDateInputs(startDate, endDate);
        if (elements.recapDate) {
            elements.recapDate.textContent = `Activity from ${formatDateRangeString(startDate, endDate)}`;
        }
    });

    console.log('[Recap] Event listeners attached');
}

/**
 * Initialize the page
 */
async function init() {
    console.log('[Recap] Initializing...');

    // Initialize DOM references
    initElements();

    // Setup event listeners
    setupEventListeners();

    // Initialize date inputs with defaults
    initializeDateInputs();

    // Initialize prompt textarea
    await initializePromptTextarea();

    // Set the initial date display
    const { startDate, endDate } = getSelectedDateRange();
    if (elements.recapDate) {
        elements.recapDate.textContent = `Activity from ${formatDateRangeString(startDate, endDate)}`;
    }

    // Check authentication
    const token = await getAuthToken();
    console.log('[Recap] Token exists:', !!token);

    if (!token) {
        showSection('auth-error');
        return;
    }

    // Check for cached recap
    const cacheKey = getCacheKey(startDate, endDate);
    try {
        const cached = await getRecapCache(cacheKey);
        if (cached) {
            console.log('[Recap] Showing cached recap');
            displayResults(cached.summary, cached.markdown);
        } else {
            console.log('[Recap] No cache, showing controls');
            showSection('controls');
        }
    } catch (err) {
        console.error('[Recap] Cache check failed:', err);
        showSection('controls');
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
