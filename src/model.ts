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
 * and joints. Each limb is composed of 4-unit segments that are chained by
 * an offset of `-4` on the Y axis. Exposed pivots include the elbows and knees
 * via:
 * - `rightElbow`, `leftElbow`, `rightKnee`, `leftKnee`
 *
 * This naming scheme mirrors the limb layout (upper & lower segments) to
 * reduce alignment mistakes when building or animating custom models.
 */
export class SkinObject extends Group {
	// body parts
	readonly head: BodyPart;
	readonly body: BodyPart;
	readonly rightUpperArm: BodyPart;
	readonly leftUpperArm: BodyPart;
	readonly rightUpperLeg: BodyPart;
	readonly leftUpperLeg: BodyPart;
	readonly rightLowerArm: BodyPart;
	readonly leftLowerArm: BodyPart;
	readonly rightLowerLeg: BodyPart;
	readonly leftLowerLeg: BodyPart;
	readonly rightUpperArmPivot: Group;
	readonly leftUpperArmPivot: Group;
	readonly rightLowerArmPivot: Group;
	readonly leftLowerArmPivot: Group;
	readonly rightUpperLegPivot: Group;
	readonly leftUpperLegPivot: Group;
	readonly rightLowerLegPivot: Group;
	readonly leftLowerLegPivot: Group;
	readonly rightElbow: Group;
	readonly leftElbow: Group;
	readonly rightKnee: Group;
	readonly leftKnee: Group;

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
		rightUpperArmMesh.position.y = -2;
		const rightForearmUpperBox = new BoxGeometry();
		const rightForearmUpperMesh = new Mesh(rightForearmUpperBox, this.layer1MaterialBiased);
		rightForearmUpperMesh.position.y = -2;
		const rightForearmLowerBox = new BoxGeometry();
		const rightForearmLowerMesh = new Mesh(rightForearmLowerBox, this.layer1MaterialBiased);
		rightForearmLowerMesh.position.y = -2;

		this.modelListeners.push(() => {
			rightUpperArmMesh.scale.x = this.slim ? 3 : 4;
			rightUpperArmMesh.scale.y = 4;
			rightUpperArmMesh.scale.z = 4;
			setSkinUVs(rightUpperArmBox, 40, 16, this.slim ? 3 : 4, 4, 4);
			rightForearmUpperMesh.scale.x = this.slim ? 3 : 4;
			rightForearmUpperMesh.scale.y = 4;
			rightForearmUpperMesh.scale.z = 4;
			setSkinUVs(rightForearmUpperBox, 40, 20, this.slim ? 3 : 4, 4, 4);
			rightForearmLowerMesh.scale.x = this.slim ? 3 : 4;
			rightForearmLowerMesh.scale.y = 4;
			rightForearmLowerMesh.scale.z = 4;
			setSkinUVs(rightForearmLowerBox, 40, 24, this.slim ? 3 : 4, 4, 4);
		});

		const rightUpperArm2Box = new BoxGeometry();
		const rightUpperArm2Mesh = new Mesh(rightUpperArm2Box, this.layer2MaterialBiased);
		rightUpperArm2Mesh.position.y = -2;
		const rightForearmUpper2Box = new BoxGeometry();
		const rightForearmUpper2Mesh = new Mesh(rightForearmUpper2Box, this.layer2MaterialBiased);
		rightForearmUpper2Mesh.position.y = -2;
		const rightForearmLower2Box = new BoxGeometry();
		const rightForearmLower2Mesh = new Mesh(rightForearmLower2Box, this.layer2MaterialBiased);
		rightForearmLower2Mesh.position.y = -2;

