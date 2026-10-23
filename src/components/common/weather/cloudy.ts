import { drawBirds, drawClouds, makeClouds } from "./clouds";
import type { Scene } from "./scene";

/** A steady day: cumulus clouds at three depths over the whole page, and the birds. */
export function createCloudyScene(): Scene {
	const far = makeClouds(301, { count: 11, size: 0.8, yFrom: 0.03, yTo: 0.95 });
	const mid = makeClouds(302, { count: 7, size: 1.05, yFrom: 0.05, yTo: 0.9 });
	const near = makeClouds(303, { count: 4, size: 1.4, yFrom: 0.1, yTo: 0.85 });

	return {
		resize() {},
		draw(frame) {
			drawClouds(frame, far, { speed: 0.6, alpha: 0.3 });
			drawClouds(frame, mid, { speed: 1, alpha: 0.44 });
			drawClouds(frame, near, { speed: 1.4, alpha: 0.56 });
			drawBirds(frame, 0.3);
		},
	};
}
