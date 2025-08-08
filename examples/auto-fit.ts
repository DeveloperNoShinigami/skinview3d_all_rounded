import * as skinview3d from "../src/skinview3d";
import "./style.css";

const viewer = new skinview3d.SkinViewer({
	canvas: document.getElementById("viewer") as HTMLCanvasElement,
	width: 300,
	height: 400,
	autoFit: true,
});

viewer.loadSkin("img/1_8_texturemap_redux.png");
const player2 = viewer.addPlayer();
viewer.loadSkin("img/haka.png", {}, player2);
const player3 = viewer.addPlayer();
viewer.loadSkin("img/hatsune_miku.png", {}, player3);
