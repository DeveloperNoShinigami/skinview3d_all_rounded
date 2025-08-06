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

export class SkinObject extends Group {
	// body parts
	readonly head: BodyPart;
	readonly body: BodyPart;
	readonly rightArm: BodyPart;
	readonly leftArm: BodyPart;
	readonly rightLeg: BodyPart;
	readonly leftLeg: BodyPart;
	readonly rightArmElbow: Group;
	readonly leftArmElbow: Group;
	readonly rightLegKnee: Group;
	readonly leftLegKnee: Group;

	private rightArmLower: BodyPart;
	private leftArmLower: BodyPart;
	private rightLegLower: BodyPart;
	private leftLegLower: BodyPart;

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
		this.modelListeners.push(() => {
			rightUpperArmMesh.scale.x = this.slim ? 3 : 4;
			rightUpperArmMesh.scale.y = 6;
			rightUpperArmMesh.scale.z = 4;
			setSkinUVs(rightUpperArmBox, 40, 16, this.slim ? 3 : 4, 6, 4);
		});
		rightUpperArmMesh.position.y = -3;

		const rightUpperArm2Box = new BoxGeometry();
		const rightUpperArm2Mesh = new Mesh(rightUpperArm2Box, this.layer2MaterialBiased);
		this.modelListeners.push(() => {
			rightUpperArm2Mesh.scale.x = this.slim ? 3.5 : 4.5;
			rightUpperArm2Mesh.scale.y = 6.5;
			rightUpperArm2Mesh.scale.z = 4.5;
			setSkinUVs(rightUpperArm2Box, 40, 32, this.slim ? 3 : 4, 6, 4);
		});
		rightUpperArm2Mesh.position.y = -3;

		this.rightArmElbow = new Group();
		this.rightArmElbow.position.y = -6;

		const rightLowerArmBox = new BoxGeometry();
		const rightLowerArmMesh = new Mesh(rightLowerArmBox, this.layer1MaterialBiased);
		this.modelListeners.push(() => {
			rightLowerArmMesh.scale.x = this.slim ? 3 : 4;
			rightLowerArmMesh.scale.y = 6;
			rightLowerArmMesh.scale.z = 4;
			setSkinUVs(rightLowerArmBox, 40, 22, this.slim ? 3 : 4, 6, 4);
		});
		rightLowerArmMesh.position.y = -3;

		const rightLowerArm2Box = new BoxGeometry();
		const rightLowerArm2Mesh = new Mesh(rightLowerArm2Box, this.layer2MaterialBiased);
		this.modelListeners.push(() => {
			rightLowerArm2Mesh.scale.x = this.slim ? 3.5 : 4.5;
			rightLowerArm2Mesh.scale.y = 6.5;
			rightLowerArm2Mesh.scale.z = 4.5;
			setSkinUVs(rightLowerArm2Box, 40, 38, this.slim ? 3 : 4, 6, 4);
		});
		rightLowerArm2Mesh.position.y = -3;

		this.rightArmLower = new BodyPart(rightLowerArmMesh, rightLowerArm2Mesh);
		this.rightArmLower.add(rightLowerArmMesh, rightLowerArm2Mesh);
		this.rightArmElbow.add(this.rightArmLower);

		const rightArmPivot = new Group();
		rightArmPivot.add(rightUpperArmMesh, rightUpperArm2Mesh, this.rightArmElbow);
		this.modelListeners.push(() => {
			rightArmPivot.position.x = this.slim ? -0.5 : -1;
		});
		rightArmPivot.position.y = 2;

		this.rightArm = new BodyPart(rightUpperArmMesh, rightUpperArm2Mesh);
		this.rightArm.name = "rightArm";
		this.rightArm.add(rightArmPivot);
		this.rightArm.position.x = -5;
		this.rightArm.position.y = -2;
		this.add(this.rightArm);

		// Left Arm
		const leftUpperArmBox = new BoxGeometry();
		const leftUpperArmMesh = new Mesh(leftUpperArmBox, this.layer1MaterialBiased);
		this.modelListeners.push(() => {
			leftUpperArmMesh.scale.x = this.slim ? 3 : 4;
			leftUpperArmMesh.scale.y = 6;
			leftUpperArmMesh.scale.z = 4;
			setSkinUVs(leftUpperArmBox, 32, 48, this.slim ? 3 : 4, 6, 4);
		});
		leftUpperArmMesh.position.y = -3;

		const leftUpperArm2Box = new BoxGeometry();
		const leftUpperArm2Mesh = new Mesh(leftUpperArm2Box, this.layer2MaterialBiased);
		this.modelListeners.push(() => {
			leftUpperArm2Mesh.scale.x = this.slim ? 3.5 : 4.5;
			leftUpperArm2Mesh.scale.y = 6.5;
			leftUpperArm2Mesh.scale.z = 4.5;
			setSkinUVs(leftUpperArm2Box, 48, 48, this.slim ? 3 : 4, 6, 4);
		});
		leftUpperArm2Mesh.position.y = -3;

