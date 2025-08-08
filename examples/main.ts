import * as skinview3d from "../src/skinview3d";
import type { BackEquipment } from "../src/model";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { IK, IKChain, IKJoint } from "three-ik";
import {
	BoxHelper,
	Euler,
	Mesh,
	MeshBasicMaterial,
	Object3D,
	Raycaster,
	SphereGeometry,
	Vector2,
	Vector3,
} from "three";

import "./style.css";
import { GeneratedAnimation } from "./generated-animation";
import { JumpAnimation } from "./jump-animation";

const skinParts = [
	"head",
	"body",
	"rightUpperArm",
	"leftUpperArm",
	"rightUpperLeg",
	"leftUpperLeg",
	"rightElbow",
	"leftElbow",
	"rightKnee",
	"leftKnee",
	"rightLowerArm",
	"leftLowerArm",
	"rightLowerLeg",
	"leftLowerLeg",
];
const skinLayers = ["innerLayer", "outerLayer"];
const animationClasses = {
	idle: skinview3d.IdleAnimation,
	walk: skinview3d.WalkingAnimation,
	run: skinview3d.RunningAnimation,
	fly: skinview3d.FlyingAnimation,
	wave: skinview3d.WaveAnimation,
	bend: skinview3d.BendAnimation,
	crouch: skinview3d.CrouchAnimation,
	hit: skinview3d.HitAnimation,
	generated: GeneratedAnimation,
	jump: JumpAnimation,
};

let skinViewer: skinview3d.SkinViewer;
let transformControls: TransformControls | null = null;
let positionControls: TransformControls | null = null;
let selectedPlayer: skinview3d.PlayerObject;
let positionControllerEnabled = false;
let previousPositionAutoRotate = false;
let previousPositionAnimationPaused = false;
let selectedBone = "playerObject";
const keyframes: Array<{ time: number; bone: string; position: Vector3; rotation: Euler }> = [];
let editorEnabled = false;
let previousAutoRotate = false;
let previousAnimationPaused = false;
let loadedAnimation: skinview3d.Animation | null = null;
let uploadStatusEl: HTMLElement | null = null;
const ikChains: Record<string, { target: Object3D; effector: Object3D; ik: IK; bones: string[]; root: IKJoint }> = {};
let ikUpdateId: number | null = null;
let jointHelpers: BoxHelper[] = [];
const extraPlayers: skinview3d.PlayerObject[] = [];
let selectionHelper: BoxHelper | null = null;
const raycaster = new Raycaster();
const pointer = new Vector2();
const extraPlayerControls: HTMLElement[] = [];
let canvasWidth: HTMLInputElement | null = null;
let canvasHeight: HTMLInputElement | null = null;
let playerSelector: HTMLSelectElement | null = null;
const spacingOptions = [20, 40, 60];
let spacingIndex = 0;

function initializeAssetMenu(): void {
	const mainMenu = document.getElementById("main_menu");
	const subMenu = document.getElementById("sub_menu");
	if (!mainMenu || !subMenu) {
		return;
	}

	const showMain = () => {
		subMenu.classList.add("hidden");
		subMenu.innerHTML = "";
		mainMenu.classList.remove("hidden");
	};

	const createMenu = (title: string, load: (source: string | File) => Promise<unknown> | unknown) => {
		mainMenu.classList.add("hidden");
		subMenu.classList.remove("hidden");
		subMenu.innerHTML = `<h1>${title}</h1>
<p class="control">Provide a URL or choose a file.</p>
<input id="menu_url" type="text" class="control" placeholder="URL" />
<input id="menu_file" type="file" class="control" />`;
		const urlInput = subMenu.querySelector("#menu_url") as HTMLInputElement;
		const fileInput = subMenu.querySelector("#menu_file") as HTMLInputElement;

		urlInput?.addEventListener("change", () => {
			const url = urlInput.value.trim();
			if (url) {
				void Promise.resolve(load(url)).finally(showMain);
			} else {
				showMain();
			}
		});

		fileInput?.addEventListener("change", () => {
			const file = fileInput.files?.[0];
			if (file) {
				void Promise.resolve(load(file)).finally(showMain);
			} else {
				showMain();
			}
		});
	};

	document.getElementById("menu_skin")?.addEventListener("click", () => {
		createMenu("Load Skin", source => skinViewer.loadSkin(source, {}, selectedPlayer));
	});

	document.getElementById("menu_back")?.addEventListener("click", () => {
		mainMenu.classList.add("hidden");
		subMenu.classList.remove("hidden");
		subMenu.innerHTML = `<h1>Load Back Item</h1>
<p class="control">Choose cape or elytra then provide a texture.</p>
<div class="control"><label><input type="radio" name="back_type" value="cape" checked /> Cape</label>
<label><input type="radio" name="back_type" value="elytra" /> Elytra</label></div>
<input id="menu_url" type="text" class="control" placeholder="URL" />
<input id="menu_file" type="file" class="control" />`;
		const urlInput = subMenu.querySelector("#menu_url") as HTMLInputElement;
		const fileInput = subMenu.querySelector("#menu_file") as HTMLInputElement;
		const load = (source: string | File) => {
			const equip = (subMenu.querySelector('input[name="back_type"]:checked') as HTMLInputElement)
				?.value as BackEquipment;
			return skinViewer.loadCape(source, { backEquipment: equip }, selectedPlayer);
		};
		urlInput?.addEventListener("change", () => {
			const url = urlInput.value.trim();
			if (url) {
				void Promise.resolve(load(url)).finally(showMain);
			} else {
				showMain();
			}
		});
		fileInput?.addEventListener("change", () => {
			const file = fileInput.files?.[0];
			if (file) {
				void Promise.resolve(load(file)).finally(showMain);
			} else {
				showMain();
			}
		});
	});

	document.getElementById("menu_ears")?.addEventListener("click", () => {
		createMenu("Load Ears", source => skinViewer.loadEars(source, {}, selectedPlayer));
	});

	document.getElementById("menu_animation")?.addEventListener("click", () => {
		createMenu("Load Animation", async source => {
			let text: string;
			if (typeof source === "string") {
				const resp = await fetch(source);
				text = await resp.text();
			} else {
				text = await source.text();
			}
			const data = JSON.parse(text);
			loadedAnimation = skinview3d.createKeyframeAnimation(data);
			skinViewer.setAnimation(selectedPlayer, loadedAnimation);
		});
	});
}

function updateJointHighlight(enabled: boolean): void {
	for (const helper of jointHelpers) {
		skinViewer.scene.remove(helper);
	}
	jointHelpers = [];
	if (enabled) {
		const joints = [
			selectedPlayer.skin.rightElbow,
			selectedPlayer.skin.leftElbow,
			selectedPlayer.skin.rightLowerArm,
			selectedPlayer.skin.leftLowerArm,
			selectedPlayer.skin.rightKnee,
			selectedPlayer.skin.leftKnee,
			selectedPlayer.skin.rightLowerLeg,
			selectedPlayer.skin.leftLowerLeg,
		];
		for (const joint of joints) {
			const helper = new BoxHelper(joint, 0xff0000);
			helper.update();
			jointHelpers.push(helper);
			skinViewer.scene.add(helper);
		}
	}
}

