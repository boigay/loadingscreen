fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'loadingscreen'
description 'Loading screen with music (local audio + YouTube), animated rain and real load progress.'
version '3.0.0'

-- Rewritten web UI. Derived from esx_loadingscreen (GPL-3.0) - see LICENSE.

loadscreen 'web/index.html'
loadscreen_manual_shutdown 'yes'

-- Without this the player has no cursor on the loading screen, and the
-- play/skip/volume controls can't be clicked.
loadscreen_cursor 'yes'

client_script 'client/main.lua'

files {
    'web/index.html',
    'web/style.css',
    'web/config.js',
    'web/rain.js',
    'web/script.js',
    'web/logo.png',

    -- Anything dropped in web/audio/ ships automatically - no manifest edit
    -- needed when you add a track.
    'web/audio/*.mp3',
    'web/audio/*.ogg'
}
