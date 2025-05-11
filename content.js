console.log("YouTube Comments Reader extension loaded!");

const commentSelector = "yt-attributed-string[id='content-text']";
let seenComments = new Set();
let blockedComments = new Set();
let debounceTimer = null;
let lastCommentNode = null;

// Inject CSS to flag spam comments
const style = document.createElement('style');
style.textContent = `
  .spam-comment {
    border: 1px solid red !important;
    padding: 5px !important;
    margin-bottom: 5px !important;
    position: relative; /* Add relative positioning */
  }
  .spam-comment .comment-text {
    color: red !important;
    font-weight: bold !important;
    font-style: italic;
    display: none;
  }
  .spam-comment .placeholder {
    color: gray;
    font-style: italic;
    display: inline !important;
  }
  .spam-comment .hide-button {
    cursor: pointer;
    margin-left: 5px;
    color: blue;
  }
  .spam-comment.hidden .comment-text {
    display: inline !important;
  }
  .spam-comment.hidden .placeholder {
    display: none !important;
  }
  .spam-comment:not(.hidden) > .comment-text {
    display: inline !important;
  }
  .spam-comment:not(.hidden) > .placeholder {
    display: none !important;
  }
  .comment-wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 5px;
    padding: 5px;
    border: 1px solid red;
    background-color: #f8d7da;
    color: #721c24;
  }
`;
document.head.appendChild(style);

// Normalize fancy text to plain text
function normalizeFancyText(str) {
  const fancyMap = {
    // Fullwidth or Enclosed Alphanumerics
    '🅰': 'A', '🅱': 'B', '🅲': 'C', '🅳': 'D', '🅴': 'E', '🅵': 'F',
    '🅶': 'G', '🅷': 'H', '🅸': 'I', '🅹': 'J', '🅺': 'K', '🅻': 'L',
    '🅼': 'M', '🅽': 'N', '🅾': 'O', '🅿': 'P', '🆀': 'Q', '🆁': 'R',
    '🆂': 'S', '🆃': 'T', '🆄': 'U', '🆅': 'V', '🆆': 'W', '🆇': 'X',
    '🆈': 'Y', '🆉': 'Z',

    // Bold Math or Monospace
    '𝗔': 'A', '𝗕': 'B', '𝗖': 'C', '𝗗': 'D', '𝗘': 'E', '𝗙': 'F', '𝗚': 'G',
    '𝗛': 'H', '𝗜': 'I', '𝗝': 'J', '𝗞': 'K', '𝗟': 'L', '𝗠': 'M', '𝗡': 'N',
    '𝗢': 'O', '𝗣': 'P', '𝗤': 'Q', '𝗥': 'R', '𝗦': 'S', '𝗧': 'T', '𝗨': 'U',
    '𝗩': 'V', '𝗪': 'W', '𝗫': 'X', '𝗬': 'Y', '𝗭': 'Z',

    '𝙰': 'A', '𝙱': 'B', '𝙲': 'C', '𝙳': 'D', '𝙴': 'E', '𝙵': 'F', '𝙶': 'G',
    '𝙷': 'H', '𝙸': 'I', '𝙹': 'J', '𝙺': 'K', '𝙻': 'L', '𝙼': 'M', '𝙽': 'N',
    '𝙾': 'O', '𝙿': 'P', '𝚀': 'Q', '𝚁': 'R', '𝚂': 'S', '𝚃': 'T', '𝚄': 'U',
    '𝚅': 'V', '𝚆': 'W', '𝚇': 'X', '𝚈': 'Y', '𝚉': 'Z',

    // Stylized numerals
    '𝟴': '8', '𝟕': '7', '𝟔': '6', '𝟓': '5', '𝟒': '4', '𝟑': '3', '𝟐': '2', '𝟏': '1', '𝟎': '0',

    // Armenian etc.
    'է': 't', 'օ': 'o',

    // Add more fancy characters here
    '⒜': 'a', '⒝': 'b', '⒞': 'c', '⒟': 'd', '⒠': 'e', '⒡': 'f', '⒢': 'g',
    '⒣': 'h', '⒤': 'i', '⒥': 'j', '⒦': 'k', '⒧': 'l', '⒨': 'm', '⒩': 'n',
    '⒪': 'o', '⒫': 'p', '⒬': 'q', '⒭': 'r', '⒮': 's', '⒯': 't', '⒰': 'u',
    '⒱': 'v', '⒲': 'w', '⒳': 'x', '⒴': 'y', '⒵': 'z',

    'ⓐ': 'a', 'ⓑ': 'b', 'ⓒ': 'c', 'ⓓ': 'd', 'ⓔ': 'e', 'ⓕ': 'f', 'ⓖ': 'g',
    'ⓗ': 'h', 'ⓘ': 'i', 'ⓙ': 'j', 'ⓚ': 'k', 'ⓛ': 'l', 'ⓜ': 'm', 'ⓝ': 'n',
    'ⓞ': 'o', 'ⓟ': 'p', 'ⓠ': 'q', 'ⓡ': 'r', 'ⓢ': 's', 'ⓣ': 't', 'ⓤ': 'u',
    'ⓥ': 'v', 'ⓦ': 'w', 'ⓧ': 'x', 'ⓨ': 'y', 'ⓩ': 'z'
  };

  return Array.from(str).map(c => fancyMap[c] || c).join('')
    .normalize('NFKD')                                // Normalize Unicode variants
    .replace(/[\u0300-\u036f]/g, '')                  // Remove diacritics
    .replace(/[^a-zA-Z0-9]/g, '')                     // Strip non-alphanumerics
    .toLowerCase();                                   // Optional: uppercase everything;
}