function updateJointHelpers(): void {
	for (const helper of jointHelpers) {
		helper.update();
	}
	selectionHelper?.update();
	requestAnimationFrame(updateJointHelpers);
}
updateJointHelpers();

function getBone(path: string): Object3D {
	if (path === "playerObject") {
		return selectedPlayer;
	}
	if (path.startsWith("ik.")) {
		return ikChains[path]?.target ?? selectedPlayer;
	}
	return path.split(".").reduce((obj: any, part) => obj?.[part], selectedPlayer) ?? selectedPlayer;
}

function updateViewportSize(): void {
	const skinContainer = document.getElementById("skin_container") as HTMLCanvasElement;
	if (!skinContainer) {
		return;
	}
	if (editorEnabled || extraPlayers.length > 0) {
		skinContainer.classList.add("expanded");
		skinViewer.width = 800;
		skinViewer.height = 600;
	} else {
		skinContainer.classList.remove("expanded");
		if (canvasWidth && canvasHeight) {
			skinViewer.width = Number(canvasWidth.value);
			skinViewer.height = Number(canvasHeight.value);
		}
	}

	function selectPlayer(player: skinview3d.PlayerObject | null): void {
		if (selectionHelper) {
			skinViewer.scene.remove(selectionHelper);
			selectionHelper = null;
		}
		selectedPlayer = player ?? skinViewer.playerObject;
		if (player) {
			selectionHelper = new BoxHelper(selectedPlayer, 0x00ff00);
			selectionHelper.update();
			skinViewer.scene.add(selectionHelper);
		}
		const highlight = (document.getElementById("highlight_joints") as HTMLInputElement)?.checked ?? false;
		updateJointHighlight(highlight);
		if (editorEnabled) {
			setupIK();
		}
		for (const part of skinParts) {
			const skinPart = (selectedPlayer.skin as any)[part];
			for (const layer of skinLayers) {
				const checkbox = document.querySelector<HTMLInputElement>(
					`#layers_table input[type="checkbox"][data-part="${part}"][data-layer="${layer}"]`
				);
				const skinLayer = skinPart?.[layer];
				if (checkbox && skinLayer) {
					checkbox.checked = skinLayer.visible;
				}
			}
		}
		const backEquipmentRadios = document.querySelectorAll<HTMLInputElement>(
			'input[type="radio"][name="back_equipment"]'
		);
		for (const el of backEquipmentRadios) {
			el.checked = selectedPlayer.backEquipment === el.value;
		}

		if (playerSelector) {
			if (selectedPlayer === skinViewer.playerObject) {
				playerSelector.value = "0";
			} else {
				const idx = extraPlayers.indexOf(selectedPlayer);
				playerSelector.value = idx >= 0 ? String(idx + 1) : "0";
			}
		}
	}

	function handlePlayerClick(event: MouseEvent): void {
		const rect = skinViewer.renderer.domElement.getBoundingClientRect();
		pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
		raycaster.setFromCamera(pointer, skinViewer.camera);
		const players = [skinViewer.playerObject, ...extraPlayers];
		let hit: skinview3d.PlayerObject | null = null;
		for (const p of players) {
			if (raycaster.intersectObject(p, true).length > 0) {
				hit = p;
				break;
			}
		}
		if (hit && hit !== selectedPlayer) {
			selectPlayer(hit);
		} else {
			selectPlayer(null);
		}
	}
}

function createPlayerResourceMenu(player: skinview3d.PlayerObject, index: number): HTMLElement {
	const div = document.createElement("div");
	div.className = "control-section";

	const animLabel = document.createElement("label");
	animLabel.textContent = `Player ${index} animation: `;
	const select = document.createElement("select");
	for (const name of Object.keys(animationClasses)) {
		const option = document.createElement("option");
		option.value = name;
		option.textContent = name;
		select.appendChild(option);
	}
	select.value = "idle";
	select.addEventListener("change", () => {
		const cls = animationClasses[select.value as keyof typeof animationClasses];
		const newAnim = new cls();
		skinViewer.setAnimation(player, newAnim);
	});
	animLabel.appendChild(select);
	div.appendChild(animLabel);

	const skinBtn = document.createElement("button");
	skinBtn.className = "control";
	skinBtn.textContent = "Skin";
	const skinInput = document.createElement("input");
	skinInput.type = "file";
	skinInput.accept = "image/*";
	skinInput.classList.add("hidden");
	skinInput.addEventListener("change", async () => {
		const file = skinInput.files?.[0];
		if (file) {
			await skinViewer.loadSkin(file, {}, player);
		}
	});
	skinBtn.addEventListener("click", () => skinInput.click());
	div.appendChild(skinBtn);
	div.appendChild(skinInput);

	const backBtn = document.createElement("button");
	backBtn.className = "control";
	backBtn.textContent = "Back Items";
	div.appendChild(backBtn);
	const backMenu = document.createElement("div");
	backMenu.classList.add("hidden");
	backMenu.innerHTML = `<p class="control">Choose cape or elytra then provide a texture.</p>
<div class="control"><label><input type="radio" name="back_type_${index}" value="cape" checked /> Cape</label>
<label><input type="radio" name="back_type_${index}" value="elytra" /> Elytra</label></div>
<input id="back_url_${index}" type="text" class="control" placeholder="URL" />
<input id="back_file_${index}" type="file" class="control" />`;
	div.appendChild(backMenu);
	const backUrl = backMenu.querySelector(`#back_url_${index}`) as HTMLInputElement;
	const backFile = backMenu.querySelector(`#back_file_${index}`) as HTMLInputElement;
	const hideBackMenu = () => backMenu.classList.add("hidden");
	const loadBack = (source: string | File) => {
		const equip = (backMenu.querySelector(`input[name="back_type_${index}"]:checked`) as HTMLInputElement)
			?.value as BackEquipment;
		return skinViewer.loadCape(source, { backEquipment: equip }, player);
	};
	backUrl.addEventListener("change", () => {
		const url = backUrl.value.trim();
		if (url) {
			void Promise.resolve(loadBack(url)).finally(hideBackMenu);
		} else {
			hideBackMenu();
		}
	});
	backFile.addEventListener("change", () => {
		const file = backFile.files?.[0];
		if (file) {
			void Promise.resolve(loadBack(file)).finally(hideBackMenu);
		} else {
			hideBackMenu();
		}
	});
	backBtn.addEventListener("click", () => {
		backMenu.classList.toggle("hidden");
	});

	const earsBtn = document.createElement("button");
	earsBtn.className = "control";
	earsBtn.textContent = "Ears";
	const earsInput = document.createElement("input");
	earsInput.type = "file";
	earsInput.accept = "image/*";
	earsInput.classList.add("hidden");
	earsInput.addEventListener("change", async () => {
		const file = earsInput.files?.[0];
		if (file) {
			await skinViewer.loadEars(file, { textureType: "standalone" }, player);
		}
	});
	earsBtn.addEventListener("click", () => earsInput.click());
	div.appendChild(earsBtn);
	div.appendChild(earsInput);

	const animBtn = document.createElement("button");
	animBtn.className = "control";
	animBtn.textContent = "Animation";
	const animInput = document.createElement("input");
	animInput.type = "file";
	animInput.accept = "application/json";
	animInput.classList.add("hidden");
	animInput.addEventListener("change", async () => {
		const file = animInput.files?.[0];
		if (file) {
			const text = await file.text();
			const data = JSON.parse(text);
			const anim = skinview3d.createKeyframeAnimation(data);
			skinViewer.setAnimation(player, anim);
		}
	});
	animBtn.addEventListener("click", () => animInput.click());
	div.appendChild(animBtn);
	div.appendChild(animInput);

	return div;
}

