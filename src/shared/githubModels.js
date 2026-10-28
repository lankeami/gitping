/**
 * GitHub Models API Integration
 * Uses the GitHub Models inference API for AI-powered summarization
 */

const GITHUB_MODELS_URL = 'https://models.github.ai/inference/chat/completions';
const MODEL_ID = 'openai/gpt-4o-mini';

// GPT-4o-mini has 16K token limit, leave room for system prompt (~500) and response (~1500)
const MAX_INPUT_TOKENS = 14000;
// Approximate characters per token (conservative estimate)
const CHARS_PER_TOKEN = 3;
const MAX_INPUT_CHARS = MAX_INPUT_TOKENS * CHARS_PER_TOKEN; // ~42000 chars

// Threshold for using hierarchical summarization (slightly below max to be safe)
const HIERARCHICAL_THRESHOLD_CHARS = 40000;

/**
 * System prompt for generating summaries (exported as default)
 */
export const DEFAULT_SYSTEM_PROMPT = `You are a senior engineer creating a technical recap of GitHub activity for an engineering team.

Analyze the provided markdown document containing ALL PRs, issues, reviews, and comments from the specified time period. Focus on the technical substance of each change.

For each PR, Issue, and Conversation, identify and categorize:
1. **Architectural Changes & Refactors:** Major structural changes, new patterns, system redesigns
2. **Code Quality & Tech Debt:** Cleanup efforts, code improvements, debt reduction
3. **Performance & Bug Fixes:** Optimizations, latency improvements, bug resolutions
4. **Dependencies & Security:** Package updates, vulnerability patches, security fixes
5. **Testing:** New tests, coverage improvements, test infrastructure changes
6. **Breaking Changes:** API changes, migration requirements, deprecations

Guidelines:
- Use bullet points with specific technical details
- Include PR/issue numbers for reference
- Note the scope of impact (single service vs. cross-cutting)
- Highlight items needing the user's review or attention
- Call out any breaking changes or migration steps required
- Group by technical category, then by repository
- Minimize whitespace - no extra blank lines between sections
- Create sub sections per PR or Issue with these sections (skip where not applicable):
  - Technical Overview - be descriptive and clear here. Favor understanding instead of brevity.
  - Architectural Changes & Refactors
  - Code Quality & Tech Debt
  - Performance Optimizations & Bug Fixes
  - Dependencies & Security Updates
  - Testing Improvements
  - Breaking Changes & Migrations
  - Items Requiring Your Attention`;

/**
 * System prompt for summarizing a single organization's activity
 */
const ORG_SUMMARY_PROMPT = `You are a senior engineer summarizing GitHub activity for a single organization.

Analyze the provided markdown containing PRs, issues, reviews, and comments. Focus on technical substance.

For each PR, Issue, and Conversation, categorize into:
- **Architectural/Refactors:** Major structural changes, new patterns
- **Code Quality/Tech Debt:** Cleanup, improvements, debt reduction
- **Performance/Bug Fixes:** Optimizations, bug resolutions
- **Dependencies/Security:** Package updates, vulnerability fixes
- **Testing:** New tests, coverage improvements
- **Breaking Changes:** API changes, migrations needed

Guidelines:
- Keep under 400 words
- Use bullet points with PR/issue numbers
- Note technical impact and scope
- Highlight items needing user's attention
- Group by technical category`;

/**
 * System prompt for combining organization summaries into final recap
 */
const COMBINE_SUMMARIES_PROMPT = `You are a senior engineer creating a unified technical recap by combining summaries from multiple organizations.

Create a cohesive technical summary that:
1. Consolidates architectural changes and refactors across all orgs
2. Groups code quality improvements and tech debt reduction efforts
3. Summarizes performance optimizations and bug fixes
4. Lists dependency updates and security patches
5. Highlights testing improvements
6. Calls out breaking changes and migration requirements
7. Prioritizes items needing the user's attention

Guidelines:
- Keep the final summary under 1000 words total
- Merge similar technical themes across organizations
- Include PR/issue numbers for reference
- Note cross-cutting concerns that span multiple repos
- Prioritize breaking changes and items requiring user action
- Use clear technical language for engineering audience

Format the response as markdown with these sections:
## Technical Overview
## Architectural Changes & Refactors
## Code Quality & Tech Debt
## Performance Optimizations & Bug Fixes
## Dependencies & Security Updates
## Testing Improvements
## Breaking Changes & Migrations
## Items Requiring Your Attention`;

