# Cyber Blaster 🚀

**Cyber Blaster** is a modular, arcade-style light-gun shooter built from scratch using Vanilla JavaScript, HTML5 Canvas, and CSS3.

Enter a futuristic cybernetic battlefield, eliminate incoming hostiles, protect innocent hostages, collect tactical power-ups, and compete for a place on the global Top 10 leaderboard!

Designed for both desktop and mobile browsers, Cyber Blaster combines classic arcade shooting mechanics with a perspective-based 3D-style environment and dynamic target encounters.

---

## 🌟 Key Features

* **Modular Light-Gun Engine:** Responsive crosshair tracking, mouse and touchscreen shooting, screen shake effects, procedural particle generation, and dynamic shooting feedback.

* **Perspective-Based Environment:** A custom one-point perspective projection system that creates a 3D-style battlefield using HTML5 Canvas, complete with depth-aware positioning, scaling, and rendering.

* **Dynamic Platform Architecture:** Procedurally arranged environmental structures, including industrial catwalks, elevated balconies, suspended platforms, and varied architectural layouts.

* **Dynamic Target Patterns:** Enemies utilize different movement behaviours, including static positioning, horizontal and vertical drifting, diagonal movement, fast-moving paths, and tactical pop-up cover mechanics.

* **Armored Enemies & Toughness Tiers:** Multi-hit armored targets with different durability levels, visually distinguished by color:
  - Yellow: 2 hits
  - Green: 3 hits
  - Blue: 4 hits
  - Violet: 5 hits

* **Combo & Scoring System:** Build consecutive hit streaks to increase score multipliers up to x5, or x10 with an active multiplier perk.

* **Power-Up Perks:** Collect tactical power-ups that provide additional lives, bonus time, machine-gun ammunition, and score multipliers.

* **Stationary Perk Targets:** Power-ups remain in designated positions instead of moving around the battlefield, allowing players to aim and collect them more deliberately.

* **Arcade Leaderboard:** Local-storage-backed Top 10 leaderboard with classic three-letter initials entry for high scorers.

* **Synthesized Audio Engine:** Built-in Web Audio API sound generation for gunshots, reloads, hits, and damage feedback without requiring external audio assets.

* **Desktop & Mobile Support:** Responsive interface, touchscreen shooting, dedicated mobile controls, and fullscreen support for a more accessible arcade experience.

---

## 🕹️ Controls

### Desktop

| Action | Control |
|---|---|
| Aim | Mouse Movement |
| Shoot | Left Mouse Button |
| Reload | `SPACE` or `R` |

### Mobile / Touch

| Action | Control |
|---|---|
| Aim | Touchscreen |
| Shoot | Screen Tap |
| Reload | Dedicated **RELOAD** Button |

---

## 📖 Arcade Manual & Rules

### Target Showcase

* **Standard Enemies:** Generally require one shot to eliminate and award 100 base points. They can appear in stationary, moving, or pop-up cover patterns.

* **Armored Enemies:** Require multiple hits depending on their toughness tier. Their durability is indicated by color:
  - Yellow: 2 hits
  - Green: 3 hits
  - Blue: 4 hits
  - Violet: 5 hits

  Points are awarded upon elimination based on toughness: `100 × Toughness`.

* **Hostages:** **DO NOT SHOOT!** Hitting a hostage results in a life penalty (-1 Life), a score deduction (-250 PTS), a combo break, and the current wave reset under the existing rules.

### Perk Showcase

* **Extra Life (♥):** Restores +1 Life, up to a maximum of 5 lives.

* **Timer+ (⏱):** Adds bonus time to the existing threat timer.

* **Machine Gun (⚡):** Equips a rapid-fire weapon loaded with 30 automatic rounds.

* **2X Multiplier (2X):** Activates a 10-second double-score effect and increases the maximum combo multiplier to x10.

---

## 🏗️ Environment & Rendering

Cyber Blaster uses a custom world-space coordinate system and perspective projection to create depth within a 2D canvas.

Key elements include:

* **One-Point Perspective:** World objects are projected toward a shared vanishing point.
* **Depth-Aware Rendering:** Targets and environmental objects are scaled and positioned according to their distance.
* **World-Space Platforms:** Elevated structures and industrial architectural elements occupy defined positions within the game environment.
* **Depth Sorting:** Rendering order accounts for object depth to improve visual overlap and scene composition.
* **Collision & Hit Detection:** Custom geometry and collision checks support targets, obstacles, platforms, and shooting interactions.

---

## 🛠️ Built With

* **HTML5 Canvas (`gameCanvas`):** Rendering engine for targets, environmental objects, perspective geometry, particles, and bullet-hole effects.

* **CSS3 & Flexbox (`style.css`):** Responsive arcade overlays, neon-themed UI containers, HUD positioning, mobile layouts, and modal transitions.

* **Vanilla JavaScript (`game.js`):** Core game engine implementing object-oriented game logic, perspective projection, target behaviour, collision detection, scoring, state management, and Web Audio API integration.

No external game engine is required.

---

## 🚀 Getting Started & Running Locally

To run Cyber Blaster locally:

1. Clone or download this repository.
2. Ensure the three core files are in the same directory:
   - `index.html`
   - `style.css`
   - `game.js`
3. Open `index.html` in a modern web browser.

Alternatively, use a local development server such as **Live Server** in Visual Studio Code or XAMPP.

---

## 🗺️ Development Roadmap

Cyber Blaster is actively evolving, with future updates focused on expanding its arcade shooting mechanics and encounter design.

Planned improvements include:

* **Campaign Combat System:** Introduce distinct melee and ranged enemy classes, individual enemy attack cycles, and more dynamic threat behaviour.

* **Incoming Projectile System:** Add visible incoming bullet tracers so players can anticipate and react to ranged enemy attacks.

* **Player Cover Mechanics:** Introduce a Time Crisis-inspired cover action with keyboard and mobile controls, allowing players to duck behind cover to avoid incoming ranged attacks.

* **Improved Wave Progression:** Develop encounter-based campaign waves with individual countdowns, life penalties, and wave-bound perk effects.

* **Scripted Enemy Encounters:** Introduce coordinated enemy movement, controlled entrance and exit paths, and environmental interactions involving doors, windows, and cover.

* **Destructible Environment:** Add breakable environmental objects with destruction effects and potential tactical perk drops.

* **Survival Mode:** Develop a dedicated endurance mode with continuous enemy encounters and mode-specific perk balancing.

* **Performance & Compatibility:** Continue improving rendering performance, gameplay balance, and desktop/mobile compatibility.

---

## 📌 Project Status

Cyber Blaster is an ongoing development project. Existing features and mechanics are continuously refined, while planned systems are introduced incrementally to preserve stability and compatibility.

Contributions, suggestions, and feedback are welcome!
