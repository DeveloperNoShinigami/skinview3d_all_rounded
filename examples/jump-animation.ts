import type { PlayerObject } from "../src/model";
import { PlayerAnimation } from "../src/animation";

/**
 * Simple animation that makes the player jump up and down.
 */
export class JumpAnimation extends PlayerAnimation {
	protected animate(player: PlayerObject): void {
		player.position.y = Math.abs(Math.sin(this.progress * 2 * Math.PI)) * 5;
	}
}
