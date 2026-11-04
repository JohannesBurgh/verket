// Efterbehandling för Arkivrummet: djupskärpa på det som är långt bort,
// lätt bloom på lime, mjuk vinjett och korn med papperets struktur.
// Allt i några få helbildspass. Kan stängas av helt (se kvalitet.js).
import * as THREE from "three";

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

// Halv upplösning: färg förmultiplicerad med oskärpecirkeln (CoC) och CoC i alfa,
// så att skarpa saker i förgrunden inte blöder ut i den suddiga bakgrunden.
const NED = `
uniform sampler2D tFarg, tDjup; uniform vec2 uTexel; uniform float uNara, uFjarran, uStart, uOmfang;
varying vec2 vUv;
float linjar(float d){ return uNara * uFjarran / (uFjarran - d * (uFjarran - uNara)); }
float coc(vec2 p){ float z = linjar(texture2D(tDjup, p).x); return smoothstep(uStart, uStart + uOmfang, z); }
void main(){
  vec2 o = uTexel * .5;
  vec4 s = vec4(0.);
  for (int i = 0; i < 4; i++) {
    vec2 p = vUv + vec2(i == 0 || i == 2 ? -o.x : o.x, i < 2 ? -o.y : o.y);
    float c = coc(p);
    s += vec4(texture2D(tFarg, p).rgb * c, c);
  }
  gl_FragColor = s * .25;
}`;

// Lime-masken: bara det som lyser starkare än papper kan (lime-markeringarna ritas överstyrda).
const MASK = `
uniform sampler2D tFarg; uniform vec2 uTexel; varying vec2 vUv;
float lime(vec3 c){ return smoothstep(1.25, 1.9, c.g) * step(c.b * 4., c.g) * step(c.r, c.g); }
void main(){
  vec2 o = uTexel; float m = 0.;
  m += lime(texture2D(tFarg, vUv + vec2(-o.x, -o.y)).rgb);
  m += lime(texture2D(tFarg, vUv + vec2( o.x, -o.y)).rgb);
  m += lime(texture2D(tFarg, vUv + vec2(-o.x,  o.y)).rgb);
  m += lime(texture2D(tFarg, vUv + vec2( o.x,  o.y)).rgb);
  gl_FragColor = vec4(m * .25);
}`;

// Separerbar gauss, nio tappar.
const SUDD = `
uniform sampler2D tIn; uniform vec2 uRikt; varying vec2 vUv;
void main(){
  vec4 s = texture2D(tIn, vUv) * .2270270;
  s += (texture2D(tIn, vUv + uRikt * 1.3846154) + texture2D(tIn, vUv - uRikt * 1.3846154)) * .3162162;
  s += (texture2D(tIn, vUv + uRikt * 3.2307692) + texture2D(tIn, vUv - uRikt * 3.2307692)) * .0702703;
  gl_FragColor = s;
}`;

const SLUT = `
uniform sampler2D tFarg, tDjup, tSudd, tGlod, tKorn;
uniform float uNara, uFjarran, uStart, uOmfang, uGlod, uKorn, uVinjett, uTidK, uAspekt, uKornSkala;
uniform vec2 uUpplosning; uniform vec3 uLime;
varying vec2 vUv;
float linjar(float d){ return uNara * uFjarran / (uFjarran - d * (uFjarran - uNara)); }
float slump(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec3 c = texture2D(tFarg, vUv).rgb;
  // överstyrd lime tillbaka till lime, mjuk klippning av det som är för ljust
  float mx = max(c.r, max(c.g, c.b)); c /= max(1., mx);
  float z = linjar(texture2D(tDjup, vUv).x);
  float k = smoothstep(uStart, uStart + uOmfang, z);
  vec4 b = texture2D(tSudd, vUv);
  vec3 bak = b.rgb / max(b.a, 1e-4);
  c = mix(c, bak, k * smoothstep(0., .25, b.a));
  c += uLime * texture2D(tGlod, vUv).r * uGlod;
  vec2 q = vUv - .5; q.x *= uAspekt;
  c *= 1. - uVinjett * smoothstep(.28, 1.05, length(q) * 1.15);
  // kornet: papperets brus, flyttat 24 gånger i sekunden
  vec2 kp = gl_FragCoord.xy * uKornSkala + vec2(slump(vec2(uTidK, 1.7)), slump(vec2(3.1, uTidK)));
  float g = texture2D(tKorn, kp).r - .5;
  float l = dot(c, vec3(.2126, .7152, .0722));
  c += g * uKorn * (1. - l * .6) * (.35 + sqrt(l));
  gl_FragColor = vec4(max(c, 0.), 1.);
  #include <colorspace_fragment>
}`;

