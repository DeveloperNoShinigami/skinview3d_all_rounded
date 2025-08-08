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

	// Create a new array to hold the modified UV data
	const newUVData = [];

	// Iterate over the arrays and copy the data to uvData
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
 * Represents a Minecraft player skin with individually accessible body parts
 * and joints. Elbows and knees are exposed for animation or inverse
 * kinematics through the following pivots:
 * - `rightArmElbow`, `leftArmElbow`, `rightLegKnee`, `leftLegKnee`
 * - `rightArmWrist`, `leftArmWrist`

 */
export class SkinObject extends Group {
	// body parts
	readonly head: BodyPart;
	readonly body: BodyPart;
	readonly rightArm: BodyPart;
	readonly leftArm: BodyPart;
	readonly rightLeg: BodyPart;
	readonly leftLeg: BodyPart;
	readonly rightLowerLeg: BodyPart;
	readonly leftLowerLeg: BodyPart;
	readonly rightHand: BodyPart;
	readonly leftHand: BodyPart;
	readonly rightArmElbow: Group;
	readonly leftArmElbow: Group;
	readonly rightArmWrist: Group;
	readonly leftArmWrist: Group;
	readonly rightLegKnee: Group;
	readonly leftLegKnee: Group;

	private modelListeners: Array<() => void> = []; // called when model(slim property) is changed
	private slim = false;

	private _map: Texture | null = null;
	private layer1Material: MeshStandardMaterial;
	private layer1MaterialBiased: MeshStandardMaterial;
	private layer2Material: MeshStandardMaterial;
	private layer2MaterialBiased: MeshStandardMaterial;

