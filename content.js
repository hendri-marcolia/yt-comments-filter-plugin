console.log("YouTube Comments Reader extension loaded!");

const commentSelector = "yt-attributed-string[id='content-text']";
let seenComments = new Set();
let blockedComments = new Set();
let debounceTimer = null;
let observerTimer = null;
let debounceMutationList = [];
let observer = null;

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
let whitelist = ["N/A", "BIBOINI", "GenericGambling"].map(word => word.toLowerCase());
// load the spamWords from local storage
chrome.storage.local.get("spamWords", function (result) {
  if (result.spamWords) {
    spamWords = result.spamWords;
    spamWords = spamWords.filter(word => !whitelist.includes(word)).map(word => word.toLowerCase());
  } else {
    // If no spam words are found, initialize with default values
    spamWords = ["MANDALIKA77", "WETON88", "exototo"].map(word => word.toLowerCase());
  }
});
// load the whitelist from local storage
chrome.storage.local.get("whitelist", function (result) {
  if (result.whitelist) {
    whitelist = result.whitelist;
    whitelist = whitelist.map(word => word.toLowerCase());
  } else {
    // If no whitelist is found, initialize with default values
    whitelist = ["N/A", "BIBOINI", "GenericGambling"].map(word => word.toLowerCase());
  }
});

// Flag state
let removeSpam = false;
let useAi = true;

chrome.storage.local.get(["removeSpam", "useAi"], function (result) {
  // removeSpam defaulting to false, useAi defaulting to true
  removeSpam = result.removeSpam !== undefined ? result.removeSpam : false;
  useAi = result.useAi !== undefined ? result.useAi : true;
});

async function isSpam(rComment) {
  comment = normalizeFancyText(rComment);
  comment = comment.toLowerCase();
  lowerWhitelist = whitelist.map(word => word.toLowerCase());
  filterSpamWords = spamWords.filter(word => !lowerWhitelist.includes(word.toLowerCase()))
  exists = filterSpamWords.find(word => comment.includes(word.toLocaleLowerCase()));
  if (!exists && useAi) {
    try {
      const response = await fetch("http://localhost:8080/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ comment: rComment }),
      });

      if (response.ok) {
        const data = await response.json();
        // Check if the data.keyword exists in whitelist
        const whitelistExists = whitelist.some(word => data.keyword && data.keyword.toLowerCase() === word.toLowerCase());
        if (!whitelistExists) {
          exists = data.spam;
          const new_keyword = data.keyword;
          if (new_keyword && !spamWords.includes(new_keyword)) {
            spamWords.push(new_keyword);
            chrome.storage.local.set({ spamWords: spamWords }, function () {
              console.log("New keyword saved:", new_keyword);
            });
          }
          return {
            spam: exists,
            keyword: new_keyword,
          }
        } else {
          return {
            spam: false,
            keyword: null,
          }; // Default to not spam if whitelist exists
        }
      } else {
        console.error("Error fetching spam detection:", response.statusText);
      }
    } catch (error) {
      console.error("Error in fetch request:", error);
      return {
        spam: false,
        keyword: null,
      } // Default to not spam if there's an error
    }
  }

  return {
    spam: exists !== undefined ? true : false,
    keyword: exists !== undefined ? exists : null,
  }
}

