// ==UserScript==
// @name         Booru Tag Parser
// @namespace    booru-tag-parser
// @version      2.1.0
// @description  Copy the current post's tags and rating, or its post and source links, to the clipboard for easy import into another program or booru.
// @author       HyphenSam, JetBoom
// @match        *://demo.illustration2vec.net/*
// @include      /^https?:\/\/[^\/]*booru[^\/]*\/(post|index\.php\?id=|[^?]*\?page=post)/
// @match        *://*.donmai.us/posts/*
// @match        *://*.rule34.xxx/index.php?page=post*
// @match        *://*.chan.sankakucomplex.com/post/show/*
// @match        *://*.chan.sankakucomplex.com/?tags=*
// @match        *://*.idol.sankakucomplex.com/post/show/*
// @match        *://*.idol.sankakucomplex.com/?tags=*
// @match        *://*.behoimi.org/post/show/*
// @match        *://*.e621.net/posts/*
// @match        *://*.konachan.com/post/*
// @match        *://*.konachan.net/post/*
// @match        *://*.shimmie.katawa-shoujo.com/post/*
// @match        *://*.rule34.paheal.net/post/*
// @match        *://*.rule34hentai.net/post/*
// @match        *://*.tbib.org/index.php?page=post*
// @match        *://*.yande.re/post/*
// @match        *://*.derpibooru.org/*
// @match        *://*.trixiebooru.org/*
// @match        *://*.sofurry.com/*
// @match        *://*.twentypercentcooler.net/*
// @match        *://*.nhentai.net/*
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @run-at       document-end
// @noframes
// @updateURL    https://raw.githubusercontent.com/HyphenSam/Danbooru-Userscripts/master/booru-tag-parser.user.js
// @downloadURL  https://raw.githubusercontent.com/HyphenSam/Danbooru-Userscripts/master/booru-tag-parser.user.js
// ==/UserScript==

