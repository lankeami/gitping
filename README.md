![image](https://github.com/user-attachments/assets/be92371d-e519-415f-ad34-88a51efc4118)

# GitPing Extension

GitPing is a Chrome extension that helps developers keep track of open Pull Requests on GitHub that require their review. It periodically polls the GitHub API to retrieve the latest Pull Requests and provides notifications for new requests.

## Features

- User authentication with GitHub
- Periodic polling of GitHub for open Pull Requests
- Local storage of Pull Requests for offline access
- Browser alerts for new Pull Requests
- User-friendly popup interface to view and manage Pull Requests
- Options page for configuring settings such as polling intervals and authentication tokens

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/lankeami/gitping.git
   ```

2. Navigate to the extension directory:
   ```
   cd gitping
   ```

3. Open Chrome and go to `chrome://extensions/`.

4. Enable "Developer mode" in the top right corner.

5. Click on "Load unpacked" and select the `gitping` directory.

## Authentication

To authenticate with GitHub and allow the extension to retrieve your Pull Requests:

1. **Generate a GitHub Personal Access Token**:
   - Go to your GitHub account's [Personal Access Tokens page](https://github.com/settings/tokens).
   - Click on **"Generate new token (classic)"**.
   - Provide a descriptive name for the token (e.g., "GitPing Extension").
   - Under **Scopes**, select the following permissions:
     - `repo` (Full control of private repositories, if needed)
     - `read:org` (Read access to organization memberships)
   - Set the expiration to **"No expiration"** to make the token last forever.
   - Click **Generate token** and copy the token. **Save it securely**, as you won't be able to view it again.

2. **Log in to the Extension**:
   - Open the GitPing extension by clicking its icon in the Chrome toolbar.
   - Enter your GitHub username and paste the generated token into the respective fields.
   - Click **Login** to authenticate.

3. **Start Using the Extension**:
   - Once authenticated, the extension will start retrieving Pull Requests that require your review.
   - You can view the Pull Requests in the popup interface and receive notifications for new ones.

## Usage

- Click on the GitPing extension icon in the Chrome toolbar to open the popup interface.
- Log in with your GitHub account to start retrieving Pull Requests.
- The extension will periodically check for new Pull Requests and notify you if any require your review.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.
[(see license)](LICENSE)

## Security Policy

We'll notify user's of issues on our [security policy page](SECURITY.md).

## Privacy Policy

We don't collect and/or sell your information. All your information is stored locally on your browser's local storage. You can read more in our [Privacy Policy Page](PRIVACY_POLICY.md).