// Extract clean text from a comment node (with emoji handling)
function extractTextFromNode(node) {
  let result = '';

  function traverse(child) {
    if (child.nodeType === Node.TEXT_NODE) {
      result += child.textContent;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      if (child.tagName === 'IMG' && child.alt) {
        result += child.alt;
      } else {
        Array.from(child.childNodes).forEach(traverse);
      }
    }
  }

  traverse(node);
  return result.trim();
}

let spamWords = ["MANDALIKA77", "WETON88", "exototo"];
// load the spamWords from local storage
chrome.storage.local.get("spamWords", function (result) {
  if (result.spamWords) {
    spamWords = result.spamWords;
  } else {
    // If no spam words are found, initialize with default values
    spamWords = ["MANDALIKA77", "WETON88", "exototo"];
  }
});

async function isSpam(comment) {
  // Simulate spam detection by checking if the comment includes the word "rezeki"
  // In a real-world scenario, you would use a more sophisticated method
  // such as a machine learning model or an external API.
  comment = normalizeFancyText(comment);
  comment = comment.toLowerCase();
  exists = spamWords.some(word => comment.includes(word.toLowerCase()));
  // if the filtering is not enough, let's hit the API
  // curl --request POST \
  // --url http://localhost:8080/analyze \
  // --header 'content-type: application/json' \
  // --data '{"comment": "Gassss terus ♥M♥A♥N♥D♥A♥L♥I♥K♥A♥7♥7♥"}'
  // Response:
  // {
  //   "spam": true,
  //   "keyword": "MANDALIKA77",
  //   "confidence": 0.95
  // }
  if (!exists) {
    const response = await fetch("http://localhost:8080/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment }),
    });

    if (response.ok) {
      const data = await response.json();
      exists = data.spam;
      const new_keyword = data.keyword;
      if (new_keyword && !spamWords.includes(new_keyword)) {
        spamWords.push(new_keyword);
        // Save the new keyword to local storage
        chrome.storage.local.set({ spamWords: spamWords }, function () {
          console.log("New keyword saved:", new_keyword);
        });
      }
    } else {
      console.error("Error fetching spam detection:", response.statusText);
    }
  }

  return exists;
}

// Get all new comments that haven't been seen
async function getNewComments() {
  const commentNodes = document.querySelectorAll(commentSelector);
  const newComments = [];
  let startNode = lastCommentNode ? Array.from(commentNodes).indexOf(lastCommentNode) + 1 : 0;

  for (let i = startNode; i < commentNodes.length; i++) {
    const node = commentNodes[i];
    const comment = extractTextFromNode(node);
    if (comment && !seenComments.has(comment)) {
      seenComments.add(comment);
      isSpam(comment).then(isSpamResult => {
        if (isSpamResult) {
          console.log("⚠️ Blocked comment detected:", comment);
          chrome.runtime.sendMessage({
            action: "NewBlockedComments",
            comment: comment,
          });

          node.classList.add("spam-comment", "hidden");

          // Create a placeholder
          const placeholderSpan = document.createElement('span');
          placeholderSpan.classList.add('placeholder');
          placeholderSpan.textContent = "This comment is blocked. Click to unhide.";

          // Create a hide button
          const hideButton = document.createElement('span');
          hideButton.classList.add('hide-button');
          hideButton.textContent = "Unhide";
          hideButton.addEventListener('click', () => {
            node.classList.toggle('hidden');
            hideButton.textContent = node.classList.contains('hidden') ? "Unhide" : "Hide";
          });

          // create a wrapper node for the placeholder and hide button
          const wrapperNode = document.createElement('div');
          // Add a class to the wrapper node (clear text and warning)
          wrapperNode.classList.add('comment-wrapper');
          wrapperNode.appendChild(placeholderSpan);
          wrapperNode.appendChild(hideButton);
          node.parentNode.insertBefore(wrapperNode, node.parentNode.firstChild);

          blockedComments.add(comment);
        } else {
          newComments.push(comment);
        }
      });
    }
    lastCommentNode = node;
  }
}

// Debounced mutation callback
function handleMutations() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => { await getNewComments(); }, 300); // 300ms debounce
}

// Attach MutationObserver to monitor comment section
function observeComments() {
  const commentContainer = document.querySelector("#comments");

  if (!commentContainer) {
    console.warn("⚠️ Comments container not found, retrying...");
    setTimeout(observeComments, 1000);
    return;
  }

  const observer = new MutationObserver(handleMutations);
  observer.observe(commentContainer, {
    childList: true,
    subtree: true,
  });

  console.log("✅ MutationObserver attached to comments.");
}

// Initial comment load
window.addEventListener("load", async () => {
  await getNewComments();
  observeComments();
});

// Respond to popup requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getBlockedComments") {
    // Convert Set to Array for sending
    blockedCommentsArr = Array.from(blockedComments);
    sendResponse({ comments: blockedCommentsArr });
  }
  if (request.action === "getBlockKeywords") {
    // Convert Set to Array for sending
    spamWordsArr = Array.from(spamWords);
    sendResponse({ keywords: spamWordsArr });
  }
  return true;
});
