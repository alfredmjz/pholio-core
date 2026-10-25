import { useEffect, useRef, useState } from "react";

export function scrollParent(element: HTMLElement): HTMLElement | Window {
	for (let node = element.parentElement; node; node = node.parentElement) {
		if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node;
	}
	return window;
}

/** True once a pinned (sticky) element has stuck and content is passing beneath it. */
export function useScrolled<T extends HTMLElement>() {
	const ref = useRef<T>(null);
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const scroller = scrollParent(element);
		const update = () => {
			const scrollTop = scroller instanceof Window ? scroller.scrollY : scroller.scrollTop;
			const scrollerTop = scroller instanceof Window ? 0 : scroller.getBoundingClientRect().top;
			setScrolled(scrollTop > 4 && element.getBoundingClientRect().top <= scrollerTop + 1);
		};
		update();
		// A restored or hash scroll can land after the first check without firing a scroll event.
		const frame = requestAnimationFrame(update);
		scroller.addEventListener("scroll", update, { passive: true });
		return () => {
			cancelAnimationFrame(frame);
			scroller.removeEventListener("scroll", update);
		};
	}, []);

	return { ref, scrolled };
}
