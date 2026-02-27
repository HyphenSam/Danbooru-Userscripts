// ==UserScript==
// @name         Danbooru - Quick Detailed Rejection
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds a detailed rejection button to modqueue which auto-selects "Disinterest"
// @author       HyphenSam
// @match        *://*.donmai.us/modqueue*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/HyphenSam/Danbooru-Userscipts/main/quick_detailed_rejection.user.js
// @downloadURL  https://raw.githubusercontent.com/HyphenSam/Danbooru-Userscipts/main/quick_detailed_rejection.user.js
// ==/UserScript==

(function() {
    'use strict';

    const BUTTON_TEXT = "Message";
    const BUTTON_CLASS = "button-outline-danger button-xs";

    function addDisinterestButtons() {
        const hiddenLinks = document.querySelectorAll('a.detailed-rejection-link:not([data-disinterest-btn-added])');

        hiddenLinks.forEach(link => {
            link.setAttribute('data-disinterest-btn-added', 'true');

            const container = link.closest('.flex.flex-wrap.gap-1');

            if (container) {
                const newBtn = document.createElement('a');
                newBtn.className = BUTTON_CLASS;
                newBtn.textContent = BUTTON_TEXT;
                newBtn.href = "javascript:void(0)";
                //newBtn.style.marginLeft = "2px";
                newBtn.title = "Open Detailed Rejection with 'Disinterest' selected";

                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    link.click();
                    waitForDialogAndSelect();
                });

                container.appendChild(newBtn);
            }
        });
    }

    function waitForDialogAndSelect() {
        let attempts = 0;
        const maxAttempts = 40; // Stop after 2 seconds

        const intervalId = setInterval(() => {
            attempts++;
            const selectBox = document.getElementById('post_disapproval_reason');
            const messageBox = document.getElementById('post_disapproval_message');

            if (selectBox) {
                clearInterval(intervalId);

                selectBox.value = 'disinterest';

                const event = new Event('change', { bubbles: true });
                selectBox.dispatchEvent(event);

                if (messageBox) {
                    messageBox.focus();
                }
            }

            if (attempts >= maxAttempts) {
                clearInterval(intervalId);
            }
        }, 50);
    }

    addDisinterestButtons();

    const observer = new MutationObserver((mutations) => {
        addDisinterestButtons();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
