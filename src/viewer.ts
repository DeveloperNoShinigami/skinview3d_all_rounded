import {
	inferModelType,
	isTextureSource,
	loadCapeToCanvas,
	loadEarsToCanvas,
	loadEarsToCanvasFromSkin,
	loadImage,
	loadSkinToCanvas,
	type ModelType,
	type RemoteImage,
	type TextureSource,
} from "skinview-utils";
import {
	Color,
	type ColorRepresentation,
	PointLight,
	EquirectangularReflectionMapping,
	Group,
	NearestFilter,
	PerspectiveCamera,
	Scene,
	Texture,
	Vector2,
	WebGLRenderer,
	AmbientLight,
	type Mapping,
	CanvasTexture,
	WebGLRenderTarget,
	FloatType,
	DepthTexture,
	Clock,
	Object3D,
	ColorManagement,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { PlayerAnimation } from "./animation.js";
import { type BackEquipment, PlayerObject } from "./model.js";
import { NameTagObject } from "./nametag.js";

export interface LoadOptions {
	/**
	 * Whether to make the object visible after the texture is loaded.
	 *
	 * @defaultValue `true`
	 */
	makeVisible?: boolean;
}

export interface SkinLoadOptions extends LoadOptions {
	/**
	 * The model of the player (`"default"` for normal arms, and `"slim"` for slim arms).
	 *
	 * When set to `"auto-detect"`, the model will be inferred from the skin texture.
	 *
	 * @defaultValue `"auto-detect"`
	 */
	model?: ModelType | "auto-detect";

	/**
	 * Whether to display the ears drawn on the skin texture.
	 *
	 * - `true` - Display the ears drawn on the skin texture.
	 * - `"load-only"` - Loads the ear texture, but do not make them visible.
	 *   You can make them visible later by setting `PlayerObject.ears.visible` to `true`.
	 * - `false` - Do not load or show the ears.
	 *
	 * @defaultValue `false`
	 */
	ears?: boolean | "load-only";
}

export interface CapeLoadOptions extends LoadOptions {
	/**
	 * The equipment (`"cape"` or `"elytra"`) to show when the cape texture is loaded.
	 *
	 * If `makeVisible` is set to false, this option will have no effect.
	 *
	 * @defaultValue `"cape"`
	 */
	backEquipment?: BackEquipment;
}

export interface EarsLoadOptions extends LoadOptions {
	/**
	 * The type of the provided ear texture.
	 *
	 * - `"standalone"` means the provided texture is a 14x7 image that only contains the ears.
	 * - `"skin"` means the provided texture is a skin texture with ears, and we will use its ear part.
	 *
	 * @defaultValue `"standalone"`
	 */
	textureType?: "standalone" | "skin";
}

export interface SkinViewerOptions {
	/**
	 * The canvas where the renderer draws its output.
	 *
	 * @defaultValue If unspecified, a new canvas element will be created.
	 */
	canvas?: HTMLCanvasElement;

	/**
	 * The CSS width of the canvas.
	 */
	width?: number;

	/**
	 * The CSS height of the canvas.
	 */
	height?: number;

	/**
	 * The pixel ratio of the canvas.
	 *
	 * When set to `"match-device"`, the current device pixel ratio will be used,
	 * and it will be automatically updated when the device pixel ratio changes.
	 *
	 * @defaultValue `"match-device"`
	 */
	pixelRatio?: number | "match-device";

	/**
	 * The skin texture of the player.
	 *
	 * @defaultValue If unspecified, the skin will be invisible.
	 */
	skin?: RemoteImage | TextureSource | File | Blob;

	/**
	 * The model of the player (`"default"` for normal arms, and `"slim"` for slim arms).
	 *
	 * When set to `"auto-detect"`, the model will be inferred from the skin texture.
	 *
	 * If the `skin` option is not specified, this option will have no effect.
	 *
	 * @defaultValue `"auto-detect"`
	 */
	model?: ModelType | "auto-detect";

	/**
	 * The cape texture of the player.
	 *
	 * @defaultValue If unspecified, the cape will be invisible.
	 */
	cape?: RemoteImage | TextureSource | File | Blob;

	/**
	 * The ear texture of the player.
	 *
	 * When set to `"current-skin"`, the ears drawn on the current skin texture (as is specified in the `skin` option) will be shown.
	 *
	 * To use an individual ear texture, you have to specify the `textureType` and the `source` option.
	 * `source` is the texture to use, and `textureType` can be either `"standalone"` or `"skin"`:
	 *   - `"standalone"` means the provided texture is a 14x7 image that only contains the ears.
	 *   - `"skin"` means the provided texture is a skin texture with ears, and we will show its ear part.
	 *
	 * @defaultValue If unspecified, the ears will be invisible.
	 */
	ears?:
		| "current-skin"
		| {
				textureType: "standalone" | "skin";
				source: RemoteImage | TextureSource | File | Blob;
		  };

	/**
	 * Whether to preserve the buffers until manually cleared or overwritten.
	 *
	 * @defaultValue `false`
	 */
	preserveDrawingBuffer?: boolean;

	/**
	 * Whether to pause the rendering and animation loop.
	 *
	 * @defaultValue `false`
	 */
	renderPaused?: boolean;

	/**
	 * The background of the scene.
	 *
	 * @defaultValue transparent
	 */
	background?: ColorRepresentation | Texture;

	/**
	 * The panorama background to use.
	 *
	 * This option overrides the `background` option.
	 */
	panorama?: RemoteImage | TextureSource;

	/**
	 * Camera vertical field of view, in degrees.
	 *
	 * The distance between the player and the camera will be automatically computed from `fov` and `zoom`.
	 *
	 * @defaultValue `50`
	 *
	 * @see {@link SkinViewer.adjustCameraDistance}
	 */
	fov?: number;

	/**
	 * Zoom ratio of the player.
	 *
	 * This value affects the distance between the object and the camera.
	 * When set to `1.0`, the top edge of the player's head coincides with the edge of the canvas.
	 *
	 * The distance between the player and the camera will be automatically computed from `fov` and `zoom`.
	 *
	 * @defaultValue `0.9`
	 *
	 * @see {@link SkinViewer.adjustCameraDistance}
	 */
	zoom?: number;

	/**
	 * Whether to enable mouse control function.
	 *
	 * This function is implemented using {@link OrbitControls}.
	 * By default, zooming and rotating are enabled, and panning is disabled.
	 *
	 * @defaultValue `true`
	 */
	enableControls?: boolean;

	/**
	 * The animation to play on the player.
	 *
	 * @defaultValue If unspecified, no animation will be played.
	 */
	animation?: PlayerAnimation;

	/**
	 * The name tag to display above the player.
	 *
	 * @defaultValue If unspecified, no name tag will be displayed.
	 * @see {@link SkinViewer.nameTag}
	 */
	nameTag?: NameTagObject | string;
}

/**
 * The SkinViewer renders the player on a canvas.
 */
export class SkinViewer {
	/**
	 * The canvas where the renderer draws its output.
	 */
	readonly canvas: HTMLCanvasElement;

	readonly scene: Scene;

	readonly camera: PerspectiveCamera;

	readonly renderer: WebGLRenderer;

	/**
	 * The OrbitControls component which is used to implement the mouse control function.
	 *
	 * @see {@link https://threejs.org/docs/#examples/en/controls/OrbitControls | OrbitControls - three.js docs}
	 */
	readonly controls: OrbitControls;

	/**
	 * All player objects in the scene. The first entry is used for backward compatibility.
	 */
	readonly players: PlayerObject[];

	/**
	 * The default player object for backward compatibility.
	 */
	get playerObject(): PlayerObject {
		return this.players[0];
	}

	/**
	 * A group that wraps the player object.
	 * It is used to center the player in the world.
	 */
	readonly playerWrapper: Group;

	readonly globalLight: AmbientLight = new AmbientLight(0xffffff, 3);
	readonly cameraLight: PointLight = new PointLight(0xffffff, 0.6);

	readonly composer: EffectComposer;
	readonly renderPass: RenderPass;
	readonly fxaaPass: ShaderPass;

	private skinCanvases: Map<PlayerObject, HTMLCanvasElement> = new Map();
	private capeCanvases: Map<PlayerObject, HTMLCanvasElement> = new Map();
	private earsCanvases: Map<PlayerObject, HTMLCanvasElement> = new Map();
	private skinTextures: Map<PlayerObject, Texture | null> = new Map();
	private capeTextures: Map<PlayerObject, Texture | null> = new Map();
	private earsTextures: Map<PlayerObject, Texture | null> = new Map();
	private backgroundTexture: Texture | null = null;

	get skinCanvas(): HTMLCanvasElement {
		return this.skinCanvases.get(this.playerObject) as HTMLCanvasElement;
	}

	get capeCanvas(): HTMLCanvasElement {
		return this.capeCanvases.get(this.playerObject) as HTMLCanvasElement;
	}

	get earsCanvas(): HTMLCanvasElement {
		return this.earsCanvases.get(this.playerObject) as HTMLCanvasElement;
	}

	private _disposed: boolean = false;
	private _renderPaused: boolean = false;
	private _zoom: number;
	private isUserRotating: boolean = false;

	/**
	 * Whether to rotate the player along the y axis.
	 *
	 * @defaultValue `false`
	 */
	autoRotate: boolean = false;

	/**
	 * The angular velocity of the player, in rad/s.
	 *
	 * @defaultValue `1.0`
	 * @see {@link autoRotate}
	 */
	autoRotateSpeed: number = 1.0;

	private animations: Map<PlayerObject, PlayerAnimation>;
	private _animation: PlayerAnimation | null = null;
	private clock: Clock;

	private animationID: number | null;
	private onContextLost: (event: Event) => void;
	private onContextRestored: () => void;

	private _pixelRatio: number | "match-device";
	private devicePixelRatioQuery: MediaQueryList | null;
	private onDevicePixelRatioChange: () => void;

	private _nameTag: NameTagObject | null = null;

	constructor(options: SkinViewerOptions = {}) {
		this.canvas = options.canvas === undefined ? document.createElement("canvas") : options.canvas;

		this.scene = new Scene();
		this.camera = new PerspectiveCamera();
		this.camera.add(this.cameraLight);
		this.scene.add(this.camera);
		this.scene.add(this.globalLight);
		ColorManagement.enabled = false;

		this.renderer = new WebGLRenderer({
			canvas: this.canvas,
			preserveDrawingBuffer: options.preserveDrawingBuffer === true, // default: false
		});

		this.onDevicePixelRatioChange = () => {
			this.renderer.setPixelRatio(window.devicePixelRatio);
			this.updateComposerSize();

			if (this._pixelRatio === "match-device") {
				this.devicePixelRatioQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
				this.devicePixelRatioQuery.addEventListener("change", this.onDevicePixelRatioChange, { once: true });
			}
		};
		if (options.pixelRatio === undefined || options.pixelRatio === "match-device") {
			this._pixelRatio = "match-device";
			this.devicePixelRatioQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
			this.devicePixelRatioQuery.addEventListener("change", this.onDevicePixelRatioChange, { once: true });
			this.renderer.setPixelRatio(window.devicePixelRatio);
		} else {
			this._pixelRatio = options.pixelRatio;
			this.devicePixelRatioQuery = null;
			this.renderer.setPixelRatio(options.pixelRatio);
		}

		this.renderer.setClearColor(0, 0);

		let renderTarget;
		if (this.renderer.capabilities.isWebGL2) {
			// Use float precision depth if possible
			// see https://github.com/bs-community/skinview3d/issues/111
			renderTarget = new WebGLRenderTarget(0, 0, {
				depthTexture: new DepthTexture(0, 0, FloatType),
			});
		}
		this.composer = new EffectComposer(this.renderer, renderTarget);
		this.renderPass = new RenderPass(this.scene, this.camera);
		this.fxaaPass = new ShaderPass(FXAAShader);
		this.composer.addPass(this.renderPass);
		this.composer.addPass(this.fxaaPass);

		const defaultPlayer = new PlayerObject();
		defaultPlayer.name = "player";
		defaultPlayer.skin.visible = false;
		defaultPlayer.cape.visible = false;
		this.players = [defaultPlayer];
		this.playerWrapper = new Group();
		this.playerWrapper.add(defaultPlayer);
		this.scene.add(this.playerWrapper);
		this.initPlayerData(defaultPlayer);

		this.controls = new OrbitControls(this.camera, this.canvas);
		this.controls.enablePan = false; // disable pan by default
		this.controls.minDistance = 10;
		this.controls.maxDistance = 256;

		if (options.enableControls === false) {
			this.controls.enabled = false;
		}

		if (options.skin !== undefined) {
			this.loadSkin(options.skin, {
				model: options.model,
				ears: options.ears === "current-skin",
			});
		}
		if (options.cape !== undefined) {
			this.loadCape(options.cape);
		}
		if (options.ears !== undefined && options.ears !== "current-skin") {
			this.loadEars(options.ears.source, {
				textureType: options.ears.textureType,
			});
		}
		if (options.width !== undefined) {
			this.width = options.width;
		}
		if (options.height !== undefined) {
			this.height = options.height;
		}
		if (options.background !== undefined) {
			this.background = options.background;
		}
		if (options.panorama !== undefined) {
			this.loadPanorama(options.panorama);
		}
		if (options.nameTag !== undefined) {
			this.nameTag = options.nameTag;
		}
		this.camera.position.z = 1;
		this._zoom = options.zoom === undefined ? 0.9 : options.zoom;
		this.fov = options.fov === undefined ? 50 : options.fov;

		this.animations = new Map();
		this.clock = new Clock();
		if (options.animation !== undefined && options.animation !== null) {
			options.animation.progress = 0;
			this.animations.set(this.playerObject, options.animation);
		}

		if (options.renderPaused === true) {
			this._renderPaused = true;
			this.animationID = null;
		} else {
			this.animationID = window.requestAnimationFrame(() => this.draw());
		}

		this.onContextLost = (event: Event) => {
			event.preventDefault();
			if (this.animationID !== null) {
				window.cancelAnimationFrame(this.animationID);
				this.animationID = null;
			}
		};

		this.onContextRestored = () => {
			this.renderer.setClearColor(0, 0); // Clear color might be lost
			if (!this._renderPaused && !this._disposed && this.animationID === null) {
				this.animationID = window.requestAnimationFrame(() => this.draw());
			}
		};

		this.canvas.addEventListener("webglcontextlost", this.onContextLost, false);
		this.canvas.addEventListener("webglcontextrestored", this.onContextRestored, false);
		this.canvas.addEventListener(
			"mousedown",
			() => {
				this.isUserRotating = true;
			},
			false
		);
		this.canvas.addEventListener(
			"mouseup",
			() => {
				this.isUserRotating = false;
			},
			false
		);
		this.canvas.addEventListener(
			"touchmove",
			e => {
				if (e.touches.length === 1) {
					this.isUserRotating = true;
				} else {
					this.isUserRotating = false;
				}
			},
			false
		);
		this.canvas.addEventListener(
			"touchend",
			() => {
				this.isUserRotating = false;
			},
			false
		);
	}

	private updateComposerSize(): void {
		this.composer.setSize(this.width, this.height);
		const pixelRatio = this.renderer.getPixelRatio();
		this.composer.setPixelRatio(pixelRatio);
		this.fxaaPass.material.uniforms["resolution"].value.x = 1 / (this.width * pixelRatio);
		this.fxaaPass.material.uniforms["resolution"].value.y = 1 / (this.height * pixelRatio);
	}

	private initPlayerData(player: PlayerObject): void {
		this.skinCanvases.set(player, document.createElement("canvas"));
		this.capeCanvases.set(player, document.createElement("canvas"));
		this.earsCanvases.set(player, document.createElement("canvas"));
		this.skinTextures.set(player, null);
		this.capeTextures.set(player, null);
		this.earsTextures.set(player, null);
	}

	private applySkinPlaceholder(player: PlayerObject): void {
		const canvas = this.skinCanvases.get(player) as HTMLCanvasElement;
		canvas.width = 64;
		canvas.height = 64;
		const ctx = canvas.getContext("2d");
		if (ctx) {
			ctx.fillStyle = "#c6c6c6";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
		}
		this.recreateSkinTexture(player);
		player.skin.visible = true;
	}

	private recreateSkinTexture(player: PlayerObject): void {
		const old = this.skinTextures.get(player);
		if (old !== null && old !== undefined) {
			old.dispose();
		}
		const canvas = this.skinCanvases.get(player) as HTMLCanvasElement;
		const texture = new CanvasTexture(canvas);
		texture.magFilter = NearestFilter;
		texture.minFilter = NearestFilter;
		player.skin.map = texture;
		this.skinTextures.set(player, texture);
	}

	private recreateCapeTexture(player: PlayerObject): void {
		const old = this.capeTextures.get(player);
		if (old !== null && old !== undefined) {
			old.dispose();
		}
		const canvas = this.capeCanvases.get(player) as HTMLCanvasElement;
		const texture = new CanvasTexture(canvas);
		texture.magFilter = NearestFilter;
		texture.minFilter = NearestFilter;
		player.cape.map = texture;
		player.elytra.map = texture;
		this.capeTextures.set(player, texture);
	}

	private recreateEarsTexture(player: PlayerObject): void {
		const old = this.earsTextures.get(player);
		if (old !== null && old !== undefined) {
			old.dispose();
		}
		const canvas = this.earsCanvases.get(player) as HTMLCanvasElement;
		const texture = new CanvasTexture(canvas);
		texture.magFilter = NearestFilter;
		texture.minFilter = NearestFilter;
		player.ears.map = texture;
		this.earsTextures.set(player, texture);
	}

	loadSkin(empty: null, options?: SkinLoadOptions, player?: PlayerObject): void;
	loadSkin<S extends TextureSource | RemoteImage | File | Blob>(
		source: S,
		options?: SkinLoadOptions,
		player?: PlayerObject
	): S extends TextureSource ? void : Promise<void>;

	loadSkin(
		source: TextureSource | RemoteImage | File | Blob | null,
		options: SkinLoadOptions = {},
		player: PlayerObject = this.playerObject
	): void | Promise<void> {
		const skinCanvas = this.skinCanvases.get(player) as HTMLCanvasElement;
		const earsCanvas = this.earsCanvases.get(player) as HTMLCanvasElement;
		if (source === null) {
			this.resetSkin(player);
		} else if (isTextureSource(source)) {
			loadSkinToCanvas(skinCanvas, source);
			this.recreateSkinTexture(player);

			if (options.model === undefined || options.model === "auto-detect") {
				player.skin.modelType = inferModelType(skinCanvas);
			} else {
				player.skin.modelType = options.model;
			}

			if (options.makeVisible !== false) {
				player.skin.visible = true;
			}

			if (options.ears === true || options.ears == "load-only") {
				loadEarsToCanvasFromSkin(earsCanvas, source);
				this.recreateEarsTexture(player);
				if (options.ears === true) {
					player.ears.visible = true;
				}
			}
		} else if (source instanceof File || source instanceof Blob) {
			const url = URL.createObjectURL(source);
			return loadImage(url)
				.then(image => this.loadSkin(image, options, player))
				.finally(() => URL.revokeObjectURL(url));
		} else {
			return loadImage(source).then(image => this.loadSkin(image, options, player));
		}
	}

	resetSkin(player: PlayerObject = this.playerObject): void {
		this.applySkinPlaceholder(player);
	}

	loadCape(empty: null, options?: CapeLoadOptions, player?: PlayerObject): void;
	loadCape<S extends TextureSource | RemoteImage | File | Blob>(
		source: S,
		options?: CapeLoadOptions,
		player?: PlayerObject
	): S extends TextureSource ? void : Promise<void>;

	loadCape(
		source: TextureSource | RemoteImage | File | Blob | null,
		options: CapeLoadOptions = {},
		player: PlayerObject = this.playerObject
	): void | Promise<void> {
		const capeCanvas = this.capeCanvases.get(player) as HTMLCanvasElement;
		if (source === null) {
			this.resetCape(player);
		} else if (isTextureSource(source)) {
			loadCapeToCanvas(capeCanvas, source);
			this.recreateCapeTexture(player);

			if (options.makeVisible !== false) {
				player.backEquipment = options.backEquipment === undefined ? "cape" : options.backEquipment;
			}
		} else if (source instanceof File || source instanceof Blob) {
			const url = URL.createObjectURL(source);
			return loadImage(url)
				.then(image => this.loadCape(image, options, player))
				.finally(() => URL.revokeObjectURL(url));
		} else {
			return loadImage(source).then(image => this.loadCape(image, options, player));
		}
	}

	resetCape(player: PlayerObject = this.playerObject): void {
		player.backEquipment = null;
		player.cape.map = null;
		player.elytra.map = null;
		const texture = this.capeTextures.get(player);
		if (texture !== null && texture !== undefined) {
			texture.dispose();
			this.capeTextures.set(player, null);
		}
	}

	loadEars(empty: null, options?: EarsLoadOptions, player?: PlayerObject): void;
	loadEars<S extends TextureSource | RemoteImage | File | Blob>(
		source: S,
		options?: EarsLoadOptions,
		player?: PlayerObject
	): S extends TextureSource ? void : Promise<void>;

	loadEars(
		source: TextureSource | RemoteImage | File | Blob | null,
		options: EarsLoadOptions = {},
		player: PlayerObject = this.playerObject
	): void | Promise<void> {
		const earsCanvas = this.earsCanvases.get(player) as HTMLCanvasElement;
		if (source === null) {
			this.resetEars(player);
		} else if (isTextureSource(source)) {
			if (options.textureType === "skin") {
				loadEarsToCanvasFromSkin(earsCanvas, source);
			} else {
				loadEarsToCanvas(earsCanvas, source);
			}
			this.recreateEarsTexture(player);

			if (options.makeVisible !== false) {
				player.ears.visible = true;
			}
		} else if (source instanceof File || source instanceof Blob) {
			const url = URL.createObjectURL(source);
			return loadImage(url)
				.then(image => this.loadEars(image, options, player))
				.finally(() => URL.revokeObjectURL(url));
		} else {
			return loadImage(source).then(image => this.loadEars(image, options, player));
		}
	}

	resetEars(player: PlayerObject = this.playerObject): void {
		player.ears.visible = false;
		player.ears.map = null;
		const texture = this.earsTextures.get(player);
		if (texture !== null && texture !== undefined) {
			texture.dispose();
			this.earsTextures.set(player, null);
		}
	}

	addPlayer(options: SkinLoadOptions = {}): PlayerObject {
		const player = new PlayerObject();
		player.cape.visible = false;
		if (options.model !== undefined && options.model !== "auto-detect") {
			player.skin.modelType = options.model;
		}
		this.initPlayerData(player);
		this.applySkinPlaceholder(player);
		this.players.push(player);
		this.playerWrapper.add(player);
		return player;
	}

	removePlayer(player: PlayerObject): void {
		const index = this.players.indexOf(player);
		if (index !== -1) {
			this.playerWrapper.remove(player);
			this.players.splice(index, 1);
			this.resetSkin(player);
			this.resetCape(player);
			this.resetEars(player);
			const skinTexture = this.skinTextures.get(player);
			if (skinTexture) {
				skinTexture.dispose();
			}
			this.skinCanvases.delete(player);
			this.capeCanvases.delete(player);
			this.earsCanvases.delete(player);
			this.skinTextures.delete(player);
			this.capeTextures.delete(player);
			this.earsTextures.delete(player);
		}
	}

	loadPanorama<S extends TextureSource | RemoteImage>(source: S): S extends TextureSource ? void : Promise<void> {
		return this.loadBackground(source, EquirectangularReflectionMapping);
	}

	loadBackground<S extends TextureSource | RemoteImage>(
		source: S,
		mapping?: Mapping
	): S extends TextureSource ? void : Promise<void>;

	loadBackground<S extends TextureSource | RemoteImage>(source: S, mapping?: Mapping): void | Promise<void> {
		if (isTextureSource(source)) {
			if (this.backgroundTexture !== null) {
				this.backgroundTexture.dispose();
			}
			this.backgroundTexture = new Texture();
			this.backgroundTexture.image = source;
			if (mapping !== undefined) {
				this.backgroundTexture.mapping = mapping;
			}
			this.backgroundTexture.needsUpdate = true;
			this.scene.background = this.backgroundTexture;
		} else {
			return loadImage(source).then(image => this.loadBackground(image, mapping));
		}
	}

	private draw(): void {
		const dt = this.clock.getDelta();
		if (this._animation !== null) {
			for (const player of this.players) {
				this._animation.update(player, dt);
			}
		}
		if (this.autoRotate) {
			if (!(this.controls.enableRotate && this.isUserRotating)) {
				this.playerWrapper.rotation.y += dt * this.autoRotateSpeed;
			}
		}
		this.controls.update();
		this.render();
		this.animationID = window.requestAnimationFrame(() => this.draw());
	}

	/**
	 * Renders the scene to the canvas.
	 * This method does not change the animation progress.
	 */
	render(): void {
		this.composer.render();
	}

	setSize(width: number, height: number): void {
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(width, height);
		this.updateComposerSize();
	}

	dispose(): void {
		this._disposed = true;

		this.canvas.removeEventListener("webglcontextlost", this.onContextLost, false);
		this.canvas.removeEventListener("webglcontextrestored", this.onContextRestored, false);

		if (this.devicePixelRatioQuery !== null) {
			this.devicePixelRatioQuery.removeEventListener("change", this.onDevicePixelRatioChange);
			this.devicePixelRatioQuery = null;
		}

		if (this.animationID !== null) {
			window.cancelAnimationFrame(this.animationID);
			this.animationID = null;
		}

		this.controls.dispose();
		this.renderer.dispose();
		for (const player of this.players) {
			this.resetSkin(player);
			this.resetCape(player);
			this.resetEars(player);
		}
		this.background = null;
		(this.fxaaPass.fsQuad as FullScreenQuad).dispose();
	}

	get disposed(): boolean {
		return this._disposed;
	}

	/**
	 * Whether rendering and animations are paused.
	 * Setting this property to true will stop both rendering and animation loops.
	 * Setting it back to false will resume them.
	 */
	get renderPaused(): boolean {
		return this._renderPaused;
	}

	set renderPaused(value: boolean) {
		this._renderPaused = value;

		if (this._renderPaused && this.animationID !== null) {
			window.cancelAnimationFrame(this.animationID);
			this.animationID = null;
			this.clock.stop();
			this.clock.autoStart = true;
		} else if (
			!this._renderPaused &&
			!this._disposed &&
			!this.renderer.getContext().isContextLost() &&
			this.animationID == null
		) {
			this.animationID = window.requestAnimationFrame(() => this.draw());
		}
	}

	get width(): number {
		return this.renderer.getSize(new Vector2()).width;
	}

	set width(newWidth: number) {
		this.setSize(newWidth, this.height);
	}

	get height(): number {
		return this.renderer.getSize(new Vector2()).height;
	}

	set height(newHeight: number) {
		this.setSize(this.width, newHeight);
	}

	get background(): null | Color | Texture {
		return this.scene.background;
	}

	set background(value: null | ColorRepresentation | Texture) {
		if (value === null || value instanceof Color || value instanceof Texture) {
			this.scene.background = value;
		} else {
			this.scene.background = new Color(value);
		}
		if (this.backgroundTexture !== null && value !== this.backgroundTexture) {
			this.backgroundTexture.dispose();
			this.backgroundTexture = null;
		}
	}

	adjustCameraDistance(): void {
		let distance = 4.5 + 16.5 / Math.tan(((this.fov / 180) * Math.PI) / 2) / this.zoom;

		// limit distance between 10 ~ 256 (default min / max distance of OrbitControls)
		if (distance < 10) {
			distance = 10;
		} else if (distance > 256) {
			distance = 256;
		}

		this.camera.position.multiplyScalar(distance / this.camera.position.length());
		this.camera.updateProjectionMatrix();
	}

	resetCameraPose(): void {
		this.camera.position.set(0, 0, 1);
		this.camera.rotation.set(0, 0, 0);
		this.adjustCameraDistance();
	}

	get fov(): number {
		return this.camera.fov;
	}

	set fov(value: number) {
		this.camera.fov = value;
		this.adjustCameraDistance();
	}

	get zoom(): number {
		return this._zoom;
	}

	set zoom(value: number) {
		this._zoom = value;
		this.adjustCameraDistance();
	}

	get pixelRatio(): number | "match-device" {
		return this._pixelRatio;
	}

	set pixelRatio(newValue: number | "match-device") {
		if (newValue === "match-device") {
			if (this._pixelRatio !== "match-device") {
				this._pixelRatio = newValue;
				this.onDevicePixelRatioChange();
			}
		} else {
			if (this._pixelRatio === "match-device" && this.devicePixelRatioQuery !== null) {
				this.devicePixelRatioQuery.removeEventListener("change", this.onDevicePixelRatioChange);
				this.devicePixelRatioQuery = null;
			}
			this._pixelRatio = newValue;
			this.renderer.setPixelRatio(newValue);
			this.updateComposerSize();
		}
	}

	/**
	 * Returns the animation currently assigned to the given player, or `null` if none is playing.
	 */
	getAnimation(player: PlayerObject): PlayerAnimation | null {
		return this.animations.get(player) ?? null;
	}

	setAnimation(player: PlayerObject, animation: PlayerAnimation | null): void {
		if (this._animation !== animation) {
			player.resetJoints();
			player.position.set(0, 0, 0);
			player.rotation.set(0, 0, 0);
			this.clock.stop();
			this.clock.autoStart = true;
		}
		if (animation !== null) {
			animation.progress = 0;
			this.animations.set(player, animation);
		} else {
			this.animations.delete(player);
		}
		if (player === this.playerObject) {
			this._animation = animation;
		}
	}

	/**
	 * The animation that is current playing on the primary player, or `null` if no animation is playing.
	 *
	 * Setting this property to a different value will change the current animation for the primary player.
	 * The player's pose and the progress of the new animation will be reset before playing.
	 *
	 * Setting this property to `null` will stop the current animation and reset the player's pose.
	 */
	get animation(): PlayerAnimation | null {
		return this.getAnimation(this.playerObject);
	}

	set animation(animation: PlayerAnimation | null) {
		this.setAnimation(this.playerObject, animation);
	}

	/**
	 * Instantiates the given animation class and assigns it to a player.
	 *
	 * @param cls - The animation class to instantiate.
	 * @param player - The player to assign the created animation to. Defaults to the primary player.
	 * @returns The created animation instance.
	 */
	loadAnimationClass(cls: typeof PlayerAnimation, player: PlayerObject = this.playerObject): PlayerAnimation {
		const animation = new (cls as new () => PlayerAnimation)();
		this.setAnimation(player, animation);
		return animation;
	}

	/**
	 * The name tag to display above the player, or `null` if there is none.
	 *
	 * When setting this property to a `string` value, a {@link NameTagObject}
	 * will be automatically created with default options.
	 *
	 * @example
	 * ```
	 * skinViewer.nameTag = "hello";
	 * skinViewer.nameTag = new NameTagObject("hello", { textStyle: "yellow" });
	 * skinViewer.nameTag = null;
	 * ```
	 */
	get nameTag(): NameTagObject | null {
		return this._nameTag;
	}

	set nameTag(newVal: NameTagObject | string | null) {
		if (this._nameTag !== null) {
			// Remove the old name tag from the scene
			this.playerWrapper.remove(this._nameTag);
		}

		if (newVal !== null) {
			if (!(newVal instanceof Object3D)) {
				newVal = new NameTagObject(newVal);
			}

			// Add the new name tag to the scene
			this.playerWrapper.add(newVal);
			// Set y position
			newVal.position.y = 20;
		}

		this._nameTag = newVal;
	}
}
