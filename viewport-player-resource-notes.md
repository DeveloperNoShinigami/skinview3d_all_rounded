# Viewport Reset, Player Selection, and Resource Menu Notes

This document captures recent changes and lessons learned around viewport resetting, player selection, and the resource menu.

## Viewport Reset

- Resets camera pose and player layout when the viewer size changes.
- **Pitfall:** Calling `resetCameraPose()` without `updateLayout()` may leave players off-center.
- **Unresolved Issue:** After removing players and resetting the camera, the view can remain misaligned.
  - **Steps to Reproduce:**
    1. Open `examples/index.html`.
    2. Add a second player.
    3. Remove the added player.
    4. Run `resetCameraPose()` in the console.
    5. Observe the camera offset from the remaining player.

## Player Selection

- Dropdown for choosing which player to control or texture.
- **Pitfall:** Removing a player without clearing its animation causes animations to leak onto new players.
- **Unresolved Issue:** Rapidly switching selections may duplicate meshes.
  - **Steps to Reproduce:**
    1. Open the multi-player example.
    2. Quickly switch players using the selection dropdown.
    3. Duplicate models occasionally appear.

## Resource Menu

- Centralized menu to load skins, capes, and other textures.
- **Pitfall:** File inputs fire too quickly, leading to stale previews.
- **Unresolved Issue:** Selecting a new resource before a previous texture finishes loading can leave the viewer blank.
  - **Steps to Reproduce:**
    1. Open any example using the resource menu.
    2. Choose a large texture file.
    3. Before it loads, select another resource.
    4. The viewer sometimes displays nothing.

These notes will help future contributors understand the context and avoid repeating past issues.
