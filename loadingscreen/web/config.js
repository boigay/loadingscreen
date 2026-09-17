/* =============================================================================
   LOADING SCREEN CONFIG

   This is the only file you need to edit. Change it, then restart the server
   and reconnect.
   ============================================================================= */

window.LoadingConfig = {

    /* ---------------------------------------------------------------------
       BRANDING
       --------------------------------------------------------------------- */
    serverName: 'Sinners District RP',
    tagline: 'Semi-Serious Roleplay',

    // web/logo.png is still the stock ESX logo, so this starts off. Drop your
    // own logo.png in next to this file and flip it to true.
    showLogo: false,

    // One color drives the whole theme: progress bar, percentage, tip label,
    // the accent raindrops and the background glow.
    // Other options: '#38BDF8' blue  '#A78BFA' violet  '#34D399' green  '#E8EDF5' white
    accent: '#F43F5E',

    /* ---------------------------------------------------------------------
       MUSIC

       Two sources. YouTube is tried first; if it won't play, local files take
       over automatically.

       READ THIS ABOUT YOUTUBE: it does not work while this page is served from
       inside the resource. The origin is then nui://loadingscreen, which isn't
       a real web origin, so YouTube refuses the embed with error 153 whatever
       video you pick.

       It DOES work when the page is hosted at a real https address and
       fxmanifest.lua points `loadscreen` at that URL - tested and confirmed,
       even though the official docs only mention absolute URLs for `ui_page`.
       See hosted-build/ next to the server folder.

       Served locally, `files` is what plays. Drop audio into web/audio/.
       --------------------------------------------------------------------- */
    music: {

        // 'background' - YouTube plays as the full-screen background video
        // 'audio'      - YouTube stays hidden, sound only
        // Local files are always audio-only.
        mode: 'background',

        volume: 30,            // 0-100, remembered per player after they change it
        startMuted: false,
        loop: true,            // restart the list when it reaches the end
        shuffle: true,         // random order each time someone connects
        showControls: true,    // the now-playing card, bottom right
        allowSkip: true,       // lets players skip tracks

        videoOpacity: 0.55,    // 0-1. Lower = darker, easier to read the text over
        videoZoom: 1.04,       // slight overscan so you never see a black edge

        // Full links or bare IDs both work:
        //   'https://www.youtube.com/watch?v=XXXXXXXXXXX'
        //   'https://youtu.be/XXXXXXXXXXX?t=45'
        //   'XXXXXXXXXXX'
        youtube: [
            'https://www.youtube.com/watch?v=5ragHahZ_5M'
        ],

        // Local audio shipped inside the resource - .mp3 or .ogg.
        // Put the files in web/audio/ and list them here:
        //   { src: 'audio/my-track.mp3', title: 'My Track' }
        // fxmanifest.lua already ships everything in that folder.
        files: [
            // { src: 'audio/track-01.mp3', title: 'Track One' },
            // { src: 'audio/track-02.mp3', title: 'Track Two' },
        ]
    },

    /* ---------------------------------------------------------------------
       RAIN

       The dots falling down the screen. `count` is the only one worth
       touching if you're on a weak PC - everything scales off it.
       --------------------------------------------------------------------- */
    rain: {
        enabled: true,
        count: 260,            // how many dots on screen at once
        speed: 1.0,            // 1 = normal, 0.5 = drifting, 2 = downpour
        trail: 0.45,           // 0 = bare dots, 1 = long comet tails
        wind: 1.0,             // sideways drift
        accentChance: 0.12,    // how many dots pick up your accent color
        colors: [              // the rest of the dots, picked at random
            '#ffffff',
            '#cfe4ff',
            '#9fb6d4'
        ]
    },

    /* ---------------------------------------------------------------------
       TIPS - rotate in the card, top right. Empty list hides the card.
       --------------------------------------------------------------------- */
    tipRotateSeconds: 7,
    tips: [
        'Stay in character during RP situations.',
        'No RDM or VDM.',
        'Do not metagame.',
        'Value your character\'s life.',
        'Use /report if you need staff assistance.'
    ]
}
