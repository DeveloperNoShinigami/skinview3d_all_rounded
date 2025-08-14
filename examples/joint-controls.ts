import type { SkinViewer, PlayerObject } from "../src/skinview3d";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { Object3D, Quaternion, Raycaster, Vector2, Vector3 } from "three";

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
		// right arm
		skin.rightUpperArmPivot,
		skin.rightElbow,
		skin.rightLowerArmPivot,
		skin.rightLowerArm,
		// left arm
		skin.leftUpperArmPivot,
		skin.leftElbow,
		skin.leftLowerArmPivot,
		skin.leftLowerArm,
		// right leg
		skin.rightUpperLegPivot,
		skin.rightKnee,
		skin.rightLowerLegPivot,
		skin.rightLowerLeg,
		// left leg
		skin.leftUpperLegPivot,
		skin.leftKnee,
		skin.leftLowerLegPivot,
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
		const joints = getJointObjects(viewer.playerObject);
		const jointSet = new Set(joints);
		const intersects = raycaster.intersectObject(viewer.playerObject.skin, true);
		for (const intersect of intersects) {
			let obj: Object3D | null = intersect.object;
			while (obj) {
				if (jointSet.has(obj)) {
					if (!control) {
						control = new TransformControls(viewer.camera, viewer.renderer.domElement);
						control.addEventListener("dragging-changed", (e: { value: boolean }) => {
							viewer.controls.enabled = !e.value;
						});
						viewer.scene.add(control);
					}
					control.attach(obj);
					return;
				}
				obj = obj.parent;
			}
		}
	}

	viewer.exportJointCoordinates = () => {
		const skin = viewer.playerObject.skin;
		const entries: [string, Object3D][] = [
			["rightUpperArm", skin.rightUpperArmPivot],
			["rightElbow", skin.rightElbow],
			["rightLowerArm", skin.rightLowerArmPivot],
			["leftUpperArm", skin.leftUpperArmPivot],
			["leftElbow", skin.leftElbow],
			["leftLowerArm", skin.leftLowerArmPivot],
			["rightUpperLeg", skin.rightUpperLegPivot],
			["rightKnee", skin.rightKnee],
			["rightLowerLeg", skin.rightLowerLegPivot],
			["leftUpperLeg", skin.leftUpperLegPivot],
			["leftKnee", skin.leftKnee],
			["leftLowerLeg", skin.leftLowerLegPivot],
		];
		const pos = new Vector3();
		const quat = new Quaternion();
		const data = Object.fromEntries(
			entries.map(([name, obj]) => {
				obj.getWorldPosition(pos);
				obj.getWorldQuaternion(quat);
				return [
					name,
					{
						position: {
							x: Number(pos.x.toFixed(3)),
							y: Number(pos.y.toFixed(3)),
							z: Number(pos.z.toFixed(3)),
						},
						rotation: {
							x: Number(quat.x.toFixed(3)),
							y: Number(quat.y.toFixed(3)),
							z: Number(quat.z.toFixed(3)),
							w: Number(quat.w.toFixed(3)),
						},
					},
				];
			})
		);
		return JSON.stringify(data, null, 2);
	};
}
