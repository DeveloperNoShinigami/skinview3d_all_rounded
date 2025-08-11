import type { ModelType } from "skinview-utils";
import {
	BoxGeometry,
	BufferAttribute,
	DoubleSide,
	FrontSide,
	Group,
	Mesh,
	MeshStandardMaterial,
	Object3D,
	Texture,
	Vector2,
} from "three";

function setUVs(
	box: BoxGeometry,
	u: number,
	v: number,
	width: number,
	height: number,
	depth: number,
	textureWidth: number,
	textureHeight: number
): void {
	const toFaceVertices = (x1: number, y1: number, x2: number, y2: number) => [
		new Vector2(x1 / textureWidth, 1.0 - y2 / textureHeight),
		new Vector2(x2 / textureWidth, 1.0 - y2 / textureHeight),
		new Vector2(x2 / textureWidth, 1.0 - y1 / textureHeight),
		new Vector2(x1 / textureWidth, 1.0 - y1 / textureHeight),
	];

	const top = toFaceVertices(u + depth, v, u + width + depth, v + depth);
	const bottom = toFaceVertices(u + width + depth, v, u + width * 2 + depth, v + depth);
	const left = toFaceVertices(u, v + depth, u + depth, v + depth + height);
	const front = toFaceVertices(u + depth, v + depth, u + width + depth, v + depth + height);
	const right = toFaceVertices(u + width + depth, v + depth, u + width + depth * 2, v + height + depth);
	const back = toFaceVertices(u + width + depth * 2, v + depth, u + width * 2 + depth * 2, v + height + depth);

	const uvAttr = box.attributes.uv as BufferAttribute;
	const uvRight = [right[3], right[2], right[0], right[1]];
	const uvLeft = [left[3], left[2], left[0], left[1]];
	const uvTop = [top[3], top[2], top[0], top[1]];
	const uvBottom = [bottom[0], bottom[1], bottom[3], bottom[2]];
	const uvFront = [front[3], front[2], front[0], front[1]];
	const uvBack = [back[3], back[2], back[0], back[1]];

	const newUVData: number[] = [];
	for (const uvArray of [uvRight, uvLeft, uvTop, uvBottom, uvFront, uvBack]) {
		for (const uv of uvArray) {
			newUVData.push(uv.x, uv.y);
		}
	}

	uvAttr.set(new Float32Array(newUVData));
	uvAttr.needsUpdate = true;
}

function setSkinUVs(box: BoxGeometry, u: number, v: number, width: number, height: number, depth: number): void {
	setUVs(box, u, v, width, height, depth, 64, 64);
}

function setCapeUVs(box: BoxGeometry, u: number, v: number, width: number, height: number, depth: number): void {
	setUVs(box, u, v, width, height, depth, 64, 32);
}

/**
 * Notice that innerLayer and outerLayer may NOT be the direct children of the Group.
 */
export class BodyPart extends Group {
	constructor(
		readonly innerLayer: Object3D,
		readonly outerLayer: Object3D
	) {
		super();
		innerLayer.name = "inner";
		outerLayer.name = "outer";
	}
}

/**
 * Represents a Minecraft player skin with individually accessible body parts.
 * Limbs are modeled as single 12‑unit meshes pivoted at the shoulders and hips.
 */
export class SkinObject extends Group {
	// body parts
	readonly head: BodyPart;
	readonly body: BodyPart;
	readonly rightUpperArm: BodyPart;
	readonly leftUpperArm: BodyPart;
	readonly rightUpperLeg: BodyPart;
	readonly leftUpperLeg: BodyPart;

	private modelListeners: Array<() => void> = [];
	private slim = false;

	private _map: Texture | null = null;
	private layer1Material: MeshStandardMaterial;
	private layer1MaterialBiased: MeshStandardMaterial;
	private layer2Material: MeshStandardMaterial;
	private layer2MaterialBiased: MeshStandardMaterial;

