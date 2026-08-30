"use client";

import { ArrowUpRight, Github, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { navItems } from "@/lib/content";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("#top");

  useEffect(() => {
    const sections = ["top", ...navItems.map((item) => item.href.slice(1))]
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(`#${visible.target.id}`);
      },
      { rootMargin: "-20% 0px -65%", threshold: [0, 0.2, 0.6] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="wordmark" href="#top" aria-label="opsx-dev-pipeline 首页">
          <span className="wordmark-mark" aria-hidden="true">op</span>
          <span>opsx<span className="wordmark-muted">/dev-pipeline</span></span>
        </a>
        <nav className="desktop-nav" aria-label="主导航">
          {navItems.map((item) => (
            <a
              className={active === item.href ? "is-active" : ""}
              aria-current={active === item.href ? "location" : undefined}
              key={item.href}
              href={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <ThemeToggle />
          <a
            className="github-link"
            href="https://github.com/ZhaoYis/My-Skills/tree/main/dev-pipeline"
            target="_blank"
            rel="noreferrer"
          >
            <Github aria-hidden="true" />
            <span>GitHub</span>
            <ArrowUpRight aria-hidden="true" />
          </a>
          <button
            className="menu-button"
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "关闭导航" : "打开导航"}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
      <nav
        id="mobile-nav"
        className={`mobile-nav ${open ? "is-open" : ""}`}
        aria-label="移动端主导航"
      >
        {navItems.map((item) => (
          <a
            className={active === item.href ? "is-active" : ""}
            aria-current={active === item.href ? "location" : undefined}
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
          >
            {item.label}
            <ArrowUpRight aria-hidden="true" />
          </a>
        ))}
        <a
          href="https://github.com/ZhaoYis/My-Skills/tree/main/dev-pipeline"
          target="_blank"
          rel="noreferrer"
        >
          GitHub <ArrowUpRight aria-hidden="true" />
        </a>
      </nav>
    </header>
  );
}