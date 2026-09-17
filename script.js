/* =============================================================================
   LOADING SCREEN

   Everything you'd normally want to change lives in config.js. This file wires
   that config to the music player, the rain canvas and the load events FiveM
   sends down while the game streams in.

   TWO MUSIC BACKENDS. YouTube is tried first; local files take over on their
   own if it fails. That fallback earns its place: served from inside the
   resource this page's origin is nui://<resource>, which isn't a web origin, so
   YouTube refuses the embed with error 153 whatever video is configured.

   Hosting the page at a real https address and pointing `loadscreen` at that
   URL fixes it - absolute URLs do work there, confirmed by testing, despite the
   docs only documenting them for `ui_page`. Same code either way; the fallback
   simply never fires once the origin is real.

   The player is started once and never touched by load progress, so the music
   doesn't restart as the bar moves.
   ============================================================================= */

(function () {
    'use strict'

    /* =====================================================================
       CONFIG
       ===================================================================== */

    var RAW = window.LoadingConfig || {}
    var MUSIC = RAW.music || {}

    function pick(value, fallback) {
        return value === undefined || value === null ? fallback : value
    }

    /* Accepts anything someone is likely to paste: a watch link, a share link,
       a /shorts/ or /embed/ link, or the bare 11-character ID. Returns null for
       anything it can't find an ID in, so one bad entry doesn't kill the list. */
    function parseVideo(entry) {
        var raw = typeof entry === 'string' ? entry : (entry && (entry.url || entry.id)) || ''
        var text = String(raw).trim()

        if (!text) return null

        var id = null

        if (/^[\w-]{11}$/.test(text)) {
            id = text
        } else {
            var m = text.match(/[?&]v=([\w-]{11})/) ||
                    text.match(/youtu\.be\/([\w-]{11})/) ||
                    text.match(/\/(?:embed|shorts|v|live)\/([\w-]{11})/)

            if (m) id = m[1]
        }

        if (!id) return null

        var start = 0

        if (entry && typeof entry.start === 'number') {
            start = Math.max(0, Math.floor(entry.start))
        } else {
            // ?t= comes as either plain seconds or the 1h2m3s form.
            var plain = text.match(/[?&](?:t|start)=(\d+)s?(?:&|$)/)

            if (plain) {
                start = parseInt(plain[1], 10)
            } else {
                var hms = text.match(/[?&]t=(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/)

                if (hms && (hms[1] || hms[2] || hms[3])) {
                    start = (parseInt(hms[1] || 0, 10) * 3600) +
                            (parseInt(hms[2] || 0, 10) * 60) +
                            parseInt(hms[3] || 0, 10)
                }
            }
        }

        return { id: id, start: start, title: (entry && entry.title) || '' }
    }

    function parseFile(entry) {
        var src = typeof entry === 'string' ? entry : (entry && entry.src) || ''

        src = String(src).trim()

        if (!src) return null

        // Fall back to the filename so an untitled track still reads as something.
        var title = (entry && entry.title) ||
            src.split('/').pop().replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')

        return { src: src, title: title }
    }

    var CFG = {
        serverName: pick(RAW.serverName, 'FiveM Server'),
        tagline: pick(RAW.tagline, ''),
        showLogo: pick(RAW.showLogo, true),
        accent: pick(RAW.accent, '#F43F5E'),

        mode: pick(MUSIC.mode, 'background'),
        volume: Math.round(Math.min(Math.max(pick(MUSIC.volume, 30), 0), 100)),
        startMuted: pick(MUSIC.startMuted, false),
        loop: pick(MUSIC.loop, true),
        shuffle: pick(MUSIC.shuffle, true),
        showControls: pick(MUSIC.showControls, true),
        allowSkip: pick(MUSIC.allowSkip, true),
        videoOpacity: pick(MUSIC.videoOpacity, 0.55),
        videoZoom: pick(MUSIC.videoZoom, 1.04),

        videos: (MUSIC.youtube || []).map(parseVideo).filter(Boolean),
        videosConfigured: (MUSIC.youtube || []).length,
        files: (MUSIC.files || []).map(parseFile).filter(Boolean),

        rain: RAW.rain || {},
        tips: RAW.tips || [],
        tipRotateSeconds: pick(RAW.tipRotateSeconds, 7)
    }

    /* =====================================================================
       SMALL HELPERS
       ===================================================================== */

    function $(id) {
        return document.getElementById(id)
    }

    function hexToRgb(hex) {
        var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim())

        if (!m) return { r: 244, g: 63, b: 94 }

        return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    }

    function rgba(hex, alpha) {
        var c = hexToRgb(hex)

        return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')'
    }

    // The bright end of the progress bar, derived from the accent rather than
    // hardcoded, so one hex in config.js really is the whole theme.
    function lighten(hex, amount) {
        var c = hexToRgb(hex)

        return 'rgb(' +
            Math.round(c.r + (255 - c.r) * amount) + ',' +
            Math.round(c.g + (255 - c.g) * amount) + ',' +
            Math.round(c.b + (255 - c.b) * amount) + ')'
    }

    function shuffled(list) {
        var out = list.slice()

        for (var i = out.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1))
            var tmp = out[i]

            out[i] = out[j]
            out[j] = tmp
        }

        return out
    }

    // localStorage is per-player and can throw outright in some CEF states, so
    // every read has to survive coming back empty.
    var Store = {
        get: function (key, fallback) {
            try {
                var v = window.localStorage.getItem('ls_' + key)

                return v === null ? fallback : v
            } catch (e) {
                return fallback
            }
        },
        set: function (key, value) {
            try {
                window.localStorage.setItem('ls_' + key, String(value))
            } catch (e) { /* private mode, blocked site data - not worth caring */ }
        }
    }

    var el = {}

    function cacheElements() {
        var ids = [
            'rainCanvas', 'brandLogo', 'serverName', 'serverTagline',
            'tipCard', 'tipText', 'loadPhase', 'loadPercent', 'loadLog', 'progressFill',
            'videoFrame', 'playerCard', 'playerTitle', 'playerSource', 'eq',
            'playBtn', 'prevBtn', 'nextBtn', 'muteBtn', 'volume', 'trackCount',
            'enableSound', 'setupNotice', 'setupTitle', 'setupBody'
        ]

        ids.forEach(function (id) {
            el[id] = $(id)
        })
    }

    /* =====================================================================
       THEME + BRANDING
       ===================================================================== */

    function applyTheme() {
        var root = document.documentElement.style

        root.setProperty('--accent', CFG.accent)
        root.setProperty('--accent-bright', lighten(CFG.accent, 0.55))
        root.setProperty('--accent-soft', rgba(CFG.accent, 0.16))
        root.setProperty('--accent-line', rgba(CFG.accent, 0.34))
        root.setProperty('--video-opacity', String(CFG.videoOpacity))
        root.setProperty('--video-zoom', String(CFG.videoZoom))

        el.serverName.textContent = CFG.serverName
        el.serverTagline.textContent = CFG.tagline

        if (!CFG.showLogo) el.brandLogo.hidden = true

        // A missing or renamed logo.png shouldn't leave a broken-image icon.
        el.brandLogo.addEventListener('error', function () {
            el.brandLogo.hidden = true
        })
    }

    function showSetupNotice(title, body) {
        el.setupTitle.textContent = title
        el.setupBody.innerHTML = body
        el.setupNotice.hidden = false
    }

    function hideSetupNotice() {
        el.setupNotice.hidden = true
    }

    /* =====================================================================
       RAIN
       ===================================================================== */

    var rain = null

    function startRain() {
        if (CFG.rain.enabled === false || typeof window.Rain !== 'function') return

        var options = {}

        Object.keys(CFG.rain).forEach(function (k) {
            options[k] = CFG.rain[k]
        })

        options.accent = CFG.accent

        rain = new window.Rain(el.rainCanvas, options)
        rain.start()
    }

    /* =====================================================================
       MUSIC
       ===================================================================== */

    // YouTube's own codes. Worth surfacing verbatim: "private, deleted or
    // blocked" is only one of several reasons a video won't start, and guessing
    // wrong sends you looking in the wrong place.
    function describeYouTubeError(code) {
        switch (code) {
            case 2:   return 'error 2 — that video ID is malformed'
            case 5:   return 'error 5 — the player could not start the video'
            case 100: return 'error 100 — the video was removed or is private'
            case 101:
            case 150: return 'error ' + code + ' — the uploader has embedding turned off'
            case 153: return 'error 153 — YouTube refused the embed for this page'
            default:  return 'error ' + code
        }
    }

    var Music = {
        kind: null,          // 'youtube' | 'audio', once something is actually running
        yt: null,
        audio: null,
        order: [],
        index: 0,
        volume: CFG.volume,
        muted: CFG.startMuted,
        started: false,
        ytErrors: 0,
        lastYtError: null,
        gaveUpOnYouTube: false,

        init: function () {
            var storedVolume = parseInt(Store.get('volume', CFG.volume), 10)

            if (!isNaN(storedVolume)) this.volume = storedVolume
            if (Store.get('muted', null) === '1') this.muted = true

            el.volume.value = this.volume
            setMutedUI(this.muted)

            if (CFG.videos.length) {
                this.startYouTube()
            } else if (CFG.files.length) {
                this.startAudio()
            } else {
                showSetupNotice(
                    'No music configured',
                    CFG.videosConfigured
                        ? 'None of the entries in <code>youtube</code> had a usable video ID. Check <code>web/config.js</code>.'
                        : 'Drop audio into <code>web/audio/</code> and list it under <code>music.files</code> in <code>web/config.js</code>.'
                )
            }
        },

        /* ---------------- YouTube ---------------- */

        startYouTube: function () {
            var self = this

            this.order = CFG.shuffle
                ? shuffled(CFG.videos.map(function (_, i) { return i }))
                : CFG.videos.map(function (_, i) { return i })

            if (window.YT && window.YT.Player) {
                this.createYouTube()
                return
            }

            window.onYouTubeIframeAPIReady = function () {
                self.createYouTube()
            }

            var tag = document.createElement('script')

            tag.src = 'https://www.youtube.com/iframe_api'
            tag.onerror = function () {
                self.giveUpOnYouTube('the YouTube player script could not be loaded')
            }

            document.head.appendChild(tag)

            // onerror doesn't fire for every way this can fail (no route out,
            // DNS black hole), so time it out as well.
            setTimeout(function () {
                if (!self.yt) self.giveUpOnYouTube('YouTube did not respond')
            }, 9000)
        },

        createYouTube: function () {
            if (this.gaveUpOnYouTube) return

            var first = CFG.videos[this.order[0]]
            var self = this

            if (CFG.mode === 'audio') el.videoFrame.classList.add('audio-only')

            this.yt = new window.YT.Player('ytPlayer', {
                host: 'https://www.youtube-nocookie.com',
                videoId: first.id,
                playerVars: {
                    autoplay: 1,
                    controls: 0,
                    disablekb: 1,
                    fs: 0,
                    rel: 0,
                    modestbranding: 1,
                    iv_load_policy: 3,
                    playsinline: 1,
                    start: first.start || 0,
                    // Always start muted. Unmuted autoplay is the one thing a
                    // browser will refuse outright; onReady unmutes right after.
                    mute: 1
                },
                events: {
                    onReady: function () { self.onYouTubeReady() },
                    onStateChange: function (e) { self.onYouTubeState(e) },
                    onError: function (e) { self.onYouTubeError(e) }
                }
            })

            this.setTrackLabel(CFG.videos.length)
        },

        onYouTubeReady: function () {
            this.kind = 'youtube'
            this.applyVolume()
            this.call('playVideo')

            var self = this

            setTimeout(function () { self.verifyYouTube() }, 1600)
        },

        // Autoplay can still be refused, and unMute() can be quietly ignored.
        // Rather than assume it worked, check.
        verifyYouTube: function () {
            if (this.kind !== 'youtube') return

            var state = this.call('getPlayerState')
            var playing = state === window.YT.PlayerState.PLAYING ||
                          state === window.YT.PlayerState.BUFFERING

            if (!playing) {
                this.call('mute')
                this.muted = true
                setMutedUI(true)
                this.call('playVideo')
                showEnableSound()
            } else if (!this.muted && this.call('isMuted') === true) {
                this.muted = true
                setMutedUI(true)
                showEnableSound()
            }
        },

        onYouTubeState: function (e) {
            var S = window.YT.PlayerState

            if (e.data === S.PLAYING) {
                this.ytErrors = 0
                this.onPlaying(this.call('getVideoData'))
            } else if (e.data === S.ENDED) {
                this.next()
            }

            setPlayingUI(e.data === S.PLAYING)
        },

        onYouTubeError: function (e) {
            this.ytErrors++
            this.lastYtError = e && e.data

            if (this.ytErrors >= this.order.length) {
                this.giveUpOnYouTube(describeYouTubeError(this.lastYtError))
                return
            }

            var self = this

            setTimeout(function () { self.next() }, 400)
        },

        /* Hands over to local audio. The message only surfaces when there is no
           local audio to hand over to - if there is, the player just hears music
           and never needs to know YouTube was tried first. */
        giveUpOnYouTube: function (reason) {
            if (this.gaveUpOnYouTube || this.kind === 'audio') return

            this.gaveUpOnYouTube = true

            try {
                if (this.yt && this.yt.destroy) this.yt.destroy()
            } catch (err) { /* already gone */ }

            this.yt = null
            el.videoFrame.classList.remove('visible')

            if (CFG.files.length) {
                this.startAudio()
                return
            }

            var origin = window.location.origin || 'an unknown origin'
            var detail = this.lastYtError === 153
                ? ' This page loads from <code>' + origin + '</code>, which YouTube will not embed for. ' +
                  'Put audio in <code>web/audio/</code> and list it under <code>music.files</code> instead.'
                : ' Put audio in <code>web/audio/</code> and list it under <code>music.files</code> instead.'

            showSetupNotice('YouTube could not play', 'YouTube returned <strong>' + reason + '</strong>.' + detail)
        },

        /* ---------------- local audio ---------------- */

        startAudio: function () {
            var self = this

            this.kind = 'audio'
            this.order = CFG.shuffle
                ? shuffled(CFG.files.map(function (_, i) { return i }))
                : CFG.files.map(function (_, i) { return i })
            this.index = 0

            this.audio = new Audio()
            this.audio.preload = 'auto'

            this.audio.addEventListener('ended', function () {
                self.next()
            })

            // A missing or misnamed file shouldn't stop the rest of the list.
            this.audio.addEventListener('error', function () {
                self.onAudioError()
            })

            this.audio.addEventListener('playing', function () {
                self.audioErrors = 0
                self.onPlaying({ title: CFG.files[self.order[self.index]].title })
                setPlayingUI(true)
            })

            this.audio.addEventListener('pause', function () {
                setPlayingUI(false)
            })

            this.audioErrors = 0
            this.setTrackLabel(CFG.files.length)
            this.loadAudioIndex(0)
        },

        loadAudioIndex: function (i) {
            var count = this.order.length

            if (!count) return

            this.index = ((i % count) + count) % count

            var track = CFG.files[this.order[this.index]]

            el.playerTitle.textContent = track.title
            this.setTrackLabel(count)

            this.audio.src = track.src
            this.applyVolume()
            this.playAudio()
        },

        playAudio: function () {
            var self = this
            var attempt = this.audio.play()

            // play() rejects when autoplay-with-sound is refused. Muted playback
            // is always allowed, so drop to that and offer the button.
            if (attempt && typeof attempt.catch === 'function') {
                attempt.catch(function () {
                    self.audio.muted = true
                    self.muted = true
                    setMutedUI(true)
                    showEnableSound()
                    self.audio.play().catch(function () { /* nothing more to try */ })
                })
            }
        },

        onAudioError: function () {
            this.audioErrors = (this.audioErrors || 0) + 1

            if (this.audioErrors >= this.order.length) {
                el.playerCard.hidden = true
                showSetupNotice(
                    'None of those audio files would play',
                    'Check the paths under <code>music.files</code> in <code>web/config.js</code> ' +
                    'and that the files are in <code>web/audio/</code>.'
                )
                return
            }

            var self = this

            setTimeout(function () { self.next() }, 300)
        },

        /* ---------------- shared controls ---------------- */

        call: function (method, arg) {
            try {
                if (this.yt && typeof this.yt[method] === 'function') {
                    return arg === undefined ? this.yt[method]() : this.yt[method](arg)
                }
            } catch (e) { /* player not in a state to answer */ }

            return null
        },

        onPlaying: function (data) {
            if (!this.started) {
                this.started = true
                hideSetupNotice()

                if (CFG.showControls) el.playerCard.hidden = false
                if (this.kind === 'youtube' && CFG.mode === 'background') {
                    el.videoFrame.classList.add('visible')
                }
            }

            if (data && data.title) el.playerTitle.textContent = data.title
        },

        setTrackLabel: function (count) {
            el.trackCount.textContent = count > 1 ? (this.index + 1) + '/' + count : ''
        },

        isPlaying: function () {
            if (this.kind === 'youtube') {
                return this.call('getPlayerState') === window.YT.PlayerState.PLAYING
            }

            return !!(this.audio && !this.audio.paused)
        },

        play: function () {
            if (this.kind === 'youtube') this.call('playVideo')
            else if (this.audio) this.playAudio()
        },

        pause: function () {
            if (this.kind === 'youtube') this.call('pauseVideo')
            else if (this.audio) this.audio.pause()
        },

        toggle: function () {
            if (this.isPlaying()) this.pause()
            else this.play()
        },

        next: function () { this.go(this.index + 1) },
        prev: function () { this.go(this.index - 1) },

        go: function (i) {
            var count = this.order.length

            if (!count) return

            // With loop off, running past the end stops rather than wrapping.
            if (!CFG.loop && (i < 0 || i >= count)) {
                this.pause()
                return
            }

            if (this.kind === 'youtube') {
                this.index = ((i % count) + count) % count

                var video = CFG.videos[this.order[this.index]]

                el.playerTitle.textContent = video.title || 'Loading…'
                this.setTrackLabel(count)
                this.call('loadVideoById', { videoId: video.id, startSeconds: video.start || 0 })
                this.applyVolume()   // loadVideoById can reset mute state
            } else {
                this.loadAudioIndex(i)
            }
        },

        applyVolume: function () {
            if (this.kind === 'youtube') {
                this.call('setVolume', this.volume)

                if (this.muted) this.call('mute')
                else this.call('unMute')
            } else if (this.audio) {
                this.audio.volume = this.volume / 100
                this.audio.muted = this.muted
            }
        },

        setVolume: function (value) {
            this.volume = Math.min(Math.max(Math.round(value), 0), 100)
            Store.set('volume', this.volume)

            // Nudging the slider off zero should turn the sound back on.
            if (this.volume > 0 && this.muted) {
                this.muted = false
                Store.set('muted', '0')
                setMutedUI(false)
                hideEnableSound()
            }

            el.volume.value = this.volume
            this.applyVolume()
        },

        setMuted: function (muted) {
            this.muted = !!muted
            Store.set('muted', this.muted ? '1' : '0')
            setMutedUI(this.muted)

            if (!this.muted) {
                hideEnableSound()

                if (this.volume === 0) {
                    this.setVolume(25)
                    return
                }
            }

            this.applyVolume()
        },

        toggleMute: function () {
            this.setMuted(!this.muted)
        },

        // Called by the "click to enable music" button: unmute and make sure
        // something is actually playing, since autoplay may have been refused
        // outright rather than merely muted.
        enableSound: function () {
            this.setMuted(false)
            this.play()
            hideEnableSound()
        },

        fadeOutAndStop: function (ms) {
            var self = this
            var steps = 24
            var step = 0
            var from = this.volume

            if (!this.kind) return

            var timer = setInterval(function () {
                step++

                var v = Math.max(0, Math.round(from * (1 - step / steps)))

                if (self.kind === 'youtube') self.call('setVolume', v)
                else if (self.audio) self.audio.volume = v / 100

                if (step >= steps) {
                    clearInterval(timer)
                    self.pause()
                }
            }, Math.max(20, ms / steps))
        }
    }

    /* =====================================================================
       PLAYER UI
       ===================================================================== */

    function setPlayingUI(playing) {
        el.eq.classList.toggle('playing', !!playing)
        el.playBtn.classList.toggle('playing', !!playing)
    }

    function setMutedUI(muted) {
        el.muteBtn.classList.toggle('muted', !!muted)
        el.muteBtn.title = muted ? 'Unmute (M)' : 'Mute (M)'
    }

    function showEnableSound() {
        el.enableSound.hidden = false
    }

    function hideEnableSound() {
        el.enableSound.hidden = true
    }

    function wireControls() {
        if (!CFG.allowSkip) {
            el.prevBtn.hidden = true
            el.nextBtn.hidden = true
        }

        el.playBtn.addEventListener('click', function () { Music.toggle() })
        el.prevBtn.addEventListener('click', function () { Music.prev() })
        el.nextBtn.addEventListener('click', function () { Music.next() })
        el.muteBtn.addEventListener('click', function () { Music.toggleMute() })
        el.enableSound.addEventListener('click', function () { Music.enableSound() })

        el.volume.addEventListener('input', function () {
            Music.setVolume(parseInt(el.volume.value, 10) || 0)
        })

        document.addEventListener('keydown', function (e) {
            if (!Music.kind) return

            var key = e.key

            if (key === 'm' || key === 'M') {
                Music.toggleMute()
            } else if (key === ' ' || key === 'Spacebar') {
                e.preventDefault()
                Music.toggle()
            } else if (key === 'ArrowRight' && CFG.allowSkip) {
                Music.next()
            } else if (key === 'ArrowLeft' && CFG.allowSkip) {
                Music.prev()
            } else if (key === 'ArrowUp') {
                e.preventDefault()
                Music.setVolume(Music.volume + 5)
            } else if (key === 'ArrowDown') {
                e.preventDefault()
                Music.setVolume(Music.volume - 5)
            }
        })
    }

    /* =====================================================================
       TIPS
       ===================================================================== */

    var tipIndex = 0

    function startTips() {
        if (!CFG.tips.length) {
            el.tipCard.hidden = true
            return
        }

        tipIndex = Math.floor(Math.random() * CFG.tips.length)
        el.tipText.textContent = CFG.tips[tipIndex]

        if (CFG.tips.length < 2) return

        setInterval(function () {
            el.tipText.classList.add('fading')

            setTimeout(function () {
                tipIndex = (tipIndex + 1) % CFG.tips.length
                el.tipText.textContent = CFG.tips[tipIndex]
                el.tipText.classList.remove('fading')
            }, 450)
        }, Math.max(2, CFG.tipRotateSeconds) * 1000)
    }

    /* =====================================================================
       LOAD PROGRESS

       FiveM sends these while it streams the game in. The phase label comes from
       the real events where there is one, and only falls back to a progress
       guess before the first of them arrives. Nothing here touches the music.
       ===================================================================== */

    var PHASE_LABELS = {
        INIT_CORE: 'Starting up',
        INIT_BEFORE_MAP_LOADED: 'Preparing world',
        INIT_AFTER_MAP_LOADED: 'Building world',
        INIT_SESSION: 'Joining session'
    }

    var displayed = 0
    var target = 0
    var animating = false
    var reportedPhase = null
    var finished = false

    function fallbackPhase(percent) {
        if (percent < 12) return 'Connecting'
        if (percent < 45) return 'Downloading resources'
        if (percent < 78) return 'Loading world'
        if (percent < 100) return 'Almost ready'

        return 'Ready'
    }

    function setPhase(label) {
        reportedPhase = label
        el.loadPhase.textContent = label
    }

    function setLog(text) {
        var line = String(text || '').trim()

        el.loadLog.textContent = line.length > 110 ? line.slice(0, 110) + '…' : line
    }

    function animate() {
        var delta = target - displayed

        if (Math.abs(delta) < 0.05) {
            displayed = target
            animating = false
        } else {
            displayed += delta * 0.12
        }

        var shown = Math.min(Math.floor(displayed), 100)

        el.progressFill.style.width = shown + '%'
        el.progressFill.classList.toggle('started', shown > 0)
        el.loadPercent.innerHTML = shown + '<i>%</i>'

        if (!reportedPhase || shown >= 100) {
            el.loadPhase.textContent = shown >= 100 ? 'Ready' : fallbackPhase(shown)
        }

        if (animating) requestAnimationFrame(animate)
    }

    function setProgress(percent) {
        target = Math.min(Math.max(percent, 0), 100)

        if (!animating) {
            animating = true
            requestAnimationFrame(animate)
        }
    }

    function complete() {
        if (finished) return

        finished = true

        el.loadPhase.textContent = 'Ready'
        setLog('')
        hideEnableSound()

        // The Lua side waits 2.5s after this before tearing the NUI down, which
        // is the window the fade below has to finish in.
        if (typeof GetParentResourceName === 'function') {
            try {
                fetch('https://' + GetParentResourceName() + '/loadingComplete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: '{}'
                }).catch(function () {})
            } catch (e) { /* NUI not answering - FiveM closes the screen itself */ }
        }

        Music.fadeOutAndStop(1500)

        setTimeout(function () {
            document.body.classList.add('finished')
        }, 200)

        setTimeout(function () {
            if (rain) rain.stop()
        }, 1900)
    }

    function onGameMessage(event) {
        var data = event.data

        if (!data || typeof data !== 'object') return

        switch (data.eventName) {
            case 'loadProgress':
                if (typeof data.loadFraction !== 'number') return

                setProgress(data.loadFraction * 100)

                if (data.loadFraction >= 1) complete()
                break

            case 'startInitFunction':
                setPhase(PHASE_LABELS[data.type] || 'Loading')
                break

            case 'startDataFileEntries':
                setPhase('Mounting resources')
                break

            case 'onDataFileEntry':
                if (data.name) setLog(data.name)
                break

            case 'performMapLoadFunction':
                setPhase('Loading map')
                break

            case 'initFunctionInvoking':
                if (data.name) setLog(data.name)
                break

            case 'onLogLine':
                if (data.message) setLog(data.message)
                break

            case 'endInitFunction':
                setPhase('Finishing up')
                break
        }
    }

    /* =====================================================================
       BOOT
       ===================================================================== */

    function boot() {
        cacheElements()
        applyTheme()
        startRain()
        startTips()
        wireControls()
        Music.init()

        window.addEventListener('message', onGameMessage)

        requestAnimationFrame(animate)
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot)
    } else {
        boot()
    }
})()