function addModel(): void {
	const player = skinViewer.addPlayer();
	extraPlayers.push(player);
	const anim = new skinview3d.IdleAnimation();
	skinViewer.setAnimation(player, anim);
	const playerNumber = extraPlayers.length + 1;
	const container = document.getElementById("extra_player_controls");
	if (container) {
		const div = createPlayerResourceMenu(player, playerNumber);
		container.appendChild(div);
		extraPlayerControls.push(div);
	}
	updateViewportSize();
	skinViewer.updateLayout();
}

function removeModel(): void {
	const player = extraPlayers.pop();
	if (player) {
		skinViewer.setAnimation(player, null);
		void skinViewer.loadSkin(null, {}, player);
		void skinViewer.loadCape(null, {}, player);
		void skinViewer.loadEars(null, {}, player);
		skinViewer.removePlayer(player);
		if (selectedPlayer === player) {
			selectPlayer(null);
		}
		const control = extraPlayerControls.pop();
		control?.remove();
	}
	updateViewportSize();
	skinViewer.updateLayout();
}

function obtainTextureUrl(id: string): string {
	const urlInput = document.getElementById(id) as HTMLInputElement;
	const fileInput = document.getElementById(`${id}_upload`) as HTMLInputElement;
	const unsetButton = document.getElementById(`${id}_unset`);
	const file = fileInput?.files?.[0];

	if (!file) {
		if (unsetButton && !unsetButton.classList.contains("hidden")) {
			unsetButton.classList.add("hidden");
		}
		return urlInput?.value || "";
	}

	if (unsetButton) {
		unsetButton.classList.remove("hidden");
	}
	if (urlInput) {
		urlInput.value = `Local file: ${file.name}`;
		urlInput.readOnly = true;
	}
	return URL.createObjectURL(file);
}

function reloadSkin(): void {
	const input = document.getElementById("skin_url") as HTMLInputElement;
	const url = obtainTextureUrl("skin_url");
	if (url === "") {
		// Revert to placeholder skin when URL is empty
		skinViewer.loadSkin(null, {}, selectedPlayer);
		input?.setCustomValidity("");
		if (editorEnabled) {
			setupIK();
		}
	} else {
		const skinModel = document.getElementById("skin_model") as HTMLSelectElement;
		const earsSource = document.getElementById("ears_source") as HTMLSelectElement;

		skinViewer
			.loadSkin(
				url,
				{
					model: skinModel?.value as ModelType,
					ears: earsSource?.value === "current_skin",
				},
				selectedPlayer
			)
			.then(() => {
				input?.setCustomValidity("");
				if (editorEnabled) {
					setupIK();
				}
			})
			.catch(e => {
				input?.setCustomValidity("Image can't be loaded.");
				console.error(e);
			});
	}
}

function reloadCape(): void {
	const input = document.getElementById("cape_url") as HTMLInputElement;
	const url = obtainTextureUrl("cape_url");
	if (url === "") {
		skinViewer.loadCape(null, {}, selectedPlayer);
		input?.setCustomValidity("");
	} else {
		const selectedBackEquipment = document.querySelector(
			'input[type="radio"][name="back_equipment"]:checked'
		) as HTMLInputElement;
		skinViewer
			.loadCape(url, { backEquipment: selectedBackEquipment?.value as BackEquipment }, selectedPlayer)
			.then(() => input?.setCustomValidity(""))
			.catch(e => {
				input?.setCustomValidity("Image can't be loaded.");
				console.error(e);
			});
	}
}

function reloadEars(skipSkinReload = false): void {
	const earsSource = document.getElementById("ears_source") as HTMLSelectElement;
	const sourceType = earsSource?.value;
	let hideInput = true;

	if (sourceType === "none") {
		skinViewer.loadEars(null, {}, selectedPlayer);
	} else if (sourceType === "current_skin") {
		if (!skipSkinReload) {
			reloadSkin();
		}
	} else {
		hideInput = false;
		const options = document.querySelectorAll<HTMLOptionElement>("#default_ears option[data-texture-type]");
		for (const opt of options) {
			opt.disabled = opt.dataset.textureType !== sourceType;
		}

		const input = document.getElementById("ears_url") as HTMLInputElement;
		const url = obtainTextureUrl("ears_url");
		if (url === "") {
			skinViewer.loadEars(null, {}, selectedPlayer);
			input?.setCustomValidity("");
		} else {
			skinViewer
				.loadEars(url, { textureType: sourceType as "standalone" | "skin" }, selectedPlayer)
				.then(() => input?.setCustomValidity(""))
				.catch(e => {
					input?.setCustomValidity("Image can't be loaded.");
					console.error(e);
				});
		}
	}

	const el = document.getElementById("ears_texture_input");
	if (hideInput) {
		if (el && !el.classList.contains("hidden")) {
			el.classList.add("hidden");
		}
	} else if (el) {
		el.classList.remove("hidden");
	}
}

function reloadPanorama(): void {
	const input = document.getElementById("panorama_url") as HTMLInputElement;
	const url = obtainTextureUrl("panorama_url");
	if (url === "") {
		skinViewer.background = null;
		input?.setCustomValidity("");
	} else {
		skinViewer
			.loadPanorama(url)
			.then(() => input?.setCustomValidity(""))
			.catch(e => {
				input?.setCustomValidity("Image can't be loaded.");
				console.error(e);
			});
	}
}

function updateBackground(): void {
	const backgroundType = (document.getElementById("background_type") as HTMLSelectElement)?.value;
	const panoramaSection =
		document.querySelector(".control-section h1")?.textContent === "Panorama"
			? document.querySelector(".control-section h1")?.parentElement
			: null;

	if (backgroundType === "color") {
		const color = (document.getElementById("background_color") as HTMLInputElement)?.value;
		skinViewer.background = color;
		if (panoramaSection) {
			panoramaSection.style.display = "none";
		}
	} else {
		if (panoramaSection) {
			panoramaSection.style.display = "block";
		}
		reloadPanorama();
	}
}