		this.modelListeners.push(() => {
			const rightArm2Scale = this.slim ? 3.5 : 4.5;
			rightUpperArm2Mesh.scale.x = rightArm2Scale;
			rightUpperArm2Mesh.scale.y = 4.5;
			rightUpperArm2Mesh.scale.z = 4.5;
			setSkinUVs(rightUpperArm2Box, 40, 32, this.slim ? 3 : 4, 4, 4);
			rightForearmUpper2Mesh.scale.x = rightArm2Scale;
			rightForearmUpper2Mesh.scale.y = 4.5;
			rightForearmUpper2Mesh.scale.z = 4.5;
			setSkinUVs(rightForearmUpper2Box, 40, 36, this.slim ? 3 : 4, 4, 4);
			rightForearmLower2Mesh.scale.x = rightArm2Scale;
			rightForearmLower2Mesh.scale.y = 4.5;
			rightForearmLower2Mesh.scale.z = 4.5;
			setSkinUVs(rightForearmLower2Box, 40, 40, this.slim ? 3 : 4, 4, 4);
		});

		this.rightUpperArmPivot = new Group();
		this.rightUpperArmPivot.add(rightUpperArmMesh, rightUpperArm2Mesh);
		this.modelListeners.push(() => {
			this.rightUpperArmPivot.position.x = this.slim ? -0.5 : -1;
		});
		this.rightUpperArmPivot.position.y = -4;

		const rightElbow = new Group();
		rightElbow.position.y = -4;
		rightElbow.add(rightForearmUpperMesh, rightForearmUpper2Mesh);
		this.rightLowerArmPivot = new Group();
		this.rightLowerArmPivot.position.y = -4;
		this.rightLowerArmPivot.add(rightForearmLowerMesh, rightForearmLower2Mesh);
		rightElbow.add(this.rightLowerArmPivot);
		this.rightUpperArmPivot.add(rightElbow);

		const rightLowerArmBox = new BoxGeometry(4, 4, 4);
		setSkinUVs(rightLowerArmBox, 40, 24, 4, 4, 4);
		const rightLowerArmMesh = new Mesh(rightLowerArmBox, this.layer1MaterialBiased);
		rightLowerArmMesh.position.y = -2;
		const rightLowerArm2Box = new BoxGeometry(4.5, 4.5, 4.5);
		setSkinUVs(rightLowerArm2Box, 40, 40, 4, 4, 4);
		const rightLowerArm2Mesh = new Mesh(rightLowerArm2Box, this.layer2MaterialBiased);
		rightLowerArm2Mesh.position.y = -2;
		this.rightLowerArm = new BodyPart(rightLowerArmMesh, rightLowerArm2Mesh);
		this.rightLowerArm.name = "rightLowerArm";
		this.rightLowerArmPivot.add(this.rightLowerArm);

		this.rightElbow = rightElbow;

		this.rightUpperArm = new BodyPart(rightUpperArmMesh, rightUpperArm2Mesh);
		this.rightUpperArm.name = "rightUpperArm";
		this.rightUpperArm.add(this.rightUpperArmPivot);
		this.rightUpperArm.position.x = -5;
		this.rightUpperArm.position.y = -2;
		this.add(this.rightUpperArm);

		// Left Arm
		const leftUpperArmBox = new BoxGeometry();
		const leftUpperArmMesh = new Mesh(leftUpperArmBox, this.layer1MaterialBiased);
		leftUpperArmMesh.position.y = -2;
		const leftForearmUpperBox = new BoxGeometry();
		const leftForearmUpperMesh = new Mesh(leftForearmUpperBox, this.layer1MaterialBiased);
		leftForearmUpperMesh.position.y = -2;
		const leftForearmLowerBox = new BoxGeometry();
		const leftForearmLowerMesh = new Mesh(leftForearmLowerBox, this.layer1MaterialBiased);
		leftForearmLowerMesh.position.y = -2;

