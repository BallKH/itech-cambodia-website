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

  /* Pause background videos when off-screen (perf/battery) */
  const bgVideos = document.querySelectorAll("video.about-video");
  if ("IntersectionObserver" in window && bgVideos.length) {
    const vio = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.play().catch(() => {});
          else entry.target.pause();
        });
      },
      { threshold: 0.25 }
    );
    bgVideos.forEach((v) => vio.observe(v));
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

  /* Contact form -> Web3Forms */
  const form = document.querySelector("#contact-form");
  if (form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const successEl = document.querySelector(".form-success");
    const errorEl = document.querySelector(".form-error");
    const originalBtnText = submitBtn?.textContent;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      successEl?.classList.remove("show");
      errorEl?.classList.remove("show");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";
      }
      try {
        const res = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: { Accept: "application/json" },
          body: new FormData(form),
        });
        let result = {};
        try {
          result = await res.json();
        } catch (_) {
          /* Web3Forms can return an HTML success page instead of JSON */
        }
        if (!res.ok || result.success === false) {
          throw new Error(result.message || "Submission failed");
        }
        successEl?.classList.add("show");
        form.reset();
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = "Something went wrong sending your message. Please try again, or email us directly at sales@itechcambodia.com.";
          errorEl.classList.add("show");
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
      }
    });
  }

  /* Active nav link by current page (clean-URL aware) */
  const normalize = (p) => {
    const clean = p.replace(/\.html$/, "").replace(/\/+$/, "");
    return clean === "" ? "/" : clean;
  };
  const currentPath = normalize(location.pathname);
  document.querySelectorAll(".nav-links a").forEach((a) => {
    const hrefPath = normalize(a.getAttribute("href").split("#")[0]);
    if (hrefPath === currentPath) {
      a.classList.add("active");
    }
  });

  /* Footer year */
  const yearEl = document.querySelector("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