/**
 * Validate that the token has access to GitHub Models
 * @param {string} token - GitHub token
 * @returns {Promise<{ valid: boolean, error?: string }>}
 */
export async function validateModelsAccess(token) {
    try {
        // Make a minimal request to test access
        const response = await fetch(GITHUB_MODELS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                model: MODEL_ID,
                messages: [
                    { role: 'user', content: 'Hi' }
                ],
                max_tokens: 5
            })
        });

        if (response.ok) {
            return { valid: true };
        }

        if (response.status === 401) {
            return {
                valid: false,
                error: 'Your GitHub token is invalid or expired. Please update it in Settings.'
            };
        }

        if (response.status === 403) {
            const errorData = await response.json().catch(() => ({}));
            const message = errorData.message || errorData.error?.message || '';

            if (message.includes('scope') || message.includes('permission')) {
                return {
                    valid: false,
                    error: 'Your GitHub token needs the "models:read" scope. Please update your token with this permission.'
                };
            }

            return {
                valid: false,
                error: `Access denied to GitHub Models. Error: ${message}`
            };
        }

        if (response.status === 429) {
            return {
                valid: false,
                error: 'GitHub Models rate limit exceeded. Please try again later.'
            };
        }

        return {
            valid: false,
            error: `Failed to access GitHub Models (status ${response.status})`
        };

    } catch (err) {
        console.error('Error validating GitHub Models access:', err);
        return {
            valid: false,
            error: `Network error: ${err.message}`
        };
    }
}

/**
 * Split markdown document by organization boundaries
 * @param {string} markdown - The full markdown document
 * @returns {Array<{org: string, content: string}>} Array of org chunks
 */
function chunkByOrganization(markdown) {
    const lines = markdown.split('\n');
    const chunks = [];
    let currentOrg = null;
    let currentContent = [];
    let headerLines = [];

    // Capture any header content before the first org
    let inHeader = true;

    for (const line of lines) {
        if (line.startsWith('## Organization:')) {
            // Save previous org if exists
            if (currentOrg) {
                chunks.push({
                    org: currentOrg,
                    content: [...headerLines, ...currentContent].join('\n')
                });
            }

            inHeader = false;
            currentOrg = line.replace('## Organization:', '').trim();
            currentContent = [line];
        } else if (inHeader) {
            headerLines.push(line);
        } else if (currentOrg) {
            currentContent.push(line);
        }
    }

    // Save last org
    if (currentOrg) {
        chunks.push({
            org: currentOrg,
            content: [...headerLines, ...currentContent].join('\n')
        });
    }

    return chunks;
}

/**
 * Make a single API call to GitHub Models
 * @param {string} systemPrompt - The system prompt
 * @param {string} userContent - The user message content
 * @param {string} token - GitHub token
 * @param {number} maxTokens - Max response tokens
 * @returns {Promise<string>} The response content
 */
async function callGitHubModels(systemPrompt, userContent, token, maxTokens = 800) {
    const response = await fetch(GITHUB_MODELS_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            model: MODEL_ID,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ],
            max_tokens: maxTokens,
            temperature: 0.3
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new GitHubModelsError(
            response.status,
            errorData.message || errorData.error?.message || response.statusText
        );
    }

    const data = await response.json();
    if (!data.choices || data.choices.length === 0) {
        throw new Error('No response received from GitHub Models');
    }

    return data.choices[0].message.content;
}