(() => {
    'use strict';

    // ------------------------------------------------------------
    // Settings
    // ------------------------------------------------------------

    const DEFAULTS = {
        shortcut: { code: 'BracketRight', ctrl: false, alt: false, shift: false, meta: false, label: ']' },
        linksShortcut: false,
        i2vConfidence: 20,
        attachExplicit: true,
        attachGid: true,
    };

    // false means the shortcut is disabled
    let shortcut = GM_getValue('shortcut', DEFAULTS.shortcut);
    let linksShortcut = GM_getValue('links_shortcut', DEFAULTS.linksShortcut);
    let i2vConfidence = GM_getValue('iv2_confidence_rating', DEFAULTS.i2vConfidence);
    let attachExplicit = GM_getValue('attach_explicit', DEFAULTS.attachExplicit);
    let attachGid = GM_getValue('attach_gid', DEFAULTS.attachGid);

    // ------------------------------------------------------------
    // Tag parsing
    // ------------------------------------------------------------

    const possibleRatings = ['rating:general', 'rating:sensitive', 'rating:explicit', 'rating:questionable', 'rating:safe'];

    // nhentai tag sections and the namespace to give them, for consistency with boorus
    const nhentaiNamespaces = {
        parodies: 'series:',
        characters: 'character:',
        tags: '',
        artists: 'creator:',
        groups: 'studio:',
        languages: 'language:',
        categories: 'category:',
    };

    function insertTags(tags, selector, prefix = '', stripNamespace = false) {
        for (const element of document.querySelectorAll(selector)) {
            let text = element.textContent.trim();
            if (!text || text === '-' || text === '+' || text === '?') continue;

            text = text.replaceAll('_', ' ');

            if (stripNamespace) {
                text = text.match(/:(.*)/)?.[1] ?? text;
            }

            tags.push(prefix + text);
        }
    }

    function insertRating(tags, selector) {
        for (const element of document.querySelectorAll(selector)) {
            const text = element.textContent.toLowerCase().replace(/\s/g, '');

            for (const rating of possibleRatings) {
                if (text.includes(rating)) tags.push(rating);
            }
        }
    }

    function getBooruTags() {
        const tags = [];

        // danbooru-like-new
        insertTags(tags, '#tag-list li.tag-type-3 a.search-tag', 'series:');
        insertTags(tags, '#tag-list li.tag-type-1 a.search-tag', 'creator:');
        insertTags(tags, '#tag-list li.tag-type-4 a.search-tag', 'character:');
        insertTags(tags, '#tag-list li.tag-type-5 a.search-tag', 'meta:');
        insertTags(tags, '#tag-list li.tag-type-6 > a.search-tag', 'ai-model:'); // AI models for AIBooru
        insertTags(tags, '#tag-list li.tag-type-0 a.search-tag', '');

        // danbooru-like-old
        insertTags(tags, '#tag-list li.category-3 > a.search-tag', 'series:');
        insertTags(tags, '#tag-list li.category-1 > a.search-tag', 'creator:');
        insertTags(tags, '#tag-list li.category-4 > a.search-tag', 'character:');
        insertTags(tags, '#tag-list li.category-0 > a.search-tag', '');

        // lolibooru-like
        insertTags(tags, 'li.tag-type-copyright > a', 'series:');
        insertTags(tags, 'li.tag-type-author > a', 'creator:');
        insertTags(tags, 'li.tag-type-artist > a', 'creator:');
        insertTags(tags, 'li.tag-type-character > a', 'character:');
        insertTags(tags, 'li.tag-type-model > a', 'model:');
        insertTags(tags, 'li.tag-type-idol > a', 'model:');
        insertTags(tags, 'li.tag-type-general > a', '');
        insertTags(tags, 'li.tag-type-studio > a', 'studio:');
        insertTags(tags, 'li.tag-type-circle > a', 'studio:');
        insertTags(tags, 'li.tag-type-medium > a', 'medium:');
        insertTags(tags, 'li.tag-type-style > a', 'medium:');
        insertTags(tags, 'li.tag-type-meta > a', 'meta:');
        insertTags(tags, 'li.tag-type-species > a', 'species:');
        insertTags(tags, 'li.tag-type-faults > a', 'fault:');
        insertTags(tags, 'li.tag-type-genre > a', 'genre:');

        // derpibooru-like
        insertTags(tags, '.tag-list [data-tag-category="origin"]:not([data-tag-name="edit"]):not([data-tag-slug="derpibooru+exclusive"]):not([data-tag-slug="edited+screencap"]):not([data-tag-slug="screencap"]):not([data-tag-slug="anonymous+artist"]):not([data-tag-slug="alternate+version"]):not([data-tag-slug="color+edit"]):not([data-tag-slug="them%27s+fightin%27+herds"]) > span > a', 'creator:', true); // These origin tags are not artists, so they are handled below
        insertTags(tags, '.tag-list .tag.tag-ns-oc > span > a', 'character:', true);
        insertTags(tags, '.tag-list .tag.tag-system > span > a', 'rating:');
        insertTags(tags, '.tag-list [class="tag dropdown"]:not([data-tag-category="character"]):not([data-tag-category="origin"]):not([data-tag-category="spoiler"]):not([data-tag-category="episode"]) > span > a', ''); // Generic tags on derpibooru do not have a namespace class of their own
        insertTags(tags, '.tag-list [data-tag-category="character"] > span > a', 'character:');
        insertTags(tags, '.tag-list [data-tag-category="episode"] > span > a', 'episode:');
        insertTags(tags, '[data-tag-name="edit"] > span > a', '');
        insertTags(tags, '[data-tag-slug="derpibooru+exclusive"] > span > a', '');
        insertTags(tags, '[data-tag-slug="edited+screencap"] > span > a', '');
        insertTags(tags, '[data-tag-slug="screencap"] > span > a', '');
        insertTags(tags, '[data-tag-slug="anonymous+artist"] > span > a', ''); // Hydrus converts this into a creator tag via tag siblings
        insertTags(tags, '[data-tag-slug="alternate+version"] > span > a', '');
        insertTags(tags, '[data-tag-slug="color+edit"] > span > a', '');
        insertTags(tags, '[data-tag-slug="them%27s+fightin%27+herds"] > span > a', 'series:');

        // sofurry-like
        insertTags(tags, '.titlehover > a', '');

        // booru.org-like
        insertTags(tags, '#tag_list li a', '');

        // paheal-like
        insertTags(tags, 'a.tag_name', '');

        // danbooru-like
        insertRating(tags, '#post-information > ul li');

        // lolibooru-like
        insertRating(tags, '#stats > ul li');

        // booru.org-like
        insertRating(tags, '#tag_list ul');

        return tags;
    }

    function insertI2VTags(tags, selector, prefix) {
        for (const element of document.querySelectorAll(selector)) {
            const confidence = parseFloat(element.children[3]?.children[0]?.textContent);
            if (confidence < i2vConfidence) continue;

            tags.push(prefix + element.children[1].textContent.trim().replaceAll('_', ' '));

            if (prefix === 'rating:') break; // only add one rating
        }
    }

    function getI2VTags() {
        const tags = [];

        insertI2VTags(tags, 'table#copyright_root tr', 'series:');
        insertI2VTags(tags, 'table#character_root tr', 'character:');
        insertI2VTags(tags, 'table#general_root tr', '');
        insertI2VTags(tags, 'table#rating_root tr', 'rating:');

        return tags;
    }

    function getNHentaiTags() {
        // The nhentai API is behind Cloudflare and returns 403, so read the gallery page instead.
        // nhentai is a single-page app, so check the current URL rather than the one the script loaded on.
        const id = location.pathname.match(/^\/g\/(\d+)/)?.[1];
        if (!id) return [];

        const tags = [];

        // Each section looks like: <div class="tag-container">Tags: <span class="tags"><a class="tagchip"><span class="name">...</span></a></span></div>
        for (const container of document.querySelectorAll('#tags .tag-container')) {
            const section = container.textContent.match(/^\s*(\w+):/)?.[1].toLowerCase();
            const prefix = nhentaiNamespaces[section];
            if (prefix === undefined) continue; // Pages, Uploaded, etc.

            for (const name of container.querySelectorAll('a .name')) {
                tags.push(prefix + name.textContent.trim());
            }
        }

        if (tags.length === 0) return tags;

        if (attachExplicit) tags.push('rating:explicit');
        if (attachGid) tags.push(`gallery:${id}`);

        return tags;
    }

    function getTags() {
        if (location.hostname.endsWith('nhentai.net')) return getNHentaiTags();
        if (location.hostname.endsWith('illustration2vec.net')) return getI2VTags();
        return getBooruTags();
    }

    async function copyTags() {
        try {
            const tags = [...new Set(await getTags())];

            if (tags.length === 0) {
                notify('No tags found');
                return;
            }

            GM_setClipboard(tags.join('\n'));
            notify(`Copied ${tags.length} tag${tags.length === 1 ? '' : 's'} to clipboard`);
        } catch (e) {
            console.error('[Booru Tag Parser]', e);
            notify('Could not get tags');
        }
    }

    // ------------------------------------------------------------
    // Link copying
    // ------------------------------------------------------------

    // Danbooru, Gelbooru and Moebooru all show the source as <li>Source: <a href="...">...</a></li>
    function getSourceUrl() {
        for (const item of document.querySelectorAll('li')) {
            if (!/^\s*Source:/.test(item.textContent)) continue;

            const link = item.querySelector('a[href]');
            if (link) return link.href;
        }
    }

    function copyLinks() {
        // The canonical link drops search parameters, e.g. Danbooru's ?q=
        const postUrl = document.querySelector('link[rel="canonical"]')?.href ?? location.href;
        const sourceUrl = getSourceUrl();

        if (!sourceUrl) {
            GM_setClipboard(postUrl);
            notify('No source found, copied post link');
            return;
        }

        GM_setClipboard(`${postUrl}\n${sourceUrl}`);
        notify('Copied post and source links to clipboard');
    }

    // ------------------------------------------------------------
    // UI root
    // ------------------------------------------------------------

    // The toast and settings dialog live in a shadow root so site CSS can't restyle them
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `
        <style>
            :host { all: initial; }

            .toast {
                position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
                z-index: 2147483647; padding: 8px 16px; border-radius: 6px;
                background: #222; color: #fff; font: 13px sans-serif;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4); pointer-events: none;
                opacity: 0; transition: opacity 0.2s;
            }
            .toast.show { opacity: 1; }

            dialog {
                color-scheme: light dark; background: Canvas; color: CanvasText;
                border: 1px solid #888; border-radius: 8px; padding: 16px;
                width: min(400px, calc(100vw - 32px)); font: 13px sans-serif;
            }
            h2 { margin: 0 0 8px; font: 600 15px sans-serif; }
            h3 { margin: 12px 0 4px; font: 600 13px sans-serif; }
            label { display: block; margin: 4px 0; }
            p { margin: 0 0 4px; opacity: 0.7; }
            input { font: 13px sans-serif; }
            .row { display: flex; gap: 8px; }
            .shortcut { flex: 1; min-width: 0; text-align: center; cursor: pointer; }
            .confidence { width: 60px; }
            button {
                border: 1px solid #888; border-radius: 999px; padding: 6px 18px;
                font: 600 13px sans-serif; cursor: pointer; background: transparent; color: inherit;
            }
            button:hover { background: rgba(128, 128, 128, 0.25); }
            .actions { display: flex; gap: 8px; margin-top: 16px; }
            .reset-all { margin-right: auto; }
            .save { background: #0096fa; border-color: #0096fa; color: #fff; }
            .save:hover { background: #33abfb; border-color: #33abfb; }
        </style>
        <div class="toast"></div>
    `;

    // Attached on first use, and re-attached if a single-page app replaces the body
    function getRoot() {
        if (!host.isConnected) document.body.append(host);
        return root;
    }

    // ------------------------------------------------------------
    // Notification
    // ------------------------------------------------------------

    const toast = root.querySelector('.toast');
    let toastTimer;

    function notify(message) {
        getRoot();
        toast.textContent = message;
        toast.classList.add('show');

        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
    }

    // ------------------------------------------------------------
    // Shortcut
    // ------------------------------------------------------------

    const MODIFIER_KEYS = ['Control', 'Alt', 'Shift', 'Meta'];

    function shortcutFromEvent(e) {
        const parts = [];
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');
        if (e.metaKey) parts.push('Meta');
        parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);

        return {
            code: e.code || e.key,
            ctrl: e.ctrlKey,
            alt: e.altKey,
            shift: e.shiftKey,
            meta: e.metaKey,
            label: parts.join('+'),
        };
    }

    function isEditable(element) {
        return element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
    }

    function matchesShortcut(e, target) {
        return target
            && (e.code || e.key) === target.code
            && e.ctrlKey === target.ctrl
            && e.altKey === target.alt
            && e.shiftKey === target.shift
            && e.metaKey === target.meta;
    }

    document.addEventListener('keydown', e => {
        if (e.repeat || isEditable(e.target)) return;

        if (matchesShortcut(e, shortcut)) {
            e.preventDefault();
            copyTags();
        } else if (matchesShortcut(e, linksShortcut)) {
            e.preventDefault();
            copyLinks();
        }
    });

    // ------------------------------------------------------------
    // Menu: settings
    // ------------------------------------------------------------

    function openSettings() {
        const pending = { shortcut, linksShortcut };

        const dialog = document.createElement('dialog');
        dialog.innerHTML = `
            <h2>Booru Tag Parser</h2>
            <p>Click a shortcut box, then press a key combination.</p>
            <h3>Copy tags shortcut</h3>
            <div class="row" data-name="shortcut">
                <input class="shortcut" readonly>
                <button type="button" class="default">Default</button>
                <button type="button" class="clear">Clear</button>
            </div>
            <h3>Copy links shortcut</h3>
            <div class="row" data-name="linksShortcut">
                <input class="shortcut" readonly>
                <button type="button" class="clear">Clear</button>
            </div>
            <h3>nhentai</h3>
            <label><input type="checkbox" class="explicit"> Add rating:explicit</label>
            <label><input type="checkbox" class="gid"> Add gallery:id</label>
            <h3>illustration2vec</h3>
            <label>Minimum confidence: <input type="number" class="confidence" min="0" max="100"> %</label>
            <div class="actions">
                <button type="button" class="reset-all" title="Fill in the default settings. Press Save to keep them.">Reset all</button>
                <button type="button" class="cancel" autofocus>Cancel</button>
                <button type="button" class="save">Save</button>
            </div>
        `;

        // Keep key presses in the dialog away from the site's own hotkeys
        for (const type of ['keydown', 'keyup', 'keypress']) {
            dialog.addEventListener(type, e => e.stopPropagation());
        }

        const shortcutRows = dialog.querySelectorAll('.row');
        const explicitBox = dialog.querySelector('.explicit');
        const gidBox = dialog.querySelector('.gid');
        const confidenceBox = dialog.querySelector('.confidence');

        const showShortcuts = () => {
            for (const row of shortcutRows) {
                const box = row.querySelector('.shortcut');
                box.value = pending[row.dataset.name]?.label ?? '';
                box.placeholder = 'Disabled';
            }
        };
        const fill = values => {
            pending.shortcut = values.shortcut;
            pending.linksShortcut = values.linksShortcut;
            showShortcuts();
            explicitBox.checked = values.attachExplicit;
            gidBox.checked = values.attachGid;
            confidenceBox.value = values.i2vConfidence;
        };
        fill({ shortcut, linksShortcut, attachExplicit, attachGid, i2vConfidence });

        for (const row of shortcutRows) {
            const name = row.dataset.name;
            const box = row.querySelector('.shortcut');

            box.addEventListener('focus', () => {
                box.value = '';
                box.placeholder = 'Press a key...';
            });
            box.addEventListener('blur', showShortcuts);
            box.addEventListener('keydown', e => {
                // Tab moves focus and Escape closes the dialog as usual
                if (MODIFIER_KEYS.includes(e.key) || e.key === 'Tab' || e.key === 'Escape') return;

                e.preventDefault();
                pending[name] = shortcutFromEvent(e);
                box.blur();
            });

            const defaultButton = row.querySelector('.default');
            if (defaultButton) {
                defaultButton.onclick = () => {
                    pending[name] = DEFAULTS[name];
                    showShortcuts();
                };
            }
            row.querySelector('.clear').onclick = () => {
                pending[name] = false;
                showShortcuts();
            };
        }

        dialog.querySelector('.reset-all').onclick = () => fill(DEFAULTS);
        dialog.querySelector('.cancel').onclick = () => dialog.close();
        dialog.querySelector('.save').onclick = () => {
            shortcut = pending.shortcut;
            linksShortcut = pending.linksShortcut;
            attachExplicit = explicitBox.checked;
            attachGid = gidBox.checked;
            i2vConfidence = Math.min(100, Math.max(0, Number(confidenceBox.value) || 0));

            GM_setValue('shortcut', shortcut);
            GM_setValue('links_shortcut', linksShortcut);
            GM_setValue('attach_explicit', attachExplicit);
            GM_setValue('attach_gid', attachGid);
            GM_setValue('iv2_confidence_rating', i2vConfidence);
            dialog.close();
        };
        dialog.addEventListener('close', () => dialog.remove());

        getRoot().append(dialog);
        dialog.showModal();
    }

    GM_registerMenuCommand('Copy tags', copyTags);
    GM_registerMenuCommand('Copy links', copyLinks);
    GM_registerMenuCommand('Settings', openSettings);
})();
