# Deebot Buddy — Editable Mascot SVGs

These 4 standalone SVG files control the robot mascot illustrations shown in the Deebot Buddy hero section.

## File Mapping

| File | Mood Trigger |
| :--- | :--- |
| `happy.svg` | **Sparkling & Happy** — All maintenance tasks `< 75%` elapsed |
| `normal.svg` | **Content & Ready** — At least one task `75%–99%` elapsed |
| `dusty.svg` | **Dusty & Tangled** — `1+` tasks overdue |
| `faint.svg` | **Needs Rescue!** — `3+` tasks overdue or **Dirty Water Tank** overdue |

## Editing Workflow (No Code or Rebuild Required)

1. Open any file (`happy.svg`, `normal.svg`, `dusty.svg`, `faint.svg`) in **Figma**, **Adobe Illustrator**, **Affinity Designer**, or **Inkscape**.
   - Keep the canvas / `viewBox` at **`240 × 220`** so all 4 moods align cleanly in the hero card.
   - Elements are organized into named groups/layers (`aura`, `shadow`, `mood-backdrop`, `robot-body`, `side-brush`, `front-bumper`, `sensor-visor`, `top-lid`, `rear-gloss-panel`, `silver-y-emblem`, `face-expression`, `mood-foreground`).
   - Built-in `<style>` CSS animations work automatically inside the app, and can be kept, tweaked, or removed if you export a static SVG.
2. Save the `.svg` file directly back into `mascots/`.
3. In the web app (`http://localhost:8080`), click **Preview moods** right below the mascot to switch between `Happy`, `Normal`, `Dusty`, and `Faint`, and click **Reload SVG** (or refresh the browser) to see your edits live!

## Synology NAS / Docker Override

If you run Deebot Buddy inside Docker on a Synology NAS, you can override any mascot without rebuilding the container image by placing your edited `.svg` files in:

```
/volume1/docker/deebot-buddy/data/mascots/
```

For example: `/volume1/docker/deebot-buddy/data/mascots/happy.svg`.
