// ==UserScript==
// @name         Zoho Mail Git Diff Renderer v3
// @namespace    carlosgrillet.me
// @match        https://mail.zoho.eu/*
// @version      2026-06-08
// @description  try to take over the world!
// @author       Carlos Grillet
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    /* ------------------------------------------------------------------ */
    /* Configuration                                                      */
    /* ------------------------------------------------------------------ */

    const CONFIG = {
        mailSelector: '.zmMailWrapper',
        diffMarker: 'diff --git',
        processedFlag: '_diffRendered',
        debounceMs: 150,
    };

    // const FONT = "monospace, ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas";
    const FONT = "monospace";

    // Single source of truth for diff line appearance. One entry per token
    // `type` produced by classifyDiff(); rendering just looks the type up.
    const THEME = {
        add:     { fg: '#73b31d', bg: '#f2ffe9' },
        del:     { fg: '#b31d28', bg: '#ffebe9' },
        hunk:    { fg: '#5d1db3', bg: '#f6e9ff', bold: true },
        meta:    { fg: '#1db3a8', bg: '#e9fdff', bold: true },
        context: { fg: '#24292e', bg: '#ffffff' },
    };

    const MUTED = '#57606a';
    const BORDER = '#d0d7de';

    /* ------------------------------------------------------------------ */
    /* DOM helpers                                                         */
    /* ------------------------------------------------------------------ */

    // el('div', { color: 'red' }, 'hi') -> <div style="color:red">hi</div>
    // Styles are camelCase keys; text is set via textContent (never innerHTML).
    function el(tag, styles, text) {
        const node = document.createElement(tag);
        if (styles) Object.assign(node.style, styles);
        if (text != null) node.textContent = text;
        return node;
    }

    /* ------------------------------------------------------------------ */
    /* Parsing                                                             */
    /* ------------------------------------------------------------------ */

    // Drop git's "-- \n<version>" trailer (the trailing space is often
    // stripped by mail clients, hence the optional " ").
    function stripSignature(text) {
        return text.replace(/\n-- ?\n[\s\S]*$/, '\n');
    }

    // Split the region between `---` and the diff into free-form notes and
    // the diffstat. The diffstat starts at the first "file | N ..." or
    // "N files changed" line; everything above it is notes.
    function splitPreamble(lines) {
        const isStatFile = (l) => /\s\|\s+\d+\s*[-+]*$/.test(l) || /\s\|\s+Bin\b/.test(l);
        const isStatSummary = (l) => /\d+ files? changed/.test(l);

        const start = lines.findIndex((l) => isStatFile(l) || isStatSummary(l));
        if (start === -1) {
            return { notes: lines.join('\n').trim(), diffstat: [] };
        }
        return {
            notes: lines.slice(0, start).join('\n').trim(),
            diffstat: lines.slice(start).filter((l) => l.trim() !== ''),
        };
    }

    // Turn raw diff lines into typed tokens: { type, text }.
    // A state machine (inHunk) is what makes this robust: `+`/`-` only mean
    // add/remove INSIDE a hunk, so a removed line of content "--" (wire form
    // "---") is correctly a deletion, not a "---" file marker.
    function classifyDiff(lines) {
        let inHunk = false;
        const tokens = lines.map((text) => {
            if (text.startsWith('diff --git')) { inHunk = false; return { type: 'meta', text }; }
            if (text.startsWith('@@')) { inHunk = true; return { type: 'hunk', text }; }
            if (!inHunk) return { type: 'meta', text };
            if (text.startsWith('+')) return { type: 'add', text };
            if (text.startsWith('-')) return { type: 'del', text };
            if (text.startsWith('\\')) return { type: 'meta', text }; // "\ No newline at end of file"
            return { type: 'context', text };
        });

        // Trim trailing blank context lines left behind by the footer removal.
        while (tokens.length && tokens[tokens.length - 1].text.trim() === '') {
            tokens.pop();
        }
        return tokens;
    }

    // raw email body -> Patch | null
    function parsePatch(raw) {
        const lines = stripSignature(raw).split('\n');

        const diffIdx = lines.findIndex((l) => l.startsWith(CONFIG.diffMarker));
        if (diffIdx === -1) return null;

        const sepIdx = lines.findIndex((l) => l === '---');
        const messageEnd = sepIdx !== -1 && sepIdx < diffIdx ? sepIdx : diffIdx;

        const message = lines.slice(0, messageEnd).join('\n').trimEnd();
        const preamble = sepIdx !== -1 ? lines.slice(sepIdx + 1, diffIdx) : [];
        const { notes, diffstat } = splitPreamble(preamble);
        const diff = classifyDiff(lines.slice(diffIdx));

        return { message, notes, diffstat, diff };
    }

    /* ------------------------------------------------------------------ */
    /* Rendering                                                           */
    /* ------------------------------------------------------------------ */

    function renderMessage(text) {
        return el('div', {
            fontFamily: FONT,
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            padding: '12px 12px 4px',
            color: THEME.context.fg,
        }, text);
    }

    function renderNotes(text) {
        return el('div', {
            fontFamily: FONT,
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            padding: '8px 12px',
            margin: '8px 12px',
            color: MUTED,
            background: '#f6f8fa',
        }, text);
    }

    function renderDiffstat(statLines) {
        const box = el('pre', {
            fontFamily: FONT,
            lineHeight: '1.6',
            whiteSpace: 'pre',
            overflowX: 'auto',
            padding: '8px 12px',
            margin: '0',
            color: MUTED,
        });

        for (const line of statLines) {
            const row = el('div');
            const pipe = line.indexOf('|');

            if (pipe === -1) {
                // summary line, e.g. "1 file changed, 25 insertions(+), 6 deletions(-)"
                row.textContent = line;
            } else {
                row.appendChild(el('span', { color: MUTED }, line.slice(0, pipe + 1)));
                // Colour the +/- histogram one char at a time (no innerHTML).
                for (const ch of line.slice(pipe + 1)) {
                    const color =
                        ch === '+' ? THEME.add.fg :
                        ch === '-' ? THEME.del.fg : MUTED;
                    row.appendChild(el('span', { color }, ch));
                }
            }
            box.appendChild(row);
        }
        return box;
    }

    function renderDiff(tokens) {
        const box = el('pre', {
            fontFamily: FONT,
            lineHeight: '1.5',
            whiteSpace: 'pre',
            overflowX: 'auto',
            padding: '0',
            margin: '8px 0 12px',
        });

        for (const { type, text } of tokens) {
            const style = THEME[type] || THEME.context;
            const row = el('div', {
                color: style.fg,
                background: style.bg,
                fontWeight: style.bold ? '600' : 'normal',
                padding: '0 12px',
                whiteSpace: 'pre',
            });
            // A blank <div> generates no line box, so empty lines would
            // collapse to 0px. Substitute a non-breaking space to keep height.
            row.textContent = text.length ? text : '\u00A0';
            box.appendChild(row);
        }
        return box;
    }

    function renderPatch(patch) {
        const view = el('div', {
            fontFamily: FONT,
            margin: '12px 0',
            background: '#ffffff',
            overflow: 'hidden',
        });

        if (patch.message) view.appendChild(renderMessage(patch.message));
        if (patch.notes) view.appendChild(renderNotes(patch.notes));
        if (patch.diffstat.length) view.appendChild(renderDiffstat(patch.diffstat));
        if (patch.diff.length) view.appendChild(renderDiff(patch.diff));
        return view;
    }

    /* ------------------------------------------------------------------ */
    /* DOM integration                                                     */
    /* ------------------------------------------------------------------ */

    // Skip quoted replies: if the diff marker line is itself quoted (">"),
    // this is someone replying to a patch, not the patch.
    function isQuoted(text) {
        const marker = text
            .split('\n')
            .find((l) => l.includes(CONFIG.diffMarker));
        return marker ? marker.trimStart().startsWith('>') : false;
    }

    function process(node) {
        if (node[CONFIG.processedFlag]) return;

        const text = node.textContent;
        if (!text.includes(CONFIG.diffMarker) || isQuoted(text)) return;

        const patch = parsePatch(text);
        if (!patch) return;

        node[CONFIG.processedFlag] = true;
        node.replaceWith(renderPatch(patch));
    }

    function apply() {
        document.querySelectorAll(CONFIG.mailSelector).forEach(process);
    }

    function debounce(fn, ms) {
        let timer;
        return () => {
            clearTimeout(timer);
            timer = setTimeout(fn, ms);
        };
    }

    function start() {
        apply();
        // Debounced so we don't re-scan on every mutation (including the ones
        // our own replaceWith() triggers), and don't thrash on big DOM updates.
        const observer = new MutationObserver(debounce(apply, CONFIG.debounceMs));
        observer.observe(document.body, { childList: true, subtree: true });
    }

    start();
})();
