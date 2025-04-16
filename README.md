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

## Usage

- Click on the GitPing extension icon in the Chrome toolbar to open the popup interface.
- Log in with your GitHub account to start retrieving Pull Requests.
- The extension will periodically check for new Pull Requests and notify you if any require your review.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.