function reloadNameTag(): void {
	const text = (document.getElementById("nametag_text") as HTMLInputElement)?.value;
	if (text === "") {
		skinViewer.nameTag = null;
	} else {
		skinViewer.nameTag = text;
	}
}

function setupIK(): void {
	for (const chain of Object.values(ikChains)) {
		chain.root.constraints = [];
		skinViewer.scene.remove(chain.target);
		if (chain.effector !== chain.target) {
			skinViewer.scene.remove(chain.effector);
		}
	}
	for (const key in ikChains) {
		delete ikChains[key];
	}
	const skin = selectedPlayer.skin;

	const rightLowerArmTarget = new Object3D();
	const rightLowerArmMesh = new Mesh(new SphereGeometry(0.5), new MeshBasicMaterial({ color: 0xff0000 }));
	rightLowerArmTarget.add(rightLowerArmMesh);

	rightLowerArmTarget.position.copy(skin.rightLowerArm.getWorldPosition(new Vector3()));
	skinViewer.scene.add(rightLowerArmTarget);
	const rIK = new IK();
	const rChain = new IKChain();
	const rRoot = new IKJoint(skin.rightUpperArm);
	rChain.add(rRoot); // keep shoulder static
	rChain.add(new IKJoint(skin.rightElbow));
	rChain.add(new IKJoint(skin.rightLowerArm), { target: rightLowerArmTarget });
	rChain.effectorIndex = rChain.joints.length - 1;
	rIK.add(rChain);
	ikChains["ik.rightArm"] = {
		target: rightLowerArmTarget,
		ik: rIK,
		bones: ["skin.rightUpperArm", "skin.rightElbow", "skin.rightLowerArm"],
		root: rRoot,
	};

	const leftLowerArmTarget = new Object3D();
	const leftLowerArmMesh = new Mesh(new SphereGeometry(0.5), new MeshBasicMaterial({ color: 0x00ff00 }));
	leftLowerArmTarget.add(leftLowerArmMesh);

	leftLowerArmTarget.position.copy(skin.leftLowerArm.getWorldPosition(new Vector3()));
	skinViewer.scene.add(leftLowerArmTarget);
	const lIK = new IK();
	const lChain = new IKChain();
	const lRoot = new IKJoint(skin.leftUpperArm);
	lChain.add(lRoot); // keep shoulder static
	lChain.add(new IKJoint(skin.leftElbow));
	lChain.add(new IKJoint(skin.leftLowerArm), { target: leftLowerArmTarget });
	lChain.effectorIndex = lChain.joints.length - 1;
	lIK.add(lChain);
	ikChains["ik.leftArm"] = {
		target: leftLowerArmTarget,

		ik: lIK,
		bones: ["skin.leftUpperArm", "skin.leftElbow", "skin.leftLowerArm"],
		root: lRoot,
	};

	const rightLowerLegTarget = new Object3D();
	const rightLowerLegMesh = new Mesh(new SphereGeometry(0.5), new MeshBasicMaterial({ color: 0x0000ff }));
	rightLowerLegTarget.add(rightLowerLegMesh);

	rightLowerLegTarget.position.copy(skin.rightLowerLeg.getWorldPosition(new Vector3()));
	skinViewer.scene.add(rightLowerLegTarget);
	const rLegIK = new IK();
	const rLegChain = new IKChain();
	const rLegRoot = new IKJoint(skin.rightUpperLeg);
	rLegChain.add(rLegRoot); // keep hip static
	rLegChain.add(new IKJoint(skin.rightKnee));
	rLegChain.add(new IKJoint(skin.rightLowerLeg), { target: rightLowerLegTarget });
	rLegChain.effectorIndex = rLegChain.joints.length - 1;
	rLegIK.add(rLegChain);
	ikChains["ik.rightLeg"] = {
		target: rightLowerLegTarget,

		ik: rLegIK,
		bones: ["skin.rightUpperLeg", "skin.rightKnee", "skin.rightLowerLeg"],
		root: rLegRoot,
	};

	const leftLowerLegTarget = new Object3D();
	const leftLowerLegMesh = new Mesh(new SphereGeometry(0.5), new MeshBasicMaterial({ color: 0xffff00 }));
	leftLowerLegTarget.add(leftLowerLegMesh);

	leftLowerLegTarget.position.copy(skin.leftLowerLeg.getWorldPosition(new Vector3()));
	skinViewer.scene.add(leftLowerLegTarget);
	const lLegIK = new IK();
	const lLegChain = new IKChain();
	const lLegRoot = new IKJoint(skin.leftUpperLeg);
	lLegChain.add(lLegRoot); // keep hip static
	lLegChain.add(new IKJoint(skin.leftKnee));
	lLegChain.add(new IKJoint(skin.leftLowerLeg), { target: leftLowerLegTarget });
	lLegChain.effectorIndex = lLegChain.joints.length - 1;
	lLegIK.add(lLegChain);
	ikChains["ik.leftLeg"] = {
		target: leftLowerLegTarget,
		ik: lLegIK,
		bones: ["skin.leftUpperLeg", "skin.leftKnee", "skin.leftLowerLeg"],
		root: lLegRoot,
	};

	if (ikUpdateId !== null) {
		cancelAnimationFrame(ikUpdateId);
	}
	const update = () => {
		const time =
			loadedAnimation && keyframes.length > 0 ? keyframes[0].time + loadedAnimation.progress * 1000 : Date.now();
		for (const key of Object.keys(ikChains)) {
			applyTargetKeyframe(key, time);
			const chain = ikChains[key];
			chain.target.updateMatrixWorld(true);
			chain.ik.solve();
		}
		ikUpdateId = requestAnimationFrame(update);
	};
	update();

	initializeBoneSelector();
}

function disposeIK(): void {
	if (ikUpdateId !== null) {
		cancelAnimationFrame(ikUpdateId);
		ikUpdateId = null;
	}
	for (const chain of Object.values(ikChains)) {
		chain.root.constraints = [];
		skinViewer.scene.remove(chain.target);
		if (chain.effector !== chain.target) {
			skinViewer.scene.remove(chain.effector);
		}
	}
	for (const key in ikChains) {
		delete ikChains[key];
	}

	initializeBoneSelector();
}

