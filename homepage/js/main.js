// Kimpay homepage: translations, header, the live demo of the hero, the
// "How it works" tabs and the reveal on scroll. No dependency.
(() => {
    "use strict";

    const SUPPORTED = ["en", "fr", "de", "es", "pt"];
    const LOCALES = { en: "en-GB", fr: "fr-FR", de: "de-DE", es: "es-ES", pt: "pt-PT" };
    const STORAGE_KEY = "kimpay_lang";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    // Storage can throw (private mode, blocked site data): the page works without it.
    const storage = {
        get(key) {
            try { return localStorage.getItem(key); } catch { return null; }
        },
        set(key, value) {
            try { localStorage.setItem(key, value); } catch { /* not persisted */ }
        },
    };

    const debounce = (fn, ms) => {
        let id;
        return () => {
            clearTimeout(id);
            id = setTimeout(fn, ms);
        };
    };

    // Amounts and dates follow the language, as in the app.
    let locale = LOCALES.en;
    const money = (value, currency = "EUR", signed = false) =>
        new Intl.NumberFormat(locale, {
            style: "currency",
            currency,
            currencyDisplay: "narrowSymbol",
            signDisplay: signed ? "exceptZero" : "auto",
        }).format(value);
    const decimal = (value) =>
        new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    const shortDate = (iso) =>
        new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

    function formatValues() {
        $$("[data-money]").forEach((el) => {
            el.textContent = money(Number(el.dataset.money), el.dataset.currency || "EUR");
        });
        $$("[data-number]").forEach((el) => {
            el.textContent = decimal(Number(el.dataset.number));
        });
        $$("time[data-date]").forEach((el) => {
            el.dateTime = el.dataset.date;
            el.textContent = shortDate(el.dataset.date);
        });
    }

    /* Header */

    // Border once scrolled; on mobile, section tabs past the hero and a
    // reading progress line.
    const header = $(".site-header");
    const hero = $(".hero");
    let headerFrame = 0;
    function updateHeader() {
        headerFrame = 0;
        if (!header) return;
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        header.classList.toggle("is-scrolled", window.scrollY > 8);
        header.classList.toggle("is-past-hero", !!hero && hero.getBoundingClientRect().bottom < header.offsetHeight);
        header.style.setProperty("--progress", scrollable > 0 ? Math.min(1, window.scrollY / scrollable).toFixed(4) : "0");
    }
    window.addEventListener("scroll", () => {
        headerFrame ||= requestAnimationFrame(updateHeader);
    }, { passive: true });
    window.addEventListener("resize", debounce(updateHeader, 150));
    updateHeader();

    // The section being read is marked in the header navigations.
    (() => {
        const links = $$('.nav a[href^="#"], .subnav a[href^="#"]');
        const subnav = $(".subnav");
        const sections = [...new Set(links.map((a) => a.getAttribute("href")))]
            .map((id) => $(id))
            .filter(Boolean);
        if (!sections.length) return;

        const setCurrent = (id) => {
            links.forEach((a) => {
                if (a.getAttribute("href") === `#${id}`) a.setAttribute("aria-current", "true");
                else a.removeAttribute("aria-current");
            });
            // Keep the current tab in sight when the tabs overflow.
            const active = subnav && $(`a[href="#${id}"]`, subnav);
            if (active && subnav.scrollWidth > subnav.clientWidth) {
                subnav.scrollTo({ left: active.offsetLeft - (subnav.clientWidth - active.offsetWidth) / 2, behavior: "smooth" });
            }
        };

        // A section is current while it crosses the upper middle of the screen.
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) setCurrent(entry.target.id);
            });
        }, { rootMargin: "-35% 0px -60% 0px" });
        sections.forEach((section) => observer.observe(section));
        if (hero) observer.observe(hero);
    })();

    const yearEl = $("#current-year");
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    /* Live demo: a group gets a new expense, balances move, transfers appear */

    const demo = (() => {
        const root = $("#demo");
        if (!root) return { refresh() {} };

        const total = $("[data-total-a]", root);
        const rows = $$(".balances li", root);
        const buttons = $$(".demo-steps button", root);
        const caption = $(".demo-caption", root);
        // Largest balance across the steps: every bar is drawn to this scale.
        const MAX_BALANCE = 38.75;
        const STEP_MS = 2600;

        let step = reduceMotion.matches ? 3 : 0;
        let timer = null;
        let visible = false;
        let pausedByUser = false;

        // Amounts count up to their new value instead of jumping.
        const shown = new Map();
        const frames = new Map();
        function countTo(el, to, format, animate) {
            const from = shown.has(el) ? shown.get(el) : to;
            shown.set(el, to);
            cancelAnimationFrame(frames.get(el));
            if (!animate || reduceMotion.matches || from === to) {
                el.textContent = format(to);
                return;
            }
            const start = performance.now();
            const tick = (now) => {
                const t = Math.min(1, (now - start) / 600);
                const eased = 1 - Math.pow(1 - t, 3);
                el.textContent = format(Math.round((from + (to - from) * eased) * 100) / 100);
                if (t < 1) frames.set(el, requestAnimationFrame(tick));
            };
            frames.set(el, requestAnimationFrame(tick));
        }

        function render(animate = true) {
            root.dataset.step = String(step);
            const after = step >= 1;
            countTo(total, Number(after ? total.dataset.totalB : total.dataset.totalA), (v) => money(v), animate);
            rows.forEach((row) => {
                const value = Number(after ? row.dataset.b : row.dataset.a);
                row.classList.toggle("is-pos", value >= 0);
                row.classList.toggle("is-neg", value < 0);
                row.style.setProperty("--w", `${Math.max(1.5, (Math.abs(value) / MAX_BALANCE) * 50).toFixed(2)}%`);
                countTo($(".amount", row), value, (v) => money(v, "EUR", true), animate);
            });
            buttons.forEach((button) => {
                const index = Number(button.dataset.step);
                button.setAttribute("aria-pressed", String(index === step));
                button.classList.toggle("is-done", index < step);
            });
            if (caption) caption.textContent = buttons[step]?.textContent ?? "";
        }

        // The demo reserves the height of its fullest step: the card grows
        // into it and nothing around it moves while the demo plays.
        function lockHeight() {
            const current = root.dataset.step;
            root.classList.add("is-measuring");
            root.style.minHeight = "";
            root.dataset.step = "3";
            const tallest = root.offsetHeight;
            root.dataset.step = current;
            void root.offsetHeight;
            root.classList.remove("is-measuring");
            root.style.minHeight = `${tallest}px`;
        }

        function schedule() {
            clearTimeout(timer);
            const playing = !reduceMotion.matches && !pausedByUser && visible && !document.hidden;
            // On phones the current story bar fills up during the step.
            root.classList.toggle("is-playing", playing);
            if (!playing) return;
            const delay = step === 3 ? STEP_MS * 1.5 : STEP_MS;
            root.style.setProperty("--step-ms", `${delay}ms`);
            timer = setTimeout(() => {
                step = (step + 1) % 4;
                render();
                schedule();
            }, delay);
        }

        buttons.forEach((button) => {
            button.addEventListener("click", () => {
                pausedByUser = true;
                schedule();
                step = Number(button.dataset.step);
                render();
            });
        });

        new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            schedule();
        }).observe(root);
        document.addEventListener("visibilitychange", schedule);
        window.addEventListener("resize", debounce(lockHeight, 150));
        document.fonts?.ready.then(lockHeight);

        render(false);
        lockHeight();

        return {
            refresh() {
                render(false);
                lockHeight();
            },
        };
    })();

    /* How it works: tabs that drive the phone, advancing alone until touched */

    (() => {
        const tabs = $$('.how-steps [role="tab"]');
        if (!tabs.length) return;

        const TAB_MS = 5000;
        let current = 0;
        let timer = null;
        let visible = false;
        let touched = false;

        function select(index, focus = false) {
            current = index;
            tabs.forEach((tab, i) => {
                const on = i === index;
                tab.setAttribute("aria-selected", String(on));
                tab.tabIndex = on ? 0 : -1;
                document.getElementById(tab.getAttribute("aria-controls")).hidden = !on;
            });
            if (focus) tabs[index].focus();
        }

        function schedule() {
            clearTimeout(timer);
            if (reduceMotion.matches || touched || !visible || document.hidden) return;
            timer = setTimeout(() => {
                select((current + 1) % tabs.length);
                schedule();
            }, TAB_MS);
        }

        const stop = () => {
            touched = true;
            clearTimeout(timer);
        };

        tabs.forEach((tab, i) => {
            tab.addEventListener("click", () => {
                stop();
                select(i);
            });
            tab.addEventListener("keydown", (e) => {
                const moves = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
                let next = null;
                if (e.key in moves) next = (i + moves[e.key] + tabs.length) % tabs.length;
                else if (e.key === "Home") next = 0;
                else if (e.key === "End") next = tabs.length - 1;
                if (next === null) return;
                e.preventDefault();
                stop();
                select(next, true);
            });
        });

        new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            schedule();
        }, { threshold: 0.4 }).observe($(".how-grid"));
        document.addEventListener("visibilitychange", schedule);
    })();

    /* Features on mobile: dots follow the swipeable row */

    (() => {
        const row = $(".bento");
        const dotsEl = $(".carousel-dots");
        if (!row || !dotsEl) return;

        const cards = $$(":scope > .card", row);
        const dots = cards.map(() => dotsEl.appendChild(document.createElement("span")));
        let frame = 0;

        function update() {
            frame = 0;
            const max = row.scrollWidth - row.clientWidth;
            if (max <= 0) return;
            const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : row.clientWidth;
            const index = row.scrollLeft >= max - 2 ? cards.length - 1 : Math.round(row.scrollLeft / step);
            dots.forEach((dot, i) => dot.classList.toggle("is-active", i === index));
        }

        row.addEventListener("scroll", () => {
            frame ||= requestAnimationFrame(update);
        }, { passive: true });
        window.addEventListener("resize", debounce(update, 150));
        dots[0]?.classList.add("is-active");
    })();

    /* Reveal on scroll */

    (() => {
        const items = $$(".reveal");
        if (reduceMotion.matches || !("IntersectionObserver" in window)) {
            items.forEach((el) => el.classList.add("is-in"));
            return;
        }
        // Cards of the same grid come in one after the other.
        $$(".bento, .trust").forEach((grid) => {
            $$(".reveal", grid).forEach((el, i) => el.style.setProperty("--delay", `${(i % 3) * 80}ms`));
        });
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-in");
                observer.unobserve(entry.target);
            });
        }, { rootMargin: "0px 0px -8% 0px", threshold: 0.1 });
        items.forEach((el) => observer.observe(el));
    })();

    /* Language */

    const langToggle = $("#lang-toggle");
    const langMenu = $("#lang-menu");

    function applyLanguage(lang) {
        const dict = window.translations?.[lang];
        if (!dict) return;
        locale = LOCALES[lang];

        $$("[data-i18n]").forEach((el) => {
            const text = dict[el.dataset.i18n];
            if (text !== undefined) el.textContent = text;
        });
        $$("[data-i18n-aria]").forEach((el) => {
            const text = dict[el.dataset.i18nAria];
            if (text !== undefined) el.setAttribute("aria-label", text);
        });

        document.documentElement.lang = lang;
        if (dict["meta.title"]) document.title = dict["meta.title"];
        const description = $('meta[name="description"]');
        if (description && dict["meta.description"]) description.content = dict["meta.description"];

        const code = $(".lang-code", langToggle);
        if (code) code.textContent = lang.toUpperCase();
        $$(".lang-menu [data-lang]").forEach((b) => b.setAttribute("aria-current", String(b.dataset.lang === lang)));
        $$(".lang-chips [data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));

        formatValues();
        demo.refresh();
        storage.set(STORAGE_KEY, lang);
    }

    function setMenu(open, { focusToggle = false } = {}) {
        if (!langMenu || !langToggle) return;
        langMenu.hidden = !open;
        langToggle.setAttribute("aria-expanded", String(open));
        if (open) $('[aria-current="true"]', langMenu)?.focus();
        else if (focusToggle) langToggle.focus();
    }

    langToggle?.addEventListener("click", (e) => {
        e.stopPropagation();
        setMenu(langMenu.hidden);
    });
    langMenu?.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => setMenu(false));
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && langMenu && !langMenu.hidden) setMenu(false, { focusToggle: true });
    });

    $$("[data-lang]").forEach((button) => {
        button.addEventListener("click", () => {
            applyLanguage(button.dataset.lang);
            if (langMenu?.contains(button)) setMenu(false, { focusToggle: true });
        });
    });

    const stored = storage.get(STORAGE_KEY);
    const browser = (navigator.language || "en").split("-")[0];
    applyLanguage(SUPPORTED.includes(stored) ? stored : SUPPORTED.includes(browser) ? browser : "en");
})();
