// ==UserScript==
// @name         Pixiv Blocklist
// @namespace    pixiv-local-filter
// @version      2.0.1
// @description  Hide Pixiv artworks from blocked users or with blocked tags. Makes no network requests of its own.
// @author       HyphenSam
// @match        https://www.pixiv.net/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @inject-into  page
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/HyphenSam/Danbooru-Userscripts/master/pixiv-blocklist.user.js
// @downloadURL  https://raw.githubusercontent.com/HyphenSam/Danbooru-Userscripts/master/pixiv-blocklist.user.js
// ==/UserScript==

(() => {
    'use strict';

    // ------------------------------------------------------------
    // Storage (same keys as v1, so existing blocklists carry over)
    // ------------------------------------------------------------

    const KEYS = {
        users: 'pixivFilter_blockedUsers_v1',
        tags: 'pixivFilter_blockedTags_v1',
        names: 'pixivFilter_userNames_v1',
    };

    const normTag = tag => String(tag).trim().toLowerCase();

    let blockedUsers;
    let blockedTags;
    let userNames;

    function load() {
        blockedUsers = new Set(GM_getValue(KEYS.users, []).map(String));
        blockedTags = new Set(GM_getValue(KEYS.tags, []).map(normTag));
        userNames = GM_getValue(KEYS.names, {});
    }

    function save() {
        GM_setValue(KEYS.users, [...blockedUsers]);
        GM_setValue(KEYS.tags, [...blockedTags]);
        GM_setValue(KEYS.names, userNames);
        scheduleScan();
    }

    load();

    if (typeof GM_addValueChangeListener === 'function') {
        for (const key of Object.values(KEYS)) {
            GM_addValueChangeListener(key, (_key, _old, _new, remote) => {
                if (remote) {
                    load();
                    scheduleScan();
                }
            });
        }
    }

    let enabled = true;

    // ------------------------------------------------------------
    // Artwork metadata, harvested from data Pixiv already loads
    // (its own fetch/XHR responses and __NEXT_DATA__).
    // ------------------------------------------------------------

    const artworks = new Map(); // artworkId -> { userId, tags: [lowercase names + translations] }
    const knownNames = new Map(); // userId -> userName
    const translations = new Map(); // tag -> English translation

    function tagNames(tags) {
        const list = Array.isArray(tags) ? tags : tags?.tags;
        if (!Array.isArray(list)) return null;

        const names = [];
        for (const t of list) {
            if (typeof t === 'string') {
                names.push(t);
                continue;
            }
            for (const name of [t?.tag, t?.name, t?.translatedName, t?.translation?.en]) {
                if (name) names.push(name);
            }
        }
        return names.map(normTag);
    }

    function harvest(data) {
        let found = false;

        (function walk(o, depth) {
            if (depth > 25) return;

            // Next.js pages embed some state as JSON strings.
            if (typeof o === 'string') {
                if (o.length > 100 && (o[0] === '{' || o[0] === '[')) {
                    try { walk(JSON.parse(o), depth + 1); } catch {}
                }
                return;
            }

            if (!o || typeof o !== 'object') return;

            if (Array.isArray(o)) {
                for (const x of o) walk(x, depth + 1);
                return;
            }

            // Most endpoints use camelCase; the ranking page uses snake_case.
            const id = o.illustId ?? o.illust_id ?? o.id;
            const userId = o.userId ?? o.user_id;
            const userName = o.userName ?? o.user_name;

            // textCount/wordCount mark novels, whose IDs are a separate namespace.
            if (id && userId && o.tags && !('textCount' in o) && !('wordCount' in o)) {
                const tags = tagNames(o.tags);
                if (tags) {
                    artworks.set(String(id), { userId: String(userId), tags });
                    found = true;
                }
            }
            if (userId && userName) {
                knownNames.set(String(userId), String(userName));
            }
            // Search results list tags in Japanese only, plus a translation map.
            if (o.tagTranslation && typeof o.tagTranslation === 'object') {
                for (const [tag, tr] of Object.entries(o.tagTranslation)) {
                    if (tr?.en) translations.set(normTag(tag), normTag(tr.en));
                }
            }

            for (const key in o) walk(o[key], depth + 1);
        })(data, 0);

        if (found) scheduleScan();
    }

    const win = unsafeWindow;
    const isPixiv = url => typeof url === 'string' && url.startsWith(location.origin);

    const origFetch = win.fetch;
    win.fetch = function (...args) {
        const promise = origFetch.apply(this, args);
        promise.then(res => {
            if (isPixiv(res.url) && /json/.test(res.headers.get('content-type'))) {
                res.clone().json().then(harvest, () => {});
            }
        }, () => {});
        return promise;
    };

    const origSend = win.XMLHttpRequest.prototype.send;
    win.XMLHttpRequest.prototype.send = function (...args) {
        this.addEventListener('load', () => {
            try {
                if (!isPixiv(this.responseURL)) return;
                if (this.responseType === 'json') {
                    harvest(this.response);
                } else if (!this.responseType || this.responseType === 'text') {
                    if (/json/.test(this.getResponseHeader('content-type'))) {
                        harvest(JSON.parse(this.responseText));
                    }
                }
            } catch {}
        });
        return origSend.apply(this, args);
    };

    function harvestEmbedded() {
        const next = document.getElementById('__NEXT_DATA__');
        if (next) {
            try { harvest(JSON.parse(next.textContent)); } catch {}
        }
        // Older (non-Next.js) pages.
        const preload = document.getElementById('meta-preload-data');
        if (preload) {
            try { harvest(JSON.parse(preload.content)); } catch {}
        }
    }

    // ------------------------------------------------------------
    // Styles
    // ------------------------------------------------------------

    const style = document.createElement('style');
    style.textContent = `
        [data-pxb-hidden] { display: none !important; }

        .pxb-user-btn, .pxb-tag-btn {
            border: 0; cursor: pointer; font: 600 12px/18px sans-serif;
            color: #fff; background: #d94b4b; white-space: nowrap;
        }
        .pxb-user-btn { flex: none; margin-left: 8px; padding: 7px 20px; border-radius: 999px; font-size: 14px; }
        [data-full-width="true"] + .pxb-user-btn { display: block; width: 100%; margin: 8px 0 0; padding: 9px 20px; }
        .pxb-tag-btn { margin-right: 8px; padding: 2px 8px; border-radius: 4px; }
        .pxb-user-btn:hover, .pxb-tag-btn:hover { filter: brightness(1.1); }
        .pxb-user-btn.pxb-on, .pxb-tag-btn.pxb-on { background: #666; }

        .pxb-dialog {
            color-scheme: light dark; background: Canvas; color: CanvasText;
            border: 1px solid #888; border-radius: 8px; padding: 16px;
            width: min(520px, calc(100vw - 32px)); font: 13px sans-serif;
        }
        .pxb-dialog label { display: block; font-weight: 600; margin: 8px 0 4px; }
        .pxb-dialog textarea { width: 100%; box-sizing: border-box; height: 160px; font: 13px monospace; }
        .pxb-dialog p { margin: 0 0 4px; opacity: 0.7; }
        .pxb-dialog .pxb-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
        .pxb-dialog .pxb-actions button {
            border: 1px solid #888; border-radius: 999px; padding: 6px 18px;
            font: 600 13px sans-serif; cursor: pointer; background: transparent; color: inherit;
        }
        .pxb-dialog .pxb-actions .pxb-save { background: #0096fa; border-color: #0096fa; color: #fff; }
    `;
    document.documentElement.appendChild(style);

    // ------------------------------------------------------------
    // Filtering
    // ------------------------------------------------------------

    const ARTWORK_LINK = 'a[href*="/artworks/"]';

    const getArtworkId = a => a.getAttribute('href')?.match(/\/artworks\/(\d+)/)?.[1] ?? null;
    const getUserIdFromHref = href => href?.match(/\/users\/(\d+)/)?.[1] ?? null;

    function containsOtherArtwork(el, id) {
        for (const a of el.querySelectorAll(ARTWORK_LINK)) {
            if (getArtworkId(a) !== id) return true;
        }
        return false;
    }

    // The card is the largest ancestor that holds only this one artwork,
    // found by climbing until the next level up holds other artworks too.
    // If no such boundary is found within a few levels, the artwork isn't
    // part of a list (e.g. a tag page's header image), so leave it alone.
    function findCard(anchor, id) {
        // Home feed posts nest their links too deeply for the climb below.
        // The wrapper also holds the divider line between posts.
        const post = anchor.closest('[data-ga4-label="work_content"]');
        if (post) return post.parentElement;

        let card = anchor;
        let el = anchor.parentElement;
        for (let depth = 0; depth < 6 && el && el !== document.body; depth++) {
            if (containsOtherArtwork(el, id)) return card;
            card = el;
            if (el.tagName === 'LI') return card;
            el = el.parentElement;
        }
        return null;
    }

    const cardCache = new WeakMap(); // anchor -> { id, card }

    function getCard(anchor, id) {
        const cached = cardCache.get(anchor);
        if (cached?.id === id && cached.card.contains(anchor) && !containsOtherArtwork(cached.card, id)) {
            return cached.card;
        }
        // Lists can render in stages, so only cache once a card is found.
        const card = findCard(anchor, id);
        if (card) cardCache.set(anchor, { id, card });
        return card;
    }

    function getUserId(anchor, card, id) {
        return (
            anchor.dataset.gtmUserId ||
            artworks.get(id)?.userId ||
            card.closest('[data-user-id]')?.dataset.userId ||
            (card !== anchor && getUserIdFromHref(card.querySelector('a[href*="/users/"]')?.getAttribute('href'))) ||
            null
        );
    }

    function blockReason(anchor, card, id) {
        const userId = getUserId(anchor, card, id);
        if (userId && blockedUsers.has(userId)) {
            return `user ${userId}`;
        }
        const tag = artworks.get(id)?.tags.find(t => blockedTags.has(t) || blockedTags.has(translations.get(t)));
        return tag ? `tag ${tag}` : '';
    }

    function filterArtworks() {
        const pageArtworkId = location.pathname.match(/\/artworks\/(\d+)/)?.[1];
        const decisions = new Map(); // card -> reason ('' = show)

        for (const anchor of document.querySelectorAll(ARTWORK_LINK)) {
            const id = getArtworkId(anchor);
            // Never hide the artwork whose page we're on.
            if (!id || id === pageArtworkId) continue;

            const card = getCard(anchor, id);
            if (!card || decisions.get(card)) continue;
            decisions.set(card, enabled ? blockReason(anchor, card, id) : '');
        }

        for (const el of document.querySelectorAll('[data-pxb-hidden]')) {
            if (!decisions.get(el)) delete el.dataset.pxbHidden;
        }
        for (const [card, reason] of decisions) {
            if (reason && card.dataset.pxbHidden !== reason) card.dataset.pxbHidden = reason;
        }
    }

    // ------------------------------------------------------------
    // "Block" button next to every Follow button
    // (user hover popups, artwork pages, profile pages)
    // ------------------------------------------------------------

    function setUserButtonState(button, userId) {
        const on = blockedUsers.has(userId);
        const label = on ? 'Unblock' : 'Block';
        if (button.textContent !== label) button.textContent = label;
        button.classList.toggle('pxb-on', on);
    }

    function findUserName(button, userId) {
        if (knownNames.has(userId)) return knownNames.get(userId);
        for (let el = button.parentElement, i = 0; el && i < 6; el = el.parentElement, i++) {
            const link = el.querySelector(`a[data-ga4-label="user_name_link"][href$="/users/${userId}"]`);
            if (link?.textContent.trim()) return link.textContent.trim();
        }
        return '';
    }

    function addUserButtons() {
        const follows = document.querySelectorAll(
            'button[data-gtm-user-id][data-click-label="follow"], button[data-gtm-user-id][data-ga4-label="follow_button"]'
        );

        for (const follow of follows) {
            const userId = follow.dataset.gtmUserId;
            let button = follow.nextElementSibling;

            if (!button?.classList.contains('pxb-user-btn')) {
                button = document.createElement('button');
                button.type = 'button';
                button.className = 'pxb-user-btn';
                button.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    const id = button.dataset.userId;
                    if (blockedUsers.delete(id)) {
                        delete userNames[id];
                    } else {
                        blockedUsers.add(id);
                        userNames[id] = findUserName(button, id);
                    }
                    save();
                });
                follow.after(button);
            }

            button.dataset.userId = userId;
            setUserButtonState(button, userId);
        }
    }

    // ------------------------------------------------------------
    // "Block tag" button in tag encyclopedia popups
    // ------------------------------------------------------------

    let hoveredTag = null;

    function getTagFromHref(href) {
        const match = href?.match(/\/tags\/([^/?#]+)/);
        if (!match) return null;
        try { return decodeURIComponent(match[1]); } catch { return null; }
    }

    // The popup may show a translated tag, so remember the real tag
    // from the link the pointer is on.
    document.addEventListener('pointerover', event => {
        const link = event.target.closest?.('a[href*="/tags/"]');
        if (!link || link.closest('[class*="PixpediaTooltip"]')) return;
        hoveredTag = getTagFromHref(link.getAttribute('href'));
    }, true);

    function setTagButtonState(button) {
        const on = blockedTags.has(normTag(button.dataset.tag));
        const label = on ? 'Unblock tag' : 'Block tag';
        if (button.textContent !== label) button.textContent = label;
        button.classList.toggle('pxb-on', on);
        button.title = button.dataset.tag;
    }

    function addTagButtons() {
        for (const popup of document.querySelectorAll('[class*="PixpediaTooltip_wrapper"]')) {
            let button = popup.querySelector('.pxb-tag-btn');

            if (!button) {
                const tag = hoveredTag || getTagFromHref(popup.querySelector('a[href*="/tags/"]')?.getAttribute('href'));
                if (!tag) continue;

                button = document.createElement('button');
                button.type = 'button';
                button.className = 'pxb-tag-btn';
                button.dataset.tag = tag;
                button.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    const t = normTag(button.dataset.tag);
                    if (!blockedTags.delete(t)) blockedTags.add(t);
                    save();
                });
                popup.append(button);
            }

            // Pixiv fills the popup in after creating it, so keep moving
            // the button next to the encyclopedia link once that appears.
            const encyclopedia = popup.querySelector('a[href*="dic.pixiv.net"]');
            if (encyclopedia && button.nextElementSibling !== encyclopedia) {
                encyclopedia.before(button);
            }

            setTagButtonState(button);
        }
    }

    // ------------------------------------------------------------
    // Scan scheduling
    // ------------------------------------------------------------

    let scanQueued = false;

    function scan() {
        scanQueued = false;
        filterArtworks();
        addUserButtons();
        addTagButtons();
    }

    function scheduleScan() {
        if (scanQueued || !document.body) return;
        scanQueued = true;
        requestAnimationFrame(scan);
    }

    function start() {
        harvestEmbedded();
        new MutationObserver(scheduleScan).observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['href'],
        });
        scheduleScan();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }

    // ------------------------------------------------------------
    // Menu: manage blocklist
    // ------------------------------------------------------------

    function openManager() {
        const dialog = document.createElement('dialog');
        dialog.className = 'pxb-dialog';
        dialog.innerHTML = `
            <label>Blocked users</label>
            <p>One per line: a user ID or profile URL. Anything after the ID is a note.</p>
            <textarea class="pxb-users" spellcheck="false"></textarea>
            <label>Blocked tags</label>
            <p>One per line. Exact match, case-insensitive. English translations also match.</p>
            <textarea class="pxb-tags" spellcheck="false"></textarea>
            <div class="pxb-actions">
                <button type="button" class="pxb-cancel">Cancel</button>
                <button type="button" class="pxb-save">Save</button>
            </div>
        `;

        const usersBox = dialog.querySelector('.pxb-users');
        const tagsBox = dialog.querySelector('.pxb-tags');

        usersBox.value = [...blockedUsers]
            .map(id => (userNames[id] ? `${id}  ${userNames[id]}` : id))
            .join('\n');
        tagsBox.value = [...blockedTags].join('\n');

        dialog.querySelector('.pxb-cancel').onclick = () => dialog.close();
        dialog.querySelector('.pxb-save').onclick = () => {
            const names = {};
            blockedUsers = new Set();
            for (const line of usersBox.value.split('\n')) {
                const match = line.match(/\/users\/(\d+)/) ?? line.match(/^\s*(\d+)\s*(.*)$/);
                if (!match) continue;
                blockedUsers.add(match[1]);
                const note = match[2]?.trim() || userNames[match[1]];
                if (note) names[match[1]] = note;
            }
            userNames = names;
            blockedTags = new Set(tagsBox.value.split('\n').map(normTag).filter(Boolean));
            save();
            dialog.close();
        };
        dialog.addEventListener('close', () => dialog.remove());

        document.body.append(dialog);
        dialog.showModal();
    }

    GM_registerMenuCommand('Manage blocklist', openManager);

    GM_registerMenuCommand('Toggle filtering for this tab', () => {
        enabled = !enabled;
        scheduleScan();
    });
})();
