import type { SkinViewer, PlayerObject } from "../src/skinview3d";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { Object3D, Raycaster, Vector2, Vector3 } from "three";

// Augment SkinViewer with joint control helpers
declare module "../src/viewer" {
	interface SkinViewer {
		enableJointControls: () => void;
		exportJointCoordinates: () => string;
	}
}

function getJointObjects(player: PlayerObject): Object3D[] {
	const skin = player.skin;
	return [
		skin.rightElbow,
		skin.leftElbow,
		skin.rightLowerArm,
		skin.leftLowerArm,
		skin.rightKnee,
		skin.leftKnee,
		skin.rightLowerLeg,
		skin.leftLowerLeg,
	];
}

export function attachJointControls(viewer: SkinViewer): void {
	let control: TransformControls | null = null;
	const raycaster = new Raycaster();
	const pointer = new Vector2();

	viewer.enableJointControls = () => {
		viewer.renderer.domElement.addEventListener("mousedown", onPointerDown);
	};

	function onPointerDown(event: MouseEvent): void {
		const rect = viewer.renderer.domElement.getBoundingClientRect();
		pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
		raycaster.setFromCamera(pointer, viewer.camera);
		for (const joint of getJointObjects(viewer.playerObject)) {
			if (raycaster.intersectObject(joint, true).length > 0) {
				if (!control) {
					control = new TransformControls(viewer.camera, viewer.renderer.domElement);
					control.addEventListener("dragging-changed", (e: { value: boolean }) => {
						viewer.controls.enabled = !e.value;
					});
					viewer.scene.add(control);
				}
				control.attach(joint);
				break;
			}
		}
	}

	viewer.exportJointCoordinates = () => {
		const skin = viewer.playerObject.skin;
		const entries: [string, Object3D][] = [
			["rightElbow", skin.rightElbow],
			["leftElbow", skin.leftElbow],
			["rightLowerArm", skin.rightLowerArm],
			["leftLowerArm", skin.leftLowerArm],
			["rightKnee", skin.rightKnee],
			["leftKnee", skin.leftKnee],
			["rightLowerLeg", skin.rightLowerLeg],
			["leftLowerLeg", skin.leftLowerLeg],
		];
		const pos = new Vector3();
		return entries
			.map(([name, obj]) => {
				obj.getWorldPosition(pos);
				return `${name}: ${pos.x.toFixed(3)} ${pos.y.toFixed(3)} ${pos.z.toFixed(3)}`;
			})
			.join("\n");
	};
}