function initializeControls(): void {
	canvasWidth = document.getElementById("canvas_width") as HTMLInputElement;
	canvasHeight = document.getElementById("canvas_height") as HTMLInputElement;
	const fov = document.getElementById("fov") as HTMLInputElement;
	const zoom = document.getElementById("zoom") as HTMLInputElement;
	const globalLight = document.getElementById("global_light") as HTMLInputElement;
	const cameraLight = document.getElementById("camera_light") as HTMLInputElement;
	playerSelector = document.getElementById("player_selector") as HTMLSelectElement;
	const animationPauseResume = document.getElementById("animation_pause_resume");
	const editorPlayPause = document.getElementById("editor_play_pause");
	const highlightJoints = document.getElementById("highlight_joints") as HTMLInputElement;
	const autoRotate = document.getElementById("auto_rotate") as HTMLInputElement;
	const autoRotateSpeed = document.getElementById("auto_rotate_speed") as HTMLInputElement;
	const controlRotate = document.getElementById("control_rotate") as HTMLInputElement;
	const controlZoom = document.getElementById("control_zoom") as HTMLInputElement;
	const controlPan = document.getElementById("control_pan") as HTMLInputElement;
	const animationSpeed = document.getElementById("animation_speed") as HTMLInputElement;
	const hitSpeed = document.getElementById("hit_speed") as HTMLInputElement;
	const hitSpeedLabel = document.getElementById("hit_speed_label");

	const animationOptions = document.getElementById("animation_options");
	if (animationOptions) {
		const createOption = (value: string, text: string): HTMLInputElement => {
			const label = document.createElement("label");
			const input = document.createElement("input");
			input.type = "radio";
			input.name = "animation";
			input.value = value;
			input.id = `animation_${value || "none"}`;
			label.appendChild(input);
			label.appendChild(document.createTextNode(` ${text}`));
			animationOptions.appendChild(label);
			return input;
		};
		createOption("", "None");
		for (const name of Object.keys(animationClasses)) {
			createOption(name, name.charAt(0).toUpperCase() + name.slice(1));
		}
	}

	const animationCrouch = document.getElementById("animation_crouch") as HTMLInputElement;
	const addHittingAnimation = document.getElementById("add_hitting_animation") as HTMLInputElement;

	uploadStatusEl = document.getElementById("upload_status");

	playerSelector?.addEventListener("change", () => {
		const idx = Number(playerSelector.value);
		const player = idx === 0 ? skinViewer.playerObject : extraPlayers[idx - 1];
		selectPlayer(player ?? null);
	});

	canvasWidth?.addEventListener("change", e => {
		const target = e.target as HTMLInputElement;
		skinViewer.width = Number(target.value);
	});

	canvasHeight?.addEventListener("change", e => {
		const target = e.target as HTMLInputElement;
		skinViewer.height = Number(target.value);
	});

	fov?.addEventListener("change", e => {
		const target = e.target as HTMLInputElement;
		skinViewer.fov = Number(target.value);
	});

	zoom?.addEventListener("change", e => {
		const target = e.target as HTMLInputElement;
		skinViewer.zoom = Number(target.value);
	});

	globalLight?.addEventListener("change", e => {
		const target = e.target as HTMLInputElement;
		skinViewer.globalLight.intensity = Number(target.value);
	});

	cameraLight?.addEventListener("change", e => {
		const target = e.target as HTMLInputElement;
		skinViewer.cameraLight.intensity = Number(target.value);
	});

	animationPauseResume?.addEventListener("click", () => {
		const anim = skinViewer.getAnimation(selectedPlayer);
		if (anim) {
			anim.paused = !anim.paused;
		}
	});

	editorPlayPause?.addEventListener("click", () => {
		if (loadedAnimation) {
			loadedAnimation.paused = !loadedAnimation.paused;
		}
	});

	autoRotate?.addEventListener("change", e => {
		const target = e.target as HTMLInputElement;
		skinViewer.autoRotate = target.checked;
	});

	highlightJoints?.addEventListener("change", e => {
		const target = e.target as HTMLInputElement;
		updateJointHighlight(target.checked);
	});

	autoRotateSpeed?.addEventListener("change", e => {
		const target = e.target as HTMLInputElement;
		skinViewer.autoRotateSpeed = Number(target.value);
	});

	const animationRadios = document.querySelectorAll<HTMLInputElement>('input[type="radio"][name="animation"]');
	for (const el of animationRadios) {
		el.addEventListener("change", e => {
			const target = e.target as HTMLInputElement;
			const crouchSetting = document.getElementById("crouch_setting");
			if (crouchSetting) {
				crouchSetting.style.display = animationCrouch?.checked ? "block" : "none";
			}

			if (target.value === "") {
				skinViewer.setAnimation(selectedPlayer, null);
			} else {
				const cls = animationClasses[target.value as keyof typeof animationClasses];
				const anim = cls ? skinViewer.loadAnimationClass(cls, selectedPlayer) : null;
				if (anim && animationSpeed) {
					anim.speed = Number(animationSpeed.value);
				}
			}
		});
	}

	const defaultRadio = document.getElementById("animation_bend") as HTMLInputElement;
	if (defaultRadio) {
		defaultRadio.checked = true;
		defaultRadio.dispatchEvent(new Event("change"));
	}

	animationCrouch?.addEventListener("change", () => {
		const crouchSettings = document.querySelectorAll<HTMLInputElement>(
			'input[type="checkbox"][name="crouch_setting_item"]'
		);
		for (const el of crouchSettings) {
			el.checked = false;
		}
		if (hitSpeed) {
			hitSpeed.value = "";
		}
		if (hitSpeedLabel) {
			hitSpeedLabel.style.display = "none";
		}
	});

	const crouchSettings = {
		runOnce: (value: boolean) => {
			const anim = skinViewer.getAnimation(selectedPlayer);
			if (anim) {
				(anim as unknown as { runOnce: boolean }).runOnce = value;
			}
		},
		showProgress: (value: boolean) => {
			const anim = skinViewer.getAnimation(selectedPlayer);
			if (anim) {
				(anim as unknown as { showProgress: boolean }).showProgress = value;
			}
		},
		addHitAnimation: (value: boolean) => {
			if (hitSpeedLabel) {
				hitSpeedLabel.style.display = value ? "block" : "none";
			}
			if (value) {
				const anim = skinViewer.getAnimation(selectedPlayer);
				if (anim) {
					const hitSpeedValue = hitSpeed?.value;
					if (hitSpeedValue === "") {
						(anim as unknown as { addHitAnimation: () => void }).addHitAnimation();
					} else {
						(anim as unknown as { addHitAnimation: (speed: string) => void }).addHitAnimation(hitSpeedValue);
					}
				}
			}
		},
	} as const;

	const updateCrouchAnimation = () => {
		const anim = skinViewer.loadAnimationClass(skinview3d.CrouchAnimation, selectedPlayer);
		if (anim && animationSpeed) {
			anim.speed = Number(animationSpeed.value);
		}
		const crouchSettingItems = document.querySelectorAll<HTMLInputElement>(
			'input[type="checkbox"][name="crouch_setting_item"]'
		);
		for (const el of crouchSettingItems) {
			const setting = crouchSettings[el.value as keyof typeof crouchSettings];
			if (setting) {
				setting(el.checked);
			}
		}
	};

	const crouchSettingItems = document.querySelectorAll<HTMLInputElement>(
		'input[type="checkbox"][name="crouch_setting_item"]'
	);
	for (const el of crouchSettingItems) {
		el.addEventListener("change", () => {
			updateCrouchAnimation();
		});
	}

	hitSpeed?.addEventListener("change", () => {
		updateCrouchAnimation();
	});

	animationSpeed?.addEventListener("change", e => {
		const target = e.target as HTMLInputElement;
		const anim = skinViewer.getAnimation(selectedPlayer);
		if (anim) {
			anim.speed = Number(target.value);
		}
		if (animationCrouch?.checked && addHittingAnimation?.checked && hitSpeed?.value === "") {
			updateCrouchAnimation();
		}
	});

	controlRotate?.addEventListener("change", e => {
		const target = e.target as HTMLInputElement;
		skinViewer.controls.enableRotate = target.checked;
	});

	controlZoom?.addEventListener("change", e => {
		const target = e.target as HTMLInputElement;
		skinViewer.controls.enableZoom = target.checked;
	});

	controlPan?.addEventListener("change", e => {
		const target = e.target as HTMLInputElement;
		skinViewer.controls.enablePan = target.checked;
	});

	for (const part of skinParts) {
		const skinPart = (selectedPlayer.skin as any)[part];
		for (const layer of skinLayers) {
			const skinLayer = skinPart?.[layer];
			if (!skinLayer) {
				continue;
			}
			const checkbox = document.querySelector<HTMLInputElement>(
				`#layers_table input[type="checkbox"][data-part="${part}"][data-layer="${layer}"]`
			);
			checkbox?.addEventListener("change", e => {
				const target = e.target as HTMLInputElement;
				const currentPart = (selectedPlayer.skin as any)[part];
				const currentLayer = currentPart?.[layer];
				if (currentLayer) {
					currentLayer.visible = target.checked;
				}
			});
		}
	}

	const initializeUploadButton = (id: string, callback: () => void) => {
		const urlInput = document.getElementById(id) as HTMLInputElement;
		const fileInput = document.getElementById(`${id}_upload`) as HTMLInputElement;
		const unsetButton = document.getElementById(`${id}_unset`);

		const unsetAction = () => {
			if (urlInput) {
				urlInput.readOnly = false;
				urlInput.value = "";
			}
			if (fileInput) {
				fileInput.value = fileInput.defaultValue;
			}
			callback();
		};

		fileInput?.addEventListener("change", () => callback());
		urlInput?.addEventListener("keydown", e => {
			if (e.key === "Backspace" && urlInput?.readOnly) {
				unsetAction();
			}
		});
		unsetButton?.addEventListener("click", () => unsetAction());
	};

	initializeUploadButton("panorama_url", reloadPanorama);

	const panoramaUrl = document.getElementById("panorama_url") as HTMLInputElement;
	panoramaUrl?.addEventListener("change", reloadPanorama);

	const backEquipmentRadios = document.querySelectorAll<HTMLInputElement>('input[type="radio"][name="back_equipment"]');
	for (const el of backEquipmentRadios) {
		el.addEventListener("change", e => {
			const target = e.target as HTMLInputElement;
			if (selectedPlayer.backEquipment === null) {
				// cape texture hasn't been loaded yet
				// this option will be processed on texture loading
			} else {
				selectedPlayer.backEquipment = target.value as BackEquipment;
			}
		});
	}

	const resetAll = document.getElementById("reset_all");
	resetAll?.addEventListener("click", () => {
		extraPlayers.length = 0;
		for (const ctrl of extraPlayerControls) {
			ctrl.remove();
		}
		extraPlayerControls.length = 0;
		skinViewer.dispose();
		initializeViewer();
		skinViewer.resetCameraPose();
		skinViewer.controls.target.set(0, 0, 0);
		skinViewer.controls.update();
		skinViewer.controls.saveState();
		updateViewportSize();
	});

	const addModelBtn = document.getElementById("add_model");
	addModelBtn?.addEventListener("click", addModel);
	const removeModelBtn = document.getElementById("remove_model");
	removeModelBtn?.addEventListener("click", removeModel);
	const changePositioningBtn = document.getElementById("change_positioning");
	changePositioningBtn?.addEventListener("click", () => {
		spacingIndex = (spacingIndex + 1) % spacingOptions.length;
		skinViewer.setPlayerSpacing(spacingOptions[spacingIndex]);
		skinViewer.updateLayout();
	});
	const togglePositionBtn = document.getElementById("toggle_position_controller");
	togglePositionBtn?.addEventListener("click", togglePositionController);

	const nametagText = document.getElementById("nametag_text") as HTMLInputElement;
	nametagText?.addEventListener("change", reloadNameTag);

	const backgroundType = document.getElementById("background_type") as HTMLSelectElement;
	const backgroundColor = document.getElementById("background_color") as HTMLInputElement;

	backgroundType?.addEventListener("change", updateBackground);
	backgroundColor?.addEventListener("change", updateBackground);

	// Set panorama as default
	if (backgroundType) {
		backgroundType.value = "panorama";
	}

	// Initialize background type
	updateBackground();

	initializeAssetMenu();
}

