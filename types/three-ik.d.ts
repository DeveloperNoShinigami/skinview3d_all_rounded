declare module "three-ik" {
	import { Object3D } from "three";

	export class IK {
		add(chain: IKChain): void;
		solve(): void;
	}

	export class IKChain {
		joints: IKJoint[];
		effectorIndex: number;
		add(joint: IKJoint, options?: { target?: Object3D }): void;
	}

	export class IKJoint {
		constructor(object: Object3D);
	}
}