/**
 * Summarize a single organization's activity
 * @param {{org: string, content: string}} chunk - The org chunk
 * @param {string} token - GitHub token
 * @returns {Promise<{org: string, summary: string}>}
 */
async function summarizeOrgChunk(chunk, token) {
    const prompt = `Here is GitHub activity for the "${chunk.org}" organization. Please summarize:\n\n${chunk.content}`;
    const summary = await callGitHubModels(ORG_SUMMARY_PROMPT, prompt, token, 600);
    return { org: chunk.org, summary };
}

/**
 * Combine organization summaries into a final unified summary
 * @param {Array<{org: string, summary: string}>} orgSummaries - Summaries for each org
 * @param {string} token - GitHub token
 * @param {string} customPrompt - Optional custom system prompt
 * @returns {Promise<string>} The combined summary
 */
async function combineOrgSummaries(orgSummaries, token, customPrompt = null) {
    const combined = orgSummaries
        .map(({ org, summary }) => `### ${org}\n${summary}`)
        .join('\n\n');

    const systemPrompt = customPrompt || COMBINE_SUMMARIES_PROMPT;
    const prompt = `Here are summaries of GitHub activity from multiple organizations. Please combine them into a unified recap:\n\n${combined}`;
    return callGitHubModels(systemPrompt, prompt, token, 1500);
}

/**
 * Generate a hierarchical summary using map-reduce for large documents
 * @param {string} markdownDocument - The full activity document
 * @param {string} token - GitHub token
 * @param {function} onProgress - Optional progress callback
 * @param {string} customPrompt - Optional custom system prompt
 * @returns {Promise<string>} The generated summary
 */
export async function generateHierarchicalSummary(markdownDocument, token, onProgress = null, customPrompt = null) {
    console.log(`[GitHubModels] Starting hierarchical summarization`);

    // Step 1: Chunk by organization
    const chunks = chunkByOrganization(markdownDocument);
    console.log(`[GitHubModels] Split into ${chunks.length} organization chunks`);

    if (chunks.length === 0) {
        throw new Error('No organization data found in document');
    }

    // If only one org and it fits, use direct summarization
    if (chunks.length === 1 && chunks[0].content.length <= MAX_INPUT_CHARS) {
        if (onProgress) onProgress('Generating summary...');
        return generateSummary(chunks[0].content, token, null, customPrompt);
    }

    // Step 2: Summarize each org in parallel
    if (onProgress) onProgress(`Summarizing ${chunks.length} organizations...`);

    const summaryPromises = chunks.map(async (chunk, index) => {
        // Check if chunk itself needs truncation
        let content = chunk.content;
        if (content.length > MAX_INPUT_CHARS) {
            console.log(`[GitHubModels] Truncating org "${chunk.org}" from ${content.length} to ${MAX_INPUT_CHARS} chars`);
            content = truncateDocument(content, MAX_INPUT_CHARS);
        }

        const result = await summarizeOrgChunk({ ...chunk, content }, token);
        if (onProgress) onProgress(`Summarized ${index + 1}/${chunks.length} organizations...`);
        return result;
    });

    const orgSummaries = await Promise.all(summaryPromises);
    console.log(`[GitHubModels] Completed ${orgSummaries.length} org summaries`);

    // Step 3: Combine summaries
    if (onProgress) onProgress('Combining organization summaries...');
    const finalSummary = await combineOrgSummaries(orgSummaries, token, customPrompt);

    console.log(`[GitHubModels] Final summary generated, length: ${finalSummary.length}`);
    return finalSummary;
}

/**
 * Generate a summary of the markdown document using GitHub Models
 * Uses hierarchical summarization for large documents
 * @param {string} markdownDocument - The activity document to summarize
 * @param {string} token - GitHub token with models:read scope
 * @param {function} onProgress - Optional progress callback
 * @param {string} customPrompt - Optional custom system prompt
 * @returns {Promise<string>} The generated summary
 */
