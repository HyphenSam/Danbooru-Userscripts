// ==UserScript==
// @name         Skip all (Modqueue) (Modified)
// @namespace    skippallmodqueue
// @version      1.0
// @description  "Skip all" button in modqueue
// @author       iodoff & HyphenSam
// @website      https://aibooru.zip
// @match        *://aibooru.online/modqueue
// @match        *://*.aibooru.online/modqueue
// @match        *://aibooru.download/modqueue
// @match        *://*.aibooru.download/modqueue
// @match        *://aibooru.ovh/modqueue
// @match        *://*.aibooru.ovh/modqueue
// @match        *://*.donmai.us/modqueue
// @match        *://*.donmai.us/modqueue?*
// @match        *://booru.allthefallen.moe/modqueue
// @icon         https://aibooru.zip/favicon.ico
// @updateURL    https://raw.githubusercontent.com/HyphenSam/Danbooru-Userscipts/main/skip_all_modqueue_modified.user.js
// @downloadURL  https://raw.githubusercontent.com/HyphenSam/Danbooru-Userscipts/main/skip_all_modqueue_modified.user.js
// @grant        none
// ==/UserScript==

(function() {
    const tablist = document.getElementsByClassName("tab-list")[0];
    if (!tablist) return;

    const button = document.createElement("button");
    button.className = "button-primary button-xs";
    button.textContent = "Skip all";
    button.style.marginLeft = "10px";

    // Helper function to create a delay
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    button.addEventListener("click", async function() {
        const skipButtons = Array.from(document.querySelectorAll(".button-primary.button-xs"))
            .filter(el => el.textContent.trim() === "Skip");

        for (const el of skipButtons) {
            el.click();
            // 50ms delay between clicks to prevent request flooding
            await sleep(50);
        }

        // Optional: Visual feedback when done
        button.textContent = "Done!";
        setTimeout(() => button.textContent = "Skip all", 2000);
    });

    tablist.appendChild(button);
})();
