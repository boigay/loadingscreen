/* =============================================================================
   RAIN - falling dots on a canvas.

   Canvas rather than DOM nodes because a few hundred elements each running
   their own CSS animation is what makes loading screens chug on the machines
   that are already busy streaming the game in.

   Every dot is two pre-rendered sprites (a glow head and a soft trail) blitted
   with drawImage. Building a radial gradient per dot per frame is the usual
   way this gets written and it is an order of magnitude slower.
   ============================================================================= */

(function (global) {
    'use strict'

    var TAU = Math.PI * 2

    function clamp(v, lo, hi) {
        return v < lo ? lo : (v > hi ? hi : v)
    }

    function lerp(a, b, t) {
        return a + (b - a) * t
    }

    function hexToRgb(hex) {
        var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim())

        if (!m) return { r: 255, g: 255, b: 255 }

        return {
            r: parseInt(m[1], 16),
            g: parseInt(m[2], 16),
            b: parseInt(m[3], 16)
        }
    }

    /* The head of a dot: a filled centre fading to nothing at the edge, drawn
       once at a generous size and scaled down per dot. */
    function buildHeadSprite(rgb) {
        var size = 64
        var canvas = document.createElement('canvas')

        canvas.width = size
        canvas.height = size

        var ctx = canvas.getContext('2d')
        var half = size / 2
        var grad = ctx.createRadialGradient(half, half, 0, half, half, half)
        var base = rgb.r + ',' + rgb.g + ',' + rgb.b

        grad.addColorStop(0.00, 'rgba(' + base + ',1)')
        grad.addColorStop(0.22, 'rgba(' + base + ',0.85)')
        grad.addColorStop(0.50, 'rgba(' + base + ',0.25)')
        grad.addColorStop(1.00, 'rgba(' + base + ',0)')

        ctx.fillStyle = grad
        ctx.fillRect(0, 0, size, size)

        return canvas
    }

    /* The trail: a vertical strip, transparent at the top, solid at the bottom
       where it meets the head. Stretched to whatever length each dot wants. */
    function buildTrailSprite(rgb) {
        var w = 8
        var h = 128
        var canvas = document.createElement('canvas')

        canvas.width = w
        canvas.height = h

        var ctx = canvas.getContext('2d')
        var grad = ctx.createLinearGradient(0, 0, 0, h)
        var base = rgb.r + ',' + rgb.g + ',' + rgb.b

        grad.addColorStop(0.00, 'rgba(' + base + ',0)')
        grad.addColorStop(0.65, 'rgba(' + base + ',0.18)')
        grad.addColorStop(1.00, 'rgba(' + base + ',0.55)')

        ctx.fillStyle = grad
        ctx.fillRect(0, 0, w, h)

        // Taper the sides so the strip reads as a tail rather than a bar.
        ctx.globalCompositeOperation = 'destination-in'

        var side = ctx.createLinearGradient(0, 0, w, 0)

        side.addColorStop(0.0, 'rgba(0,0,0,0)')
        side.addColorStop(0.5, 'rgba(0,0,0,1)')
        side.addColorStop(1.0, 'rgba(0,0,0,0)')

        ctx.fillStyle = side
        ctx.fillRect(0, 0, w, h)

        return canvas
    }

    function Rain(canvas, options) {
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')
        this.drops = []
        this.sprites = []
        this.running = false
        this.lastFrame = 0
        this.width = 0
        this.height = 0

        this.configure(options || {})

        var self = this

        this.onResize = function () {
            self.resize()
        }

        this.tick = function (now) {
            self.frame(now)
        }
    }

    Rain.prototype.configure = function (options) {
        var opts = options || {}

        this.count = clamp(opts.count || 260, 0, 1200)
        this.speed = opts.speed == null ? 1 : opts.speed
        this.trail = opts.trail == null ? 0.45 : clamp(opts.trail, 0, 1)
        this.wind = opts.wind == null ? 1 : opts.wind
        this.accentChance = opts.accentChance == null ? 0.12 : clamp(opts.accentChance, 0, 1)

        var palette = (opts.colors && opts.colors.length ? opts.colors : ['#ffffff']).slice()

        // The accent goes in last so it keeps a known index, and gets weighted
        // by accentChance at spawn time rather than by how often it appears here.
        this.accentIndex = palette.length
        palette.push(opts.accent || '#ffffff')

        this.sprites = palette.map(function (color) {
            var rgb = hexToRgb(color)

            return {
                head: buildHeadSprite(rgb),
                trail: buildTrailSprite(rgb)
            }
        })
    }

    Rain.prototype.start = function () {
        if (this.running) return

        this.running = true
        this.resize()

        window.addEventListener('resize', this.onResize)

        this.lastFrame = 0
        requestAnimationFrame(this.tick)
    }

    Rain.prototype.stop = function () {
        this.running = false
        window.removeEventListener('resize', this.onResize)
    }

    Rain.prototype.resize = function () {
        // Cap the backing store at 2x. FiveM can hand us a 4K loading screen and
        // there is nothing in a field of soft dots that repays those pixels.
        var dpr = clamp(window.devicePixelRatio || 1, 1, 2)

        this.width = window.innerWidth
        this.height = window.innerHeight

        this.canvas.width = Math.floor(this.width * dpr)
        this.canvas.height = Math.floor(this.height * dpr)
        this.canvas.style.width = this.width + 'px'
        this.canvas.style.height = this.height + 'px'

        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        this.populate()
    }

    Rain.prototype.populate = function () {
        var drops = this.drops

        while (drops.length > this.count) {
            drops.pop()
        }

        while (drops.length < this.count) {
            drops.push(this.spawn(true))
        }

        // A resize can leave dots parked off the side of a narrower window.
        for (var i = 0; i < drops.length; i++) {
            if (drops[i].x > this.width) {
                drops[i].x = Math.random() * this.width
            }
        }
    }

    /* `scattered` seeds a dot anywhere on screen, for the first fill. Otherwise
       it comes in from just above the top edge. */
    Rain.prototype.spawn = function (scattered) {
        // Depth drives everything else, so near dots are consistently bigger,
        // faster, brighter and longer-tailed than far ones.
        var depth = Math.pow(Math.random(), 1.6)
        var useAccent = Math.random() < this.accentChance
        var spriteIndex = useAccent
            ? this.accentIndex
            : Math.floor(Math.random() * this.accentIndex)

        return {
            x: Math.random() * this.width,
            y: scattered ? Math.random() * this.height : -Math.random() * 120 - 20,
            depth: depth,
            radius: lerp(0.9, 3.4, depth),
            fall: lerp(34, 165, depth) * this.speed,
            alpha: lerp(0.16, 0.9, depth),
            sway: Math.random() * TAU,
            swaySpeed: lerp(0.25, 0.9, Math.random()),
            sprite: this.sprites[spriteIndex] || this.sprites[0]
        }
    }

    Rain.prototype.frame = function (now) {
        if (!this.running) return

        if (!this.lastFrame) {
            this.lastFrame = now
        }

        // Clamped so a stalled frame (resource streaming, alt-tab) doesn't
        // teleport every dot down the screen when we come back.
        var dt = Math.min((now - this.lastFrame) / 1000, 0.05)

        this.lastFrame = now

        this.draw(now, dt)

        requestAnimationFrame(this.tick)
    }

    Rain.prototype.draw = function (now, dt) {
        var ctx = this.ctx
        var w = this.width
        var h = this.height

        // Fully cleared, never painted over with a translucent fill - the video
        // is behind this canvas and a feedback-trail wash would grey it out.
        ctx.clearRect(0, 0, w, h)
        ctx.globalCompositeOperation = 'lighter'

        // One slow gust for the whole field, plus a faster ripple, so the drift
        // never settles into an obvious loop.
        var t = now * 0.001
        var gust = (Math.sin(t * 0.12) * 0.7 + Math.sin(t * 0.37) * 0.3) * 26 * this.wind

        for (var i = 0; i < this.drops.length; i++) {
            var d = this.drops[i]

            d.sway += d.swaySpeed * dt
            d.y += d.fall * dt
            d.x += (gust * d.depth + Math.sin(d.sway) * 6 * d.depth) * dt

            if (d.y - 40 > h) {
                this.drops[i] = this.spawn(false)
                continue
            }

            if (d.x < -40) d.x += w + 80
            else if (d.x > w + 40) d.x -= w + 80

            var head = d.radius * 4.5

            if (this.trail > 0) {
                var len = lerp(8, 46, d.depth) * this.trail
                var tw = d.radius * 2.6

                ctx.globalAlpha = d.alpha * 0.5
                ctx.drawImage(d.sprite.trail, d.x - tw / 2, d.y - len, tw, len)
            }

            ctx.globalAlpha = d.alpha
            ctx.drawImage(d.sprite.head, d.x - head / 2, d.y - head / 2, head, head)
        }

        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'source-over'
    }

    global.Rain = Rain
})(window)