	constructor() {
		super();

		this.layer1Material = new MeshStandardMaterial({ side: FrontSide });
		this.layer2Material = new MeshStandardMaterial({ side: DoubleSide, transparent: true, alphaTest: 1e-5 });

		this.layer1MaterialBiased = this.layer1Material.clone();
		this.layer1MaterialBiased.polygonOffset = true;
		this.layer1MaterialBiased.polygonOffsetFactor = 1.0;
		this.layer1MaterialBiased.polygonOffsetUnits = 1.0;

		this.layer2MaterialBiased = this.layer2Material.clone();
		this.layer2MaterialBiased.polygonOffset = true;
		this.layer2MaterialBiased.polygonOffsetFactor = 1.0;
		this.layer2MaterialBiased.polygonOffsetUnits = 1.0;

		// Head
		const headBox = new BoxGeometry(8, 8, 8);
		setSkinUVs(headBox, 0, 0, 8, 8, 8);
		const headMesh = new Mesh(headBox, this.layer1Material);
		const head2Box = new BoxGeometry(9, 9, 9);
		setSkinUVs(head2Box, 32, 0, 8, 8, 8);
		const head2Mesh = new Mesh(head2Box, this.layer2Material);

		this.head = new BodyPart(headMesh, head2Mesh);
		this.head.name = "head";
		this.head.add(headMesh, head2Mesh);
		headMesh.position.y = 4;
		head2Mesh.position.y = 4;
		this.add(this.head);

		// Body
		const bodyBox = new BoxGeometry(8, 12, 4);
		setSkinUVs(bodyBox, 16, 16, 8, 12, 4);
		const bodyMesh = new Mesh(bodyBox, this.layer1Material);
		const body2Box = new BoxGeometry(8.5, 12.5, 4.5);
		setSkinUVs(body2Box, 16, 32, 8, 12, 4);
		const body2Mesh = new Mesh(body2Box, this.layer2Material);

		this.body = new BodyPart(bodyMesh, body2Mesh);
		this.body.name = "body";
		this.body.add(bodyMesh, body2Mesh);
		this.body.position.y = -6;
		this.add(this.body);

		// ===== Right Arm =====
		const rightArmBox = new BoxGeometry(4, 12, 4);
		const rightArmMesh = new Mesh(rightArmBox, this.layer1MaterialBiased);
		rightArmMesh.position.y = -6;
		const rightArm2Box = new BoxGeometry(4.5, 12.5, 4.5);
		const rightArm2Mesh = new Mesh(rightArm2Box, this.layer2MaterialBiased);
		rightArm2Mesh.position.y = -6;

		this.modelListeners.push(() => {
			const wBase = this.slim ? 3 : 4;
			const wOver = this.slim ? 3.5 : 4.5;
			const innerCorr = (wOver - wBase) / 2;

			rightArmMesh.scale.set(wBase / 4, 1, 1);
			rightArmMesh.position.x = -wBase / 2;
			setSkinUVs(rightArmBox, 40, 16, wBase, 12, 4);

			rightArm2Mesh.scale.set(wOver / 4.5, 1, 1);
			rightArm2Mesh.position.x = -(wOver / 2) + innerCorr;
			setSkinUVs(rightArm2Box, 40, 32, wBase, 12, 4);
		});

		this.rightUpperArm = new BodyPart(rightArmMesh, rightArm2Mesh);
		this.rightUpperArm.name = "rightUpperArm";
		this.rightUpperArm.add(rightArmMesh, rightArm2Mesh);
		this.rightUpperArm.position.set(-5, -6, 0);
		this.add(this.rightUpperArm);

		// ===== Left Arm =====
		const leftArmBox = new BoxGeometry(4, 12, 4);
		const leftArmMesh = new Mesh(leftArmBox, this.layer1MaterialBiased);
		leftArmMesh.position.y = -6;
		const leftArm2Box = new BoxGeometry(4.5, 12.5, 4.5);
		const leftArm2Mesh = new Mesh(leftArm2Box, this.layer2MaterialBiased);
		leftArm2Mesh.position.y = -6;

		this.modelListeners.push(() => {
			const wBase = this.slim ? 3 : 4;
			const wOver = this.slim ? 3.5 : 4.5;
			const innerCorr = (wOver - wBase) / 2;

			leftArmMesh.scale.set(wBase / 4, 1, 1);
			leftArmMesh.position.x = +wBase / 2;
			setSkinUVs(leftArmBox, 32, 48, wBase, 12, 4);

			leftArm2Mesh.scale.set(wOver / 4.5, 1, 1);
			leftArm2Mesh.position.x = +(wOver / 2) - innerCorr;
			setSkinUVs(leftArm2Box, 48, 48, wBase, 12, 4);
		});

		this.leftUpperArm = new BodyPart(leftArmMesh, leftArm2Mesh);
		this.leftUpperArm.name = "leftUpperArm";
		this.leftUpperArm.add(leftArmMesh, leftArm2Mesh);
		this.leftUpperArm.position.set(5, -6, 0);
		this.add(this.leftUpperArm);

		// ===== Right Leg =====
		const rightLegBox = new BoxGeometry(4, 12, 4);
		setSkinUVs(rightLegBox, 0, 16, 4, 12, 4);
		const rightLegMesh = new Mesh(rightLegBox, this.layer1MaterialBiased);
		rightLegMesh.position.y = -6;
		const rightLeg2Box = new BoxGeometry(4.5, 12.5, 4.5);
		setSkinUVs(rightLeg2Box, 0, 32, 4, 12, 4);
		const rightLeg2Mesh = new Mesh(rightLeg2Box, this.layer2MaterialBiased);
		rightLeg2Mesh.position.y = -6;

		this.rightUpperLeg = new BodyPart(rightLegMesh, rightLeg2Mesh);
		this.rightUpperLeg.name = "rightUpperLeg";
		this.rightUpperLeg.add(rightLegMesh, rightLeg2Mesh);
		this.rightUpperLeg.position.set(-2, -12, 0);
		this.add(this.rightUpperLeg);

		// ===== Left Leg =====
		const leftLegBox = new BoxGeometry(4, 12, 4);
		setSkinUVs(leftLegBox, 16, 48, 4, 12, 4);
		const leftLegMesh = new Mesh(leftLegBox, this.layer1MaterialBiased);
		leftLegMesh.position.y = -6;
		const leftLeg2Box = new BoxGeometry(4.5, 12.5, 4.5);
		setSkinUVs(leftLeg2Box, 0, 48, 4, 12, 4);
		const leftLeg2Mesh = new Mesh(leftLeg2Box, this.layer2MaterialBiased);
		leftLeg2Mesh.position.y = -6;

		this.leftUpperLeg = new BodyPart(leftLegMesh, leftLeg2Mesh);
		this.leftUpperLeg.name = "leftUpperLeg";
		this.leftUpperLeg.add(leftLegMesh, leftLeg2Mesh);
		this.leftUpperLeg.position.set(2, -12, 0);
		this.add(this.leftUpperLeg);

		this.modelType = "default";
	}