async function getNewComments(mutationsList) {
  for (const mutation of mutationsList) {
    if (mutation.type === 'childList') {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const commentNodes = node.querySelectorAll(commentSelector);
          commentNodes.forEach(async (commentNode) => {
            const comment = extractTextFromNode(commentNode);
            if (comment.length >= 4) {
              const isSpamResult = await isSpam(comment);
              if (isSpamResult.spam) {
                console.log(`⚠️ Blocked comment detected: ${comment} with keyword ${isSpamResult.keyword}`);
                chrome.runtime.sendMessage({
                  action: "NewBlockedComments",
                  comment: comment,
                  keyword: isSpamResult.keyword,
                });
                // Mark the comment as spam if user doesn't check the "Remove Spam" checkbox
                // Get the checkbox state from local storage
                if (removeSpam) {
                  // Remove parent tag ytd-comment-thread-renderer
                  commentNode.closest("ytd-comment-thread-renderer").classList.add("hidden");
                  // commentNode.parentNode.parentNode.removeChild(commentNode.parentNode);
                  // commentNode.parentNode.insertBefore(textNode, commentNode);
                } else {
                  commentNode.classList.add("spam-comment", "hidden");

                  const placeholderSpan = document.createElement('span');
                  placeholderSpan.classList.add('placeholder');
                  placeholderSpan.textContent = `This comment is blocked. Click to unhide.`;

                  // Create a span for keyword to be added as whitelist if user wants
                  const keywordSpan = document.createElement('span');
                  keywordSpan.style.color = 'red';
                  keywordSpan.style.cursor = 'pointer';
                  keywordSpan.addEventListener('click', () => {
                    // add confirmation dialog
                    const confirmAdd = confirm(`Do you want to add "${isSpamResult.keyword}" to the whitelist?`);
                    if (!confirmAdd) return;
                    const keyword = isSpamResult.keyword;
                    if (keyword && !whitelist.includes(keyword)) {
                      whitelist.push(keyword);
                      chrome.storage.local.set({ whitelist: whitelist }, function () {
                        console.log("New keyword saved:", keyword);
                      });
                    }
                  });
                  keywordSpan.textContent = `Keyword: ${isSpamResult.keyword}, Click to add to whitelist`;
                  commentNode.appendChild(keywordSpan);

                  const hideButton = document.createElement('span');
                  hideButton.classList.add('hide-button');
                  hideButton.textContent = "Unhide";
                  hideButton.style.cursor = 'pointer';
                  hideButton.addEventListener('click', () => {
                    commentNode.classList.toggle('hidden');
                    hideButton.textContent = commentNode.classList.contains('hidden') ? "Unhide" : "Hide";
                  });

                  const wrapperNode = document.createElement('div');
                  wrapperNode.classList.add('comment-wrapper');
                  wrapperNode.appendChild(placeholderSpan);
                  wrapperNode.appendChild(hideButton);
                  commentNode.parentNode.insertBefore(wrapperNode, commentNode.parentNode.firstChild);
                }

                blockedComments.add(comment);
              }
            }
          });
        }
      }
    }
  }
}

function handleMutations(mutationsList) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  // append the mutations to the debounce list
  debounceMutationList.push(...mutationsList);
  // Debounce the function call
  debounceTimer = setTimeout(async () => {
    await getNewComments(debounceMutationList);
    // Clear the debounce list
    debounceMutationList = [];
  }, 300);
}

function loadObserver() {
  if (observerTimer) {
    clearTimeout(observerTimer);
  }
  observeComments();
}

document.addEventListener('yt-page-data-updated', function () {
  console.log("⚠️ yt-page-data-updated event detected.");
  loadObserver();
});
if (document.body) loadObserver();
else document.addEventListener('DOMContentLoaded', loadObserver);

function observeComments() {
  // Video comments container
  const commentContainer = document.querySelector("#comments #contents");

  // Short comments container
  const shortCommentContainer = document.querySelector("#shorts-panel-container #content #contents #contents");

  if (!commentContainer && !shortCommentContainer) {
    // console.warn("⚠️ Comments container not found, retrying...");
    observerTimer = setTimeout(observeComments, 1000);
    return;
  }
  if (observer) {
    observer.disconnect();
    console.log("⚠️ MutationObserver disconnected.");
  }
  observer = new MutationObserver(handleMutations);

  observer.observe(commentContainer || shortCommentContainer, {
    childList: true,
    subtree: false,
  });

  console.log("✅ MutationObserver attached to comments.");
}

window.addEventListener("load", async () => {
  observeComments();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getBlockedComments") {
    blockedCommentsArr = Array.from(blockedComments);
    sendResponse({ comments: blockedCommentsArr });
  }
  if (request.action === "getBlockKeywords") {
    spamWordsArr = Array.from(spamWords);
    sendResponse({ keywords: spamWordsArr });
  }
  if (request.action === "getWhitelist") {
    whitelistArr = Array.from(whitelist);
    sendResponse({ whitelist: whitelistArr });
  }
  if (request.action === "addWhitelist") {
    const newWord = request.word;
    if (newWord && !whitelist.includes(newWord)) {
      whitelist.push(newWord);
      chrome.storage.local.set({ whitelist: whitelist }, function () {
        console.log("New keyword saved:", newWord);
      });
    }
  }
  if (request.action === "updateLists") {
    chrome.storage.local.get(["spamWords", "whitelist"], (result) => {
      spamWords = result.spamWords || [];
      whitelist = result.whitelist || [];
      console.log("Updated spamWords:", spamWords);
      console.log("Updated whitelist:", whitelist);
      spamWords = spamWords.filter(word => !whitelist.includes(word)).map(word => word.toLowerCase());
      whitelist = whitelist.map(word => word.toLowerCase());
      // Refilter the comments
      // const commentNodes = document.querySelectorAll(commentSelector);
      // commentNodes.forEach(commentNode => {
      //   const comment = extractTextFromNode(commentNode);
      //   isSpam(comment).then(isSpamResult => {
      //     if (isSpamResult) {
      //       commentNode.classList.add("spam-comment", "hidden");
      //     } else {
      //       commentNode.classList.remove("spam-comment", "hidden");
      //     }
      //   });
      // });
    });
  }
  return true;
});
