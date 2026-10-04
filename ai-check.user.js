// ==UserScript==
// @name         AI Check (Modified)
// @namespace    http://tampermonkey.net/
// @version      2026-10-04
// @updateURL    https://raw.githubusercontent.com/HyphenSam/Danbooru-Userscripts/master/ai-check.user.js
// @downloadURL  https://raw.githubusercontent.com/HyphenSam/Danbooru-Userscripts/master/ai-check.user.js
// @description  Spy check!
// @author       waterflame & HyphenSam
// @match        https://danbooru.donmai.us/uploads/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=donmai.us
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    async function process() {
        const tag = document.querySelector("#post_tag_string").value;
        if (tag == "") return;
        document.querySelector("#aic").innerText = " - Loading...";
        const resp = await fetch(`https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tag)}`, {
            method: 'get',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!resp.ok) {
            document.querySelector("#aic").innerText = ` - ${resp.status} ${resp.statusText}`;
            return;
        }

        const posts = await resp.json();
        var deleted = 0;
        var ai = 0;
        for (const post of posts) {
            if (post.is_deleted) {
                deleted += 1;
            }
            if (post.tag_string.split(" ").includes("ai-generated")) {
                ai += 1;
            }
        }

        if (ai > 0) {
            document.querySelector("#aic").innerText = " - Red";
            document.querySelector("#aic").parentElement.style.color = "red";
        } else if (deleted >= (Math.round(posts.length/2))) {
            document.querySelector("#aic").innerText = ` - Orange(${deleted}/${posts.length})`;
            document.querySelector("#aic").parentElement.style.color = "orange";
        } else if (deleted > 0) {
            document.querySelector("#aic").innerText = ` - Yellow(${deleted}/${posts.length})`;
            document.querySelector("#aic").parentElement.style.color = "#dad55e";
        } else {
            document.querySelector("#aic").parentElement.style.color = "green";
            document.querySelector("#aic").innerText = " - Green";
        }
    }

    const span = document.createElement("span");
    span.innerText = "Artist Check";
    const s2 = document.createElement("span");
    s2.id = "aic";
    span.append(s2);
    document.querySelector("#related-tags-container").insertAdjacentElement("beforeBegin",span);
    document.querySelector("#related-tags-container").insertAdjacentHTML("beforeBegin","<br><br>");
    process();
})();