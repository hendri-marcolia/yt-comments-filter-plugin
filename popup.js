console.log("Popup script loaded!");

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
    chrome.tabs.sendMessage(tabs[0].id, { action: "getBlockKeywords" }, (response) => {
      console.log("Received blocked words:", response.keywords);
      const keywords = response.keywords || [];
      // Render logic...
      const keywordsContainer = document.getElementById("keywords-container");

      if (keywords && keywords.length > 0) {
        keywords.forEach(keyword => {
          const keywordElement = document.createElement("p");
          keywordElement.textContent = keyword;
          keywordsContainer.appendChild(keywordElement);
        });
      } else {
        keywordsContainer.textContent = "No Keywords.";
      }
    });
  }
});


// Listen to new blocked comments from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "NewBlockedComments") {
    const commentsContainer = document.getElementById("comments-container");
    const newCommentElement = document.createElement("p");
    newCommentElement.textContent = request.comment;
    commentsContainer.appendChild(newCommentElement);
  }
  return true;
});