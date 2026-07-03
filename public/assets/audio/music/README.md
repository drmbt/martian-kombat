# Music

Drop `.mp3` files into a context folder, then run `npm run gen:music` to
refresh `manifest.json` (also runs automatically before `dev`/`build`) —
static hosting can't list directories, so the game only sees tracks in the
manifest. Playback lives in `src/audio/music.ts`.

| folder               | plays during                                                |
| -------------------- | ----------------------------------------------------------- |
| `menu/`              | title, main menu, and character select (one seamless loop)  |
| `versus/`            | VS screen: one random clip, once — its end starts the fight |
| `victory/`           | win-quote screen: one random track, once — its end returns  |
|                      | the game to character select (click/ENTER skips ahead)      |
| `stages/<stage-id>/` | that stage's fights; rotates to another random track        |
|                      | between rounds when the folder has several                  |
| `stages/default/`    | any stage whose own folder is empty                         |

Fatalities will be video cutscenes with baked-in audio — no music folder.

Multiple mp3s in a looping context: random pick per visit, shuffling to a
different track when one ends. One mp3: it loops. Empty folder: victory keeps
the stage music going; menu/versus/stages fade to silence.
