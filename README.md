skinview3d
========

[![CI Status](https://img.shields.io/github/actions/workflow/status/bs-community/skinview3d/ci.yaml?branch=master&label=CI&logo=github&style=flat-square)](https://github.com/bs-community/skinview3d/actions?query=workflow:CI)
[![NPM Package](https://img.shields.io/npm/v/skinview3d.svg?style=flat-square)](https://www.npmjs.com/package/skinview3d)
[![MIT License](https://img.shields.io/badge/license-MIT-yellowgreen.svg?style=flat-square)](https://github.com/bs-community/skinview3d/blob/master/LICENSE)
[![Gitter Chat](https://img.shields.io/gitter/room/TechnologyAdvice/Stardust.svg?style=flat-square)](https://gitter.im/skinview3d/Lobby)

Three.js powered Minecraft skin viewer.

# Features
* 1.8 Skins
* HD Skins
* Capes
* Ears
* Elytras
* Slim Arms
  * Automatic model detection (Slim / Default)
* FXAA (fast approximate anti-aliasing)

# Usage
[Example of using skinview3d](https://skinview3d-demo.vercel.app)

[![CodeSandbox](https://img.shields.io/badge/Codesandbox-040404?style=for-the-badge&logo=codesandbox&logoColor=DBDBDB)](https://codesandbox.io/s/skinview3d-template-vdmuh4)

The demo includes a **Reset All** button that returns the camera to its default
pose and resets orbit controls after you rotate or zoom the view.

Each texture option (`skin`, `cape`, `ears`, `background`, `panorama`, etc.)
accepts a URL string, an existing `HTMLImageElement`/`HTMLCanvasElement`, or a
user-uploaded `File`/`Blob` object.

When no skin is provided, the viewer displays a simple gray placeholder. Call
`loadSkin(null)` or `resetSkin()` to return to the placeholder skin.

```html
<canvas id="skin_container"></canvas>
<script>
	let skinViewer = new skinview3d.SkinViewer({
		canvas: document.getElementById("skin_container"),
		width: 300,
		height: 400,
		skin: "img/skin.png"
	});

	// Change viewer size
	skinViewer.width = 600;
	skinViewer.height = 800;

        // Load another skin
        skinViewer.loadSkin("img/skin2.png");

        // Remove the skin and show a placeholder
        skinViewer.loadSkin(null);

        // Load a cape
        skinViewer.loadCape("img/cape.png");

	// Load an elytra (from a cape texture)
	skinViewer.loadCape("img/cape.png", { backEquipment: "elytra" });

	// Unload(hide) the cape / elytra
	skinViewer.loadCape(null);

	// Set the background color
	skinViewer.background = 0x5a76f3;

	// Set the background to a normal image
	skinViewer.loadBackground("img/background.png");

	// Set the background to a panoramic image
	skinViewer.loadPanorama("img/panorama1.png");

	// Change camera FOV
	skinViewer.fov = 70;

	// Zoom out
	skinViewer.zoom = 0.5;

	// Rotate the player
	skinViewer.autoRotate = true;

        // Apply an animation
        skinViewer.animation = new skinview3d.WalkingAnimation();

        // Or create a keyframe animation
        const kf = new skinview3d.KeyframeAnimation({
                keyframes: [
                        { time: 0, bones: { skin: [0, 0, 0] } },
                        { time: 1, bones: { skin: [0, Math.PI, 0] } },
                ],
        });
        skinViewer.animation = kf;

	// Set the speed of the animation
	skinViewer.animation.speed = 3;

	// Pause the animation
	skinViewer.animation.paused = true;

// Remove the animation
skinViewer.animation = null;
</script>
```

To control animations for additional `PlayerObject` instances added to the scene, use
`setAnimation(player, animation)` and `getAnimation(player)` to assign or retrieve the
animation for a specific player.

```js
import { SkinViewer, BendAnimation } from "skinview3d";

const skinViewer = new SkinViewer({
canvas: document.getElementById("skin_container"),
});

skinViewer.animation = new BendAnimation();
```

SkinViewer automatically spreads multiple players and adjusts the camera:

You can add more player models to the scene with `addPlayer()`. Pass the returned
`PlayerObject` to texture-loading methods to control each player independently.

By default, the viewer repositions players and adjusts the camera after
`addPlayer()` or `removePlayer()`. If you disable `autoFit`, call
`updateLayout()` whenever players are added or removed to keep them centered.

```ts
import { SkinViewer } from "skinview3d";

const viewer = new SkinViewer({
  canvas: document.getElementById("skin_container"),
});

const second = viewer.addPlayer();
viewer.loadSkin("img/first.png");
viewer.loadSkin("img/second.png", {}, second);
viewer.loadCape("img/cape.png", {}, second);
viewer.loadEars("img/ears.png", { textureType: "standalone" }, second);
```

```ts
// Disable automatic layout and trigger it manually when needed
viewer.autoFit = false;
// ... add or remove players ...
viewer.updateLayout();
```

### Keyframe animations

`KeyframeAnimation` lets you persist animations as JSON and restore them later.

```ts
import { KeyframeAnimation, createKeyframeAnimation } from "skinview3d";

const anim = new KeyframeAnimation({
  keyframes: [
    {
      time: 0,
      bones: {
        "skin.leftUpperArm": [0, 0, 0],
        "skin.rightUpperArm": [0, 0, 0],
      },
    },
    {
      time: 1,
      bones: {
        "skin.leftUpperArm": [Math.PI / 2, 0, 0],
        "skin.rightUpperArm": [-Math.PI / 2, 0, 0],
      },
    },
  ],
});

const data = anim.toJSON();
const rebuilt = createKeyframeAnimation(data);
const source = anim.exportClass("WaveAnimation");
```

The serialized format is:

```ts
interface KeyframeData {
  keyframes: Array<{
    time: number;
    bones: Record<string, [number, number, number]>; // rotations in radians
  }>;
}
```

Bone names are dotted paths relative to the `PlayerObject`, such as `"skin.leftUpperArm"` or `"cape"`.

```html
<!-- Upload a new skin (the same approach works for capes, armor, items, panoramas, etc.) -->
<input type="file" id="skin_file" accept="image/*">
<script>
        document.getElementById("skin_file").addEventListener("change", function (e) {
                const file = e.target.files && e.target.files[0];
                if (file) {
                        skinViewer.loadSkin(file);
                        // For capes, armor or item textures, call loadCape(file), loadEars(file), etc.
                }
        });
</script>
```

## Lighting
By default, there are two lights on the scene. One is an ambient light, and the other is a point light from the camera.

To change the light intensity:
```js
skinViewer.cameraLight.intensity = 0.9;
skinViewer.globalLight.intensity = 0.1;
```

Setting `globalLight.intensity` to `1.0` and `cameraLight.intensity` to `0.0`
will completely disable shadows.

## Ears
skinview3d supports two types of ear texture:
* `standalone`: 14x7 image that contains the ear ([example](https://github.com/bs-community/skinview3d/blob/master/examples/public/img/ears.png))
* `skin`: Skin texture that contains the ear (e.g. [deadmau5's skin](https://minecraft.wiki/w/Easter_eggs#deadmau5's_ears))

Usage:
```js
// You can specify ears in the constructor:
new skinview3d.SkinViewer({
	skin: "img/deadmau5.png",

	// Use ears drawn on the current skin (img/deadmau5.png)
	ears: "current-skin",

	// Or use ears from other textures
	ears: {
		textureType: "standalone", // "standalone" or "skin"
		source: "img/ears.png"
	}
});

// Show ears when loading skins:
skinViewer.loadSkin("img/deadmau5.png", { ears: true });

// Use ears from other textures:
skinViewer.loadEars("img/ears.png", { textureType: "standalone" });
skinViewer.loadEars("img/deadmau5.png", { textureType: "skin" });
```

## Name Tag
Usage:
```js
// Name tag with text "hello"
skinViewer.nameTag = "hello";

// Specify the text color
skinViewer.nameTag = new skinview3d.NameTagObject("hello", { textStyle: "yellow" });

// Unset the name tag
skinViewer.nameTag = null;
```

In order to display name tags correctly, you need the `Minecraft` font from
[South-Paw/typeface-minecraft](https://github.com/South-Paw/typeface-minecraft).
This font is available at [`assets/minecraft.woff2`](assets/minecraft.woff2).

To load this font, please add the `@font-face` rule to your CSS:
```css
@font-face {
	font-family: 'Minecraft';
	src: url('/path/to/minecraft.woff2') format('woff2');
}
```

# Build
`npm run build`