		this.modelListeners.push(() => {
			leftUpperArmMesh.scale.x = this.slim ? 3 : 4;
			leftUpperArmMesh.scale.y = 4;
			leftUpperArmMesh.scale.z = 4;
			setSkinUVs(leftUpperArmBox, 32, 48, this.slim ? 3 : 4, 4, 4);
			leftForearmUpperMesh.scale.x = this.slim ? 3 : 4;
			leftForearmUpperMesh.scale.y = 4;
			leftForearmUpperMesh.scale.z = 4;
			setSkinUVs(leftForearmUpperBox, 32, 52, this.slim ? 3 : 4, 4, 4);
			leftForearmLowerMesh.scale.x = this.slim ? 3 : 4;
			leftForearmLowerMesh.scale.y = 4;
			leftForearmLowerMesh.scale.z = 4;
			setSkinUVs(leftForearmLowerBox, 32, 56, this.slim ? 3 : 4, 4, 4);
		});

		const leftUpperArm2Box = new BoxGeometry();
		const leftUpperArm2Mesh = new Mesh(leftUpperArm2Box, this.layer2MaterialBiased);
		leftUpperArm2Mesh.position.y = -2;
		const leftForearmUpper2Box = new BoxGeometry();
		const leftForearmUpper2Mesh = new Mesh(leftForearmUpper2Box, this.layer2MaterialBiased);
		leftForearmUpper2Mesh.position.y = -2;
		const leftForearmLower2Box = new BoxGeometry();
		const leftForearmLower2Mesh = new Mesh(leftForearmLower2Box, this.layer2MaterialBiased);
		leftForearmLower2Mesh.position.y = -2;

		this.modelListeners.push(() => {
			const leftArm2Scale = this.slim ? 3.5 : 4.5;
			leftUpperArm2Mesh.scale.x = leftArm2Scale;
			leftUpperArm2Mesh.scale.y = 4.5;
			leftUpperArm2Mesh.scale.z = 4.5;
			setSkinUVs(leftUpperArm2Box, 48, 48, this.slim ? 3 : 4, 4, 4);
			leftForearmUpper2Mesh.scale.x = leftArm2Scale;
			leftForearmUpper2Mesh.scale.y = 4.5;
			leftForearmUpper2Mesh.scale.z = 4.5;
			setSkinUVs(leftForearmUpper2Box, 48, 52, this.slim ? 3 : 4, 4, 4);
			leftForearmLower2Mesh.scale.x = leftArm2Scale;
			leftForearmLower2Mesh.scale.y = 4.5;
			leftForearmLower2Mesh.scale.z = 4.5;
			setSkinUVs(leftForearmLower2Box, 48, 56, this.slim ? 3 : 4, 4, 4);
		});

		this.leftUpperArmPivot = new Group();
		this.leftUpperArmPivot.add(leftUpperArmMesh, leftUpperArm2Mesh);
		this.modelListeners.push(() => {
			this.leftUpperArmPivot.position.x = this.slim ? 0.5 : 1;
		});
		this.leftUpperArmPivot.position.y = -4;

		const leftElbow = new Group();
		leftElbow.position.y = -4;
		leftElbow.add(leftForearmUpperMesh, leftForearmUpper2Mesh);
		this.leftLowerArmPivot = new Group();
		this.leftLowerArmPivot.position.y = -4;
		this.leftLowerArmPivot.add(leftForearmLowerMesh, leftForearmLower2Mesh);
		leftElbow.add(this.leftLowerArmPivot);
		this.leftUpperArmPivot.add(leftElbow);

		const leftLowerArmBox = new BoxGeometry(4, 4, 4);
		setSkinUVs(leftLowerArmBox, 32, 56, 4, 4, 4);
		const leftLowerArmMesh = new Mesh(leftLowerArmBox, this.layer1MaterialBiased);
		leftLowerArmMesh.position.y = -2;
		const leftLowerArm2Box = new BoxGeometry(4.5, 4.5, 4.5);
		setSkinUVs(leftLowerArm2Box, 48, 56, 4, 4, 4);
		const leftLowerArm2Mesh = new Mesh(leftLowerArm2Box, this.layer2MaterialBiased);
		leftLowerArm2Mesh.position.y = -2;
		this.leftLowerArm = new BodyPart(leftLowerArmMesh, leftLowerArm2Mesh);
		this.leftLowerArm.name = "leftLowerArm";
		this.leftLowerArmPivot.add(this.leftLowerArm);