export function skapaEfter(renderer, kornTex) {
  const gl = renderer.getContext();
  const halv = renderer.capabilities.isWebGL2 && (renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float"));
  const typ = halv ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const djup = new THREE.DepthTexture(4, 4); djup.type = THREE.UnsignedIntType;
  const huvud = new THREE.WebGLRenderTarget(4, 4, { type: typ, samples: Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0), depthTexture: djup, depthBuffer: true });
  const opt = { type: typ, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const h1 = new THREE.WebGLRenderTarget(4, 4, opt), h2 = new THREE.WebGLRenderTarget(4, 4, opt);
  const k1 = new THREE.WebGLRenderTarget(4, 4, opt), k2 = new THREE.WebGLRenderTarget(4, 4, opt);

  const U = {
    uNara: { value: .1 }, uFjarran: { value: 140 }, uStart: { value: 12 }, uOmfang: { value: 8 },
    uGlod: { value: halv ? .6 : 0 }, uKorn: { value: .055 }, uVinjett: { value: .5 }, uTidK: { value: 0 }, uAspekt: { value: 1 }, uKornSkala: { value: 1 / 240 },
    uLime: { value: new THREE.Color(0xd4ff3f).convertSRGBToLinear() }, uUpplosning: { value: new THREE.Vector2(1, 1) },
  };
  const pass = (frag, uni) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms: uni, depthTest: false, depthWrite: false });
  const ned = pass(NED, { tFarg: { value: huvud.texture }, tDjup: { value: djup }, uTexel: { value: new THREE.Vector2() }, uNara: U.uNara, uFjarran: U.uFjarran, uStart: U.uStart, uOmfang: U.uOmfang });
  const mask = pass(MASK, { tFarg: { value: huvud.texture }, uTexel: { value: new THREE.Vector2() } });
  const sudd = pass(SUDD, { tIn: { value: null }, uRikt: { value: new THREE.Vector2() } });
  const slut = pass(SLUT, { ...U, tFarg: { value: huvud.texture }, tDjup: { value: djup }, tSudd: { value: h1.texture }, tGlod: { value: k1.texture }, tKorn: { value: kornTex } });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), qs = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  quad.frustumCulled = false; qs.add(quad);
  const kor = (mat, mal) => { quad.material = mat; renderer.setRenderTarget(mal); renderer.render(qs, qc); };

  let W = 1, H = 1;
  function storlek(w, h, dpr) {
    W = Math.max(1, Math.round(w * dpr)); H = Math.max(1, Math.round(h * dpr));
    huvud.setSize(W, H);
    const hw = Math.max(1, W >> 1), hh = Math.max(1, H >> 1), kw = Math.max(1, W >> 2), kh = Math.max(1, H >> 2);
    h1.setSize(hw, hh); h2.setSize(hw, hh); k1.setSize(kw, kh); k2.setSize(kw, kh);
    ned.uniforms.uTexel.value.set(1 / W, 1 / H); mask.uniforms.uTexel.value.set(1 / W, 1 / H);
    U.uAspekt.value = W / H; U.uKornSkala.value = 1 / (240 * Math.max(1, dpr)); U.uUpplosning.value.set(W, H);
  }
  function suddig(a, b, w, h, steg) {
    sudd.uniforms.tIn.value = a.texture; sudd.uniforms.uRikt.value.set(steg / w, 0); kor(sudd, b);
    sudd.uniforms.tIn.value = b.texture; sudd.uniforms.uRikt.value.set(0, steg / h); kor(sudd, a);
  }
  function rita(scene, camera, glod) {
    U.uNara.value = camera.near; U.uFjarran.value = camera.far;
    renderer.setRenderTarget(huvud); renderer.render(scene, camera);
    kor(ned, h1); suddig(h1, h2, h1.width, h1.height, 1.6);
    if (glod && U.uGlod.value > 0) { kor(mask, k1); suddig(k1, k2, k1.width, k1.height, 1.4); suddig(k1, k2, k1.width, k1.height, 2.6); }
    else { renderer.setRenderTarget(k1); renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false); }
    kor(slut, null);
  }
  function frigor() { [huvud, h1, h2, k1, k2].forEach((t) => t.dispose()); [ned, mask, sudd, slut].forEach((m) => m.dispose()); djup.dispose(); }
  return { U, rita, storlek, frigor, hdr: halv };
}