function initializeViewer(): void {
	disposeIK();
	const skinContainer = document.getElementById("skin_container") as HTMLCanvasElement;
	if (!skinContainer) {
		throw new Error("Canvas element not found");
	}

	skinViewer = new skinview3d.SkinViewer({
		canvas: skinContainer,
	});
	playerSelector = document.getElementById("player_selector") as HTMLSelectElement;
	if (playerSelector) {
		playerSelector.innerHTML = "";
		const opt = document.createElement("option");
		opt.value = "0";
		opt.textContent = "Player 1";
		playerSelector.appendChild(opt);
		playerSelector.value = "0";
	}

	selectPlayer(null);

	const controlsContainer = document.getElementById("extra_player_controls");
	if (controlsContainer) {
		const control = createPlayerResourceMenu(skinViewer.playerObject, 1);
		controlsContainer.appendChild(control);
		extraPlayerControls.push(control);
	}

	canvasWidth = document.getElementById("canvas_width") as HTMLInputElement;
	canvasHeight = document.getElementById("canvas_height") as HTMLInputElement;
	const fov = document.getElementById("fov") as HTMLInputElement;
	const zoom = document.getElementById("zoom") as HTMLInputElement;
	const globalLight = document.getElementById("global_light") as HTMLInputElement;
	const cameraLight = document.getElementById("camera_light") as HTMLInputElement;
	const autoRotate = document.getElementById("auto_rotate") as HTMLInputElement;
	const autoRotateSpeed = document.getElementById("auto_rotate_speed") as HTMLInputElement;
	const controlRotate = document.getElementById("control_rotate") as HTMLInputElement;
	const controlZoom = document.getElementById("control_zoom") as HTMLInputElement;
	const controlPan = document.getElementById("control_pan") as HTMLInputElement;
	const animationSpeed = document.getElementById("animation_speed") as HTMLInputElement;
	const autoFit = document.getElementById("auto_fit") as HTMLInputElement;

	skinViewer.width = Number(canvasWidth?.value);
	skinViewer.height = Number(canvasHeight?.value);
	skinViewer.fov = Number(fov?.value);
	skinViewer.zoom = Number(zoom?.value);
	skinViewer.globalLight.intensity = Number(globalLight?.value);
	skinViewer.cameraLight.intensity = Number(cameraLight?.value);
	skinViewer.autoRotate = autoRotate?.checked ?? false;
	skinViewer.autoRotateSpeed = Number(autoRotateSpeed?.value);
	skinViewer.autoFit = autoFit?.checked ?? true;

	const animationRadio = document.querySelector<HTMLInputElement>('input[type="radio"][name="animation"]:checked');
	const animationName = animationRadio?.value;
	if (animationName) {
		const cls = animationClasses[animationName as keyof typeof animationClasses];
		const anim = cls ? skinViewer.loadAnimationClass(cls, selectedPlayer) : null;
		if (anim && animationSpeed) {
			anim.speed = Number(animationSpeed.value);
		}
	}

	skinViewer.controls.enableRotate = controlRotate?.checked ?? false;
	skinViewer.controls.enableZoom = controlZoom?.checked ?? false;
	skinViewer.controls.enablePan = controlPan?.checked ?? false;

	autoFit?.addEventListener("change", () => {
		skinViewer.autoFit = autoFit.checked;
	});

	for (const part of skinParts) {
		const skinPart = (selectedPlayer.skin as any)[part];
		for (const layer of skinLayers) {
			const skinLayer = skinPart?.[layer];
			if (!skinLayer) {
				continue;
			}
			const checkbox = document.querySelector<HTMLInputElement>(
				`#layers_table input[type="checkbox"][data-part="${part}"][data-layer="${layer}"]`
			);
			skinLayer.visible = checkbox?.checked ?? false;
		}
	}

	void skinViewer.loadSkin("img/hatsune_miku.png");
	void skinViewer.loadCape("img/mojang_cape.png", { backEquipment: "cape" });
	void skinViewer.loadPanorama("img/panorama.png");
	reloadNameTag();
	const highlightJoints = document.getElementById("highlight_joints") as HTMLInputElement;
	updateJointHighlight(highlightJoints?.checked ?? false);
	updateViewportSize();
}

