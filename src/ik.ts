import { IK, IKChain, IKJoint } from "three-ik";
import { Object3D, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from "three";
import type { PlayerObject } from "./model.js";

export interface IKController {
	target: Object3D;
	effector: Object3D;
	ik: IK;
	bones: string[];
	root: IKJoint;
}

export type IKChainMap = Record<string, IKController>;

export function buildLimbIKChains(player: PlayerObject): IKChainMap {
	const skin = player.skin;
	const chains: IKChainMap = {};

	const addChain = (
		name: string,
		upper: Object3D,
		mid: Object3D,
		lower: Object3D,
		color: number,
		bones: string[]
	): void => {
		const target = new Object3D();
		const mesh = new Mesh(new SphereGeometry(0.5), new MeshBasicMaterial({ color }));
		target.add(mesh);

		const basePos = lower.getWorldPosition(new Vector3());
		const endOffset = lower.localToWorld(new Vector3(0, -4, 0)).sub(basePos.clone());
		target.position.copy(basePos.add(endOffset));

		const ik = new IK();
		const chain = new IKChain();
		const root = new IKJoint(upper);
		chain.add(root);
		chain.add(new IKJoint(mid));
		chain.add(new IKJoint(lower), { target });
		chain.effectorIndex = chain.joints.length - 1;
		ik.add(chain);

		chains[`ik.${name}`] = {
			target,
			effector: lower,
			ik,
			bones,
			root,
		};
	};

	addChain("rightArm", skin.rightUpperArm, skin.rightElbow, skin.rightLowerArm, 0xff0000, [
		"skin.rightUpperArm",
		"skin.rightElbow",
		"skin.rightLowerArm",
	]);

	addChain("leftArm", skin.leftUpperArm, skin.leftElbow, skin.leftLowerArm, 0x00ff00, [
		"skin.leftUpperArm",
		"skin.leftElbow",
		"skin.leftLowerArm",
	]);

	addChain("rightLeg", skin.rightUpperLeg, skin.rightKnee, skin.rightLowerLeg, 0x0000ff, [
		"skin.rightUpperLeg",
		"skin.rightKnee",
		"skin.rightLowerLeg",
	]);

	addChain("leftLeg", skin.leftUpperLeg, skin.leftKnee, skin.leftLowerLeg, 0xffff00, [
		"skin.leftUpperLeg",
		"skin.leftKnee",
		"skin.leftLowerLeg",
	]);

	return chains;
}

export function getTargetRelativePosition(controller: IKController): Vector3 {
	const world = controller.target.getWorldPosition(new Vector3());
	return controller.effector.worldToLocal(world);
}

export function getTargetRelativePositions(chains: IKChainMap): Record<string, Vector3> {
	const positions: Record<string, Vector3> = {};
	for (const [name, controller] of Object.entries(chains)) {
		positions[name] = getTargetRelativePosition(controller);
	}
	return positions;
}

export function snapTargetToBone(controller: IKController): void {
	controller.target.position.copy(controller.effector.getWorldPosition(new Vector3()));
}

export function exportTargetPositions(chains: IKChainMap): string {
	const positions = getTargetRelativePositions(chains);
	const json = Object.fromEntries(Object.entries(positions).map(([name, pos]) => [name, [pos.x, pos.y, pos.z]]));
	return JSON.stringify(json, null, 2);
}