		this.leftElbow = leftElbow;

		this.leftUpperArm = new BodyPart(leftUpperArmMesh, leftUpperArm2Mesh);
		this.leftUpperArm.name = "leftUpperArm";
		this.leftUpperArm.add(this.leftUpperArmPivot);
		this.leftUpperArm.position.x = 5;
		this.leftUpperArm.position.y = -2;
		this.add(this.leftUpperArm);

		// Right Leg
		const rightUpperLegBox = new BoxGeometry(4, 4, 4);
		setSkinUVs(rightUpperLegBox, 0, 16, 4, 4, 4);
		const rightUpperLegMesh = new Mesh(rightUpperLegBox, this.layer1MaterialBiased);
		rightUpperLegMesh.position.y = -2;

		const rightLowerLegUpperBox = new BoxGeometry(4, 4, 4);
		setSkinUVs(rightLowerLegUpperBox, 0, 20, 4, 4, 4);
		const rightLowerLegUpperMesh = new Mesh(rightLowerLegUpperBox, this.layer1MaterialBiased);
		rightLowerLegUpperMesh.position.y = -2;

		const rightLowerLegLowerBox = new BoxGeometry(4, 4, 4);
		setSkinUVs(rightLowerLegLowerBox, 0, 24, 4, 4, 4);
		const rightLowerLegLowerMesh = new Mesh(rightLowerLegLowerBox, this.layer1MaterialBiased);
		rightLowerLegLowerMesh.position.y = -2;

		const rightUpperLeg2Box = new BoxGeometry(4.5, 4.5, 4.5);
		setSkinUVs(rightUpperLeg2Box, 0, 32, 4, 4, 4);
		const rightUpperLeg2Mesh = new Mesh(rightUpperLeg2Box, this.layer2MaterialBiased);
		rightUpperLeg2Mesh.position.y = -2;

		const rightLowerLegUpper2Box = new BoxGeometry(4.5, 4.5, 4.5);
		setSkinUVs(rightLowerLegUpper2Box, 0, 36, 4, 4, 4);
		const rightLowerLegUpper2Mesh = new Mesh(rightLowerLegUpper2Box, this.layer2MaterialBiased);
		rightLowerLegUpper2Mesh.position.y = -2;

		const rightLowerLegLower2Box = new BoxGeometry(4.5, 4.5, 4.5);
		setSkinUVs(rightLowerLegLower2Box, 0, 40, 4, 4, 4);
		const rightLowerLegLower2Mesh = new Mesh(rightLowerLegLower2Box, this.layer2MaterialBiased);
		rightLowerLegLower2Mesh.position.y = -2;

		this.rightUpperLegPivot = new Group();
		this.rightUpperLegPivot.position.y = -6;
		this.rightUpperLegPivot.add(rightUpperLegMesh, rightUpperLeg2Mesh);

		const rightKnee = new Group();
		rightKnee.position.y = -4;
		rightKnee.add(rightLowerLegUpperMesh, rightLowerLegUpper2Mesh);
		this.rightUpperLegPivot.add(rightKnee);

		this.rightLowerLegPivot = new Group();
		this.rightLowerLegPivot.position.y = -4;
		this.rightLowerLegPivot.add(rightLowerLegLowerMesh, rightLowerLegLower2Mesh);
		rightKnee.add(this.rightLowerLegPivot);