	get map(): Texture | null {
		return this._map;
	}

	set map(newMap: Texture | null) {
		this._map = newMap;
		this.layer1Material.map = newMap;
		this.layer1Material.needsUpdate = true;
		this.layer1MaterialBiased.map = newMap;
		this.layer1MaterialBiased.needsUpdate = true;
		this.layer2Material.map = newMap;
		this.layer2Material.needsUpdate = true;
		this.layer2MaterialBiased.map = newMap;
		this.layer2MaterialBiased.needsUpdate = true;
	}

	get modelType(): ModelType {
		return this.slim ? "slim" : "default";
	}

	set modelType(value: ModelType) {
		this.slim = value === "slim";
		this.modelListeners.forEach(listener => listener());
	}

	private getBodyParts(): Array<BodyPart> {
		const parts: Array<BodyPart> = [];
		this.traverse(obj => {
			if (obj !== this && obj instanceof BodyPart) {
				parts.push(obj);
			}
		});
		return parts;
	}

	setInnerLayerVisible(value: boolean): void {
		this.getBodyParts().forEach(part => (part.innerLayer.visible = value));
	}

	setOuterLayerVisible(value: boolean): void {
		this.getBodyParts().forEach(part => (part.outerLayer.visible = value));
	}

	resetJoints(): void {
		this.head.rotation.set(0, 0, 0);
		this.rightUpperArm.rotation.set(0, 0, 0);
		this.leftUpperArm.rotation.set(0, 0, 0);
		this.rightUpperLeg.rotation.set(0, 0, 0);
		this.leftUpperLeg.rotation.set(0, 0, 0);

		this.body.rotation.set(0, 0, 0);
		this.head.position.y = 0;
		this.body.position.set(0, -6, 0);

		this.rightUpperArm.position.set(-5, -6, 0);
		this.leftUpperArm.position.set(5, -6, 0);
		this.rightUpperLeg.position.set(-2, -12, 0);
		this.leftUpperLeg.position.set(2, -12, 0);
	}
}

export class CapeObject extends Group {
	readonly cape: Mesh;
	private material: MeshStandardMaterial;

	constructor() {
		super();

		this.material = new MeshStandardMaterial({
			side: DoubleSide,
			transparent: true,
			alphaTest: 1e-5,
		});

		const capeBox = new BoxGeometry(10, 16, 1);
		setCapeUVs(capeBox, 0, 0, 10, 16, 1);
		this.cape = new Mesh(capeBox, this.material);
		this.cape.position.y = -8;
		this.cape.position.z = 0.5;
		this.add(this.cape);
	}

	get map(): Texture | null {
		return this.material.map;
	}

	set map(newMap: Texture | null) {
		this.material.map = newMap;
		this.material.needsUpdate = true;
	}
}

export class ElytraObject extends Group {
	readonly leftWing: Group;
	readonly rightWing: Group;

	private material: MeshStandardMaterial;

