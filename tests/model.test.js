import test from "node:test";
import { strict as assert } from "node:assert";
import { Vector3 } from "three";
import { PlayerObject } from "../libs/model.js";

test("resetJoints restores default pivots for arms and legs", () => {
	const player = new PlayerObject();
	const skin = player.skin;

	// Disturb all arm and leg pivots
	skin.leftUpperArm.position.set(1, 1, 1);
	skin.rightUpperArm.position.set(1, 1, 1);
	skin.leftLowerArm.position.set(1, 1, 1);
	skin.rightLowerArm.position.set(1, 1, 1);
	skin.leftUpperLeg.position.set(1, 1, 1);
	skin.rightUpperLeg.position.set(1, 1, 1);
	skin.leftLowerLeg.position.set(1, 1, 1);
	skin.rightLowerLeg.position.set(1, 1, 1);
	skin.leftElbow.position.set(1, 1, 1);
	skin.rightElbow.position.set(1, 1, 1);
	skin.leftKnee.position.set(1, 1, 1);
	skin.rightKnee.position.set(1, 1, 1);

	player.resetJoints();

	assert.ok(skin.leftUpperArm.position.equals(new Vector3(5, -2, 0)));
	assert.ok(skin.rightUpperArm.position.equals(new Vector3(-5, -2, 0)));
	assert.ok(skin.leftLowerArm.position.equals(new Vector3(0, 0, 0)));
	assert.ok(skin.rightLowerArm.position.equals(new Vector3(0, 0, 0)));
	assert.ok(skin.leftUpperLeg.position.equals(new Vector3(1.9, -12, -0.1)));
	assert.ok(skin.rightUpperLeg.position.equals(new Vector3(-1.9, -12, -0.1)));
	assert.ok(skin.leftLowerLeg.position.equals(new Vector3(0, 0, 0)));
	assert.ok(skin.rightLowerLeg.position.equals(new Vector3(0, 0, 0)));
	assert.ok(skin.leftElbow.position.equals(new Vector3(0, -4, 0)));
	assert.ok(skin.rightElbow.position.equals(new Vector3(0, -4, 0)));
	assert.ok(skin.leftKnee.position.equals(new Vector3(0, -4, 0)));
	assert.ok(skin.rightKnee.position.equals(new Vector3(0, -4, 0)));
});
