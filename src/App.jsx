import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import * as THREE from 'three'
import HeroScene from './scene/HeroScene.jsx'
import { createScrollTimeline, prefersReducedMotion } from './scene/pose.js'
import { MODELS } from './watch/models.js'

// The dials are drawn on a canvas, so the font has to be loaded before they are painted.
function useDialFont() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let live = true
    Promise.allSettled([
      document.fonts.load('800 100px "Bodoni Moda Variable"'),
      document.fonts.load('500 100px "Hanken Grotesk Variable"'),
    ]).then(() => live && setReady(true))
    return () => {
      live = false
    }
  }, [])
  return ready
}

// Connects page scroll to the watch. Smooth scrolling stays off for reduced motion.
function useScrollShot(track) {
  useLayoutEffect(() => {
    const timeline = createScrollTimeline(track.current)
    if (prefersReducedMotion()) {
      return () => {
        timeline.scrollTrigger?.kill()
        timeline.kill()
      }
    }

    const lenis = new Lenis({ lerp: 0.09, anchors: true })
    const tick = (time) => lenis.raf(time * 1000)
    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
      timeline.scrollTrigger?.kill()
      timeline.kill()
    }
  }, [track])
}

const STORY = [
  {
    id: 'dial',
    title: 'Three sectors, one dial',
    body: 'Hours, minutes and the centre each sit on their own tone, so the time reads at a glance.',
  },
  {
    id: 'seconds',
    title: 'Seconds of their own',
    body: 'A small seconds dial sits below the surface, cut with fine circular grooves. Its hand moves in six small beats a second.',
  },
  {
    id: 'crown',
    title: 'Made to be turned',
    body: 'The fluted crown gives your fingers something to grip when you wind and set the watch.',
  },
  {
    id: 'layers',
    title: 'Seven layers, one case',
    body: 'Taken apart, you can see how it all fits together, from the domed crystal down to the case back.',
  },
  {
    id: 'whole',
    title: 'Now choose yours',
    body: 'Every part is back in place. Keep scrolling to see all four watches.',
  },
]

const PARTS = [
  ['crystal', 'Domed crystal'],
  ['bezel', 'Polished bezel'],
  ['hands', 'Hands'],
  ['dial', 'Dial'],
  ['movement', 'Movement'],
  ['case', 'Case'],
  ['back', 'Case back'],
]

function Product({ model, onAdd, first }) {
  const [justAdded, setJustAdded] = useState(false)
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])

  const add = () => {
    onAdd(model)
    setJustAdded(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setJustAdded(false), 2200)
  }

  return (
    <section id={first ? 'collection' : model.id} className="chapter chapter-product">
      <div className="caption caption-product">
        <h2>{model.name}</h2>
        <p>{model.description}</p>
        <p className="price">{model.price}</p>
        <button type="button" className="action" onClick={add}>
          {justAdded ? 'Added to bag' : 'Add to bag'}
        </button>
      </div>
    </section>
  )
}

export default function App() {
  const fontReady = useDialFont()
  const track = useRef(null)
  const [bag, setBag] = useState(0)
  useScrollShot(track)

  return (
    <>
      <h1 className="display-title">
        <span>Four</span> <span>watches</span>
      </h1>

      <div className="stage">
        <Canvas
          aria-label="A watch floating in darkness. It turns, comes apart and changes to each watch in the collection as you scroll."
          role="img"
          style={{ pointerEvents: 'none' }}
          shadows="percentage"
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 11], fov: 26, near: 0.5, far: 60 }}
          gl={{
            alpha: true,
            antialias: true,
            toneMapping: THREE.NeutralToneMapping,
            toneMappingExposure: 1,
          }}
          fallback={
            <p className="no-webgl">
              This view needs WebGL. Turn on hardware acceleration in your browser to see the watches.
            </p>
          }
        >
          {fontReady && <HeroScene />}
        </Canvas>
        {PARTS.map(([id, name]) => (
          <div key={id} id={`part-${id}`} className="part-label">
            {name}
          </div>
        ))}
      </div>

      <header className="site-header">
        <a className="wordmark" href="#top">
          Halden
        </a>
        <nav aria-label="Main">
          <a href="#dial">How it's made</a>
          <a href="#collection">Collection</a>
          <span aria-live="polite">Bag ({bag})</span>
        </nav>
      </header>

      <main ref={track} className="track">
        <section id="top" className="chapter chapter-hero">
          <div className="caption caption-hero">
            <p>Four 38 mm watches, from $1,450. See how they are made, then choose yours.</p>
            <a className="action" href="#collection">
              Shop the collection
            </a>
            <p className="hint">Drag the watch to turn it.</p>
          </div>
        </section>

        {STORY.map(({ id, title, body }) => (
          <section key={id} id={id} className={`chapter chapter-${id}`}>
            <div className="caption">
              <h2>{title}</h2>
              <p>{body}</p>
            </div>
          </section>
        ))}

        {MODELS.map((model, i) => (
          <Product key={model.id} model={model} first={i === 0} onAdd={() => setBag((n) => n + 1)} />
        ))}
      </main>

      <footer className="site-footer">
        <p className="footer-brand">Halden</p>

        <div className="footer-columns">
          <nav aria-label="Watches">
            <h2>Watches</h2>
            <ul>
              {MODELS.map((model, i) => (
                <li key={model.id}>
                  <a href={i === 0 ? '#collection' : `#${model.id}`}>{model.name}</a>
                  <span>{model.price}</span>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Explore">
            <h2>Explore</h2>
            <ul>
              <li>
                <a href="#dial">How it's made</a>
              </li>
              <li>
                <a href="#layers">Inside the watch</a>
              </li>
              <li>
                <a href="#top">Back to top</a>
              </li>
            </ul>
          </nav>

          <div>
            <h2>Contact</h2>
            <ul>
              <li>
                <a href="mailto:mujtabadar98@gmail.com">mujtabadar98@gmail.com</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2026 Halden. Prices in US dollars.</p>
          <p className="footer-credit">
            Made by Mujtaba Dar
            <a href="https://github.com/MDar123/" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a href="https://mujtabadar.vercel.app/" target="_blank" rel="noreferrer">
              Portfolio
            </a>
          </p>
        </div>
      </footer>
    </>
  )
}
