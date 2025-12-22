document.addEventListener("DOMContentLoaded", () => {
    const langToggle = document.getElementById("lang-toggle");
    const langDropdown = document.getElementById("lang-dropdown");
    const langText = langToggle?.querySelector(".lang-text");
    const langOptions = document.querySelectorAll(".lang-option");

    const applyLanguage = (lang) => {
        if (!window.translations?.[lang]) return;
        document.querySelectorAll("[data-i18n]").forEach((el) => {
            const key = el.getAttribute("data-i18n");
            if (window.translations[lang][key]) el.innerHTML = window.translations[lang][key];
        });
        document.documentElement.lang = lang;
        if (langText) langText.textContent = lang.toUpperCase();
        localStorage.setItem("kimpay_lang", lang);
        
        // Update active state
        langOptions.forEach(opt => {
            opt.classList.toggle("active", opt.dataset.lang === lang);
        });
    };

    const storedLang = localStorage.getItem("kimpay_lang");
    const supportedLangs = ["en", "fr", "de", "es", "pt"];
    const detectBrowserLang = () => {
        const browserLang = (navigator.language || "en").split("-")[0];
        return supportedLangs.includes(browserLang) ? browserLang : "en";
    };
    const initialLang = supportedLangs.includes(storedLang) ? storedLang : detectBrowserLang();
    applyLanguage(initialLang);

    // Toggle dropdown
    langToggle?.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = langDropdown?.classList.toggle("open");
        langToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    // Handle language selection
    langOptions.forEach(option => {
        option.addEventListener("click", () => {
            const newLang = option.dataset.lang;
            applyLanguage(newLang);
            langDropdown?.classList.remove("open");
            langToggle?.setAttribute("aria-expanded", "false");
            
            const dynamicWordEl = document.getElementById("dynamic-word");
            const finalWord = window.translations?.[newLang]?.["hero.word.final"];
            if (dynamicWordEl && finalWord) dynamicWordEl.textContent = finalWord;
            setTimeout(() => ScrollTrigger?.refresh(), 100);
        });
    });

    // Close dropdown on outside click
    document.addEventListener("click", () => {
        langDropdown?.classList.remove("open");
        langToggle?.setAttribute("aria-expanded", "false");
    });

    const yearEl = document.getElementById("current-year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    const header = document.querySelector("header");
    const updateHeader = () => header?.classList.toggle("scrolled", window.scrollY > 10);
    window.addEventListener("scroll", updateHeader, { passive: true });
    updateHeader();

    let lenis = null;
    if (typeof Lenis !== "undefined") {
        lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smooth: true,
            direction: "vertical",
            smoothTouch: false,
        });
        // Using RAF for smooth Lenis updates without forced reflow
        const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
        requestAnimationFrame(raf);

        const headerHeight = 90;
        document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
            anchor.addEventListener("click", (e) => {
                const targetId = anchor.getAttribute("href");
                if (targetId === "#") return;
                const target = document.querySelector(targetId);
                if (target) {
                    e.preventDefault();
                    lenis.scrollTo(target.getBoundingClientRect().top + window.scrollY - headerHeight, { duration: 1.2 });
                }
            });
        });
    }

    if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
        gsap.registerPlugin(ScrollTrigger);
        if (lenis) {
            gsap.ticker.add((time) => lenis.raf(time * 1000));
            gsap.ticker.lagSmoothing(0);
        }

        gsap.from(".fade-in-up", { y: 60, opacity: 0, duration: 1, stagger: 0.15, ease: "power3.out" });

        gsap.utils.toArray(".bento-card").forEach((card, i) => {
            gsap.from(card, {
                scrollTrigger: { trigger: card, start: "top 85%", toggleActions: "play none none reverse" },
                y: 50, opacity: 0, duration: 0.8, delay: i * 0.1, ease: "circ.out",
            });
        });

        gsap.utils.toArray(".step-card").forEach((step, i) => {
            gsap.from(step, {
                scrollTrigger: { trigger: ".steps-grid", start: "top 80%" },
                y: 40, opacity: 0, duration: 0.8, delay: i * 0.2, ease: "back.out(1.7)",
            });
        });

        if (document.querySelector(".features .section-header")) {
            gsap.from(".features .section-header h2", {
                scrollTrigger: { trigger: ".features", start: "top 75%" },
                y: 30, opacity: 0, duration: 0.8, ease: "power2.out",
            });
            gsap.from(".features .section-header p", {
                scrollTrigger: { trigger: ".features", start: "top 75%" },
                y: 20, opacity: 0, duration: 0.8, delay: 0.2, ease: "power2.out",
            });
        }

        if (document.querySelector(".cta-content")) {
            gsap.from(".cta-content", {
                scrollTrigger: { trigger: ".cta-section", start: "top 70%" },
                scale: 0.9, opacity: 0, duration: 1, ease: "power2.out",
            });
        }

        if (document.querySelector(".steps-section .section-header h2")) {
            const stepsTl = gsap.timeline({
                scrollTrigger: { trigger: ".steps-section", start: "top 75%", toggleActions: "play none none reverse" },
            });
            stepsTl.from(".steps-section .section-header .text-gradient", { y: 20, opacity: 0, duration: 0.6, ease: "power2.out" });
            stepsTl.from(".count-step", { opacity: 0, scale: 0.5, y: 10, duration: 0.5, stagger: 0.4, ease: "back.out(1.7)" }, "-=0.2");
        }
    }

    const spotlightCards = document.querySelectorAll("[data-spotlight]");
    let lastMouseUpdate = 0;
    const THROTTLE_MS = 16; // ~60fps
    document.addEventListener("mousemove", (e) => {
        const now = Date.now();
        if (now - lastMouseUpdate < THROTTLE_MS) return;
        lastMouseUpdate = now;
        
        requestAnimationFrame(() => {
            spotlightCards.forEach((card) => {
                const rect = card.getBoundingClientRect();
                card.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
                card.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
            });
        });
    }, { passive: true });

    const dynamicWordEl = document.getElementById("dynamic-word");
    if (dynamicWordEl) {
        let currentIndex = 0;
        let interval = 2000;
        const minInterval = 30;
        let stepsAtMaxSpeed = 0;

        const getWords = () => {
            const lang = document.documentElement.lang || "en";
            const t = window.translations?.[lang];
            if (t) {
                const words = [];
                for (let i = 1; i <= 14; i++) if (t[`hero.word.${i}`]) words.push(t[`hero.word.${i}`]);
                if (words.length > 0) return words;
            }
            return ["Friends", "Family", "Colleagues"];
        };

        const words = getWords();
        if (words.length > 0) dynamicWordEl.textContent = words[0];

        const rotateText = () => {
            const currentWords = getWords();
            const isVeryFast = interval < 100;

            if (isVeryFast) {
                dynamicWordEl.style.transition = "none";
                dynamicWordEl.style.opacity = String(Math.max(0.7, Math.random()));
                dynamicWordEl.style.transform = `scaleY(${0.9 + Math.random() * 0.2})`;
                currentIndex = (currentIndex + 1) % currentWords.length;
                dynamicWordEl.textContent = currentWords[currentIndex];
            } else {
                currentIndex = (currentIndex + 1) % currentWords.length;
                gsap.to(dynamicWordEl, {
                    opacity: 0, duration: 0.15,
                    onComplete: () => {
                        dynamicWordEl.textContent = currentWords[currentIndex];
                        gsap.to(dynamicWordEl, { opacity: 1, duration: 0.15 });
                    },
                });
            }

            if (interval > minInterval) interval = Math.floor(interval * 0.85);
            else stepsAtMaxSpeed++;

            if (stepsAtMaxSpeed > 12) {
                setTimeout(() => {
                    gsap.to(dynamicWordEl, {
                        opacity: 0, scale: 0.9, duration: 0.3, ease: "power2.out",
                        onComplete: () => {
                            setTimeout(() => {
                                const lang = document.documentElement.lang || "en";
                                const finalWord = window.translations?.[lang]?.["hero.word.final"] || "Everyone";
                                dynamicWordEl.textContent = finalWord;
                                dynamicWordEl.style.color = "#ffffff";
                                dynamicWordEl.style.textShadow = "0 0 40px var(--primary)";
                                gsap.fromTo(dynamicWordEl, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.5, ease: "power3.out" });
                            }, 200);
                        },
                    });
                }, interval);
                return;
            }
            setTimeout(rotateText, interval);
        };
        setTimeout(rotateText, interval);
    }
});
