// ==UserScript==
// @name         Zoho Mail Monospace
// @namespace    carlosgrillet.me
// @match        https://mail.zoho.eu/*
// @version      2026-06-13
// @description  Zoho Mail Monospace font changer
// @author       Carlos Grillet
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function() {
    function debounce(fn, ms) {
        let timer;
        return () => {
            clearTimeout(timer);
            timer = setTimeout(fn, ms);
        };
    }

    function apply() {
        document.querySelectorAll('.zmMailWrapper').forEach(node => {
            node.style.fontFamily = 'monospace'
        });
    }

    apply();

    // Debounced to don't re-scan on every mutation
    const observer = new MutationObserver(debounce(apply, 100));
    observer.observe(document.body, { childList: true, subtree: true });
})()