export async function generateSummary(markdownDocument, token, onProgress = null, customPrompt = null) {
    const systemPrompt = customPrompt || DEFAULT_SYSTEM_PROMPT;

    console.log(`[GitHubModels] Original document size: ${markdownDocument.length} chars (~${Math.ceil(markdownDocument.length / CHARS_PER_TOKEN)} tokens)`);
    console.log(`[GitHubModels] Using ${customPrompt ? 'custom' : 'default'} prompt`);

    // Use hierarchical summarization for very large documents
    if (markdownDocument.length > HIERARCHICAL_THRESHOLD_CHARS) {
        console.log(`[GitHubModels] Document exceeds ${HIERARCHICAL_THRESHOLD_CHARS} chars, using hierarchical summarization`);
        return generateHierarchicalSummary(markdownDocument, token, onProgress, customPrompt);
    }

    // Standard single-call summarization
    let content = markdownDocument;
    if (content.length > MAX_INPUT_CHARS) {
        content = truncateDocument(content, MAX_INPUT_CHARS);
    }

    console.log(`[GitHubModels] Final document size: ${content.length} chars (~${Math.ceil(content.length / CHARS_PER_TOKEN)} tokens)`);
    console.log(`[GitHubModels] Max allowed: ${MAX_INPUT_CHARS} chars (~${MAX_INPUT_TOKENS} tokens)`);

    if (onProgress) onProgress('Generating AI summary...');

    const requestBody = {
        model: MODEL_ID,
        messages: [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: `Here is my GitHub activity from yesterday. Please provide a summary:\n\n${content}`
            }
        ],
        max_tokens: 1500,
        temperature: 0.3
    };

    try {
        const response = await fetch(GITHUB_MODELS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new GitHubModelsError(
                response.status,
                errorData.message || errorData.error?.message || response.statusText
            );
        }

        const data = await response.json();

        if (!data.choices || data.choices.length === 0) {
            throw new Error('No response received from GitHub Models');
        }

        return data.choices[0].message.content;

    } catch (err) {
        if (err instanceof GitHubModelsError) {
            throw err;
        }
        console.error('Error generating summary:', err);
        throw new Error(`Failed to generate summary: ${err.message}`);
    }
}

/**
 * Truncate a markdown document intelligently
 * Prioritizes items that involve the user, then truncates older/less relevant items
 */
function truncateDocument(content, maxChars) {
    // If we can fit everything, return as-is
    if (content.length <= maxChars) {
        return content;
    }

    console.log(`[GitHubModels] Truncating document from ${content.length} to ${maxChars} chars`);

    const lines = content.split('\n');
    const result = [];
    let currentLength = 0;
    let inHighPrioritySection = false;
    let sectionsIncluded = 0;
    let sectionsTruncated = 0;

    for (const line of lines) {
        // Always include headers and stats
        if (line.startsWith('# ') || line.startsWith('**') || line.startsWith('## Summary')) {
            result.push(line);
            currentLength += line.length + 1;
            continue;
        }

        // Track if we're in a section that involves the user
        if (line.includes('Your Role:') && !line.includes('participant')) {
            inHighPrioritySection = true;
        }

        // New org/repo section
        if (line.startsWith('## Organization:') || line.startsWith('### Repository:')) {
            inHighPrioritySection = false;
            sectionsIncluded++;
        }

        // Check if adding this line would exceed limit
        if (currentLength + line.length + 1 > maxChars - 200) {
            sectionsTruncated++;
            if (sectionsTruncated === 1) {
                result.push('');
                result.push(`[... ${lines.length - result.length} more lines truncated to fit model context limit]`);
            }
            continue;
        }

        result.push(line);
        currentLength += line.length + 1;
    }

    console.log(`[GitHubModels] Kept ${result.length} lines, truncated ${sectionsTruncated} sections`);
    return result.join('\n');
}

/**
 * Custom error class for GitHub Models errors
 */
class GitHubModelsError extends Error {
    constructor(status, message) {
        super(message);
        this.name = 'GitHubModelsError';
        this.status = status;
    }
}
