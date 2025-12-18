
document.addEventListener("DOMContentLoaded", () => {
    console.log("Kimpay Homepage Initializing...");

    // 1. Language Handling
    try {
        const langToggle = document.getElementById("lang-toggle");
        const langText = langToggle ? langToggle.querySelector(".lang-text") : null;
        
        // Define function to apply language
        const applyLanguage = (lang) => {
            if (!window.translations || !window.translations[lang]) return;
            
            document.querySelectorAll("[data-i18n]").forEach((element) => {
                const key = element.getAttribute("data-i18n");
                if (window.translations[lang][key]) {
                    element.innerHTML = window.translations[lang][key];
                }
            });
            document.documentElement.lang = lang;
            if (langText) langText.textContent = lang.toUpperCase();
            localStorage.setItem("kimpay_lang", lang);
        };

        // Determine initial language
        const storedLang = localStorage.getItem("kimpay_lang");
        const userLang = navigator.language || navigator.userLanguage;
        const browserLang = userLang.startsWith("fr") ? "fr" : "en";
        const initialLang = (storedLang === "fr" || storedLang === "en") ? storedLang : browserLang;

        // Apply initial language
        applyLanguage(initialLang);

        // Event Listener for Switcher
        if (langToggle) {
            langToggle.addEventListener("click", () => {
                const currentLang = document.documentElement.lang;
                const newLang = currentLang === "en" ? "fr" : "en";
                applyLanguage(newLang);
                
                // Re-trigger scroll triggers after language change (text height might change)
                setTimeout(() => {
                    ScrollTrigger.refresh();
                }, 100);
            });
        }
        
        const yearEl = document.getElementById("current-year");
        if (yearEl) yearEl.textContent = new Date().getFullYear();
    } catch (e) {
        console.error("Language/Date Error:", e);
    }

    // 2. Header Scroll Logic (Robust Fallback)
    const header = document.querySelector("header");
    const updateHeader = () => {
        if (!header) return;
        if (window.scrollY > 10) {
            header.classList.add("scrolled");
        } else {
            header.classList.remove("scrolled");
        }
    };
    // Bind native scroll listener immediately
    window.addEventListener("scroll", updateHeader);
    // Trigger once on load
    updateHeader();


    // 3. Lenis & Animations
    try {
        let lenis;
        if (typeof Lenis !== 'undefined') {
            lenis = new Lenis({
                duration: 1.2,
                easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
                smooth: true,
                direction: "vertical",
                smoothTouch: false,
            });
            
            // Sync Header with Lenis scroll
            lenis.on('scroll', updateHeader);

            function raf(time) {
                lenis.raf(time);
                requestAnimationFrame(raf);
            }
            requestAnimationFrame(raf);
            console.log("Lenis initialized.");
        } else {
            console.warn("Lenis library not found. Falling back to native scroll.");
        }

        // 4. GSAP Animations
        if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
            gsap.registerPlugin(ScrollTrigger);

            // Integrate Lenis with ScrollTrigger if Lenis exists
            if (lenis) {
                // lenis.on('scroll', ScrollTrigger.update); // Optional as ScrollTrigger auto-updates usually
                gsap.ticker.add((time) => {
                    lenis.raf(time * 1000);
                });
                gsap.ticker.lagSmoothing(0);
            }

            // Animations setup
            const heroTl = gsap.timeline();
            if (document.querySelectorAll(".fade-in-up").length > 0) {
                heroTl.from(".fade-in-up", {
                    y: 60,
                    opacity: 0,
                    duration: 1,
                    stagger: 0.15,
                    ease: "power3.out",
                });
            }

            gsap.utils.toArray(".bento-card").forEach((card, i) => {
                gsap.from(card, {
                    scrollTrigger: {
                        trigger: card,
                        start: "top 85%",
                        toggleActions: "play none none reverse",
                    },
                    y: 50,
                    opacity: 0,
                    duration: 0.8,
                    delay: i * 0.1,
                    ease: "circ.out",
                });
            });

            gsap.utils.toArray(".step-card").forEach((step, i) => {
                gsap.from(step, {
                    scrollTrigger: {
                        trigger: ".steps-grid", 
                        start: "top 80%",
                    },
                    y: 40,
                    opacity: 0,
                    duration: 0.8,
                    delay: i * 0.2, 
                    ease: "back.out(1.7)",
                });
            });

            gsap.utils.toArray("[data-speed]").forEach((layer) => {
                const speed = layer.dataset.speed;
                gsap.to(layer, {
                    y: (i, target) => -ScrollTrigger.maxScroll(window) * speed * 0.1,
                    ease: "none",
                    scrollTrigger: {
                        trigger: layer,
                        start: "top bottom",
                        end: "bottom top",
                        scrub: 0,
                    },
                });
            });

            if (document.querySelector(".cta-content")) {
                gsap.from(".cta-content", {
                    scrollTrigger: {
                        trigger: ".cta-section",
                        start: "top 70%",
                    },
                    scale: 0.9,
                    opacity: 0,
                    duration: 1,
                    ease: "power2.out",
                });
            }

            // Steps Title Animation (Simple as 1, 2, 3)
            if (document.querySelector(".section-header h2")) {
                const stepsTl = gsap.timeline({
                    scrollTrigger: {
                        trigger: ".steps-section",
                        start: "top 75%", // Triggers nicely when entering view
                        toggleActions: "play none none reverse"
                    }
                });

                // 1. Reveal "Simple as" (with gradient already applied via CSS class)
                stepsTl.from(".section-header .text-gradient", {
                    y: 20,
                    opacity: 0,
                    duration: 0.6,
                    ease: "power2.out"
                });

                // 2. Animate Numbers: 1 -> 2 -> 3
                // We want: "1" appears, then "2" appears, then "3" appears.
                // The user asked for "1 => 1, 2 => 1, 2, 3". 
                // Since they are inline spans, simple staggering opacity is easiest and effective.
                stepsTl.from(".count-step", {
                    opacity: 0,
                    scale: 0.5,
                    y: 10,
                    duration: 0.5,
                    stagger: 0.4, // distinct pause between numbers
                    ease: "back.out(1.7)"
                }, "-=0.2"); // overlap slightly with text reveal
            }
            console.log("GSAP Animations initialized.");

        } else {
             console.warn("GSAP or ScrollTrigger not found.");
        }

    } catch (e) {
        console.error("Animation Error:", e);
    }

    // 5. Spotlight Effect
    try {
        const cards = document.querySelectorAll("[data-spotlight]");
        document.addEventListener("mousemove", (e) => {
            cards.forEach((card) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                card.style.setProperty("--mouse-x", `${x}px`);
                card.style.setProperty("--mouse-y", `${y}px`);
            });
        });
    } catch(e) {}
    
        // 6. Dynamic Hero Text (Fluid Acceleration)
    try {
        const dynamicWordEl = document.getElementById("dynamic-word");
        if (dynamicWordEl) {
            let currentIndex = 0;
            let interval = 2000;
            const minInterval = 30;
            let stepsAtMaxSpeed = 0;
            
            // Helper to get words based on current language
            const getWords = () => {
                const lang = document.documentElement.lang || "en";
                if (window.translations && window.translations[lang]) {
                    // Fetch all available word keys
                    const words = [];
                    for (let i = 1; i <= 14; i++) {
                        if (window.translations[lang][`hero.word.${i}`]) {
                            words.push(window.translations[lang][`hero.word.${i}`]);
                        }
                    }
                    if (words.length > 0) return words;
                }
                // Fallback
                return ["Friends", "Family", "Colleagues"];
            };

            // Set initial word immediately to avoid flash content
            const words = getWords();
            if (words.length > 0) {
                dynamicWordEl.textContent = words[0];
            }

            const rotateText = () => {
                const words = getWords();
                
                // Determine animation duration based on current interval
                // We want the total animation (out + in) to fit within the interval
                // Factor 0.8 leaves a small buffer
                const animDuration = Math.min(0.5, (interval / 1000) * 0.4); 
                
                const isVeryFast = interval < 100;

                if (isVeryFast) {
                    // "Blur" mode: Instant swap with slight opacity jitter/scale for kinetic feel
                    dynamicWordEl.style.transition = "none";
                    dynamicWordEl.style.opacity = Math.max(0.7, Math.random());
                    dynamicWordEl.style.transform = `scaleY(${0.9 + Math.random() * 0.2})`;
                    
                    currentIndex = (currentIndex + 1) % words.length;
                    dynamicWordEl.textContent = words[currentIndex];
                } else {
                    // FluidGSAP mode
                    currentIndex = (currentIndex + 1) % words.length;
                
                    // Animate out
                    gsap.to(dynamicWordEl, {
                        y: -20,
                        opacity: 0,
                        duration: 0.2,
                        onComplete: () => {
                            dynamicWordEl.textContent = words[currentIndex];
                            // Animate in
                            gsap.fromTo(dynamicWordEl, {
                                y: 20,
                                opacity: 0
                            }, {
                                y: 0,
                                opacity: 1,
                                duration: 0.2
                            });
                        }
                    });
                }

                // Acceleration Logic
                if (interval > minInterval) {
                     interval = Math.floor(interval * 0.85); // Smooth acceleration curve (15% faster each step)
                } else {
                     stepsAtMaxSpeed++;
                }

                // Stop Condition
                if (stepsAtMaxSpeed > 25) { // Reduced from 50 to 25 for shorter fast phase
                     // Dramatic Pause Sequence
                     setTimeout(() => {
                         // 1. Fade out the last lingering word completely
                         gsap.to(dynamicWordEl, {
                             opacity: 0,
                             scale: 0.9,
                             duration: 0.3,
                             ease: "power2.out",
                             onComplete: () => {
                                 // 2. Wait a beat (blank space)
                                 setTimeout(() => {
                                     // 3. Elegant reveal of "Everyone" / "Tout le monde"
                                     const lang = document.documentElement.lang || "en";
                                     const finalWord = (window.translations && window.translations[lang]) 
                                        ? window.translations[lang]["hero.word.final"] 
                                        : "Everyone";
                                     
                                     dynamicWordEl.textContent = finalWord;
                                     dynamicWordEl.style.color = "#ffffff";
                                     dynamicWordEl.style.textShadow = "0 0 40px var(--primary)";
                                     
                                     gsap.fromTo(dynamicWordEl, {
                                         scale: 0.8, // Start slightly smaller
                                         opacity: 0
                                     }, {
                                         scale: 1, // Grow to normal, not oversized
                                         opacity: 1,
                                         duration: 1.5, // Slower fade in
                                         ease: "power3.out" // Smooth deceleration
                                     });
                                 }, 200); // 200ms pause
                             }
                         });
                     }, interval);
                     return;
                }

                setTimeout(rotateText, interval);
            };
            setTimeout(rotateText, interval);
        }
    } catch(e) {}
});