		const rightLowerLegBox = new BoxGeometry(4, 4, 4);
		setSkinUVs(rightLowerLegBox, 0, 24, 4, 4, 4);
		const rightLowerLegMesh = new Mesh(rightLowerLegBox, this.layer1MaterialBiased);
		rightLowerLegMesh.position.y = -2;
		const rightLowerLeg2Box = new BoxGeometry(4.5, 4.5, 4.5);
		setSkinUVs(rightLowerLeg2Box, 0, 40, 4, 4, 4);
		const rightLowerLeg2Mesh = new Mesh(rightLowerLeg2Box, this.layer2MaterialBiased);
		rightLowerLeg2Mesh.position.y = -2;
		this.rightLowerLeg = new BodyPart(rightLowerLegMesh, rightLowerLeg2Mesh);
		this.rightLowerLeg.name = "rightLowerLeg";
		this.rightLowerLegPivot.add(this.rightLowerLeg);

		this.rightKnee = rightKnee;

		this.rightUpperLeg = new BodyPart(rightUpperLegMesh, rightUpperLeg2Mesh);
		this.rightUpperLeg.name = "rightUpperLeg";
		this.rightUpperLeg.add(this.rightUpperLegPivot);
		this.rightUpperLeg.position.x = -1.9;
		this.rightUpperLeg.position.y = -12;
		this.rightUpperLeg.position.z = -0.1;
		this.add(this.rightUpperLeg);

		// Left Leg
		const leftUpperLegBox = new BoxGeometry(4, 4, 4);
		setSkinUVs(leftUpperLegBox, 16, 48, 4, 4, 4);
		const leftUpperLegMesh = new Mesh(leftUpperLegBox, this.layer1MaterialBiased);
		leftUpperLegMesh.position.y = -2;

		const leftLowerLegUpperBox = new BoxGeometry(4, 4, 4);
		setSkinUVs(leftLowerLegUpperBox, 16, 52, 4, 4, 4);
		const leftLowerLegUpperMesh = new Mesh(leftLowerLegUpperBox, this.layer1MaterialBiased);
		leftLowerLegUpperMesh.position.y = -2;

		const leftLowerLegLowerBox = new BoxGeometry(4, 4, 4);
		setSkinUVs(leftLowerLegLowerBox, 16, 56, 4, 4, 4);
		const leftLowerLegLowerMesh = new Mesh(leftLowerLegLowerBox, this.layer1MaterialBiased);
		leftLowerLegLowerMesh.position.y = -2;

		const leftUpperLeg2Box = new BoxGeometry(4.5, 4.5, 4.5);
		setSkinUVs(leftUpperLeg2Box, 0, 48, 4, 4, 4);
		const leftUpperLeg2Mesh = new Mesh(leftUpperLeg2Box, this.layer2MaterialBiased);
		leftUpperLeg2Mesh.position.y = -2;

		const leftLowerLegUpper2Box = new BoxGeometry(4.5, 4.5, 4.5);
		setSkinUVs(leftLowerLegUpper2Box, 0, 52, 4, 4, 4);
		const leftLowerLegUpper2Mesh = new Mesh(leftLowerLegUpper2Box, this.layer2MaterialBiased);
		leftLowerLegUpper2Mesh.position.y = -2;

		const leftLowerLegLower2Box = new BoxGeometry(4.5, 4.5, 4.5);
		setSkinUVs(leftLowerLegLower2Box, 0, 56, 4, 4, 4);
		const leftLowerLegLower2Mesh = new Mesh(leftLowerLegLower2Box, this.layer2MaterialBiased);
		leftLowerLegLower2Mesh.position.y = -2;

		this.leftUpperLegPivot = new Group();
		this.leftUpperLegPivot.position.y = -6;
		this.leftUpperLegPivot.add(leftUpperLegMesh, leftUpperLeg2Mesh);

		const leftKnee = new Group();
		leftKnee.position.y = -4;
		leftKnee.add(leftLowerLegUpperMesh, leftLowerLegUpper2Mesh);
		this.leftUpperLegPivot.add(leftKnee);

