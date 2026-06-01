/* ---------------------------------------------------------------------------
   TaskFlow — landing page interactions (vanilla JS)
   Reveal-on-scroll, sticky-nav state, count-up stats, pointer parallax,
   and a spotlight that follows the cursor across feature cards.
--------------------------------------------------------------------------- */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---- Reveal on scroll ----------------------------------------------- */
const revealEls = document.querySelectorAll("[data-reveal]");
revealEls.forEach((el) => {
  const d = el.dataset.revealDelay;
  if (d) el.style.setProperty("--reveal-delay", d + "ms");
});

if (reduceMotion || !("IntersectionObserver" in window)) {
  revealEls.forEach((el) => el.classList.add("is-visible"));
} else {
  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  );
  revealEls.forEach((el) => io.observe(el));
}

/* ---- Sticky nav background ------------------------------------------ */
const nav = document.getElementById("nav");
const onScroll = () => nav.classList.toggle("is-stuck", window.scrollY > 8);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

/* ---- Count-up stats ------------------------------------------------- */
function countUp(el) {
  const target = parseFloat(el.dataset.count);
  const suffix = el.dataset.suffix || "";
  if (reduceMotion || target === 0) {
    el.textContent = target + suffix;
    return;
  }
  const duration = 1400;
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
    el.textContent = Math.round(target * eased) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const counters = document.querySelectorAll("[data-count]");
if ("IntersectionObserver" in window && !reduceMotion) {
  const co = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          countUp(entry.target);
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.6 }
  );
  counters.forEach((el) => co.observe(el));
} else {
  counters.forEach((el) => (el.textContent = el.dataset.count + (el.dataset.suffix || "")));
}

/* ---- Pointer parallax on the hero mockup ---------------------------- */
const mock = document.getElementById("mock");
if (mock && !reduceMotion && window.matchMedia("(pointer: fine)").matches) {
  const visual = mock.closest(".hero__visual");
  visual.addEventListener("pointermove", (e) => {
    const r = visual.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    mock.style.animation = "none";
    mock.style.transform = `rotateY(${-12 + x * 10}deg) rotateX(${6 - y * 10}deg) translateZ(0)`;
  });
  visual.addEventListener("pointerleave", () => {
    mock.style.animation = "";
    mock.style.transform = "";
  });
}

/* ---- Spotlight that follows the cursor on feature cards ------------- */
document.querySelectorAll(".feature").forEach((card) => {
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  });
});