		this.leftArmElbow = new Group();
		this.leftArmElbow.position.y = -6;

		const leftLowerArmBox = new BoxGeometry();
		const leftLowerArmMesh = new Mesh(leftLowerArmBox, this.layer1MaterialBiased);
		this.modelListeners.push(() => {
			leftLowerArmMesh.scale.x = this.slim ? 3 : 4;
			leftLowerArmMesh.scale.y = 6;
			leftLowerArmMesh.scale.z = 4;
			setSkinUVs(leftLowerArmBox, 32, 54, this.slim ? 3 : 4, 6, 4);
		});
		leftLowerArmMesh.position.y = -3;

		const leftLowerArm2Box = new BoxGeometry();
		const leftLowerArm2Mesh = new Mesh(leftLowerArm2Box, this.layer2MaterialBiased);
		this.modelListeners.push(() => {
			leftLowerArm2Mesh.scale.x = this.slim ? 3.5 : 4.5;
			leftLowerArm2Mesh.scale.y = 6.5;
			leftLowerArm2Mesh.scale.z = 4.5;
			setSkinUVs(leftLowerArm2Box, 48, 54, this.slim ? 3 : 4, 6, 4);
		});
		leftLowerArm2Mesh.position.y = -3;

		this.leftArmLower = new BodyPart(leftLowerArmMesh, leftLowerArm2Mesh);
		this.leftArmLower.add(leftLowerArmMesh, leftLowerArm2Mesh);
		this.leftArmElbow.add(this.leftArmLower);

		const leftArmPivot = new Group();
		leftArmPivot.add(leftUpperArmMesh, leftUpperArm2Mesh, this.leftArmElbow);
		this.modelListeners.push(() => {
			leftArmPivot.position.x = this.slim ? 0.5 : 1;
		});
		leftArmPivot.position.y = 2;

		this.leftArm = new BodyPart(leftUpperArmMesh, leftUpperArm2Mesh);
		this.leftArm.name = "leftArm";
		this.leftArm.add(leftArmPivot);
		this.leftArm.position.x = 5;
		this.leftArm.position.y = -2;
		this.add(this.leftArm);

		// Right Leg
		const rightUpperLegBox = new BoxGeometry();
		const rightUpperLegMesh = new Mesh(rightUpperLegBox, this.layer1MaterialBiased);
		rightUpperLegMesh.scale.set(4, 6, 4);
		setSkinUVs(rightUpperLegBox, 0, 16, 4, 6, 4);
		rightUpperLegMesh.position.y = -3;

		const rightUpperLeg2Box = new BoxGeometry();
		const rightUpperLeg2Mesh = new Mesh(rightUpperLeg2Box, this.layer2MaterialBiased);
		rightUpperLeg2Mesh.scale.set(4.5, 6.5, 4.5);
		setSkinUVs(rightUpperLeg2Box, 0, 32, 4, 6, 4);
		rightUpperLeg2Mesh.position.y = -3;

		this.rightLegKnee = new Group();
		this.rightLegKnee.position.y = -6;

		const rightLowerLegBox = new BoxGeometry();
		const rightLowerLegMesh = new Mesh(rightLowerLegBox, this.layer1MaterialBiased);
		rightLowerLegMesh.scale.set(4, 6, 4);
		setSkinUVs(rightLowerLegBox, 0, 22, 4, 6, 4);
		rightLowerLegMesh.position.y = -3;

		const rightLowerLeg2Box = new BoxGeometry();
		const rightLowerLeg2Mesh = new Mesh(rightLowerLeg2Box, this.layer2MaterialBiased);
		rightLowerLeg2Mesh.scale.set(4.5, 6.5, 4.5);
		setSkinUVs(rightLowerLeg2Box, 0, 38, 4, 6, 4);
		rightLowerLeg2Mesh.position.y = -3;

		this.rightLegLower = new BodyPart(rightLowerLegMesh, rightLowerLeg2Mesh);
		this.rightLegLower.add(rightLowerLegMesh, rightLowerLeg2Mesh);
		this.rightLegKnee.add(this.rightLegLower);

		this.rightLeg = new BodyPart(rightUpperLegMesh, rightUpperLeg2Mesh);
		this.rightLeg.name = "rightLeg";
		this.rightLeg.add(rightUpperLegMesh, rightUpperLeg2Mesh, this.rightLegKnee);
		this.rightLeg.position.x = -1.9;
		this.rightLeg.position.y = -12;
		this.rightLeg.position.z = -0.1;
		this.add(this.rightLeg);

		// Left Leg
		const leftUpperLegBox = new BoxGeometry();
		const leftUpperLegMesh = new Mesh(leftUpperLegBox, this.layer1MaterialBiased);
		leftUpperLegMesh.scale.set(4, 6, 4);
		setSkinUVs(leftUpperLegBox, 16, 48, 4, 6, 4);
		leftUpperLegMesh.position.y = -3;

