import test from "node:test";
import { strict as assert } from "node:assert";
import { SkinViewer } from "../libs/viewer.js";
import { PlayerAnimation } from "../libs/animation.js";
import { PlayerObject } from "../libs/model.js";

class AnimA extends PlayerAnimation {
	animate(player) {
		player.skin.leftUpperArmPivot.rotation.x = 0.5;
	}
}

class AnimB extends PlayerAnimation {
	animate(player) {
		player.skin.rightUpperArmPivot.rotation.y = 0.5;
	}
}

test("setAnimation resets limbs and progress when switching", () => {
	const viewer = Object.create(SkinViewer.prototype);
	const player = new PlayerObject();
	viewer.players = [player];
	viewer.animations = new Map();
	viewer.clock = { stop() {}, autoStart: true };
	viewer._autoFit = false;
	viewer.updateLayout = () => {};

	const anim1 = new AnimA();
	anim1.progress = 5;
	viewer.setAnimation(player, anim1);
	assert.equal(anim1.progress, 0);
	anim1.update(player, 1);
	assert.notEqual(player.skin.leftUpperArmPivot.rotation.x, 0);

	const anim2 = new AnimB();
	anim2.progress = 5;
	viewer.setAnimation(player, anim2);
	assert.equal(anim2.progress, 0);

	const limbs = [
		player.skin.leftUpperArmPivot,
		player.skin.rightUpperArmPivot,
		player.skin.leftLowerArmPivot,
		player.skin.rightLowerArmPivot,
		player.skin.leftElbow,
		player.skin.rightElbow,
		player.skin.leftUpperLegPivot,
		player.skin.rightUpperLegPivot,
		player.skin.leftLowerLegPivot,
		player.skin.rightLowerLegPivot,
		player.skin.leftKnee,
		player.skin.rightKnee,
	];
	for (const limb of limbs) {
		assert.equal(limb.rotation.x, 0);
		assert.equal(limb.rotation.y, 0);
		assert.equal(limb.rotation.z, 0);
	}
});
