PUT YOUR MUSIC HERE
===================

Drop .mp3 or .ogg files into this folder, then list them in web/config.js:

    music: {
        files: [
            { src: 'audio/my-track.mp3',     title: 'My Track' },
            { src: 'audio/another-one.ogg',  title: 'Another One' },
        ]
    }

`src` is relative to the web/ folder, so a file sitting next to this README is
'audio/<filename>'. `title` is what shows in the now-playing card; leave it out
and the filename is used instead.

fxmanifest.lua already ships everything in this folder, so adding a track needs
no manifest edit - just the config line, a server restart and a reconnect.

Notes
-----
- Every connecting player downloads these files once, so keep them reasonably
  compressed. A 3-minute track at 128kbps is around 3MB; a whole album is not a
  good idea on a loading screen.
- Use music you're actually allowed to use on your server.
- This folder is also why YouTube isn't the answer here: a FiveM loading screen
  loads from nui://loadingscreen, which YouTube refuses to embed for (error
  153). Local files have no such restriction and always play.