		const leftUpperLeg2Box = new BoxGeometry();
		const leftUpperLeg2Mesh = new Mesh(leftUpperLeg2Box, this.layer2MaterialBiased);
		leftUpperLeg2Mesh.scale.set(4.5, 6.5, 4.5);
		setSkinUVs(leftUpperLeg2Box, 0, 48, 4, 6, 4);
		leftUpperLeg2Mesh.position.y = -3;

		this.leftLegKnee = new Group();
		this.leftLegKnee.position.y = -6;

		const leftLowerLegBox = new BoxGeometry();
		const leftLowerLegMesh = new Mesh(leftLowerLegBox, this.layer1MaterialBiased);
		leftLowerLegMesh.scale.set(4, 6, 4);
		setSkinUVs(leftLowerLegBox, 16, 54, 4, 6, 4);
		leftLowerLegMesh.position.y = -3;

		const leftLowerLeg2Box = new BoxGeometry();
		const leftLowerLeg2Mesh = new Mesh(leftLowerLeg2Box, this.layer2MaterialBiased);
		leftLowerLeg2Mesh.scale.set(4.5, 6.5, 4.5);
		setSkinUVs(leftLowerLeg2Box, 0, 54, 4, 6, 4);
		leftLowerLeg2Mesh.position.y = -3;

		this.leftLegLower = new BodyPart(leftLowerLegMesh, leftLowerLeg2Mesh);
		this.leftLegLower.add(leftLowerLegMesh, leftLowerLeg2Mesh);
		this.leftLegKnee.add(this.leftLegLower);

		this.leftLeg = new BodyPart(leftUpperLegMesh, leftUpperLeg2Mesh);
		this.leftLeg.name = "leftLeg";
		this.leftLeg.add(leftUpperLegMesh, leftUpperLeg2Mesh, this.leftLegKnee);
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
		this.rightArmElbow.rotation.set(0, 0, 0);
		this.leftArmElbow.rotation.set(0, 0, 0);
		this.rightLegKnee.rotation.set(0, 0, 0);
		this.leftLegKnee.rotation.set(0, 0, 0);
		this.rightArmElbow.position.set(0, -6, 0);
		this.leftArmElbow.position.set(0, -6, 0);
		this.rightLegKnee.position.set(0, -6, 0);
		this.leftLegKnee.position.set(0, -6, 0);
		(this.rightArm.innerLayer as Mesh).position.set(0, -3, 0);
		(this.rightArm.outerLayer as Mesh).position.set(0, -3, 0);
		(this.leftArm.innerLayer as Mesh).position.set(0, -3, 0);
		(this.leftArm.outerLayer as Mesh).position.set(0, -3, 0);
		this.rightArmLower.rotation.set(0, 0, 0);
		this.rightArmLower.position.set(0, 0, 0);
		(this.rightArmLower.innerLayer as Mesh).position.set(0, -3, 0);
		(this.rightArmLower.outerLayer as Mesh).position.set(0, -3, 0);
		this.leftArmLower.rotation.set(0, 0, 0);
		this.leftArmLower.position.set(0, 0, 0);
		(this.leftArmLower.innerLayer as Mesh).position.set(0, -3, 0);
		(this.leftArmLower.outerLayer as Mesh).position.set(0, -3, 0);
		this.rightLegLower.rotation.set(0, 0, 0);
		this.rightLegLower.position.set(0, 0, 0);
		(this.rightLeg.innerLayer as Mesh).position.set(0, -3, 0);
		(this.rightLeg.outerLayer as Mesh).position.set(0, -3, 0);
		(this.rightLegLower.innerLayer as Mesh).position.set(0, -3, 0);
		(this.rightLegLower.outerLayer as Mesh).position.set(0, -3, 0);
		this.leftLegLower.rotation.set(0, 0, 0);
		this.leftLegLower.position.set(0, 0, 0);
		(this.leftLeg.innerLayer as Mesh).position.set(0, -3, 0);
		(this.leftLeg.outerLayer as Mesh).position.set(0, -3, 0);
		(this.leftLegLower.innerLayer as Mesh).position.set(0, -3, 0);
		(this.leftLegLower.outerLayer as Mesh).position.set(0, -3, 0);
		this.body.rotation.set(0, 0, 0);
		this.head.position.y = 0;
		this.body.position.y = -6;
		this.body.position.z = 0;
		this.rightArm.position.x = -5;
		this.rightArm.position.y = -2;
		this.rightArm.position.z = 0;
		this.leftArm.position.x = 5;
		this.leftArm.position.y = -2;
		this.leftArm.position.z = 0;
		this.rightLeg.position.x = -1.9;
		this.rightLeg.position.y = -12;
		this.rightLeg.position.z = -0.1;
		this.leftLeg.position.x = 1.9;
		this.leftLeg.position.y = -12;
		this.leftLeg.position.z = -0.1;
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
