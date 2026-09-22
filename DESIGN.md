# Gun Shot (provisional title)

## Agreed direction

- Audience: children around 9–11; primarily touchscreen; solo.
- Genre: side-scrolling run-and-gun / action platformer.
- Look: vibrant, cartoonish, with the depth and rounded forms suggested by the Mario Wonder reference. Original character and environment artwork.
- Current build: placeholder pixel art and plain menus while gameplay is worked out (painted version in `archive/painted-v1/`).
- Hero: Ozo, a toucan standing on two legs.
- Aiming: shoot horizontally in the direction Ozo faces, including while running.
- Enemies: both melee and ranged; cartoon defeats.
- Rewards: enemies drop research for talents and gun coins for gun upgrades and new guns.
- Talents: examples include higher jumps, faster running, dash and glide. Every level must be traversable with the starting movement skills; upgrades can make it easier.
- Puzzles: switches, shooting targets, moving platforms and object puzzles are possibilities. The first level uses only one puzzle type.
- Death: Ozo stops moving, becomes black, and a heart appears in the middle and shatters. The player must restart the level.

## First playable: Canopy Coast

A jungle route that introduces one idea per stretch (move, jump, shoot, dodge, heal, break the wall), each with room to practise before it matters, then a clear destination. Six enemies alternate melee and ranged encounters. Repeatedly shooting the 12-health wall cracks it, removes upper stones at 8 and 4 health, then collapses it entirely at zero. It replaces the earlier sun-switch gate. Upgraded damage applies to both enemies and the wall.

Starting kit: three hearts, one Pop Blaster, a fixed-height jump, left/right movement and horizontal shooting. Defeated enemies drop three gun coins and one research crystal. A few optional ledge pickups reward exploration.

Snappers have 4 health and Spitters have 6, with visible health pips. Player and enemy shots pass through each other. Player shots travel 360 world pixels (540 with Long shot); enemy shots travel at most 600. Range is measured from the firing position, independent of Ozo's movement. Floating ledges are jump-through from below and solid on landing; the ground remains solid. Tutorial tips float in the sky instead of on signs. A heart pickup high above the wall area teaches healing. At the end Ozo hops into the birdhouse.

The Nest (upgrade shop) is available before a run and after defeat or completion. Its first version is a compact set of independent upgrades, rather than a branching talent tree:

| Upgrade | Cost | Effect |
| --- | --- | --- |
| Spring step | 4 research | Higher jump |
| Happy feet | 4 research | 15% faster run |
| Feather dash | 7 research | Short dash, with a cooldown |
| Easy breezy | 7 research | Hold jump while falling to glide |
| Pop power | 10 gun coins | Double shot damage |
| Long shot | 8 gun coins | 50% more projectile range, from 360 to 540 |
| Twin Pop | 16 gun coins | Buy and equip a two-shot burst blaster |

## Prototype assumptions to revisit after playtesting

- Loot picked up in a level is kept only if the level is completed. Purchases are always kept; level state resets on death.
- Progress is saved locally on the device, without accounts.
- Enemies disappear in a harmless puff and drop loot.
- One checkpoint, just past the wall. No timed challenges, extra lives or compulsory talent gates.
- Jump height depends on how long jump is held (a tap is a short hop that still clears every pit).
- Landscape is the preferred phone orientation. Desktop keyboard controls are included for convenient playtesting.
- Artwork and balancing are an initial pass. Next feedback should focus on thumb reach, Ozo's size, jump timing, enemy health, shot range and the wall's damage feedback.
