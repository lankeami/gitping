# Privacy Policy for GitPing

## Introduction
GitPing is a Chrome extension that helps users monitor and manage GitHub pull requests requiring their review. Your privacy is important to us, and this policy explains how we handle your data.

## Data Collection and Usage
GitPing does not collect, transmit, or store any personal data on external servers. All data is stored locally on your device and is used solely to provide the functionality of the extension.

### Data Stored Locally
- **GitHub Token**: Used to authenticate with the GitHub API to fetch pull requests requiring your review.
- **GitHub Username**: Used to personalize the pull request data fetched from GitHub.
- **Pull Request Data**: Includes information about open pull requests requiring your review. This data is fetched from GitHub and stored locally for display in the extension popup.
- **Last Update Time**: Tracks the last time the extension fetched pull request data.

### Permissions
GitPing requests the following permissions to function properly:
1. **`storage`**: To store your GitHub token, username, and pull request data locally on your device.
2. **`notifications`**: To send you notifications about new pull requests requiring your review.
3. **`activeTab`**: To open GitHub pages when you interact with the extension.
4. **`tabs`**: To check for existing GitHub tabs and manage navigation to GitHub pages.
5. **`alarms`**: To periodically poll GitHub for updates on pull requests.

### Content Scripts
GitPing injects a content script into web pages using the `"<all_urls>"` match pattern. However, the script is designed to only interact with GitHub pages. No data is collected or transmitted from non-GitHub pages.

## Data Sharing
GitPing does not share your data with any third parties. All data remains on your device and is used solely for the purpose of providing the extension's functionality.

## Security
GitPing uses the GitHub API to fetch pull request data. Your GitHub token is stored securely in Chrome's local storage and is never transmitted to any external servers other than GitHub.

## User Control
You have full control over the data stored by GitPing:
- You can reset the extension's data at any time by using the "Reset" button in the extension popup.
- You can remove the extension from Chrome to delete all stored data.

## Changes to This Policy
We may update this privacy policy from time to time. Any changes will be reflected in the updated version of the extension and on the extension's listing in the Chrome Web Store.

## Contact Us
If you have any questions or concerns about this privacy policy, please contact us at [your-email@example.com].