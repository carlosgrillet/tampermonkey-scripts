// ==UserScript==
// @name         Zoho Mail Monospace
// @namespace    carlosgrillet.me
// @match        https://mail.zoho.eu/*
// @version      2026-06-08
// @description  Zoho Mail Monospace font changer
// @author       Carlos Grillet
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function() {
    const apply = () => {
        const el = document.querySelector('.zmMailWrapper')
        if (el) el.style.fontFamily = 'monospace'
    }

    // Run on load and observe DOM changes
    // since Zoho is a SPA and renders dynamically
    apply()
    new MutationObserver(apply).observe(document.body, {
        childList: true,
        subtree: true
    })
})()