initializeViewer();
initializeControls();
setupIK();
initializeBoneSelector(true);
document.getElementById("skin_container")?.addEventListener("click", handlePlayerClick);

function initializeBoneSelector(useIK = false): void {
	const selector = document.getElementById("bone_selector") as HTMLSelectElement;
	if (!selector) {
		return;
	}

	const current = selector.value;
	selector.innerHTML = "";
	const playerOption = document.createElement("option");
	playerOption.value = "playerObject";
	playerOption.textContent = "Player";
	selector.appendChild(playerOption);

	for (const part of skinParts) {
		if (
			useIK &&
			(part === "rightUpperArm" || part === "leftUpperArm" || part === "rightUpperLeg" || part === "leftUpperLeg")
		) {
			continue;
		}
		const option = document.createElement("option");
		option.value = `skin.${part}`;
		option.textContent = `skin.${part}`;
		selector.appendChild(option);
	}

	for (const key of Object.keys(ikChains)) {
		const option = document.createElement("option");
		option.value = key;
		const part = key.replace(/^ik\./, "");
		const label = part.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());
		option.textContent = `IK Controller: ${label}`;
		selector.appendChild(option);
	}

	if (current) {
		selector.value = current;
	}
}

function toggleEditor(): void {
	const editor = document.getElementById("animation_editor");
	const skinContainer = document.getElementById("skin_container") as HTMLCanvasElement;
	if (!editor || !skinContainer) {
		return;
	}

	editorEnabled = !editorEnabled;
	editor.classList.toggle("hidden", !editorEnabled);

	if (editorEnabled) {
		previousAutoRotate = skinViewer.autoRotate;
		previousAnimationPaused = skinViewer.getAnimation(selectedPlayer)?.paused ?? false;
		skinViewer.autoRotate = false;
		const anim = skinViewer.getAnimation(selectedPlayer);
		if (anim) {
			anim.paused = true;
		}

		updateViewportSize();

		setupIK();
		initializeBoneSelector(true);
		selectedBone = boneSelector?.value || "playerObject";

		transformControls = new TransformControls(skinViewer.camera, skinViewer.renderer.domElement);
		transformControls.addEventListener("dragging-changed", (e: { value: boolean }) => {
			skinViewer.controls.enabled = !e.value;
			if (!e.value) {
				if (selectedBone.startsWith("ik.")) {
					addIKKeyframe(selectedBone);
				} else {
					addKeyframe();
				}
			}
		});
		if (modeSelector) {
			transformControls.setMode(modeSelector.value as any);
		}
		transformControls.attach(getBone(selectedBone));
		skinViewer.scene.add(transformControls);
	} else {
		skinViewer.autoRotate = previousAutoRotate;
		const anim = skinViewer.getAnimation(selectedPlayer);
		if (anim) {
			anim.paused = previousAnimationPaused;
		}

		updateViewportSize();

		if (transformControls) {
			skinViewer.scene.remove(transformControls);
			transformControls.dispose();
			transformControls = null;
		}
		disposeIK();
		initializeBoneSelector(false);
		selectedBone = boneSelector?.value || "playerObject";
	}
}

function onPositionControlKey(e: KeyboardEvent): void {
	if (!positionControls) {
		return;
	}
	if (e.key === "t" || e.key === "T") {
		positionControls.setMode("translate");
	} else if (e.key === "r" || e.key === "R") {
		positionControls.setMode("rotate");
	}
}

function togglePositionController(): void {
	positionControllerEnabled = !positionControllerEnabled;
	if (positionControllerEnabled) {
		previousPositionAutoRotate = skinViewer.autoRotate;
		previousPositionAnimationPaused = skinViewer.animation?.paused ?? false;
		skinViewer.autoRotate = false;
		if (skinViewer.animation) {
			skinViewer.animation.paused = true;
		}
		positionControls = new TransformControls(skinViewer.camera, skinViewer.renderer.domElement);
		positionControls.addEventListener("dragging-changed", (e: { value: boolean }) => {
			skinViewer.controls.enabled = !e.value;
		});
		positionControls.setMode("translate");
		positionControls.attach(selectedPlayer);
		skinViewer.scene.add(positionControls);
		window.addEventListener("keydown", onPositionControlKey);
	} else {
		skinViewer.autoRotate = previousPositionAutoRotate;
		if (skinViewer.animation) {
			skinViewer.animation.paused = previousPositionAnimationPaused;
		}
		if (positionControls) {
			skinViewer.scene.remove(positionControls);
			positionControls.dispose();
			positionControls = null;
		}
		window.removeEventListener("keydown", onPositionControlKey);
	}
}

