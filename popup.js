console.log("Popup script loaded!");
document.addEventListener('DOMContentLoaded', function () {
  const removeSpamCheckbox = document.getElementById('removeSpam');
  const useAiCheckbox = document.getElementById('useAi');

  // Load values from storage
  chrome.storage.local.get(['removeSpam', 'useAi'], function (data) {
    // removeSpam default to false, useAi default to true
    removeSpamCheckbox.checked = data.removeSpam !== undefined ? data.removeSpam : false;
    useAiCheckbox.checked = data.useAi !== undefined ? data.useAi : true;
  });

  // Add event listeners to save changes
  removeSpamCheckbox.addEventListener('change', function () {
    chrome.storage.local.set({ removeSpam: removeSpamCheckbox.checked });
  });

  useAiCheckbox.addEventListener('change', function () {
    chrome.storage.local.set({ useAi: useAiCheckbox.checked });
  });
});
// Get the comments from the content script
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (tab) {
    chrome.tabs.sendMessage(tabs[0].id, { action: "getBlockedComments" }, (response) => {
      console.log("Received blocked comments:", response.comments);
      const comments = response.comments || [];
      // Render logic...
      const commentsContainer = document.getElementById("comments-container");

      if (comments && comments.length > 0) {
        comments.forEach(comment => {
          const commentElement = document.createElement("p");
          commentElement.textContent = comment;
          commentsContainer.appendChild(commentElement);
        });
      } else {
        commentsContainer.textContent = "No comments blocked.";
      }
    });
    chrome.storage.local.get("spamWords", (result) => {
      console.log("Received blocked words:", result.spamWords);
      const keywords = result.spamWords || [];
      // Render logic...
      const keywordsContainer = document.getElementById("keywords-container");

      if (keywords && keywords.length > 0) {
        keywords.forEach(keyword => {
          const keywordElement = document.createElement("p");
          keywordElement.innerHTML = "<span data-keyword='" + keyword + "'>" + keyword + "</span> <button class='remove-keyword'>Remove</button> <button class='whitelist-word'>Whitelist</button>";
          keywordsContainer.appendChild(keywordElement);
        });
      }
    });
    chrome.storage.local.get("whitelist", (result) => {
      console.log("Received whitelist:", result.whitelist);
      const whitelist = result.whitelist || [];
      const whitelistContainer = document.getElementById("whitelist-container");

      if (whitelist && whitelist.length > 0) {
        whitelist.forEach(whitelisted => {
          const whitelistedElement = document.createElement("p");
          whitelistedElement.innerHTML = "<span data-keyword='" + whitelisted + "'>" + whitelisted + "</span> <button class='remove-whitelist'>Remove</button> <button class='block-word'>Block</button>";
          whitelistContainer.appendChild(whitelistedElement);
        });
      } else {
        whitelistContainer.textContent = "No Whitelisted Words.";
      }
    });
  }
});

// Listen to new blocked comments from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "NewBlockedComments") {
    const commentsContainer = document.getElementById("comments-container");
    const newCommentElement = document.createElement("p");
    newCommentElement.textContent = `${request.comment} -> ${request.keyword} `;
    commentsContainer.appendChild(newCommentElement);
  }
  return true;
});

document.addEventListener('click', function (event) {
  if (event.target.classList.contains('remove-keyword')) {
    const keyword = event.target.parentNode.querySelector('span').dataset.keyword;
    console.log('Remove keyword:', keyword);
    chrome.storage.local.get("spamWords", (result) => {
      let spamWords = result.spamWords || [];
      spamWords = spamWords.filter(word => word !== keyword);
      chrome.storage.local.set({ spamWords: spamWords }, () => {
        console.log('Keyword removed:', keyword);
        event.target.parentNode.remove();
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, { action: "updateLists" });
        });
      });
    });
  } else if (event.target.classList.contains('whitelist-word')) {
    const keyword = event.target.parentNode.querySelector('span').dataset.keyword;
    console.log('Whitelist keyword:', keyword);
    chrome.storage.local.get(["spamWords", "whitelist"], (result) => {
      let spamWords = result.spamWords || [];
      let whitelist = result.whitelist || [];
      spamWords = spamWords.filter(word => word !== keyword);
      whitelist.push(keyword);
      chrome.storage.local.set({ spamWords: spamWords, whitelist: whitelist }, () => {
        console.log('Keyword whitelisted:', keyword);
        event.target.parentNode.remove();
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, { action: "updateLists" });
        });
      });
    });
  } else if (event.target.classList.contains('remove-whitelist')) {
    const whitelisted = event.target.parentNode.querySelector('span').dataset.keyword;
    console.log('Remove whitelisted:', whitelisted);
    chrome.storage.local.get("whitelist", (result) => {
      let whitelist = result.whitelist || [];
      whitelist = whitelist.filter(word => word !== whitelisted);
      chrome.storage.local.set({ whitelist: whitelist }, () => {
        console.log('Whitelisted removed:', whitelisted);
        event.target.parentNode.remove();
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, { action: "updateLists" });
        });
      });
    });
  } else if (event.target.classList.contains('block-word')) {
    const whitelisted = event.target.parentNode.querySelector('span').dataset.keyword;
    console.log('Block whitelisted:', whitelisted);
    chrome.storage.local.get(["spamWords", "whitelist"], (result) => {
      let spamWords = result.spamWords || [];
      let whitelist = result.whitelist || [];
      whitelist = whitelist.filter(word => word !== whitelisted);
      spamWords.push(whitelisted);
      chrome.storage.local.set({ spamWords: spamWords, whitelist: whitelist }, () => {
        console.log('Whitelisted blocked:', whitelisted);
        event.target.parentNode.remove();
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, { action: "updateLists" });
        });
      });
    });
  }
});
