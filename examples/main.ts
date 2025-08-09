import * as skinview3d from "../src/skinview3d";
import type { ModelType } from "skinview-utils";
import type { BackEquipment } from "../src/model";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { Euler, Object3D, Vector3 } from "three";
import "./style.css";
import { GeneratedAnimation } from "./generated-animation";

const skinParts = ["head", "body", "rightArm", "leftArm", "rightLeg", "leftLeg"];
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
};

let skinViewer: skinview3d.SkinViewer;
let transformControls: TransformControls | null = null;
let selectedBone = "playerObject";
const keyframes: Array<{ time: number; bone: string; position: Vector3; rotation: Euler }> = [];
let editorEnabled = false;
let previousAutoRotate = false;
let previousAnimationPaused = false;
let loadedAnimation: skinview3d.Animation | null = null;
let uploadStatusEl: HTMLElement | null = null;

function getBone(path: string): Object3D {
	if (path === "playerObject") {
		return skinViewer.playerObject;
	}
	return path.split(".").reduce((obj: any, part) => obj?.[part], skinViewer.playerObject) ?? skinViewer.playerObject;
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
		skinViewer.loadSkin(null);
		input?.setCustomValidity("");
	} else {
		const skinModel = document.getElementById("skin_model") as HTMLSelectElement;
		const earsSource = document.getElementById("ears_source") as HTMLSelectElement;

		skinViewer
			.loadSkin(url, {
				model: skinModel?.value as ModelType,
				ears: earsSource?.value === "current_skin",
			})
			.then(() => input?.setCustomValidity(""))
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
		skinViewer.loadCape(null);
		input?.setCustomValidity("");
	} else {
		const selectedBackEquipment = document.querySelector(
			'input[type="radio"][name="back_equipment"]:checked'
		) as HTMLInputElement;
		skinViewer
			.loadCape(url, { backEquipment: selectedBackEquipment?.value as BackEquipment })
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
		skinViewer.loadEars(null);
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
			skinViewer.loadEars(null);
			input?.setCustomValidity("");
		} else {
			skinViewer
				.loadEars(url, { textureType: sourceType as "standalone" | "skin" })
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

function initializeControls(): void {
	const canvasWidth = document.getElementById("canvas_width") as HTMLInputElement;
	const canvasHeight = document.getElementById("canvas_height") as HTMLInputElement;
	const fov = document.getElementById("fov") as HTMLInputElement;
	const zoom = document.getElementById("zoom") as HTMLInputElement;
	const globalLight = document.getElementById("global_light") as HTMLInputElement;
	const cameraLight = document.getElementById("camera_light") as HTMLInputElement;
	const animationPauseResume = document.getElementById("animation_pause_resume");
	const editorPlayPause = document.getElementById("editor_play_pause");
	const autoRotate = document.getElementById("auto_rotate") as HTMLInputElement;
	const autoRotateSpeed = document.getElementById("auto_rotate_speed") as HTMLInputElement;
	const controlRotate = document.getElementById("control_rotate") as HTMLInputElement;
	const controlZoom = document.getElementById("control_zoom") as HTMLInputElement;
	const controlPan = document.getElementById("control_pan") as HTMLInputElement;
	const animationSpeed = document.getElementById("animation_speed") as HTMLInputElement;
	const hitSpeed = document.getElementById("hit_speed") as HTMLInputElement;
	const hitSpeedLabel = document.getElementById("hit_speed_label");
	const animationCrouch = document.getElementById("animation_crouch") as HTMLInputElement;
	const addHittingAnimation = document.getElementById("add_hitting_animation") as HTMLInputElement;

	uploadStatusEl = document.getElementById("upload_status");

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
		if (skinViewer.animation) {
			skinViewer.animation.paused = !skinViewer.animation.paused;
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
				skinViewer.animation = null;
			} else {
				const cls = animationClasses[target.value as keyof typeof animationClasses];
				const anim = cls ? skinViewer.loadAnimationClass(cls) : null;
				if (anim && animationSpeed) {
					anim.speed = Number(animationSpeed.value);
				}
			}
		});
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
			if (skinViewer.animation) {
				(skinViewer.animation as unknown as { runOnce: boolean }).runOnce = value;
			}
		},
		showProgress: (value: boolean) => {
			if (skinViewer.animation) {
				(skinViewer.animation as unknown as { showProgress: boolean }).showProgress = value;
			}
		},
		addHitAnimation: (value: boolean) => {
			if (hitSpeedLabel) {
				hitSpeedLabel.style.display = value ? "block" : "none";
			}
			if (value && skinViewer.animation) {
				const hitSpeedValue = hitSpeed?.value;
				if (hitSpeedValue === "") {
					(skinViewer.animation as unknown as { addHitAnimation: () => void }).addHitAnimation();
				} else {
					(skinViewer.animation as unknown as { addHitAnimation: (speed: string) => void }).addHitAnimation(
						hitSpeedValue
					);
				}
			}
		},
	};

	const updateCrouchAnimation = () => {
		const anim = skinViewer.loadAnimationClass(skinview3d.CrouchAnimation);
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
		if (skinViewer.animation) {
			skinViewer.animation.speed = Number(target.value);
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
		for (const layer of skinLayers) {
			const checkbox = document.querySelector<HTMLInputElement>(
				`#layers_table input[type="checkbox"][data-part="${part}"][data-layer="${layer}"]`
			);
			checkbox?.addEventListener("change", e => {
				const target = e.target as HTMLInputElement;
				skinViewer.playerObject.skin[part][layer].visible = target.checked;
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

	initializeUploadButton("skin_url", reloadSkin);
	initializeUploadButton("cape_url", reloadCape);
	initializeUploadButton("ears_url", reloadEars);
	initializeUploadButton("panorama_url", reloadPanorama);

	const skinUrl = document.getElementById("skin_url") as HTMLInputElement;
	const skinModel = document.getElementById("skin_model") as HTMLSelectElement;
	const capeUrl = document.getElementById("cape_url") as HTMLInputElement;
	const earsSource = document.getElementById("ears_source") as HTMLSelectElement;
	const earsUrl = document.getElementById("ears_url") as HTMLInputElement;
	const panoramaUrl = document.getElementById("panorama_url") as HTMLInputElement;

	skinUrl?.addEventListener("change", reloadSkin);
	skinModel?.addEventListener("change", reloadSkin);
	capeUrl?.addEventListener("change", reloadCape);
	earsSource?.addEventListener("change", () => reloadEars());
	earsUrl?.addEventListener("change", () => reloadEars());
	panoramaUrl?.addEventListener("change", reloadPanorama);

	const backEquipmentRadios = document.querySelectorAll<HTMLInputElement>('input[type="radio"][name="back_equipment"]');
	for (const el of backEquipmentRadios) {
		el.addEventListener("change", e => {
			const target = e.target as HTMLInputElement;
			if (skinViewer.playerObject.backEquipment === null) {
				// cape texture hasn't been loaded yet
				// this option will be processed on texture loading
			} else {
				skinViewer.playerObject.backEquipment = target.value as BackEquipment;
			}
		});
	}

	const resetAll = document.getElementById("reset_all");
	resetAll?.addEventListener("click", () => {
		skinViewer.dispose();
		initializeViewer();
	});

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
}

function initializeViewer(): void {
	const skinContainer = document.getElementById("skin_container") as HTMLCanvasElement;
	if (!skinContainer) {
		throw new Error("Canvas element not found");
	}

	skinViewer = new skinview3d.SkinViewer({
		canvas: skinContainer,
	});

	const canvasWidth = document.getElementById("canvas_width") as HTMLInputElement;
	const canvasHeight = document.getElementById("canvas_height") as HTMLInputElement;
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

	skinViewer.width = Number(canvasWidth?.value);
	skinViewer.height = Number(canvasHeight?.value);
	skinViewer.fov = Number(fov?.value);
	skinViewer.zoom = Number(zoom?.value);
	skinViewer.globalLight.intensity = Number(globalLight?.value);
	skinViewer.cameraLight.intensity = Number(cameraLight?.value);
	skinViewer.autoRotate = autoRotate?.checked ?? false;
	skinViewer.autoRotateSpeed = Number(autoRotateSpeed?.value);

	const animationRadio = document.querySelector<HTMLInputElement>('input[type="radio"][name="animation"]:checked');
	const animationName = animationRadio?.value;
	if (animationName) {
		const cls = animationClasses[animationName as keyof typeof animationClasses];
		const anim = cls ? skinViewer.loadAnimationClass(cls) : null;
		if (anim && animationSpeed) {
			anim.speed = Number(animationSpeed.value);
		}
	}

	skinViewer.controls.enableRotate = controlRotate?.checked ?? false;
	skinViewer.controls.enableZoom = controlZoom?.checked ?? false;
	skinViewer.controls.enablePan = controlPan?.checked ?? false;

	for (const part of skinParts) {
		for (const layer of skinLayers) {
			const checkbox = document.querySelector<HTMLInputElement>(
				`#layers_table input[type="checkbox"][data-part="${part}"][data-layer="${layer}"]`
			);
			skinViewer.playerObject.skin[part][layer].visible = checkbox?.checked ?? false;
		}
	}

	reloadSkin();
	reloadCape();
	reloadEars(true);
	reloadPanorama();
	reloadNameTag();
}

initializeViewer();
initializeControls();
initializeBoneSelector();

function initializeBoneSelector(): void {
	const selector = document.getElementById("bone_selector") as HTMLSelectElement;
	if (!selector) {
		return;
	}

	selector.innerHTML = "";
	const playerOption = document.createElement("option");
	playerOption.value = "playerObject";
	playerOption.textContent = "Player";
	selector.appendChild(playerOption);

	for (const part of skinParts) {
		const option = document.createElement("option");
		option.value = `skin.${part}`;
		option.textContent = `skin.${part}`;
		selector.appendChild(option);
	}
}

function toggleEditor(): void {
	const editor = document.getElementById("animation_editor");
	const skinContainer = document.getElementById("skin_container") as HTMLCanvasElement;
	const canvasWidth = document.getElementById("canvas_width") as HTMLInputElement;
	const canvasHeight = document.getElementById("canvas_height") as HTMLInputElement;
	if (!editor || !skinContainer) {
		return;
	}

	editorEnabled = !editorEnabled;
	editor.classList.toggle("hidden", !editorEnabled);

	if (editorEnabled) {
		previousAutoRotate = skinViewer.autoRotate;
		previousAnimationPaused = skinViewer.animation?.paused ?? false;
		skinViewer.autoRotate = false;
		if (skinViewer.animation) {
			skinViewer.animation.paused = true;
		}

		skinContainer.classList.add("expanded");
		skinViewer.width = 800;
		skinViewer.height = 600;

		transformControls = new TransformControls(skinViewer.camera, skinViewer.renderer.domElement);
		transformControls.addEventListener("dragging-changed", (e: { value: boolean }) => {
			skinViewer.controls.enabled = !e.value;
			if (!e.value) {
				addKeyframe();
			}
		});
		const modeSelector = document.getElementById("transform_mode") as HTMLSelectElement;
		if (modeSelector) {
			transformControls.setMode(modeSelector.value as any);
		}
		transformControls.attach(getBone(selectedBone));
		skinViewer.scene.add(transformControls);
	} else {
		skinViewer.autoRotate = previousAutoRotate;
		if (skinViewer.animation) {
			skinViewer.animation.paused = previousAnimationPaused;
		}

		skinContainer.classList.remove("expanded");
		if (canvasWidth && canvasHeight) {
			skinViewer.width = Number(canvasWidth.value);
			skinViewer.height = Number(canvasHeight.value);
		}

		if (transformControls) {
			skinViewer.scene.remove(transformControls);
			transformControls.dispose();
			transformControls = null;
		}
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
	for (const kf of keyframes) {
		const marker = document.createElement("div");
		marker.className = "kf-marker";
		const t = kf.time - start;
		marker.style.left = `${(t / duration) * 100}%`;
		marker.title = kf.bone;
		timeline.appendChild(marker);
	}
}

function addKeyframe(): void {
	const bone = getBone(selectedBone);
	keyframes.push({
		time: Date.now(),
		bone: selectedBone,
		position: bone.position.clone(),
		rotation: bone.rotation.clone(),
	});
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
addKeyframeBtn?.addEventListener("click", addKeyframe);

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
		skinViewer.animation = loadedAnimation;
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