		this.leftLowerLegPivot = new Group();
		this.leftLowerLegPivot.position.y = -4;
		this.leftLowerLegPivot.add(leftLowerLegLowerMesh, leftLowerLegLower2Mesh);
		leftKnee.add(this.leftLowerLegPivot);

		const leftLowerLegBox = new BoxGeometry(4, 4, 4);
		setSkinUVs(leftLowerLegBox, 16, 56, 4, 4, 4);
		const leftLowerLegMesh = new Mesh(leftLowerLegBox, this.layer1MaterialBiased);
		leftLowerLegMesh.position.y = -2;
		const leftLowerLeg2Box = new BoxGeometry(4.5, 4.5, 4.5);
		setSkinUVs(leftLowerLeg2Box, 0, 56, 4, 4, 4);
		const leftLowerLeg2Mesh = new Mesh(leftLowerLeg2Box, this.layer2MaterialBiased);
		leftLowerLeg2Mesh.position.y = -2;
		this.leftLowerLeg = new BodyPart(leftLowerLegMesh, leftLowerLeg2Mesh);
		this.leftLowerLeg.name = "leftLowerLeg";
		this.leftLowerLegPivot.add(this.leftLowerLeg);

		this.leftKnee = leftKnee;

		this.leftUpperLeg = new BodyPart(leftUpperLegMesh, leftUpperLeg2Mesh);
		this.leftUpperLeg.name = "leftUpperLeg";
		this.leftUpperLeg.add(this.leftUpperLegPivot);
		this.leftUpperLeg.position.x = 1.9;
		this.leftUpperLeg.position.y = -12;
		this.leftUpperLeg.position.z = -0.1;
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
		this.leftUpperArm.rotation.set(0, 0, 0);
		this.rightUpperArm.rotation.set(0, 0, 0);
		this.leftUpperLeg.rotation.set(0, 0, 0);
		this.rightUpperLeg.rotation.set(0, 0, 0);
		this.rightLowerArm.rotation.set(0, 0, 0);
		this.leftLowerArm.rotation.set(0, 0, 0);
		this.rightLowerLeg.rotation.set(0, 0, 0);
		this.leftLowerLeg.rotation.set(0, 0, 0);
		this.rightElbow.rotation.set(0, 0, 0);
		this.leftElbow.rotation.set(0, 0, 0);
		this.rightKnee.rotation.set(0, 0, 0);
		this.leftKnee.rotation.set(0, 0, 0);
		this.rightElbow.position.set(0, -4, 0);
		this.leftElbow.position.set(0, -4, 0);
		this.rightKnee.position.set(0, -4, 0);
		this.leftKnee.position.set(0, -4, 0);
		this.rightUpperArmPivot.position.set(this.slim ? -0.5 : -1, -4, 0);
		this.leftUpperArmPivot.position.set(this.slim ? 0.5 : 1, -4, 0);
		this.rightLowerArmPivot.position.set(0, -4, 0);
		this.leftLowerArmPivot.position.set(0, -4, 0);
		this.rightUpperLegPivot.position.set(0, -6, 0);
		this.leftUpperLegPivot.position.set(0, -6, 0);
		this.rightLowerLegPivot.position.set(0, -4, 0);
		this.leftLowerLegPivot.position.set(0, -4, 0);
		this.rightLowerArm.position.set(0, 0, 0);
		this.leftLowerArm.position.set(0, 0, 0);
		this.rightLowerLeg.position.set(0, 0, 0);
		this.leftLowerLeg.position.set(0, 0, 0);

		this.body.rotation.set(0, 0, 0);
		this.head.position.y = 0;
		this.body.position.set(0, -6, 0);
		this.rightUpperArm.position.set(-5, -2, 0);
		this.leftUpperArm.position.set(5, -2, 0);
		this.rightUpperLeg.position.set(-1.9, -12, -0.1);
		this.leftUpperLeg.position.set(1.9, -12, -0.1);
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
