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
        skin.leftUpperLeg.position.set(1, 1, 1);
        skin.rightUpperLeg.position.set(1, 1, 1);

	player.resetJoints();

        assert.ok(skin.leftUpperArm.position.equals(new Vector3(5, -6, 0)));
        assert.ok(skin.rightUpperArm.position.equals(new Vector3(-5, -6, 0)));
        assert.ok(skin.leftUpperLeg.position.equals(new Vector3(2, -12, 0)));
        assert.ok(skin.rightUpperLeg.position.equals(new Vector3(-2, -12, 0)));
});
