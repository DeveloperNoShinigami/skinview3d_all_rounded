import { SkinViewer } from "../libs/viewer.js";
import { Euler, Vector3 } from "three";
import { strict as assert } from "node:assert";
import test from "node:test";

test("players retain spacing after animation change", () => {
	const viewer = Object.create(SkinViewer.prototype);
	viewer.players = [
		{ position: new Vector3(), rotation: new Euler(), resetJoints() {} },
		{ position: new Vector3(), rotation: new Euler(), resetJoints() {} },
	];
	viewer.playerSpacing = 20;
	viewer._autoFit = true;
	viewer.animations = new Map();
	viewer.clock = { stop() {}, autoStart: true };
	viewer.layoutPlayers = SkinViewer.prototype.layoutPlayers;
	let layoutCalls = 0;
	viewer.updateLayout = function () {
		layoutCalls++;
		this.layoutPlayers();
	};

	viewer.updateLayout();
	const before = viewer.players.map(p => p.position.x);
	layoutCalls = 0;
	const animation = { progress: 0 };
	viewer.setAnimation(viewer.players[0], animation);
	const after = viewer.players.map(p => p.position.x);
	assert.deepStrictEqual(after, before);
	assert.equal(layoutCalls, 1);
});
