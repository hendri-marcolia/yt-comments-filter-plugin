// Function to get the comments (same as in content.js)
function getComments() {
    const commentNodes = document.querySelectorAll("yt-attributed-string[id='content-text']");
    const commentsArray = Array.from(commentNodes).map(commentNode => {
        let result = '';

        function traverse(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                result += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.tagName === 'IMG' && node.alt) {
                    result += node.alt;  // e.g., 😮
                } else {
                    Array.from(node.childNodes).forEach(traverse);
                }
            }
        }

        traverse(commentNode);
        return result.trim();
    });

    return commentsArray;
}