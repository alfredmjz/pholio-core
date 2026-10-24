"use client";

import { useEffect, useRef, useState } from "react";
import { scrollParent } from "@/hooks/use-scrolled";
import { cn } from "@/lib/utils";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "../sections";

/** Links to each Settings group, highlighting the one being read: chips under the title, a side list from xl. */
export function SettingsJumpList() {
	const [active, setActive] = useState<SettingsSectionId>(SETTINGS_SECTIONS[0].id);
	const navRef = useRef<HTMLElement>(null);
	const chipsRef = useRef<HTMLUListElement>(null);
	const listRef = useRef<HTMLUListElement>(null);
	const lineRef = useRef<HTMLSpanElement>(null);
	// A tapped link wins while the page jumps; a group near the end can't scroll up to the band.
	const pickedAt = useRef(0);
	const justPicked = () => Date.now() - pickedAt.current < 800;

	const pick = (id: SettingsSectionId) => {
		pickedAt.current = Date.now();
		setActive(id);
	};

	useEffect(() => {
		const visible = new Map<string, boolean>();
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting);
				if (justPicked()) return;
				const first = SETTINGS_SECTIONS.find((section) => visible.get(section.id));
				if (first) setActive(first.id);
			},
			// The group crossing the upper part of the screen is the one being read.
			{ rootMargin: "-15% 0px -60% 0px" }
		);
		for (const section of SETTINGS_SECTIONS) {
			const element = document.getElementById(section.id);
			if (element) observer.observe(element);
		}

		// The last groups are too short to reach that band, so the bottom of the page picks the last one.
		const nav = navRef.current;
		const scroller = nav ? scrollParent(nav) : window;
		const atBottom = () => {
			if (justPicked()) return;
			const element = scroller instanceof Window ? document.documentElement : scroller;
			if (element.scrollTop > 0 && element.scrollTop + element.clientHeight >= element.scrollHeight - 2) {
				setActive(SETTINGS_SECTIONS[SETTINGS_SECTIONS.length - 1].id);
			}
		};
		scroller.addEventListener("scroll", atBottom, { passive: true });

		// Opened at a section (e.g. /settings#notifications from the bell). The browser doesn't always
		// jump there inside the app's scroll area, on reload especially, so do it here.
		const linked = SETTINGS_SECTIONS.find((section) => `#${section.id}` === window.location.hash);
		if (linked) {
			pick(linked.id);
			document.getElementById(linked.id)?.scrollIntoView();
		} else {
			atBottom();
		}

		return () => {
			observer.disconnect();
			scroller.removeEventListener("scroll", atBottom);
		};
	}, []);

	// From xl the side list starts at the top of its column and eases to the middle of the screen
	// over the first half screen of scrolling. Its line starts where the list starts and, once the
	// page title has scrolled away, runs from the top of the screen.
	useEffect(() => {
		const nav = navRef.current;
		const list = listRef.current;
		const line = lineRef.current;
		const grid = nav?.parentElement;
		if (!nav || !list || !line || !grid) return;
		const scroller = scrollParent(nav);
		const wide = window.matchMedia("(min-width: 1280px)");

		// Scroll events already arrive once per frame, so this runs straight from them.
		const place = () => {
			if (!wide.matches) return;
			const element = scroller instanceof Window ? document.documentElement : scroller;
			const screenTop = scroller instanceof Window ? 0 : scroller.getBoundingClientRect().top;
			const viewport = element.clientHeight;
			const navTop = nav.getBoundingClientRect().top - screenTop;
			const start = grid.getBoundingClientRect().top - screenTop + element.scrollTop;
			const centre = Math.max(start, (viewport - list.offsetHeight) / 2);
			const progress = Math.min(1, element.scrollTop / (viewport / 2));
			const eased = progress * progress * (3 - 2 * progress);
			const top = start + (centre - start) * eased;
			const lineTop = Math.max(0, start - element.scrollTop);
			list.style.transform = `translateY(${top - navTop}px)`;
			line.style.top = `${lineTop - navTop}px`;
			line.style.height = `${top + list.offsetHeight - lineTop}px`;
		};

		place();
		scroller.addEventListener("scroll", place, { passive: true });
		window.addEventListener("resize", place);
		wide.addEventListener("change", place);
		return () => {
			scroller.removeEventListener("scroll", place);
			window.removeEventListener("resize", place);
			wide.removeEventListener("change", place);
		};
	}, []);

	useEffect(() => {
		const row = chipsRef.current;
		const chip = row?.querySelector<HTMLElement>(`[data-section="${active}"]`);
		if (!row || !chip) return;
		const left = chip.offsetLeft - row.offsetLeft;
		if (left < row.scrollLeft || left + chip.offsetWidth > row.scrollLeft + row.clientWidth) {
			row.scrollTo({ left: left - 16, behavior: "smooth" });
		}
	}, [active]);

	return (
		// No fill, so the backdrop always shows behind it. Phones keep the chips under the title rather
		// than pinned, where they would sit on top of the text scrolling under them.
		<nav
			ref={navRef}
			aria-label="Settings sections"
			className="-mx-4 mb-4 px-4 md:-mx-8 md:px-8 xl:sticky xl:top-0 xl:z-30 xl:mx-0 xl:mb-0 xl:h-dvh xl:self-start xl:px-0"
		>
			<ul ref={chipsRef} className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] xl:hidden">
				{SETTINGS_SECTIONS.map((section) => (
					<li key={section.id} className="shrink-0">
						<a
							href={`#${section.id}`}
							data-section={section.id}
							aria-current={active === section.id ? "location" : undefined}
							onClick={() => pick(section.id)}
							className="group flex min-h-11 items-center rounded-full focus-visible:outline-none"
						>
							<span
								className={cn(
									"type-label whitespace-nowrap rounded-full border px-3 py-1.5 transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring",
									active === section.id
										? "border-border-strong bg-card text-primary shadow-sm"
										: "border-transparent text-muted-foreground hover:text-primary"
								)}
							>
								{section.label}
							</span>
						</a>
					</li>
				))}
			</ul>

			<span ref={lineRef} className="absolute left-0 hidden w-px bg-border/70 xl:block" aria-hidden />
			<ul ref={listRef} className="absolute inset-x-0 top-0 hidden will-change-transform xl:block">
				{SETTINGS_SECTIONS.map((section) => (
					<li key={section.id}>
						<a
							href={`#${section.id}`}
							aria-current={active === section.id ? "location" : undefined}
							onClick={() => pick(section.id)}
							className={cn(
								"type-body-sm -ml-px block border-l-2 py-1.5 pl-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
								active === section.id
									? "border-primary font-medium text-primary"
									: "border-transparent text-muted-foreground hover:text-primary"
							)}
						>
							{section.label}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
}