function updateTimeline(): void {
	const timeline = document.getElementById("timeline");
	if (!timeline) {
		return;
	}
	timeline.innerHTML = "";
	if (keyframes.length === 0) {
		return;
	}
	const start = keyframes[0].time;
	const end = keyframes[keyframes.length - 1].time;
	const duration = end - start || 1;
	const rows = new Map<string, HTMLDivElement>();
	for (const kf of keyframes) {
		let track = rows.get(kf.bone);
		if (!track) {
			const row = document.createElement("div");
			row.className = "kf-row";
			const label = document.createElement("span");
			label.className = "kf-label";
			label.textContent = kf.bone;
			track = document.createElement("div");
			track.className = "kf-track";
			row.appendChild(label);
			row.appendChild(track);
			timeline.appendChild(row);
			rows.set(kf.bone, track);
		}
		const marker = document.createElement("div");
		marker.className = "kf-marker";
		const t = kf.time - start;
		marker.style.left = `${(t / duration) * 100}%`;
		track.appendChild(marker);
	}
}

function captureIKTargets(time: number): void {
	for (const [key, chain] of Object.entries(ikChains)) {
		keyframes.push({
			time,
			bone: key,
			position: chain.target.position.clone(),
			rotation: chain.target.rotation.clone(),
		});
	}
}

function applyTargetKeyframe(chainKey: string, time: number): void {
	const target = ikChains[chainKey]?.target;
	if (!target) {
		return;
	}
	const frames = keyframes.filter(kf => kf.bone === chainKey);
	if (frames.length === 0) {
		return;
	}
	let prev = frames[0];
	let next = frames[frames.length - 1];
	if (time <= prev.time) {
		target.position.copy(prev.position);
		target.rotation.copy(prev.rotation);
		return;
	}
	if (time >= next.time) {
		target.position.copy(next.position);
		target.rotation.copy(next.rotation);
		return;
	}
	for (let i = 0; i < frames.length - 1; i++) {
		const f0 = frames[i];
		const f1 = frames[i + 1];
		if (time >= f0.time && time <= f1.time) {
			const alpha = (time - f0.time) / (f1.time - f0.time || 1);
			target.position.lerpVectors(f0.position, f1.position, alpha);
			target.rotation.set(
				f0.rotation.x + (f1.rotation.x - f0.rotation.x) * alpha,
				f0.rotation.y + (f1.rotation.y - f0.rotation.y) * alpha,
				f0.rotation.z + (f1.rotation.z - f0.rotation.z) * alpha
			);
			break;
		}
	}
}

function addKeyframe(bonePath = selectedBone): void {
	const bone = getBone(bonePath);
	const time = Date.now();
	keyframes.push({
		time,
		bone: bonePath,
		position: bone.position.clone(),
		rotation: bone.rotation.clone(),
	});
	captureIKTargets(time);
	updateTimeline();
}

function addIKKeyframe(chainName: string): void {
	const chain = ikChains[chainName];
	if (!chain) {
		return;
	}
	const time = Date.now();
	keyframes.push({
		time,
		bone: chainName,
		position: chain.target.position.clone(),
		rotation: chain.target.rotation.clone(),
	});
	for (const bonePath of chain.bones) {
		const bone = getBone(bonePath);
		keyframes.push({
			time,
			bone: bonePath,
			position: bone.position.clone(),
			rotation: bone.rotation.clone(),
		});
	}
	captureIKTargets(time);
	updateTimeline();
}

const boneSelector = document.getElementById("bone_selector") as HTMLSelectElement;
boneSelector?.addEventListener("change", () => {
	selectedBone = boneSelector.value || "playerObject";
	if (transformControls) {
		transformControls.attach(getBone(selectedBone));
	}
});
const toggleEditorBtn = document.getElementById("toggle_editor");
toggleEditorBtn?.addEventListener("click", toggleEditor);
const addKeyframeBtn = document.getElementById("add_keyframe");
addKeyframeBtn?.addEventListener("click", () => {
	if (selectedBone.startsWith("ik.")) {
		addIKKeyframe(selectedBone);
	} else {
		addKeyframe();
	}
});

const modeSelector = document.getElementById("transform_mode") as HTMLSelectElement;
modeSelector?.addEventListener("change", () => {
	if (transformControls) {
		transformControls.setMode(modeSelector.value as any);
	}
});

function buildKeyframeAnimation(): skinview3d.KeyframeAnimation | null {
	if (keyframes.length === 0) {
		return null;
	}
	const start = keyframes[0].time;
	const frames = new Map<number, Record<string, [number, number, number]>>();
	for (const kf of keyframes) {
		const time = kf.time - start;
		const bones = frames.get(time) ?? {};
		bones[kf.bone] = [kf.rotation.x, kf.rotation.y, kf.rotation.z];
		frames.set(time, bones);
	}
	const data: skinview3d.KeyframeData = {
		keyframes: [...frames.entries()]
			.sort((a, b) => a[0] - b[0])
			.map(([time, bones]) => ({
				time: time / 1000,
				bones,
			})),
	};
	return new skinview3d.KeyframeAnimation(data);
}

function downloadJson(): void {
	const anim = buildKeyframeAnimation();
	if (!anim) {
		return;
	}
	const json = JSON.stringify(anim.toJSON(), null, 2);
	const blob = new Blob([json], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "animation.json";
	a.click();
	URL.revokeObjectURL(url);
}

async function uploadJson(e: Event): Promise<void> {
	const input = e.target as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) {
		return;
	}
	try {
		const text = await file.text();
		const data = JSON.parse(text);
		loadedAnimation = skinview3d.createKeyframeAnimation(data);
		skinViewer.setAnimation(selectedPlayer, loadedAnimation);
		keyframes.length = 0;
		if (Array.isArray(data.keyframes)) {
			for (const frame of data.keyframes) {
				for (const [bone, rot] of Object.entries(frame.bones ?? {})) {
					keyframes.push({
						time: frame.time * 1000,
						bone,
						position: new Vector3(),
						rotation: new Euler().fromArray(rot as [number, number, number]),
					});
				}
			}
			keyframes.sort((a, b) => a.time - b.time);
			updateTimeline();
		}
		if (uploadStatusEl) {
			uploadStatusEl.textContent = `Loaded: ${file.name}`;
			uploadStatusEl.classList.remove("hidden");
		}
	} catch (err) {
		console.error(err);
		if (uploadStatusEl) {
			uploadStatusEl.textContent = "Failed to load animation.";
			uploadStatusEl.classList.remove("hidden");
		}
	}
	input.value = "";
}

const downloadJsonBtn = document.getElementById("download_json");
downloadJsonBtn?.addEventListener("click", downloadJson);
const uploadJsonInput = document.getElementById("upload_json");
uploadJsonInput?.addEventListener("change", uploadJson);

Object.assign(window as any, {
	KeyframeAnimation: skinview3d.KeyframeAnimation,
	createKeyframeAnimation: skinview3d.createKeyframeAnimation,
});