	constructor() {
		super();

		this.layer1Material = new MeshStandardMaterial({
			side: FrontSide,
		});
		this.layer2Material = new MeshStandardMaterial({
			side: DoubleSide,
			transparent: true,
			alphaTest: 1e-5,
		});

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

		// Right Arm
		const rightUpperArmBox = new BoxGeometry();
		const rightUpperArmMesh = new Mesh(rightUpperArmBox, this.layer1MaterialBiased);
		rightUpperArmMesh.position.y = -4;
		const rightLowerArmBox = new BoxGeometry();
		const rightLowerArmMesh = new Mesh(rightLowerArmBox, this.layer1MaterialBiased);
		rightLowerArmMesh.position.y = -4;
		this.modelListeners.push(() => {
			rightUpperArmMesh.scale.x = this.slim ? 3 : 4;
			rightUpperArmMesh.scale.y = 4;
			rightUpperArmMesh.scale.z = 4;
			setSkinUVs(rightUpperArmBox, 40, 16, this.slim ? 3 : 4, 4, 4);
			rightLowerArmMesh.scale.x = this.slim ? 3 : 4;
			rightLowerArmMesh.scale.y = 4;
			rightLowerArmMesh.scale.z = 4;
			setSkinUVs(rightLowerArmBox, 40, 20, this.slim ? 3 : 4, 4, 4);
		});

		const rightUpperArm2Box = new BoxGeometry();
		const rightUpperArm2Mesh = new Mesh(rightUpperArm2Box, this.layer2MaterialBiased);
		rightUpperArm2Mesh.position.y = -4;
		const rightLowerArm2Box = new BoxGeometry();
		const rightLowerArm2Mesh = new Mesh(rightLowerArm2Box, this.layer2MaterialBiased);
		rightLowerArm2Mesh.position.y = -4;
		this.modelListeners.push(() => {
			const rightArm2Scale = this.slim ? 3.5 : 4.5;
			rightUpperArm2Mesh.scale.x = rightArm2Scale;
			rightUpperArm2Mesh.scale.y = 4.5;
			rightUpperArm2Mesh.scale.z = 4.5;
			setSkinUVs(rightUpperArm2Box, 40, 32, this.slim ? 3 : 4, 4, 4);
			rightLowerArm2Mesh.scale.x = rightArm2Scale;
			rightLowerArm2Mesh.scale.y = 4.5;
			rightLowerArm2Mesh.scale.z = 4.5;
			setSkinUVs(rightLowerArm2Box, 40, 36, this.slim ? 3 : 4, 4, 4);
		});

		const rightShoulderPivot = new Group();
		rightShoulderPivot.add(rightUpperArmMesh, rightUpperArm2Mesh);
		this.modelListeners.push(() => {
			rightShoulderPivot.position.x = this.slim ? -0.5 : -1;
		});
		rightShoulderPivot.position.y = 0;

		const rightElbowPivot = new Group();
		rightElbowPivot.position.y = 0;
		const rightLowerArm = new Group();
		rightLowerArm.position.y = -4;
		rightLowerArm.add(rightLowerArmMesh, rightLowerArm2Mesh);
		rightElbowPivot.add(rightLowerArm);
		rightShoulderPivot.add(rightElbowPivot);

		this.rightElbowPivot = rightElbowPivot;
		this.rightLowerArm = rightLowerArm;

		this.rightArm = new BodyPart(rightUpperArmMesh, rightUpperArm2Mesh);
		this.rightArm.name = "rightArm";
		this.rightArm.add(rightShoulderPivot);
		this.rightArm.position.x = -5;
		this.rightArm.position.y = -2;
		this.add(this.rightArm);

		// Left Arm
		const leftUpperArmBox = new BoxGeometry();
		const leftUpperArmMesh = new Mesh(leftUpperArmBox, this.layer1MaterialBiased);
		leftUpperArmMesh.position.y = -4;
		const leftLowerArmBox = new BoxGeometry();
		const leftLowerArmMesh = new Mesh(leftLowerArmBox, this.layer1MaterialBiased);
		leftLowerArmMesh.position.y = -4;
		this.modelListeners.push(() => {
			leftUpperArmMesh.scale.x = this.slim ? 3 : 4;
			leftUpperArmMesh.scale.y = 4;
			leftUpperArmMesh.scale.z = 4;
			setSkinUVs(leftUpperArmBox, 32, 48, this.slim ? 3 : 4, 4, 4);
			leftLowerArmMesh.scale.x = this.slim ? 3 : 4;
			leftLowerArmMesh.scale.y = 4;
			leftLowerArmMesh.scale.z = 4;
			setSkinUVs(leftLowerArmBox, 32, 52, this.slim ? 3 : 4, 4, 4);
		});

		const leftUpperArm2Box = new BoxGeometry();
		const leftUpperArm2Mesh = new Mesh(leftUpperArm2Box, this.layer2MaterialBiased);
		leftUpperArm2Mesh.position.y = -4;
		const leftLowerArm2Box = new BoxGeometry();
		const leftLowerArm2Mesh = new Mesh(leftLowerArm2Box, this.layer2MaterialBiased);
		leftLowerArm2Mesh.position.y = -4;
		this.modelListeners.push(() => {
			const leftArm2Scale = this.slim ? 3.5 : 4.5;
			leftUpperArm2Mesh.scale.x = leftArm2Scale;
			leftUpperArm2Mesh.scale.y = 4.5;
			leftUpperArm2Mesh.scale.z = 4.5;
			setSkinUVs(leftUpperArm2Box, 48, 48, this.slim ? 3 : 4, 4, 4);
			leftLowerArm2Mesh.scale.x = leftArm2Scale;
			leftLowerArm2Mesh.scale.y = 4.5;
			leftLowerArm2Mesh.scale.z = 4.5;
			setSkinUVs(leftLowerArm2Box, 48, 52, this.slim ? 3 : 4, 4, 4);
		});

		const leftShoulderPivot = new Group();
		leftShoulderPivot.add(leftUpperArmMesh, leftUpperArm2Mesh);
		this.modelListeners.push(() => {
			leftShoulderPivot.position.x = this.slim ? 0.5 : 1;
		});
		leftShoulderPivot.position.y = 0;

		const leftElbowPivot = new Group();
		leftElbowPivot.position.y = 0;
		const leftLowerArm = new Group();
		leftLowerArm.position.y = -4;
		leftLowerArm.add(leftLowerArmMesh, leftLowerArm2Mesh);
		leftElbowPivot.add(leftLowerArm);
		leftShoulderPivot.add(leftElbowPivot);

		this.leftElbowPivot = leftElbowPivot;
		this.leftLowerArm = leftLowerArm;

		this.leftArm = new BodyPart(leftUpperArmMesh, leftUpperArm2Mesh);
		this.leftArm.name = "leftArm";
		this.leftArm.add(leftShoulderPivot);
		this.leftArm.position.x = 5;
		this.leftArm.position.y = -2;
		this.add(this.leftArm);

		// Right Leg
		const rightUpperLegBox = new BoxGeometry(4, 4, 4);
		setSkinUVs(rightUpperLegBox, 0, 16, 4, 4, 4);
		const rightUpperLegMesh = new Mesh(rightUpperLegBox, this.layer1MaterialBiased);
		rightUpperLegMesh.position.y = -4;

		const rightLowerLegBox = new BoxGeometry(4, 4, 4);
		setSkinUVs(rightLowerLegBox, 0, 24, 4, 4, 4);
		const rightLowerLegMesh = new Mesh(rightLowerLegBox, this.layer1MaterialBiased);
		rightLowerLegMesh.position.y = -4;

		const rightUpperLeg2Box = new BoxGeometry(4.5, 4.5, 4.5);
		setSkinUVs(rightUpperLeg2Box, 0, 32, 4, 4, 4);
		const rightUpperLeg2Mesh = new Mesh(rightUpperLeg2Box, this.layer2MaterialBiased);
		rightUpperLeg2Mesh.position.y = -4;

		const rightLowerLeg2Box = new BoxGeometry(4.5, 4.5, 4.5);
		setSkinUVs(rightLowerLeg2Box, 0, 40, 4, 4, 4);
		const rightLowerLeg2Mesh = new Mesh(rightLowerLeg2Box, this.layer2MaterialBiased);
		rightLowerLeg2Mesh.position.y = -4;

		const rightHipPivot = new Group();
		rightHipPivot.position.y = 0;
		rightHipPivot.add(rightUpperLegMesh, rightUpperLeg2Mesh);

		const rightKneePivot = new Group();
		rightKneePivot.position.y = 0;
		const rightLowerLeg = new BodyPart(rightLowerLegMesh, rightLowerLeg2Mesh);
		rightLowerLeg.name = "rightLowerLeg";
		rightLowerLeg.position.y = -4;
		rightKneePivot.add(rightLowerLeg);
		rightHipPivot.add(rightKneePivot);

		this.rightLowerLeg = rightLowerLeg;
		this.rightLegKnee = rightKneePivot;

		this.rightLeg = new BodyPart(rightUpperLegMesh, rightUpperLeg2Mesh);
		this.rightLeg.name = "rightLeg";
		this.rightLeg.add(rightHipPivot);
		this.rightLeg.position.x = -1.9;
		this.rightLeg.position.y = -12;
		this.rightLeg.position.z = -0.1;
		this.add(this.rightLeg);

		// Left Leg
		const leftUpperLegBox = new BoxGeometry(4, 4, 4);
		setSkinUVs(leftUpperLegBox, 16, 48, 4, 4, 4);
		const leftUpperLegMesh = new Mesh(leftUpperLegBox, this.layer1MaterialBiased);
		leftUpperLegMesh.position.y = -4;

		const leftLowerLegBox = new BoxGeometry(4, 4, 4);
		setSkinUVs(leftLowerLegBox, 16, 56, 4, 4, 4);
		const leftLowerLegMesh = new Mesh(leftLowerLegBox, this.layer1MaterialBiased);
		leftLowerLegMesh.position.y = -4;

		const leftUpperLeg2Box = new BoxGeometry(4.5, 4.5, 4.5);
		setSkinUVs(leftUpperLeg2Box, 0, 48, 4, 4, 4);
		const leftUpperLeg2Mesh = new Mesh(leftUpperLeg2Box, this.layer2MaterialBiased);
		leftUpperLeg2Mesh.position.y = -4;

		const leftLowerLeg2Box = new BoxGeometry(4.5, 4.5, 4.5);
		setSkinUVs(leftLowerLeg2Box, 0, 56, 4, 4, 4);
		const leftLowerLeg2Mesh = new Mesh(leftLowerLeg2Box, this.layer2MaterialBiased);
		leftLowerLeg2Mesh.position.y = -4;

		const leftHipPivot = new Group();
		leftHipPivot.position.y = 0;
		leftHipPivot.add(leftUpperLegMesh, leftUpperLeg2Mesh);

		const leftKneePivot = new Group();
		leftKneePivot.position.y = 0;
		const leftLowerLeg = new BodyPart(leftLowerLegMesh, leftLowerLeg2Mesh);
		leftLowerLeg.name = "leftLowerLeg";
		leftLowerLeg.position.y = -4;
		leftKneePivot.add(leftLowerLeg);
		leftHipPivot.add(leftKneePivot);

		this.leftLowerLeg = leftLowerLeg;
		this.leftLegKnee = leftKneePivot;

		this.leftLeg = new BodyPart(leftUpperLegMesh, leftUpperLeg2Mesh);
		this.leftLeg.name = "leftLeg";
		this.leftLeg.add(leftHipPivot);
		this.leftLeg.position.x = 1.9;
		this.leftLeg.position.y = -12;
		this.leftLeg.position.z = -0.1;
		this.add(this.leftLeg);

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
		this.leftArm.rotation.set(0, 0, 0);
		this.rightArm.rotation.set(0, 0, 0);
		this.leftLeg.rotation.set(0, 0, 0);
		this.rightLeg.rotation.set(0, 0, 0);
		this.rightLowerLeg.rotation.set(0, 0, 0);
		this.leftLowerLeg.rotation.set(0, 0, 0);
		this.rightHand.rotation.set(0, 0, 0);
		this.leftHand.rotation.set(0, 0, 0);
		this.rightArmElbow.rotation.set(0, 0, 0);
		this.leftArmElbow.rotation.set(0, 0, 0);
		this.rightArmWrist.rotation.set(0, 0, 0);
		this.leftArmWrist.rotation.set(0, 0, 0);
		this.rightLegKnee.rotation.set(0, 0, 0);
		this.leftLegKnee.rotation.set(0, 0, 0);
		this.rightArmElbow.position.set(0, -4, 0);
		this.rightArmWrist.position.set(0, -4, 0);
		this.leftArmElbow.position.set(0, -4, 0);
		this.leftArmWrist.position.set(0, -4, 0);
		this.rightLegKnee.position.set(0, 0, 0);
		this.leftLegKnee.position.set(0, 0, 0);
		this.rightLowerLeg.position.set(0, -4, 0);
		this.leftLowerLeg.position.set(0, -4, 0);
		this.rightHand.position.set(0, 0, 0);
		this.leftHand.position.set(0, 0, 0);
		this.body.rotation.set(0, 0, 0);
		this.head.position.y = 0;
		this.body.position.set(0, -6, 0);
		this.rightArm.position.set(-5, -2, 0);
		this.leftArm.position.set(5, -2, 0);
		this.rightLeg.position.set(-1.9, -12, -0.1);
		this.leftLeg.position.set(1.9, -12, -0.1);
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

		// +z (front) - inside of cape
		// -z (back) - outside of cape
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

	/**
	 * Mirrors the position & rotation of left wing,
	 * and apply them to the right wing.
	 */
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

		this.material = new MeshStandardMaterial({
			side: FrontSide,
		});
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
