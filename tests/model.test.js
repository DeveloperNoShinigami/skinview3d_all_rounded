import test from "node:test";
import { strict as assert } from "node:assert";
import { Vector3 } from "three";
import { PlayerObject } from "../libs/model.js";

function assertWorldPosition(obj, expected) {
        const actual = new Vector3();
        obj.getWorldPosition(actual);
        assert.ok(actual.distanceTo(expected) < 1e-3);
}

test("new players spawn with correct limb placement", () => {
        const player = new PlayerObject();
        const skin = player.skin;

        assertWorldPosition(skin.leftUpperArm, new Vector3(4.085, 8.867, 0));
        assertWorldPosition(skin.rightUpperArm, new Vector3(-4.089, 8.6, 0));
        assertWorldPosition(skin.leftLowerArm, new Vector3(4.085, 0.867, 0));
        assertWorldPosition(skin.rightLowerArm, new Vector3(-4.089, 0.6, 0));
        assertWorldPosition(skin.leftUpperLeg, new Vector3(2, -3.133, 0));
        assertWorldPosition(skin.rightUpperLeg, new Vector3(-2, -3.4, 0));
        assertWorldPosition(skin.leftLowerLeg, new Vector3(2, -11.133, 0));
        assertWorldPosition(skin.rightLowerLeg, new Vector3(-2, -11.4, 0));
        assertWorldPosition(skin.leftElbow, new Vector3(4.085, 4.867, 0));
        assertWorldPosition(skin.rightElbow, new Vector3(-4.089, 4.6, 0));
        assertWorldPosition(skin.leftKnee, new Vector3(2, -7.133, 0));
        assertWorldPosition(skin.rightKnee, new Vector3(-2, -7.4, 0));
});

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

        assertWorldPosition(skin.leftUpperArm, new Vector3(4.085, 8.867, 0));
        assertWorldPosition(skin.rightUpperArm, new Vector3(-4.089, 8.6, 0));
        assertWorldPosition(skin.leftLowerArm, new Vector3(4.085, 0.867, 0));
        assertWorldPosition(skin.rightLowerArm, new Vector3(-4.089, 0.6, 0));
        assertWorldPosition(skin.leftUpperLeg, new Vector3(2, -3.133, 0));
        assertWorldPosition(skin.rightUpperLeg, new Vector3(-2, -3.4, 0));
        assertWorldPosition(skin.leftLowerLeg, new Vector3(2, -11.133, 0));
        assertWorldPosition(skin.rightLowerLeg, new Vector3(-2, -11.4, 0));
        assertWorldPosition(skin.leftElbow, new Vector3(4.085, 4.867, 0));
        assertWorldPosition(skin.rightElbow, new Vector3(-4.089, 4.6, 0));
        assertWorldPosition(skin.leftKnee, new Vector3(2, -7.133, 0));
        assertWorldPosition(skin.rightKnee, new Vector3(-2, -7.4, 0));
});

test("resetJoints restores the skin root translation", () => {
        const player = new PlayerObject();
        const skin = player.skin;

        skin.position.set(1, 2, 3);
        skin.rightUpperArm.position.set(1, 1, 1);

        player.resetJoints();

        assertWorldPosition(skin.rightUpperArm, new Vector3(-4.089, 8.6, 0));
        assert.ok(skin.position.equals(new Vector3(0, 8, 0)));
});
