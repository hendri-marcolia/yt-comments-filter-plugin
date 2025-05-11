# YouTube Comments Reader

## Description

This Chrome extension reads YouTube comments on shorts and watch pages. It identifies and blocks spam comments based on a predefined list of keywords and an optional AI-powered analysis. Users can customize the blocked keywords and whitelist specific words.

## Permissions

The extension requires the following permissions:

*   scripting
*   tabs
*   activeTab
*   storage

## Host Permissions

The extension requires access to the following hosts:

*   \*://\*.youtube.com/shorts/\*
*   \*://\*.youtube.com/watch\*

## Content Scripts

The extension uses the following content scripts:

*   content.js

## Installation

1.  Download the extension files.
2.  Open Chrome and go to `chrome://extensions`.
3.  Enable "Developer mode" in the top right corner.
4.  Click "Load unpacked" and select the directory where you downloaded the extension files.

## Usage

1.  Navigate to a YouTube short or watch page.
2.  The extension automatically identifies and blocks potential spam comments based on predefined keywords and AI analysis.
3.  Click the extension icon to open the popup.
4.  In the popup, you can:
    *   View blocked comments.
    *   Remove keywords from the blocklist.
    *   Whitelist keywords to prevent them from being blocked.
    *   Manage the blocklist and whitelist.
    *   Toggle the AI-powered analysis.
    *   Choose to remove spam comments entirely or just flag them.

## Files

*   `manifest.json`: The extension's manifest file.
*   `content.js`: The extension's content script.
*   `popup.html`: The extension's popup HTML file.
*   `popup.js`: The extension's popup JavaScript file.
*   `comments.js`: The extension's comments JavaScript file.
