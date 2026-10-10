# Cyber Blaster 🚀

A modular, arcade-style light-gun shooter game built from scratch using vanilla JavaScript, HTML5 Canvas, and CSS3. Step into a cybernetic grid, eliminate incoming hostiles, protect hostages, and chase high scores on the global top 10 leaderboard!

---

## 🌟 Key Features

* **Modular Light-Gun Engine:** Smooth crosshair tracking, touch support for mobile devices, screen shake effects, and procedural particle generation.


* **Dynamic Target Patterns:** Enemies utilize diverse movement behaviors including static positioning, horizontal/vertical drifting, slow-moving paths, diagonal routing, fast movement, and tactical pop-up cover mechanics.


* **Armored Enemies & Toughness Tiers:** Multi-shot armored targets requiring specific damage thresholds before elimination, color-coded by durability (Yellow, Green, Blue, Violet).


* **Combo System:** Build multipliers up to $x5$ (or $x10$ with active perks) by maintaining hit streaks under tight combo timers.


* **Power-Up Perks:** Randomly spawning tactical perks providing Extra Lives, Time Bonuses, a 30-round Machine Gun, and 2X Multipliers.


* **Arcade Leaderboard:** Local storage-backed Top 10 leaderboard featuring classic 3-letter initial entry for high scorers.


* **Synthesized Audio Engine:** Built-in Web Audio API sound generator for gunshots, reloads, hits, and damage feedback without external asset dependencies.



---

## 🕹️ Controls

| Action | Desktop Control | Mobile / Touch Control |
| --- | --- | --- |
| **Aim & Shoot** | Mouse Click

 | Screen Tap

 |
| **Reload** | `SPACE` or `R` key

 | Dedicated **RELOAD** button

 |

---

## 📖 Arcade Manual & Rules

### Target Showcase

* **Standard Enemies (Exposed / Cover / Stationary):** Requires 1 shot (100 base points). Appear in static, moving, or cover pop-up patterns.


* **Armored Enemies:** Require multiple hits depending on toughness tier (Yellow: 2, Green: 3, Blue: 4, Violet: 5). Points are awarded upon full elimination ($100 \times \text{Toughness}$).


* **Hostages:** **DO NOT SHOOT!** Hitting a hostage results in a life penalty (-1 Life), score deduction (-250 PTS), wave reset, and combo break.



### Perk Showcase

* **Extra Life (♥):** Restores $+1$ Life (capped at 5 lives max).


* **Timer+ (⏱):** Adds $+5.0\text{s}$ to $+10.0\text{s}$ bonus time to the threat timer.


* **Machine Gun (⚡):** Equips a rapid-fire weapon loaded with 30 automatic rounds.


* **2X Multiplier (2X):** Activates a 10-second double score and doubled combo cap ($x10$) multiplier.



---

## 🛠️ Built With

* **HTML5 Canvas (`gameCanvas`):** High-performance rendering for game objects, obstacles, and bullet holes.


* **CSS3 & Flexbox (`style.css`):** Responsive arcade overlays, glowing neon UI containers, custom HUD positioning, and smooth modal transition animations.


* **Vanilla JavaScript (`game.js`):** Object-oriented game architecture implementing custom collision detection, billiards-style physics rebounds, state management, and Web Audio API integration.



---

## 🚀 Getting Started & Running Locally

To run the game locally on your machine, follow these simple steps:

1. Clone or download this repository to your local machine.
2. Ensure all three core files (`index.html`, `style.css`, and `game.js`) are placed together in the same directory.


3. Open `index.html` directly in any modern web browser, or serve it using a local development server (such as Live Server in VS Code or XAMPP).
