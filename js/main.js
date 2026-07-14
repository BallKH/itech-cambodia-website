// iTech Cambodia — shared site behavior

document.addEventListener("DOMContentLoaded", () => {
  /* Mobile nav toggle */
  const toggle = document.querySelector(".nav-toggle");
  const body = document.body;
  if (toggle) {
    toggle.addEventListener("click", () => {
      body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", body.classList.contains("nav-open"));
    });
    document.querySelectorAll(".nav-links a").forEach((link) => {
      link.addEventListener("click", () => body.classList.remove("nav-open"));
    });
  }

  /* Navbar scroll state */
  const navbar = document.querySelector(".navbar");
  const backTop = document.querySelector(".back-top");
  const onScroll = () => {
    const scrolled = window.scrollY > 12;
    if (navbar) navbar.classList.toggle("is-scrolled", scrolled);
    if (backTop) backTop.classList.toggle("show", window.scrollY > 480);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  if (backTop) {
    backTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  /* Scroll-reveal animation */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  /* Service tabs (services.html) */
  const tabs = document.querySelectorAll(".svc-tab");
  const panels = document.querySelectorAll(".svc-panel");
  if (tabs.length) {
    const activate = (target) => {
      tabs.forEach((t) => t.classList.toggle("active", t.dataset.target === target));
      panels.forEach((p) => p.classList.toggle("active", p.id === target));
    };
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        activate(tab.dataset.target);
        history.replaceState(null, "", "#" + tab.dataset.target);
      });
    });
    const hash = location.hash.replace("#", "");
    if (hash && document.getElementById(hash)) activate(hash);
  }

  /* Contact form (front-end only demo) */
  const form = document.querySelector("#contact-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      document.querySelector(".form-success")?.classList.add("show");
      form.reset();
    });
  }

  /* Active nav link by current page */
  const current = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach((a) => {
    const href = a.getAttribute("href");
    if (href === current || (current === "" && href === "index.html")) {
      a.classList.add("active");
    }
  });

  /* Footer year */
  const yearEl = document.querySelector("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
