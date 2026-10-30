# Privacy Policy for GitPing

## Introduction
GitPing is a Chrome extension that helps users monitor and manage GitHub pull requests requiring their review. Your privacy is important to us, and this policy explains how we handle your data.

## Data Collection and Usage
GitPing does not run its own servers and does not collect analytics. Your data is stored locally on your device and is sent only to GitHub's own services (the GitHub API, and GitHub Models when you generate a recap), using your own GitHub token.

### Data Stored Locally
- **GitHub Token**: Used to authenticate with the GitHub API to fetch pull requests requiring your review.
- **GitHub Username**: Used to personalize the pull request data fetched from GitHub.
- **Pull Request Data**: Includes information about open pull requests requiring your review. This data is fetched from GitHub and stored locally for display in the extension popup.
- **Last Update Time**: Tracks the last time the extension fetched pull request data.
- **Recap Summaries**: Activity recaps you generate are cached locally so they don't have to be regenerated.

### Permissions
GitPing requests the following permissions to function properly:
1. **`storage`**: To store your GitHub token, username, and pull request data locally on your device.
2. **`notifications`**: To send you notifications about new pull requests requiring your review.
3. **`alarms`**: To periodically poll GitHub for updates on pull requests.

### Content Scripts
GitPing does not inject content scripts into any web pages.

### Activity Recaps (GitHub Models)
When you click to generate an activity recap, GitPing sends a text summary of your GitHub activity for the date range you choose (pull requests, issues, reviews, and comments, up to roughly 42,000 characters) to GitHub Models (`models.github.ai`) so it can be summarized. The request is authenticated with your GitHub token and is handled under GitHub's own terms and privacy statement. Nothing is sent to GitHub Models unless you ask for a recap.

## Data Sharing
GitPing does not sell or share your data with any third parties. Data leaves your device only to reach GitHub (the GitHub API and GitHub Models), as described above.

## Security
GitPing uses the GitHub API to fetch pull request data. Your GitHub token is stored in Chrome's local storage and is never transmitted to any servers other than GitHub's.

## User Control
You have full control over the data stored by GitPing:
- You can reset the extension's data at any time by using the "Reset" button in the extension popup.
- You can remove the extension from Chrome to delete all stored data.

## Changes to This Policy
We may update this privacy policy from time to time. Any changes will be reflected in the updated version of the extension and on the extension's listing in the Chrome Web Store.

## Contact Us
If you have any questions or concerns about this privacy policy, please email help@gitping.app or open an issue at https://github.com/lankeami/gitping/issues.