	constructor() {
		super();

		this.material = new MeshStandardMaterial({
			side: DoubleSide,
			transparent: true,
			alphaTest: 1e-5,
		});

		const leftWingBox = new BoxGeometry(12, 22, 4);
		setCapeUVs(leftWingBox, 22, 0, 10, 20, 2);
		const leftWingMesh = new Mesh(leftWingBox, this.material);
		leftWingMesh.position.x = -5;
		leftWingMesh.position.y = -10;
		leftWingMesh.position.z = -1;
		this.leftWing = new Group();
		this.leftWing.add(leftWingMesh);
		this.add(this.leftWing);

		const rightWingBox = new BoxGeometry(12, 22, 4);
		setCapeUVs(rightWingBox, 22, 0, 10, 20, 2);
		const rightWingMesh = new Mesh(rightWingBox, this.material);
		rightWingMesh.scale.x = -1;
		rightWingMesh.position.x = 5;
		rightWingMesh.position.y = -10;
		rightWingMesh.position.z = -1;
		this.rightWing = new Group();
		this.rightWing.add(rightWingMesh);
		this.add(this.rightWing);

		this.leftWing.position.x = 5;
		this.leftWing.rotation.x = 0.2617994;
		this.resetJoints();
	}

	resetJoints(): void {
		this.leftWing.rotation.y = 0.01; // to avoid z-fighting
		this.leftWing.rotation.z = 0.2617994;
		this.updateRightWing();
	}

	updateRightWing(): void {
		this.rightWing.position.x = -this.leftWing.position.x;
		this.rightWing.position.y = this.leftWing.position.y;
		this.rightWing.rotation.x = this.leftWing.rotation.x;
		this.rightWing.rotation.y = -this.leftWing.rotation.y;
		this.rightWing.rotation.z = -this.leftWing.rotation.z;
	}

	get map(): Texture | null {
		return this.material.map;
	}

	set map(newMap: Texture | null) {
		this.material.map = newMap;
		this.material.needsUpdate = true;
	}
}

export class EarsObject extends Group {
	readonly rightEar: Mesh;
	readonly leftEar: Mesh;

	private material: MeshStandardMaterial;

	constructor() {
		super();

		this.material = new MeshStandardMaterial({ side: FrontSide });
		const earBox = new BoxGeometry(8, 8, 4 / 3);
		setUVs(earBox, 0, 0, 6, 6, 1, 14, 7);

		this.rightEar = new Mesh(earBox, this.material);
		this.rightEar.name = "rightEar";
		this.rightEar.position.x = -6;
		this.add(this.rightEar);

		this.leftEar = new Mesh(earBox, this.material);
		this.leftEar.name = "leftEar";
		this.leftEar.position.x = 6;
		this.add(this.leftEar);
	}

	get map(): Texture | null {
		return this.material.map;
	}

	set map(newMap: Texture | null) {
		this.material.map = newMap;
		this.material.needsUpdate = true;
	}
}

export type BackEquipment = "cape" | "elytra";

const CapeDefaultAngle = (10.8 * Math.PI) / 180;

export class PlayerObject extends Group {
	readonly skin: SkinObject;
	readonly cape: CapeObject;
	readonly elytra: ElytraObject;
	readonly ears: EarsObject;

	constructor() {
		super();

		this.skin = new SkinObject();
		this.skin.name = "skin";
		this.skin.position.y = 8;
		this.add(this.skin);

		this.cape = new CapeObject();
		this.cape.name = "cape";
		this.cape.position.y = 8;
		this.cape.position.z = -2;
		this.cape.rotation.x = CapeDefaultAngle;
		this.cape.rotation.y = Math.PI;
		this.add(this.cape);

		this.elytra = new ElytraObject();
		this.elytra.name = "elytra";
		this.elytra.position.y = 8;
		this.elytra.position.z = -2;
		this.elytra.visible = false;
		this.add(this.elytra);

		this.ears = new EarsObject();
		this.ears.name = "ears";
		this.ears.position.y = 10;
		this.ears.position.z = 2 / 3;
		this.ears.visible = false;
		this.skin.head.add(this.ears);
	}

	get backEquipment(): BackEquipment | null {
		if (this.cape.visible) {
			return "cape";
		} else if (this.elytra.visible) {
			return "elytra";
		} else {
			return null;
		}
	}

	set backEquipment(value: BackEquipment | null) {
		this.cape.visible = value === "cape";
		this.elytra.visible = value === "elytra";
	}

	resetJoints(): void {
		this.skin.resetJoints();
		this.cape.rotation.x = CapeDefaultAngle;
		this.cape.position.y = 8;
		this.cape.position.z = -2;
		this.elytra.position.y = 8;
		this.elytra.position.z = -2;
		this.elytra.rotation.x = 0;
		this.elytra.resetJoints();
	}
}
